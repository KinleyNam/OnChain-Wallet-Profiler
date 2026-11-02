import type { RetainedHolding } from './classification';

const DAY = 86_400_000;

export type PipelineToken = {
  tokenAddress?: string;
  symbol?: string;
  amount: number;
  valueUsd: number;
  fromAddress?: string;
  toAddress?: string;
};

export type PipelineTransaction = {
  hash: string;
  timestamp: string;
  method: string;
  protocol: string;
  fromAddress?: string;
  successful?: boolean;
  nativeAmount?: number;
  tokensSent: PipelineToken[];
  tokensReceived: PipelineToken[];
};

export type PipelineBalance = {
  tokenAddress: string;
  symbol: string;
  amount: number;
  priceUsd: number;
  valueUsd: number;
};

export type PipelineHistoricalBalance = {
  timestamp: string;
  tokenAddress: string;
  symbol: string;
  amount: number;
  valueUsd: number;
};

export type PipelineNftTransfer = {
  hash: string;
  timestamp: string;
  fromAddress: string;
  toAddress: string;
  collectionId: string;
};

export type PipelineDefiPosition = {
  protocolId: string;
  totalValueUsd: number;
  positionTypes: string[];
};

const addressIs = (left: string | undefined, right: string) =>
  Boolean(left) && left!.toLowerCase() === right.toLowerCase();

function methodName(value: string) {
  return value
    .split('(')[0]
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
}

function defiAction(method: string, protocol: string) {
  const name = methodName(method);
  const known = protocol === 'Aave' || protocol === 'Uniswap';
  if (!known) return null;
  if (/^(supply|supplywithpermit|deposit)$/.test(name)) return 'supply';
  if (name === 'withdraw') return 'withdraw';
  if (/^(borrow|borrowwithpermit)$/.test(name)) return 'borrow';
  if (/^(repay|repaywithpermit|repaywithatokens)$/.test(name)) return 'repay';
  if (/^(addliquidity|addliquidityeth|mint|increaseliquidity)$/.test(name))
    return 'add_liquidity';
  if (/^(removeliquidity|removeliquidityeth|decreaseliquidity)$/.test(name))
    return 'remove_liquidity';
  return null;
}

export function extractDefiActions(
  wallet: string,
  transactions: PipelineTransaction[],
) {
  return transactions.flatMap((transaction) => {
    const actionType = defiAction(transaction.method, transaction.protocol);
    if (
      !actionType ||
      transaction.successful !== true ||
      !addressIs(transaction.fromAddress, wallet)
    )
      return [];
    return [{
      hash: transaction.hash,
      timestamp: transaction.timestamp,
      initiatorAddress: wallet.toLowerCase(),
      successful: true,
      protocolId: transaction.protocol.toLowerCase(),
      actionType,
    }];
  });
}

export function reconstructRetainedHoldings(input: {
  cutoff: string;
  balances: PipelineBalance[];
  historical: PipelineHistoricalBalance[];
  transactions: PipelineTransaction[];
}): RetainedHolding[] {
  const cutoff = Date.parse(input.cutoff);
  const start = cutoff - 90 * DAY;
  const histories = new Map<string, PipelineHistoricalBalance[]>();
  for (const row of input.historical) {
    const time = Date.parse(row.timestamp);
    if (!Number.isFinite(time) || time < start || time >= cutoff) continue;
    const id = row.tokenAddress.toLowerCase();
    const values = histories.get(id) ?? [];
    values.push(row);
    histories.set(id, values);
  }
  const current = new Map(
    input.balances.map((row) => [row.tokenAddress.toLowerCase(), row]),
  );
  const tokenIds = new Set([...histories.keys(), ...current.keys()]);
  return [...tokenIds].map((tokenId) => {
    const snapshots = (histories.get(tokenId) ?? [])
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const first = snapshots[0];
    const now = current.get(tokenId);
    const firstTime = first ? Date.parse(first.timestamp) : Number.NaN;
    const startingBalance = first?.amount ?? 0;
    const startingPriceUsd = first && first.amount > 0
      ? first.valueUsd / first.amount
      : now?.priceUsd ?? 0;
    const grossOutgoingUnits = input.transactions
      .filter((transaction) => {
        const time = Date.parse(transaction.timestamp);
        return transaction.successful === true && time >= start && time < cutoff;
      })
      .flatMap((transaction) => transaction.tokensSent)
      .filter((token) => token.tokenAddress?.toLowerCase() === tokenId)
      .reduce((sum, token) => sum + token.amount, 0);
    const observed = [...snapshots.map((row) => row.amount), now?.amount ?? 0];
    return {
      tokenId: `ethereum:${tokenId}`,
      recognised: Boolean((now?.symbol ?? first?.symbol)?.trim()) && startingPriceUsd > 0,
      // The endpoint returns snapshots for the requested interval. A first
      // snapshot near its boundary establishes the starting state.
      reconstructable: Number.isFinite(firstTime) && firstTime <= start + 2 * DAY,
      startingBalance,
      currentBalance: now?.amount ?? 0,
      startingPriceUsd,
      grossOutgoingUnits,
      minimumBalance: observed.length ? Math.min(...observed) : 0,
    };
  });
}

