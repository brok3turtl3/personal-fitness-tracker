---
phase: 02-diet-ux-overhaul
plan: 01
subsystem: database
tags: [angular, typescript, units, conversion, schema-migration, diet, pure-module]

# Dependency graph
requires:
  - phase: 01-foundations
    provides: shared chart-grouping.ts (toDateKey/groupByDay/round2), typed legacy-schemas + backup-before-migrate chain
  - phase: 05
    provides: CURRENT_SCHEMA_VERSION=6 baseline + web-citation-parser pure-module template
provides:
  - "units.ts — pure hand-rolled unit/density conversion (convertMeasured, toBaseUnits, isMeasuredUnit, UnitConversionError)"
  - "food-ranking.ts — pure search + auto-ranked favorites (filterFoods, rankFoods, recentFoods; now injected)"
  - "Widened FoodUnit (mass+volume MeasuredUnit union), SavedFood.densityGramsPerMl?/preferredUnits?, widened MealItemSnapshot, DailyTargets"
  - "CURRENT_SCHEMA_VERSION=7 + additive V6→V7 migration (density derived from legacy gramsPerTbsp)"
  - "sumByDay — sum-per-local-day sibling to groupByDay (DST-correct)"
affects: [02-02-migration, 02-03-diet-service, 02-04-diet-page, 02-05-charts-diet-series]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure module (no @Injectable/class/DI/clock), now/density injected as params — mirrors web-citation-parser.ts"
    - "Hand-rolled fixed-factor conversion table (D-05) — no `convert` dependency"
    - "Cross-dimension conversion REQUIRES per-food density; throws, never defaults (DIET-03/D-04)"
    - "Additive backward-compatible model widening + version-bump migration hop"

key-files:
  created:
    - src/app/services/units.ts
    - src/app/services/units.spec.ts
    - src/app/services/food-ranking.ts
    - src/app/services/food-ranking.spec.ts
  modified:
    - src/app/models/diet.model.ts
    - src/app/models/app-data.model.ts
    - src/app/models/index.ts
    - src/app/shared/chart-grouping.ts
    - src/app/shared/chart-grouping.spec.ts
    - src/app/services/storage.service.ts
    - src/app/services/legacy-schemas.ts
    - src/app/services/storage.service.migration-fixtures.spec.ts
    - src/app/features/diet/diet-page.component.ts

key-decisions:
  - "FoodUnit aliases MeasuredUnit defined in units.ts (units.ts has NO model import → no circular dep; diet.model imports the union)"
  - "V6→V7 migration hop landed in 02-01 (not deferred to 02-02) to keep CURRENT_SCHEMA_VERSION=7 and the migrate chain consistent; 02-02 owns the in-depth V6/V7 fixtures"
  - "DIET-02/03/04/08 left unchecked in REQUIREMENTS — 02-01 is interface-first; the user-observable behavior (search UI, %-of-target bars, charts series) lands in 02-04/02-05"

patterns-established:
  - "Pure conversion module with typed error class + injected density (units.ts)"
  - "Decayed-frequency ranking with injected `now` for deterministic tests (food-ranking.ts, HALF_LIFE_DAYS=14)"
  - "sumByDay: SUM (not average) per toDateKey local day — never route diet macros through groupByDay (Pitfall 2)"

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-06-01
---

# Phase 2 Plan 01: Diet Type Contracts + Pure-Logic Modules Summary

**Pure hand-rolled `units.ts` (density-gated g/oz/lb↔ml/tsp/tbsp/cup conversion), deterministic decayed-frequency `food-ranking.ts`, widened diet model (MeasuredUnit union + per-food density + DailyTargets) at schema V7, and a DST-correct `sumByDay` — the interface-first foundation every other Phase 2 plan builds against.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-01T19:21Z
- **Completed:** 2026-06-01T19:35Z (commit window)
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified:** 13 (4 created, 9 modified)

## Accomplishments

