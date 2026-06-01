import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { generateId } from '../shared/id';
import { StorageService } from './storage.service';
import { AppData } from '../models/app-data.model';
import {
  CreateMealEntry,
  CreateSavedFood,
  DailyTargets,
  FoodUnit,
  MealEntry,
  MealItem,
  NutritionTotals,
  SavedFood,
  SavedFoodServing
} from '../models/diet.model';
import {
  convertMeasured,
  isMeasuredUnit,
  UnitConversionError
} from './units';
import { validateDailyTargets, validateDensity } from './validators';

export class DietValidationError extends Error {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join('; '));
    this.name = 'DietValidationError';
    this.errors = errors;
  }
}

@Injectable({
  providedIn: 'root'
})
export class DietService {
  constructor(private storageService: StorageService) {}

  getSavedFoods(): Observable<SavedFood[]> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return [];
        return [...data.savedFoods].sort((a, b) => a.name.localeCompare(b.name));
      })
    );
  }

  addSavedFood(input: CreateSavedFood): Observable<SavedFood> {
    const errors: string[] = [];
    if (!input.name || !input.name.trim().length) errors.push('Food name is required');
    if (!isMeasuredUnit(input.baseUnit)) errors.push('Food base unit is required');
    if (input.gramsPerTbsp !== undefined) {
      if (!Number.isFinite(input.gramsPerTbsp) || input.gramsPerTbsp <= 0) {
        errors.push('Grams per tbsp must be > 0');
      }
    }
    errors.push(...validateDensity(input.densityGramsPerMl));
    const servingsInput = (input.servings ?? []).filter(Boolean);
    if (servingsInput.length > 0) {
      for (const s of servingsInput) {
        if (!s.label || !s.label.trim().length) errors.push('Serving label is required');
        if (!isMeasuredUnit(s.unit)) errors.push('Serving unit is required');
        if (!Number.isFinite(s.amount) || s.amount <= 0) errors.push('Serving amount must be > 0');
      }
    }
    if (errors.length) {
      return throwError(() => new DietValidationError(errors));
    }

    const now = new Date().toISOString();
    const defaultServings: SavedFoodServing[] = defaultServingsFor(input.baseUnit, input.gramsPerTbsp);

    const savedFood: SavedFood = {
      id: generateId(),
      name: input.name.trim(),
      baseUnit: input.baseUnit,
      gramsPerTbsp: input.gramsPerTbsp,
      densityGramsPerMl: input.densityGramsPerMl,
      preferredUnits: input.preferredUnits,
      nutrientsPerUnit: normalizeTotals(input.nutrientsPerUnit),
      servings: (servingsInput.length ? servingsInput : defaultServings).map(s => ({
        id: s.id || generateId(),
        label: s.label.trim(),
        unit: s.unit,
        amount: s.amount
      })),
      createdAt: now,
      updatedAt: now
    };

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));
        const updated = {
          ...data,
          savedFoods: [...data.savedFoods, savedFood]
        };
        return this.storageService.saveData(updated).pipe(map(() => savedFood));
      })
    );
  }

  addCustomServing(savedFoodId: string, label: string, unit: FoodUnit, amount: number): Observable<SavedFood> {
    const errors: string[] = [];
    if (!savedFoodId) errors.push('Saved food ID is required');
    if (!label || !label.trim().length) errors.push('Serving label is required');
    if (!isMeasuredUnit(unit)) errors.push('Serving unit is required');
    if (!Number.isFinite(amount) || amount <= 0) errors.push('Serving amount must be > 0');
    if (errors.length) {
      return throwError(() => new DietValidationError(errors));
    }

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));
        const idx = data.savedFoods.findIndex(f => f.id === savedFoodId);
        if (idx < 0) return throwError(() => new Error('Saved food not found'));

        const now = new Date().toISOString();
        const updatedFood: SavedFood = {
          ...data.savedFoods[idx],
          servings: [...data.savedFoods[idx].servings, { id: generateId(), label: label.trim(), unit, amount }],
          updatedAt: now
        };

        const savedFoods = [...data.savedFoods];
        savedFoods[idx] = updatedFood;

        const updatedData: AppData = { ...data, savedFoods };
        return this.storageService.saveData(updatedData).pipe(map(() => updatedFood));
      })
    );
  }

  updateSavedFood(savedFoodId: string, update: {
    name: string;
    gramsPerTbsp?: number;
    densityGramsPerMl?: number;
    nutrientsPerUnit: NutritionTotals;
  }): Observable<SavedFood> {
    const errors: string[] = [];
    if (!savedFoodId) errors.push('Saved food ID is required');
    if (!update.name || !update.name.trim().length) errors.push('Food name is required');
    if (update.gramsPerTbsp !== undefined) {
      if (!Number.isFinite(update.gramsPerTbsp) || update.gramsPerTbsp <= 0) {
        errors.push('Grams per tbsp must be > 0');
      }
    }
    errors.push(...validateDensity(update.densityGramsPerMl));
    if (errors.length) {
      return throwError(() => new DietValidationError(errors));
    }

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));
        const idx = data.savedFoods.findIndex(f => f.id === savedFoodId);
        if (idx < 0) return throwError(() => new Error('Saved food not found'));

        const now = new Date().toISOString();
        const existing = data.savedFoods[idx];

        let servings = [...existing.servings];
        if (update.gramsPerTbsp !== undefined) {
          const hasTbsp = servings.some(s => s.label.trim().toLowerCase() === '1 tbsp');
          if (!hasTbsp) {
            servings = [{ id: generateId(), label: '1 tbsp', unit: 'tbsp', amount: 1 }, ...servings];
          }
        }

        const updatedFood: SavedFood = {
          ...existing,
          name: update.name.trim(),
          gramsPerTbsp: update.gramsPerTbsp,
          // Preserve the existing per-food density when the caller omits it; an
          // explicit value (validated > 0) overrides. Never write null.
          densityGramsPerMl:
            update.densityGramsPerMl !== undefined
              ? update.densityGramsPerMl
              : existing.densityGramsPerMl,
          nutrientsPerUnit: normalizeTotals(update.nutrientsPerUnit),
          servings,
          updatedAt: now
        };

        const savedFoods = [...data.savedFoods];
        savedFoods[idx] = updatedFood;
        const updatedData: AppData = { ...data, savedFoods };
        return this.storageService.saveData(updatedData).pipe(map(() => updatedFood));
      })
    );
  }

  deleteSavedFood(savedFoodId: string): Observable<boolean> {
    if (!savedFoodId) {
      return throwError(() => new DietValidationError(['Saved food ID is required']));
    }

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));
        const exists = data.savedFoods.some(f => f.id === savedFoodId);
        if (!exists) return throwError(() => new Error('Saved food not found'));

        const updatedData: AppData = {
          ...data,
          savedFoods: data.savedFoods.filter(f => f.id !== savedFoodId)
        };
        return this.storageService.saveData(updatedData).pipe(map(() => true));
      })
    );
  }

  getMealsForDay(dayLocal: string): Observable<MealEntry[]> {
    const { startMs, endMs } = localDayBounds(dayLocal);
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return [];
        return [...data.mealEntries]
          .filter(m => {
            const t = new Date(m.dateTime).getTime();
            return Number.isFinite(t) && t >= startMs && t <= endMs;
          })
          .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      })
    );
  }

  addMeal(input: CreateMealEntry): Observable<MealEntry> {
    const errors: string[] = [];
    if (!input.dateTime || !isValidISO(input.dateTime)) errors.push('Meal date/time is required');
    if (!input.items || input.items.length === 0) errors.push('At least one meal item is required');
    for (const it of input.items ?? []) {
      if (!it.savedFoodId) errors.push('Meal item food is required');
      if (!it.servingId) errors.push('Meal item serving is required');
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) errors.push('Meal item quantity must be > 0');
    }
    if (errors.length) {
      return throwError(() => new DietValidationError(errors));
    }

    const now = new Date().toISOString();

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));

        const items: MealItem[] = [];
        for (const it of input.items) {
          const food = data.savedFoods.find(f => f.id === it.savedFoodId);
          if (!food) return throwError(() => new Error('Saved food not found'));
          const serving = food.servings.find(s => s.id === it.servingId);
          if (!serving) return throwError(() => new Error('Serving not found'));

          const usedUnits = serving.amount * it.quantity;
          const baseUnits = toBaseUnits(food, serving.unit, usedUnits);
          const totals = scaleFoodTotals(food, baseUnits);

          items.push({
            id: generateId(),
            savedFoodId: food.id,
            savedFoodName: food.name,
            servingId: serving.id,
            servingLabel: serving.label,
            unit: serving.unit,
            quantity: it.quantity,
            snapshot: {
              baseUnits,
              totals,
              unit: serving.unit,
              servingLabel: serving.label
            }
          });
        }

        const totals = sumTotals(items.map(i => i.snapshot.totals));

        const meal: MealEntry = {
          id: generateId(),
          dateTime: input.dateTime,
          mealType: input.mealType,
          notes: input.notes?.trim() || undefined,
          items,
          totals,
          createdAt: now,
          updatedAt: now
        };

        const updatedData: AppData = {
          ...data,
          mealEntries: [...data.mealEntries, meal]
        };

        return this.storageService.saveData(updatedData).pipe(map(() => meal));
      })
    );
  }

  updateMeal(mealId: string, input: CreateMealEntry): Observable<MealEntry> {
    const errors: string[] = [];
    if (!mealId) errors.push('Meal ID is required');
    if (!input.dateTime || !isValidISO(input.dateTime)) errors.push('Meal date/time is required');
    if (!input.items || input.items.length === 0) errors.push('At least one meal item is required');
    for (const it of input.items ?? []) {
      if (!it.savedFoodId) errors.push('Meal item food is required');
      if (!it.servingId) errors.push('Meal item serving is required');
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) errors.push('Meal item quantity must be > 0');
    }
    if (errors.length) {
      return throwError(() => new DietValidationError(errors));
    }

    const now = new Date().toISOString();

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));

        const idx = data.mealEntries.findIndex(m => m.id === mealId);
        if (idx < 0) return throwError(() => new Error('Meal not found'));
        const existing = data.mealEntries[idx];

        const itemsUnchanged = sameMealItems(existing, input);

        let updatedItems = existing.items;
        let totals = existing.totals;

        if (!itemsUnchanged) {
          try {
            const built = buildMealItems(data, input);
            updatedItems = built.items;
            totals = built.totals;
          } catch (e) {
            return throwError(() => (e instanceof Error ? e : new Error('Failed to update meal')));
          }
        }

        const updatedMeal: MealEntry = {
          ...existing,
          dateTime: input.dateTime,
          mealType: input.mealType,
          notes: input.notes?.trim() || undefined,
          items: updatedItems,
          totals,
          updatedAt: now
        };

        const mealEntries = [...data.mealEntries];
        mealEntries[idx] = updatedMeal;
        const updatedData: AppData = { ...data, mealEntries };

        return this.storageService.saveData(updatedData).pipe(map(() => updatedMeal));
      })
    );
  }

  deleteMeal(mealId: string): Observable<boolean> {
    if (!mealId) {
      return throwError(() => new DietValidationError(['Meal ID is required']));
    }

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));
        const exists = data.mealEntries.some(m => m.id === mealId);
        if (!exists) return of(false);

        const updatedData: AppData = {
          ...data,
          mealEntries: data.mealEntries.filter(m => m.id !== mealId)
        };

        return this.storageService.saveData(updatedData).pipe(map(() => true));
      })
    );
  }

  computeDailyTotals(meals: MealEntry[]): NutritionTotals {
    return sumTotals(meals.map(m => m.totals));
  }

  /**
   * All meals whose `dateTime` falls within `[startMs, endMs]` (inclusive),
   * sorted ascending by `dateTime`. Consumed by the charts page (plan 02-05);
   * `getMealsForDay` stays for the single-day diet view.
   */
  getMealsInRange(startMs: number, endMs: number): Observable<MealEntry[]> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return [];
        return [...data.mealEntries]
          .filter(m => {
            const t = Date.parse(m.dateTime);
            return Number.isFinite(t) && t >= startMs && t <= endMs;
          })
          .sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime));
      })
    );
  }

  /**
   * Map a previous meal's items into the editable pending-item shape used by the
   * diet page, RE-DERIVING the live `preview` from the CURRENT `SavedFood`
   * ("what I'm eating now" — D-09 / A5), NOT from the historical snapshot. If the
   * food no longer exists in `currentFoods`, fall back to the item's frozen
   * snapshot totals. Pure mapping helper — the component owns the read of
   * `currentFoods` and calling this.
   */
  copyMealItems(
    meal: MealEntry,
    currentFoods: SavedFood[]
  ): Array<{ savedFoodId: string; servingId: string; quantity: number; label: string; preview: NutritionTotals }> {
    return meal.items.map(it => {
      const food = currentFoods.find(f => f.id === it.savedFoodId);
      let preview: NutritionTotals;

      if (food) {
        const serving = food.servings.find(s => s.id === it.servingId);
        if (serving) {
          try {
            const baseUnits = toBaseUnits(food, serving.unit, serving.amount * it.quantity);
            preview = scaleFoodTotals(food, baseUnits);
          } catch {
            // Food can no longer resolve this serving's unit (e.g. density removed)
            // — fall back to the frozen snapshot rather than failing the copy.
            preview = it.snapshot.totals;
          }
        } else {
          preview = it.snapshot.totals;
        }
      } else {
        preview = it.snapshot.totals;
      }

      return {
        savedFoodId: it.savedFoodId,
        servingId: it.servingId,
        quantity: it.quantity,
        label: `${it.savedFoodName} - ${it.servingLabel} x${it.quantity}`,
        preview
      };
    });
  }

  /** The persisted daily nutrition targets, or `undefined` when unset (D-08). */
  getDailyTargets(): Observable<DailyTargets | undefined> {
    return this.storageService.getData().pipe(
      map(data => data?.dailyTargets)
    );
  }

  /**
   * Persist daily nutrition targets (validated via `validateDailyTargets`).
   * Throws `DietValidationError` on an invalid metric.
   */
  setDailyTargets(targets: DailyTargets): Observable<DailyTargets> {
    const errors = validateDailyTargets(targets);
    if (errors.length) {
      return throwError(() => new DietValidationError(errors));
    }

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));
        const updatedData: AppData = { ...data, dailyTargets: targets };
        return this.storageService.saveData(updatedData).pipe(map(() => targets));
      })
    );
  }

  /** Remove the persisted daily targets — omits the field entirely, never null. */
  clearDailyTargets(): Observable<void> {
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));
        const { dailyTargets: _removed, ...rest } = data;
        const updatedData: AppData = { ...rest };
        return this.storageService.saveData(updatedData).pipe(map(() => undefined));
      })
    );
  }
}

