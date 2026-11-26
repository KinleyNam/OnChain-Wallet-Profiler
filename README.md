# OnChain Wallet Profiler

Ethereum wallet profiler with a React frontend, a Nansen-backed analysis API, and Redis snapshot caching. Enter an Ethereum address to view current and historical balances, recent transactions, token movements, dedicated counterparty flows, trade performance, DeFi positions, protocol attribution, profile evidence, and behavioral indicators when those Nansen datasets are available.

For a complete folder-by-folder explanation, startup trace, and the exact internal and external requests triggered by **Analyze wallet**, see [docs/PROJECT_CODE_GUIDE.md](docs/PROJECT_CODE_GUIDE.md).

## Run locally

```powershell
npm.cmd install
```

Copy `server/.env.example` to `server/.env.local`, then set `REDIS_URL` and at least one wallet provider key. Nansen and Etherscan can be combined with the optional Alchemy RPC. Run the API:

```powershell
npm.cmd run dev:api
```

In another PowerShell window, start the frontend:

```powershell
npm.cmd run dev
```

Open `http://localhost:3000/profiler/Overview`. The frontend proxies `/api` requests to localhost:3001. Each profiler tab has its own `/profiler/...` route, and the selected wallet stays in the URL. Each analysis requests available Ethereum lifetime history.

Analyses are cached for 10 minutes per address. API requests may consume Nansen credits. Nansen transaction retrieval supports up to 100,000 records; Etherscan retrieval is capped at 10,000 records per endpoint. If a provider reaches its limit before confirming the final page, the result reports incomplete coverage. The 10,000-balance retrieval limit remains unchanged.

The five classification decisions follow `classification-v1.1` in [server/classification-rules.ts](server/classification-rules.ts). The [evidence builder](server/classification-evidence.ts) counts verified, deduplicated actions in the fixed rule windows, and the [decision engine](server/classification.ts) applies points and mandatory minimums. Nansen supplies wallet activity, 90-day balance snapshots, and current DeFi positions; Etherscan supplies lifetime transactions and ERC-20 transfer history; and Alchemy verifies receipts. The backend extracts evidence for active trading, long-term holding, DeFi participation, staking, and dormant/new-wallet decisions. A large transaction count alone does not prove a profile; affected results display **Not enough data** when a required dataset is unavailable or incomplete.

```powershell
npm.cmd run build
```

The backend routes, limitations, and deployment variables are documented in [server/README.md](server/README.md). For deployment, host the persistent API separately from the Vite frontend and set `VITE_API_BASE_URL` to its public HTTPS origin. Keep Redis and provider credentials only in the backend environment.
