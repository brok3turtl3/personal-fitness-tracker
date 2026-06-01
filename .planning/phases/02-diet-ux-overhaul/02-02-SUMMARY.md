---
phase: 02-diet-ux-overhaul
plan: 02
subsystem: database
tags: [angular, typescript, schema-migration, diet, fixtures, backward-compat]

# Dependency graph
requires:
  - phase: 02-diet-ux-overhaul
    plan: 01
    provides: "CURRENT_SCHEMA_VERSION=7 + pre-built migrateV6ToV7 hop + LegacyAppDataV6; widened SavedFood (densityGramsPerMl?/preferredUnits?) + DailyTargets"
provides:
  - "LegacySavedFoodV6 — honestly-narrow pre-V7 food type (baseUnit 'g'|'tbsp', gramsPerTbsp?, NO density/preferredUnits); LegacyAppDataV6.savedFoods retyped to it"
  - "migrateSavedFoodV6ToV7 retyped to consume LegacySavedFoodV6 → SavedFood (additive, fdcId-preserving, density-deriving)"
  - "5 V6/V7 fixtures (v6.json, v7-expected.json, 3 malformed) + 9 V6→V7 migration specs"
affects: [02-03-diet-service, 02-04-diet-page, 02-05-charts-diet-series]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Honestly-narrow migration INPUT type (LegacySavedFoodV6) so the hop cannot assume V7-only fields are present"
    - "Fixture-driven migration coverage: vN.json input + vN+1-expected.json deep-equal (modulo lastModified) + malformed matrix (load-with-defaults OR fail-loud)"

key-files:
  created:
    - src/app/services/migrations/fixtures/v6.json
    - src/app/services/migrations/fixtures/v7-expected.json
    - src/app/services/migrations/fixtures/malformed/v6-missing-savedfoods.json
    - src/app/services/migrations/fixtures/malformed/v6-wrong-type-density.json
    - src/app/services/migrations/fixtures/malformed/v6-null.json
  modified:
    - src/app/services/legacy-schemas.ts
    - src/app/services/storage.service.ts
    - src/app/services/storage.service.migration-fixtures.spec.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Hardened LegacyAppDataV6.savedFoods from the widened SavedFood[] to a NEW narrow LegacySavedFoodV6[] — the migration INPUT is now honestly pre-V7, so strict-TS guarantees migrateV6ToV7 never assumes densityGramsPerMl/preferredUnits already exist"
  - "DIET-10 marked Complete: its user-observable behavior (migration ships cleanly with backup + fixtures + malformed coverage) is now fully delivered. The requirement text says V5→V6, but the schema base advanced to V6 in Phase 5, so the real hop is V6→V7 — annotated in REQUIREMENTS.md"

patterns-established:
  - "Narrow legacy INPUT type per from-version (LegacySavedFoodV6) — extends the LegacySavedFoodV2 precedent"

requirements-completed: [DIET-10]

# Metrics
duration: ~20min
completed: 2026-06-01
---

# Phase 2 Plan 02: V6→V7 Diet Schema Migration (DIET-10) Summary

**Hardened the pre-built V6→V7 migration to an honestly-narrow `LegacySavedFoodV6` input type and delivered the dedicated fixture + malformed-matrix coverage that proves a real V6 store widens to schemaVersion 7 — deriving `densityGramsPerMl` from a legacy `gramsPerTbsp` additively (keeping the tbsp serving + `fdcId`), with byte-stable meal snapshots and load-with-defaults-or-fail-loud malformed handling.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (Task 1 refactor/harden, Task 2 test)
- **Files modified:** 9 (5 created fixtures, 3 source/spec, 1 requirements)

## Critical Prior-Work Reconciliation

Plan 02-01 had **already** landed the `migrateV6ToV7` hop, the chain wiring (`fromVersion < 7`), `CURRENT_SCHEMA_VERSION=7`, the `LegacyAppDataV6` interface, and the `migrateSavedFoodV6ToV7` density-deriving helper — as a documented Rule-3 deviation to keep the migrate chain consistent. This plan did **NOT** recreate or duplicate any of those. Instead it:

1. **Verified** the existing transform against every must_have truth (all satisfied).
2. **Hardened** one real gap: `LegacyAppDataV6.savedFoods` was typed as the *widened* `SavedFood[]`, not the narrow pre-V7 shape the plan's Task 1 specifies (`LegacySavedFoodV6` with `baseUnit: 'g'|'tbsp'`, `gramsPerTbsp?`, NO `densityGramsPerMl`/`preferredUnits`). Added `LegacySavedFoodV6`, retyped the field, retyped `migrateSavedFoodV6ToV7` to consume it.
3. **Delivered** the parts 02-02 still owned and that were MISSING: the 5 fixtures + the in-depth V6→V7 spec coverage.

## Accomplishments

### Task 1 — `LegacySavedFoodV6` + narrowed migration input (`5cad00c`, refactor)

- Added `export interface LegacySavedFoodV6` to `legacy-schemas.ts`: the honestly-narrow pre-V7 food (`baseUnit: 'g' | 'tbsp'`, `gramsPerTbsp?`, `fdcId?`, `nutrientsPerUnit`, `servings`, id/name/timestamps; **no** `densityGramsPerMl`/`preferredUnits`).
- Retyped `LegacyAppDataV6.savedFoods` from `SavedFood[]` → `LegacySavedFoodV6[]`. Strict-TS now guarantees `migrateV6ToV7` only reads pre-V7 fields and never assumes the new ones exist.
- Retyped `migrateSavedFoodV6ToV7(food: LegacySavedFoodV6): SavedFood` — carries every V6 field through additively, preserves `fdcId` via the exact spread-preserve idiom (matching `migrateSavedFoodV2ToV3`), keeps `gramsPerTbsp` + the tbsp serving, derives `densityGramsPerMl = gramsPerTbsp / 14.78676478125` only for a positive finite `gramsPerTbsp`.
- Narrowed `migrateV5ToV6`'s `savedFoods` to the V6 input type via a documented runtime-no-op cast (V5-stored foods structurally hold the narrow shape; only the static type tightens).
- `ng build --configuration=production` exit 0 (only pre-existing budget warnings, unrelated).

