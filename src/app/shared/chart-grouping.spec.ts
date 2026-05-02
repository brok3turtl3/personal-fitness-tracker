import { groupByDay, toDateKey, round2 } from './chart-grouping';

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
