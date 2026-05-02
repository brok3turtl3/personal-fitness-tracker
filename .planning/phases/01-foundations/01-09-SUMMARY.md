---
phase: 01-foundations
plan: 09
subsystem: storage
tags: [storage, migration, typed-shapes, backup, recovery-key, fixture-driven-tests, refactor]

# Dependency graph
requires:
  - phase: 01-foundations
    provides: legacy-schemas.ts (typed LegacyAppDataV0..V3 + LegacySavedFoodV2) and 12 fixture JSON files (plan 04)
provides:
  - Typed migrate chain in StorageService (zero `any` keyword in storage.service.ts)
  - Backup-before-migrate pattern (D-14) — pre-migration snapshot at fitness_tracker_data.backup.v{N}.{ISO}
  - pruneOldBackups() with strict prefix filter (T-09-02 security gate)
  - StorageError(MIGRATION_FAILED) with recovery key in message (D-15)
  - storage.service.migration-fixtures.spec.ts — fixture-driven V0..V3 chain + 4-case malformed-input matrix (D-17)
  - 8 new spec scenarios in storage.service.spec.ts (3 new describe blocks)
affects:
  - Plan 01-10 (recovery banner reads StorageError(MIGRATION_FAILED) and renders the recovery key)
  - Phase 2 V5→V6 diet migration (lands on this typed-legacy harness)
  - Phase 3 V4→V5 AI fields migration (lands on this typed-legacy harness)

# Tech tracking
tech-stack:
  added: []  # No new dependencies — pure refactor + tests
  patterns:
    - "Typed legacy migration chain (Pattern 6): each migrateVxToVy hop accepts and returns concrete LegacyAppDataVN, no `as any`"
    - "Backup-before-migrate (Pattern 5): write timestamped snapshot under BACKUP_KEY_PREFIX before mutating the live store; throw StorageError on migration failure carrying the recovery key"
    - "Strict prefix-only key filter for pruning (T-09-02): never matches STORAGE_KEY itself"
    - "Storage.prototype length+key patch in specs (workaround for spyOnProperty failing on non-instance accessors)"

key-files:
  created:
    - src/app/services/storage.service.migration-fixtures.spec.ts (198 lines, 9 specs)
  modified:
    - src/app/services/storage.service.ts (152 line delta — typed chain + backup/prune/throw flow)
    - src/app/services/storage.service.spec.ts (storage spec extended with 3 new describe blocks; afterEach prototype-restore)

key-decisions:
  - "Drop `fdcId` from typed SavedFood return — but preserve at runtime via conditional spread, since SavedFood model does not declare fdcId but legacy V2 entries may have it. Avoids re-introducing an unsafe cast while keeping behavior backward-compatible."
  - "PARSE_ERROR vs MIGRATION_FAILED separation: JSON.parse failure -> PARSE_ERROR; any error inside the migrate chain -> MIGRATION_FAILED. Keeps existing behavior for invalid JSON and adds the new failure path for migration logic errors."
  - "Mock localStorage iteration via Storage.prototype monkey-patch (length+key). spyOnProperty fails because length is on the prototype, not the instance ('Accessor properties are not allowed'). Patched in beforeEach, restored in afterEach with the original PropertyDescriptor."
  - "Malformed-input matrix accepts both branches (clean default OR throw): per D-17 'never silently corrupt'. Spec asserts `code===MIGRATION_FAILED` AND backup-key-present on the throw branch."
  - "Pre-existing test at `storage.service.spec.ts` line 268 ('migrate v1 data to v3') stays green — V1 fixture lacks `savedFoods`/`mealEntries` arrays, but the typed V1->V2 hop seeds them, so the V2->V3 saved-food map iterates the seeded `[]` without issue. Tested + verified."

patterns-established:
  - "Typed migrate chain pattern: every from-version maps to a stepwise typed local (v1, v2, v3, v4) with concrete LegacyAppDataVN signatures. New migrations (V4->V5, V5->V6) bolt on by adding a new typed hop."
  - "Backup key naming convention: `${BACKUP_KEY_PREFIX}v${fromVersion}.${ISO_with_colons_replaced_by_dashes}`. Lex-sortable because timestamp is fixed-width."
  - "Storage spec mocking with prototype patch: when length/key iteration is needed, capture original PropertyDescriptor in beforeEach and restore in afterEach to avoid cross-spec leakage."
  - "Test scenario matrix via `Array<[string, unknown]>` + for-loop generating individual `it(...)` calls — gives one failure-line per malformed case rather than one assert-per-loop in a monolithic spec."

requirements-completed: []  # FOUND-07 NOT yet complete — recovery banner (plan 10) still required

