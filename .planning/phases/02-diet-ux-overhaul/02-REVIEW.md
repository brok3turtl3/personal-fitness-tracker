---
phase: 02-diet-ux-overhaul
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/app/models/diet.model.ts
  - src/app/models/app-data.model.ts
  - src/app/models/index.ts
  - src/app/services/units.ts
  - src/app/services/units.spec.ts
  - src/app/services/food-ranking.ts
  - src/app/services/food-ranking.spec.ts
  - src/app/shared/chart-grouping.ts
  - src/app/shared/chart-grouping.spec.ts
  - src/app/services/legacy-schemas.ts
  - src/app/services/storage.service.ts
  - src/app/services/storage.service.migration-fixtures.spec.ts
  - src/app/services/diet.service.ts
  - src/app/services/diet.service.spec.ts
  - src/app/services/validators.ts
  - src/app/services/validators.spec.ts
  - src/app/features/diet/diet-page.component.ts
  - src/app/features/diet/diet-page.component.spec.ts
  - src/app/features/charts/charts-page.component.ts
  - src/app/features/charts/charts-page.component.spec.ts
findings:
  critical: 1
  warning: 7
  info: 6
  total: 14
status: resolved_in_scope
resolution: "CR-01 + WR-01/02/04/07 fixed with regression tests (commits 656454f, ed5bb24, 890525c, f8cd638, 9d774d0); 842/842 green, build exit 0. WR-03 confirmed intended (live-preview semantics). WR-05/WR-06 + IN-01/03/05/06 deferred to todo 2026-06-02-diet-edit-form-density-desync-and-deferred-review-items.md. IN-02/IN-04 closed as a side effect of the CR-01 consolidation into units.ts."
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 2 widens the diet unit model, adds a V6→V7 migration, introduces pure `units.ts` / `food-ranking.ts` modules, and overhauls the diet and charts pages. The pure modules and the migration chain are careful and well-tested. The strongest concern is a **density-resolution inconsistency between the diet-page component and `DietService`**: the component computes the live preview using only the explicit `densityGramsPerMl` and ignores the legacy `gramsPerTbsp`-derived density, while the service derives one. This makes the on-screen preview and the persisted snapshot diverge for legacy/`gramsPerTbsp` foods, and can block a meal-item add in the UI that the service would have accepted — a correctness defect in the new conversion path.

Other findings cluster around quietly-dropped pending items on meal save, a `groupByDay`/`sumByDay` empty-first-row crash guard gap, dead state, duplicated constants, and a couple of validation-range gaps for the new diet metrics.

## Critical Issues

### CR-01: Diet-page preview ignores legacy `gramsPerTbsp` density — preview diverges from persisted snapshot and can wrongly block a valid add

**File:** `src/app/features/diet/diet-page.component.ts:1300-1310` (and `404-444` copyMealItems path is correct by contrast)
**Issue:** `onAddMealItem()` resolves base units by passing `food.densityGramsPerMl` directly to the pure `toBaseUnits`:

```ts
baseUnits = isMeasuredUnit(serving.unit) && isMeasuredUnit(food.baseUnit)
  ? toBaseUnits(serving.unit, usedUnits, food.baseUnit, food.densityGramsPerMl)
  : usedUnits;
```

