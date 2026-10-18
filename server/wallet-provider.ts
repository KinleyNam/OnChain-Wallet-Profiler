import type { NansenCredentials } from './nansen-client';
import type { AnalysisRecord } from './analysis';
import {
  createArkhamAnalysis,
  enrichWithArkham,
  fetchArkhamSnapshot,
} from './arkham';
import { createEtherscanAnalysis } from './etherscan';
import { createNansenAnalysis } from './nansen';

export type ProviderSettings = {
  nansenKey?: NansenCredentials;
  etherscanKey?: string;
  ethereumRpcUrl?: string;
  arkhamKey?: string;
  arkhamBaseUrl?: string;
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

function updatePrimaryProfile(record: AnalysisRecord) {
  record.primaryProfile = record.profiles.filter((item) => item.assigned)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.name ??
    (record.profiles.some((item) => item.status === 'NOT_ASSESSED')
      ? 'Not enough data to classify'
      : 'No profile matched');
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
  const [nansen, etherscan, arkham] = await Promise.all([
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
    settled(
      'Arkham',
      settings.arkhamKey
        ? fetchArkhamSnapshot(
            address,
            periodDays,
            settings.arkhamKey,
            settings.arkhamBaseUrl,
          )
        : undefined,
    ),
  ]);

  let record = nansen ?? etherscan;
  if (!record && arkham) record = createArkhamAnalysis(address, periodDays, arkham);
  if (!record)
    throw new Error('All configured wallet data providers are unavailable.');
  if (nansen && etherscan) mergeProfiles(record, etherscan);
  if (arkham) record = enrichWithArkham(record, arkham);
  updatePrimaryProfile(record);
  return record;
}
