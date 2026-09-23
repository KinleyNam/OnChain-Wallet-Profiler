# OnChain Wallet Profiler

Ethereum wallet profiler with a React frontend, a Nansen-backed analysis API, and Redis snapshot caching. Enter an Ethereum address to view current and historical balances, recent transactions, token movements, dedicated counterparty flows, trade performance, DeFi positions, protocol attribution, profile evidence, and behavioral indicators when those Nansen datasets are available.

## Run locally

```powershell
npm.cmd install
```

Copy `server/.env.example` to `server/.env.local`, then set `REDIS_URL`, `NANSEN_API_KEY`, and `ETHEREUM_RPC_URL` in the local file. Run the API:

```powershell
npm.cmd run dev:api
```

In another PowerShell window, start the frontend:

```powershell
npm.cmd run dev
```

Open `http://localhost:3000/profiler/Overview`. The frontend proxies `/api` requests to localhost:3001. Each profiler tab has its own `/profiler/...` route, and the selected wallet and period stay in the URL.

Nansen data is fetched and cached for 10 minutes per address and analysis period. API requests may consume Nansen credits. The app stops rather than presenting a partial analysis when provider requests fail or exceed the 5,000-transaction or 10,000-balance retrieval limit.

The six classification decisions follow `classification-v1.0` in [server/classification-rules.ts](server/classification-rules.ts). The [evidence builder](server/classification-evidence.ts) counts verified, deduplicated actions in the fixed rule windows, and the [decision engine](server/classification.ts) applies points and mandatory minimums. The current Nansen balance and address-transaction responses do not verify every input these rules require, so affected live results display **Not enough data** with the missing evidence. Observed transfers or protocol labels are never counted as verified trades, staking deposits, or wallet-initiated actions. Tests cover the proposal's examples and boundaries.

```powershell
npm.cmd run build
npm.cmd run test:api
```

The backend routes, limitations, and deployment variables are documented in [server/README.md](server/README.md). For deployment, host the persistent API separately from the Vite frontend and set `VITE_API_BASE_URL` to its public HTTPS origin. Keep `REDIS_URL` and `NANSEN_API_KEY` only in the backend environment.
