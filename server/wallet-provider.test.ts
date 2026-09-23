import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWalletAnalysis } from './wallet-provider';

void test('falls back to Etherscan when Nansen credits are unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const address = '0x1111111111111111111111111111111111111111';
  const other = '0x2222222222222222222222222222222222222222';
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
    calls.push(url);
    if (url.startsWith('https://api.nansen.ai/'))
      return new Response(JSON.stringify({ error: 'insufficient_credits' }), { status: 403 });
    const parsed = new URL(url);
    const action = parsed.searchParams.get('action');
    if (action === 'txlist') {
      return new Response(JSON.stringify({
        status: '1',
        message: 'OK',
        result: [{
          hash: '0xabc',
          timeStamp: String(Math.floor((Date.now() - 86_400_000) / 1000)),
          from: address,
          to: other,
          value: '1000000000000000000',
          input: '0x',
          isError: '0',
          txreceipt_status: '1',
        }],
      }), { status: 200 });
    }
    if (action === 'tokentx') {
      return new Response(JSON.stringify({
        status: '0',
        message: 'No transactions found',
        result: [],
      }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const record = await createWalletAnalysis(address, 90, {
      nansenKey: 'out-of-credits',
      etherscanKey: 'etherscan-key',
    });
    assert.equal(record.source, 'etherscan');
    assert.equal(record.data.transactions.length, 1);
    assert.equal(record.data.transactions[0].successful, true);
    assert.equal(record.data.movements[0].token, 'ETH');
    assert.ok(calls.some((url) => url.includes('action=txlist')));
    assert.ok(calls.some((url) => url.includes('action=tokentx')));
    const dormant = record.profiles.find((item) => item.name === 'Dormant or new wallet');
    assert.equal(dormant?.status, 'ASSIGNED');
    assert.equal(dormant?.reason, 'new');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
