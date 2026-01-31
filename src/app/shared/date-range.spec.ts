import { filterByRange, resolveDateRange } from './date-range';

describe('date-range', () => {
  describe('resolveDateRange', () => {
    it('should resolve 30d preset', () => {
      const now = new Date(Date.UTC(2026, 0, 30, 12, 0, 0));
      const { range, error } = resolveDateRange('30d', now);

      expect(error).toBeNull();
      expect(range.endMs).toBe(now.getTime());
      expect(range.startMs).toBe(new Date(Date.UTC(2025, 11, 31, 12, 0, 0)).getTime());
    });

    it('should resolve 6m preset', () => {
      const now = new Date(Date.UTC(2026, 0, 30, 12, 0, 0));
      const { range, error } = resolveDateRange('6m', now);

      expect(error).toBeNull();
      expect(range.endMs).toBe(now.getTime());
      expect(range.startMs).toBe(new Date(Date.UTC(2025, 6, 30, 12, 0, 0)).getTime());
    });

    it('should accept all time', () => {
      const now = new Date(Date.UTC(2026, 0, 30, 12, 0, 0));
      const { range, error } = resolveDateRange('all', now);
      expect(error).toBeNull();
      expect(range.startMs).toBeUndefined();
      expect(range.endMs).toBeUndefined();
    });

    it('should validate custom range start before end', () => {
      const now = new Date(Date.UTC(2026, 0, 30, 12, 0, 0));
      const start = new Date(Date.UTC(2026, 0, 10, 0, 0, 0));
      const end = new Date(Date.UTC(2026, 0, 20, 0, 0, 0));

      const { range, error } = resolveDateRange('custom', now, start, end);
      expect(error).toBeNull();
      expect(range.startMs).toBe(start.getTime());
      expect(range.endMs).toBe(end.getTime());
    });

    it('should reject custom range when start is after end', () => {
      const now = new Date(Date.UTC(2026, 0, 30, 12, 0, 0));
      const start = new Date(Date.UTC(2026, 0, 20, 0, 0, 0));
      const end = new Date(Date.UTC(2026, 0, 10, 0, 0, 0));

      const { error } = resolveDateRange('custom', now, start, end);
      expect(error).toContain('Start date/time must be before end date/time');
    });
  });

  describe('filterByRange', () => {
    it('should filter inclusively by start and end', () => {
      const items = [
        { id: 'a', t: 100 },
        { id: 'b', t: 200 },
        { id: 'c', t: 300 }
      ];

      const filtered = filterByRange(items, i => i.t, { startMs: 200, endMs: 300 });
      expect(filtered.map(i => i.id)).toEqual(['b', 'c']);
    });
  });
});