export function extractNftTrades(input: {
  wallet: string;
  transactions: PipelineTransaction[];
  nftTransfers: PipelineNftTransfer[];
}) {
  const wallet = input.wallet.toLowerCase();
  const transactions = new Map(
    input.transactions.map((transaction) => [transaction.hash.toLowerCase(), transaction]),
  );
  return input.nftTransfers.flatMap((transfer) => {
    const transaction = transactions.get(transfer.hash.toLowerCase());
    if (
      !transaction ||
      transaction.successful !== true ||
      (transaction.protocol !== 'OpenSea' && transaction.protocol !== 'Blur')
    )
      return [];
    const buyer = transfer.toAddress.toLowerCase();
    const seller = transfer.fromAddress.toLowerCase();
    if (buyer !== wallet && seller !== wallet) return [];
    const hasPayment = (transaction.nativeAmount ?? 0) > 0 ||
      [...transaction.tokensSent, ...transaction.tokensReceived].some(
        (token) => token.valueUsd > 0 || token.amount > 0,
      );
    if (!hasPayment) return [];
    return [{
      hash: transfer.hash.toLowerCase(),
      timestamp: transfer.timestamp,
      buyerAddress: buyer,
      sellerAddress: seller,
      successful: true,
      collectionId: transfer.collectionId.toLowerCase(),
    }];
  });
}

export function extractStakingPositions(input: {
  wallet: string;
  cutoff: string;
  balances: PipelineBalance[];
  historical: PipelineHistoricalBalance[];
  transactions: PipelineTransaction[];
  positions: PipelineDefiPosition[];
}) {
  const cutoff = Date.parse(input.cutoff);
  const start = cutoff - 90 * DAY;
  const stakingSymbols = new Set(['steth', 'wsteth']);
  const activeBalance = input.balances.some(
    (balance) => stakingSymbols.has(balance.symbol.toLowerCase()) && balance.amount > 0,
  );
  const activePosition = input.positions.some((position) => {
    const source = `${position.protocolId} ${position.positionTypes.join(' ')}`.toLowerCase();
    return position.totalValueUsd > 0 &&
      /\blido\b/.test(source);
  });
  const deposits = input.transactions.filter((transaction) => {
    const name = methodName(transaction.method);
    return transaction.protocol === 'Lido' &&
      transaction.successful === true &&
      addressIs(transaction.fromAddress, input.wallet) &&
      /^(submit|deposit|stake|wrap)$/.test(name);
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const stakingHistory = input.historical
    .filter((row) => stakingSymbols.has(row.symbol.toLowerCase()))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const lastZero = stakingHistory
    .filter((row) => row.amount <= 0)
    .map((row) => Date.parse(row.timestamp))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  const depositAfterZero = deposits.find(
    (transaction) => !lastZero || Date.parse(transaction.timestamp) > lastZero,
  );
  const boundary = stakingHistory.find(
    (row) => Date.parse(row.timestamp) <= start + 2 * DAY && row.amount > 0,
  );
  const continuousSince = boundary && (!lastZero || lastZero <= start)
    ? new Date(start).toISOString()
    : depositAfterZero?.timestamp ?? null;
  const verifiedDepositAt = deposits.at(-1)?.timestamp ?? null;
  if (!activeBalance && !activePosition && !verifiedDepositAt) return [];
  return [{
    serviceId: 'lido',
    active: activeBalance || activePosition,
    verifiedDepositAt,
    verifiedDepositHash: deposits.at(-1)?.hash ?? null,
    continuousSince,
  }];
}
