/**
 * Typed legacy shapes for the AppData migration chain.
 *
 * One interface per from-version. Each `migrateVxToVy()` in storage.service.ts
 * (Wave 2 plan 09) accepts the concrete `LegacyAppDataVN` shape and returns
 * `LegacyAppDataV{N+1}` (or the current `AppData` for the latest hop).
 *
 * Replaces the 5 `as any` casts at storage.service.ts:296, 298, 306, 324, 350
 * (CONCERNS.md "any-typed code in schema migration"). Strict-TS now catches
 * typos in legacy field names that previously slipped silently.
 *
 * No runtime code — type-only module. Mirrors validators.ts pure-module
 * pattern but with types only (no `@Injectable`, no class).
 */
import { CardioSession } from '../models/cardio-session.model';
import { WeightEntry } from '../models/weight-entry.model';
import { HealthReading } from '../models/health-reading.model';
import { SavedFood, MealEntry } from '../models/diet.model';

/**
 * Pre-versioning shape. No `schemaVersion` field.
 * Stored before commit that introduced schema versioning.
 * All top-level arrays may be missing (defensive — real-world V0 data was thin).
 */
export interface LegacyAppDataV0 {
  cardioSessions?: CardioSession[];
  weightEntries?: WeightEntry[];
  healthReadings?: HealthReading[];
  lastModified?: string;
}

/**
 * V1 shape: introduces schemaVersion. Top-level arrays now required.
 * No savedFoods/mealEntries yet.
 */
export interface LegacyAppDataV1 {
  schemaVersion: 1;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  lastModified: string;
}

/**
 * V2 saved-food shape — pre-V3 nutrient/serving structure.
 * Replaces the `as any` reads at storage.service.ts:296, 298, 306, 324, 350.
 *
 * V2 stored nutrition as `nutrientsPer100g` and servings with `grams` only.
 * V3+ widens to `baseUnit` and `nutrientsPerUnit`; V5+ (Phase 2) adds densities.
 */
export interface LegacySavedFoodV2 {
  id: string;
  fdcId?: number;
  name: string;
  nutrientsPer100g?: {
    caloriesKcal?: number;
    proteinG?: number;
    fatG?: number;
    carbsG?: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    netCarbsG?: number;
  };
  servings?: Array<{ id: string; label: string; grams?: number }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * V2 shape: introduces savedFoods (in legacy nutrientsPer100g shape) + mealEntries.
 */
export interface LegacyAppDataV2 {
  schemaVersion: 2;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  savedFoods: LegacySavedFoodV2[];
  mealEntries: unknown[];
  lastModified: string;
}

/**
 * V3 shape: savedFoods migrated to current SavedFood shape (baseUnit/nutrientsPerUnit).
 * No chatConversations/aiSettings yet — those are V4+.
 */
export interface LegacyAppDataV3 {
  schemaVersion: 3;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  savedFoods: SavedFood[];
  mealEntries: MealEntry[];
  lastModified: string;
}
