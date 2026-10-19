import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNansenAnalysis, MAX_NANSEN_TRANSACTIONS, normalizeNansen } from './nansen';

void test('retrieves a 180-day transaction history in non-overlapping windows after an upstream 500', async (t) => {
  const address = '0x1111111111111111111111111111111111111111';
  const ranges: Array<{ from: string; to: string }> = [];
  let fullRangeAttempts = 0;
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    if (input.endsWith('/transactions')) {
      const requestBody = init.body;
      if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body.');
      const body = JSON.parse(requestBody) as {
        date: { from: string; to: string };
        pagination: { page: number };
      };
      assert.equal(body.pagination.page, 1);
      const days = Math.round((Date.parse(body.date.to) - Date.parse(body.date.from)) / 86_400_000) + 1;
      if (days === 180) {
        fullRangeAttempts++;
        return new Response('', { status: 500 });
      }
      ranges.push(body.date);
      return Response.json({
        data: [{
          transaction_hash: `0x${ranges.length}`,
          block_timestamp: `${body.date.from}T12:00:00Z`,
          method: 'transfer', source_type: 'transfer', volume_usd: 1,
          tokens_sent: [], tokens_received: [],
        }],
        pagination: { is_last_page: true },
      });
    }
    if (input.endsWith('/defi-holdings')) return Response.json({ protocols: [] });
    if (input.endsWith('/pnl-summary')) return Response.json({});
    return Response.json({ data: [], pagination: { is_last_page: true } });
  });

  const record = await createNansenAnalysis(address, 180, 'test-key');
  assert.equal(fullRangeAttempts, 2);
  assert.equal(ranges.length, 6);
  for (let i = 0; i < ranges.length; i++) {
    const days = Math.round((Date.parse(ranges[i].to) - Date.parse(ranges[i].from)) / 86_400_000) + 1;
    assert.equal(days, 30);
    if (i > 0) assert.equal(Date.parse(ranges[i - 1].from) - Date.parse(ranges[i].to), 86_400_000);
  }
  assert.equal(record.data.transactions.length, 6);
  assert.equal(record.data.transactionCoverage?.complete, true);
});

for (const lastPageComplete of [false, true]) {
  void test(`retains 100,000 transactions with complete=${lastPageComplete} at the page limit`, async (t) => {
    let pages = 0;
    const timestamp = new Date(Date.now() - 86_400_000).toISOString();
    const tradeTime = (i: number) => new Date(Date.parse(timestamp) - (i % 5) * 86_400_000).toISOString();
    t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
      if (input === 'https://rpc.example') {
        if (typeof init.body !== 'string') throw new Error('Expected JSON request body.');
        const requests = JSON.parse(init.body) as Array<{ id: number; params: string[] }>;
        return Response.json(requests.map((request) => ({ id: request.id, result: {
          transactionHash: request.params[0], from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222', status: '0x1',
        } })));
      }
      if (input.endsWith('/dex-trades')) return Response.json({
        data: Array.from({ length: 10 }, (_, i) => ({
          transaction_hash: `0x1-${i}`, block_timestamp: tradeTime(i),
          trader_address: '0x1111111111111111111111111111111111111111',
          token_bought_address: `0xtoken${i}`, token_sold_address: '0xeth',
        })), pagination: { is_last_page: true },
      });
      if (input.endsWith('/transactions')) {
        if (typeof init.body !== 'string') throw new Error('Expected JSON request body.');
        const body = JSON.parse(init.body) as { pagination: { page: number } };
        pages++;
        const page = body.pagination.page;
        assert.ok(page <= MAX_NANSEN_TRANSACTIONS / 100);
        return Response.json({
          data: Array.from({ length: 100 }, (_, i) => ({
            transaction_hash: `0x${page}-${i}`, block_timestamp: tradeTime(i),
            method: 'transfer', source_type: 'transfer', volume_usd: 1,
            tokens_sent: [], tokens_received: [],
          })),
          pagination: { is_last_page: lastPageComplete && page === MAX_NANSEN_TRANSACTIONS / 100 },
        });
      }
      if (input.endsWith('/pnl-summary')) return Response.json({ traded_times: 7 });
      if (input.endsWith('/defi-holdings')) return Response.json({ protocols: [] });
      return Response.json({ data: [], pagination: { is_last_page: true } });
    });
    const record = await createNansenAnalysis('0x1111111111111111111111111111111111111111', 30, 'test-key', 'https://rpc.example');
    assert.equal(pages, MAX_NANSEN_TRANSACTIONS / 100);
    assert.equal(record.status, 'complete');
    assert.equal(record.source, 'nansen');
    assert.equal(record.data.transactions.length, MAX_NANSEN_TRANSACTIONS);
    assert.deepEqual(record.data.transactionCoverage, {
      complete: lastPageComplete,
      limit: MAX_NANSEN_TRANSACTIONS,
      fetched: MAX_NANSEN_TRANSACTIONS,
    });
    assert.equal(record.data.tradePerformance?.tradedTimes, 7);
    assert.equal(record.data.enrichmentCoverage.defiPositions, true);
    const trader = record.profiles.find((profile) => profile.name === 'Active trader')!;
    assert.equal(trader.status, 'ASSIGNED');
    assert.equal(trader.score, 70);
    assert.equal(trader.dataCoverage, lastPageComplete ? 'complete' : 'incomplete');
    assert.equal(record.primaryProfile, 'Active trader');
  });
}

