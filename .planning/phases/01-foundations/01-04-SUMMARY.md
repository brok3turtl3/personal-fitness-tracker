---
phase: 01-foundations
plan: 04
subsystem: storage-migration
tags: [storage, migration, legacy-schemas, fixtures, typed-shapes, schema-discipline]

# Dependency graph
requires:
  - phase: 00-research
    provides: Pattern 6 (RESEARCH §587-700 — verbatim legacy-schemas interfaces) + Pattern 7 (RESEARCH §701-771 — fixture-driven test pattern + malformed-input matrix)
  - phase: 01-foundations
    plan: 01
    provides: karma.conf.js per-pattern coverage block including the 100% override on legacy-schemas.ts (which fires for free since the file is type-only — zero executable lines)
provides:
  - "src/app/services/legacy-schemas.ts — type-only module exporting LegacyAppDataV0, LegacyAppDataV1, LegacyAppDataV2, LegacyAppDataV3, LegacySavedFoodV2 (D-16)"
  - "src/app/services/migrations/fixtures/v0..v3.json — 4 minimal input fixtures, one per pre-migration version, hand-built to exercise every conditional branch in the corresponding migrateVxToVy()"
  - "src/app/services/migrations/fixtures/v1..v4-expected.json — 4 expected fixtures for partial-deep-equal assertion via jasmine.objectContaining (Wave 2 plan 09)"
  - "src/app/services/migrations/fixtures/malformed/{null,empty-object,wrong-types,missing-fields}.json — D-17 malformed-input matrix (corrupted-LocalStorage cases)"
affects:
  - "01-09 (Wave 2 storage refactor) — consumes LegacyAppDataVN interfaces to remove the 5 as-any casts at storage.service.ts:296,298,306,324,350; consumes fixture JSON via resolveJsonModule import for storage.service.migration-fixtures.spec.ts"
  - "01-10 (Wave 3 recovery banner) — D-15 recovery UX surfaces StorageError(MIGRATION_FAILED) which the malformed-input matrix verifies the migration system raises rather than silently corrupting"
  - "Phase 2 (V5→V6 diet migration) and Phase 3 (V4→V5 AI migration) — both reuse this fixture harness and add v4.json/v5.json next to v0..v3 without restructuring (CONTEXT.md §specifics)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Type-only module convention for legacy-schemas — mirrors validators.ts top section (imports of model types only, no @Injectable, no class, no runtime exports). Tree-shaken from production bundles; karma 100% threshold applies for free (zero executable lines)."
    - "Fixture path convention src/app/services/migrations/fixtures/v{N}.json (D-17 — stable for Phase 2/3 to drop v4.json/v5.json without restructuring)"
    - "Malformed-input matrix subdirectory migrations/fixtures/malformed/ — null, empty-object, wrong-types, missing-fields. Wave 2 plan 09's spec asserts the migration system either initializes cleanly with defaults OR raises a typed StorageError, never silently corrupts."
    - "Pretty-printed (2-space indent) JSON fixtures for diff readability (D-17 spec convention)"
    - "Discriminated literal types on schemaVersion (1, 2, 3) — TypeScript narrows the legacy shape based on the schemaVersion field, eliminating runtime branch-on-version checks in the migration chain"

key-files:
  created:
    - "src/app/services/legacy-schemas.ts — 5 type-only exports (95 lines)"
    - "src/app/services/migrations/fixtures/v0.json — V0 (pre-versioning) shape, exercises migrateV0ToV1 default-empty-array branches"
    - "src/app/services/migrations/fixtures/v1.json — V1 shape (schemaVersion: 1), exercises migrateV1ToV2 default-empty-array branches for savedFoods/mealEntries"
    - "src/app/services/migrations/fixtures/v2.json — V2 shape with legacy nutrientsPer100g + servings.grams, exercises migrateV2ToV3 nutrient-conversion + serving-conversion paths"
    - "src/app/services/migrations/fixtures/v3.json — V3 shape (post-savedFoods migration), exercises migrateV3ToV4 chatConversations default-empty + aiSettings undefined paths"
    - "src/app/services/migrations/fixtures/v1-expected.json — V0→V1 partial expected (schemaVersion: 1 + V0 data preserved)"
    - "src/app/services/migrations/fixtures/v2-expected.json — V1→V2 partial expected (savedFoods/mealEntries defaulted to [])"
    - "src/app/services/migrations/fixtures/v3-expected.json — V2→V3 partial expected (savedFoods.id/name/timestamps preserved; baseUnit/nutrientsPerUnit checked separately by spec asserting exact values)"
    - "src/app/services/migrations/fixtures/v4-expected.json — V3→V4 partial expected (chatConversations: [], aiSettings omitted per CLAUDE.md no-null-for-absent-optional rule)"
    - "src/app/services/migrations/fixtures/malformed/null.json — JSON literal null"
    - "src/app/services/migrations/fixtures/malformed/empty-object.json — {}"
    - "src/app/services/migrations/fixtures/malformed/wrong-types.json — schemaVersion: 2 with savedFoods: \"not-an-array\""
    - "src/app/services/migrations/fixtures/malformed/missing-fields.json — schemaVersion: 1 only, no required V1 arrays"
  modified: []

