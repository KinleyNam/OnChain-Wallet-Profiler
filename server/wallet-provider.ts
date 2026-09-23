import type { AnalysisRecord } from './analysis';
import { createEtherscanAnalysis } from './etherscan';
import { createNansenAnalysis } from './nansen';

export type ProviderSettings = {
  nansenKey?: string;
  etherscanKey?: string;
  ethereumRpcUrl?: string;
};

export async function createWalletAnalysis(
  address: string,
  periodDays: number,
  settings: ProviderSettings,
): Promise<AnalysisRecord> {
  if (settings.nansenKey) {
    try {
      return await createNansenAnalysis(
        address,
        periodDays,
        settings.nansenKey,
        settings.ethereumRpcUrl,
      );
    } catch (error) {
      if (!settings.etherscanKey) throw error;
      console.warn(
        'Nansen analysis unavailable; continuing with Etherscan:',
        error instanceof Error ? error.message : 'unknown error',
      );
    }
  }
  if (settings.etherscanKey)
    return createEtherscanAnalysis(address, periodDays, settings.etherscanKey);
  throw new Error('No wallet data provider is configured.');
}