function sameMealItems(existing: MealEntry, input: CreateMealEntry): boolean {
  if (existing.items.length !== input.items.length) return false;

  for (let i = 0; i < input.items.length; i++) {
    const a = existing.items[i];
    const b = input.items[i];
    if (a.savedFoodId !== b.savedFoodId) return false;
    if (a.servingId !== b.servingId) return false;
    if (a.quantity !== b.quantity) return false;
  }

  return true;
}

function buildMealItems(data: AppData, input: CreateMealEntry): { items: MealItem[]; totals: NutritionTotals } {
  const items: MealItem[] = [];

  for (const it of input.items) {
    const food = data.savedFoods.find(f => f.id === it.savedFoodId);
    if (!food) {
      throw new DietValidationError(['Saved food not found']);
    }
    const serving = food.servings.find(s => s.id === it.servingId);
    if (!serving) {
      throw new DietValidationError(['Serving not found']);
    }

    const usedUnits = serving.amount * it.quantity;
    const baseUnits = toBaseUnits(food, serving.unit, usedUnits);
    const totals = scaleFoodTotals(food, baseUnits);

    items.push({
      id: generateId(),
      savedFoodId: food.id,
      savedFoodName: food.name,
      servingId: serving.id,
      servingLabel: serving.label,
      unit: serving.unit,
      quantity: it.quantity,
      snapshot: {
        baseUnits,
        totals,
        unit: serving.unit,
        servingLabel: serving.label
      }
    });
  }

  const totals = sumTotals(items.map(i => i.snapshot.totals));
  return { items, totals };
}

