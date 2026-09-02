/**
 * The date format the Libro ledger uses: "1-Sep".
 *
 * Always rendered in Caracas time, so an entry written late at night carries the
 * day it happened locally rather than the UTC day the server was on.
 */
export function formatLedgerDate(date: Date): string {
  const d = new Date(date);
  const day = d.toLocaleDateString('en-US', {
    day: 'numeric',
    timeZone: 'America/Caracas',
  });
  const month = d.toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'America/Caracas',
  });

  return `${day}-${month}`;
}
