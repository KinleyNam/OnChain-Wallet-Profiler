import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify } from './classification';
import {
  buildClassificationEvidence,
  type VerifiedWalletEvidence,
} from './classification-evidence';

const wallet = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';
const cutoff = '2026-09-22T12:00:00Z';

function verified(): VerifiedWalletEvidence {
  return {
    address: wallet,
    cutoff,
    coverage: {
      transactions30d: true,
      transactions90d: true,
      lifetimeTransactions: true,
      dexTrades30d: true,
      defiActions30d: true,
      nftTrades30d: true,
      holdingHistory90d: false,
      stakingPositionsAndDeposits: true,
    },
    transactions: [
      {
        hash: '0xswap',
        timestamp: '2026-09-21T10:00:00Z',
        fromAddress: wallet,
        successful: true,
      },
      {
        hash: '0xswap',
        timestamp: '2026-09-21T10:00:00Z',
        fromAddress: wallet,
        successful: true,
      },
      {
        hash: '0xdefi',
        timestamp: '2026-09-20T10:00:00Z',
        fromAddress: wallet,
        successful: true,
      },
      {
        hash: '0xfailed',
        timestamp: '2026-09-22T08:00:00Z',
        fromAddress: wallet,
        successful: false,
      },
      {
        hash: '0xboundary',
        timestamp: '2026-08-23T12:00:00Z',
        fromAddress: wallet,
        successful: true,
      },
      {
        hash: '0xcutoff',
        timestamp: cutoff,
        fromAddress: wallet,
        successful: true,
      },
      {
        hash: '0xinbound',
        timestamp: '2026-09-21T08:00:00Z',
        fromAddress: other,
        successful: true,
      },
    ],
    dexTrades: [
      {
        hash: '0xswap',
        timestamp: '2026-09-21T10:00:00Z',
        traderAddress: wallet,
        successful: true,
        tokenIds: ['ethereum:eth', 'ethereum:usdc'],
      },
    ],
    defiActions: [
      {
        hash: '0xdefi',
        timestamp: '2026-09-20T10:00:00Z',
        initiatorAddress: wallet,
        successful: true,
        protocolId: 'aave',
        actionType: 'supply',
      },
    ],
    nftTrades: [
      {
        hash: '0xinbound',
        timestamp: '2026-09-21T08:00:00Z',
        buyerAddress: other,
        sellerAddress: wallet,
        successful: true,
        collectionId: 'ethereum:collection',
      },
    ],
    holdings: [],
    stakingPositions: [
      {
        serviceId: 'lido',
        active: true,
        verifiedDepositAt: '2026-05-25T12:00:00Z',
        continuousSince: '2026-09-08T12:00:00Z',
      },
    ],
  };
}

void test('verified event builder deduplicates hashes and uses inclusive start, exclusive cutoff', () => {
  const evidence = buildClassificationEvidence(verified());
  assert.equal(evidence.activeTrader?.outgoingTransactions, 3);
  assert.equal(evidence.activeTrader?.dexTransactions, 1);
  assert.equal(evidence.defiParticipant?.transactions, 1);
  assert.equal(evidence.nftTrader?.tradeTransactions, 1);
  assert.equal(evidence.nftTrader?.hasSales, true);
  assert.equal(evidence.dormantOrNew?.lifetimeInitiatedTransactions, 4);
  assert.equal(evidence.dormantOrNew?.initiatedTransactions90d, 4);
  const staking = classify(evidence).find(
    (item) => item.name === 'Staking participant',
  );
  assert.equal(staking?.score, 70);
  assert.equal(staking?.status, 'ASSIGNED');
});

void test('missing coverage and inconsistent swaps withhold profile scores', () => {
  const input = verified();
  input.coverage.dexTrades30d = false;
  assert.equal(
    classify(buildClassificationEvidence(input)).find(
      (item) => item.name === 'Active trader',
    )?.status,
    'NOT_ASSESSED',
  );
  input.coverage.dexTrades30d = true;
  input.dexTrades[0].hash = '0xnot-in-transactions';
  assert.equal(
    classify(buildClassificationEvidence(input)).find(
      (item) => item.name === 'Active trader',
    )?.status,
    'NOT_ASSESSED',
  );
});

void test('trading days use UTC dates when verified timestamps include offsets', () => {
  const input = verified();
  input.transactions.push({ hash: '0xswap2', timestamp: '2026-09-22T01:00:00+03:00', fromAddress: wallet, successful: true });
  input.dexTrades.push({ hash: '0xswap2', timestamp: '2026-09-22T01:00:00+03:00', traderAddress: wallet, successful: true, tokenIds: ['ethereum:eth', 'ethereum:usdc'] });
  assert.equal(buildClassificationEvidence(input).activeTrader?.tradingDays, 1);
});