function isValidISO(value: string): boolean {
  const d = new Date(value);
  return Number.isFinite(d.getTime());
}

function localDayBounds(dayLocal: string): { startMs: number; endMs: number } {
  const start = new Date(`${dayLocal}T00:00:00`);
  const end = new Date(`${dayLocal}T23:59:59.999`);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function normalizeTotals(t: NutritionTotals): NutritionTotals {
  return {
    caloriesKcal: safeNumber(t.caloriesKcal),
    proteinG: safeNumber(t.proteinG),
    fatG: safeNumber(t.fatG),
    carbsG: safeNumber(t.carbsG),
    fiberG: safeNumber(t.fiberG),
    sugarG: safeNumber(t.sugarG),
    sodiumMg: safeNumber(t.sodiumMg),
    netCarbsG: Math.max(0, safeNumber(t.netCarbsG))
  };
}

function safeNumber(n: unknown): number {
  return Number.isFinite(n as number) ? (n as number) : 0;
}

export function scaleFoodTotals(food: SavedFood, baseUnits: number): NutritionTotals {
  const factor = Number.isFinite(baseUnits) ? baseUnits : 0;

  const carbsG = food.nutrientsPerUnit.carbsG * factor;
  const fiberG = food.nutrientsPerUnit.fiberG * factor;

  return {
    caloriesKcal: food.nutrientsPerUnit.caloriesKcal * factor,
    proteinG: food.nutrientsPerUnit.proteinG * factor,
    fatG: food.nutrientsPerUnit.fatG * factor,
    carbsG,
    fiberG,
    sugarG: food.nutrientsPerUnit.sugarG * factor,
    sodiumMg: food.nutrientsPerUnit.sodiumMg * factor,
    netCarbsG: Math.max(0, carbsG - fiberG)
  };
}

function defaultServingsFor(baseUnit: FoodUnit, gramsPerTbsp?: number): SavedFoodServing[] {
  const servings: SavedFoodServing[] = [];

  if (baseUnit === 'g') {
    servings.push({ id: generateId(), label: '100 g', unit: 'g', amount: 100 });
    if (gramsPerTbsp && Number.isFinite(gramsPerTbsp) && gramsPerTbsp > 0) {
      servings.push({ id: generateId(), label: '1 tbsp', unit: 'tbsp', amount: 1 });
    }
    return servings;
  }

  // baseUnit === 'tbsp'
  servings.push({ id: generateId(), label: '1 tbsp', unit: 'tbsp', amount: 1 });
  if (gramsPerTbsp && Number.isFinite(gramsPerTbsp) && gramsPerTbsp > 0) {
    servings.push({ id: generateId(), label: '100 g', unit: 'g', amount: 100 });
  }
  return servings;
}

/** ml per tablespoon — the canonical factor units.ts uses (for legacy derivation). */
const ML_PER_TBSP = 14.78676478125;

/**
 * Resolve a food's effective per-food density (g/ml).
 *
 * Prefers the explicit `densityGramsPerMl`; for legacy foods that only carry a
 * positive `gramsPerTbsp`, derive `density = gramsPerTbsp / ML_PER_TBSP` (mirrors
 * the V6→V7 migration so in-memory pre-migration data still converts). Returns
 * `undefined` when neither is usable — NEVER a global default (DIET-03 / D-04).
 */
function effectiveDensity(food: SavedFood): number | undefined {
  if (food.densityGramsPerMl !== undefined && Number.isFinite(food.densityGramsPerMl) && food.densityGramsPerMl > 0) {
    return food.densityGramsPerMl;
  }
  const gpt = food.gramsPerTbsp;
  if (gpt !== undefined && Number.isFinite(gpt) && gpt > 0) {
    return gpt / ML_PER_TBSP;
  }
  return undefined;
}

/**
 * Resolve a measured (`unit`, `amount`) into the food's `baseUnit` count by
 * DELEGATING to the pure `units.ts` conversion (D-04). Identity returns the
 * amount unchanged; same-dimension converts via the fixed table; cross-dimension
 * requires the food's effective density and otherwise THROWS — no default density
 * ever leaks into the service path. `UnitConversionError` is mapped to the typed
 * `DietValidationError` so callers get the domain error.
 */
function toBaseUnits(food: SavedFood, unit: FoodUnit, amount: number): number {
  if (unit === food.baseUnit) return amount;

  try {
    return convertMeasured(amount, unit, food.baseUnit, effectiveDensity(food));
  } catch (e) {
    if (e instanceof UnitConversionError) {
      throw new DietValidationError([
        `Cannot convert ${unit} to ${food.baseUnit} for this food without a density`
      ]);
    }
    throw e;
  }
}

export function sumTotals(totals: NutritionTotals[]): NutritionTotals {
  const sum = totals.reduce((acc, t) => {
    acc.caloriesKcal += safeNumber(t.caloriesKcal);
    acc.proteinG += safeNumber(t.proteinG);
    acc.fatG += safeNumber(t.fatG);
    acc.carbsG += safeNumber(t.carbsG);
    acc.fiberG += safeNumber(t.fiberG);
    acc.sugarG += safeNumber(t.sugarG);
    acc.sodiumMg += safeNumber(t.sodiumMg);
    return acc;
  }, {
    caloriesKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
    netCarbsG: 0
  } as NutritionTotals);

  sum.netCarbsG = Math.max(0, sum.carbsG - sum.fiberG);
  return sum;
}
