export const ETHEREUM_START_DATE = '2015-07-30';
const DAY_MS = 86_400_000;

/** Calendar days from Ethereum mainnet's start through the UTC analysis day. */
export function lifetimeDays(asOf = new Date()) {
  const firstDay = Date.parse(`${ETHEREUM_START_DATE}T00:00:00Z`);
  const currentDay = Date.parse(`${asOf.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.floor((currentDay - firstDay) / DAY_MS) + 1;
}
