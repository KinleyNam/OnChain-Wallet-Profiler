import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NansenClient, nansenKeysFromEnv } from './nansen-client';

void test('loads numbered keys in order and removes blanks and duplicates', () => {
  assert.deepEqual(nansenKeysFromEnv({ NANSEN_API_KEY4: 'four', NANSEN_API_KEY2: 'two',
    NANSEN_API_KEY1: ' one ', NANSEN_API_KEY3: '', NANSEN_API_KEY: 'one' }), ['one', 'two', 'four']);
});

void test('retries the same request across four keys and remembers exhausted keys', async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const key = new Headers(init.headers).get('apikey')!;
    calls.push(key);
    assert.equal(init.body, JSON.stringify({ pagination: { page: 2 } }));
    return key === 'four' ? new Response('{}') :
      new Response('{"error":"insufficient_credits"}', { status: key === 'one' ? 402 : 403 });
  });
  const client = new NansenClient(['one', 'two', 'three', 'four']);
  await client.request('https://example.test', { pagination: { page: 2 } }, 'transactions');
  await client.request('https://example.test', { pagination: { page: 2 } }, 'enrichment');
  assert.deepEqual(calls, ['one', 'two', 'three', 'four', 'four']);
});

void test('all exhausted keys stop retrying and become eligible after cooldown', async (t) => {
  let calls = 0;
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response('', { status: 402 });
  });
  const client = new NansenClient(['one', 'two', 'three', 'four']);
  for (let i = 0; i < 2; i++) await assert.rejects(client.request('https://example.test', {}, 'transactions'), /all configured API keys/);
  assert.equal(calls, 4);
  now += 300_001;
  await assert.rejects(client.request('https://example.test', {}, 'transactions'), /all configured API keys/);
  assert.equal(calls, 8);
});

void test('ordinary permission, rate limit, and server errors do not rotate keys', async (t) => {
  for (const status of [401, 403, 429, 500]) {
    let calls = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return new Response('{"error":"request denied"}', { status });
    });
    await assert.rejects(new NansenClient(['one', 'two']).request('https://example.test', {}, 'transactions'), new RegExp(String(status)));
    assert.equal(calls, 1);
    mock.mock.restore();
  }
});
