---
phase: 02-diet-ux-overhaul
verified: 2026-06-01T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (all success criteria pass automated checks)
overrides_applied: 0
orchestrator_resolution: "Item 1 ('No density set' note gating) was a code defect, not a human-test item — FIXED by the orchestrator in commit b7c8676: added a selectedFoodConvertible getter delegating to effectiveDensity and gated the note on it; regression assertions added to the CR-01 spec. 842/842 green, tsc clean. Only the DIET-02 named-serving browser smoke remains for human confirmation."
human_verification:
  - test: "Verify DIET-02 user-facing completeness: add a saved food with a custom serving labeled '1 cup' (unit=cup, amount=236), then log that food selecting the '1 cup' serving — confirm macros compute correctly"
    expected: "Custom serving is selectable in the meal-log picker, quantity x1 produces correct macro totals from the stored gram-equivalent"
    why_human: "REQUIREMENTS.md marks DIET-02 as Pending and the requirement description references named servings like '1 cup', '1 slice', '1 medium banana'. The model and service support this but a human should confirm the full end-to-end UX path is smooth."
---

# Phase 2: Diet UX Overhaul Verification Report

**Phase Goal:** The user's daily diet-logging friction is gone — adding new foods, picking the right unit, copying yesterday's meal, and seeing accurate daily totals all happen without leaving the meal-log flow.
**Verified:** 2026-06-01T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | A user mid-meal-log can quick-add a new food without leaving the meal-log flow, and the new food is immediately available to log | VERIFIED | `onQuickAdd()` in diet-page.component.ts:1269-1291 calls `dietService.addSavedFood(...)` then immediately stages the food as a `pendingItem` (lines 1271-1283). Template shows inline form at lines 431-502 triggered when `filterFoods` returns empty. `addSavedFood` accepts widened unit set (isMeasuredUnit gate at diet.service.ts:53). |
| SC-2 | A user can log a food in any declared native unit with correct weight↔volume conversions via each food's own density — no global density assumption | VERIFIED | `effectiveDensity(food)` in units.ts:100-110 is the single shared authority used by both diet.service.ts:615 and diet-page.component.ts:1308. Throws `UnitConversionError` when density is absent for cross-dimension. `servingUnitOptions()` gates cross-dimension units on `effectiveDensity(food) !== undefined` (line 1103). No hardcoded global density constant in any conversion path confirmed. |
| SC-3 | A user can log a meal with search-as-you-type, recent foods, auto-ranked favorites, and can copy a previous day's meal with one action | VERIFIED | `filterFoods` wired to food search (lines 1197, 1606); `recentFoods` produces "Recent" group on focus (line 1657); `rankFoods` produces "Frequent" group (line 1658); group labels "Recent"/"Frequent" (not "Favorites") at template lines 400/410. `repeatYesterday()` + `copyFromDay()` call `dietService.copyMealItems()` and append to `pendingItems` (lines 1546-1588). |
| SC-4 | A user logging a meal sees scannable live daily totals (kcal/protein/fat/carbs/net carbs) with optional %-of-target bars, plus a charts-page diet history surface | VERIFIED | `recomputeLiveTotals()` at line 1664 calls `sumTotals([...saved meals..., ...pendingItems])`. Target bars via `targetBarFor()` (line ~1511) loaded by `loadTargets()`. Charts page injects `DietService`, uses `sumByDay` (line 680), and has all 5 diet toggles (`dietShowCalories/Protein/Fat/Carbs/NetCarbs`) in `controlsForm`. Locked palette verified: `#e67e22` (calories), `#16a085` (protein), `#f1c40f` (fat), `#8e44ad` (carbs), `#c0392b`+`borderDash:[4,4]` (net carbs). |
| SC-5 | Editing a saved food produces zero retroactive change to historical meal entries; day-boundary math uses local time consistently including across DST | VERIFIED | `updateSavedFood` in diet.service.ts:173-194 modifies only `savedFoods` — `mealEntries` is never written. `buildMealItems` at line 525-531 stores `snapshot: { baseUnits, totals, unit: serving.unit, servingLabel: serving.label }` at log time. `toDateKey` uses local `getFullYear/getMonth/getDate` (chart-grouping.ts:12-16). DST spec assertions at chart-grouping.spec.ts:111-130 cover 2026-03-08 spring-forward and 2026-11-01 fall-back. |

