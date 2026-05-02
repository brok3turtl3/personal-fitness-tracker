/**
 * Extract the calendar date (YYYY-MM-DD) from an ISO date string,
 * using the local timezone so readings group by the user's day.
 *
 * Lifted from charts-page.component.ts:594-646 (was file-private; commit b6149d2)
 * so charts-page and report-page stop drifting in their day-grouping math
 * (see CONCERNS.md "Same-day reading averaging is duplicated, not shared").
 * Wave 2 plan 06 deletes the in-file copy in charts-page and switches consumers
 * to import from this module.
 */
export function toDateKey(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Group readings by calendar day and average their numeric values.
 * `extractor` pulls the numeric fields from each reading as an array.
 * Returns one data point per day, ordered by date ascending.
 */
export function groupByDay<T extends { date: string }>(
  readings: T[],
  extractor: (r: T) => number[],
): { labels: string[]; averages: number[][] } {
  const map = new Map<string, number[][]>();

  for (const r of readings) {
    const key = toDateKey(r.date);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(extractor(r));
  }

  const sortedKeys = Array.from(map.keys()).sort();
  const labels: string[] = [];
  const averages: number[][] = [];

  for (const key of sortedKeys) {
    const group = map.get(key)!;
    const fieldCount = group[0].length;
    const avg: number[] = [];
    for (let i = 0; i < fieldCount; i++) {
      const sum = group.reduce((s, vals) => s + vals[i], 0);
      avg.push(sum / group.length);
    }
    labels.push(key);
    averages.push(avg);
  }

  return { labels, averages };
}

/** Round a value to two decimal places. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
