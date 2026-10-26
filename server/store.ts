import { createClient } from 'redis';
import { gzipSync, gunzipSync } from 'node:zlib';
import type { AnalysisRecord } from './analysis';

export interface AnalysisStore {
  get(id: string): Promise<AnalysisRecord | null>;
  put(record: AnalysisRecord, ttlSeconds: number): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export function encodeAnalysis(record: AnalysisRecord) {
  return `gz:${gzipSync(JSON.stringify(record)).toString('base64')}`;
}

export function decodeAnalysis(value: string): AnalysisRecord {
  const json = value.startsWith('gz:')
    ? gunzipSync(Buffer.from(value.slice(3), 'base64')).toString('utf8')
    : value;
  return JSON.parse(json) as AnalysisRecord;
}

export async function connectRedis(url: string): Promise<AnalysisStore> {
  const client = createClient({ url, disableOfflineQueue: true });
  // A Redis Cloud connection can drop while a long analysis is running. Keep
  // completed snapshots available in this process for their normal TTL while
  // the client reconnects. This fallback is bounded and is not shared across
  // API instances; Redis remains the source of shared cached analyses.
  const local = new Map<string, { value: string; expiresAt: number }>();
  const MAX_LOCAL_RECORDS = 20;
  let redisErrorLogged = false;
  function warn(error: unknown) {
    if (redisErrorLogged) return;
    redisErrorLogged = true;
    console.warn('Redis temporarily unavailable; using the local analysis cache:',
      error instanceof Error ? error.message : 'connection unavailable');
  }
  function remember(id: string, value: string, ttlSeconds: number) {
    local.delete(id);
    local.set(id, { value, expiresAt: Date.now() + ttlSeconds * 1_000 });
    if (local.size > MAX_LOCAL_RECORDS) local.delete(local.keys().next().value!);
  }
  function recalled(id: string) {
    const entry = local.get(id);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      local.delete(id);
      return null;
    }
    return decodeAnalysis(entry.value);
  }
  client.on('error', (error) => {
    // Avoid logging connection URLs or credentials.
    warn(error);
  });
  client.on('ready', () => {
    redisErrorLogged = false;
    // Republish analyses created while Redis was disconnected so other API
    // instances can use them for the remainder of the original TTL.
    for (const [id, entry] of local) {
      const remainingSeconds = Math.ceil((entry.expiresAt - Date.now()) / 1_000);
      if (remainingSeconds <= 0) {
        local.delete(id);
        continue;
      }
      void client.set(`analysis:${id}`, entry.value, {
        expiration: { type: 'EX', value: remainingSeconds },
      }).catch(warn);
    }
  });
  await client.connect();
  return {
    async get(id) {
      if (client.isReady) {
        try {
          const value = await client.get(`analysis:${id}`);
          if (value) {
            const record = decodeAnalysis(value);
            const remainingSeconds = Math.max(0,
              Math.ceil((Date.parse(record.expiresAt) - Date.now()) / 1_000));
            if (remainingSeconds) remember(id, value, remainingSeconds);
            return record;
          }
        } catch (error) {
          warn(error);
        }
      }
      return recalled(id);
    },
    async put(record, ttlSeconds) {
      const value = encodeAnalysis(record);
      remember(record.analysisId, value, ttlSeconds);
      if (client.isReady) {
        try {
          await client.set(`analysis:${record.analysisId}`, value, {
            expiration: { type: 'EX', value: ttlSeconds },
          });
        } catch (error) {
          warn(error);
        }
      }
    },
    async ping() {
      if (!client.isReady) return false;
      try {
        return (await client.ping()) === 'PONG';
      } catch (error) {
        warn(error);
        return false;
      }
    },
    async close() {
      if (client.isReady) await client.quit();
      else client.destroy();
    },
  };
}
