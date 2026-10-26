import type { WalletData, Movement, Transaction } from './wallet-data';
import { classify, type ClassificationEvidence } from '../server/classification';
import { calculateIndicators } from '../server/indicators';

export const DEMO_ADDRESS = '0xD3f1000000000000000000000000000000000090';
export const DEMO_URL = '/profiler/Overview?demo=defi&period=90';

const pool = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
const compound = '0xc3d688b66703497daa19211eedff47f25384cdc3';
const router = '0xe592427a0aece92de3edee1f18e0157c05861564';
const otherWallet = '0x73d0b57e61e4f95637d49b366a0ff8c4612db62e';
const assets = {
  ETH: { address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', price: 2400 },
  USDC: { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', price: 1 },
  WETH: { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', price: 2400 },
  DAI: { address: '0x6b175474e89094c44da98b954eedeac495271d0f', price: 1 },
  aUSDC: { address: '0x98c23e9d8f34f3e5c2dd7a6bdb9cfe2d3bfdbb36', price: 1 },
} as const;

const hashFor = (index: number) => `0x${(index + 0xdecaf000).toString(16).padStart(64, '0')}`;
const isoDaysAgo = (days: number, hour = 12, minute = 12) => {
  const value = new Date();
  value.setUTCHours(hour, minute, 0, 0);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString();
};

export function createDemoAnalysis(periodDays: number) {
  const transactions: Transaction[] = [];
  const movements: Movement[] = [];
  const activity: Record<string, number> = {};
  const defiActions = ['Supply USDC', 'Borrow DAI', 'Repay DAI', 'Withdraw USDC'];
  const transactionCount = periodDays === 30 ? 37 : periodDays === 180 ? 148 : 92;

  for (let index = 0; index < transactionCount; index++) {
    const daysAgo = Math.max(0, Math.floor(((index + 0.35) * periodDays) / transactionCount));
    const isSwap = daysAgo > 30 && index % 17 === 0;
    const isTransfer = index % 19 === 0 && !isSwap;
    const isCompound = !isSwap && !isTransfer && index % 4 === 0;
    const protocol = isSwap ? 'Uniswap' : isTransfer ? 'No protocol' : isCompound ? 'Compound III' : 'Aave';
    const action = isSwap ? 'Swap USDC for WETH' : isTransfer ? 'Transfer USDC' : defiActions[index % defiActions.length];
    const token = isSwap ? 'WETH' : action.includes('DAI') ? 'DAI' : 'USDC';
    const direction = action.startsWith('Borrow') || action.startsWith('Withdraw') || isSwap ? 'in' : 'out';
    const amount = token === 'WETH' ? 0.32 + (index % 4) * 0.11 : 160 + (index % 7) * 74;
    const timestamp = isoDaysAgo(daysAgo, 8 + (index % 11), (index * 17) % 60);
    const hash = hashFor(index);
    const counterparty = isSwap ? router : isTransfer ? otherWallet : isCompound ? compound : pool;
    const movement: Movement = {
      id: `${hash}-0`, hash, timestamp, token, amount, usd: amount * assets[token].price,
      usdAvailable: true, tokenAddress: assets[token].address, direction,
      from: direction === 'in' ? counterparty : DEMO_ADDRESS,
      to: direction === 'in' ? DEMO_ADDRESS : counterparty,
      protocol, counterparty,
    };
    const legs = [movement];
    if (isSwap) {
      legs.push({
        ...movement, id: `${hash}-1`, token: 'USDC', tokenAddress: assets.USDC.address,
        amount: Math.round(movement.usd * 100) / 100, usd: movement.usd,
        direction: 'out', from: DEMO_ADDRESS, to: router,
      });
    }
    movements.push(...legs);
    transactions.push({
      hash, timestamp, type: action, protocol, movements: legs,
      value: legs.reduce((sum, leg) => sum + leg.usd, 0), valueAvailable: true,
      fromAddress: DEMO_ADDRESS, toAddress: counterparty, successful: true,
    });
    const date = timestamp.slice(0, 10);
    activity[date] = (activity[date] ?? 0) + 1;
  }

  transactions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  movements.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const asOf = new Date().toISOString();
  const today = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`);
  const daily = Array.from({ length: periodDays }, (_, index) => {
    const date = new Date(today - (periodDays - index - 1) * 86_400_000).toISOString().slice(0, 10);
    return activity[date] ?? 0;
  });
  const holdings = [
    { tokenAddress: assets.ETH.address, symbol: 'ETH', name: 'Ethereum', price: 2400, color: '#a78bfa', balance: 8.42, value: 20208 },
    { tokenAddress: assets.USDC.address, symbol: 'USDC', name: 'USD Coin', price: 1, color: '#4a90e2', balance: 12540, value: 12540 },
    { tokenAddress: assets.WETH.address, symbol: 'WETH', name: 'Wrapped Ether', price: 2400, color: '#8e91ba', balance: 3.16, value: 7584 },
    { tokenAddress: assets.aUSDC.address, symbol: 'aUSDC', name: 'Aave USDC', price: 1, color: '#b6a3e6', balance: 6850, value: 6850 },
    { tokenAddress: assets.DAI.address, symbol: 'DAI', name: 'Dai Stablecoin', price: 1, color: '#f4b660', balance: 1840, value: 1840 },
  ];
  const protocolNames = ['Aave', 'Compound III', 'Uniswap', 'No protocol'];
  const counts = Object.fromEntries(protocolNames.map((name) => [name, transactions.filter((tx) => tx.protocol === name).length]));
  const protocolMeta: Record<string, { type: string; color: string; letter: string }> = {
    Aave: { type: 'Lending & borrowing', color: '#a78bfa', letter: 'A' },
    'Compound III': { type: 'Lending & borrowing', color: '#75b7ca', letter: 'C' },
    Uniswap: { type: 'Decentralized exchange', color: '#c389dc', letter: 'U' },
    'No protocol': { type: 'Direct wallet transfers', color: '#ada5bc', letter: '-' },
  };
  const protocols = protocolNames.filter((name) => counts[name] > 0).map((name) => ({
    name, ...protocolMeta[name], count: counts[name],
    share: Math.round((counts[name] / transactionCount) * 1000) / 10,
    evidence: 'supported-mapping' as const,
  }));
  const counterparties = [
    { name: 'Aave V3 Pool', label: pool, incoming: 11280, outgoing: 16860, interactionCount: counts.Aave },
    { name: 'Compound III', label: compound, incoming: 4120, outgoing: 5740, interactionCount: counts['Compound III'] },
    { name: 'Uniswap V3 Router', label: router, incoming: 3660, outgoing: 3660, interactionCount: counts.Uniswap },
    { name: 'Other wallet', label: otherWallet, incoming: 0, outgoing: 780, interactionCount: counts['No protocol'] },
  ];
  const historicalBalances = holdings.flatMap((holding) => [90, 60, 30, 0]
    .filter((age) => age <= periodDays)
    .map((age) => ({
      timestamp: isoDaysAgo(age), tokenAddress: holding.tokenAddress,
      symbol: holding.symbol,
      amount: Math.round(holding.balance * (0.7 + (90 - age) / 300) * 100) / 100,
      value: Math.round(holding.value * (0.7 + (90 - age) / 300) * 100) / 100,
    })));
  const wallet: WalletData = {
    address: DEMO_ADDRESS, days: periodDays, asOf, start: isoDaysAgo(periodDays),
    transactions, movements, daily, holdings, protocols,
    incoming: movements.filter((leg) => leg.direction === 'in').reduce((sum, leg) => sum + leg.usd, 0),
    outgoing: movements.filter((leg) => leg.direction === 'out').reduce((sum, leg) => sum + leg.usd, 0),
    flows: counterparties.map((flow) => ({ ...flow, source: 'transactions' as const })),
    historicalBalances, tradePerformance: null,
    defiPositions: [
      { protocol: 'Aave', chain: 'Ethereum', totalValue: 6850, totalAssets: 6850, totalDebts: 920, totalRewards: 0, positionTypes: ['Supply', 'Borrow'] },
      { protocol: 'Compound III', chain: 'Ethereum', totalValue: 3100, totalAssets: 3100, totalDebts: 0, totalRewards: 24, positionTypes: ['Supply'] },
    ],
    enrichmentCoverage: { historicalBalances: true, counterparties: true, tradePerformance: false, defiPositions: true },
    totalBalance: holdings.reduce((sum, holding) => sum + holding.value, 0),
    volume: movements.reduce((sum, leg) => sum + leg.usd, 0),
    counterparties: 12, firstActivity: isoDaysAgo(322), lastActivity: transactions[0]?.timestamp ?? null,
    walletAgeDays: 322, daysSinceLastActivity: 0,
    usdValuation: 'complete', verifiedTransactionCoverage: true,
    transactionCoverage: { complete: true, fetched: transactionCount, limit: transactionCount },
  };

  const defiTransactions = transactions.filter((tx) => tx.protocol === 'Aave' || tx.protocol === 'Compound III');
  const swapTransactions = transactions.filter((tx) => tx.protocol === 'Uniswap');
  const cutoff = asOf;
  const evidence: ClassificationEvidence = {
    cutoff,
    activeTrader: {
      dexTransactions: swapTransactions.length,
      outgoingTransactions: transactions.length,
      tradingDays: new Set(swapTransactions.map((tx) => tx.timestamp.slice(0, 10))).size,
      tradedTokenIds: [assets.USDC.address, assets.WETH.address, assets.DAI.address],
    },
    longTermHolder: {
      holdings: [], holdingHistoryComplete: true,
      recentOutgoingTransactions: transactions.filter((tx) => Date.parse(tx.timestamp) > Date.now() - 30 * 86_400_000).length,
      recentDexTrades: swapTransactions.filter((tx) => Date.parse(tx.timestamp) > Date.now() - 30 * 86_400_000).length,
    },
    defiParticipant: {
      transactions: defiTransactions.length,
      days: new Set(defiTransactions.map((tx) => tx.timestamp.slice(0, 10))).size,
      protocolIds: ['aave-v3', 'compound-iii'],
      actionTypes: ['supply', 'borrow', 'repay', 'withdraw'],
    },
    nftTrader: { tradeTransactions: 0, tradingDays: 0, collectionIds: [], hasPurchases: false, hasSales: false },
    stakingParticipant: { hasActivePosition: false, hasVerifiedDeposit: false, hasDepositInLast90Days: false, continuousStakingDays: 0 },
    dormantOrNew: {
      firstActivityKnown: true, firstActivityAt: isoDaysAgo(322), oldestObservedInitiatedAt: isoDaysAgo(322),
      lifetimeInitiatedTransactions: 436,
      initiatedTransactions90d: transactions.filter((tx) => Date.parse(tx.timestamp) > Date.now() - 90 * 86_400_000).length,
    },
  };
  const profiles = classify(evidence).map((profile) => {
    const related = profile.name === 'DeFi participant' ? defiTransactions : profile.name === 'Active trader' ? swapTransactions : [];
    return {
      ...profile,
      evidence: `Demo: ${profile.evidence}`,
      relatedTransactions: related.slice(0, 10).map((tx) => ({ hash: tx.hash, timestamp: tx.timestamp, label: tx.type })),
      relatedTransactionCount: related.length,
    };
  });
  return {
    wallet, profiles, primaryProfile: 'DeFi participant',
    indicators: calculateIndicators(wallet),
  };
}