**Score:** 5/5 success criteria verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/services/units.ts` | Pure unit/density conversion module | VERIFIED | Exports `convertMeasured`, `toBaseUnits`, `isMeasuredUnit`, `UnitConversionError`, `effectiveDensity`, `sameDimension`, `dimensionOf`, `ML_PER_TBSP`. No `@Injectable`/class/DI. |
| `src/app/services/food-ranking.ts` | Pure search + favorite-ranking module | VERIFIED | Exports `filterFoods`, `rankFoods`, `recentFoods`. `HALF_LIFE_DAYS=14`. No `Date.now()` internal call. `now` is injected. |
| `src/app/models/diet.model.ts` | Widened FoodUnit union + densityGramsPerMl + widened MealItemSnapshot + DailyTargets | VERIFIED | `FoodUnit = MeasuredUnit` (import from units.ts). `SavedFood.densityGramsPerMl?: number`. `SavedFood.preferredUnits?: FoodUnit[]`. `MealItemSnapshot.unit?: FoodUnit; servingLabel?: string`. `DailyTargets` interface present. |
| `src/app/models/app-data.model.ts` | CURRENT_SCHEMA_VERSION=7 + dailyTargets? on AppData | VERIFIED | `CURRENT_SCHEMA_VERSION = 7` at line 77. `AppData.dailyTargets?: DailyTargets` at line 56. |
| `src/app/models/index.ts` | Barrel exports diet.model | VERIFIED | `export * from './diet.model'` at line 8. |
| `src/app/shared/chart-grouping.ts` | sumByDay sibling to groupByDay | VERIFIED | `export function sumByDay` at line 68. Uses `toDateKey`, `round2`. SUM (not average). `fieldCount = group[0]?.length ?? 0` guard in place. |
| `src/app/services/legacy-schemas.ts` | LegacyAppDataV6 typed interface | VERIFIED | `LegacyAppDataV6` interface at line 246. `LegacySavedFoodV6` typed with narrow `baseUnit: 'g' | 'tbsp'`. No `densityGramsPerMl`/`preferredUnits` on V6 type. |
| `src/app/services/storage.service.ts` | migrateV6ToV7 + fromVersion < 7 chain hop | VERIFIED | `private migrateV6ToV7` at line 825. Chain hop `const v6: LegacyAppDataV6 = ...; const v7: AppData = (fromVersion < 7) ? this.migrateV6ToV7(v6) : (data as AppData)` at lines 624-630. |
| `src/app/services/validators.ts` | validateDensity + validateDailyTargets | VERIFIED | `export function validateDensity` at line 347. `export function validateDailyTargets` at line 365. Macro targets bounded by `VALIDATION_LIMITS.MACRO_TARGET_MAX` (WR-04 fix verified). |
| `src/app/services/diet.service.ts` | Widened conversion delegation + copy-meal + targets pass-through | VERIFIED | `import { effectiveDensity }` from units.ts at line 19. `getMealsInRange` at line 389. `copyMealItems` at line 411. `getDailyTargets/setDailyTargets/clearDailyTargets` at lines 448-483. |
| `src/app/features/diet/diet-page.component.ts` | Overhauled meal-log UX | VERIFIED | `filterFoods`/`rankFoods`/`recentFoods` imported and wired. `effectiveDensity` imported and used in `onAddMealItem` (line 1308) and `servingUnitOptions` (line 1103). No `window.confirm` found. `toBaseUnitsForPreview` deleted. "Add food & log it" CTA present. "Frequent" (not "Favorites") label. |
| `src/app/features/charts/charts-page.component.ts` | Diet calories+macros datasets + DietService injection + sumByDay | VERIFIED | `DietService` injected at line 370 (constructor). `sumByDay` imported and called at line 680. `groupByDay` NOT used for diet. All 5 diet toggles in `controlsForm`. Locked palette colors present. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| units.ts | diet.model.ts | type-only import of MeasuredUnit | NOT APPLICABLE | Inverted: diet.model.ts imports MeasuredUnit from units.ts (no circular dep). Correct per decision in 02-01 summary. |
| diet.service.ts toBaseUnits | units.ts | `from './units'` import of effectiveDensity + convertMeasured | VERIFIED | diet.service.ts:18-22 imports `convertMeasured, effectiveDensity, isMeasuredUnit, UnitConversionError`. Used at line 615. |
| diet.service.ts updateSavedFood | mealEntries (untouched) | identity-preserving food update | VERIFIED | updateSavedFood builds `updatedData = { ...data, savedFoods }` — never writes mealEntries. |
| storage.service.ts migrateData chain | migrateV6ToV7 | `fromVersion < 7` hop | VERIFIED | Lines 628-630 wired correctly after the v6 hop at lines 624-626. |
| charts-page.component.ts buildDietChart | chart-grouping.ts sumByDay | local-day summation on MealEntry.dateTime | VERIFIED | Line 680: `sumByDay(filtered, m => m.dateTime, m => [...])`. |
| charts-page.component.ts | diet.service.ts getMealsInRange | DietService injection | VERIFIED | `getMealsInRange(0, Date.now())` called in refresh at line 439. |
| diet-page.component.ts onAddMealItem | units.ts | effectiveDensity + toBaseUnits (toBaseUnitsForPreview deleted) | VERIFIED | Line 1308: `const density = effectiveDensity(food)`. Line 1311: `toBaseUnits(serving.unit, usedUnits, food.baseUnit, density)`. No `toBaseUnitsForPreview` in file. |
| diet-page.component.ts food picker | food-ranking.ts | filterFoods + rankFoods + recentFoods | VERIFIED | Lines 9/1197/1606/1657/1658. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| diet-page.component.ts | liveTotals | `recomputeLiveTotals()` → `sumTotals([...meals, ...pendingItems])` | Yes — real meal totals + live pending previews | FLOWING |
| diet-page.component.ts | dailyTargets | `dietService.getDailyTargets()` → StorageService.getData() | Yes — reads AppData.dailyTargets from localStorage | FLOWING |
| diet-page.component.ts | savedFoods | `dietService.getSavedFoods()` → StorageService.getData() | Yes — real food library | FLOWING |
| charts-page.component.ts | dietChartData | `buildDietChart` → `sumByDay(filtered meals)` | Yes — real meal data from getMealsInRange | FLOWING |
| charts-page.component.ts | mealEntries | `dietService.getMealsInRange(0, Date.now())` | Yes — reads from AppData.mealEntries | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — cannot run Angular app inline. Test suite (842/842) and production build (exit 0) per 02-REVIEW.md resolution confirm runnable behavior. Behavioral checks covered by spec assertions.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DIET-01 | 02-03, 02-04 | Quick-add food without leaving meal-log flow | SATISFIED | Inline quick-add form in diet-page + addSavedFood service path. Immediately staged as pendingItem. |
| DIET-02 | 02-01 | Each saved food can define its own native units with stored gram-equivalents | SATISFIED (code) / PENDING (REQUIREMENTS.md checkbox) | `SavedFoodServing { label, unit: FoodUnit, amount }` model present. `addCustomServing` in diet.service.ts. UI custom-serving form in diet-page. Wider unit set now available (g/oz/lb/ml/tsp/tbsp/cup). REQUIREMENTS.md marks Pending — this is a tracking artifact, not a code gap. |
| DIET-03 | 02-01, 02-03, 02-04 | Correct cross-unit conversion via per-food density, no global default | SATISFIED | `effectiveDensity` in units.ts is single source of truth. `convertMeasured` throws without per-food density. Component and service both use `effectiveDensity`. REQUIREMENTS.md marks "In progress" — code is fully implemented. |
| DIET-04 | 02-01, 02-04 | Search-as-you-type, recent foods, auto-ranked favorites | SATISFIED | filterFoods/rankFoods/recentFoods wired in diet-page. Group labels "Recent"/"Frequent". |
| DIET-05 | 02-03, 02-04 | Copy a meal from a previous day with one action | SATISFIED | repeatYesterday() + copyFromDay() + copyMealItems() wired. Lands editable pending items. |
| DIET-06 | 02-03, 02-04 | Scannable live daily totals + optional %-of-target bars | SATISFIED | recomputeLiveTotals() on every pending change. targetBarFor() with always-present text label. "over by" copy present. |
| DIET-07 | 02-05 | Diet history in charts page with date-range filter | SATISFIED | DietService injected. buildDietChart uses sumByDay. All 5 diet series toggleable. Diet series in existing charts page (D-10). |
| DIET-08 | 02-01, 02-05 | Day boundaries use local time, DST-safe | SATISFIED | toDateKey uses local getFullYear/getMonth/getDate. sumByDay uses toDateKey. DST specs: 2026-03-08 spring-forward + 2026-11-01 fall-back both tested. |
| DIET-09 | 02-03, 02-04 | Editing saved food does NOT change historical meal entries | SATISFIED | updateSavedFood never writes mealEntries. Snapshot captures unit+servingLabel at log time. History renders snapshot values. |
| DIET-10 | 02-01, 02-02 | V6→V7 schema migration with backup, fixtures, malformed coverage | SATISFIED | LegacyAppDataV6 typed. migrateV6ToV7 wired in chain. v6.json/v7-expected.json fixtures present. 3 malformed V6 fixtures present. Spec asserts density derivation + fdcId preservation + mealEntries byte-stability. |

**Note on DIET-02/DIET-03 REQUIREMENTS.md checkbox status:** Both are marked incomplete in REQUIREMENTS.md, but the code fully implements the required behaviors. The 02-01-SUMMARY.md explicitly documents the decision: "Marking them complete now would falsely claim shipped UI. They remain `[ ]` in REQUIREMENTS.md." The UI is now complete (landed in 02-04). The REQUIREMENTS.md checkboxes were intentionally left unchecked during execution planning but not updated after 02-04 shipped. This is a documentation tracking gap, not a code gap — the behaviors are implemented and verified above.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| diet-page.component.ts | 514 | `!selectedFood.densityGramsPerMl` check instead of `effectiveDensity(food) === undefined` | WARNING | Cosmetic: "No density set" note shows for foods with only `gramsPerTbsp` even though those foods CAN do cross-dimension conversion. The unit picker (servingUnitOptions at line 1103) correctly uses effectiveDensity, so the mismatch is only the informational note. Not a conversion correctness defect. |
| storage.service.ts | 845 | `const ML_PER_TBSP = 14.78676478125` (local const) | INFO | IN-02 (deferred): same constant in units.ts (as ML_PER_TBSP, exported) and in storage.service.ts (local). units.ts exports it; storage.service.ts defines its own copy. Deferred per 02-REVIEW.md. Not a correctness issue since the value is identical. |

**CR-01 (density-resolution divergence) — CONFIRMED FIXED:** The 02-REVIEW.md identified that `onAddMealItem` passed `food.densityGramsPerMl` directly while `DietService.toBaseUnits` used `effectiveDensity(food)` which also honors `gramsPerTbsp`. The fix consolidated `effectiveDensity` into `units.ts` and both paths now use it. Confirmed at diet-page.component.ts:1308 and diet.service.ts:615. The unit picker (`servingUnitOptions`) also updated to use `effectiveDensity` at line 1103.

**WR-01 (silent pending item drop) — CONFIRMED FIXED:** diet-page.component.ts:1353-1356 now detects `droppedCount > 0` and surfaces "Pick a serving for each item before saving." instead of silently discarding.

**WR-02 (empty-first-row crash guard) — CONFIRMED FIXED:** chart-grouping.ts:44,89 both use `group[0]?.length ?? 0` guard.

**WR-04 (unbounded macro targets) — CONFIRMED FIXED:** validators.ts:377 uses `VALIDATION_LIMITS.MACRO_TARGET_MAX` upper bound for protein/fat/carbs/net-carbs targets.

**WR-07 (Invalid Date render) — CONFIRMED FIXED:** formatMealTime at line 1671-1677 guards `!Number.isFinite(d.getTime())` and returns `'—'`.

**WR-05/WR-06/IN-01/IN-03/IN-05/IN-06 — DEFERRED** per 02-REVIEW.md resolution to `2026-06-02-diet-edit-form-density-desync-and-deferred-review-items.md`. These are acknowledged and tracked; they do not block the phase goal.

---

### Human Verification Required

#### 1. "No density set" note for gramsPerTbsp-only foods — ✅ RESOLVED (no longer needs human testing)

**Resolution:** Fixed by the orchestrator in commit `b7c8676`. The note now gates on a new
`selectedFoodConvertible` getter that delegates to the shared `effectiveDensity` (honoring the
legacy `gramsPerTbsp` bridge), so it matches what `servingUnitOptions()` offers. A gramsPerTbsp-only
food no longer shows the misleading note. Regression assertions added to the CR-01 spec; 842/842 green.

#### 2. DIET-02 end-to-end named-serving path

**Test:** Add a new food with base unit `g`. After saving, use "Add Serving" to create a custom serving labeled "1 cup" with unit `cup` and amount `236`. Then go to the meal-log, search for that food, select it, choose the "1 cup" serving, log quantity 2. Verify the macros shown equal the food's per-g nutrition × 472 (2 × 236g).

**Expected:** Custom serving is selectable in the meal-log picker. Macros compute correctly from the stored gram-equivalent. No error thrown.

**Why human:** REQUIREMENTS.md marks DIET-02 as Pending. While code inspection shows the service and model support custom servings with gram-equivalents, confirming the full end-to-end UX path works as the user expects requires interactive testing. (A cup-to-g food with no `densityGramsPerMl` but a cup serving would use the serving's stored gram-amount directly, not cross-dimension conversion — so this should work for any food.)

---

### Gaps Summary

No automated blockers found. All 5 success criteria are satisfied by the codebase. The two human verification items are:
1. A UX inconsistency (misleading "No density" note for legacy `gramsPerTbsp` foods) — the underlying conversion is correct; the note text is not.
2. REQUIREMENTS.md DIET-02 Pending checkbox — implementation exists in code; documentation was intentionally not updated during execution and needs confirmation through manual testing.

These items do not represent missing features or broken logic — they are UX polish gaps and a documentation tracking state that automated verification cannot fully resolve.

---

_Verified: 2026-06-01T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
