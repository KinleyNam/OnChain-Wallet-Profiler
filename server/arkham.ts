import {
  analysisIdFor,
  ANALYSIS_TTL_SECONDS,
  type AnalysisRecord,
} from './analysis';
import { classify, type ProfileResult } from './classification';
import { buildClassificationEvidence } from './classification-evidence';
import {
  CLASSIFICATION_RULE_VERSION,
  MAPPING_VERSION,
} from './classification-rules';
import {
  protocolDefinitions,
  type Movement,
  type Transaction,
  type WalletData,
} from '../lib/wallet-data';

const DAY = 86_400_000;
const PAGE_SIZE = 1_000;
const MAX_ROWS = 10_000;

type AddressInfo = {
  address?: string;
  arkhamLabel?: { name?: string };
  predictedEntity?: { name?: string };
  arkhamEntity?: { name?: string };
};
type ArkhamBalance = {
  id?: string;
  name?: string;
  symbol?: string;
  balance?: number;
  usd?: number;
  price?: number;
};
type ArkhamCounterparty = {
  address?: AddressInfo;
  usd?: number;
  transactionCount?: number;
  flow?: string;
};
type ArkhamTransfer = {
  id?: string;
  transactionHash?: string;
  fromAddress?: AddressInfo;
  toAddress?: AddressInfo;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  unitValue?: number;
  historicalUSD?: number;
  blockTimestamp?: string;
  chain?: string;
};
type ArkhamSwap = {
  id?: string;
  blockTimestamp?: string;
  sender?: AddressInfo;
  receiver?: AddressInfo;
  token0?: string;
  token0Id?: string;
  token1?: string;
  token1Id?: string;
  valid?: boolean;
};
type ArkhamLoan = {
  protocol?: string;
  platform?: string;
  name?: string;
  usd?: number;
  value?: number;
  supplied?: number;
  borrowed?: number;
  rewards?: number;
  positionType?: string;
};

export type ArkhamSnapshot = {
  balances?: ArkhamBalance[];
  counterparties?: ArkhamCounterparty[];
  transfers?: ArkhamTransfer[];
  transfersComplete: boolean;
  swaps?: ArkhamSwap[];
  swapsComplete: boolean;
  loans?: ArkhamLoan[];
};

const finite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const addressIs = (left: string | undefined, right: string) =>
  left?.toLowerCase() === right.toLowerCase();
const labelFor = (address: AddressInfo | undefined) =>
  address?.arkhamLabel?.name || address?.predictedEntity?.name ||
  address?.arkhamEntity?.name;

function protocolFor(address: AddressInfo | undefined) {
  const label = labelFor(address)?.toLowerCase() ?? '';
  if (label.includes('uniswap')) return 'Uniswap';
  if (label.includes('aave')) return 'Aave';
  if (label.includes('lido')) return 'Lido';
  if (label.includes('opensea') || label.includes('seaport')) return 'OpenSea';
  if (label.includes('blur')) return 'Blur';
  return address?.address ? 'Unknown' : 'No protocol';
}

function transactionHash(id: string | undefined) {
  const match = id?.match(/^0x[a-fA-F0-9]{64}/);
  return match?.[0].toLowerCase() ?? null;
}

async function getJson<T>(
  key: string,
  baseUrl: string,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(path, `${baseUrl.replace(/\/$/, '')}/`);
  for (const [name, value] of Object.entries(params))
    url.searchParams.set(name, value);
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'API-Key': key, Accept: 'application/json' },
        signal: AbortSignal.timeout(25_000),
      });
      if (response.ok) return (await response.json()) as T;
      const error = new Error(`Arkham request failed (${response.status}).`);
      if (response.status !== 429 && response.status < 500) throw error;
      lastError = error;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Arkham request failed.');
    }
    if (attempt < 2)
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError ?? new Error('Arkham request failed.');
}

async function optional<T>(name: string, task: Promise<T>) {
  try {
    return await task;
  } catch (error) {
    console.warn(
      `Arkham ${name} unavailable:`,
      error instanceof Error ? error.message : 'unknown error',
    );
    return undefined;
  }
}

