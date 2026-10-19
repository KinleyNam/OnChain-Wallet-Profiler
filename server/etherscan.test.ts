import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEtherscanAnalysis } from './etherscan';

const wallet = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';
const aave = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
const uniswap = '0xe592427a0aece92de3edee1f18e0157c05861564';
const openSea = '0x00000000000000adc04c56bf30ac9d3c0aaf14dc';

void test('Etherscan pipeline classifies decoded DeFi actions and verified marketplace sales', async (t) => {
  const now = Date.now();
  let timedOut = false;
  const at = (day: number) => String(Math.floor((now - day * 86_400_000) / 1000));
  const normal = [
    ...Array.from({ length: 10 }, (_, index) => ({
      hash: `0xdefi${index}`,
      timeStamp: at(index % 3 + 1),
      from: wallet,
      to: index % 2 ? uniswap : aave,
      value: '0',
      input: '0x1234',
      methodId: '0x1234',
      functionName: index % 2 ? 'addLiquidity(address,uint256)' : 'supply(address,uint256,address,uint16)',
      isError: '0',
      txreceipt_status: '1',
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      hash: `0xnft${index}`,
      timeStamp: at(index % 3 + 1),
      from: wallet,
      to: openSea,
      value: '1000000000000000000',
      input: '0x1234',
      methodId: '0x1234',
      functionName: 'fulfillBasicOrder(tuple)',
      isError: '0',
      txreceipt_status: '1',
    })),
  ];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const action = url.searchParams.get('action');
    if (action === 'txlist' && !timedOut) {
      timedOut = true;
      throw new Error('The operation was aborted due to timeout');
    }
    const result = action === 'txlist'
      ? normal
      : action === 'tokennfttx'
        ? Array.from({ length: 5 }, (_, index) => ({
            hash: `0xnft${index}`,
            timeStamp: at(index % 3 + 1),
            from: index === 0 ? wallet : other,
            to: index === 0 ? other : wallet,
            contractAddress: index % 2 ? '0xcollection1' : '0xcollection2',
            tokenID: String(index),
          }))
        : [];
    return Response.json({ status: '1', message: 'OK', result });
  });

  const record = await createEtherscanAnalysis(wallet, 30, 'key');
  assert.equal(timedOut, true);
  const defi = record.profiles.find((profile) => profile.name === 'DeFi participant');
  const nft = record.profiles.find((profile) => profile.name === 'NFT trader');
  assert.equal(defi?.status, 'ASSIGNED');
  assert.equal(defi?.score, 100);
  assert.equal(nft?.status, 'ASSIGNED');
  assert.equal(nft?.score, 100);
});

void test('Etherscan pages through its 1,000-row response cap and uses recent sends for dormancy', async (t) => {
  const at = (days: number) => String(Math.floor((Date.now() - days * 86_400_000) / 1000));
  const old = Array.from({ length: 1_000 }, (_, index) => ({
    hash: `0xold${index}`, timeStamp: at(400), from: index === 0 ? wallet : other,
    to: index === 0 ? other : wallet, value: '0', isError: '0', txreceipt_status: '1',
  }));
  const recent = Array.from({ length: 1_000 }, (_, index) => ({
    hash: `0xrecent${index}`, timeStamp: at(1), from: index === 0 ? wallet : other,
    to: index === 0 ? other : wallet, value: '0', isError: '0', txreceipt_status: '1',
  }));
  const pages: number[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.searchParams.get('action') !== 'txlist')
      return Response.json({ status: '0', message: 'No transactions found', result: [] });
    assert.equal(url.searchParams.get('offset'), '1000');
    const page = Number(url.searchParams.get('page'));
    pages.push(page);
    const ascending = url.searchParams.get('sort') === 'asc';
    return Response.json({
      status: '1', message: 'OK',
      result: page === 1 ? (ascending ? old : recent) : page === 2 ? (ascending ? recent : old) : [],
    });
  });

  const record = await createEtherscanAnalysis(wallet, 90, 'key');
  assert.deepEqual(pages, [1, 2, 3]);
  assert.equal(record.data.transactions.length, 1_000);
  assert.equal(record.profiles.find((profile) => profile.name === 'Dormant or new wallet')?.status, 'NOT_ASSIGNED');
});
