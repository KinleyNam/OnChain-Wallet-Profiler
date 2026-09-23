export const CLASSIFICATION_RULE_VERSION = 'classification-v1.0';
export const MAPPING_VERSION = 'mappings-v6';

export const PROFILE_RULES = {
  activeTrader: {
    threshold: 60,
    minimumTrades: 10,
    minimumDays: 3,
    tradeCount: 10,
    tradeRatio: 30,
    tradingDays: 5,
    tokens: 3,
    points: { AT1: 40, AT2: 30, AT3: 20, AT4: 10 },
  },
  longTermHolder: {
    threshold: 70,
    minimumStartingValueUsd: 100,
    minimumRetentionPercent: 80,
    maximumOutgoingPercent: 20,
    maximumRecentOutgoing: 3,
    points: { LH1: 50, LH2: 30, LH3: 20 },
  },
  defiParticipant: {
    threshold: 60,
    minimumTransactions: 5,
    transactions: 10,
    days: 3,
    protocols: 2,
    actionTypes: 2,
    points: { DF1: 40, DF2: 30, DF3: 20, DF4: 10 },
  },
  nftTrader: {
    threshold: 60,
    minimumTrades: 5,
    tradeCount: 5,
    days: 3,
    collections: 2,
    points: { NF1: 40, NF2: 30, NF3: 20, NF4: 10 },
  },
  stakingParticipant: {
    threshold: 70,
    minimumContinuousDays: 14,
    points: { ST1: 50, ST2: 30, ST3: 20 },
  },
  dormantOrNew: {
    newAgeDays: 30,
    maximumNewLifetimeTransactions: 5,
    dormantAgeDays: 180,
    recentDays: 90,
  },
} as const;
