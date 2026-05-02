---
phase: 01-foundations
plan: 06
subsystem: refactoring
tags: [shared-utilities, uuid, chart-grouping, retrofit, foundations, angular, typescript]

# Dependency graph
requires:
  - phase: 01-foundations
    provides: src/app/shared/id.ts (generateId), src/app/shared/chart-grouping.ts (groupByDay, toDateKey, round2) — built by plan 01-02
provides:
  - Single shared `generateId()` consumed by all 5 domain services (cardio, weight, readings, diet, chat) — 5 file-private `generateUUID` Math.random copies deleted
  - DietService is now the sole owner of diet-entity ID assignment — diet-page.component.ts no longer mints IDs (CLAUDE.md "Component Pattern" violation eliminated; CONCERNS.md "ID generation leaked into a feature component" closed)
  - Single source of truth for same-day reading averaging — both charts-page and report-page consume `groupByDay`/`toDateKey`/`round2` from `src/app/shared/chart-grouping`; the b6149d2-class drift between the two pages can no longer recur
affects: [01-07-PLAN (empty/error retrofit + takeUntilDestroyed — same files, sequential after 06), Phase 2 DIET-08 (shared chart-grouping is now the place to fix UTC drift), Phase 5 QUAL-01 (no `any` ever introduced; all 8 files still strict-clean)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain services own entity ID assignment; components do not mint IDs (extending the existing CardioService/WeightService/ReadingsService pattern to DietService and eliminating the diet-page leak)"
    - "Synthetic UI tracking IDs replaced with @for index tracking when a list is transient/append-only (pendingItems in diet-page) — avoids generating identifiers for non-persisted state"
    - "Shared utilities under `src/app/shared/` are the single source of truth — feature pages and services import from them rather than copy-paste"

key-files:
  created: []
  modified:
    - src/app/services/cardio.service.ts
    - src/app/services/weight.service.ts
    - src/app/services/readings.service.ts
    - src/app/services/diet.service.ts
    - src/app/services/chat.service.ts
    - src/app/features/diet/diet-page.component.ts
    - src/app/features/charts/charts-page.component.ts
    - src/app/features/reports/report-page.component.ts

key-decisions:
  - "diet-page UI tracking IDs were the only ID generation in any component — they were not entity IDs, so I removed the need entirely (drop `id` from pendingItems shape, switch `track it.id` → `track $index`, switch `removePendingItem(id)` → `removePendingItem(index)`) rather than route them through DietService. This is cleaner than alternatives (importing generateId into the component, or asking DietService to mint UI tokens) and matches the plan's acceptance criterion `! grep -nE 'generateId' src/app/features/diet/diet-page.component.ts`."
  - "Imported all three names (`groupByDay, toDateKey, round2`) from shared/chart-grouping in both chart consumer pages, even though `toDateKey` is not directly called at any consumer call site (only used internally by groupByDay). This matches the plan's exact-text grep gate and the project has no `noUnusedLocals` enforcement, so the dead import is harmless."
  - "Did not modify date-range.ts — the timezone/UTC concern (CONCERNS.md 'Date math uses UTC offsets') is DIET-08 / Phase 2 scope. The shared/chart-grouping helpers already use local timezone (per the JSDoc lifted from b6149d2) so chart-page+report-page averaging is now consistent within itself."

patterns-established:
  - "ID generation lives in domain services only — never in components, never in UI-state buffers"
  - "When a transient UI list does not need stable identity across renders, prefer `@for(...; track $index)` over generating synthetic IDs"
  - "Lifting a duplicated function into `src/app/shared/` is paired with deleting ALL copies AND replacing every consumer call site in the SAME plan (no half-migrations)"

requirements-completed: [FOUND-02]

# Metrics
duration: 6m 37s
completed: 2026-05-02
---

# Phase 1 Plan 06: id.ts + chart-grouping consumer retrofit Summary

**6 duplicated generateUUID copies and 6 duplicated chart-grouping functions deleted; 8 consumer files now route through `src/app/shared/id.ts` and `src/app/shared/chart-grouping.ts` for entity IDs and same-day averaging math**

## Performance

- **Duration:** 6m 37s
- **Started:** 2026-05-02T19:40:23Z
- **Completed:** 2026-05-02T19:47:00Z
- **Tasks:** 3/3
- **Files modified:** 8

## Accomplishments

- 5 service-level `generateUUID` helpers deleted (cardio, weight, readings, diet, chat); 19 call sites renamed to `generateId()`; all 5 services import from `'../shared/id'`. Crypto-strong IDs everywhere via `crypto.randomUUID()` with documented Math.random fallback.
- 1 component-level `generateUUID` helper deleted from `diet-page.component.ts`; the entire need for component-side IDs eliminated by switching `pendingItems` to index-tracked (`track $index` + `removePendingItem(index)`). DietService is now the sole owner of diet-entity ID assignment, closing CONCERNS.md "ID generation leaked into a feature component" and CLAUDE.md "Component Pattern" violation.
- 6 duplicated chart-grouping functions deleted (3 in `charts-page.component.ts:594-646`, 3 in `report-page.component.ts:607-650`). Both pages now import `groupByDay`, `toDateKey`, `round2` from `src/app/shared/chart-grouping`. The b6149d2-style drift between the two pages can no longer recur — they share a single source of truth.
- Full test suite green: **219/219 SUCCESS** under `ng test --no-watch --browsers=ChromeHeadless`. Production build clean: `ng build --configuration=production` exit 0. Zero `Math.random()` UUID generation anywhere in `src/app/services/` or `src/app/features/diet/diet-page.component.ts`.

## Task Commits

Each task was committed atomically on `gsd/phase-1-foundations`:

1. **Task 1: Replace generateUUID in 5 services with generateId import** — `a8b752a` (refactor)
   Files: cardio/weight/readings/diet/chat .service.ts. Net: 5 imports added, 5 function blocks deleted (~35 lines), 19 call-site renames. Specs: 99/99 SUCCESS targeted run; prod build OK.

2. **Task 2: Remove diet-page generateUUID; drop UI-tracking IDs** — `6801180` (refactor)
   Files: diet-page.component.ts. Net: function block deleted (lines 9-15), `pendingItems` shape narrowed (drop `id` field), template `track it.id`→`track $index`, `removePendingItem` parameter `id: string`→`index: number`. Diet service spec: 7/7 SUCCESS; prod build OK.

3. **Task 3: Wire charts-page + report-page to shared chart-grouping** — `cc64149` (refactor)
   Files: charts-page.component.ts, report-page.component.ts. Net: 2 imports added, 6 functions deleted (~96 lines combined). Full suite: 219/219 SUCCESS; prod build OK.

**Plan metadata commit:** to be added with this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md update.

## Files Created/Modified

**Modified (8):**
- `src/app/services/cardio.service.ts` — import generateId, delete local generateUUID, rename 1 call site
- `src/app/services/weight.service.ts` — same pattern, 1 call site
- `src/app/services/readings.service.ts` — same pattern, 3 call sites (BP/glucose/ketone)
- `src/app/services/diet.service.ts` — same pattern, 11 call sites (food/serving/meal-item/default-servings)
- `src/app/services/chat.service.ts` — same pattern, 3 call sites (conversation create + user message + assistant message)
- `src/app/features/diet/diet-page.component.ts` — delete generateUUID, drop pendingItems.id, switch template tracking to $index, simplify removePendingItem to (index: number)
- `src/app/features/charts/charts-page.component.ts` — import groupByDay/toDateKey/round2, delete trio at end of file (lines 594-646)
- `src/app/features/reports/report-page.component.ts` — import groupByDay/toDateKey/round2, delete trio at end of file (lines 607-650)

**No new files created.** This plan is pure consumer-side wiring on top of plan 02's shared modules.

## Decisions Made

1. **diet-page UI tracking IDs removed entirely (not lifted).** The `generateUUID()` calls at lines 774 and 846 of `diet-page.component.ts` were generating IDs for the transient `pendingItems` array — UI-only tokens for `@for(...; track it.id)` and `removePendingItem(id)`, never persisted (line 815-819 explicitly stripped them before passing to `DietService.addMeal`). Three options: (a) import `generateId` into the component (violates the plan's `! grep -nE 'generateId' src/app/features/diet/diet-page.component.ts` gate); (b) ask `DietService` to mint UI tokens (mixes UI and persistence concerns); (c) eliminate the IDs entirely by using `track $index` and `removePendingItem(index)`. Picked (c) — cleaner architecture, matches the plan's acceptance contract, and is safe because `pendingItems` is append-only between meal saves (no reorder, no diff stability requirement).

2. **All three chart-grouping names imported even though `toDateKey` is not used at any consumer call site.** The plan's acceptance grep is exact-text: `grep -q "import { groupByDay, toDateKey, round2 } from '../../shared/chart-grouping'"`. Importing all three matches the contract; `toDateKey` is dead-imported but the project has no `noUnusedLocals` enforcement (verified via `grep` of all tsconfig files), so the dead import is harmless. Future consumers may need `toDateKey` directly (e.g., DIET-08 day-boundary work) so keeping it imported costs nothing.

3. **`date-range.ts` not touched.** CONCERNS.md "Date math uses UTC offsets" applies to `date-range.ts` and is explicitly DIET-08 / Phase 2 scope. The shared/chart-grouping module already uses local timezone (JSDoc lifted from charts-page b6149d2 fix), so the consumer retrofit here doesn't introduce drift — both pages now share that local-tz code path.

## Deviations from Plan

None — plan executed exactly as written.

The only architectural-shape decision (diet-page UI tracking IDs → `track $index`) is well within the plan's stated intent: "diet-page no longer generates IDs; DietService assigns IDs at the service layer; CLAUDE.md 'Component Pattern' violation eliminated." Removing the need for IDs entirely satisfies this more cleanly than routing transient UI tokens through DietService.

## Issues Encountered

None. All grep gates, targeted spec runs, full-suite spec run, and production build came up green on first try after each task.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Wave 2 progress: 2/3 plans complete (05 + 06; 09 remains).**

**Unblocks:**
- Plan 01-07 (Wave 3) — empty/error retrofit + `takeUntilDestroyed` across 8 feature pages — will touch the same files (`diet-page.component.ts`, `charts-page.component.ts`, `report-page.component.ts`). Sequential ordering (06 → 07) avoids same-file conflicts. Plan 07 inherits clean diffs: ID generation already lifted out of diet-page, chart-grouping already shared.
- Plan 01-08 (Wave 4) — characterization specs for diet-page/charts-page/reports-page can now mock or test against the shared utilities directly (e.g., assertions about `groupByDay` results) instead of duplicated private functions.
- Phase 2 DIET-08 — fixing UTC drift in date math now has a single place to land the fix (`src/app/shared/chart-grouping.ts` already uses local tz; if `date-range.ts` is the bug surface, that fix is well-isolated).

**No blockers introduced.**

## Self-Check: PASSED

Verification of claims in this summary:

**Created files:** None (n/a — no files created in this plan).

**Modified files exist on disk** (`ls` checked all 8):
- src/app/services/cardio.service.ts — FOUND
- src/app/services/weight.service.ts — FOUND
- src/app/services/readings.service.ts — FOUND
- src/app/services/diet.service.ts — FOUND
- src/app/services/chat.service.ts — FOUND
- src/app/features/diet/diet-page.component.ts — FOUND
- src/app/features/charts/charts-page.component.ts — FOUND
- src/app/features/reports/report-page.component.ts — FOUND

**Commits exist** (`git log --all` checked):
- a8b752a — FOUND (Task 1)
- 6801180 — FOUND (Task 2)
- cc64149 — FOUND (Task 3)

**Grep gates green:**
- `! grep -nE 'Math\.random\(\)' src/app/services/*.ts src/app/features/diet/diet-page.component.ts` — CLEAN
- `! grep -nE 'function (groupByDay|toDateKey|round2)' src/app/features/{charts,reports}/*.ts` — CLEAN
- `grep -q "import { generateId } from '../shared/id'" src/app/services/{cardio,weight,readings,diet,chat}.service.ts` — all 5 OK
- `grep -q "import { groupByDay, toDateKey, round2 } from '../../shared/chart-grouping'"` in both consumer pages — both OK

**Build/test gates green:**
- `ng test --no-watch --browsers=ChromeHeadless` — 219/219 SUCCESS, exit 0
- `ng build --configuration=production` — exit 0

---
*Phase: 01-foundations*
*Completed: 2026-05-02*
