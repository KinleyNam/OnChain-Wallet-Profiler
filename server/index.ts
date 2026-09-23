import { config } from 'dotenv';
import { createApi } from './api';
import { connectRedis, type AnalysisStore } from './store';
import { analysisIdFor } from './analysis';
import { createWalletAnalysis } from './wallet-provider';

config({ path: 'server/.env.local', quiet: true });
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error('REDIS_URL is required. See server/README.md.');
  process.exit(1);
}

const port = Number(process.env.API_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('API_PORT must be a valid TCP port.');
  process.exit(1);
}

let store: AnalysisStore;
try {
  store = await connectRedis(redisUrl);
} catch {
  console.error('Could not connect to Redis. Check the server environment settings.');
  process.exit(1);
}
const nansenKey = process.env.NANSEN_API_KEY;
const etherscanKey = process.env.ETHERSCAN_API_KEY;
if (!nansenKey && !etherscanKey) {
  console.error('NANSEN_API_KEY or ETHERSCAN_API_KEY is required. See server/README.md.');
  await store.close();
  process.exit(1);
}
const ethereumRpcUrl = process.env.ETHEREUM_RPC_URL;
if (!ethereumRpcUrl) {
  console.warn('ETHEREUM_RPC_URL is not set; transaction sender and receipt status will not be verified.');
}
const app = createApi(store, process.env.FRONTEND_ORIGIN, {
  idFor: analysisIdFor,
  create: (address, periodDays) =>
    createWalletAnalysis(address, periodDays, {
      nansenKey,
      etherscanKey,
      ethereumRpcUrl,
    }),
});
try {
  await app.listen({ host: process.env.API_HOST ?? '127.0.0.1', port });
  console.log(`Analysis API listening on port ${port}`);
} catch (error) {
  console.error('Could not start analysis API:', error instanceof Error ? error.message : 'unknown error');
  await store.close();
  process.exit(1);
}

async function shutdown() {
  await app.close();
  await store.close();
}
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
