export type Direction = 'in' | 'out';

export const protocolDefinitions = [
  { name: 'Uniswap', letter: 'U', type: 'Decentralized exchange', color: '#9c83ee' },
  { name: 'Aave', letter: 'A', type: 'Lending & borrowing', color: '#8e91ba' },
  { name: 'Lido', letter: 'L', type: 'Liquid staking', color: '#b6a3e6' },
  { name: 'OpenSea', letter: 'O', type: 'Marketplace protocol', color: '#a78cde' },
  { name: 'Blur', letter: 'B', type: 'Marketplace protocol', color: '#bcaddb' },
  { name: 'No protocol', letter: '—', type: 'Direct wallet transfers', color: '#ada5bc' },
  { name: 'Unknown', letter: '?', type: 'Unattributed transfers', color: '#ada5bc' },
] as const;

export type ProtocolUsage = {
  name: string;
  letter: string;
  type: string;
  color: string;
  count: number;
  share: number;
  evidence?: 'supported-mapping' | 'nansen-labeled-contract' | 'nansen-labeled-counterparty';
};

export type Movement = {
  id: string;
  hash: string;
  timestamp: string;
  token: string;
  amount: number;
  usd: number;
  usdAvailable?: boolean;
  usdPriceSource?: 'alchemy-daily';
  tokenAddress?: string;
  direction: Direction;
  from: string;
  to: string;
  protocol: string;
  counterparty: string;
};

export type Transaction = {
  hash: string;
  timestamp: string;
  type: string;
  protocol: string;
  movements: Movement[];
  value: number;
  valueAvailable?: boolean;
  fromAddress?: string;
  toAddress?: string | null;
  successful?: boolean;
};

export type Holding = {
  tokenAddress: string;
  symbol: string;
  name: string;
  price: number;
  color: string;
  balance: number;
  value: number;
};

export type HistoricalBalance = {
  timestamp: string;
  tokenAddress: string;
  symbol: string;
  amount: number;
  value: number;
};

export type TradePerformance = {
  tradedTokenCount: number;
  tradedTimes: number;
  realizedPnlUsd: number;
  realizedPnlPercent: number;
  winRate: number;
};

export type DefiPosition = {
  protocol: string;
  chain: string;
  totalValue: number;
  totalAssets: number;
  totalDebts: number;
  totalRewards: number;
  positionTypes: string[];
};

export type WalletData = {
  usdValuation?: 'complete' | 'partial' | 'unavailable';
  transactionCoverage?: { complete: boolean; limit: number; fetched: number };
  verifiedTransactionCoverage?: boolean;
  transactions: Transaction[];
  movements: Movement[];
  daily: number[];
  holdings: Holding[];
  protocols: ProtocolUsage[];
  incoming: number;
  outgoing: number;
  flows: Array<{
    name: string;
    label?: string;
    interactionCount?: number;
    incoming: number;
    outgoing: number;
    source?: 'transactions' | 'nansen-counterparties';
  }>;
  historicalBalances: HistoricalBalance[];
  tradePerformance: TradePerformance | null;
  defiPositions: DefiPosition[];
  enrichmentCoverage: {
    historicalBalances: boolean;
    counterparties: boolean;
    tradePerformance: boolean;
    defiPositions: boolean;
  };
  totalBalance: number;
  volume: number;
  counterparties: number;
  firstActivity: string | null;
  lastActivity: string | null;
  walletAgeDays: number;
  daysSinceLastActivity: number | null;
  asOf: string;
  start: string;
  address: string;
  days: number;
};

export const shortAddress = (value: string) =>
  value && value.length >= 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value || 'Unknown';

export const usd = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });

export const quantity = (value: number) =>
  value.toLocaleString('en-US', { maximumFractionDigits: 6 });

export const timestamp = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

export const relativeTime = (value: string, now = Date.now()) => {
  const elapsed = now - Date.parse(value);
  if (!Number.isFinite(elapsed)) return 'Unknown';
  if (elapsed < 60_000) return 'Just now';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;
  const days = Math.floor(elapsed / 86_400_000);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
};
