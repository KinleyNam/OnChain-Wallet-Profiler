import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classify,
  isQualifyingHolding,
  type ClassificationEvidence,
  type RetainedHolding,
} from './classification';

const cutoff = '2026-09-22T12:00:00Z';
const holding: RetainedHolding = {
  tokenId: 'ethereum:0x123',
  recognised: true,
  reconstructable: true,
  startingBalance: 100,
  currentBalance: 90,
  startingPriceUsd: 2,
  grossOutgoingUnits: 10,
  minimumBalance: 90,
};

function complete(): ClassificationEvidence {
  return {
    cutoff,
    activeTrader: {
      dexTransactions: 0,
      outgoingTransactions: 0,
      tradingDays: 0,
      tradedTokenIds: [],
    },
    longTermHolder: {
      holdings: [],
      holdingHistoryComplete: true,
      recentOutgoingTransactions: 0,
      recentDexTrades: 0,
    },
    defiParticipant: {
      transactions: 0,
      days: 0,
      protocolIds: [],
      actionTypes: [],
    },
    nftTrader: {
      tradeTransactions: 0,
      tradingDays: 0,
      collectionIds: [],
      hasPurchases: false,
      hasSales: false,
    },
    stakingParticipant: {
      hasActivePosition: false,
      hasVerifiedDeposit: false,
      hasDepositInLast90Days: false,
      continuousStakingDays: 0,
    },
    dormantOrNew: { firstActivityKnown: true, firstActivityAt: null },
  };
}

function profile(evidence: ClassificationEvidence, name: string) {
  const found = classify(evidence).find((item) => item.name === name);
  assert.ok(found);
  return found;
}

void test('active trader enforces the trading-day minimum even at 80 points', () => {
  const input = complete();
  input.activeTrader = {
    dexTransactions: 10,
    outgoingTransactions: 25,
    tradingDays: 2,
    tradedTokenIds: ['eth', 'usdc', 'wbtc'],
  };
  const result = profile(input, 'Active trader');
  assert.equal(result.score, 80);
  assert.equal(result.status, 'NOT_ASSIGNED');
  assert.deepEqual(
    result.matchedRules.map((rule) => rule.id),
    ['AT1', 'AT2', 'AT4'],
  );
});

void test('inconsistent trade ratio is not scored', () => {
  const input = complete();
  input.activeTrader = {
    dexTransactions: 11,
    outgoingTransactions: 10,
    tradingDays: 6,
    tradedTokenIds: ['eth', 'usdc', 'wbtc'],
  };
  assert.equal(profile(input, 'Active trader').status, 'NOT_ASSESSED');
});

void test('retained holding requires uninterrupted positive balance and limited gross outflow', () => {
  assert.equal(isQualifyingHolding(holding), true);
  assert.equal(
    isQualifyingHolding({ ...holding, minimumBalance: 0, currentBalance: 100 }),
    false,
  );
  const input = complete();
  input.longTermHolder = {
    holdings: [holding],
    holdingHistoryComplete: true,
    recentOutgoingTransactions: 2,
    recentDexTrades: 0,
  };
  assert.equal(profile(input, 'Long-term holder').score, 100);
  assert.equal(profile(input, 'Long-term holder').status, 'ASSIGNED');
  input.longTermHolder.holdingHistoryComplete = false;
  assert.equal(profile(input, 'Long-term holder').status, 'NOT_ASSESSED');
});

void test('DeFi participant scores six verified actions across days, protocols and types', () => {
  const input = complete();
  input.defiParticipant = {
    transactions: 6,
    days: 4,
    protocolIds: ['aave', 'compound'],
    actionTypes: ['supply', 'withdraw'],
  };
  const result = profile(input, 'DeFi participant');
  assert.equal(result.score, 60);
  assert.equal(result.status, 'ASSIGNED');
});

void test('NFT gifts cannot count as trades, while seven verified trades can qualify', () => {
  const input = complete();
  assert.equal(profile(input, 'NFT trader').status, 'NOT_ASSIGNED');
  input.nftTrader = {
    tradeTransactions: 7,
    tradingDays: 2,
    collectionIds: ['0xcollection'],
    hasPurchases: true,
    hasSales: true,
  };
  const result = profile(input, 'NFT trader');
  assert.equal(result.score, 60);
  assert.equal(result.status, 'ASSIGNED');
});

void test('staking requires current position and a verified deposit, including an older deposit', () => {
  const input = complete();
  input.stakingParticipant = {
    hasActivePosition: true,
    hasVerifiedDeposit: true,
    hasDepositInLast90Days: false,
    continuousStakingDays: 14,
  };
  const result = profile(input, 'Staking participant');
  assert.equal(result.score, 70);
  assert.equal(result.status, 'ASSIGNED');
  input.stakingParticipant.hasVerifiedDeposit = false;
  assert.equal(profile(input, 'Staking participant').status, 'NOT_ASSIGNED');
});

void test('new and dormant boundaries use wallet-initiated lifetime history without scores', () => {
  const input = complete();
  input.dormantOrNew = {
    firstActivityKnown: true,
    firstActivityAt: '2026-08-23T12:00:00Z',
    lifetimeInitiatedTransactions: 5,
  };
  const newest = profile(input, 'Dormant or new wallet');
  assert.equal(newest.status, 'ASSIGNED');
  assert.equal(newest.reason, 'new');
  assert.equal(newest.score, null);
  input.dormantOrNew.lifetimeInitiatedTransactions = 6;
  assert.equal(profile(input, 'Dormant or new wallet').status, 'NOT_ASSIGNED');
  input.dormantOrNew = {
    firstActivityKnown: true,
    firstActivityAt: '2026-03-26T12:00:00Z',
    initiatedTransactions90d: 0,
  };
  assert.equal(profile(input, 'Dormant or new wallet').reason, 'dormant');
  input.dormantOrNew.initiatedTransactions90d = 1;
  assert.equal(profile(input, 'Dormant or new wallet').status, 'NOT_ASSIGNED');
});

void test('one missing profile does not suppress another verified assignment', () => {
  const input = complete();
  delete input.nftTrader;
  input.defiParticipant = {
    transactions: 6,
    days: 4,
    protocolIds: ['aave', 'compound'],
    actionTypes: ['supply', 'withdraw'],
  };
  assert.equal(profile(input, 'NFT trader').status, 'NOT_ASSESSED');
  assert.equal(profile(input, 'DeFi participant').status, 'ASSIGNED');
});

void test('available wallet activity alone does not become zero verified actions', () => {
  const results = classify({ cutoff });
  assert.equal(results.length, 6);
  assert.ok(
    results.every(
      (item) => item.status === 'NOT_ASSESSED' && item.score === null,
    ),
  );
});