- **`units.ts`** — pure module (no class/DI/clock): `convertMeasured` does within-dimension via a fixed `TO_CANONICAL` table and cross-dimension only with a positive-finite `densityGramsPerMl`, otherwise THROWS `UnitConversionError` (DIET-03/D-04 — never a global default). Plus `toBaseUnits` (pure, not food-coupled) and `isMeasuredUnit`. 25 specs green incl. every no-default-density throw (absent/0/NaN/negative).
- **`food-ranking.ts`** — pure module: `filterFoods` (case-insensitive substring, empty/whitespace → all), `rankFoods` (Σ `0.5 ** (ageDays / HALF_LIFE_DAYS)`, `HALF_LIFE_DAYS=14`, `now` injected, stable/deterministic), `recentFoods` (distinct ids by dateTime desc, capped). 9 specs green incl. a determinism assertion. Zero internal wall-clock; bad dateTimes skipped, never thrown.
- **Model widening (additive, V7)** — `FoodUnit = MeasuredUnit`; `SavedFood`/`CreateSavedFood` gain `densityGramsPerMl?`/`preferredUnits?` (legacy `gramsPerTbsp?` kept); `MealItemSnapshot` gains optional resolved `unit`/`servingLabel` (D-09); new `DailyTargets`; `AppData.dailyTargets?`; `CURRENT_SCHEMA_VERSION=7`; `diet.model` barrel-exported.
- **`sumByDay`** — sums macros per local day keyed on `toDateKey` (REUSED, not forked), DST-correct across spring-forward (2026-03-08) and fall-back (2026-11-01) on 23:30-local meals. 5 new specs.
- **Full suite 783/783 green; `ng build --configuration=production` exit 0.**

## Task Commits

Each task was committed atomically (TDD test → feat):

1. **Task 1: units.ts** — `8942aac` (test, RED) → `151c981` (feat, GREEN)
2. **Task 2: food-ranking.ts** — `072c5d0` (test, RED) → `0abf282` (feat, GREEN)
3. **Task 3: model widening + sumByDay** — `9639457` (test, RED) → `443a822` (feat, GREEN)

_No REFACTOR commits needed — GREEN implementations were clean._

## Files Created/Modified

- `src/app/services/units.ts` (created) — pure conversion: convertMeasured/toBaseUnits/isMeasuredUnit/UnitConversionError
- `src/app/services/units.spec.ts` (created) — 25 specs (within-/cross-dim, density throws, identity, guards)
- `src/app/services/food-ranking.ts` (created) — pure filter/rank/recent (now injected)
- `src/app/services/food-ranking.spec.ts` (created) — 9 specs (substring, decay determinism, no-history stability, bad-date skip)
- `src/app/models/diet.model.ts` (mod) — FoodUnit=MeasuredUnit, density/preferredUnits, widened snapshot, DailyTargets
- `src/app/models/app-data.model.ts` (mod) — dailyTargets?, CURRENT_SCHEMA_VERSION=7 + doc narration
- `src/app/models/index.ts` (mod) — barrel-export diet.model
- `src/app/shared/chart-grouping.ts` (mod) — sumByDay (sum-per-local-day, reuses toDateKey + round2)
- `src/app/shared/chart-grouping.spec.ts` (mod) — sumByDay describe block (sum, sort, DST x2)
- `src/app/services/storage.service.ts` (mod) — V6→V7 migration hop + migrateSavedFoodV6ToV7 density derivation
- `src/app/services/legacy-schemas.ts` (mod) — LegacyAppDataV6 interface
- `src/app/services/storage.service.migration-fixtures.spec.ts` (mod) — version assertions → CURRENT_SCHEMA_VERSION; V6-migrates-up / at-version-idempotent split
- `src/app/features/diet/diet-page.component.ts` (mod) — narrow `'g'|'tbsp'` annotations widened to FoodUnit (compile fix)

## Decisions Made

- **Union direction:** `MeasuredUnit` is defined in `units.ts`; `diet.model.ts` imports it as `FoodUnit`. `units.ts` has no model import, so there is no circular dependency (CLAUDE.md forbids cycles). The plan offered either direction; this keeps `units.ts` dependency-free.
- **V6→V7 migration landed here, not deferred:** Bumping `CURRENT_SCHEMA_VERSION` to 7 without a terminal migration hop left 13 existing migration specs red (migrated data stamped 6 ≠ current 7). The additive hop (clone-V5-shaped `LegacyAppDataV6`, derive `densityGramsPerMl` from a positive `gramsPerTbsp` via 14.78676478125 ml/tbsp, keep `mealEntries` byte-stable, `dailyTargets` undefined) is fully specified in 02-PATTERNS/02-RESEARCH and is mechanical — not an architectural decision. Plan 02-02 still owns the dedicated V6/V7 fixtures + malformed-V6 matrix that exercise it in depth.
- **Requirements left unchecked:** DIET-02/03/04/08 are end-to-end user-facing requirements (native-unit UI, search-as-you-type, charts diet series). 02-01 delivers only the pure logic + type contracts; the user-observable behavior lands in 02-04/02-05. Marking them complete now would falsely claim shipped UI. They remain `[ ]` in REQUIREMENTS.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened narrow `'g' | 'tbsp'` annotations in diet-page.component.ts**
- **Found during:** Task 3 (model widening)
- **Issue:** Widening `FoodUnit` to the full union surfaced pre-existing narrow `'g' | 'tbsp'` type annotations in `diet-page.component.ts` (`mealServingOptions` field, `toBaseUnitsForPreview` param, two form casts). Angular type-checks the whole app even for a single-spec run, so the production build (and every spec) failed with TS2322/TS2345.
- **Fix:** Imported `FoodUnit`/`SavedFoodServing`; retyped `mealServingOptions: SavedFoodServing[]`, `toBaseUnitsForPreview(... unit: FoodUnit ...)`, and the two `as 'g'|'tbsp'` form casts to `as FoodUnit`. No UI logic changed (plan 02-04 deletes `toBaseUnitsForPreview` and delegates to `units.ts`).
- **Files modified:** src/app/features/diet/diet-page.component.ts
- **Verification:** `ng build --configuration=production` exit 0; full suite 783/783.
- **Committed in:** 443a822 (Task 3 commit)

