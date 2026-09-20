# OnChain Wallet Profiler

Frontend prototype based on the project proposal, built with React, Tailwind CSS, Recharts and accessible Shadcn controls. All wallet data, classifications and confidence indicators are synthetic. No wallet connection, blockchain API, database or financial analysis is performed.

The proposed frontend-to-backend contract is documented in [`docs/internal-api.md`](docs/internal-api.md). A machine-readable OpenAPI 3.1 specification is available at [`docs/openapi.yaml`](docs/openapi.yaml).

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3000. Enter a syntactically valid Ethereum address or open the profiler. Choose 30, 90 or 180 days. Explore Overview, Balances, Activity, Token movements, Fund flows, Protocols used and Profile evidence.

Each profiler tab has a direct route: `/profiler/Overview`, `/profiler/Balances`, `/profiler/Activity`, `/profiler/Token-movements`, `/profiler/Fund-flows`, `/profiler/Protocols-used`, `/profiler/Risk-indicators`, and `/profiler/Profile-evidence`. The URL retains the selected wallet and period, and browser Back and Forward navigation restores the matching view.

Balances show six assets and their USD allocation at the September 10, 2026 snapshot date. Token movements support asset and direction filters. Clicking a protocol opens its transaction history; clicking a transaction reveals its transfer legs and full addresses. The fund-flow table lists incoming, outgoing and total value by counterparty; selecting an amount filters the underlying transfer ledger. Transaction tables are paginated, and the profile export includes holdings, transactions, movements and flow totals.

The frontend independently assesses Active Trader, Long-Term Holder, DeFi Participant, NFT Trader, Staking Participant, and Dormant or New Wallet. It presents each rule result with its evidence, score, threshold and confidence. NFT Trader uses OpenSea and Blur activity without adding a separate NFT holdings section. The interface also presents a behavioral risk-indicator breakdown, data coverage and provenance, analysis dates, attribution coverage and the rule version. The primary navigation remains visible as equal-height tabs at desktop, tablet and mobile widths.

OpenSea and Blur are included as marketplace protocols. Selecting either protocol opens its filtered transaction history like the other supported protocols.

The fixture module defines six test Ethereum addresses, one for each supported profile. Entering an address regenerates the entire dashboard from that address, including balances, transactions, token movements, fund flows, protocol history, profile evidence and risk indicators. Each address is deterministic, so entering it again produces the same wallet history and classification.

## Checks

```powershell
npm.cmd run build
npx.cmd tsc --noEmit
```

The profiler is in app/page.tsx; balance, transfer and flow components are in app/wallet-panels.tsx. The shared fixture ledger in lib/wallet-data.ts generates 180 days of history and reconciles balances, transactions and transfer totals. Changing the activity period filters the same history without changing the snapshot balance. Fixture prices are fixed, and network fees and price changes are not modeled. Behavioral classifications and anomaly scores remain placeholders, not production classification rules. Replace fixtures with a typed data service when adding the planned backend.

This is a standalone React + Vite frontend served on localhost. Run npm.cmd run build, then npm.cmd start to serve the production build locally.
