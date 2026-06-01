import type { MeasuredUnit } from '../services/units';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/**
 * Units a food can be measured in.
 *
 * Widened in Phase 2 (V7, D-03) from the legacy `'g' | 'tbsp'` to the full
 * `MeasuredUnit` union — mass (g/oz/lb) + volume (ml/tsp/tbsp/cup). The union is
 * the single source of truth in `units.ts` (units.ts has NO model import, so
 * importing the type here introduces no circular dependency). Named servings
 * (e.g. "1 slice") are NOT FoodUnits — they are `SavedFoodServing`s carrying an
 * explicit gram/ml-equivalent amount in a base measured unit.
 */
export type FoodUnit = MeasuredUnit;

export interface NutritionTotals {
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  netCarbsG: number;
}

export interface SavedFoodServing {
  id: string;
  label: string;
  unit: FoodUnit;
  amount: number;
}

export interface SavedFood {
  id: string;
  name: string;

  /** The unit the nutrition values are based on. */
  baseUnit: FoodUnit;

  /**
   * Optional grams-per-tablespoon density for converting between g and tbsp.
   * LEGACY (pre-V7): still honored. New foods should set `densityGramsPerMl`;
   * the V6→V7 migration derives one from this where present.
   */
  gramsPerTbsp?: number;

  /**
   * Optional per-food density (g/ml) enabling cross-dimension (mass↔volume)
   * conversion via `units.ts` (DIET-03 / D-04). Absent → only within-dimension
   * conversion is allowed; `convertMeasured` throws — there is NEVER a global
   * density default. Omitted (not `null`) when unknown.
   */
  densityGramsPerMl?: number;

  /** Optional UI hint: the unit(s) this food is usually logged in (D-03). */
  preferredUnits?: FoodUnit[];

  /** Nutrition per 1 baseUnit (per 1g OR per 1 tbsp). */
  nutrientsPerUnit: NutritionTotals;
  servings: SavedFoodServing[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedFood {
  name: string;
  baseUnit: FoodUnit;
  gramsPerTbsp?: number;
  densityGramsPerMl?: number;
  preferredUnits?: FoodUnit[];
  nutrientsPerUnit: NutritionTotals;
  servings?: SavedFoodServing[];
}

export interface MealItemSnapshot {
  baseUnits: number;
  totals: NutritionTotals;

  /**
   * Resolved unit/serving label captured at log time (Phase 2, D-09 / Pitfall 4)
   * so a historical render never re-resolves from a (possibly later-edited) food.
   * Optional so legacy snapshots still type-check.
   */
  unit?: FoodUnit;
  servingLabel?: string;
}

export interface MealItem {
  id: string;
  savedFoodId: string;
  savedFoodName: string;
  servingId: string;
  servingLabel: string;
  unit: FoodUnit;
  quantity: number;
  snapshot: MealItemSnapshot;
}

export interface MealEntry {
  id: string;
  dateTime: string; // ISO string
  mealType?: MealType;
  notes?: string;
  items: MealItem[];
  totals: NutritionTotals;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMealEntry {
  dateTime: string;
  mealType?: MealType;
  notes?: string;
  items: Array<{
    savedFoodId: string;
    servingId: string;
    quantity: number;
  }>;
}

/**
 * Optional persistent daily nutrition targets (Phase 2, V7 / D-08).
 *
 * A single set (not per-day; per-day overrides deferred per D-08). Each metric
 * is optional so a user can target only calories. Consumed by the diet-page
 * %-of-target progress bars in plan 02-04. Stored on `AppData.dailyTargets`;
 * omitted entirely (never `null`) until the user sets targets.
 */
export interface DailyTargets {
  caloriesKcal?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  netCarbsG?: number;
}