**2. [Rule 3 - Blocking] Added the additive V6→V7 migration hop + LegacyAppDataV6**
- **Found during:** Task 3 (after CURRENT_SCHEMA_VERSION=7 bump)
- **Issue:** The migrate chain terminated at V6, so post-migration data stamped `schemaVersion: 6` while the bumped constant is 7 — 13 existing StorageService migration specs failed (`Expected 6 to be 7`). The plan's own success criterion requires a green suite.
- **Fix:** Added `LegacyAppDataV6` (clone of V5, `schemaVersion: 6`), narrowed `migrateV5ToV6`'s return to it, added `migrateV6ToV7` (additive, `dailyTargets` undefined, `mealEntries` byte-stable) + `migrateSavedFoodV6ToV7` deriving `densityGramsPerMl = gramsPerTbsp / 14.78676478125` only when absent and `gramsPerTbsp` is positive-finite, preserving `fdcId`. Updated the existing fixture specs to assert `CURRENT_SCHEMA_VERSION` and split the old "V6 idempotent" test into "V6 migrates up (writes a v6 backup)" + "at-version is idempotent (no backup)".
- **Files modified:** src/app/services/storage.service.ts, src/app/services/legacy-schemas.ts, src/app/services/storage.service.migration-fixtures.spec.ts
- **Verification:** Full suite 783/783; production build exit 0; backup keying regex asserted.
- **Committed in:** 443a822 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking).
**Impact on plan:** Both were necessary to keep the production build and full test suite green after the V7 model widening + version bump — direct consequences of this plan's scoped changes, not scope creep. The V6→V7 hop is additive and leaves 02-02's in-depth fixture/malformed-matrix work fully intact.

## Threat-Model Compliance

- **T-02-01-01 (Tampering / cross-dimension):** `convertMeasured` throws `UnitConversionError` for absent/0/NaN/negative density — never a default. 5 throw specs assert it.
- **T-02-01-02 (Tampering / numeric inputs):** `safeNumber` guard on `amount` (non-finite → 0); a NaN amount produces 0, never a silent wrong macro (spec asserted).
- **T-02-01-03 (food-ranking determinism, accept):** `rankFoods` is a pure function of (foods, entries, now); determinism spec is the guard.
- **T-02-01-04 (Info disclosure, accept):** `grep` confirms zero `fetch`/`XMLHttpRequest`/`localStorage.` in units.ts and food-ranking.ts (T-EGRESS chokepoint upheld).

## Issues Encountered

- Initial single-spec runs (`--include`) still fail on whole-app type errors, which made the diet-page narrow-annotation regression and the migration-version mismatch surface only after model widening — both resolved as Rule 3 fixes above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-02 (migration):** A working V6→V7 hop + `LegacyAppDataV6` already exist; 02-02 should add the dedicated `v6.json`/`v7-expected.json` fixtures + the malformed-V6 matrix and deepen the per-food density-derivation assertions (the transform is already wired).
- **02-03 (DietService):** `units.ts` `toBaseUnits`/`convertMeasured` are ready to replace the in-service g↔tbsp body; widened `MealItemSnapshot` is ready for the snapshot capture.
- **02-04 (diet-page):** `food-ranking.ts` filter/rank/recent + `DailyTargets` are ready for the search UI + %-of-target bars; delete `toBaseUnitsForPreview` and delegate to `units.ts`.
- **02-05 (charts):** `sumByDay` is ready for the diet calories/macro series keyed on `MealEntry.dateTime`.
- No blockers.

## Self-Check: PASSED

- All 4 created files present (units.ts/.spec, food-ranking.ts/.spec).
- All 6 task commits present in git history (8942aac, 151c981, 072c5d0, 0abf282, 9639457, 443a822).
- Full Karma suite 783/783 SUCCESS; `ng build --configuration=production` exit 0.

---
*Phase: 02-diet-ux-overhaul*
*Completed: 2026-06-01*