async function paged<T>(
  key: string,
  baseUrl: string,
  kind: 'transfers' | 'swaps',
  address: string,
  from: string,
  to: string,
) {
  const rows: T[] = [];
  let total: number | undefined;
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const result = await getJson<Record<string, unknown>>(key, baseUrl, kind, {
      base: address,
      chains: 'ethereum',
      timeGte: from,
      timeLte: to,
      limit: String(PAGE_SIZE),
      offset: String(offset),
      sortKey: 'time',
      sortDir: 'desc',
    });
    const page = Array.isArray(result[kind]) ? result[kind] as T[] : [];
    const count = Number(result.count);
    if (Number.isFinite(count)) total = count;
    rows.push(...page);
    if (page.length < PAGE_SIZE || (total !== undefined && rows.length >= total))
      return { rows, complete: total === undefined || rows.length >= total };
  }
  return { rows, complete: total !== undefined && rows.length >= total };
}

export async function fetchArkhamSnapshot(
  address: string,
  periodDays: number,
  key: string,
  baseUrl = 'https://api.arkm.com',
): Promise<ArkhamSnapshot> {
  const normalized = address.toLowerCase();
  const to = new Date().toISOString();
  const from = new Date(Date.parse(to) - periodDays * DAY).toISOString();
  const [balances, counterparties, transfers, swaps, loans] = await Promise.all([
    optional('balances', getJson<{ balances?: { ethereum?: ArkhamBalance[] } }>(
      key, baseUrl, `balances/address/${normalized}`, { chains: 'ethereum' },
    )),
    optional('counterparties', getJson<{ ethereum?: ArkhamCounterparty[] }>(
      key, baseUrl, `counterparties/address/${normalized}`, { chains: 'ethereum' },
    )),
    optional('transfers', paged<ArkhamTransfer>(key, baseUrl, 'transfers', normalized, from, to)),
    optional('swaps', paged<ArkhamSwap>(key, baseUrl, 'swaps', normalized,
      new Date(Date.parse(to) - 30 * DAY).toISOString(), to)),
    optional('loan positions', getJson<{ balances?: { ethereum?: ArkhamLoan[] } }>(
      key, baseUrl, `loans/address/${normalized}`, { chains: 'ethereum' },
    )),
  ]);
  if (!balances && !counterparties && !transfers && !swaps && !loans)
    throw new Error('Arkham returned no usable datasets.');
  return {
    balances: balances?.balances?.ethereum,
    counterparties: counterparties?.ethereum,
    transfers: transfers?.rows,
    transfersComplete: transfers?.complete ?? false,
    swaps: swaps?.rows,
    swapsComplete: swaps?.complete ?? false,
    loans: loans?.balances?.ethereum,
  };
}

