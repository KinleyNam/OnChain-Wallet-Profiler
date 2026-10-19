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

void test('ordinary permission and rate limit errors do not rotate keys', async (t) => {
  for (const status of [401, 403, 429]) {
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

void test('retries a transient server error with the same key and payload', async (t) => {
  const calls: Array<{ key: string | null; body: unknown }> = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const body = init.body;
    if (typeof body !== 'string') throw new Error('Expected a JSON request body.');
    calls.push({
      key: new Headers(init.headers).get('apikey'),
      body: JSON.parse(body) as unknown,
    });
    return calls.length === 1 ? new Response('', { status: 500 }) : Response.json({ data: [] });
  });
  await new NansenClient(['one', 'two']).request(
    'https://example.test', { pagination: { page: 3 } }, 'transactions',
  );
  assert.deepEqual(calls, [
    { key: 'one', body: { pagination: { page: 3 } } },
    { key: 'one', body: { pagination: { page: 3 } } },
  ]);
});

void test('a persistent server error stops after bounded retries without rotating keys', async (t) => {
  const keys: Array<string | null> = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    keys.push(new Headers(init.headers).get('apikey'));
    return new Response('', { status: 500 });
  });
  await assert.rejects(
    new NansenClient(['one', 'two']).request('https://example.test', {}, 'transactions'),
    /transactions request failed \(500\)/,
  );
  assert.deepEqual(keys, ['one', 'one']);
});

void test('retries a transient timeout with the same Nansen key', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    calls++;
    assert.equal(new Headers(init.headers).get('apikey'), 'one');
    if (calls === 1) throw new Error('The operation was aborted due to timeout');
    return new Response('{}');
  });
  await new NansenClient(['one', 'two']).request(
    'https://example.test',
    {},
    'transactions',
  );
  assert.equal(calls, 2);
});
