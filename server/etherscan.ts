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
import {
  extractDefiActions,
  extractNftTrades,
  type PipelineNftTransfer,
  type PipelineTransaction,
} from './profile-pipelines';

const API = 'https://api.etherscan.io/v2/api';
const DAY = 86_400_000;
// Etherscan's free tier returns at most 1,000 rows, even when a larger
// offset is requested. A larger offset made the first page look complete.
const PAGE_SIZE = 1_000;
const MAX_PAGES = 10;
const REQUEST_TIMEOUT_MS = 60_000;
const TRANSIENT_ATTEMPTS = 2;

type EtherscanResponse<T> = {
  status: string;
  message: string;
  result: T[] | string;
};

type NormalTransaction = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  input?: string;
  methodId?: string;
  functionName?: string;
  isError?: string;
  txreceipt_status?: string;
};

type TokenTransfer = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
};

type NftTransfer = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  contractAddress: string;
  tokenID?: string;
  tokenValue?: string;
};

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
  ['0xb2ecfe4e4d61f8790bbb9de2d1259b9e2410cea5', 'Blur'],
  ['0x0000000000000000000000000000000000000000', 'No protocol'],
]);

function timestamp(seconds: string) {
  const value = Number(seconds);
  return Number.isFinite(value) ? new Date(value * 1000).toISOString() : '';
}

function amount(value: string, decimals: string | number) {
  const raw = Number(value);
  const scale = 10 ** Number(decimals);
  return Number.isFinite(raw) && Number.isFinite(scale) && scale > 0
    ? raw / scale
    : 0;
}

function protocolFor(to: string) {
  return PROTOCOL_CONTRACTS.get(to.toLowerCase()) ??
    (to ? 'Unknown' : 'No protocol');
}

async function query<T>(key: string, action: string, params: Record<string, string>) {
  const url = new URL(API);
  for (const [name, value] of Object.entries({
    chainid: '1',
    module: 'account',
    action,
    ...params,
    apikey: key,
  })) url.searchParams.set(name, value);
  let response: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < TRANSIENT_ATTEMPTS; attempt++) {
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      break;
    } catch (error) {
      lastError = error;
      const transient = error instanceof Error &&
        /abort|timeout|network|fetch failed|socket|connection/i.test(
          `${error.name} ${error.message}`,
        );
      if (!transient || attempt + 1 === TRANSIENT_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  if (!response) throw lastError;
  if (!response.ok)
    throw new Error(`Etherscan ${action} request failed (${response.status}).`);
  const body = (await response.json()) as EtherscanResponse<T>;
  if (body.status === '0') {
    const detail = typeof body.result === 'string' ? body.result : body.message;
    if (/no transactions found/i.test(detail)) return [];
    throw new Error(`Etherscan ${action} request failed: ${detail || body.message}.`);
  }
  if (!Array.isArray(body.result))
    throw new Error(`Etherscan ${action} returned an invalid response.`);
  return body.result;
}

async function allPages<T extends { hash: string; timeStamp: string }>(
  key: string,
  action: string,
  address: string,
) {
  const rows: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const current = await query<T>(key, action, {
      address,
      startblock: '0',
      endblock: '99999999',
      page: String(page),
      offset: String(PAGE_SIZE),
      sort: 'desc',
    });
    rows.push(...current);
    if (current.length < PAGE_SIZE) return { rows, complete: true };
  }
  return { rows, complete: false };
}

function coversWindow(
  result: { rows: Array<{ timeStamp: string }>; complete: boolean } | undefined,
  cutoff: string,
  days: number,
) {
  if (!result) return false;
  if (result.complete) return true;
  const oldest = result.rows.at(-1);
  const time = oldest ? Date.parse(timestamp(oldest.timeStamp)) : NaN;
  return Number.isFinite(time) && time < Date.parse(cutoff) - days * DAY;
}

async function optional<T>(name: string, task: Promise<T>) {
  try {
    return await task;
  } catch (error) {
    console.warn(
      `Etherscan ${name} unavailable:`,
      error instanceof Error ? error.message : 'unknown error',
    );
    return undefined;
  }
}