key-decisions:
  - "LegacyAppDataV0 uses optional `?` fields throughout (defensive — real-world V0 data was thin and may be missing arrays); V1+ require arrays per their migration contract"
  - "LegacySavedFoodV2 modeled exactly on the inline-literal at storage.service.spec.ts:307-334 — fdcId, nutrientsPer100g (with all 8 nutrient keys optional), servings with `grams` only, plus id/name/timestamps required"
  - "v4-expected.json omits `aiSettings` rather than setting it to null — strict adherence to CLAUDE.md mandate \"Do NOT store null for absent optional fields, use undefined / omit the field\""
  - "Expected fixtures are partial-deep-equal targets, not exhaustive shape — Wave 2 plan 09's spec wires `expect(actual).toEqual(jasmine.objectContaining(expected))`, so additional fields produced by migrate functions (e.g., baseUnit, nutrientsPerUnit on V2→V3) don't fail the partial assertion. Spec asserts those fields' exact values separately."
  - "Each input fixture exercises a different domain (cardio in v0, weight in v1, savedFoods in v2, healthReadings in v3) so the suite collectively covers every migrate-function branch with minimal data overlap"

patterns-established:
  - "Pattern: Typed legacy schemas as a separate file in services/ (next to consumer) rather than models/. Models are project-stable shapes; legacy schemas are migration-implementation details — distinct concerns belong in distinct directories."
  - "Pattern: Discriminated schemaVersion literal types (1, 2, 3) for the LegacyAppDataVN chain — enables TypeScript narrowing on the migration entry point's `schemaVersion: number` field after a runtime check"
  - "Pattern: Pretty-printed JSON fixtures for migration tests — diffs are readable when fixtures evolve; `node -e \"JSON.parse(...)\"` smoke-validates parseability in CI before karma runs"
  - "Pattern: Malformed-input matrix subdirectory for negative cases — keeps positive (v0..v3) and negative (malformed/*) fixture sets visually segregated; spec imports from each path explicitly"

requirements-completed: []
# FOUND-07 NOT marked complete — full coverage requires Wave 2 plan 09's storage.service.ts refactor + Wave 3 plan 10's recovery banner. This plan ships the building blocks only.

# Metrics
duration: 8min
completed: 2026-05-02
---

# Phase 1 Plan 04: Typed Legacy Schemas + V0..V3 Fixtures + Malformed-Input Matrix Summary

**Type-only `legacy-schemas.ts` (5 interfaces) + 12 JSON fixtures (4 input + 4 expected + 4 malformed) — all building blocks for Wave 2 plan 09's typed-migration refactor and fixture-driven spec.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-02T19:24Z
- **Completed:** 2026-05-02T19:30Z
- **Tasks:** 3/3
- **Files created:** 13

## Accomplishments

