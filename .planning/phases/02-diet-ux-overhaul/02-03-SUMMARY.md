---
phase: 02-diet-ux-overhaul
plan: 03
subsystem: diet-service
tags: [angular, typescript, diet, units, conversion, validation, snapshot-immutability, daily-targets]

# Dependency graph
requires:
  - phase: 02-diet-ux-overhaul
    plan: 01
    provides: "units.ts (convertMeasured/isMeasuredUnit/UnitConversionError), widened FoodUnit + densityGramsPerMl + DailyTargets + widened MealItemSnapshot, V7 schema"
provides:
  - "DietService.toBaseUnits delegates to units.ts (per-food density; no global default — DIET-03/D-04)"
  - "Widened food/serving unit validation (full MeasuredUnit union via isMeasuredUnit)"
  - "validateDensity + validateDailyTargets in validators.ts (string[] convention)"
  - "DietService.getMealsInRange (inclusive, sorted) for the charts page (02-05)"
  - "DietService.copyMealItems (re-derive preview from CURRENT food; snapshot fallback) for copy-meal (02-04)"
  - "DietService get/set/clear DailyTargets (clear omits the field, never null)"
  - "Snapshot capture carries resolved unit + servingLabel (D-09)"
  - "DIET-09 snapshot immutability locked by a deep-equal test"
affects: [02-04-diet-page, 02-05-charts-diet-series]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service delegates conversion to the pure units.ts module; maps UnitConversionError → DietValidationError"
    - "effectiveDensity prefers densityGramsPerMl, derives from legacy gramsPerTbsp (mirrors V6→V7) — never a global default"
    - "Pure mapping helper on the service (copyMealItems) re-derives from the live food; component owns the read"
    - "Validators return string[] (DietService convention) rather than ValidationResult"

key-files:
  created: []
  modified:
    - src/app/services/diet.service.ts
    - src/app/services/diet.service.spec.ts
    - src/app/services/validators.ts
    - src/app/services/validators.spec.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "toBaseUnits delegates to units.ts; effectiveDensity derives from legacy gramsPerTbsp so pre-migration in-memory data still converts — but absent both density sources still THROWS (D-04, never defaults)"
  - "DIET-01/03/05/06/09 left In-progress (not Complete) in REQUIREMENTS — the service layer ships here; user-observable UI lands in 02-04/02-05 (mirrors 02-01's interface-first precedent)"
  - "clearDailyTargets uses object-rest to omit the field entirely (never null) per the model's omitted-not-null convention"

requirements-completed: []

# Metrics
duration: ~20min
completed: 2026-06-01
---

# Phase 2 Plan 03: DietService + Validators Extension Summary

**Extended `DietService` (not rebuilt) to delegate unit conversion to the pure `units.ts` (per-food density, no global default), widened food/serving validation to the full `MeasuredUnit` union, added density + daily-target validators, a meals-in-range getter, a re-deriving copy-meal helper, and `DailyTargets` get/set/clear — and locked DIET-09 snapshot immutability with a deep-equal proof. Full suite 828/828, production build clean.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- **`toBaseUnits` now delegates to `units.ts`** — replaced the in-service g↔tbsp body with `convertMeasured`. Identity returns the amount unchanged; same-dimension uses the fixed table; cross-dimension uses the food's `effectiveDensity` (explicit `densityGramsPerMl`, else derived from legacy `gramsPerTbsp / 14.78676478125`) and **throws** otherwise — no global default leaks into the service (DIET-03 / D-04). A thrown `UnitConversionError` is mapped to the typed `DietValidationError`.
- **Widened validation gates** — `addSavedFood` / `addCustomServing` / `updateSavedFood` now accept the full `MeasuredUnit` union via `isMeasuredUnit` (DIET-01 service path: `oz`, `ml`, `cup`, … all valid; invalid units still rejected). `densityGramsPerMl` is validated on add + update; `addSavedFood` now persists `densityGramsPerMl`/`preferredUnits`, and `updateSavedFood` preserves existing density when the caller omits it.
- **New validators** — `validateDensity` (>0 finite; `undefined` ok) and `validateDailyTargets` (per-metric non-negative finite; calories reuse the existing 0-20000 kcal range; every metric optional). Full spec coverage for both.
- **Snapshot capture widened** — both `addMeal` and `buildMealItems` now store the resolved `unit` + `servingLabel` on the snapshot (D-09), so a historical render never re-resolves the (possibly later-edited) food.
- **`getMealsInRange(startMs, endMs)`** — inclusive range filter sorted ascending by `dateTime`; the charts page (02-05) consumes it. `getMealsForDay` stays for the daily view.
- **`copyMealItems(meal, currentFoods)`** — maps each item to the editable pending shape, RE-DERIVING `preview` from the CURRENT `SavedFood` (D-09/A5 — "what I'm eating now") via `scaleFoodTotals(food, toBaseUnits(...))`; falls back to the frozen snapshot totals when the food was deleted (or its serving can no longer resolve).
- **`DailyTargets` pass-through** — `getDailyTargets` (undefined when unset), `setDailyTargets` (validated, throws `DietValidationError`), `clearDailyTargets` (object-rest omits the field — never writes `null`).
- **DIET-09 immutability proof** — a dedicated `describe` logs a meal, captures deep copies of `MealEntry.totals` + `MealItem.snapshot`, edits the food's macros via `updateSavedFood`, re-reads the persisted meal, and asserts both are `toEqual` the captured values. `updateSavedFood` touches only `savedFoods`, never `mealEntries`.

