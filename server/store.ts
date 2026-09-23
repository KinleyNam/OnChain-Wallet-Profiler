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
  client.on('error', (error) => {
    // Avoid logging connection URLs or credentials.
    console.error('Redis connection error:', error instanceof Error ? error.message : 'unknown error');
  });
  await client.connect();
  return {
    async get(id) {
      const value = await client.get(`analysis:${id}`);
      return value ? decodeAnalysis(value) : null;
    },
    async put(record, ttlSeconds) {
      await client.set(`analysis:${record.analysisId}`, encodeAnalysis(record), {
        expiration: { type: 'EX', value: ttlSeconds },
      });
    },
    async ping() {
      return (await client.ping()) === 'PONG';
    },
    async close() {
      await client.quit();
    },
  };
}