# Metrics
duration: ~14 min
completed: 2026-05-02
---

# Phase 1 Plan 09: Storage Migration Refactor — Typed Chain + Backup + Fixture Spec — Summary

**Replaced 5 `as any` casts with typed `LegacyAppDataVN` chain, added backup-before-migrate writing a timestamped recovery key (`fitness_tracker_data.backup.v{N}.{ISO}`) with strict-prefix prune-to-3, and shipped a fixture-driven migration spec covering V0..V3 plus a 4-case malformed-input matrix.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-02T19:50Z (approx — corresponding to PLAN_START)
- **Completed:** 2026-05-02T20:00Z
- **Tasks:** 3/3
- **Files modified:** 2 (storage.service.ts, storage.service.spec.ts)
- **Files created:** 1 (storage.service.migration-fixtures.spec.ts)

## Accomplishments

### Task 1: Typed migrate chain (commit `c0fce5a`)
- Imported `LegacyAppDataV0..V3` + `LegacySavedFoodV2` from `legacy-schemas.ts` (created in plan 04)
- Refactored `migrateData(data: unknown): AppData` to stepwise typed locals (v1/v2/v3/v4) per RESEARCH §Pattern 6 — each hop runs only when `fromVersion < target`
- All four `migrateVxToVy()` private methods now have concrete typed signatures:
  - `migrateV0ToV1(data: LegacyAppDataV0): LegacyAppDataV1`
  - `migrateV1ToV2(data: LegacyAppDataV1): LegacyAppDataV2`
  - `migrateV2ToV3(data: LegacyAppDataV2): LegacyAppDataV3` — saved-food loop now iterates `LegacySavedFoodV2` directly (no `as any` reads)
  - `migrateV3ToV4(data: LegacyAppDataV3): AppData` — `aiSettings` stays `undefined` per CLAUDE.md "no null for absent optional fields"
- `migrateSavedFoodV2ToV3(food: LegacySavedFoodV2): SavedFood` — typed input/output; preserves `fdcId` runtime extra via conditional spread
- **Zero `any` keyword** in `storage.service.ts` (negative grep gate green) — strict TS now catches typos in legacy field names

### Task 2: Backup-before-migrate + pruneOldBackups + MIGRATION_FAILED (commit `512afb5`)
- Added two static class members:
  - `BACKUP_KEY_PREFIX = 'fitness_tracker_data.backup.'` (trailing dot is the security boundary)
  - `MAX_BACKUPS_TO_KEEP = 3`
- Refactored `initialize()`:
  - Parses JSON first (PARSE_ERROR path unchanged)
  - Reads `fromVersion` defaulting to 0
  - On migration branch: prune old backups → write new backup → wrap migrate+persist in try/catch
  - On migration failure: throws `StorageError(MIGRATION_FAILED)` with the recovery key in the message
- New private methods:
  - `writeBackup(rawData, fromVersion)`: writes timestamped key, swallows quota errors (Pitfall 4 best-effort)
  - `pruneOldBackups()`: iterates via `localStorage.length` + `key(i)`, filters strictly on `BACKUP_KEY_PREFIX`, keeps newest 3 (lex-sorted)
- Spec extended with 3 new `describe` blocks (8 scenarios):
  - `backup-before-migrate` — backup key format regex, no backup on no-migration path, no backup on first run
  - `migration failure recovery` — MIGRATION_FAILED carries recovery key; cachedData stays uninitialized on throw
  - `pruneOldBackups` — keeps newest 3, never removes STORAGE_KEY, never removes foreign keys
- **Storage prototype patch** in beforeEach/afterEach — required because `spyOnProperty(localStorage, 'length', 'get')` fails with "Accessor properties are not allowed" (length lives on `Storage.prototype`, not the instance)

### Task 3: Fixture-driven migration spec (commit `c11904c`)
- Created `src/app/services/storage.service.migration-fixtures.spec.ts` (198 lines, 9 specs)
- 5 chain tests:
  - V0 input migrates to current schema; cardio session preserved through chain; V1+ containers default to `[]`
  - V1 input migrates to current schema; weight entry preserved
  - V2 input migrates saved foods through V2→V3 transformation (155 kcal/100g → 1.55 kcal/g; baseUnit='g')
  - V3 input migrates to V4 with `chatConversations: []` and `aiSettings === undefined`
  - V0 input writes a backup key matching `BACKUP_KEY_PREFIX + 'v0.' + ISO` regex
- 4 malformed-input matrix cases (D-17): `null`, `{}`, wrong-type savedFoods, missing required fields. Each accepts either branch:
  - **Success:** cachedData reaches `CURRENT_SCHEMA_VERSION`
  - **Throw:** `StorageError(MIGRATION_FAILED)` with backup key on disk for recovery

