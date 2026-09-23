import {
  analysisIdFor,
  ANALYSIS_TTL_SECONDS,
  type AnalysisRecord,
} from './analysis';
import { classify } from './classification';
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
import { fetchVerifiedReceipts, type VerifiedReceipt } from './alchemy';

const API = 'https://api.nansen.ai/api/v1/profiler/address';
const DEFI_API = 'https://api.nansen.ai/api/v1/portfolio/defi-holdings';
const DEX_API = 'https://api.nansen.ai/api/v1/profiler/dex-trades';
const DAY = 86_400_000;
const PAGINATION = {
  transactions: { perPage: 100, maxPages: 50 },
  'current-balance': { perPage: 1000, maxPages: 10 },
  'historical-balances': { perPage: 1000, maxPages: 10 },
  counterparties: { perPage: 1000, maxPages: 10 },
} as const;
type Page<T> = { data: T[]; pagination?: { is_last_page?: boolean } };
type Balance = {
  token_address: string;
  token_symbol: string;
  token_name: string;
  token_amount: number | string;
  price_usd: number | string;
  value_usd: number | string;
};
type TokenInfo = {
  token_symbol: string;
  token_amount: number | string;
  value_usd: number | string;
  from_address: string;
  to_address: string;
  from_address_label?: string | string[];
  to_address_label?: string | string[];
};
type NansenTransaction = {
  transaction_hash: string;
  block_timestamp: string;
  method: string;
  source_type: string;
  volume_usd: number | string;
  tokens_sent: TokenInfo[];
  tokens_received: TokenInfo[];
};
type NansenHistoricalBalance = {
  block_timestamp: string;
  token_address: string;
  token_symbol: string;
  token_amount: number | string;
  value_usd: number | string;
};
type NansenCounterparty = {
  counterparty_address: string;
  counterparty_address_label?: string[];
  interaction_count: number | string;
  volume_in_usd: number | string;
  volume_out_usd: number | string;
};
type NansenPnlSummary = {
  traded_token_count: number | string;
  traded_times: number | string;
  realized_pnl_usd: number | string;
  realized_pnl_percent: number | string;
  win_rate: number | string;
};
type NansenDexTrade = {
  block_timestamp: string;
  transaction_hash: string;
  trader_address: string;
  token_bought_address: string;
  token_sold_address: string;
};
type NansenDefiHoldings = {
  protocols?: Array<{
    protocol_name: string;
    chain: string;
    total_value_usd: number | string;
    total_assets_usd: number | string;
    total_debts_usd: number | string;
    total_rewards_usd: number | string;
    tokens?: Array<{ position_type?: string }>;
  }>;
};

type Enrichment = {
  historicalBalances?: NansenHistoricalBalance[];
  counterparties?: NansenCounterparty[];
  pnlSummary?: NansenPnlSummary;
  defiHoldings?: NansenDefiHoldings;
  receipts?: VerifiedReceipt[];
};

function number(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

async function request<T>(
  key: string,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<Page<T>> {
  const response = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Nansen ${endpoint} request failed (${response.status}).`);
  }
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== 'object' ||
    !('data' in result) ||
    !Array.isArray(result.data)
  ) {
    throw new Error(`Nansen ${endpoint} returned an invalid response.`);
  }
  return result as Page<T>;
}

async function requestJson<T>(
  key: string,
  url: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Nansen enrichment request failed (${response.status}).`);
  return (await response.json()) as T;
}

async function allPages<T>(
  key: string,
  endpoint: keyof typeof PAGINATION,
  body: Record<string, unknown>,
) {
  const { perPage, maxPages } = PAGINATION[endpoint];
  const rows: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const response = await request<T>(key, endpoint, {
      ...body,
      pagination: { page, per_page: perPage },
    });
    rows.push(...response.data);
    if (
      response.pagination?.is_last_page === true ||
      (response.pagination?.is_last_page === undefined && response.data.length < perPage)
    )
      return rows;
  }
  throw new Error(
    `Nansen ${endpoint} exceeded the ${maxPages * perPage}-record retrieval limit; analysis was not saved.`,
  );
}

