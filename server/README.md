# Analysis API

The backend serves Ethereum wallet analyses at `/api/v1` on port 3001. It prefers Nansen for balances, transactions and enrichments. When Nansen is unavailable, including exhausted credits, it continues with Etherscan transaction and ERC-20 transfer history. Completed snapshots are cached in Redis for 10 minutes and report the provider used in `source`.

## Local setup

1. Start a local Redis instance or create a Redis Cloud database.
2. Copy `server/.env.example` to `server/.env.local` and set `REDIS_URL`, `NANSEN_API_KEY`, and the Alchemy Ethereum Mainnet endpoint as `ETHEREUM_RPC_URL`. This local file is ignored by Git. Use `rediss://` if TLS is enabled by your Redis provider.
3. In separate terminals, run `npm.cmd run dev:api` and `npm.cmd run dev`.
4. Open `http://localhost:3000/profiler/Overview`. Vite proxies `/api` calls to the backend.

Set at least one of `NANSEN_API_KEY` or `ETHERSCAN_API_KEY`. Check `http://127.0.0.1:3001/api/v1/health` to verify Redis connectivity. `npm.cmd run test:api` runs tests with fixtures and does not contact external providers.

## Endpoints

`POST /api/v1/analyses` accepts `{ "address": "0x…", "periodDays": 30 | 90 | 180 }` and returns an `analysisId`. Under `/api/v1/analyses/{analysisId}`, GET paths are `/status`, `/data`, `/balances`, `/historical-balances`, `/trade-performance`, `/defi-positions`, `/transactions`, `/token-movements`, `/fund-flows`, `/protocols`, `/protocols/{protocolId}/transactions`, `/profiles`, `/profile-evidence`, `/risk-indicators`, `/retrieval-status`, and `/export`. Transaction and movement endpoints accept `limit` (1–100) and `offset`. Movements also accept `token` and `direction` (`in` or `out`). Export returns JSON.

The provider retrieves every page up to 5,000 transactions or 10,000 records for each balance/counterparty dataset. It rejects incomplete core transaction or current-balance retrieval rather than saving a partial analysis. Optional enrichment failures are recorded as unavailable and do not suppress the core wallet result. Protocols are attributed only when a returned method or source type identifies them. Unidentified activity remains unattributed. Nansen requests may consume provider credits.

The classifier implements the supplied six-profile rules under `classification-v1.0` and `mappings-v5`. Each result has `ASSIGNED`, `NOT_ASSIGNED`, or `NOT_ASSESSED`, a score only when its inputs are verifiable, matched rule IDs, measured variables, and missing inputs. Dormant/New Wallet keeps its score empty and records `new` or `dormant` as the reason. Historical balances, counterparties, PnL summaries, current DeFi positions, and wallet DEX trades enrich the analysis when the Nansen plan permits them. Alchemy verifies transaction initiator and receipt status for analyses with up to 1,000 retrieved transactions. DEX trades are used for classification only when their hashes match verified successful wallet transactions. The available data still does not confirm NFT trade roles, complete balance continuity, staking deposit history, or lifetime history. Affected profiles remain `NOT_ASSESSED` until those inputs are verified.

## Deployment

Deploy the API as a persistent Node service, separately from the Vite frontend on Vercel. Set `REDIS_URL`, `ETHERSCAN_API_KEY`, optional `NANSEN_API_KEY`, `API_HOST=0.0.0.0`, `API_PORT`, and `FRONTEND_ORIGIN` in the backend host's private environment settings. Set `VITE_API_BASE_URL` to the public HTTPS backend origin when building the frontend. Never put backend secrets in a `VITE_` variable. Redis snapshots expire after 10 minutes. Add authentication and distributed rate limiting before offering public live analyses.
