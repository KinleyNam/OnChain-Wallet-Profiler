const RECEIPT_BATCH_SIZE = 100;
export const MAX_RECEIPTS_PER_ANALYSIS = 1_000;

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

export async function fetchVerifiedReceipts(
  rpcUrl: string,
  hashes: string[],
): Promise<VerifiedReceipt[]> {
  const unique = [...new Set(hashes.map((hash) => hash.toLowerCase()))];
  if (unique.length > MAX_RECEIPTS_PER_ANALYSIS) {
    throw new Error(
      `Receipt verification is limited to ${MAX_RECEIPTS_PER_ANALYSIS.toLocaleString('en-US')} transactions per analysis.`,
    );
  }
  const receipts: VerifiedReceipt[] = [];
  for (let start = 0; start < unique.length; start += RECEIPT_BATCH_SIZE) {
    const batch = unique.slice(start, start + RECEIPT_BATCH_SIZE);
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        batch.map((hash, index) => ({
          jsonrpc: '2.0',
          id: index,
          method: 'eth_getTransactionReceipt',
          params: [hash],
        })),
      ),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Ethereum receipt request failed (${response.status}).`);
    }
    const body = (await response.json()) as RpcResponse[];
    if (!Array.isArray(body)) throw new Error('Ethereum receipt response was invalid.');
    const byId = new Map(body.map((item) => [item.id, item]));
    for (let index = 0; index < batch.length; index++) {
      const item = byId.get(index);
      if (item?.error || !item?.result) {
        throw new Error(`No verified receipt was returned for ${batch[index]}.`);
      }
      receipts.push({
        hash: item.result.transactionHash.toLowerCase(),
        fromAddress: item.result.from.toLowerCase(),
        toAddress: item.result.to?.toLowerCase() ?? null,
        successful: Number.parseInt(item.result.status, 16) === 1,
      });
    }
  }
  return receipts;
}
