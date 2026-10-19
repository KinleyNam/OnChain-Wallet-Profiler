import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWalletAnalysis } from './wallet-provider';

void test('verified recent sends override a contradictory dormant assignment from another provider', async (t) => {
  const address = '0x1111111111111111111111111111111111111111';
  const other = '0x2222222222222222222222222222222222222222';
  const recent = new Date(Date.now() - 86_400_000).toISOString();
  const old = String(Math.floor((Date.now() - 400 * 86_400_000) / 1000));
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === 'https://rpc.example') {
      if (typeof init?.body !== 'string') throw new Error('Expected receipt request.');
      const requests = JSON.parse(init.body) as Array<{ id: number; params: string[] }>;
      return Response.json(requests.map((request) => ({
        id: request.id,
        result: { transactionHash: request.params[0], from: address, to: other, status: '0x1' },
      })));
    }
    if (url.startsWith('https://api.etherscan.io/')) {
      const action = new URL(url).searchParams.get('action');
      if (action === 'txlist') return Response.json({
        status: '1', message: 'OK',
        result: [{
          hash: '0xold', timeStamp: old, from: address, to: other,
          value: '0', isError: '0', txreceipt_status: '1',
        }],
      });
      return Response.json({ status: '0', message: 'No transactions found', result: [] });
    }
    if (url.endsWith('/transactions')) return Response.json({
      data: [{
        transaction_hash: '0xrecent', block_timestamp: recent,
        method: 'transfer', source_type: 'transfer', volume_usd: 1,
        tokens_sent: [], tokens_received: [],
      }],
      pagination: { is_last_page: true },
    });
    if (url.endsWith('/defi-holdings')) return Response.json({ protocols: [] });
    if (url.endsWith('/pnl-summary')) return Response.json({});
    return Response.json({ data: [], pagination: { is_last_page: true } });
  });

  const record = await createWalletAnalysis(address, 30, {
    nansenKey: 'nansen-key', etherscanKey: 'etherscan-key',
    ethereumRpcUrl: 'https://rpc.example',
  });
  const dormant = record.profiles.find((profile) => profile.name === 'Dormant or new wallet');
  assert.deepEqual(record.sources, ['nansen', 'alchemy', 'etherscan']);
  assert.equal(dormant?.status, 'NOT_ASSIGNED');
  assert.equal(dormant?.reason, undefined);
  assert.equal(dormant?.variables.transactions_90d, 1);
  assert.notEqual(record.primaryProfile, 'Dormant or new wallet');
});

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
    assert.deepEqual(record.sources, ['etherscan']);
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