## Verification

| Check | Result |
| --- | --- |
| `! grep -nE '\bas any\b' src/app/services/storage.service.ts` | OK (no matches) |
| `grep -nE '\bany\b' src/app/services/storage.service.ts` | OK (no matches anywhere — zero `any` keyword) |
| `grep -q "from './legacy-schemas'"` | OK |
| 5 legacy types imported (LegacyAppDataV0..V3 + LegacySavedFoodV2) | OK |
| 4 typed `migrateV[0-3]To.*` signatures | OK (4) |
| `BACKUP_KEY_PREFIX` declared | OK |
| `MAX_BACKUPS_TO_KEEP = 3` | OK |
| `writeBackup` + `pruneOldBackups` methods | OK |
| `'MIGRATION_FAILED'` thrown in `initialize()` | OK |
| `pruneOldBackups` filters strictly on prefix | OK |
| 3 new describe blocks in storage.service.spec.ts | OK (3 — backup-before-migrate, migration failure recovery, pruneOldBackups) |
| New fixture spec file exists | OK |
| All 4 malformed cases enumerated | OK |
| `ng test --no-watch --browsers=ChromeHeadless` | **236 SUCCESS** (was 219 before; +17 new specs) |
| `ng build --configuration=production` | exit 0 |

## Threat-model compliance

| Threat ID | Disposition | Verification |
|-----------|-------------|--------------|
| T-09-01 (typed legacy data) | mitigate | Zero `any` in storage.service.ts; 5 legacy types imported; 4 typed migrate signatures |
| T-09-02 (pruneOldBackups deletes wrong key) | mitigate | Spec "should never remove the active STORAGE_KEY" passes; spec "should never remove keys without the BACKUP_KEY_PREFIX" passes; trailing-dot prefix asserted in `writeBackup` and `startsWith` filter |
| T-09-03 (migration failure silently destroys data) | mitigate | `initialize()` writes backup BEFORE migrating; failure throws `StorageError(MIGRATION_FAILED)` with recovery key in message; spec verifies key in message and backup on disk |
| T-09-04 (backup write itself overflows quota) | accept | `writeBackup` swallows quota errors per Pitfall 4 — migration proceeds even if backup unavailable |
| T-09-05 (future migrations skip typed pattern) | mitigate | Acceptance criteria for Phase 2 V5→V6 + Phase 3 V4→V5 land on this typed-legacy harness; CONTEXT.md chains both onto FOUND-07 |

## Deviations from Plan

**None.** Plan executed exactly as written. The 3 minor implementation choices below were anticipated by the plan or are mechanical workarounds:

1. **fdcId preservation via conditional spread** — `LegacySavedFoodV2` has optional `fdcId` but `SavedFood` model does not. Used `food.fdcId !== undefined ? { ...base, fdcId: food.fdcId } as SavedFood : base` to preserve runtime behavior without re-introducing an `as any` cast. Equivalent to the prior `...food` spread but type-safe.
2. **Storage prototype patch in spec setup** — `spyOnProperty(localStorage, 'length', 'get')` fails with "Accessor properties are not allowed" because `length` is defined on `Storage.prototype`, not the localStorage instance. Worked around by capturing the original `PropertyDescriptor` in beforeEach and restoring it in `afterEach`. Same pattern in both spec files for consistency.
3. **Comment cleanup** — initial typed-chain JSDoc included literal "as any" inside backticks ("replaces the prior `as any` casts"), which the negative grep gate flagged. Reworded to "unsafe casts" — preserves meaning without flagging the FOUND-07 critical gate.

## Authentication Gates

None.

## Known Stubs

None. The migration chain is complete through V4. Stubs noted for future phases (V4→V5 in Phase 3, V5→V6 in Phase 2) are out of scope.

## TDD Gate Compliance

This plan was `type: execute` (not `type: tdd`), so the RED/GREEN/REFACTOR plan-level gate does not apply. Per-task commits used standard conventional types: `refactor`, `feat`, `test`. No TDD gate warnings.

## Self-Check: PASSED

- File `src/app/services/storage.service.migration-fixtures.spec.ts` — exists
- File `src/app/services/storage.service.ts` — modified (typed chain + backup/prune/throw)
- File `src/app/services/storage.service.spec.ts` — modified (3 new describe blocks)
- Commit `c0fce5a` — present in `git log`
- Commit `512afb5` — present in `git log`
- Commit `c11904c` — present in `git log`
- `ng test --no-watch --browsers=ChromeHeadless` → 236 SUCCESS
- `ng build --configuration=production` → exit 0
