---
phase: 05-web-search-grounding-quality-sweep
plan: 03
subsystem: services
tags: [angular, rxjs, crud, discriminated-union, tdd, localstorage]

# Dependency graph
requires:
  - phase: 01-foundations
    provides: StorageService chokepoint + typed AppData + per-service spec pattern
  - phase: 05-web-search-grounding-quality-sweep (05-01/05-02)
    provides: Stryker/fixtures infra + V6 migration baseline
provides:
  - "CardioService.updateSession(id, input) — identity-preserving in-place edit"
  - "WeightService.updateEntry(id, input) — identity-preserving in-place edit"
  - "ReadingsService.updateBloodPressure / updateBloodGlucose / updateKetone — type-safe three-method update split"
  - "ReadingsService.replaceReading<T> private find-by-id helper (cast-free union replace)"
affects: [05-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Identity-preserving update: validate-first guard -> getData -> findIndex -> {...existing, <editable fields>, re-pin id+createdAt, refresh updatedAt} -> copy-array-replace -> saveData"
    - "Discriminated-union update via per-type narrow methods + a generic replaceReading<T> helper — no runtime type dispatch, no `as` cast"

key-files:
  created: []
  modified:
    - src/app/services/cardio.service.ts
    - src/app/services/cardio.service.spec.ts
    - src/app/services/weight.service.ts
    - src/app/services/weight.service.spec.ts
    - src/app/services/readings.service.ts
    - src/app/services/readings.service.spec.ts

key-decisions:
  - "Editable fields mapped explicitly (not a blanket `...input` spread) so removing an optional field (notes/distanceKm/caloriesBurned) clears it — consistent with CLAUDE.md no-null + the proven add-method mapping."
  - "ReadingsService uses a generic private replaceReading<T extends HealthReading>(id, build) helper; the per-type build callback re-pins identity and the literal `type` discriminant, keeping the union cast-free (Pitfall 7)."
  - "Missing-id error message: 'Cardio session not found' / 'Weight entry not found' / 'Reading not found'; uninitialized: 'Storage not initialized' — mirrors existing add/delete messaging."

patterns-established:
  - "Pattern 3 (RESEARCH): identity-preserving re-validating in-place update across all four CRUD domain services."
  - "Three-method discriminated-union update split (mirrors the three add methods) over a single widened update + runtime dispatch."

requirements-completed: [QUAL-03]

# Metrics
duration: 6min
completed: 2026-05-31
---

# Phase 5 Plan 03: CRUD Update Methods Summary

**Identity-preserving, re-validating in-place `update*` methods added to CardioService, WeightService, and ReadingsService — closing the QUAL-03 CRUD-parity gap so an edit preserves `id`/`createdAt` instead of delete-and-re-add (Pitfall 7), with the HealthReading discriminated union kept cast-free.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-31T22:06:25Z
- **Completed:** 2026-05-31T22:11:51Z
- **Tasks:** 2 (both TDD RED→GREEN)
- **Files modified:** 6 (3 services + 3 specs)

## Accomplishments
- `CardioService.updateSession` and `WeightService.updateEntry`: validate-first guard re-runs `validateCardio`/`validateWeight`; re-pins `id` + `createdAt`, refreshes `updatedAt`; 404 on missing id; storage untouched on any failure.
- `ReadingsService` three-method split (`updateBloodPressure`/`updateBloodGlucose`/`updateKetone`): each runs its per-type validator, keeps the literal `type` discriminant, and finds-by-id via a shared cast-free `replaceReading<T>` helper.
- Cross-type isolation proven: editing a BP reading leaves a co-stored glucose reading untouched.
- Full Karma suite **630/635 SUCCESS** (the only 5 failures are the pre-existing, plan-05-09-owned diet/chat/charts/reports color-contrast a11y specs — zero new failures). Production build exits 0.

## Task Commits

1. **Task 1 (RED): cardio + weight failing update specs** — `07705cb` (test)
2. **Task 1 (GREEN): updateSession + updateEntry** — `c249495` (feat)
3. **Task 2 (RED): readings three-method failing update specs** — `04ac1fa` (test)
4. **Task 2 (GREEN): readings update split + replaceReading helper** — `9eb622d` (feat)

_TDD gate sequence honored for both tasks: a `test(...)` RED commit precedes each `feat(...)` GREEN commit._

## Files Created/Modified
- `src/app/services/cardio.service.ts` — added `updateSession(id, input)`.
- `src/app/services/cardio.service.spec.ts` — added `updateSession` describe (identity, invalid-no-write, missing-id, uninitialized).
- `src/app/services/weight.service.ts` — added `updateEntry(id, input)`.
- `src/app/services/weight.service.spec.ts` — added `updateEntry` describe (same four behaviors).
- `src/app/services/readings.service.ts` — added `updateBloodPressure`/`updateBloodGlucose`/`updateKetone` + private `replaceReading<T>`.
- `src/app/services/readings.service.spec.ts` — added three update describes incl. per-type validation, missing-id, uninitialized, and BP-edit-leaves-glucose-untouched.

## Decisions Made
- Explicit editable-field mapping over blanket `...input` spread (clears removed optionals; honors CLAUDE.md no-null).
- Generic `replaceReading<T>` keeps the discriminated union type-safe without any `as BloodPressure|BloodGlucose|Ketone|HealthReading` cast (grep gate green).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## TDD Gate Compliance
Both tasks completed the RED→GREEN sequence with git-visible `test(...)` then `feat(...)` commits:
- Task 1: `07705cb` (test) → `c249495` (feat)
- Task 2: `04ac1fa` (test) → `9eb622d` (feat)
No REFACTOR commit was needed.

## Threat-Model Compliance
- **T-05-03-01 (Tampering — invalid input):** validate-first guard re-runs the same validators; invalid input throws before any write — spec-asserted `saveData` not called.
- **T-05-03-02 (Tampering — identity):** `...existing` then explicit re-pin of `id` + `createdAt`; spec asserts both equal the original and `updatedAt` is refreshed.
- **T-05-03-03 (Spoofing — discriminated union):** three narrow-input methods + literal `type`; no `as` cast (grep gate: no matches).
- **T-05-03-04 (DoS — missing id):** `findIndex < 0` errors before write; no array corruption on a bad id.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Service-layer CRUD parity is complete; **Plan 05-06** can now wire these `update*` methods into the per-page edit-mode UI (pre-filled entry form per D-11/D-12).
- No blockers.

## Self-Check: PASSED
- Commits present: 07705cb, c249495, 04ac1fa, 9eb622d (all found in git log).
- SUMMARY.md present.
- Methods present: `updateSession` (cardio), `updateEntry` (weight), `updateBloodPressure`/`updateBloodGlucose`/`updateKetone` + `replaceReading` (readings).

---
*Phase: 05-web-search-grounding-quality-sweep*
*Completed: 2026-05-31*