async function allDexPages(
  key: string,
  body: Record<string, unknown>,
): Promise<NansenDexTrade[]> {
  const rows: NansenDexTrade[] = [];
  const perPage = 1000;
  const maxPages = 5;
  for (let page = 1; page <= maxPages; page++) {
    const response = await requestJson<Page<NansenDexTrade>>(key, DEX_API, {
      ...body,
      pagination: { page, per_page: perPage },
    });
    rows.push(...response.data);
    if (
      response.pagination?.is_last_page === true ||
      (response.pagination?.is_last_page === undefined &&
        response.data.length < perPage)
    )
      return rows;
  }
  throw new Error(
    `Nansen dex-trades exceeded the ${maxPages * perPage}-record retrieval limit; DEX evidence was withheld.`,
  );
}

async function optional<T>(name: string, task: Promise<T>): Promise<T | undefined> {
  try {
    return await task;
  } catch (error) {
    console.warn(
      `Nansen ${name} enrichment unavailable:`,
      error instanceof Error ? error.message : 'unknown error',
    );
    return undefined;
  }
}

const PROTOCOL_CONTRACTS = new Map<string, string>([
  ['0x7a250d5630b4cf539739df2c5dacb4c659f2488d', 'Uniswap'],
  ['0xe592427a0aece92de3edee1f18e0157c05861564', 'Uniswap'],
  ['0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', 'Uniswap'],
  ['0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', 'Uniswap'],
  ['0x66a9893cc07d91d95644aedd05d03f95e1dba8af', 'Uniswap'],
  ['0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2', 'Aave'],
  ['0x7d2768de32b0b80b7a3454c06bdac7a9a6dc7a9', 'Aave'],
  ['0xae7ab96520de3a18e5e111b5eaab095312d7fe84', 'Lido'],
  ['0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0', 'Lido'],
  ['0x00000000000000adc04c56bf30ac9d3c0aaf14dc', 'OpenSea'],
  ['0x0000000000000068f116a894984e2db1123eb395', 'OpenSea'],
  ['0x000000000000ad05ccc4f10045630fb830b95127', 'Blur'],
]);

function labels(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join(' ') : value ?? '';
}

function namedProtocol(value: string) {
  const source = value.toLowerCase();
  if (source.includes('uniswap')) return 'Uniswap';
  if (source.includes('aave')) return 'Aave';
  if (source.includes('lido')) return 'Lido';
  if (source.includes('opensea') || source.includes('seaport')) return 'OpenSea';
  if (source.includes('blur')) return 'Blur';
  return null;
}

function protocolFor(row: NansenTransaction, receipt?: VerifiedReceipt) {
  const source = [
    row.source_type,
    row.method,
    ...(row.tokens_sent ?? []).flatMap((token) => [labels(token.from_address_label), labels(token.to_address_label)]),
    ...(row.tokens_received ?? []).flatMap((token) => [labels(token.from_address_label), labels(token.to_address_label)]),
  ].join(' ');
  const named = namedProtocol(source);
  if (named) return named;
  const contract = receipt?.toAddress
    ? PROTOCOL_CONTRACTS.get(receipt.toAddress.toLowerCase())
    : undefined;
  if (contract) return contract;
  return row.source_type?.toLowerCase() === 'transfer' ? 'No protocol' : 'Unknown';
}

