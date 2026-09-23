import Fastify, { type FastifyReply } from 'fastify';
import {
  ANALYSIS_TTL_SECONDS,
  ETHEREUM_ADDRESS,
  PERIODS,
  type AnalysisRecord,
} from './analysis';
import type { AnalysisStore } from './store';
import { calculateIndicators } from './indicators';

type IdParams = { analysisId: string };
type ProtocolParams = IdParams & { protocolId: string };
type PageQuery = { limit?: string; offset?: string };

function page(query: PageQuery) {
  const limit = query.limit === undefined ? 50 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isInteger(offset) || offset < 0) return null;
  return { limit, offset };
}

function paginate<T>(items: T[], query: PageQuery) {
  const selected = page(query);
  if (!selected) return null;
  return {
    items: items.slice(selected.offset, selected.offset + selected.limit),
    total: items.length,
    limit: selected.limit,
    offset: selected.offset,
    nextOffset: selected.offset + selected.limit < items.length
      ? selected.offset + selected.limit
      : null,
  };
}

function summary(record: AnalysisRecord) {
  return {
    analysisId: record.analysisId,
    address: record.address,
    network: record.network,
    periodDays: record.periodDays,
    status: record.status,
    source: record.source,
    generatedAt: record.generatedAt,
    analysisCutoff: record.analysisCutoff,
    providerDataCutoff: record.providerDataCutoff,
    expiresAt: record.expiresAt,
    ruleVersion: record.ruleVersion,
    mappingVersion: record.mappingVersion,
    primaryProfile: record.primaryProfile,
    transactionCount: record.data.transactions.length,
    activeDays: record.data.daily.filter((day) => day > 0).length,
    totalBalanceUSD: record.data.totalBalance,
  };
}