## Task Commits

Each task committed atomically (TDD RED compile-error → GREEN feat; spec + impl are compile-coupled, so each cycle is one buildable commit):

1. **Task 1: toBaseUnits delegation + widened validation + density/target validators** — `07dcb32` (feat, GREEN)
2. **Task 2: copy-meal + meals-in-range + DailyTargets + immutability tests** — `29f3326` (feat, GREEN)

## Files Modified

- `src/app/services/diet.service.ts` — units.ts delegation, `effectiveDensity`, widened gates, density/preferredUnits persistence, widened snapshot, `getMealsInRange`, `copyMealItems`, `get/set/clearDailyTargets`
- `src/app/services/diet.service.spec.ts` — widened-unit acceptance, delegation (named/same-dim/cross-dim-with-density/cross-dim-throw), resolved-snapshot, range filtering, copy re-derive + fallback, targets round-trip, DIET-09 deep-equal immutability
- `src/app/services/validators.ts` — `validateDensity`, `validateDailyTargets`
- `src/app/services/validators.spec.ts` — density + daily-targets cases
- `.planning/REQUIREMENTS.md` — DIET-01/03/05/06/09 traceability rows annotated In-progress (service layer this plan; UI in 02-04/02-05)

## Decisions Made

- **Legacy density derivation in `effectiveDensity`:** a food carrying only legacy `gramsPerTbsp` (no `densityGramsPerMl`) still converts cross-dimension by deriving `gramsPerTbsp / 14.78676478125` — mirroring the V6→V7 migration so pre-migration in-memory data behaves identically. This is NOT a global default: a food with neither source still throws (D-04). Confirmed by the cross-dimension-without-density throw test.
- **Requirements left In-progress, not Complete:** DIET-01/03/05/06/09 are user-observable behaviors that span plans. The service layer (validation path, conversion delegation, copy helper, targets storage, immutability) ships here; the quick-add modal, native-unit picker, one-action copy button, and %-of-target bars are 02-04/02-05. Marking them Complete now would falsely claim shipped UI (mirrors 02-01's interface-first precedent). Rows annotated with the 02-03 contribution.
- **`clearDailyTargets` via object-rest:** destructure-and-spread omits `dailyTargets` entirely rather than setting it to `undefined`/`null`, honoring the model's omitted-not-null convention; the spec asserts the persisted object has no `dailyTargets`.

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed the planned RED → GREEN flow and all acceptance-criteria greps pass.

## Threat-Model Compliance

- **T-02-03-01 (Tampering / snapshot immutability, mitigate):** `updateSavedFood` writes only `savedFoods`; logged items carry frozen `snapshot`. Deep-equal test proves a macro edit leaves `MealEntry.totals` + `MealItem.snapshot` byte-identical.
- **T-02-03-02 (Tampering / density+target validation, mitigate):** `validateDensity` (>0 finite) and `validateDailyTargets` (≥0 finite; calories 0-20000) gate every new numeric input via `DietValidationError`; spec covers 0/negative/NaN/Infinity/over-range.
- **T-02-03-03 (Tampering / cross-dimension conversion, mitigate):** `toBaseUnits` delegates to `units.ts`, which throws without a per-food density — no global default reaches the service path (cross-dim-no-density throw test).
- **T-02-03-04 (Info disclosure / service egress, accept):** `grep` confirms zero `localStorage.*` in `diet.service.ts`; all persistence routes through `StorageService` (T-EGRESS chokepoint upheld).

## Verification

- Targeted specs: diet.service.spec + validators.spec green.
- Full Karma suite: **828/828 SUCCESS** (783 baseline + 45 new).
- `ng build --configuration=production`: **exit 0** (only pre-existing CSS-budget warnings in unrelated readings/chat components — out of scope).
- Chokepoint grep: `grep -rnE "localStorage\.(getItem|setItem|removeItem)" src/app/services/diet.service.ts` → no matches.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

- **02-04 (diet-page):** `addSavedFood` widened-unit path + density validation are ready for the quick-add modal; `copyMealItems` is ready for the one-action copy button; `get/set/clearDailyTargets` are ready for the %-of-target bars. `startEditMeal`'s ad-hoc map in the component can now be replaced by `copyMealItems` (re-derive semantics).
- **02-05 (charts):** `getMealsInRange` returns range-bounded meals sorted by `dateTime` for the diet calories/macro series (pairs with `sumByDay` from 02-01).
- No blockers.

## Self-Check: PASSED

- All 5 modified files present.
- Both task commits present in git history (07dcb32, 29f3326).
- Full Karma suite 828/828; production build exit 0; chokepoint grep clean.

---
*Phase: 02-diet-ux-overhaul*
*Completed: 2026-06-01*
