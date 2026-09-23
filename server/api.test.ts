import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createApi } from './api';
import type { AnalysisRecord } from './analysis';
import { analysisIdFor } from './analysis';
import { classify } from './classification';
import {
  CLASSIFICATION_RULE_VERSION,
  MAPPING_VERSION,
} from './classification-rules';
import { normalizeNansen } from './nansen';
import type { AnalysisStore } from './store';
import { decodeAnalysis, encodeAnalysis } from './store';

const records = new Map<string, AnalysisRecord>();
const store: AnalysisStore = {
  async get(id) {
    return records.get(id) ?? null;
  },
  async put(record) {
    records.set(record.analysisId, record);
  },
  async ping() {
    return true;
  },
  async close() {},
};
const app = createApi(store, undefined, {
  idFor: analysisIdFor,
  async create(address, periodDays) {
    const generatedAt = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const data = normalizeNansen(
      address,
      periodDays,
      generatedAt,
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
          block_timestamp: yesterday,
          method: 'OpenSea trade',
          source_type: 'opensea',
          volume_usd: '25',
          tokens_sent: [
            {
              token_symbol: 'ETH',
              token_amount: '0.01',
              value_usd: '25',
              from_address: address,
              to_address: '0x2222222222222222222222222222222222222222',
            },
          ],
          tokens_received: [],
        },
      ],
    );
    return {
      analysisId: analysisIdFor(address, periodDays),
      address: address.toLowerCase(),
      network: 'ethereum-mainnet',
      periodDays,
      status: 'complete',
      source: 'nansen',
      generatedAt,
      analysisCutoff: generatedAt,
      providerDataCutoff: null,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      ruleVersion: CLASSIFICATION_RULE_VERSION,
      mappingVersion: MAPPING_VERSION,
      data,
      profiles: classify({ cutoff: generatedAt }),
      primaryProfile: 'Not enough data to classify',
    };
  },
});
after(async () => app.close());

const address = '0x7F00000000000000000000000000000000000004';

void test('compresses stored analysis without changing the result', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/analyses',
    payload: { address, periodDays: 180 },
  });
  const record = records.get(response.json().analysisId)!;
  const encoded = encodeAnalysis(record);
  assert.ok(encoded.length < JSON.stringify(record).length);
  assert.deepEqual(decodeAnalysis(encoded), record);
});

void test('rejects invalid addresses and periods', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/analyses',
    payload: { address: 'invalid', periodDays: 14 },
  });
  assert.equal(response.statusCode, 400);
});

void test('reports a safe reason for provider failures', async () => {
  const failing = createApi(store, undefined, {
    idFor: () => '00000000000000000000000000000000',
    async create() {
      throw new Error('Nansen transactions request failed (429).');
    },
  });
  try {
    const response = await failing.inject({
      method: 'POST',
      url: '/api/v1/analyses',
      payload: { address, periodDays: 90 },
    });
    assert.equal(response.statusCode, 503);
    assert.match(response.json().error, /rate limit or API quota/i);
  } finally {
    await failing.close();
  }
});

void test('creates and reuses an analysis with consistent resource totals', async () => {
  const request = {
    method: 'POST' as const,
    url: '/api/v1/analyses',
    payload: { address, periodDays: 30 },
  };
  const first = await app.inject(request);
  assert.equal(first.statusCode, 201);
  const created = first.json();
  assert.equal(created.source, 'nansen');
  assert.equal(created.reused, false);

  const second = await app.inject(request);
  assert.equal(second.statusCode, 200);
  assert.equal(second.json().analysisId, created.analysisId);
  assert.equal(second.json().reused, true);

  const base = `/api/v1/analyses/${created.analysisId}`;
  const [
    data,
    balances,
    historicalBalances,
    tradePerformance,
    defiPositions,
    flows,
    transactions,
    protocols,
    profiles,
    evidence,
    indicators,
    exported,
  ] = await Promise.all([
    app.inject({ method: 'GET', url: `${base}/data` }),
    app.inject({ method: 'GET', url: `${base}/balances` }),
    app.inject({ method: 'GET', url: `${base}/historical-balances` }),
    app.inject({ method: 'GET', url: `${base}/trade-performance` }),
    app.inject({ method: 'GET', url: `${base}/defi-positions` }),
    app.inject({ method: 'GET', url: `${base}/fund-flows` }),
    app.inject({
      method: 'GET',
      url: `${base}/transactions?limit=10&offset=0`,
    }),
    app.inject({ method: 'GET', url: `${base}/protocols` }),
    app.inject({ method: 'GET', url: `${base}/profiles` }),
    app.inject({ method: 'GET', url: `${base}/profile-evidence` }),
    app.inject({ method: 'GET', url: `${base}/risk-indicators` }),
    app.inject({ method: 'GET', url: `${base}/export` }),
  ]);
  for (const response of [
    data,
    balances,
    historicalBalances,
    tradePerformance,
    defiPositions,
    flows,
    transactions,
    protocols,
    profiles,
    evidence,
    indicators,
    exported,
  ])
    assert.equal(response.statusCode, 200);
  assert.equal(data.json().wallet.address, address.toLowerCase());
  assert.equal(
    balances.json().totalBalanceUSD,
    data.json().wallet.totalBalance,
  );
  assert.equal(flows.json().incomingUSD, data.json().wallet.incoming);
  assert.equal(historicalBalances.json().available, false);
  assert.equal(tradePerformance.json().available, false);
  assert.equal(defiPositions.json().available, false);
  assert.equal(
    transactions.json().total,
    data.json().wallet.transactions.length,
  );
  assert.equal(
    transactions.json().items.length,
    Math.min(10, transactions.json().total),
  );
  assert.equal(profiles.json().items.length, 6);
  assert.ok(
    profiles
      .json()
      .items.every(
        (item: { status: string; score: number | null }) =>
          item.status === 'NOT_ASSESSED' && item.score === null,
      ),
  );
  assert.equal(evidence.json().ruleVersion, CLASSIFICATION_RULE_VERSION);
  assert.equal(evidence.json().mappingVersion, MAPPING_VERSION);
  assert.equal(indicators.json().signals.length, 6);
  assert.equal(exported.json().riskIndicators.signals.length, 6);
  assert.equal(exported.json().source, 'nansen');
  assert.ok(
    protocols
      .json()
      .items.some((item: { name: string }) => item.name === 'OpenSea'),
  );

  const nftTransactions = await app.inject({
    method: 'GET',
    url: `${base}/protocols/openSea/transactions?limit=10`,
  });
  assert.equal(nftTransactions.statusCode, 200);
  assert.ok(
    nftTransactions
      .json()
      .items.every((item: { protocol: string }) => item.protocol === 'OpenSea'),
  );
});

void test('rejects invalid pagination and returns 404 for expired analyses', async () => {
  const id = [...records.keys()][0];
  const invalidPage = await app.inject({
    method: 'GET',
    url: `/api/v1/analyses/${id}/transactions?limit=1000`,
  });
  assert.equal(invalidPage.statusCode, 400);
  const missing = await app.inject({
    method: 'GET',
    url: '/api/v1/analyses/00000000000000000000000000000000',
  });
  assert.equal(missing.statusCode, 404);
});
