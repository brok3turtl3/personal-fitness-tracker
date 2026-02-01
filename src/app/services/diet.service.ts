import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { StorageService } from './storage.service';
import { AppData } from '../models/app-data.model';
import {
  CreateMealEntry,
  CreateSavedFood,
  FoodUnit,
  MealEntry,
  MealItem,
  NutritionTotals,
  SavedFood,
  SavedFoodServing
} from '../models/diet.model';

export class DietValidationError extends Error {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join('; '));
    this.name = 'DietValidationError';
    this.errors = errors;
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
    if (input.baseUnit !== 'g' && input.baseUnit !== 'tbsp') errors.push('Food base unit is required');
    if (input.gramsPerTbsp !== undefined) {
      if (!Number.isFinite(input.gramsPerTbsp) || input.gramsPerTbsp <= 0) {
        errors.push('Grams per tbsp must be > 0');
      }
    }
    const servingsInput = (input.servings ?? []).filter(Boolean);
    if (servingsInput.length > 0) {
      for (const s of servingsInput) {
        if (!s.label || !s.label.trim().length) errors.push('Serving label is required');
        if (s.unit !== 'g' && s.unit !== 'tbsp') errors.push('Serving unit is required');
        if (!Number.isFinite(s.amount) || s.amount <= 0) errors.push('Serving amount must be > 0');
      }
    }
    if (errors.length) {
      return throwError(() => new DietValidationError(errors));
    }

    const now = new Date().toISOString();
    const defaultServings: SavedFoodServing[] = defaultServingsFor(input.baseUnit, input.gramsPerTbsp);

    const savedFood: SavedFood = {
      id: generateUUID(),
      name: input.name.trim(),
      baseUnit: input.baseUnit,
      gramsPerTbsp: input.gramsPerTbsp,
      nutrientsPerUnit: normalizeTotals(input.nutrientsPerUnit),
      servings: (servingsInput.length ? servingsInput : defaultServings).map(s => ({
        id: s.id || generateUUID(),
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
    if (unit !== 'g' && unit !== 'tbsp') errors.push('Serving unit is required');
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
          servings: [...data.savedFoods[idx].servings, { id: generateUUID(), label: label.trim(), unit, amount }],
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
            servings = [{ id: generateUUID(), label: '1 tbsp', unit: 'tbsp', amount: 1 }, ...servings];
          }
        }

        const updatedFood: SavedFood = {
          ...existing,
          name: update.name.trim(),
          gramsPerTbsp: update.gramsPerTbsp,
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
            id: generateUUID(),
            savedFoodId: food.id,
            savedFoodName: food.name,
            servingId: serving.id,
            servingLabel: serving.label,
            unit: serving.unit,
            quantity: it.quantity,
            snapshot: {
              baseUnits,
              totals
            }
          });
        }

        const totals = sumTotals(items.map(i => i.snapshot.totals));

        const meal: MealEntry = {
          id: generateUUID(),
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
      id: generateUUID(),
      savedFoodId: food.id,
      savedFoodName: food.name,
      servingId: serving.id,
      servingLabel: serving.label,
      unit: serving.unit,
      quantity: it.quantity,
      snapshot: {
        baseUnits,
        totals
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
    servings.push({ id: generateUUID(), label: '100 g', unit: 'g', amount: 100 });
    if (gramsPerTbsp && Number.isFinite(gramsPerTbsp) && gramsPerTbsp > 0) {
      servings.push({ id: generateUUID(), label: '1 tbsp', unit: 'tbsp', amount: 1 });
    }
    return servings;
  }

  // baseUnit === 'tbsp'
  servings.push({ id: generateUUID(), label: '1 tbsp', unit: 'tbsp', amount: 1 });
  if (gramsPerTbsp && Number.isFinite(gramsPerTbsp) && gramsPerTbsp > 0) {
    servings.push({ id: generateUUID(), label: '100 g', unit: 'g', amount: 100 });
  }
  return servings;
}

function toBaseUnits(food: SavedFood, unit: FoodUnit, amount: number): number {
  if (unit === food.baseUnit) return amount;

  // Conversion required
  const gpt = food.gramsPerTbsp;
  if (!gpt || !Number.isFinite(gpt) || gpt <= 0) {
    throw new DietValidationError(['Cannot convert between g and tbsp without grams-per-tbsp for this food']);
  }

  // unit != baseUnit implies one is g and the other is tbsp
  if (food.baseUnit === 'g' && unit === 'tbsp') {
    // amount tbsp -> grams
    return amount * gpt;
  }

  if (food.baseUnit === 'tbsp' && unit === 'g') {
    // amount grams -> tbsp
    return amount / gpt;
  }

  throw new DietValidationError(['Unsupported unit conversion']);
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
