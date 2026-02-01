export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type FoodUnit = 'g' | 'tbsp';

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

  /** Optional grams-per-tablespoon density for converting between g and tbsp. */
  gramsPerTbsp?: number;

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
  nutrientsPerUnit: NutritionTotals;
  servings?: SavedFoodServing[];
}

export interface MealItemSnapshot {
  baseUnits: number;
  totals: NutritionTotals;
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