`DietService.toBaseUnits` (diet.service.ts:632-645) instead resolves density via `effectiveDensity(food)` (diet.service.ts:613-622), which **falls back to `gramsPerTbsp / ML_PER_TBSP`** when `densityGramsPerMl` is absent. For a legacy g-based food that carries only `gramsPerTbsp` (e.g. any V6→V7-migrated oil where the derived `densityGramsPerMl` is present — but also any in-memory food where only `gramsPerTbsp` was set and density derivation hasn't been persisted), a cross-dimension serving (a `tbsp` serving on a `g` base) will:
- **Throw `UnitConversionError` in the component preview** → the user sees "This food needs a density (g/ml)…" and cannot add the item,
- even though `DietService.addMeal` **would have succeeded** using the derived density.

The two code paths must agree. At minimum the component must use the same effective-density resolution as the service. The result is a real macro/UX divergence: the preview shown and the snapshot stored can differ (or the add is blocked entirely) for exactly the legacy foods the V6→V7 migration was built to keep converting.

**Fix:** Resolve effective density once, in a shared helper, and use it on both paths. Export `effectiveDensity` from `diet.service.ts` (or move it into `units.ts` as `effectiveDensity(food)`), then in the component:

```ts
// component
import { effectiveDensity } from '../../services/diet.service';
...
const density = effectiveDensity(food); // honors gramsPerTbsp fallback
baseUnits = isMeasuredUnit(serving.unit) && isMeasuredUnit(food.baseUnit)
  ? toBaseUnits(serving.unit, usedUnits, food.baseUnit, density)
  : usedUnits;
```

Also align `servingUnitOptions()` (diet-page.component.ts:1096-1103), which gates cross-dimension serving units on `food.densityGramsPerMl` only — it should likewise consult `effectiveDensity(food)` so a legacy `gramsPerTbsp`-only food still offers the units the service can actually convert.

## Warnings

### WR-01: Pending items without a serving are silently dropped on meal save

**File:** `src/app/features/diet/diet-page.component.ts:1337-1344`
**Issue:** `onAddMeal()` filters pending items to those with a truthy `servingId`:

```ts
const items = this.pendingItems
  .filter(i => i.servingId)
  .map(i => ({ savedFoodId: i.savedFoodId, servingId: i.servingId, quantity: i.quantity }));
if (items.length === 0) { this.mealError = 'Pick a serving for each item before saving.'; return; }
```

Quick-added items (onQuickAdd, line 1269-1278) and any copied/repeated items that lost their food are staged with `servingId: ''`. If a meal mixes a serving-less quick-add item with at least one valid item, `items.length` is non-zero, so the guard passes and the **quick-add item is silently discarded** from the saved meal — the user sees it in "Pending items" and in live totals, then it vanishes after save with no error. Live totals (which include the dropped item's preview) will also disagree with the persisted meal totals.

**Fix:** Detect the drop and surface it instead of swallowing it:

```ts
const droppedCount = this.pendingItems.length - items.length;
if (items.length === 0 || droppedCount > 0) {
  this.mealError = 'Pick a serving for each item before saving.';
  return;
}
```

Better: give quick-add items a real default serving (e.g. the food's first serving) at stage time so they are never serving-less.

### WR-02: `groupByDay` / `sumByDay` dereference `group[0].length` — a mixed-arity extractor or an empty first row throws

**File:** `src/app/shared/chart-grouping.ts:44-48` and `90-93`
**Issue:** Both functions read `const fieldCount = group[0].length;` and then index `vals[i]` across the group. This assumes every per-item array returned by `extractor` has identical length and is non-empty. If `extractor` ever returns `[]` for the first item of a day (or different lengths across items), the loop silently produces `undefined` sums / `NaN`, or — for a later row shorter than `group[0]` — `vals[i]` is `undefined` and `sum + undefined` becomes `NaN`, which then flows into chart data. There is no guard and no test for a ragged/empty extractor result.

This is latent today (callers pass fixed-arity extractors), but it is an unguarded array-shape assumption in a shared utility that the charts and report pages both depend on.

**Fix:** Coerce non-finite contributions to 0 and guard empty rows:

```ts
const fieldCount = group[0]?.length ?? 0;
...
const sum = group.reduce((s, vals) => s + (Number.isFinite(vals[i]) ? vals[i] : 0), 0);
```

### WR-03: `targetBarFor` reads from `liveTotals` (includes unsaved pending items) — % of target counts food not yet logged

**File:** `src/app/features/diet/diet-page.component.ts:1511-1530`
**Issue:** `targetBarFor` computes progress against `this.liveTotals`, which `recomputeLiveTotals` (line 1651-1656) defines as saved meals **plus pending (unsaved) items**. While building/editing a meal, the %-of-target bars therefore include food the user has not committed. Combined with WR-01, a pending item that is later silently dropped will have inflated the target bars. If the intent of the daily-target bars is "what I have logged today," they should read `dailyTotals` (saved only); if the intent is "live preview," that should be explicit. As written the bar value can exceed the persisted day's actual totals.

**Fix:** Decide the intended semantics and document it. If the bars represent logged intake, use `this.dailyTotals` (which is currently computed but otherwise unused — see IN-01) rather than `this.liveTotals`.

### WR-04: `validateDailyTargets` caps only calories; protein/fat/carbs/net-carbs accept arbitrarily large values

**File:** `src/app/services/validators.ts:360-391`
**Issue:** Calories are range-checked against `CALORIES_MIN..CALORIES_MAX`, but the macro targets (protein, fat, carbs, net carbs) are only checked for finite/non-negative. A user (or a future caller) can persist a 10,000,000 g protein target. The phase added explicit validation ranges everywhere else (duration, weight, glucose, etc.); the macro targets are the one new numeric surface left effectively unbounded. Net carbs additionally have no relationship check against the carbs target (net ≤ carbs), though that may be intentional since both are optional independent targets.

**Fix:** Apply a sane upper bound (e.g. reuse a `MACRO_TARGET_MAX` constant, or bound by `CALORIES_MAX`-derived grams) so an out-of-range macro target is rejected like every other metric.

### WR-05: `updateSavedFood` cannot clear `gramsPerTbsp`, and the edit form silently loses density-only foods' bridge

**File:** `src/app/services/diet.service.ts:172-185` and `src/app/features/diet/diet-page.component.ts:1130-1137`
**Issue:** `updateSavedFood` writes `gramsPerTbsp: update.gramsPerTbsp` unconditionally. When the edit form clears the gramsPerTbsp input, `onAddFood` maps it to `undefined` (diet-page.component.ts:1113-1115) and the field is overwritten to `undefined` — but the previously-derived `densityGramsPerMl` is **preserved** (the `!== undefined ? : existing.densityGramsPerMl` branch at lines 178-181). So after clearing gramsPerTbsp, the food keeps a density the user can no longer see or control, and the displayed g/tbsp serving (added on a prior save, lines 165-170) remains. The edit UI never exposes `densityGramsPerMl` directly, so the user has no way to reconcile the two. This is a confusing, partly-unreachable state rather than a crash, but it means the food's conversion behavior no longer matches what the form shows.

**Fix:** When `gramsPerTbsp` is cleared on edit, decide explicitly whether to also drop the derived `densityGramsPerMl` (and the auto-added tbsp serving), or expose `densityGramsPerMl` in the edit form so the two are never out of sync.

### WR-06: `migrateV5ToV6` / `migrateV6ToV7` defensive `?? []` is defeated by the upstream chain typing — malformed intermediate shapes can still throw

**File:** `src/app/services/storage.service.ts:601-633`
**Issue:** `migrateData` casts at each non-migrating hop, e.g. `(data as LegacyAppDataV5)` / `(data as LegacyAppDataV6)`. When the stored `fromVersion` is, say, 5, the chain takes `v5 = (data as LegacyAppDataV5)` directly (no `?? []` coercion is applied because `migrateV4ToV5` is skipped), then `migrateV5ToV6(v5)`. The `?? []` guards inside `migrateV5ToV6` protect the *array* fields, but `data.chatConversations.map(...)` in `migrateV4ToV5` (line 726) and `conv.messages.map(...)` (line 729) are reached only on the V4 path and assume those are arrays. A malformed store whose `schemaVersion` claims 4 but whose `chatConversations` is a non-array object will throw a raw `TypeError` inside the migration — which is then wrapped as `MIGRATION_FAILED` (acceptable), but the comments throughout claim these transforms "coerce … rather than throwing." The defensive intent is inconsistently applied: array-coercion exists in V5→V6/V6→V7 but not in V4→V5's `.map` walks.

This is covered by the malformed-matrix tests for the cases that exist, but the inconsistency is a maintenance trap: the comments overstate the safety.

**Fix:** Either add the same `Array.isArray(...) ? ... : []` guard before each `.map` in `migrateV4ToV5`, or correct the comments to state that malformed intermediate shapes are intentionally allowed to throw → `MIGRATION_FAILED` (which the tests already accept).

### WR-07: `formatMealTime` and other `new Date(...)` renders silently emit "Invalid Date" for unparseable input

**File:** `src/app/features/diet/diet-page.component.ts:1658-1661`
**Issue:** `formatMealTime` does `new Date(dateTimeIso).toLocaleTimeString(...)` with no finite-time guard. Elsewhere in this same file the team correctly guards (formatLocalDateTimeFromIso, line 1687-1691, and charts-page formatShortDate, line 808). A meal with a corrupt `dateTime` (possible after a malformed migration that the migration layer deliberately tolerates) will render the literal string "Invalid Date" in the history list rather than failing gracefully. Inconsistent with the defensive posture taken everywhere else.

**Fix:** Guard before formatting:

```ts
formatMealTime(dateTimeIso: string): string {
  const d = new Date(dateTimeIso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
```

## Info

### IN-01: `dailyTotals` is computed but never consumed

**File:** `src/app/features/diet/diet-page.component.ts:900, 1608`
**Issue:** `dailyTotals` is initialized and recomputed in `loadMeals()` but is read nowhere in the template (the template uses `liveTotals` exclusively). Dead state. See WR-03 — it may actually be the *correct* source for the target bars.
**Fix:** Either wire `dailyTotals` into the target bars / a "logged today" display, or remove the field and its computation.

### IN-02: `ML_PER_TBSP` constant duplicated across three files

**File:** `src/app/services/units.ts:46` (as `tbsp: 14.78676478125`), `src/app/services/storage.service.ts:845`, `src/app/services/diet.service.ts:603`
**Issue:** The US-customary ml-per-tablespoon constant `14.78676478125` is hand-copied into three modules. A future correction to one will silently desync the migration-derived density from the runtime-derived density.
**Fix:** Export a single `ML_PER_TBSP` from `units.ts` and import it in `storage.service.ts` and `diet.service.ts`.

### IN-03: `safeNumber` helper duplicated with divergent signatures

**File:** `src/app/services/units.ts:58-60`, `src/app/services/diet.service.ts:561-563`, `src/app/services/storage.service.ts:937-939`
**Issue:** Three near-identical `safeNumber` implementations: `units.ts` takes `number`, the other two take `unknown` with an internal cast. The diet/storage variants are functionally identical. Minor duplication; a shared `safeNumber(n: unknown): number` in a shared util would remove the cast repetition.
**Fix:** Consolidate into one shared helper (e.g. in `units.ts` or a `numbers.ts`), widening the param to `unknown`.

### IN-04: `MASS_UNITS` set / `sameDimension` reimplements `units.ts` dimension logic

**File:** `src/app/features/diet/diet-page.component.ts:1711-1715`
**Issue:** The component hardcodes `MASS_UNITS = new Set(['g','oz','lb'])` and a private `sameDimension` to gate serving-unit options. `units.ts` already owns the authoritative `DIMENSION` map. Duplicating the dimension partition in a component risks drift if a unit is ever added to `units.ts` but not here, and pushes unit-domain logic into the UI layer (contrary to CLAUDE.md "components = UI only").
**Fix:** Export a `dimensionOf(u: MeasuredUnit)` or `sameDimension(a, b)` from `units.ts` and consume it.

### IN-05: `loadFoods` is invoked redundantly on add/quick-add paths

**File:** `src/app/features/diet/diet-page.component.ts:1280, 1146, 1172`
**Issue:** Several success handlers call `loadFoods()`, which itself calls `recomputeRankings()`, while `onQuickAdd` also calls `recomputeLiveTotals()` and stages an item before `loadFoods()` resolves asynchronously. The ordering works but the repeated reloads (and the fact that `selectFood`/ranking state is recomputed from possibly-stale `allMeals`) make the data-flow hard to follow. Not a bug, but a readability/maintainability cost in a 1700-line component.
**Fix:** Consider centralizing post-mutation refresh in one method to make the reload sequence explicit.

### IN-06: `router` injected in charts page is used only for one navigation — fine, but `Router` import is the only non-chart coupling

**File:** `src/app/features/charts/charts-page.component.ts:5, 363-365, 424`
**Issue:** Minor: `onPrintExport` builds a `queryParams` record but only forwards a subset of the active controls (it omits all `diet*` toggles and the `customStart/customEnd` raw values), so the `/report` view cannot reconstruct the diet chart selections the user had on screen. If the report is meant to mirror the charts page, the diet toggles are missing from the hand-off. Verify whether `/report` is expected to render diet metrics; if so this is an incomplete contract.
**Fix:** Include the diet metric toggles (and resolved range already is) in `queryParams`, or confirm `/report` intentionally ignores diet.

---

_Reviewed: 2026-06-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