### Task 2 — V6/V7 fixtures + malformed matrix + 9 specs (`576b6e3`, test)

- **`v6.json`** — complete V6 `AppData`: a `gramsPerTbsp` food (olive oil, 13.5) with a dormant `fdcId` + a tbsp serving, a g-only food (egg), one `mealEntry` with a populated snapshot, all non-diet slices.
- **`v7-expected.json`** — the migrated output: oil now also has `densityGramsPerMl = 0.9129786129497609` AND still `gramsPerTbsp` AND `fdcId`; egg unchanged (no density); `mealEntries` byte-identical; no `dailyTargets` key.
- **3 malformed fixtures** — `v6-missing-savedfoods.json` (no `savedFoods`), `v6-wrong-type-density.json` (`gramsPerTbsp: "abc"`), `v6-null.json` (literal `null`).
- **9 new specs** in the `V6 → V7 migration (DIET-10, D-13)` describe block: schemaVersion 7 + every-field carry-through, density derivation with `gramsPerTbsp`/tbsp-serving/`fdcId` all retained, g-only food gets no density, **byte-stable mealEntries** deep-equal (D-12), `dailyTargets` undefined, full `v7-expected` deep-equal (modulo `lastModified`), v6-keyed backup, and the 3-case malformed matrix (missing→`[]`, wrong-type→no derived density + food still loads, null→tolerated/fail-loud).
- Migration spec: **30/30**. Full suite: **793/793**. Tree-wide `localStorage` chokepoint clean.

## Must-Have Truths — Verification

| Truth | Status | Evidence |
|-------|--------|----------|
| D-13: V6 AppData → schemaVersion 7, every field carried through | PASS | `migrates a V6 fixture to schemaVersion 7...` spec + full `v7-expected` deep-equal |
| gramsPerTbsp derives densityGramsPerMl additively, tbsp serving kept | PASS | `derives densityGramsPerMl... KEEPING gramsPerTbsp, the tbsp serving, and fdcId` spec |
| fdcId passthrough survives untouched | PASS | same spec asserts `fdcId === 123456` post-migration |
| Malformed/partial V6 loads-with-defaults OR throws MIGRATION_FAILED | PASS | 3-case malformed matrix |
| mealEntries byte-stable (D-12) | PASS | `keeps mealEntries (snapshots) byte-stable...` deep-equal spec |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical correctness] Narrowed the V6 migration INPUT type**
- **Found during:** Task 1 (verification against the plan's Task 1 spec).
- **Issue:** The pre-built `LegacyAppDataV6.savedFoods` was typed as the *widened* `SavedFood[]`. The plan's Task 1 explicitly requires the narrow `LegacySavedFoodV6[]` so the migration input cannot statically assume the V7-only `densityGramsPerMl`/`preferredUnits` are already present — a type-safety correctness requirement (T-02-02-01/02 mitigations rely on the input being honestly pre-V7).
- **Fix:** Added `LegacySavedFoodV6`; retyped the field and `migrateSavedFoodV6ToV7`; narrowed `migrateV5ToV6`'s output via a documented runtime-no-op cast.
- **Files modified:** `src/app/services/legacy-schemas.ts`, `src/app/services/storage.service.ts`.
- **Commit:** `5cad00c`.

### Note on TDD collapse (honest reporting)

Per the plan's prior-work notice: the `migrateV6ToV7` transform was already correct, so Task 2's specs are **GREEN-confirming** — they passed on first run against the existing (and Task-1-hardened) implementation, with no RED phase needed. The transform did not require any behavior fix; only the input *type* was hardened (Task 1) and the dedicated *coverage* was added (Task 2). No genuine gap was found in the migration's runtime behavior.

## Threat-Model Compliance

- **T-02-02-01 (data loss):** Additive transform (`?? []` defensive, every field carried); fixture + 3-case malformed matrix prove no corruption. Input now honestly narrow.
- **T-02-02-02 (fdcId/gramsPerTbsp passthrough):** Spread-preserve idiom; spec asserts both survive + the tbsp serving.
- **T-02-02-03 (snapshot immutability, D-12):** `mealEntries` carried byte-for-byte; spec deep-equals input vs migrated.
- **T-02-02-04 (malformed V6 DoS):** Each malformed case loads-with-defaults or fails loud; no silent crash/corrupt.
- **T-02-02-05 (egress, accept):** Pure local transform; no network. Chokepoint grep clean.

## Issues Encountered

None. The build and full suite stayed green throughout. (The "disk full" lines in the full-suite log are deliberate `console.error` output from an existing chat error-path test, not failures — 793/793 SUCCESS.)

## Self-Check: PASSED

- All 5 fixtures present and valid JSON (v6.json, v7-expected.json, 3 malformed).
- Both task commits present: `5cad00c` (refactor), `576b6e3` (test).
- Migration spec 30/30; full suite 793/793; production build exit 0.

---
*Phase: 02-diet-ux-overhaul*
*Completed: 2026-06-01*
