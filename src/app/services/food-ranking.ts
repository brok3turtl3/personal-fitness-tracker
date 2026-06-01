/**
 * food-ranking.ts
 *
 * PURE MODULE — no dependency injection (no Angular @Injectable), no
 * persistence-service coupling, no class, no internal clock. Mirrors
 * units.ts / web-citation-parser.ts / confidence-attribution-parser.ts.
 *
 * Search + auto-ranked favorites for the saved-foods library (DIET-04 / D-06):
 *   - filterFoods: case-insensitive substring on the food name;
 *   - rankFoods: decayed-frequency score (half-life 14d) — recency + frequency
 *     with no manual starring; `now` is INJECTED (no internal wall-clock read) so the
 *     ranking is deterministic and unit-testable;
 *   - recentFoods: distinct savedFoodIds by most-recent log time, capped.
 *
 * Type-only model imports keep this module persistence-free. All numeric parsing
 * is guarded with Number.isFinite; entries with an unparseable dateTime are
 * skipped, never thrown.
 */

import type { SavedFood, MealEntry } from '../models/diet.model';

/** Half-life (days) for the decayed-frequency favorite score (D-06, tunable). */
const HALF_LIFE_DAYS = 14;

const DAY_MS = 86400000;

/** Case-insensitive substring filter on `name`; empty/whitespace query → all. */
export function filterFoods(foods: SavedFood[], query: string): SavedFood[] {
  const q = query.trim().toLowerCase();
  if (q === '') return foods;
  return foods.filter((f) => f.name.toLowerCase().includes(q));
}

/**
 * Rank foods by a decayed-frequency score:
 *   score(food) = Σ over its log events of 0.5 ** (ageDays / HALF_LIFE_DAYS)
 * where a log event = each MealItem whose savedFoodId === food.id. Sorted desc
 * by score; ties preserve input order (stable). `now` is injected (epoch ms).
 */
export function rankFoods(
  foods: SavedFood[],
  mealEntries: MealEntry[],
  now: number,
): SavedFood[] {
  const scores = new Map<string, number>();

  for (const entry of mealEntries) {
    const logged = Date.parse(entry.dateTime);
    if (!Number.isFinite(logged)) continue; // skip unparseable dateTime
    const ageDays = (now - logged) / DAY_MS;
    const weight = 0.5 ** (ageDays / HALF_LIFE_DAYS);
    if (!Number.isFinite(weight)) continue;
    for (const item of entry.items) {
      scores.set(item.savedFoodId, (scores.get(item.savedFoodId) ?? 0) + weight);
    }
  }

  // Stable sort: decorate with input index, sort desc by score, tie-break on index.
  return foods
    .map((food, index) => ({ food, index, score: scores.get(food.id) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((d) => d.food);
}

/**
 * Distinct savedFoodIds ordered by most-recent MealEntry.dateTime desc, mapped
 * back to their SavedFood, capped at `n`. Foods never logged are excluded.
 */
export function recentFoods(
  foods: SavedFood[],
  mealEntries: MealEntry[],
  n: number,
): SavedFood[] {
  const byId = new Map<string, SavedFood>(foods.map((f) => [f.id, f]));

  // Most-recent log time per savedFoodId.
  const lastSeen = new Map<string, number>();
  for (const entry of mealEntries) {
    const logged = Date.parse(entry.dateTime);
    if (!Number.isFinite(logged)) continue;
    for (const item of entry.items) {
      const prev = lastSeen.get(item.savedFoodId);
      if (prev === undefined || logged > prev) {
        lastSeen.set(item.savedFoodId, logged);
      }
    }
  }

  return Array.from(lastSeen.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id))
    .filter((f): f is SavedFood => f !== undefined)
    .slice(0, n);
}