function buildWalletData(
  address: string,
  periodDays: number,
  asOf: string,
  normalRows: NormalTransaction[],
  tokenRows: TokenTransfer[],
): WalletData {
  const wallet = address.toLowerCase();
  const end = Date.parse(asOf);
  const start = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`) - (periodDays - 1) * DAY;
  const tokenByHash = new Map<string, Movement[]>();
  for (const row of tokenRows) {
    const time = timestamp(row.timeStamp);
    if (!time || Date.parse(time) < start || Date.parse(time) >= end) continue;
    const from = row.from.toLowerCase();
    const to = row.to.toLowerCase();
    if (from !== wallet && to !== wallet) continue;
    const direction = to === wallet ? 'in' as const : 'out' as const;
    const movement: Movement = {
      id: `${row.hash.toLowerCase()}:${row.contractAddress.toLowerCase()}:${(tokenByHash.get(row.hash.toLowerCase()) ?? []).length}`,
      hash: row.hash.toLowerCase(),
      timestamp: time,
      token: row.tokenSymbol || 'Unknown',
      amount: amount(row.value, row.tokenDecimal ?? '0'),
      usd: 0,
      direction,
      from,
      to,
      protocol: protocolFor(direction === 'out' ? to : from),
      counterparty: direction === 'in' ? from : to,
    };
    const movements = tokenByHash.get(movement.hash) ?? [];
    movements.push(movement);
    tokenByHash.set(movement.hash, movements);
  }

  const transactions: Transaction[] = normalRows
    .map((row) => {
      const time = timestamp(row.timeStamp);
      const hash = row.hash.toLowerCase();
      const from = row.from.toLowerCase();
      const to = row.to?.toLowerCase() ?? null;
      const protocol = protocolFor(to ?? '');
      const movements = tokenByHash.get(hash) ?? [];
      const native = amount(row.value, 18);
      if (native > 0 && (from === wallet || to === wallet)) {
        const direction = to === wallet ? 'in' as const : 'out' as const;
        movements.push({
          id: `${hash}:eth`, hash, timestamp: time, token: 'ETH', amount: native,
          usd: 0, direction, from, to: to ?? '', protocol,
          counterparty: direction === 'in' ? from : to ?? '',
        });
      }
      return {
        hash,
        timestamp: time,
        type: row.functionName || (row.input && row.input !== '0x' ? row.methodId || 'Contract call' : 'Transfer'),
        protocol,
        movements,
        value: 0,
        fromAddress: from,
        toAddress: to,
        successful: row.isError !== '1' && row.txreceipt_status !== '0',
      };
    })
    .filter((row) => row.timestamp && Date.parse(row.timestamp) >= start && Date.parse(row.timestamp) < end)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Token transfers can exist in internal calls not returned as a normal wallet transaction.
  const known = new Set(transactions.map((row) => row.hash));
  for (const [hash, movements] of tokenByHash) {
    if (known.has(hash)) continue;
    transactions.push({
      hash,
      timestamp: movements[0].timestamp,
      type: 'Token transfer',
      protocol: movements[0].protocol,
      movements,
      value: 0,
    });
  }
  transactions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const movements = transactions.flatMap((row) => row.movements);
  const daily = Array.from({ length: periodDays }, (_, index) => {
    const date = new Date(start + index * DAY).toISOString().slice(0, 10);
    return transactions.filter((row) => row.timestamp.slice(0, 10) === date).length;
  });
  const successful = transactions.filter((row) => row.successful !== false);
  const protocols = protocolDefinitions.map((definition) => {
    const count = successful.filter((row) => row.protocol === definition.name).length;
    return { ...definition, count, share: successful.length ? count / successful.length * 100 : 0 };
  });
  const incoming = movements.filter((row) => row.direction === 'in').reduce((sum, row) => sum + row.usd, 0);
  const outgoing = movements.filter((row) => row.direction === 'out').reduce((sum, row) => sum + row.usd, 0);
  const flows = new Map<string, { name: string; incoming: number; outgoing: number; source: 'transactions' }>();
  for (const movement of movements) {
    if (!movement.counterparty) continue;
    const flow = flows.get(movement.counterparty) ?? { name: movement.counterparty, incoming: 0, outgoing: 0, source: 'transactions' as const };
    if (movement.direction === 'in') flow.incoming += movement.usd;
    else flow.outgoing += movement.usd;
    flows.set(movement.counterparty, flow);
  }
  const oldest = transactions.at(-1)?.timestamp ?? null;
  const newest = transactions[0]?.timestamp ?? null;
  return {
    transactions,
    movements,
    daily,
    holdings: [],
    protocols,
    incoming,
    outgoing,
    flows: [...flows.values()],
    historicalBalances: [],
    tradePerformance: null,
    defiPositions: [],
    enrichmentCoverage: {
      historicalBalances: false,
      counterparties: false,
      tradePerformance: false,
      defiPositions: false,
    },
    totalBalance: 0,
    volume: 0,
    counterparties: flows.size,
    firstActivity: oldest,
    lastActivity: newest,
    walletAgeDays: oldest ? Math.floor((end - Date.parse(oldest)) / DAY) : 0,
    daysSinceLastActivity: newest ? Math.floor((end - Date.parse(newest)) / DAY) : null,
    asOf,
    start: new Date(start).toISOString(),
    address: wallet,
    days: periodDays,
  };
}

export async function createEtherscanAnalysis(
  address: string,
  periodDays: number,
  key: string,
): Promise<AnalysisRecord> {
  const normalized = address.toLowerCase();
  const asOf = new Date().toISOString();
  const [normal, tokens, nft721, nft1155] = await Promise.all([
    allPages<NormalTransaction>(key, 'txlist', normalized),
    optional('ERC-20 transfers', allPages<TokenTransfer>(key, 'tokentx', normalized)),
    optional('ERC-721 transfers', allPages<NftTransfer>(key, 'tokennfttx', normalized)),
    optional('ERC-1155 transfers', allPages<NftTransfer>(key, 'token1155tx', normalized)),
  ]);
  const data = buildWalletData(normalized, periodDays, asOf, normal.rows, tokens?.rows ?? []);
  data.transactionCoverage = {
    complete: normal.complete,
    limit: PAGE_SIZE * MAX_PAGES,
    fetched: normal.rows.length,
  };
  data.verifiedTransactionCoverage = normal.complete;
  const verifiedTransactions = normal.rows.map((row) => ({
    hash: row.hash.toLowerCase(),
    timestamp: timestamp(row.timeStamp),
    fromAddress: row.from.toLowerCase(),
    successful: row.isError !== '1' && row.txreceipt_status !== '0',
  })).filter((row) => row.timestamp);
  const fungibleByHash = new Map<string, TokenTransfer[]>();
  for (const row of tokens?.rows ?? []) {
    const rows = fungibleByHash.get(row.hash.toLowerCase()) ?? [];
    rows.push(row);
    fungibleByHash.set(row.hash.toLowerCase(), rows);
  }
  const pipelineTransactions: PipelineTransaction[] = normal.rows.map((row) => {
    const hash = row.hash.toLowerCase();
    const fungible = fungibleByHash.get(hash) ?? [];
    const token = (item: TokenTransfer) => ({
      tokenAddress: item.contractAddress,
      symbol: item.tokenSymbol,
      amount: amount(item.value, item.tokenDecimal ?? '0'),
      valueUsd: 0,
      fromAddress: item.from,
      toAddress: item.to,
    });
    return {
      hash,
      timestamp: timestamp(row.timeStamp),
      method: row.functionName || row.methodId || '',
      protocol: protocolFor(row.to ?? ''),
      fromAddress: row.from.toLowerCase(),
      successful: row.isError !== '1' && row.txreceipt_status !== '0',
      nativeAmount: amount(row.value, 18),
      tokensSent: fungible.filter((item) => item.from.toLowerCase() === normalized).map(token),
      tokensReceived: fungible.filter((item) => item.to.toLowerCase() === normalized).map(token),
    };
  }).filter((row) => row.timestamp);
  const nftTransfers: PipelineNftTransfer[] = [
    ...(nft721?.rows ?? []),
    ...(nft1155?.rows ?? []),
  ].map((row) => ({
    hash: row.hash.toLowerCase(),
    timestamp: timestamp(row.timeStamp),
    fromAddress: row.from.toLowerCase(),
    toAddress: row.to.toLowerCase(),
    collectionId: `ethereum:${row.contractAddress.toLowerCase()}`,
  })).filter((row) => row.timestamp);
  const defiActions = extractDefiActions(normalized, pipelineTransactions);
  const nftTrades = extractNftTrades({
    wallet: normalized,
    transactions: pipelineTransactions,
    nftTransfers,
  });
  const transactions30d = coversWindow(normal, asOf, 30);
  const transactions90d = coversWindow(normal, asOf, 90);
  const nftTrades30d = transactions30d &&
    coversWindow(tokens, asOf, 30) &&
    coversWindow(nft721, asOf, 30) &&
    coversWindow(nft1155, asOf, 30);
  const profiles = classify(buildClassificationEvidence({
    address: normalized,
    cutoff: asOf,
    coverage: {
      transactions30d,
      transactions90d,
      lifetimeTransactions: normal.complete,
      dexTrades30d: false,
      defiActions30d: periodDays >= 30 && transactions30d,
      nftTrades30d: periodDays >= 30 && nftTrades30d,
      holdingHistory90d: false,
      stakingPositionsAndDeposits: false,
    },
    transactions: verifiedTransactions,
    dexTrades: [],
    defiActions,
    nftTrades,
    holdings: [],
    stakingPositions: [],
  }));
  return {
    analysisId: analysisIdFor(normalized, periodDays),
    address: normalized,
    network: 'ethereum-mainnet',
    periodDays,
    status: 'complete',
    source: 'etherscan',
    sources: ['etherscan'],
    generatedAt: new Date().toISOString(),
    analysisCutoff: asOf,
    providerDataCutoff: null,
    expiresAt: new Date(Date.now() + ANALYSIS_TTL_SECONDS * 1000).toISOString(),
    ruleVersion: CLASSIFICATION_RULE_VERSION,
    mappingVersion: MAPPING_VERSION,
    data,
    profiles,
    primaryProfile: profiles.filter((item) => item.assigned)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.name ??
      (profiles.some((item) => item.status === 'NOT_ASSESSED')
        ? 'Not enough data to classify'
        : 'No profile matched'),
  };
}
