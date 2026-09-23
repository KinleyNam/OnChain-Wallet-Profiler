import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchVerifiedReceipts, MAX_RECEIPTS_PER_ANALYSIS } from './alchemy';

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
    /limited to 1,000/,
  );
});