export function normalizeNansen(
  address: string,
  days: number,
  asOf: string,
  balances: Balance[],
  rows: NansenTransaction[],
  enrichment: Enrichment = {},
): WalletData {
  const normalized = address.toLowerCase();
  const end = Date.parse(asOf);
  const start = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`) - (days - 1) * DAY;
  const uniqueRows = [
    ...new Map(
      rows.map((row) => [row.transaction_hash.toLowerCase(), row]),
    ).values(),
  ];
  const receiptByHash = new Map(
    (enrichment.receipts ?? []).map((receipt) => [receipt.hash, receipt]),
  );
  const transactions: Transaction[] = uniqueRows
    .map((row) => {
      const receipt = receiptByHash.get(row.transaction_hash.toLowerCase());
      const protocol = protocolFor(row, receipt);
      const movements: Movement[] = [
        ...(row.tokens_sent ?? []).map((token, i) => ({
          token,
          direction: 'out' as const,
          i,
        })),
        ...(row.tokens_received ?? []).map((token, i) => ({
          token,
          direction: 'in' as const,
          i,
        })),
      ].map(({ token, direction, i }) => {
        const from = token.from_address ?? '';
        const to = token.to_address ?? '';
        const counterparty = direction === 'in' ? from : to;
        return {
          id: `${row.transaction_hash}:${direction}:${i}`,
          hash: row.transaction_hash,
          timestamp: row.block_timestamp,
          token: token.token_symbol || 'Unknown',
          amount: number(token.token_amount),
          usd: number(token.value_usd),
          direction,
          from,
          to,
          protocol,
          counterparty,
        };
      });
      return {
        hash: row.transaction_hash,
        timestamp: row.block_timestamp,
        type: row.method || row.source_type || 'Transaction',
        protocol,
        movements,
        value: number(row.volume_usd),
        ...(receipt
          ? {
              fromAddress: receipt.fromAddress,
              toAddress: receipt.toAddress,
              successful: receipt.successful,
            }
          : {}),
      };
    })
    .filter(
      (row) =>
        Number.isFinite(Date.parse(row.timestamp)) &&
        Date.parse(row.timestamp) >= start &&
        Date.parse(row.timestamp) < end,
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const movements = transactions.flatMap((row) => row.movements);
  const daily = Array.from(
    { length: days },
    (_, i) =>
      transactions.filter(
        (row) =>
          row.timestamp.slice(0, 10) ===
          new Date(start + i * DAY).toISOString().slice(0, 10),
      ).length,
  );
  const colors = [
    '#9c83ee',
    '#8063cf',
    '#ada5bc',
    '#655080',
    '#b6a3e6',
    '#8e91ba',
  ];
  const holdings = balances
    .map((item, i) => ({
      tokenAddress: item.token_address,
      symbol: item.token_symbol || 'Unknown',
      name: item.token_name || item.token_symbol || 'Unknown token',
      price: number(item.price_usd),
      color: colors[i % colors.length],
      balance: number(item.token_amount),
      value: number(item.value_usd),
    }))
    .sort((a, b) => b.value - a.value);
  const protocolTransactionCount = transactions.filter(
    (row) => row.successful !== false,
  ).length;
  const protocols = protocolDefinitions.map((item) => {
    const count = transactions.filter(
      (row) => row.protocol === item.name && row.successful !== false,
    ).length;
    return {
      ...item,
      count,
      share: protocolTransactionCount ? (count / protocolTransactionCount) * 100 : 0,
    };
  });
  const incoming = movements
    .filter((item) => item.direction === 'in')
    .reduce((sum, item) => sum + item.usd, 0);
  const outgoing = movements
    .filter((item) => item.direction === 'out')
    .reduce((sum, item) => sum + item.usd, 0);
  const flowTotals = new Map<string, { name: string; incoming: number; outgoing: number }>();
  for (const movement of movements) {
    if (!movement.counterparty) continue;
    const flow = flowTotals.get(movement.counterparty) ?? {
      name: movement.counterparty,
      incoming: 0,
      outgoing: 0,
    };
    if (movement.direction === 'in') flow.incoming += movement.usd;
    else flow.outgoing += movement.usd;
    flowTotals.set(movement.counterparty, flow);
  }
  const transactionFlows = [...flowTotals.values()].map((flow) => ({
    ...flow,
    source: 'transactions' as const,
  })).sort(
    (a, b) => b.incoming + b.outgoing - a.incoming - a.outgoing,
  );
  const dedicatedFlows = enrichment.counterparties?.map((row) => ({
    name: row.counterparty_address,
    label: row.counterparty_address_label?.filter(Boolean).join(', ') || undefined,
    interactionCount: number(row.interaction_count),
    incoming: number(row.volume_in_usd),
    outgoing: number(row.volume_out_usd),
    source: 'nansen-counterparties' as const,
  })).sort((a, b) => b.incoming + b.outgoing - a.incoming - a.outgoing);
  const flows = dedicatedFlows ?? transactionFlows;
  const historicalBalances = (enrichment.historicalBalances ?? []).map((row) => ({
    timestamp: row.block_timestamp,
    tokenAddress: row.token_address,
    symbol: row.token_symbol || 'Unknown',
    amount: number(row.token_amount),
    value: number(row.value_usd),
  })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const tradePerformance = enrichment.pnlSummary ? {
    tradedTokenCount: number(enrichment.pnlSummary.traded_token_count),
    tradedTimes: number(enrichment.pnlSummary.traded_times),
    realizedPnlUsd: number(enrichment.pnlSummary.realized_pnl_usd),
    realizedPnlPercent: number(enrichment.pnlSummary.realized_pnl_percent),
    winRate: number(enrichment.pnlSummary.win_rate),
  } : null;
  const defiPositions = (enrichment.defiHoldings?.protocols ?? [])
    .filter((item) => item.chain.toLowerCase() === 'ethereum')
    .map((item) => ({
      protocol: item.protocol_name,
      chain: item.chain,
      totalValue: number(item.total_value_usd),
      totalAssets: number(item.total_assets_usd),
      totalDebts: number(item.total_debts_usd),
      totalRewards: number(item.total_rewards_usd),
      positionTypes: [...new Set((item.tokens ?? []).map((token) => token.position_type).filter((value): value is string => Boolean(value)))],
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
  const oldest = transactions.at(-1)?.timestamp ?? null;
  const newest = transactions[0]?.timestamp ?? null;
  return {
    transactions,
    movements,
    daily,
    holdings,
    protocols,
    incoming,
    outgoing,
    flows,
    historicalBalances,
    tradePerformance,
    defiPositions,
    enrichmentCoverage: {
      historicalBalances: enrichment.historicalBalances !== undefined,
      counterparties: enrichment.counterparties !== undefined,
      tradePerformance: enrichment.pnlSummary !== undefined,
      defiPositions: enrichment.defiHoldings !== undefined,
    },
    totalBalance: holdings.reduce((sum, item) => sum + item.value, 0),
    volume: incoming + outgoing,
    counterparties: flows.length,
    firstActivity: oldest,
    lastActivity: newest,
    walletAgeDays: oldest ? Math.floor((end - Date.parse(oldest)) / DAY) : 0,
    daysSinceLastActivity: newest
      ? Math.floor((end - Date.parse(newest)) / DAY)
      : null,
    asOf,
    start: new Date(start).toISOString(),
    address: normalized,
    days,
  };
}

export async function createNansenAnalysis(
  address: string,
  periodDays: number,
  key: string,
  ethereumRpcUrl?: string,
): Promise<AnalysisRecord> {
  const normalized = address.toLowerCase();
  const asOf = new Date().toISOString();
  const from = new Date(
    Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`) - (periodDays - 1) * DAY,
  )
    .toISOString()
    .slice(0, 10);
  const to = asOf.slice(0, 10);
  const dexFrom = new Date(
    Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`) - 29 * DAY,
  )
    .toISOString()
    .slice(0, 10);
  const [balances, transactions] = await Promise.all([
    allPages<Balance>(key, 'current-balance', {
      address: normalized,
      chain: 'ethereum',
      hide_spam_token: true,
    }),
    allPages<NansenTransaction>(key, 'transactions', {
      address: normalized,
      chain: 'ethereum',
      date: { from, to },
      hide_spam_token: true,
    }),
  ]);
  const [historicalBalances, counterparties, pnlSummary, defiHoldings, dexTrades, receipts] =
    await Promise.all([
      optional(
        'historical balances',
        allPages<NansenHistoricalBalance>(key, 'historical-balances', {
          address: normalized,
          chain: 'ethereum',
          date: { from, to },
          filters: { hide_spam_tokens: true },
        }),
      ),
      optional(
        'counterparties',
        allPages<NansenCounterparty>(key, 'counterparties', {
          address: normalized,
          chain: 'ethereum',
          date: { from, to },
          group_by: 'wallet',
          source_input: 'Combined',
          order_by: [{ field: 'total_volume_usd', direction: 'DESC' }],
        }),
      ),
      optional(
        'PnL summary',
        requestJson<NansenPnlSummary>(key, `${API}/pnl-summary`, {
          address: normalized,
          chain: 'ethereum',
          date: { from, to },
        }),
      ),
      optional(
        'DeFi holdings',
        requestJson<NansenDefiHoldings>(key, DEFI_API, {
          wallet_address: normalized,
        }),
      ),
      optional(
        'DEX trades',
        allDexPages(key, {
          address: normalized,
          chain: 'ethereum',
          date: { from: dexFrom, to },
          order_by: [{ field: 'block_timestamp', direction: 'DESC' }],
        }),
      ),
      ethereumRpcUrl
        ? optional(
            'Ethereum receipt',
            fetchVerifiedReceipts(
              ethereumRpcUrl,
              transactions.map((row) => row.transaction_hash),
            ),
          )
        : Promise.resolve(undefined),
    ]);
  const data = normalizeNansen(
    normalized,
    periodDays,
    asOf,
    balances,
    transactions,
    { historicalBalances, counterparties, pnlSummary, defiHoldings, receipts },
  );
  // These endpoints do not verify transaction initiator/status, NFT trade
  // roles, continuous balances, staking deposit history, or lifetime history.
  // Keep classifier inputs unknown until a verified source supplies them.
  const uniqueTransactionCount = new Set(
    transactions.map((row) => row.transaction_hash.toLowerCase()),
  ).size;
  const receiptCoverage =
    receipts !== undefined && receipts.length === uniqueTransactionCount;
  const timestampByHash = new Map(
    transactions.map((row) => [row.transaction_hash.toLowerCase(), row.block_timestamp]),
  );
  const receiptByHash = new Map(
    (receipts ?? []).map((receipt) => [receipt.hash.toLowerCase(), receipt]),
  );
  const dexByHash = new Map<
    string,
    { hash: string; timestamp: string; traderAddress: string; tokenIds: Set<string> }
  >();
  for (const trade of dexTrades ?? []) {
    const hash = trade.transaction_hash.toLowerCase();
    const existing = dexByHash.get(hash) ?? {
      hash,
      timestamp: trade.block_timestamp,
      traderAddress: trade.trader_address.toLowerCase(),
      tokenIds: new Set<string>(),
    };
    if (trade.token_bought_address)
      existing.tokenIds.add(`ethereum:${trade.token_bought_address.toLowerCase()}`);
    if (trade.token_sold_address)
      existing.tokenIds.add(`ethereum:${trade.token_sold_address.toLowerCase()}`);
    dexByHash.set(hash, existing);
  }
  const verifiedDexTrades = [...dexByHash.values()].map((trade) => ({
    hash: trade.hash,
    timestamp: trade.timestamp,
    traderAddress: trade.traderAddress,
    successful: receiptByHash.get(trade.hash)?.successful ?? false,
    tokenIds: [...trade.tokenIds],
  }));
  const dexReceiptCoverage =
    dexTrades !== undefined &&
    [...dexByHash.keys()].every((hash) => receiptByHash.has(hash));
  const profiles = classify(
    buildClassificationEvidence({
      address: normalized,
      cutoff: asOf,
      coverage: {
        transactions30d: receiptCoverage && periodDays >= 30,
        transactions90d: receiptCoverage && periodDays >= 90,
        lifetimeTransactions: false,
        dexTrades30d:
          periodDays >= 30 && receiptCoverage && dexReceiptCoverage,
        defiActions30d: false,
        nftTrades30d: false,
        holdingHistory90d: false,
        stakingPositionsAndDeposits: false,
      },
      transactions: (receipts ?? []).map((receipt) => ({
        hash: receipt.hash,
        timestamp: timestampByHash.get(receipt.hash) ?? asOf,
        fromAddress: receipt.fromAddress,
        successful: receipt.successful,
      })),
      dexTrades: verifiedDexTrades,
      defiActions: [],
      nftTrades: [],
      holdings: [],
      stakingPositions: [],
    }),
  );
  return {
    analysisId: analysisIdFor(normalized, periodDays),
    address: normalized,
    network: 'ethereum-mainnet',
    periodDays,
    status: 'complete',
    source: 'nansen',
    generatedAt: new Date().toISOString(),
    analysisCutoff: asOf,
    providerDataCutoff: null,
    expiresAt: new Date(Date.now() + ANALYSIS_TTL_SECONDS * 1000).toISOString(),
    ruleVersion: CLASSIFICATION_RULE_VERSION,
    mappingVersion: MAPPING_VERSION,
    data,
    profiles,
    primaryProfile:
      profiles
        .filter((item) => item.assigned)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.name ??
      (profiles.some((item) => item.status === 'NOT_ASSESSED')
        ? 'Not enough data to classify'
        : 'No profile matched'),
  };
}
