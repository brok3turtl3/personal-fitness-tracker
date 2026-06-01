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
import { SavedFood, MealEntry, NutritionTotals, SavedFoodServing } from '../models/diet.model';
import type {
  AISettings,
  AIToolSettings,
  ChatBlock,
} from '../models/ai-chat.model';
import type { UserProfile } from '../models/user-profile.model';

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

/**
 * V4 chat message shape: pre-blocks. `content: string` is the legacy field
 * V4→V5 lifts into `blocks: [{ type: 'text', text: <content> }]` (D-15).
 */
export interface LegacyChatMessageV4 {
  id: string;
  role: 'user' | 'assistant';
  /** V4 — pre-blocks shape. V5 replaces this with `blocks: ChatBlock[]`. */
  content: string;
  tokenEstimate: number;
  createdAt: string;
}

/**
 * V4 chat conversation shape: messages still carry `content: string`.
 */
export interface LegacyChatConversationV4 {
  id: string;
  title: string;
  messages: LegacyChatMessageV4[];
  summary?: string;
  summarizedMessageCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * V4 shape: chat conversations exist; ChatMessage.content is a STRING. No
 * memoryFiles, userProfile, aiToolSettings (those are V5+).
 */
export interface LegacyAppDataV4 {
  schemaVersion: 4;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  savedFoods: SavedFood[];
  mealEntries: MealEntry[];
  aiSettings?: AISettings;
  chatConversations: LegacyChatConversationV4[];
  lastModified: string;
}

/**
 * V5 chat message shape (Phase 5 V5→V6 analog of LegacyChatMessageV4).
 *
 * V5 ChatMessage already carries `blocks: ChatBlock[]` (the V4→V5 cut-over,
 * D-15) — but those blocks pre-date Phase 5's web-search additions: NO
 * `server_tool_use` / `web_search_tool_result` variants, NO `citations` on text
 * blocks. The V5→V6 hop is additive on the union, so the existing blocks are
 * already valid V6 — `ChatBlock[]` types them faithfully (the new variants are
 * union members; the existing text-only blocks remain assignable).
 */
export interface LegacyChatMessageV5 {
  id: string;
  role: 'user' | 'assistant';
  /** V5 blocks — pre-web-search. Assignable to the V6 ChatBlock union (additive). */
  blocks: ChatBlock[];
  tokenEstimate: number;
  createdAt: string;
}

/**
 * V5 chat conversation shape: messages carry `blocks` (pre-web-search).
 */
export interface LegacyChatConversationV5 {
  id: string;
  title: string;
  messages: LegacyChatMessageV5[];
  summary?: string;
  summarizedMessageCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * V5 shape (Phase 3 baseline): memoryFiles, userProfile, aiToolSettings present;
 * ChatMessage.blocks present (pre-web-search). No top-level slice changes in
 * V5→V6 — the migration is additive on the existing chat-block union, so the V5
 * shape is structurally a valid V6 modulo the bumped schemaVersion.
 *
 * Phase 5 (RESEARCH §Schema-migration A3): we plan V6 regardless because the
 * persisted `ChatBlock` shape now admits new variants + `citations` — bumping the
 * version + writing a backward-compat fixture is the FOUND-07 discipline even when
 * the data transform is a no-op for existing fields.
 */
export interface LegacyAppDataV5 {
  schemaVersion: 5;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  savedFoods: SavedFood[];
  mealEntries: MealEntry[];
  aiSettings?: AISettings;
  chatConversations: LegacyChatConversationV5[];
  memoryFiles: Record<string, string>;
  userProfile: UserProfile;
  aiToolSettings: AIToolSettings;
  lastModified: string;
}

/**
 * V6 saved-food shape — the NARROW pre-V7 diet structure (D-13, Plan 02-02).
 *
 * V6 foods carried only `baseUnit: 'g' | 'tbsp'` and an optional
 * `gramsPerTbsp?`; the Phase 2 V7 widening adds `densityGramsPerMl?`,
 * `preferredUnits?`, and the full `MeasuredUnit` base-unit union. Typing
 * `LegacyAppDataV6.savedFoods` as this interface (NOT the widened `SavedFood`)
 * keeps the migration INPUT honestly narrow — strict-TS guarantees
 * `migrateSavedFoodV6ToV7` only reads pre-V7 fields and never assumes the new
 * ones are already present.
 *
 * The legacy `fdcId` runtime extra (carried on some imported foods) is declared
 * here so the spread-preserve passthrough in `migrateSavedFoodV6ToV7` survives
 * strict typing. `nutrientsPerUnit`/`servings` reuse the already-migrated
 * (V3+) shapes — those did not change between V3 and V6.
 */
export interface LegacySavedFoodV6 {
  id: string;
  fdcId?: number;
  name: string;
  /** V6 base unit — pre-widening. V7 widens to the full MeasuredUnit union. */
  baseUnit: 'g' | 'tbsp';
  /** Legacy density bridge. V6→V7 derives `densityGramsPerMl` from this. */
  gramsPerTbsp?: number;
  nutrientsPerUnit: NutritionTotals;
  servings: SavedFoodServing[];
  createdAt: string;
  updatedAt: string;
}

/**
 * V6 shape (Phase 5): structurally identical to V5 for every non-chat slice;
 * the V5→V6 transform only widened the persisted `ChatBlock` union (additive),
 * so the AppData-level shape is unchanged apart from `schemaVersion: 6`.
 *
 * The narrow pre-V7 diet fields still hold: `savedFoods` is typed
 * `LegacySavedFoodV6[]` — carries `gramsPerTbsp?` but NO
 * `densityGramsPerMl`/`preferredUnits` — and there is NO `dailyTargets` at the
 * AppData level. `migrateV6ToV7` widens these additively. (Plan 02-02 owns the
 * dedicated V6/V7 fixtures + malformed matrix; this interface lands here so the
 * V7 chain hop — introduced in plan 02-01 to keep CURRENT_SCHEMA_VERSION=7
 * consistent — is typed against the honestly-narrow V6 input.)
 */
export interface LegacyAppDataV6 {
  schemaVersion: 6;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  savedFoods: LegacySavedFoodV6[];
  mealEntries: MealEntry[];
  aiSettings?: AISettings;
  chatConversations: LegacyChatConversationV5[];
  memoryFiles: Record<string, string>;
  userProfile: UserProfile;
  aiToolSettings: AIToolSettings;
  lastModified: string;
}
