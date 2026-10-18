import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWalletAnalysis } from './wallet-provider';

void test('combines Etherscan history with Arkham swaps for active-trader classification', async (t) => {
  const wallet = '0x1111111111111111111111111111111111111111';
  const other = '0x2222222222222222222222222222222222222222';
  const hashes = Array.from({ length: 10 }, (_, index) =>
    `0x${(index + 1).toString(16).padStart(64, '0')}`);
  const times = hashes.map((_, index) =>
    new Date(Date.now() - (index % 5 + 1) * 86_400_000).toISOString());
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname === 'api.etherscan.io') {
      const action = url.searchParams.get('action');
      if (action === 'txlist') return Response.json({ status: '1', message: 'OK', result:
        hashes.map((hash, index) => ({
          hash, timeStamp: String(Math.floor(Date.parse(times[index]) / 1000)),
          from: wallet, to: other, value: '0', input: '0x1234',
          methodId: '0x1234', functionName: 'swap()', isError: '0',
          txreceipt_status: '1',
        })),
      });
      if (action === 'tokentx')
        return Response.json({ status: '0', message: 'No transactions found', result: [] });
    }
    if (url.pathname.endsWith(`/balances/address/${wallet}`))
      return Response.json({ balances: { ethereum: [{
        id: 'ethereum', name: 'Ether', symbol: 'ETH', balance: 2,
        usd: 5_000, price: 2_500,
      }] } });
    if (url.pathname.endsWith(`/counterparties/address/${wallet}`))
      return Response.json({ ethereum: [{
        address: { address: other, predictedEntity: { name: 'Example' } },
        usd: 9_999, transactionCount: 999, flow: 'out',
      }] });
    if (url.pathname.endsWith(`/loans/address/${wallet}`))
      return Response.json({ balances: { ethereum: [] } });
    if (url.pathname.endsWith('/transfers'))
      return Response.json({ transfers: hashes.map((hash, index) => ({
        id: `${hash}:0`, transactionHash: hash,
        fromAddress: { address: wallet }, toAddress: { address: other },
        tokenAddress: `0x${(index + 100).toString(16).padStart(40, '0')}`,
        tokenName: 'Token', tokenSymbol: `T${index}`, tokenDecimals: 18,
        unitValue: 1, historicalUSD: 10, blockTimestamp: times[index],
        chain: 'ethereum',
      })), count: hashes.length });
    if (url.pathname.endsWith('/swaps'))
      return Response.json({ swaps: hashes.map((hash, index) => ({
        id: `${hash}:0`, blockTimestamp: times[index], valid: true,
        sender: { address: wallet }, receiver: { address: other },
        token0: `0x${(index + 100).toString(16).padStart(40, '0')}`,
        token1: `0x${(index + 200).toString(16).padStart(40, '0')}`,
      })), count: hashes.length });
    throw new Error(`Unexpected Arkham test request: ${url.pathname}`);
  });

  const record = await createWalletAnalysis(wallet, 90, {
    etherscanKey: 'etherscan-key',
    arkhamKey: 'arkham-key',
    arkhamBaseUrl: 'https://api.arkm.test',
  });
  assert.equal(record.source, 'etherscan');
  assert.deepEqual(record.sources, ['etherscan', 'arkham']);
  assert.equal(record.data.totalBalance, 5_000);
  assert.equal(record.data.transactions.length, 10);
  assert.equal(record.data.flows[0].label, 'Example');
  assert.equal(record.data.flows[0].outgoing, 100);
  assert.equal(record.data.flows[0].interactionCount, 10);
  assert.equal(record.data.incoming, 0);
  assert.equal(record.data.outgoing, 100);
  assert.equal(record.primaryProfile, 'Active trader');
  const active = record.profiles.find((profile) => profile.name === 'Active trader');
  assert.equal(active?.status, 'ASSIGNED');
  assert.equal(active?.variables.dex_transactions, 10);
});
