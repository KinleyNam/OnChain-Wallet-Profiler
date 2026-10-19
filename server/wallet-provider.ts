import type { NansenCredentials } from './nansen-client';
import type { AnalysisRecord } from './analysis';
import { createEtherscanAnalysis } from './etherscan';
import { createNansenAnalysis } from './nansen';

export type ProviderSettings = {
  nansenKey?: NansenCredentials;
  etherscanKey?: string;
  ethereumRpcUrl?: string;
};

function statusRank(status: string) {
  return status === 'ASSIGNED' ? 3 : status === 'NOT_ASSIGNED' ? 2 : 1;
}

function mergeProfiles(target: AnalysisRecord, candidate: AnalysisRecord) {
  for (const profile of candidate.profiles) {
    const index = target.profiles.findIndex((item) => item.name === profile.name);
    if (index < 0) target.profiles.push(profile);
    else if (statusRank(profile.status) > statusRank(target.profiles[index].status))
      target.profiles[index] = profile;
  }
  target.sources = [...new Set([
    ...(target.sources ?? [target.source]),
    ...(candidate.sources ?? [candidate.source]),
  ])];
}

function reconcileDormancy(record: AnalysisRecord) {
  const index = record.profiles.findIndex((profile) =>
    profile.name === 'Dormant or new wallet' &&
    profile.status === 'ASSIGNED' && profile.reason === 'dormant',
  );
  if (index < 0) return;
  const cutoff = Date.parse(record.analysisCutoff);
  if (!Number.isFinite(cutoff)) return;
  const recentVerifiedSends = record.data.transactions.filter((transaction) => {
    const time = Date.parse(transaction.timestamp);
    return transaction.successful === true &&
      transaction.fromAddress?.toLowerCase() === record.address.toLowerCase() &&
      Number.isFinite(time) && time >= cutoff - 90 * 86_400_000 && time < cutoff;
  }).length;
  if (!recentVerifiedSends) return;
  const profile = record.profiles[index];
  record.profiles[index] = {
    ...profile,
    status: 'NOT_ASSIGNED',
    assigned: false,
    reason: undefined,
    evidence: `${recentVerifiedSends} verified wallet-initiated transactions observed in the last 90 days; the wallet is not dormant.`,
    variables: {
      ...profile.variables,
      transactions_90d: Math.max(Number(profile.variables.transactions_90d) || 0, recentVerifiedSends),
    },
  };
}

function updatePrimaryProfile(record: AnalysisRecord) {
  record.primaryProfile = record.profiles.filter((item) => item.assigned)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.name ??
    (record.profiles.some((item) => item.status === 'NOT_ASSESSED')
      ? 'Not enough data to classify'
      : 'No profile matched');
}

export function reconcileWalletAnalysis(record: AnalysisRecord): AnalysisRecord {
  reconcileDormancy(record);
  updatePrimaryProfile(record);
  return record;
}

async function settled<T>(name: string, task: Promise<T> | undefined) {
  if (!task) return undefined;
  try {
    return await task;
  } catch (error) {
    console.warn(
      `${name} analysis unavailable:`,
      error instanceof Error ? error.message : 'unknown error',
    );
    return undefined;
  }
}

export async function createWalletAnalysis(
  address: string,
  periodDays: number,
  settings: ProviderSettings,
): Promise<AnalysisRecord> {
  const [nansen, etherscan] = await Promise.all([
    settled(
      'Nansen',
      settings.nansenKey ? createNansenAnalysis(
        address,
        periodDays,
        settings.nansenKey,
        settings.ethereumRpcUrl,
      ) : undefined,
    ),
    settled(
      'Etherscan',
      settings.etherscanKey
        ? createEtherscanAnalysis(address, periodDays, settings.etherscanKey)
        : undefined,
    ),
  ]);

  const record = nansen ?? etherscan;
  if (!record)
    throw new Error('All configured wallet data providers are unavailable.');
  if (nansen && etherscan) mergeProfiles(record, etherscan);
  return reconcileWalletAnalysis(record);
}