void test('normalizes live balance and transfer fields without creating protocol activity', () => {
  const address = '0x1111111111111111111111111111111111111111';
  const other = '0x2222222222222222222222222222222222222222';
  const wallet = normalizeNansen(
    address,
    30,
    '2026-09-22T12:00:00Z',
    [
      {
        token_address: '0x0',
        token_symbol: 'ETH',
        token_name: 'Ether',
        token_amount: '2',
        price_usd: '2500',
        value_usd: '5000',
      },
    ],
    [
      {
        transaction_hash: '0xabc',
        block_timestamp: '2026-09-21T09:00:00Z',
        method: 'transfer',
        source_type: 'transfer',
        volume_usd: '25',
        tokens_sent: [],
        tokens_received: [
          {
            token_symbol: 'USDC',
            token_amount: '25',
            value_usd: '25',
            from_address: other,
            to_address: address,
          },
        ],
      },
    ],
  );
  assert.equal(wallet.totalBalance, 5000);
  assert.equal(wallet.holdings[0].symbol, 'ETH');
  assert.equal(wallet.movements[0].direction, 'in');
  assert.equal(wallet.incoming, 25);
  assert.equal(wallet.flows[0].name, other);
  assert.equal(
    wallet.protocols.find((item) => item.name === 'Uniswap')?.count,
    0,
  );
  assert.equal(
    wallet.protocols.find((item) => item.name === 'No protocol')?.count,
    1,
  );
  assert.equal(
    wallet.daily.reduce((sum, item) => sum + item, 0),
    1,
  );
});

void test('includes transactions earlier today in the selected UTC date window', () => {
  const address = '0x1111111111111111111111111111111111111111';
  const wallet = normalizeNansen(
    address,
    30,
    '2026-09-22T12:00:00Z',
    [],
    [
      {
        transaction_hash: '0xtoday',
        block_timestamp: '2026-09-22T08:00:00Z',
        method: 'transfer',
        source_type: 'transfer',
        volume_usd: '1',
        tokens_sent: [],
        tokens_received: [],
      },
    ],
  );
  assert.equal(wallet.start, '2026-08-24T00:00:00.000Z');
  assert.equal(wallet.transactions.length, 1);
  assert.equal(wallet.daily.at(-1), 1);
});

void test('attributes protocols from verified destinations and Nansen labels', () => {
  const address = '0x1111111111111111111111111111111111111111';
  const timestamp = '2026-09-21T09:00:00Z';
  const rows = [
    {
      transaction_hash: '0xrouter', block_timestamp: timestamp,
      method: 'execute', source_type: 'transfer', volume_usd: '10',
      tokens_sent: [], tokens_received: [],
    },
    {
      transaction_hash: '0xlabel', block_timestamp: timestamp,
      method: 'fulfill', source_type: 'transfer', volume_usd: '20',
      tokens_sent: [{
        token_symbol: 'ETH', token_amount: '0.01', value_usd: '20',
        from_address: address,
        to_address: '0x2222222222222222222222222222222222222222',
        to_address_label: 'OpenSea: Seaport',
      }],
      tokens_received: [],
    },
  ];
  const wallet = normalizeNansen(address, 30, '2026-09-22T12:00:00Z', [], rows, {
    receipts: [{
      hash: '0xrouter', fromAddress: address,
      toAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      successful: true,
    }],
  });
  assert.equal(wallet.transactions.find((item) => item.hash === '0xrouter')?.protocol, 'Uniswap');
  assert.equal(wallet.transactions.find((item) => item.hash === '0xlabel')?.protocol, 'OpenSea');
});

