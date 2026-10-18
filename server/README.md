# Analysis API

The backend serves Ethereum wallet analyses at `/api/v1` on port 3001. Nansen, Etherscan, and Arkham are queried independently so a failed provider does not discard successful results from the others. Nansen supplies detailed activity, historical balances, and current DeFi positions. Etherscan supplies lifetime Ethereum transactions plus ERC-20, ERC-721, and ERC-1155 transfer history. Arkham supplies balances, counterparties, loan positions, transfers, and verified swaps, and Alchemy verifies Nansen transaction receipts. Arkham can also produce a reduced fallback analysis if both Nansen and Etherscan are unavailable. Completed snapshots are cached in Redis for 10 minutes.

## Local setup

1. Start a local Redis instance or create a Redis Cloud database.
2. Copy `server/.env.example` to `server/.env.local` and set `REDIS_URL` plus the available provider keys. `ARKHAM_API_BASE_URL` defaults to `https://api.arkm.com`. This local file is ignored by Git. Use `rediss://` if TLS is enabled by your Redis provider.
3. In separate terminals, run `npm.cmd run dev:api` and `npm.cmd run dev`.
4. Open `http://localhost:3000/profiler/Overview`. Vite proxies `/api` calls to the backend.

Set at least one of `NANSEN_API_KEY1`, `ETHERSCAN_API_KEY`, or `ARKHAM_API_KEY`. Check `http://127.0.0.1:3001/api/v1/health` to verify Redis connectivity. `npm.cmd run test:api` runs tests with fixtures and does not contact external providers.

## Endpoints

`POST /api/v1/analyses` accepts `{ "address": "0x…", "periodDays": 30 | 90 | 180 }` and returns an `analysisId`. Under `/api/v1/analyses/{analysisId}`, GET paths are `/status`, `/data`, `/balances`, `/historical-balances`, `/trade-performance`, `/defi-positions`, `/transactions`, `/token-movements`, `/fund-flows`, `/protocols`, `/protocols/{protocolId}/transactions`, `/profiles`, `/profile-evidence`, `/risk-indicators`, `/retrieval-status`, and `/export`. Transaction and movement endpoints accept `limit` (1–100) and `offset`. Movements also accept `token` and `direction` (`in` or `out`). Export returns JSON.

The provider retrieves every page up to 100,000 transactions or 10,000 records for each balance/counterparty dataset. Transaction history that reaches its ceiling is saved with incomplete coverage; incomplete current-balance retrieval is rejected. Optional enrichment failures are recorded as unavailable and do not suppress the core wallet result. Protocols are attributed only when a returned method or source type identifies them. Unidentified activity remains unattributed. Nansen requests may consume provider credits.

Nansen and Etherscan requests have a 60-second per-attempt timeout and retry one time after transient network or timeout failures. Provider authorization and validation errors are not retried.

The classifier implements the supplied six-profile rules under `classification-v1.0` and `mappings-v10`. Each result has `ASSIGNED`, `NOT_ASSIGNED`, or `NOT_ASSESSED`, a score only when its inputs are verifiable, matched rule IDs, measured variables, and missing inputs. Dormant/New Wallet keeps its score empty and records `new` or `dormant` as the reason. Alchemy receipt verification and provider transaction retrieval support up to 100,000 transactions. Arkham swaps count only when the wallet is the reported sender and the swap hash matches complete verified transaction history.

The evidence pipelines use Nansen snapshots to reconstruct 90-day token retention, decoded successful Aave and Uniswap calls for DeFi actions, Etherscan NFT transfers joined to successful OpenSea or Blur transactions with payment, and current Lido positions joined to wallet-initiated deposits and balance history. Missing pages, failed optional endpoints, absent receipt verification, or a period shorter than the rule window leave the affected profile `NOT_ASSESSED`. Unknown contracts and undecoded methods do not receive inferred activity credit.

## Deployment

Deploy the API as a persistent Node service, separately from the Vite frontend on Vercel. Set `REDIS_URL`, the available provider keys, `API_HOST=0.0.0.0`, `API_PORT`, and `FRONTEND_ORIGIN` in the backend host's private environment settings. Set `VITE_API_BASE_URL` to the public HTTPS backend origin when building the frontend. Never put backend secrets in a `VITE_` variable. Redis snapshots expire after 10 minutes. Add authentication and distributed rate limiting before offering public live analyses.

Nansen credit failover: configure `NANSEN_API_KEY1` through `NANSEN_API_KEY4` in `server/.env.local` (or the backend environment). The legacy `NANSEN_API_KEY` is also supported and takes priority. Credit/payment failures retry the same request with the next key, including pagination and enrichment. Exhausted keys are skipped across analyses in the same server process for five minutes, then become eligible again; restarting the API resets this state. Ordinary rate limits, authentication failures, and permission errors do not rotate keys. If every key is exhausted, the existing Etherscan fallback applies when configured.

Transaction retrieval stops after 100,000 records but still saves the analysis and continues enrichment. `wallet.transactionCoverage` (also exposed in summary and retrieval status responses) reports whether the selected history is complete. Capped histories show a partial-data notice; existing classification rules are applied to available verified activity, with incomplete coverage disclosed. A confirmed final page at exactly 100,000 records is considered complete.
