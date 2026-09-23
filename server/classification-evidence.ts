import type { ClassificationEvidence, RetainedHolding } from './classification';

const DAY = 86_400_000;
const DEFI_ACTIONS = new Set([
  'supply',
  'withdraw',
  'borrow',
  'repay',
  'add_liquidity',
  'remove_liquidity',
]);

type VerifiedTransaction = {
  hash: string;
  timestamp: string;
  fromAddress: string;
  successful: boolean;
};
type VerifiedSwap = {
  hash: string;
  timestamp: string;
  traderAddress: string;
  successful: boolean;
  tokenIds: string[];
};
type VerifiedDefiAction = {
  hash: string;
  timestamp: string;
  initiatorAddress: string;
  successful: boolean;
  protocolId: string;
  actionType: string;
};
type VerifiedNftTrade = {
  hash: string;
  timestamp: string;
  buyerAddress: string;
  sellerAddress: string;
  successful: boolean;
  collectionId: string;
};
type VerifiedStakingPosition = {
  serviceId: string;
  active: boolean;
  verifiedDepositAt: string | null;
  continuousSince: string | null;
};

export type VerifiedWalletEvidence = {
  address: string;
  cutoff: string;
  coverage: {
    transactions30d: boolean;
    transactions90d: boolean;
    lifetimeTransactions: boolean;
    dexTrades30d: boolean;
    defiActions30d: boolean;
    nftTrades30d: boolean;
    holdingHistory90d: boolean;
    stakingPositionsAndDeposits: boolean;
  };
  transactions: VerifiedTransaction[];
  dexTrades: VerifiedSwap[];
  defiActions: VerifiedDefiAction[];
  nftTrades: VerifiedNftTrade[];
  holdings: RetainedHolding[];
  stakingPositions: VerifiedStakingPosition[];
};

const addressIs = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();
function inWindow(timestamp: string, cutoff: number, days: number) {
  const time = Date.parse(timestamp);
  return Number.isFinite(time) && time >= cutoff - days * DAY && time < cutoff;
}
function distinctByHash<T extends { hash: string }>(rows: T[]) {
  return [
    ...new Map(rows.map((row) => [row.hash.toLowerCase(), row])).values(),
  ];
}
const uniqueDays = (rows: Array<{ timestamp: string }>) =>
  new Set(rows.map((row) => new Date(Date.parse(row.timestamp)).toISOString().slice(0, 10))).size;

export function buildClassificationEvidence(
  input: VerifiedWalletEvidence,
): ClassificationEvidence {
  const cutoff = Date.parse(input.cutoff);
  if (!Number.isFinite(cutoff))
    throw new Error('Classification cutoff must be a UTC timestamp.');
  const wallet = input.address.toLowerCase();
  const transactions = distinctByHash(input.transactions).filter((row) =>
    addressIs(row.fromAddress, wallet),
  );
  const outgoing30 = transactions.filter(
    (row) => row.successful && inWindow(row.timestamp, cutoff, 30),
  );
  const initiated90 = transactions.filter((row) =>
    inWindow(row.timestamp, cutoff, 90),
  );
  const swaps30 = distinctByHash(
    input.dexTrades.filter(
      (row) =>
        row.successful &&
        addressIs(row.traderAddress, wallet) &&
        inWindow(row.timestamp, cutoff, 30),
    ),
  );
  const outgoingHashes = new Set(
    outgoing30.map((row) => row.hash.toLowerCase()),
  );
  const swapsConsistent =
    !input.coverage.transactions30d ||
    swaps30.every((row) => outgoingHashes.has(row.hash.toLowerCase()));
  const defi30 = input.defiActions.filter(
    (row) =>
      row.successful &&
      addressIs(row.initiatorAddress, wallet) &&
      DEFI_ACTIONS.has(row.actionType) &&
      inWindow(row.timestamp, cutoff, 30),
  );
  const defiConsistent =
    !input.coverage.transactions30d ||
    defi30.every((row) => outgoingHashes.has(row.hash.toLowerCase()));
  const nft30 = input.nftTrades.filter(
    (row) =>
      row.successful &&
      (addressIs(row.buyerAddress, wallet) ||
        addressIs(row.sellerAddress, wallet)) &&
      inWindow(row.timestamp, cutoff, 30),
  );
  const nftTransactionCount = distinctByHash(nft30).length;
  const lifetime = transactions
    .filter((row) => Date.parse(row.timestamp) < cutoff)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const positions = input.stakingPositions.filter(
    (position) => position.active,
  );
  const continuousStakingDays = Math.max(
    0,
    ...positions.map((position) =>
      position.continuousSince
        ? Math.floor((cutoff - Date.parse(position.continuousSince)) / DAY)
        : 0,
    ),
  );

  return {
    cutoff: input.cutoff,
    activeTrader: {
      ...(input.coverage.dexTrades30d && swapsConsistent
        ? {
            dexTransactions: swaps30.length,
            tradingDays: uniqueDays(swaps30),
            tradedTokenIds: [
              ...new Set(
                swaps30.flatMap((row) =>
                  row.tokenIds.map((token) => token.toLowerCase()),
                ),
              ),
            ],
          }
        : {}),
      ...(input.coverage.transactions30d
        ? { outgoingTransactions: outgoing30.length }
        : {}),
    },
    longTermHolder: {
      ...(input.coverage.holdingHistory90d
        ? { holdings: input.holdings, holdingHistoryComplete: true }
        : {}),
      ...(input.coverage.transactions30d
        ? { recentOutgoingTransactions: outgoing30.length }
        : {}),
      ...(input.coverage.dexTrades30d && swapsConsistent
        ? { recentDexTrades: swaps30.length }
        : {}),
    },
    defiParticipant:
      input.coverage.defiActions30d && defiConsistent
        ? {
            transactions: distinctByHash(defi30).length,
            days: uniqueDays(defi30),
            protocolIds: [
              ...new Set(defi30.map((row) => row.protocolId.toLowerCase())),
            ],
            actionTypes: [...new Set(defi30.map((row) => row.actionType))],
          }
        : undefined,
    nftTrader: input.coverage.nftTrades30d
      ? {
          tradeTransactions: nftTransactionCount,
          tradingDays: uniqueDays(nft30),
          collectionIds: [
            ...new Set(nft30.map((row) => row.collectionId.toLowerCase())),
          ],
          hasPurchases: nft30.some((row) =>
            addressIs(row.buyerAddress, wallet),
          ),
          hasSales: nft30.some((row) => addressIs(row.sellerAddress, wallet)),
        }
      : undefined,
    stakingParticipant: input.coverage.stakingPositionsAndDeposits
      ? {
          hasActivePosition: positions.length > 0,
          hasVerifiedDeposit: positions.some(
            (position) => position.verifiedDepositAt !== null,
          ),
          hasDepositInLast90Days: positions.some(
            (position) =>
              position.verifiedDepositAt !== null &&
              inWindow(position.verifiedDepositAt, cutoff, 90),
          ),
          continuousStakingDays,
        }
      : undefined,
    dormantOrNew: {
      ...(input.coverage.lifetimeTransactions
        ? {
            firstActivityKnown: true,
            firstActivityAt: lifetime[0]?.timestamp ?? null,
            lifetimeInitiatedTransactions: lifetime.length,
          }
        : {}),
      ...(input.coverage.transactions90d
        ? { initiatedTransactions90d: initiated90.length }
        : {}),
    },
  };
}
