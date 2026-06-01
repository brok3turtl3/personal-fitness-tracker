import { filterFoods, rankFoods, recentFoods } from './food-ranking';
import type { SavedFood, MealEntry, NutritionTotals } from '../models/diet.model';

const ZERO_TOTALS: NutritionTotals = {
  caloriesKcal: 0,
  proteinG: 0,
  fatG: 0,
  carbsG: 0,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 0,
  netCarbsG: 0,
};

const NOW = Date.parse('2026-06-01T12:00:00');
const DAY = 86400000;

function food(id: string, name: string): SavedFood {
  return {
    id,
    name,
    baseUnit: 'g',
    nutrientsPerUnit: { ...ZERO_TOTALS },
    servings: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/** Build a MealEntry at `daysAgo` containing one item per savedFoodId in `ids`. */
function meal(id: string, daysAgo: number, ids: string[]): MealEntry {
  const dateTime = new Date(NOW - daysAgo * DAY).toISOString();
  return {
    id,
    dateTime,
    items: ids.map((sid, i) => ({
      id: `${id}-${i}`,
      savedFoodId: sid,
      savedFoodName: sid,
      servingId: 's',
      servingLabel: 's',
      unit: 'g',
      quantity: 1,
      snapshot: { baseUnits: 1, totals: { ...ZERO_TOTALS } },
    })),
    totals: { ...ZERO_TOTALS },
    createdAt: dateTime,
    updatedAt: dateTime,
  };
}

describe('food-ranking.ts — pure search + favorite ranking', () => {
  describe('filterFoods', () => {
    const foods = [food('a', 'Grilled chicken'), food('b', 'Brown rice'), food('c', 'Chickpeas')];

    it('matches case-insensitive substring on name', () => {
      const result = filterFoods(foods, 'CHICK');
      expect(result.map((f) => f.id)).toEqual(['a', 'c']);
    });

    it('returns all foods unchanged for an empty query', () => {
      expect(filterFoods(foods, '')).toEqual(foods);
    });

    it('returns all foods for a whitespace-only query', () => {
      expect(filterFoods(foods, '   ')).toEqual(foods);
    });
  });

  describe('rankFoods', () => {
    const a = food('a', 'Apple');
    const b = food('b', 'Banana');
    const foods = [a, b];

    it('ranks a frequently-recently-logged food above a once-long-ago food', () => {
      const entries = [
        meal('m1', 0, ['a']),
        meal('m2', 1, ['a']),
        meal('m3', 2, ['a']),
        meal('m4', 3, ['a']),
        meal('m5', 4, ['a']),
        meal('m6', 200, ['b']),
      ];
      const ranked = rankFoods(foods, entries, NOW);
      expect(ranked[0].id).toBe('a');
    });

    it('is deterministic: same inputs produce the same order', () => {
      const entries = [meal('m1', 1, ['b']), meal('m2', 5, ['a', 'b'])];
      const r1 = rankFoods(foods, entries, NOW);
      const r2 = rankFoods(foods, entries, NOW);
      expect(r1.map((f) => f.id)).toEqual(r2.map((f) => f.id));
    });

    it('returns input order (stable) when there is no log history and never throws', () => {
      expect(() => rankFoods(foods, [], NOW)).not.toThrow();
      expect(rankFoods(foods, [], NOW).map((f) => f.id)).toEqual(['a', 'b']);
    });

    it('skips entries with unparseable dateTime without throwing', () => {
      const bad = meal('bad', 0, ['a']);
      (bad as { dateTime: string }).dateTime = 'not-a-date';
      expect(() => rankFoods(foods, [bad], NOW)).not.toThrow();
    });
  });

  describe('recentFoods', () => {
    const a = food('a', 'Apple');
    const b = food('b', 'Banana');
    const c = food('c', 'Cherry');
    const foods = [a, b, c];

    it('returns distinct savedFoodIds ordered by most-recent dateTime desc, capped at n', () => {
      const entries = [
        meal('m1', 0, ['c']),
        meal('m2', 1, ['b']),
        meal('m3', 2, ['a']),
        meal('m4', 3, ['c']), // c appears again, older — should not duplicate
      ];
      const result = recentFoods(foods, entries, 2);
      expect(result.map((f) => f.id)).toEqual(['c', 'b']);
    });

    it('returns [] when there is no history', () => {
      expect(recentFoods(foods, [], 8)).toEqual([]);
    });
  });
});