void test('live provider does not turn unverified Nansen activity into a profile score', async () => {
  const originalFetch = globalThis.fetch;
  const address = '0x1111111111111111111111111111111111111111';
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    if (url === 'https://rpc.example') {
      const requestBody = init?.body;
      if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body.');
      const requests = JSON.parse(requestBody) as Array<{ id: number; params: string[] }>;
      return new Response(JSON.stringify(requests.map((request) => ({
        id: request.id,
        result: {
          transactionHash: request.params[0],
          from: address,
          to: '0x2222222222222222222222222222222222222222',
          status: '0x1',
        },
      }))), { status: 200 });
    }
    if (url.endsWith('/pnl-summary')) return new Response(JSON.stringify({
      traded_token_count: 3, traded_times: 12, realized_pnl_usd: 40,
      realized_pnl_percent: 8, win_rate: 60,
    }), { status: 200 });
    if (url.endsWith('/defi-holdings')) return new Response(JSON.stringify({
      protocols: [{
        protocol_name: 'aave-v3-ethereum', chain: 'ethereum',
        total_value_usd: 200, total_assets_usd: 250,
        total_debts_usd: 50, total_rewards_usd: 1,
        tokens: [{ position_type: 'lending' }],
      }],
    }), { status: 200 });
    if (url.endsWith('/profiler/dex-trades')) return new Response(JSON.stringify({
      data: [{
        block_timestamp: new Date(Date.now() - 86_400_000).toISOString(),
        transaction_hash: '0xabc', trader_address: address,
        token_bought_address: '0x3333333333333333333333333333333333333333',
        token_sold_address: '0x4444444444444444444444444444444444444444',
      }], pagination: { is_last_page: true },
    }), { status: 200 });
    const data = url.endsWith('/current-balance') ? [
          {
            token_address: '0x0',
            token_symbol: 'ETH',
            token_name: 'Ether',
            token_amount: '1',
            price_usd: '2500',
            value_usd: '2500',
          },
        ] : url.endsWith('/historical-balances') ? [{
          block_timestamp: new Date(Date.now() - 86_400_000).toISOString(),
          token_address: '0x0', token_symbol: 'ETH', token_amount: 1,
          value_usd: 2500,
        }] : url.endsWith('/counterparties') ? [{
          counterparty_address: '0x2222222222222222222222222222222222222222',
          counterparty_address_label: ['Example'], interaction_count: 2,
          volume_in_usd: 20, volume_out_usd: 10,
        }] : [
          {
            transaction_hash: '0xabc',
            block_timestamp: new Date(Date.now() - 86_400_000).toISOString(),
            method: 'swap',
            source_type: 'uniswap',
            volume_usd: '100',
            tokens_sent: [],
            tokens_received: [],
          },
        ];
    return new Response(
      JSON.stringify({ data, pagination: { is_last_page: true } }),
      { status: 200 },
    );
  };
  try {
    const record = await createNansenAnalysis(address, 30, 'test-key', 'https://rpc.example');
    assert.equal(calls.length, 8);
    assert.deepEqual(record.sources, ['nansen', 'alchemy']);
    assert.equal(record.data.transactions.length, 1);
    assert.equal(record.data.transactions[0].successful, true);
    assert.equal(record.data.transactions[0].fromAddress, address);
    assert.equal(record.data.historicalBalances.length, 1);
    assert.equal(record.data.flows[0].label, 'Example');
    assert.equal(record.data.incoming, 20);
    assert.equal(record.data.outgoing, 10);
    assert.equal(record.data.volume, 30);
    assert.equal(record.data.tradePerformance?.tradedTimes, 12);
    assert.equal(record.data.defiPositions[0].protocol, 'aave-v3-ethereum');
    assert.equal(record.primaryProfile, 'Not enough data to classify');
    const activeTrader = record.profiles.find((item) => item.name === 'Active trader');
    assert.equal(activeTrader?.status, 'NOT_ASSIGNED');
    assert.equal(activeTrader?.variables.dex_transactions, 1);
    assert.equal(
      record.profiles.find((item) => item.name === 'DeFi participant')?.status,
      'NOT_ASSIGNED',
    );
    assert.ok(record.profiles.filter(
      (item) => !['Active trader', 'DeFi participant'].includes(item.name),
    ).every((item) => item.status === 'NOT_ASSESSED' && item.score === null));
    assert.equal(record.mappingVersion, 'mappings-v10');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('retrieves transactions beyond the former 1,000-record limit', async () => {
  const originalFetch = globalThis.fetch;
  const address = '0x1111111111111111111111111111111111111111';
  let transactionPages = 0;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const requestBody = init?.body;
    if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body.');
    const body = JSON.parse(requestBody) as { pagination: { page: number; per_page: number } };
    if (url.endsWith('/current-balance')) {
      assert.equal(body.pagination.per_page, 1000);
      return new Response(JSON.stringify({ data: [], pagination: { is_last_page: true } }), { status: 200 });
    }
    if (url.endsWith('/historical-balances') || url.endsWith('/counterparties')) {
      assert.equal(body.pagination.per_page, 1000);
      return new Response(JSON.stringify({ data: [], pagination: { is_last_page: true } }), { status: 200 });
    }
    if (url.endsWith('/pnl-summary')) {
      return new Response(JSON.stringify({ traded_token_count: 0, traded_times: 0, realized_pnl_usd: 0, realized_pnl_percent: 0, win_rate: 0 }), { status: 200 });
    }
    if (url.endsWith('/defi-holdings')) {
      return new Response(JSON.stringify({ protocols: [] }), { status: 200 });
    }
    if (url.endsWith('/profiler/dex-trades')) {
      assert.equal(body.pagination.per_page, 1000);
      return new Response(JSON.stringify({ data: [], pagination: { is_last_page: true } }), { status: 200 });
    }
    assert.equal(body.pagination.per_page, 100);
    transactionPages++;
    const start = (body.pagination.page - 1) * 100;
    const data = Array.from({ length: body.pagination.page === 11 ? 1 : 100 }, (_, i) => ({
      transaction_hash: `0x${(start + i).toString(16)}`,
      block_timestamp: new Date(Date.now() - 86_400_000).toISOString(),
      method: 'transfer',
      source_type: 'transfer',
      volume_usd: '1',
      tokens_sent: [],
      tokens_received: [],
    }));
    return new Response(JSON.stringify({ data, pagination: { is_last_page: body.pagination.page === 11 } }), { status: 200 });
  };
  try {
    const record = await createNansenAnalysis(address, 30, 'test-key');
    assert.equal(transactionPages, 11);
    assert.deepEqual(record.sources, ['nansen']);
    assert.equal(record.data.transactions.length, 1001);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('feeds historical retention and verified Lido evidence into profile rules', async (t) => {
  const address = '0x1111111111111111111111111111111111111111';
  const transactionTime = new Date(Date.now() - 20 * 86_400_000).toISOString();
  const boundaryTime = new Date(Date.now() - 90 * 86_400_000).toISOString();
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === 'https://rpc.example') {
      const requestBody = init?.body;
      if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body.');
      const requests = JSON.parse(requestBody) as Array<{ id: number; params: string[] }>;
      return Response.json(requests.map((request) => ({
        id: request.id,
        result: {
          transactionHash: request.params[0],
          from: address,
          to: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
          status: '0x1',
        },
      })));
    }
    if (url.endsWith('/current-balance')) return Response.json({
      data: [{
        token_address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
        token_symbol: 'stETH', token_name: 'Lido Staked ETH',
        token_amount: 1, price_usd: 2500, value_usd: 2500,
      }],
      pagination: { is_last_page: true },
    });
    if (url.endsWith('/historical-balances')) return Response.json({
      data: [{
        block_timestamp: boundaryTime,
        token_address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
        token_symbol: 'stETH', token_amount: 1, value_usd: 2400,
      }],
      pagination: { is_last_page: true },
    });
    if (url.endsWith('/transactions')) return Response.json({
      data: [{
        transaction_hash: '0xstake', block_timestamp: transactionTime,
        method: 'submit(address)', source_type: 'lido', volume_usd: 2500,
        tokens_sent: [], tokens_received: [],
      }],
      pagination: { is_last_page: true },
    });
    if (url.endsWith('/defi-holdings')) return Response.json({
      protocols: [{
        protocol_name: 'lido', chain: 'ethereum', total_value_usd: 2500,
        total_assets_usd: 2500, total_debts_usd: 0, total_rewards_usd: 0,
        tokens: [{ position_type: 'staking' }],
      }],
    });
    if (url.endsWith('/pnl-summary')) return Response.json({});
    return Response.json({ data: [], pagination: { is_last_page: true } });
  });

  const record = await createNansenAnalysis(address, 90, 'key', 'https://rpc.example');
  assert.equal(
    record.profiles.find((profile) => profile.name === 'Long-term holder')?.status,
    'ASSIGNED',
  );
  assert.equal(
    record.profiles.find((profile) => profile.name === 'Staking participant')?.status,
    'ASSIGNED',
  );
});
