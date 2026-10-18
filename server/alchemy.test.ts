import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fetchEthereumAddressType,
  fetchVerifiedReceipts,
  MAX_RECEIPTS_PER_ANALYSIS,
} from './alchemy';

void test('identifies externally owned accounts and smart contracts from bytecode', async () => {
  const originalFetch = globalThis.fetch;
  const results = ['0x', '0x6080604052'];
  globalThis.fetch = async (_input, init) => {
    const requestBody = init?.body;
    if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body.');
    const request = JSON.parse(requestBody) as { method: string };
    assert.equal(request.method, 'eth_getCode');
    return Response.json({ jsonrpc: '2.0', id: 1, result: results.shift() });
  };
  try {
    assert.equal(
      await fetchEthereumAddressType(
        'https://example.invalid',
        '0x1111111111111111111111111111111111111111',
      ),
      'externally-owned-account',
    );
    assert.equal(
      await fetchEthereumAddressType(
        'https://example.invalid',
        '0x2222222222222222222222222222222222222222',
      ),
      'smart-contract',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('normalizes batched Ethereum transaction receipts', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const requestBody = init?.body;
    if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body.');
    const requests = JSON.parse(requestBody) as Array<{ id: number; params: string[] }>;
    return new Response(JSON.stringify(requests.reverse().map((request) => ({
      id: request.id,
      result: {
        transactionHash: request.params[0],
        from: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        to: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        status: request.id === 0 ? '0x1' : '0x0',
      },
    }))), { status: 200 });
  };
  try {
    const receipts = await fetchVerifiedReceipts('https://example.invalid', ['0xABC', '0xDEF']);
    assert.deepEqual(receipts.map((item) => item.hash), ['0xabc', '0xdef']);
    assert.equal(receipts[0].successful, true);
    assert.equal(receipts[1].successful, false);
    assert.equal(receipts[0].fromAddress, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('rejects receipt sets above the per-analysis verification limit', async () => {
  await assert.rejects(
    fetchVerifiedReceipts(
      'https://example.invalid',
      Array.from({ length: MAX_RECEIPTS_PER_ANALYSIS + 1 }, (_, index) => `0x${index}`),
    ),
    /limited to 100,000/,
  );
});

void test('retries only receipts rejected by provider capacity limits', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    const requestBody = init?.body;
    if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body.');
    const requests = JSON.parse(requestBody) as Array<{
      id: number;
      params: string[];
    }>;
    return Response.json(
      requests.map((request, index) =>
        calls === 1 && index === 1
          ? {
              id: request.id,
              error: {
                code: -32005,
                message: 'Your app has exceeded its compute units per second capacity.',
              },
            }
          : {
              id: request.id,
              result: {
                transactionHash: request.params[0],
                from: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                to: null,
                status: '0x1',
              },
            },
      ),
    );
  };
  try {
    const receipts = await fetchVerifiedReceipts(
      'https://example.invalid',
      ['0xABC', '0xDEF'],
      0,
    );
    assert.equal(calls, 2);
    assert.deepEqual(
      receipts.map((receipt) => receipt.hash),
      ['0xabc', '0xdef'],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
