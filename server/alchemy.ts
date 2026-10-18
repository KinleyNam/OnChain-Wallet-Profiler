const RECEIPT_BATCH_SIZE = 100;
const RECEIPT_RETRY_ATTEMPTS = 6;
const RECEIPT_RETRY_DELAY_MS = 1_000;
export const MAX_RECEIPTS_PER_ANALYSIS = 100_000;

export type EthereumAddressType = 'externally-owned-account' | 'smart-contract';

export type VerifiedReceipt = {
  hash: string;
  fromAddress: string;
  toAddress: string | null;
  successful: boolean;
};

type RpcReceipt = {
  transactionHash: string;
  from: string;
  to: string | null;
  status: string;
};

type RpcResponse = {
  id: number;
  result?: RpcReceipt | null;
  error?: { message?: string };
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function fetchEthereumAddressType(
  rpcUrl: string,
  address: string,
): Promise<EthereumAddressType> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getCode',
      params: [address, 'latest'],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`Ethereum account-type request failed (${response.status}).`);
  const body = (await response.json()) as {
    result?: unknown;
    error?: { message?: string };
  };
  if (body.error)
    throw new Error(
      `Ethereum account-type request failed: ${body.error.message ?? 'unknown RPC error'}.`,
    );
  if (typeof body.result !== 'string')
    throw new Error('Ethereum account-type response was invalid.');
  const code = body.result.toLowerCase();
  return code === '0x' || code === '0x0'
    ? 'externally-owned-account'
    : 'smart-contract';
}

function retryableStatus(status: number) {
  return status === 429 || status >= 500;
}

function retryableRpcError(message = '') {
  return /capacity|compute units|rate limit|too many requests|temporar|timeout|try again/i.test(
    message,
  );
}

export async function fetchVerifiedReceipts(
  rpcUrl: string,
  hashes: string[],
  retryDelayMs = RECEIPT_RETRY_DELAY_MS,
): Promise<VerifiedReceipt[]> {
  const unique = [...new Set(hashes.map((hash) => hash.toLowerCase()))];
  if (unique.length > MAX_RECEIPTS_PER_ANALYSIS) {
    throw new Error(
      `Receipt verification is limited to ${MAX_RECEIPTS_PER_ANALYSIS.toLocaleString('en-US')} transactions per analysis.`,
    );
  }
  const receipts = new Map<string, VerifiedReceipt>();
  for (let start = 0; start < unique.length; start += RECEIPT_BATCH_SIZE) {
    let pending = unique.slice(start, start + RECEIPT_BATCH_SIZE);
    for (let attempt = 0; pending.length && attempt < RECEIPT_RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) await wait(retryDelayMs * 2 ** (attempt - 1));
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          pending.map((hash, index) => ({
            jsonrpc: '2.0',
            id: index,
            method: 'eth_getTransactionReceipt',
            params: [hash],
          })),
        ),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        if (retryableStatus(response.status) && attempt + 1 < RECEIPT_RETRY_ATTEMPTS)
          continue;
        throw new Error(`Ethereum receipt request failed (${response.status}).`);
      }
      const body = (await response.json()) as RpcResponse[];
      if (!Array.isArray(body))
        throw new Error('Ethereum receipt response was invalid.');
      const byId = new Map(body.map((item) => [item.id, item]));
      const retry: string[] = [];
      for (let index = 0; index < pending.length; index++) {
        const hash = pending[index];
        const item = byId.get(index);
        if (item?.result) {
          receipts.set(hash, {
            hash: item.result.transactionHash.toLowerCase(),
            fromAddress: item.result.from.toLowerCase(),
            toAddress: item.result.to?.toLowerCase() ?? null,
            successful: Number.parseInt(item.result.status, 16) === 1,
          });
          continue;
        }
        if (item?.error && !retryableRpcError(item.error.message)) {
          throw new Error(
            `Ethereum receipt request failed: ${item.error.message ?? 'unknown RPC error'}.`,
          );
        }
        retry.push(hash);
      }
      pending = retry;
    }
    if (pending.length) {
      throw new Error(
        `No verified receipt was returned for ${pending[0]} after retrying provider limits.`,
      );
    }
  }
  return unique.map((hash) => receipts.get(hash)!);
}
