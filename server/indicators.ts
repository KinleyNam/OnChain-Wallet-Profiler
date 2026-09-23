import type { WalletData } from '../lib/wallet-data';

export function calculateIndicators(data: WalletData) {
  const count = data.transactions.length;
  const times = data.transactions
    .map((transaction) => Date.parse(transaction.timestamp))
    .sort((a, b) => a - b);
  let burst = 0;
  for (let left = 0, right = 0; right < times.length; right++) {
    while (times[right] - times[left] > 10 * 60 * 1000) left++;
    burst = Math.max(burst, right - left + 1);
  }

  let rapidMovements = 0;
  const lastIncoming = new Map<string, number>();
  [...data.movements]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .forEach((movement) => {
      const time = Date.parse(movement.timestamp);
      if (movement.direction === 'in') {
        lastIncoming.set(movement.token, time);
      } else {
        const previous = lastIncoming.get(movement.token);
        if (previous !== undefined && time - previous <= 10 * 60 * 1000) rapidMovements++;
      }
    });

  const totalFlow = data.flows.reduce((sum, flow) => sum + flow.incoming + flow.outgoing, 0);
  const concentration = totalFlow
    ? Math.max(...data.flows.map((flow) => flow.incoming + flow.outgoing)) / totalFlow
    : 0;
  const dailyVolumes = Object.values(data.transactions.reduce<Record<string, number>>((totals, transaction) => {
    const day = transaction.timestamp.slice(0, 10);
    totals[day] = (totals[day] ?? 0) + transaction.value;
    return totals;
  }, {}));
  const averageVolume = dailyVolumes.length
    ? dailyVolumes.reduce((sum, value) => sum + value, 0) / dailyVolumes.length
    : 0;
  const volumeSpike = averageVolume ? Math.max(...dailyVolumes) / averageVolume : 0;
  const typeCounts = Object.entries(data.transactions.reduce<Record<string, number>>((totals, transaction) => {
    totals[transaction.type] = (totals[transaction.type] ?? 0) + 1;
    return totals;
  }, {})).sort((a, b) => b[1] - a[1]);
  const mostRepeatedType = typeCounts[0] ?? ['No activity', 0];
  const repeatedTypeShare = count ? mostRepeatedType[1] / count : 0;
  const minuteCounts = Object.values(data.transactions.reduce<Record<string, number>>((totals, transaction) => {
    const minute = transaction.timestamp.slice(14, 16);
    totals[minute] = (totals[minute] ?? 0) + 1;
    return totals;
  }, {}));
  const repeatedMinuteShare = count ? Math.max(...minuteCounts) / count : 0;

  const signals = [
    { name: 'Transaction burst', detected: burst >= 8, value: `${burst} transactions in the busiest 10-minute window` },
    { name: 'Rapid movement of received funds', detected: rapidMovements >= 3, value: `${rapidMovements} outgoing transfers within 10 minutes of receiving the same asset` },
    { name: 'Counterparty concentration', detected: concentration >= 0.65, value: `${Math.round(concentration * 100)}% linked to the largest counterparty group` },
    { name: 'Daily volume increase', detected: volumeSpike >= 3, value: `${volumeSpike.toFixed(1)}× the average daily volume at the peak` },
    { name: 'Repetitive transaction pattern', detected: repeatedTypeShare >= 0.7, value: `${mostRepeatedType[0]} represents ${Math.round(repeatedTypeShare * 100)}% of transactions` },
    { name: 'Repeated transaction timing', detected: repeatedMinuteShare >= 0.25, value: `${Math.round(repeatedMinuteShare * 100)}% share at the most repeated minute` },
  ];
  const score = Math.round((signals.filter((signal) => signal.detected).length / signals.length) * 100);
  return { score, band: score >= 60 ? 'High' : score >= 30 ? 'Moderate' : 'Low', signals };
}
