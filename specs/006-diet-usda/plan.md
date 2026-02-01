# Implementation Plan: Diet Logging (Manual Food Library)

**Branch**: `006-diet-usda` | **Date**: 2026-01-31 | **Spec**: [spec.md](./spec.md)

## Summary

Add a new Diet feature that lets users build a local saved-food catalog by manually entering nutrition per unit (per 1 g or per 1 tbsp). Users can then log meals by selecting saved foods and serving presets, and the app computes per-meal and per-day nutrition totals including keto-relevant metrics (fiber/sugar/sodium + net carbs).

## Architecture

### New Models

- `SavedFood` (local food catalog entry; stores nutrients per base unit + serving presets)
- `SavedFoodServing` (label + grams)
- `MealEntry` (timestamp + optional notes + items)
- `MealItem` (references a `savedFoodId`, selected serving, quantity, grams; stores nutrient snapshot)
- `NutritionTotals` (calories, protein, fat, carbs, fiber, sugar, sodium, netCarbs)

### New Services

- `DietService`
  - CRUD: saved foods, meals
  - Computes nutrition snapshots and daily totals

### Storage

- Update `src/app/models/app-data.model.ts`:
  - bump schema version (1 -> 2)
  - add `savedFoods: SavedFood[]` and `mealEntries: MealEntry[]`
- Update `src/app/services/storage.service.ts`:
  - add migration v1 -> v2 that adds the new arrays

### Nutrition Source

- No external API. Foods are created manually with nutrition values per base unit.

## UI

- Add new route + nav link: `/diet`.
- `DietPageComponent` responsibilities:
  - display day picker + daily totals
  - list meals for selected day
  - add meal (modal/inline form)
  - add meal items by selecting from Saved Foods
  - add foods by manually entering nutrition per base unit
  - manage Saved Foods servings (add/edit custom presets)

## Nutrition Computation

- Saved foods store nutrients per base unit (per 1 g or per 1 tbsp).
- Serving presets store a unit (g/tbsp) plus an amount.
- For a meal item:
  - determine consumed amount in the serving unit
  - convert to base units when needed (requires grams-per-tbsp)
  - per-nutrient scaling: `scaled = perUnit * baseUnits`
  - `netCarbs = max(0, carbs - fiber)`
- Store `NutritionTotals` snapshot on each meal item and aggregated totals on the meal.

## Testing

- Unit tests for:
  - nutrient scaling and net carb calculation
  - DietService add meal stores snapshots and totals
  - migration v1->v2 preserves existing arrays
- No HTTP integration tests needed.
