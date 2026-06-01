import { groupByDay, sumByDay, toDateKey, round2 } from './chart-grouping';

describe('chart-grouping', () => {
  describe('toDateKey', () => {
    it('should return YYYY-MM-DD shape', () => {
      expect(toDateKey('2026-05-02T14:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should pad month and day to two digits', () => {
      // Use local-time inputs so the spec is timezone-stable
      const local = new Date(2026, 0, 5, 12, 0, 0).toISOString(); // Jan 5
      expect(toDateKey(local)).toMatch(/^\d{4}-01-05$/);
    });
  });

  describe('groupByDay', () => {
    it('should return empty labels and averages for empty input', () => {
      const { labels, averages } = groupByDay([], (r: { date: string; v: number }) => [r.v]);
      expect(labels).toEqual([]);
      expect(averages).toEqual([]);
    });

    it('should average multiple readings on the same day (regression for b6149d2)', () => {
      // Two readings, same local day, value 10 and 20 -> single label, average 15.
      const sameDayA = new Date(2026, 4, 2, 8, 0, 0).toISOString();
      const sameDayB = new Date(2026, 4, 2, 20, 0, 0).toISOString();
      const { labels, averages } = groupByDay(
        [{ date: sameDayA, v: 10 }, { date: sameDayB, v: 20 }],
        r => [r.v],
      );
      expect(labels.length).toBe(1);
      expect(averages).toEqual([[15]]);
    });

    it('should return labels in ascending order across multiple days', () => {
      const day1 = new Date(2026, 4, 1, 12, 0, 0).toISOString();
      const day2 = new Date(2026, 4, 2, 12, 0, 0).toISOString();
      const day3 = new Date(2026, 4, 3, 12, 0, 0).toISOString();
      // Insert out of order; expect sorted output
      const { labels } = groupByDay(
        [{ date: day3, v: 1 }, { date: day1, v: 2 }, { date: day2, v: 3 }],
        r => [r.v],
      );
      expect(labels).toEqual([toDateKey(day1), toDateKey(day2), toDateKey(day3)]);
    });

    it('should average each field independently when extractor returns multiple values', () => {
      const sameDayA = new Date(2026, 4, 2, 8, 0, 0).toISOString();
      const sameDayB = new Date(2026, 4, 2, 20, 0, 0).toISOString();
      const { averages } = groupByDay(
        [{ date: sameDayA, a: 10, b: 100 }, { date: sameDayB, a: 20, b: 200 }],
        r => [r.a, r.b],
      );
      expect(averages).toEqual([[15, 150]]);
    });
  });

  describe('sumByDay', () => {
    interface Meal {
      dateTime: string;
      cals: number;
      protein: number;
    }
    const dateOf = (m: Meal) => m.dateTime;
    const extract = (m: Meal) => [m.cals, m.protein];

    it('returns empty labels and values for empty input', () => {
      const { labels, values } = sumByDay<Meal>([], dateOf, extract);
      expect(labels).toEqual([]);
      expect(values).toEqual([]);
    });

    it('SUMS (not averages) multiple meals on the same local day into one label', () => {
      // 2026-03-08, both local-time on the same day, late + morning.
      const late = new Date(2026, 2, 8, 23, 30, 0).toISOString();
      const morning = new Date(2026, 2, 8, 8, 0, 0).toISOString();
      const { labels, values } = sumByDay<Meal>(
        [
          { dateTime: late, cals: 600, protein: 30 },
          { dateTime: morning, cals: 400, protein: 20 },
        ],
        dateOf,
        extract,
      );
      expect(labels).toEqual(['2026-03-08']);
      expect(values).toEqual([[1000, 50]]); // summed, NOT averaged (would be 500/25)
    });

    it('keys a 23:30-local meal to the correct LOCAL day across US spring-forward (2026-03-08)', () => {
      // Spring-forward: 2026-03-08 02:00 → 03:00. A 23:30-local meal must stay on 2026-03-08.
      const springForward = new Date(2026, 2, 8, 23, 30, 0).toISOString();
      const { labels } = sumByDay<Meal>(
        [{ dateTime: springForward, cals: 500, protein: 25 }],
        dateOf,
        extract,
      );
      expect(labels).toEqual(['2026-03-08']);
    });

    it('keys correctly across US fall-back (2026-11-01) with no day drift', () => {
      // Fall-back: 2026-11-01 02:00 → 01:00. A 23:30-local meal must stay on 2026-11-01.
      const fallBack = new Date(2026, 10, 1, 23, 30, 0).toISOString();
      const { labels } = sumByDay<Meal>(
        [{ dateTime: fallBack, cals: 700, protein: 40 }],
        dateOf,
        extract,
      );
      expect(labels).toEqual(['2026-11-01']);
    });

    it('returns labels sorted ascending with values aligned to labels', () => {
      const day1 = new Date(2026, 4, 1, 12, 0, 0).toISOString();
      const day2 = new Date(2026, 4, 2, 12, 0, 0).toISOString();
      const day3 = new Date(2026, 4, 3, 12, 0, 0).toISOString();
      const { labels, values } = sumByDay<Meal>(
        [
          { dateTime: day3, cals: 3, protein: 30 },
          { dateTime: day1, cals: 1, protein: 10 },
          { dateTime: day2, cals: 2, protein: 20 },
        ],
        dateOf,
        extract,
      );
      expect(labels).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
      expect(values).toEqual([[1, 10], [2, 20], [3, 30]]);
    });
  });

  describe('round2', () => {
    it('should round to two decimal places (rounding up)', () => {
      expect(round2(1.236)).toBe(1.24);
    });

    it('should round to two decimal places (rounding down)', () => {
      expect(round2(1.234)).toBe(1.23);
    });

    it('should preserve integers', () => {
      expect(round2(5)).toBe(5);
    });
  });
});