function arkhamTransactions(
  address: string,
  rows: ArkhamTransfer[],
): Transaction[] {
  const normalized = address.toLowerCase();
  const grouped = new Map<string, Transaction>();
  for (const row of rows) {
    if (!row.transactionHash || !row.blockTimestamp) continue;
    const hash = row.transactionHash.toLowerCase();
    const from = row.fromAddress?.address?.toLowerCase() ?? '';
    const to = row.toAddress?.address?.toLowerCase() ?? '';
    const direction = addressIs(to, normalized) ? 'in' as const : 'out' as const;
    if (!addressIs(from, normalized) && !addressIs(to, normalized)) continue;
    const counterpartyInfo = direction === 'in' ? row.fromAddress : row.toAddress;
    const protocol = protocolFor(counterpartyInfo);
    const movement: Movement = {
      id: row.id || `${hash}:${row.tokenAddress ?? row.tokenSymbol ?? 'token'}`,
      hash,
      timestamp: row.blockTimestamp,
      token: row.tokenSymbol || 'Unknown',
      amount: finite(row.unitValue),
      usd: finite(row.historicalUSD),
      direction,
      from,
      to,
      protocol,
      counterparty: counterpartyInfo?.address?.toLowerCase() ?? '',
    };
    const transaction = grouped.get(hash) ?? {
      hash,
      timestamp: row.blockTimestamp,
      type: 'Token transfer',
      protocol,
      movements: [],
      value: 0,
      fromAddress: from,
      toAddress: to || null,
      successful: true,
    };
    transaction.movements.push(movement);
    transaction.value += movement.usd;
    if (transaction.protocol === 'Unknown' && protocol !== 'Unknown')
      transaction.protocol = protocol;
    grouped.set(hash, transaction);
  }
  return [...grouped.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function activeTraderProfile(
  record: AnalysisRecord,
  snapshot: ArkhamSnapshot,
): ProfileResult | undefined {
  if (!snapshot.swaps || !snapshot.swapsComplete) return undefined;
  const transactionCoverage = record.data.verifiedTransactionCoverage === true;
  if (!transactionCoverage) return undefined;
  const swaps = snapshot.swaps.flatMap((swap) => {
    const hash = transactionHash(swap.id);
    if (!hash || swap.valid === false || !addressIs(swap.sender?.address, record.address))
      return [];
    return [{
      hash,
      timestamp: swap.blockTimestamp ?? '',
      traderAddress: record.address,
      successful: true,
      tokenIds: [swap.token0Id || swap.token0, swap.token1Id || swap.token1]
        .filter((value): value is string => Boolean(value)),
    }];
  });
  return classify(buildClassificationEvidence({
    address: record.address,
    cutoff: record.analysisCutoff,
    coverage: {
      transactions30d: record.periodDays >= 30,
      transactions90d: false,
      lifetimeTransactions: false,
      dexTrades30d: true,
      defiActions30d: false,
      nftTrades30d: false,
      holdingHistory90d: false,
      stakingPositionsAndDeposits: false,
    },
    transactions: record.data.transactions.flatMap((row) =>
      row.fromAddress !== undefined && row.successful !== undefined
        ? [{ hash: row.hash, timestamp: row.timestamp,
            fromAddress: row.fromAddress, successful: row.successful }]
        : []),
    dexTrades: swaps,
    defiActions: [],
    nftTrades: [],
    holdings: [],
    stakingPositions: [],
  })).find((profile) => profile.name === 'Active trader');
}

export function enrichWithArkham(
  record: AnalysisRecord,
  snapshot: ArkhamSnapshot,
): AnalysisRecord {
  if (snapshot.balances) {
    record.data.holdings = snapshot.balances.map((balance, index) => ({
      tokenAddress: balance.id || balance.symbol || `arkham-${index}`,
      symbol: balance.symbol || 'Unknown',
      name: balance.name || balance.symbol || 'Unknown token',
      price: finite(balance.price),
      color: ['#9c83ee', '#8063cf', '#ada5bc', '#655080'][index % 4],
      balance: finite(balance.balance),
      value: finite(balance.usd),
    })).sort((a, b) => b.value - a.value);
    record.data.totalBalance = record.data.holdings.reduce((sum, item) => sum + item.value, 0);
  }
  if (snapshot.transfers && snapshot.transfersComplete) {
    const movements = arkhamTransactions(record.address, snapshot.transfers)
      .flatMap((transaction) => transaction.movements);
    const labels = new Map(
      (snapshot.counterparties ?? []).flatMap((item) => {
        const address = item.address?.address?.toLowerCase();
        return address ? [[address, labelFor(item.address)] as const] : [];
      }),
    );
    const flows = new Map<string, {
      name: string;
      label?: string;
      interactionCount: number;
      incoming: number;
      outgoing: number;
      source: 'arkham-counterparties';
    }>();
    for (const movement of movements) {
      if (!movement.counterparty) continue;
      const name = movement.counterparty.toLowerCase();
      const flow = flows.get(name) ?? {
        name,
        label: labels.get(name),
        interactionCount: 0,
        incoming: 0,
        outgoing: 0,
        source: 'arkham-counterparties' as const,
      };
      flow.interactionCount++;
      flow[movement.direction === 'in' ? 'incoming' : 'outgoing'] += movement.usd;
      flows.set(name, flow);
    }
    record.data.movements = movements;
    record.data.incoming = movements
      .filter((movement) => movement.direction === 'in')
      .reduce((sum, movement) => sum + movement.usd, 0);
    record.data.outgoing = movements
      .filter((movement) => movement.direction === 'out')
      .reduce((sum, movement) => sum + movement.usd, 0);
    record.data.volume = record.data.incoming + record.data.outgoing;
    record.data.flows = [...flows.values()].sort(
      (left, right) =>
        right.incoming + right.outgoing - left.incoming - left.outgoing,
    );
    record.data.counterparties = record.data.flows.length;
    record.data.enrichmentCoverage.counterparties = true;
  }
  if (snapshot.loans) {
    record.data.defiPositions = snapshot.loans.map((loan) => ({
      protocol: loan.protocol || loan.platform || loan.name || 'Unknown protocol',
      chain: 'ethereum',
      totalValue: finite(loan.usd ?? loan.value),
      totalAssets: finite(loan.supplied ?? loan.usd ?? loan.value),
      totalDebts: finite(loan.borrowed),
      totalRewards: finite(loan.rewards),
      positionTypes: loan.positionType ? [loan.positionType] : ['lending'],
    }));
    record.data.enrichmentCoverage.defiPositions = true;
  }
  const active = activeTraderProfile(record, snapshot);
  if (active) {
    const index = record.profiles.findIndex((profile) => profile.name === active.name);
    const current = record.profiles[index];
    if (
      index >= 0 &&
      (current.status === 'NOT_ASSESSED' ||
        active.assigned ||
        (active.score ?? -1) > (current.score ?? -1))
    )
      record.profiles[index] = active;
  }
  record.sources = [...new Set([...(record.sources ?? [record.source]), 'arkham' as const])];
  record.primaryProfile = record.profiles.filter((item) => item.assigned)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.name ??
    (record.profiles.some((item) => item.status === 'NOT_ASSESSED')
      ? 'Not enough data to classify' : 'No profile matched');
  return record;
}

export function createArkhamAnalysis(
  address: string,
  periodDays: number,
  snapshot: ArkhamSnapshot,
): AnalysisRecord {
  const normalized = address.toLowerCase();
  const asOf = new Date().toISOString();
  const transactions = arkhamTransactions(normalized, snapshot.transfers ?? []);
  const movements = transactions.flatMap((row) => row.movements);
  const start = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`) - (periodDays - 1) * DAY;
  const data: WalletData = {
    transactionCoverage: { complete: snapshot.transfersComplete, limit: MAX_ROWS, fetched: transactions.length },
    verifiedTransactionCoverage: false,
    transactions,
    movements,
    daily: Array.from({ length: periodDays }, (_, index) => {
      const date = new Date(start + index * DAY).toISOString().slice(0, 10);
      return transactions.filter((row) => row.timestamp.slice(0, 10) === date).length;
    }),
    holdings: [], protocols: protocolDefinitions.map((item) => {
      const count = transactions.filter((row) => row.protocol === item.name).length;
      return { ...item, count, share: transactions.length ? count / transactions.length * 100 : 0 };
    }),
    incoming: movements.filter((row) => row.direction === 'in').reduce((sum, row) => sum + row.usd, 0),
    outgoing: movements.filter((row) => row.direction === 'out').reduce((sum, row) => sum + row.usd, 0),
    flows: [], historicalBalances: [], tradePerformance: null, defiPositions: [],
    enrichmentCoverage: { historicalBalances: false, counterparties: false, tradePerformance: false, defiPositions: false },
    totalBalance: 0, volume: movements.reduce((sum, row) => sum + row.usd, 0), counterparties: 0,
    firstActivity: transactions.at(-1)?.timestamp ?? null,
    lastActivity: transactions[0]?.timestamp ?? null,
    walletAgeDays: 0,
    daysSinceLastActivity: transactions[0] ? Math.floor((Date.parse(asOf) - Date.parse(transactions[0].timestamp)) / DAY) : null,
    asOf, start: new Date(start).toISOString(), address: normalized, days: periodDays,
  };
  const profiles = classify({ cutoff: asOf });
  const record: AnalysisRecord = {
    analysisId: analysisIdFor(normalized, periodDays), address: normalized,
    network: 'ethereum-mainnet', periodDays, status: 'complete', source: 'arkham',
    sources: ['arkham'], generatedAt: asOf, analysisCutoff: asOf,
    providerDataCutoff: null,
    expiresAt: new Date(Date.now() + ANALYSIS_TTL_SECONDS * 1000).toISOString(),
    ruleVersion: CLASSIFICATION_RULE_VERSION, mappingVersion: MAPPING_VERSION,
    data, profiles, primaryProfile: 'Not enough data to classify',
  };
  return enrichWithArkham(record, snapshot);
}
