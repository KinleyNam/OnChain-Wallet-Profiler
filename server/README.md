# Analysis API

The backend serves Ethereum wallet analyses at `/api/v1` on port 3001. Nansen and Etherscan are queried independently so a failed provider does not discard successful results from the other. Nansen supplies detailed activity, historical balances, and current DeFi positions. Etherscan supplies lifetime Ethereum transactions plus ERC-20, ERC-721, and ERC-1155 transfer history. Alchemy verifies Nansen transaction receipts and supplies daily historical prices for movements that the selected provider did not value. Unpriced positive transfers remain marked unavailable rather than appearing as confirmed $0 movements. Completed snapshots are cached in Redis for 10 minutes.

## Local setup

1. Start a local Redis instance or create a Redis Cloud database.
2. Copy `server/.env.example` to `server/.env.local` and set `REDIS_URL` plus the available provider keys. This local file is ignored by Git. Use `rediss://` if TLS is enabled by your Redis provider.
3. In separate terminals, run `npm.cmd run dev:api` and `npm.cmd run dev`.
4. Open `http://localhost:3000/profiler/Overview`. Vite proxies `/api` calls to the backend.

Set at least one of `NANSEN_API_KEY1` or `ETHERSCAN_API_KEY`. Check `http://127.0.0.1:3001/api/v1/health` to verify Redis connectivity.

When `ETHEREUM_RPC_URL` is configured, the API checks `eth_getCode` before cache lookup or provider retrieval. Addresses with deployed bytecode receive `422 SMART_CONTRACT_ADDRESS`; wallet analysis is limited to externally owned accounts. The frontend opens without a default address and starts an analysis only after an address is submitted or supplied explicitly in the URL.

## Endpoints

`POST /api/v1/analyses` accepts `{ "address": "0x…", "periodDays": 30 | 90 | 180 }` and returns an `analysisId`. Under `/api/v1/analyses/{analysisId}`, GET paths are `/status`, `/data`, `/balances`, `/historical-balances`, `/trade-performance`, `/defi-positions`, `/transactions`, `/token-movements`, `/fund-flows`, `/protocols`, `/protocols/{protocolId}/transactions`, `/profiles`, `/profile-evidence`, `/risk-indicators`, `/retrieval-status`, and `/export`. Transaction and movement endpoints accept `limit` (1–100) and `offset`. Movements also accept `token` and `direction` (`in` or `out`). Export returns JSON.

The provider retrieves every page up to 100,000 transactions or 10,000 records for each balance/counterparty dataset. Transaction history that reaches its ceiling is saved with incomplete coverage; incomplete current-balance retrieval is rejected. Optional enrichment failures are recorded as unavailable and do not suppress the core wallet result. Protocols are attributed only when a returned method or source type identifies them. Unidentified activity remains unattributed. Nansen requests may consume provider credits.

Nansen requests have a 60-second per-attempt timeout and retry one time after transient network or timeout failures. Nansen also retries HTTP 500, 502, 503, and 504 once with the same key. If a Nansen transaction request over more than 30 days still fails with one of those statuses, the backend retries the selected period in non-overlapping 30-day windows under the same 100,000-transaction cap. Etherscan calls are paced within this API process for its three-calls-per-second free-tier limit and retry transient timeouts or rate-limit responses up to two times. Provider authorization and validation errors are not retried. If Nansen remains unavailable, another configured provider can still complete the analysis.

If Redis disconnects after startup, completed analyses remain available in a bounded local cache for the remainder of their 10-minute TTL. The health endpoint reports Redis as unavailable during the interruption. On reconnection, locally cached analyses are written back to Redis. The local cache only serves the current API process while Redis is down; a shared Redis connection is still required for cross-instance cache sharing.

The classifier implements the supplied six-profile rules under `classification-v1.0` and `mappings-v10`. Each result has `ASSIGNED`, `NOT_ASSIGNED`, or `NOT_ASSESSED`, a score only when its inputs are verifiable, matched rule IDs, measured variables, and missing inputs. Dormant/New Wallet keeps its score empty and records `new` or `dormant` as the reason. Alchemy receipt verification and provider transaction retrieval support up to 100,000 transactions.

The evidence pipelines use Nansen snapshots to reconstruct 90-day token retention, decoded successful Aave and Uniswap calls for DeFi actions, Etherscan NFT transfers joined to successful OpenSea or Blur transactions with payment, and current Lido positions joined to wallet-initiated deposits and balance history. Receipt verification retains already verified batches if a later Alchemy request times out, but full transaction coverage remains false. Missing pages, failed optional endpoints, absent or incomplete receipt verification, or a period shorter than the rule window leave the affected profile `NOT_ASSESSED`. Unknown contracts and undecoded methods do not receive inferred activity credit. The Protocols used display lists only protocols associated with transactions in the selected period, including Nansen-labeled contract calls and transfer counterparties. Those additional names are added after classification and do not enter the six profile rules. Current DeFi positions do not create Protocols used entries or prove a complete transaction history.

## Deployment

Deploy the API as a persistent Node service, separately from the Vite frontend on Vercel. Set `REDIS_URL`, the available provider keys, `API_HOST=0.0.0.0`, `API_PORT`, and `FRONTEND_ORIGIN` in the backend host's private environment settings. Set `VITE_API_BASE_URL` to the public HTTPS backend origin when building the frontend. Never put backend secrets in a `VITE_` variable. Redis snapshots expire after 10 minutes. Add authentication and distributed rate limiting before offering public live analyses.

Nansen credit failover: configure `NANSEN_API_KEY1` through `NANSEN_API_KEY4` in `server/.env.local` (or the backend environment). The legacy `NANSEN_API_KEY` is also supported and takes priority. Credit/payment failures retry the same request with the next key, including pagination and enrichment. Exhausted keys are skipped across analyses in the same server process for five minutes, then become eligible again; restarting the API resets this state. Ordinary rate limits, authentication failures, and permission errors do not rotate keys. If every key is exhausted, the existing Etherscan fallback applies when configured.

Transaction retrieval stops after 100,000 records but still saves the analysis and continues enrichment. `wallet.transactionCoverage` (also exposed in summary and retrieval status responses) reports whether the selected history is complete. Capped histories show a partial-data notice; existing classification rules are applied to available verified activity, with incomplete coverage disclosed. A confirmed final page at exactly 100,000 records is considered complete.
