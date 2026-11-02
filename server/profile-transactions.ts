import type { ProfileResult } from './classification';
import type { VerifiedWalletEvidence } from './classification-evidence';

const DAY = 86_400_000;
const MAX_VISIBLE_TRANSACTIONS = 10;
const DEFI_ACTIONS = new Set([
  'supply', 'withdraw', 'borrow', 'repay', 'add_liquidity', 'remove_liquidity',
]);

type RelatedTransaction = NonNullable<ProfileResult['relatedTransactions']>[number];

function inWindow(timestamp: string, cutoff: number, days: number) {
  const time = Date.parse(timestamp);
  return Number.isFinite(time) && time >= cutoff - days * DAY && time < cutoff;
}

function summarize(rows: RelatedTransaction[]) {
  const unique = new Map<string, RelatedTransaction>();
  for (const row of rows) {
    if (!/^0x[a-f0-9]{64}$/i.test(row.hash) || !Number.isFinite(Date.parse(row.timestamp))) continue;
    const hash = row.hash.toLowerCase();
    if (!unique.has(hash)) unique.set(hash, { ...row, hash });
  }
  const ordered = [...unique.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return { relatedTransactionCount: ordered.length, relatedTransactions: ordered.slice(0, MAX_VISIBLE_TRANSACTIONS) };
}

/** Attach transaction references from the same verified inputs used to score profiles. */
export function attachProfileTransactions(profiles: ProfileResult[], input: VerifiedWalletEvidence) {
  const wallet = input.address.toLowerCase();
  const cutoff = Date.parse(input.cutoff);
  const initiated = input.transactions.filter((row) => row.fromAddress.toLowerCase() === wallet);
  const outgoing30 = initiated.filter((row) => row.successful && inWindow(row.timestamp, cutoff, 30));
  const swaps30 = input.dexTrades.filter((row) =>
    row.successful && row.traderAddress.toLowerCase() === wallet && inWindow(row.timestamp, cutoff, 30));
  const defi30 = input.defiActions.filter((row) =>
    row.successful && row.initiatorAddress.toLowerCase() === wallet &&
    DEFI_ACTIONS.has(row.actionType) && inWindow(row.timestamp, cutoff, 30));
  const nft30 = input.nftTrades.filter((row) =>
    row.successful && inWindow(row.timestamp, cutoff, 30) &&
    (row.buyerAddress.toLowerCase() === wallet || row.sellerAddress.toLowerCase() === wallet));

  for (const profile of profiles) {
    let rows: RelatedTransaction[] = [];
    switch (profile.name) {
      case 'Active trader':
        rows = swaps30.map((row) => ({ hash: row.hash, timestamp: row.timestamp, label: 'Verified DEX swap' }));
        break;
      case 'Long-term holder':
        rows = [
          ...swaps30.map((row) => ({ hash: row.hash, timestamp: row.timestamp, label: 'Recent DEX trade' })),
          ...outgoing30.map((row) => ({ hash: row.hash, timestamp: row.timestamp, label: 'Recent outgoing transaction' })),
        ];
        break;
      case 'DeFi participant':
        rows = defi30.map((row) => ({
          hash: row.hash,
          timestamp: row.timestamp,
          label: `${row.protocolId} · ${row.actionType.replaceAll('_', ' ')}`,
        }));
        break;
      case 'NFT trader':
        rows = nft30.map((row) => ({
          hash: row.hash,
          timestamp: row.timestamp,
          label: row.buyerAddress.toLowerCase() === wallet ? 'Verified NFT purchase' : 'Verified NFT sale',
        }));
        break;
      case 'Staking participant':
        rows = input.stakingPositions.flatMap((position) =>
          position.verifiedDepositHash && position.verifiedDepositAt
            ? [{ hash: position.verifiedDepositHash, timestamp: position.verifiedDepositAt, label: `${position.serviceId} staking deposit` }]
            : []);
        break;
      case 'Dormant or new wallet':
        rows = initiated
          .filter((row) => Date.parse(row.timestamp) < cutoff)
          .map((row) => ({ hash: row.hash, timestamp: row.timestamp, label: 'Wallet-initiated transaction' }));
        break;
    }
    Object.assign(profile, summarize(rows));
  }
  return profiles;
}