export function createApi(store: AnalysisStore, allowedOrigin: string | undefined, provider: {
  idFor: (address: string, periodDays: number) => string;
  create: (address: string, periodDays: number) => Promise<AnalysisRecord>;
}) {
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && allowedOrigin && origin === allowedOrigin) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (request.method === 'OPTIONS') {
      reply.code(origin && allowedOrigin && origin !== allowedOrigin ? 403 : 204).send();
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : 500;
    if (statusCode < 500) {
      reply.code(statusCode).send({ error: error instanceof Error ? error.message : 'Invalid request.' });
      return;
    }
    console.error('API error:', error instanceof Error ? error.message : 'unknown error');
    const message = error instanceof Error ? error.message : '';
    const nansenStatus = /^Nansen (transactions|current-balance) request failed \((\d{3})\)\.$/.exec(message);
    if (nansenStatus) {
      const [, endpoint, status] = nansenStatus;
      const reason = status === '429' ? 'Rate limit or API quota reached.'
        : status === '401' || status === '403' ? 'Check the Nansen API key and its permissions.'
        : 'The data provider could not complete the request.';
      reply.code(503).send({ error: `Nansen ${endpoint} request failed (${status}). ${reason}` });
      return;
    }
    const exceeded = /^Nansen (transactions|current-balance) exceeded the (\d+)-record retrieval limit/.exec(message);
    if (exceeded) {
      const [, endpoint, limit] = exceeded;
      reply.code(503).send({ error: endpoint === 'transactions'
        ? `This wallet has more than ${Number(limit).toLocaleString('en-US')} transactions in the selected period. Choose a shorter analysis period.`
        : `This wallet has more than ${Number(limit).toLocaleString('en-US')} asset balances, which exceeds the current retrieval limit.` });
      return;
    }
    if (/^Nansen (transactions|current-balance) returned an invalid response\.$/.test(message)) {
      reply.code(503).send({ error: 'Nansen returned an unexpected response. Try again later.' });
      return;
    }
    reply.code(503).send({ error: 'Analysis service is temporarily unavailable. Check the API terminal for the cause.' });
  });

  async function getRecord(id: string, reply: FastifyReply) {
    if (!/^[a-f0-9]{32}$/.test(id)) {
      reply.code(400).send({ error: 'Invalid analysis ID.' });
      return null;
    }
    const record = await store.get(id);
    if (!record) reply.code(404).send({ error: 'Analysis not found or expired.' });
    return record;
  }

  app.get('/api/v1/health', async (_request, reply) => {
    const ready = await store.ping();
    if (!ready) reply.code(503);
    return { status: ready ? 'healthy' : 'unavailable', redis: ready ? 'connected' : 'unavailable' };
  });

  app.post('/api/v1/analyses', async (request, reply) => {
    const body = request.body as { address?: unknown; periodDays?: unknown } | null;
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    const periodDays = body?.periodDays;
    if (!ETHEREUM_ADDRESS.test(address) ||
        typeof periodDays !== 'number' ||
        !PERIODS.includes(periodDays as (typeof PERIODS)[number])) {
      reply.code(400);
      return { error: 'Provide an Ethereum address and a periodDays value of 30, 90, or 180.' };
    }
    const id = provider.idFor(address, periodDays);
    const existing = await store.get(id);
    if (existing) return { ...summary(existing), reused: true };
    const record = await provider.create(address, periodDays);
    await store.put(record, ANALYSIS_TTL_SECONDS);
    reply.code(201);
    return { ...summary(record), reused: false };
  });

  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return summary(record);
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/status', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return { analysisId: record.analysisId, status: record.status, generatedAt: record.generatedAt, analysisCutoff: record.analysisCutoff };
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/data', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return { analysis: summary(record), wallet: record.data };
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/balances', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return { asOf: record.data.asOf, holdings: record.data.holdings, totalBalanceUSD: record.data.totalBalance };
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/historical-balances', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return { available: record.data.enrichmentCoverage.historicalBalances, items: record.data.historicalBalances };
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/trade-performance', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return { available: record.data.enrichmentCoverage.tradePerformance, summary: record.data.tradePerformance };
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/defi-positions', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return { available: record.data.enrichmentCoverage.defiPositions, items: record.data.defiPositions };
  });
  app.get<{ Params: IdParams; Querystring: PageQuery }>('/api/v1/analyses/:analysisId/transactions', async (request, reply) => {
    const selected = page(request.query);
    if (!selected) return reply.code(400).send({ error: 'limit must be 1–100 and offset must be nonnegative.' });
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return paginate(record.data.transactions, request.query);
  });
  app.get<{ Params: IdParams; Querystring: PageQuery & { token?: string; direction?: string } }>('/api/v1/analyses/:analysisId/token-movements', async (request, reply) => {
    const selected = page(request.query);
    if (!selected) return reply.code(400).send({ error: 'limit must be 1–100 and offset must be nonnegative.' });
    if (request.query.direction && !['in', 'out'].includes(request.query.direction)) return reply.code(400).send({ error: 'Invalid direction.' });
    const record = await getRecord(request.params.analysisId, reply);
    if (record) {
      const items = record.data.movements.filter((movement) =>
        (!request.query.token || movement.token === request.query.token) &&
        (!request.query.direction || movement.direction === request.query.direction));
      return paginate(items, request.query);
    }
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/fund-flows', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return { incomingUSD: record.data.incoming, outgoingUSD: record.data.outgoing, dedicatedCounterpartiesAvailable: record.data.enrichmentCoverage.counterparties, counterparties: record.data.flows };
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/protocols', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return { items: record.data.protocols };
  });
  app.get<{ Params: ProtocolParams; Querystring: PageQuery }>('/api/v1/analyses/:analysisId/protocols/:protocolId/transactions', async (request, reply) => {
    const selected = page(request.query);
    if (!selected) return reply.code(400).send({ error: 'limit must be 1–100 and offset must be nonnegative.' });
    const record = await getRecord(request.params.analysisId, reply);
    if (!record) return;
    const protocol = record.data.protocols.find((item) =>
      item.name.toLowerCase().replace(/\s+/g, '-') === request.params.protocolId.toLowerCase());
    if (!protocol) return reply.code(404).send({ error: 'Protocol not found.' });
    return { protocol: protocol.name, ...paginate(record.data.transactions.filter((transaction) => transaction.protocol === protocol.name), request.query) };
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/profiles', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return { primaryProfile: record.primaryProfile, items: record.profiles };
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/profile-evidence', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return { ruleVersion: record.ruleVersion, mappingVersion: record.mappingVersion, analysedAt: record.generatedAt, analysisCutoff: record.analysisCutoff, expiresAt: record.expiresAt, source: record.source, items: record.profiles };
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/risk-indicators', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return calculateIndicators(record.data);
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/retrieval-status', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) return { source: record.source, status: 'retrieved-pages', recordCount: record.data.transactions.length, periodDays: record.periodDays, asOf: record.data.asOf, providerDataCutoff: record.providerDataCutoff };
  });
  app.get<{ Params: IdParams }>('/api/v1/analyses/:analysisId/export', async (request, reply) => {
    const record = await getRecord(request.params.analysisId, reply);
    if (record) {
      reply.header('Content-Disposition', `attachment; filename="wallet-profile-${record.analysisId}.json"`);
      return { ...record, riskIndicators: calculateIndicators(record.data) };
    }
  });

  return app;
}
