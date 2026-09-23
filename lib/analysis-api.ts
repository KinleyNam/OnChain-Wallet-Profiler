import type { WalletData } from './wallet-data';
import type { ProfileResult } from '../server/analysis';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

async function json<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `Analysis request failed (${response.status}).`);
  }
  return body as T;
}

export async function loadWalletAnalysis(address: string, periodDays: number, signal?: AbortSignal) {
  const created = await json<{ analysisId: string }>('/api/v1/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, periodDays }),
    signal,
  });
  const [result, profiles, indicators] = await Promise.all([
    json<{ wallet: WalletData; analysis: { source: string; ruleVersion: string; mappingVersion: string; providerDataCutoff: string | null } }>(`/api/v1/analyses/${created.analysisId}/data`, { signal }),
    json<{ primaryProfile: string; items: ProfileResult[] }>(`/api/v1/analyses/${created.analysisId}/profiles`, { signal }),
    json<{ score: number; band: string; signals: Array<{ name: string; detected: boolean; value: string }> }>(`/api/v1/analyses/${created.analysisId}/risk-indicators`, { signal }),
  ]);
  if (!result.wallet || result.wallet.address.toLowerCase() !== address.toLowerCase() || result.wallet.days !== periodDays) {
    throw new Error('The analysis service returned an unexpected wallet result.');
  }
  return { wallet: result.wallet, analysisId: created.analysisId, analysis: result.analysis, profiles, indicators };
}

export async function downloadWalletExport(analysisId: string) {
  const response = await fetch(`${API_BASE}/api/v1/analyses/${analysisId}/export`);
  if (!response.ok) throw new Error('Could not export this wallet analysis.');
  return response.blob();
}
