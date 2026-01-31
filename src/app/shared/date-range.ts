export type DateRangePreset = '30d' | '90d' | '6m' | '1y' | 'all' | 'custom';

export interface ResolvedDateRange {
  startMs?: number;
  endMs?: number;
}

export function resolveDateRange(
  preset: DateRangePreset,
  now: Date,
  customStart?: Date,
  customEnd?: Date
): { range: ResolvedDateRange; error: string | null } {
  const endMs = now.getTime();

  switch (preset) {
    case 'all':
      return { range: {}, error: null };
    case '30d':
      return { range: { startMs: subtractDays(now, 30).getTime(), endMs }, error: null };
    case '90d':
      return { range: { startMs: subtractDays(now, 90).getTime(), endMs }, error: null };
    case '6m':
      return { range: { startMs: subtractMonths(now, 6).getTime(), endMs }, error: null };
    case '1y':
      return { range: { startMs: subtractYears(now, 1).getTime(), endMs }, error: null };
    case 'custom': {
      if (!customStart || !customEnd) {
        return { range: {}, error: 'Start and end are required for a custom range.' };
      }
      const startMs = customStart.getTime();
      const customEndMs = customEnd.getTime();

      if (!Number.isFinite(startMs) || !Number.isFinite(customEndMs)) {
        return { range: {}, error: 'Start and end must be valid dates.' };
      }
      if (startMs > customEndMs) {
        return { range: {}, error: 'Start date/time must be before end date/time.' };
      }

      return { range: { startMs, endMs: customEndMs }, error: null };
    }
    default:
      return { range: {}, error: 'Unknown date range preset.' };
  }
}

export function filterByRange<T>(
  items: T[],
  getDateMs: (item: T) => number,
  range: ResolvedDateRange
): T[] {
  const { startMs, endMs } = range;

  return items.filter(item => {
    const t = getDateMs(item);
    if (!Number.isFinite(t)) return false;
    if (startMs !== undefined && t < startMs) return false;
    if (endMs !== undefined && t > endMs) return false;
    return true;
  });
}

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function subtractMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function subtractYears(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d;
}
