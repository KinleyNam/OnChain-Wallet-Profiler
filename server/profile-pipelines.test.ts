import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractDefiActions,
  extractNftTrades,
  extractStakingPositions,
  reconstructRetainedHoldings,
  type PipelineTransaction,
} from './profile-pipelines';

const wallet = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';
const cutoff = '2026-10-18T12:00:00.000Z';

function transaction(overrides: Partial<PipelineTransaction> = {}): PipelineTransaction {
  return {
    hash: '0xhash',
    timestamp: '2026-10-10T12:00:00.000Z',
    method: 'supply(address,uint256,address,uint16)',
    protocol: 'Aave',
    fromAddress: wallet,
    successful: true,
    tokensSent: [],
    tokensReceived: [],
    ...overrides,
  };
}

void test('extracts only successful wallet-initiated decoded DeFi actions', () => {
  const actions = extractDefiActions(wallet, [
    transaction(),
    transaction({ hash: '0x2', method: 'decreaseLiquidity', protocol: 'Uniswap' }),
    transaction({ hash: '0x3', method: 'supply', successful: false }),
    transaction({ hash: '0x4', method: 'transfer' }),
  ]);
  assert.deepEqual(actions.map((row) => row.actionType), ['supply', 'remove_liquidity']);
});

void test('reconstructs retained holdings from boundary snapshots and transfers', () => {
  const start = new Date(Date.parse(cutoff) - 90 * 86_400_000).toISOString();
  const holdings = reconstructRetainedHoldings({
    cutoff,
    balances: [{ tokenAddress: '0xtoken', symbol: 'TOK', amount: 90, priceUsd: 2, valueUsd: 180 }],
    historical: [
      { timestamp: start, tokenAddress: '0xtoken', symbol: 'TOK', amount: 100, valueUsd: 200 },
      { timestamp: '2026-09-18T12:00:00.000Z', tokenAddress: '0xtoken', symbol: 'TOK', amount: 90, valueUsd: 180 },
    ],
    transactions: [transaction({
      tokensSent: [{ tokenAddress: '0xtoken', symbol: 'TOK', amount: 10, valueUsd: 20 }],
    })],
  });
  assert.equal(holdings[0].reconstructable, true);
  assert.equal(holdings[0].grossOutgoingUnits, 10);
  assert.equal(holdings[0].minimumBalance, 90);
});

void test('requires a successful known-marketplace transaction with payment for an NFT trade', () => {
  const trades = extractNftTrades({
    wallet,
    transactions: [transaction({
      protocol: 'OpenSea',
      nativeAmount: 1,
      method: 'fulfillBasicOrder',
    })],
    nftTransfers: [{
      hash: '0xhash', timestamp: '2026-10-10T12:00:00.000Z',
      fromAddress: other, toAddress: wallet, collectionId: 'ethereum:0xcollection',
    }],
  });
  assert.equal(trades.length, 1);
  assert.equal(trades[0].buyerAddress, wallet);
});

void test('combines current Lido position with a verified deposit and balance history', () => {
  const start = new Date(Date.parse(cutoff) - 90 * 86_400_000).toISOString();
  const positions = extractStakingPositions({
    wallet,
    cutoff,
    balances: [{ tokenAddress: '0xsteth', symbol: 'stETH', amount: 2, priceUsd: 2500, valueUsd: 5000 }],
    historical: [{ timestamp: start, tokenAddress: '0xsteth', symbol: 'stETH', amount: 1, valueUsd: 2400 }],
    transactions: [transaction({
      protocol: 'Lido', method: 'submit(address)', timestamp: '2026-09-01T12:00:00.000Z',
    })],
    positions: [{ protocolId: 'lido', totalValueUsd: 5000, positionTypes: ['staking'] }],
  });
  assert.equal(positions[0].active, true);
  assert.equal(positions[0].verifiedDepositAt, '2026-09-01T12:00:00.000Z');
  assert.equal(positions[0].continuousSince, start);
});