- **Typed legacy schemas (D-16):** `LegacyAppDataV0`, `LegacyAppDataV1`, `LegacyAppDataV2`, `LegacyAppDataV3`, and `LegacySavedFoodV2` exported from `src/app/services/legacy-schemas.ts`. Type-only module — zero runtime code, zero `@Injectable`, zero `any`. Wave 2 plan 09 will consume these to delete the 5 `as any` casts at `storage.service.ts:296, 298, 306, 324, 350`.
- **Migration fixture suite (D-17):** 4 input fixtures (`v0..v3.json`) and 4 expected fixtures (`v1..v4-expected.json`) at the canonical `src/app/services/migrations/fixtures/` path. Each input is the smallest record that exercises every conditional branch in the corresponding `migrateVxToVy()`; each domain (cardio, weight, savedFoods with legacy `nutrientsPer100g`, healthReadings) appears in exactly one fixture so the suite collectively covers every branch with minimal overlap.
- **Malformed-input matrix (D-17):** 4 corruption-case fixtures under `migrations/fixtures/malformed/` — `null.json` (JSON literal null), `empty-object.json` (`{}`), `wrong-types.json` (`savedFoods: "not-an-array"`), `missing-fields.json` (`schemaVersion: 1` only, no required V1 arrays). Wave 2 plan 09's spec will assert the migration system either initializes cleanly with defaults OR raises a typed `StorageError(MIGRATION_FAILED)` — never silently corrupts.
- **Production build still passes:** `ng build --configuration=production` exits 0 after every commit. `legacy-schemas.ts` compiles standalone (no consumer yet — that's plan 09).
- **`storage.service.ts` UNCHANGED:** This plan ships the schemas + fixtures only; the migration code refactor is Wave 2 plan 09's deliverable. `git diff HEAD~3 src/app/services/storage.service.ts` is empty.

## Task Commits

Each task was committed atomically on `gsd/phase-1-foundations`:

1. **Task 1: Create `src/app/services/legacy-schemas.ts`** — `694b914` (feat)
2. **Task 2: Create migration input + expected fixture JSON files (V0..V3 input, V1..V4 expected)** — `afa9eee` (test)
3. **Task 3: Create malformed-input matrix fixtures** — `cb2e002` (test)

**Plan metadata commit:** appended after this SUMMARY + STATE/ROADMAP updates.

## Files Created/Modified

**Created (13 files):**

- `src/app/services/legacy-schemas.ts` — 5 typed legacy interfaces (V0..V3 + V2 saved-food shape); 95 lines; type-only module
- `src/app/services/migrations/fixtures/v0.json` — pre-versioning shape (one cardio session)
- `src/app/services/migrations/fixtures/v1.json` — V1 shape (one weight entry)
- `src/app/services/migrations/fixtures/v2.json` — V2 shape with legacy `nutrientsPer100g` + `servings.grams` (one egg saved-food)
- `src/app/services/migrations/fixtures/v3.json` — V3 shape (one blood-pressure reading)
- `src/app/services/migrations/fixtures/v1-expected.json` — partial expected post-V0→V1
- `src/app/services/migrations/fixtures/v2-expected.json` — partial expected post-V1→V2
- `src/app/services/migrations/fixtures/v3-expected.json` — partial expected post-V2→V3
- `src/app/services/migrations/fixtures/v4-expected.json` — partial expected post-V3→V4 (omits `aiSettings`)
- `src/app/services/migrations/fixtures/malformed/null.json` — `null`
- `src/app/services/migrations/fixtures/malformed/empty-object.json` — `{}`
- `src/app/services/migrations/fixtures/malformed/wrong-types.json` — `savedFoods: "not-an-array"`
- `src/app/services/migrations/fixtures/malformed/missing-fields.json` — only `schemaVersion: 1`

**Modified:** none (this plan does not touch `storage.service.ts` — that's Wave 2 plan 09).

## Decisions Made

- **Optional fields on `LegacyAppDataV0` (per RESEARCH §Pattern 6 + storage.service.ts:263-273 evidence):** Real-world V0 data was thin and frequently missing arrays. The migration code at `migrateV0ToV1` defaults each missing array to `[]`. Modeling V0 fields as `?` matches this defensive contract; V1+ remove the `?` because their migration steps require populated input.
- **`LegacySavedFoodV2` matches the inline-literal at `storage.service.spec.ts:307-334`:** Same fields, same optionality. Wave 2 plan 09's spec asserts the V2→V3 nutrient conversion against this same shape via the `v2.json` fixture, so any drift between this interface and the inline literal would surface as a fixture-vs-inline-literal disagreement at spec runtime.
- **`v4-expected.json` omits `aiSettings` rather than setting it to `null`:** CLAUDE.md mandate "Do NOT store null for absent optional fields — use undefined / omit the field." The `migrateV3ToV4` implementation at `storage.service.ts:319` writes `aiSettings: (data as Partial<AppData>).aiSettings` (which is `undefined` when input lacks the field), and `JSON.stringify(undefined)` omits the key — so the expected fixture must omit it too for partial-deep-equal to succeed.
- **Expected fixtures are partial-match targets, not exhaustive shapes:** Wave 2 plan 09's spec uses `jasmine.objectContaining(expected)` so additional fields produced by `migrate*` functions (e.g., `baseUnit`, `nutrientsPerUnit` on V2→V3 saved foods) don't fail the partial assertion. The spec asserts the exact values of those produced fields separately, against the existing inline-literal test at `storage.service.spec.ts:341-348` which stays green.

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed without auto-fixing anything; no Rule 1/2/3 deviations triggered. CLAUDE.md compliance was verified inline on the `aiSettings` decision (Rule 2 would have been triggered if `v4-expected.json` had set `aiSettings: null`, but the planner already flagged this in the action block).

**Total deviations:** 0
**Impact on plan:** None — clean execution.

## Issues Encountered

None.

## Verification

- `ng build --configuration=production` — **exit 0** after Task 1 (legacy-schemas.ts compiles) AND after Task 3 (after fixtures land — fixtures aren't compiled but verifying the build still works confirms no accidental side effects).
- `node -e "JSON.parse(...)"` for each of the 12 fixture JSON files — **all 12 valid JSON**.
- `grep '@Injectable' src/app/services/legacy-schemas.ts | grep -v '^\s*\*'` — **no non-comment matches** (only the JSDoc reference at line 13).
- `grep '\bany\b' src/app/services/legacy-schemas.ts | grep -v '^\s*\*'` — **no non-comment matches** (only JSDoc references at lines 8, 9, 46 documenting the as-any casts that Wave 2 plan 09 will eliminate).
- `grep '^export\s\+\(class\|function\|const\|let\|var\)' src/app/services/legacy-schemas.ts` — **zero hits** (no runtime exports).
- All 5 named exports present: `grep -cE "export interface (LegacyAppDataV0|LegacyAppDataV1|LegacyAppDataV2|LegacyAppDataV3|LegacySavedFoodV2)"` returns 5.
- `git diff` shows `storage.service.ts` is **unchanged** since plan 03's last commit (`b28b39f`).
- `null.json` parses to JS `null`; `empty-object.json` parses to `{}` with `Object.keys().length === 0`; `wrong-types.json` contains `"savedFoods": "not-an-array"`; `missing-fields.json` parses to `{schemaVersion: 1}` with `Object.keys().length === 1`.

## Threat-Model Compliance

- **T-04-01 (Tampering — untyped legacy data corrupts after migration):** `legacy-schemas.ts` provides typed `LegacyAppDataV0..V3` + `LegacySavedFoodV2`. Acceptance criterion `! grep -nE '\\bany\\b'` (excluding JSDoc) passes. Wave 2 plan 09 consumes these to remove the 5 `as any` casts.
- **T-04-02 (Tampering — malformed input silently corrupts data):** All 4 malformed-input fixtures present and JSON-valid. Wave 2 plan 09's spec drives them through `localStorageMock` and asserts the migration system raises `StorageError(MIGRATION_FAILED)` or initializes with safe defaults — never silently corrupts.
- **T-04-03 (Repudiation — "we tested the migration" without explicit fixtures):** Hand-built fixture suite at the canonical `src/app/services/migrations/fixtures/v{N}.json` path per D-17. Stable, version-controlled inputs. Wave 2 plan 09's spec reads from these files (no hidden inline literals).

## FOUND-07 Status

**NOT yet marked complete in REQUIREMENTS.md.** This plan delivered the building blocks (typed shapes + fixtures); full coverage of FOUND-07 requires:

- Wave 2 plan 09 — refactor `storage.service.ts` to consume the typed shapes (delete the 5 `as any` casts) AND ship `storage.service.migration-fixtures.spec.ts` (the fixture-driven spec that consumes these JSON files via `resolveJsonModule` import)
- Wave 3 plan 10 — recovery banner UX (D-15) that surfaces migration failures to the user

FOUND-07 flips to `[x]` when both 09 and 10 land — same gating policy used for FOUND-02/04/05 (building blocks present in Wave 1, requirement-completion gated on consumer adoption in later waves).

## Wave 1 Status

**Wave 1 of Phase 1 is now complete (4/4 plans):**

- 01-01 — Coverage config + axe-core install + tsconfig.spec patch (FOUND-01) — done 2026-05-02
- 01-02 — Shared utilities create: id.ts, chart-grouping.ts, a11y-test-helpers.ts (FOUND-02, FOUND-04, FOUND-05) — done 2026-05-02
- 01-03 — Empty-state + error-state standalone components (FOUND-06) — done 2026-05-02
- 01-04 — Typed legacy schemas + V0..V3 fixtures + malformed-input fixtures (FOUND-07 — building blocks) — done 2026-05-02 (this plan)

Wave 2 (plans 05, 06, 09) is now unblocked.

## Self-Check

Verifying claims before finalizing:

- `src/app/services/legacy-schemas.ts` — FOUND
- `src/app/services/migrations/fixtures/v0.json` — FOUND
- `src/app/services/migrations/fixtures/v1.json` — FOUND
- `src/app/services/migrations/fixtures/v2.json` — FOUND
- `src/app/services/migrations/fixtures/v3.json` — FOUND
- `src/app/services/migrations/fixtures/v1-expected.json` — FOUND
- `src/app/services/migrations/fixtures/v2-expected.json` — FOUND
- `src/app/services/migrations/fixtures/v3-expected.json` — FOUND
- `src/app/services/migrations/fixtures/v4-expected.json` — FOUND
- `src/app/services/migrations/fixtures/malformed/null.json` — FOUND
- `src/app/services/migrations/fixtures/malformed/empty-object.json` — FOUND
- `src/app/services/migrations/fixtures/malformed/wrong-types.json` — FOUND
- `src/app/services/migrations/fixtures/malformed/missing-fields.json` — FOUND
- Commit `694b914` (feat) — FOUND on `gsd/phase-1-foundations`
- Commit `afa9eee` (test) — FOUND on `gsd/phase-1-foundations`
- Commit `cb2e002` (test) — FOUND on `gsd/phase-1-foundations`

## Self-Check: PASSED
