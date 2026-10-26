import type { AnalysisRecord } from './analysis';
import type { Movement } from '../lib/wallet-data';

// The free Prices API allows 300 requests/hour. Keep each analysis well below that.
const MAX_TOKENS = 12;
const CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 8_000;
const TOKEN_ADDRESS = /^0x[a-f0-9]{40}$/i;

function apiKeyFromRpcUrl(rpcUrl: string) {
  try {
    const url = new URL(rpcUrl);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.g.alchemy.com')) return null;
    return /^\/v2\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function priceKey(movement: Movement) {
  if (movement.token === 'ETH' &&
      (!movement.tokenAddress ||
        /^0x0{40}$/i.test(movement.tokenAddress) ||
        /^0x[eE]{40}$/.test(movement.tokenAddress))) return 'ETH';
  if (movement.tokenAddress && TOKEN_ADDRESS.test(movement.tokenAddress))
    return movement.tokenAddress.toLowerCase();
  return null;
}

type HistoricalPriceResponse = {
  data?: Array<{ timestamp?: string; value?: string }>;
};

async function historicalPrices(apiKey: string, token: string, start: string, end: string) {
  const body = token === 'ETH'
    ? { symbol: 'ETH' }
    : { network: 'eth-mainnet', address: token };
  const response = await fetch(`https://api.g.alchemy.com/prices/v1/${encodeURIComponent(apiKey)}/tokens/historical`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, startTime: start, endTime: end, interval: '1d' }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) return new Map<string, number>();
  const result = await response.json() as HistoricalPriceResponse;
  const prices = new Map<string, number>();
  for (const row of result.data ?? []) {
    const price = Number(row.value);
    if (row.timestamp && Number.isFinite(price) && price > 0)
      prices.set(row.timestamp.slice(0, 10), price);
  }
  return prices;
}

/** Price only unvalued movements; preserve USD values supplied by a provider. */
export async function enrichMovementPrices(record: AnalysisRecord, rpcUrl?: string) {
  const data = record.data;
  const apiKey = rpcUrl ? apiKeyFromRpcUrl(rpcUrl) : null;
  if (apiKey) {
    const frequency = new Map<string, number>();
    for (const movement of data.movements) {
      const key = priceKey(movement);
      if (key && movement.amount > 0 && movement.usdAvailable !== true)
        frequency.set(key, (frequency.get(key) ?? 0) + 1);
    }
    const tokens = [...frequency].sort((a, b) => b[1] - a[1]).map(([key]) => key);
    if (tokens.includes('ETH')) tokens.splice(tokens.indexOf('ETH'), 1);
    if (frequency.has('ETH')) tokens.unshift('ETH');
    const selected = tokens.slice(0, MAX_TOKENS);
    const prices = new Map<string, Map<string, number>>();
    for (let index = 0; index < selected.length; index += CONCURRENCY) {
      await Promise.all(selected.slice(index, index + CONCURRENCY).map(async (token) => {
        try {
          prices.set(token, await historicalPrices(apiKey, token, data.start, data.asOf));
        } catch {
          prices.set(token, new Map());
        }
      }));
    }
    let alchemyPriced = 0;
    for (const movement of data.movements) {
      if (movement.amount === 0) {
        movement.usdAvailable = true;
        continue;
      }
      if (movement.usdAvailable === true) continue;
      const key = priceKey(movement);
      const price = key ? prices.get(key)?.get(movement.timestamp.slice(0, 10)) : undefined;
      if (price !== undefined) {
        movement.usd = movement.amount * price;
        movement.usdAvailable = true;
        movement.usdPriceSource = 'alchemy-daily';
        alchemyPriced++;
      }
    }
    if (alchemyPriced > 0)
      record.sources = [...new Set([...(record.sources ?? [record.source]), 'alchemy' as const])];
  }

  let priced = 0;
  let unpriced = 0;
  for (const movement of data.movements) {
    if (movement.amount <= 0) continue;
    if (movement.usdAvailable) priced++;
    else unpriced++;
  }
  data.usdValuation = unpriced === 0 ? 'complete' : priced === 0 ? 'unavailable' : 'partial';
  for (const transaction of data.transactions) {
    const providerValue = transaction.valueAvailable !== false && transaction.value > 0;
    if (!providerValue)
      transaction.value = transaction.movements.reduce((sum, movement) => sum + movement.usd, 0);
    transaction.valueAvailable = providerValue ||
      (transaction.movements.length > 0 &&
        transaction.movements.every((movement) => movement.usdAvailable === true));
  }
  const movementIncoming = data.movements.filter((movement) => movement.direction === 'in')
    .reduce((sum, movement) => sum + movement.usd, 0);
  const movementOutgoing = data.movements.filter((movement) => movement.direction === 'out')
    .reduce((sum, movement) => sum + movement.usd, 0);
  const flows = new Map<string, { name: string; incoming: number; outgoing: number; source: 'transactions' }>();
  for (const movement of data.movements) {
    if (!movement.counterparty) continue;
    const flow = flows.get(movement.counterparty) ?? {
      name: movement.counterparty, incoming: 0, outgoing: 0, source: 'transactions' as const,
    };
    if (movement.direction === 'in') flow.incoming += movement.usd;
    else flow.outgoing += movement.usd;
    flows.set(movement.counterparty, flow);
  }
  const dedicatedFlows = data.flows.some((flow) => flow.source === 'nansen-counterparties');
  const dedicatedValue = data.flows.reduce((sum, flow) => sum + flow.incoming + flow.outgoing, 0);
  if (!dedicatedFlows || (dedicatedValue === 0 && movementIncoming + movementOutgoing > 0)) {
    data.flows = [...flows.values()];
    data.incoming = movementIncoming;
    data.outgoing = movementOutgoing;
  }
  data.volume = data.incoming + data.outgoing;
  return record;
}
