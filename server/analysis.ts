import { createHash } from 'node:crypto';
import type { WalletData } from '../lib/wallet-data';
import type { ProfileResult } from './classification';
import {
  CLASSIFICATION_RULE_VERSION,
  MAPPING_VERSION,
} from './classification-rules';
export type { ProfileResult } from './classification';

export const ANALYSIS_TTL_SECONDS = 10 * 60;
export const PERIODS = [30, 90, 180] as const;
export const ETHEREUM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export type AnalysisRecord = {
  analysisId: string;
  address: string;
  network: 'ethereum-mainnet';
  periodDays: number;
  status: 'complete';
  source: 'nansen' | 'etherscan';
  generatedAt: string;
  analysisCutoff: string;
  providerDataCutoff: string | null;
  expiresAt: string;
  ruleVersion: string;
  mappingVersion: string;
  data: WalletData;
  profiles: ProfileResult[];
  primaryProfile: string;
};

export function analysisIdFor(address: string, periodDays: number) {
  const snapshot = new Date().toISOString().slice(0, 10);
  const fingerprint = `${address.toLowerCase()}:${periodDays}:${snapshot}:${CLASSIFICATION_RULE_VERSION}:${MAPPING_VERSION}`;
  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);
}
