---
phase: 01-foundations
plan: 08
subsystem: testing
tags: [characterization, testing, axe-core, a11y, testbed, karma, jasmine]

# Dependency graph
requires:
  - phase: 01-foundations
    provides: |
      Plan 02: src/app/shared/a11y-test-helpers.ts (expectNoSeriousA11yViolations).
      Plan 03: <app-empty-state> + <app-error-state> standalone components.
      Plan 07: feature pages retrofitted with empty/error state surfaces.
provides:
  - 4 characterization spec files (diet/chat/charts/report-page) — ~21 specs total
  - Page-integration b6149d2 regression assertion (charts-page same-day BP averaging)
  - Inline axe-core a11y harness used in every characterization spec (FOUND-05 satisfied)
  - Optional `disableRules` parameter on `expectNoSeriousA11yViolations` for documented Phase 5 deferrals
  - Phase 1 closure: this is the LAST plan in the phase
affects: [phase-2, phase-3, phase-4, phase-5, refactor-safety]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Karma TestBed standalone-component bootstrap for page specs (imports: [Component])"
    - "Per-spec factory helpers (createValidMeal, createValidConversation, etc.) — D-07"
    - "DOM-shape assertions over textContent (Pitfall 6 anti-pattern guard)"
    - "Inline axe-core via expectNoSeriousA11yViolations after representative render"
    - "provideCharts(withDefaultRegisterables()) in TestBed for ng2-charts page specs"
    - "Per-spec TestBed.resetTestingModule in afterEach to keep error-path scenarios clean"

key-files:
  created:
    - src/app/features/diet/diet-page.component.spec.ts
    - src/app/features/chat/chat-page.component.spec.ts
    - src/app/features/charts/charts-page.component.spec.ts
    - src/app/features/reports/report-page.component.spec.ts
  modified:
    - src/app/shared/a11y-test-helpers.ts (added optional disableRules + sentinel expect)

key-decisions:
  - "Defer color-contrast a11y violations to Phase 5 QUAL-08 — current global palette (#7f8c8d, #3498db) is below WCAG AA 4.5:1 across all 8 pages; D-13 says cross-app polish is QUAL-08/QUAL-09 work, not Phase 1's concern. Specs use disableRules: ['color-contrast'] to keep structural a11y enforcement (label association, ARIA roles, landmarks, focus order) while parking palette work."
  - "Sentinel expect inside expectNoSeriousA11yViolations to silence Jasmine 'no expectations' warnings on green a11y runs."
  - "b6149d2 regression assertion lives at component-state level (component.readingsChartData.labels.length / datasets data values), not chart.js internals — keeps the spec stable even if chart.js wrapper changes."
  - "Factory helper dateInPast(daysAgo) used in charts/reports specs because filterByRange uses now as endMs — wall-clock-future timestamps would be silently dropped."

patterns-established:
  - "Pattern: Page characterization spec scaffold — factory helpers + makeSpies({...overrides}) + configureBed(spies) + per-test TestBed rebuild for clean error-path scenarios"
  - "Pattern: Inline axe-core in characterization specs with documented disableRules for Phase 5 deferrals"

requirements-completed:
  - FOUND-04
  - FOUND-05

# Metrics
duration: 9m 20s
completed: 2026-05-02
---

# Phase 1 Plan 08: Characterization specs for diet/chat/charts/reports Summary

**21 Karma TestBed characterization specs across 4 feature pages with inline axe-core a11y assertions and a page-integration b6149d2 regression test**

## Performance

- **Duration:** 9 min 20 sec
- **Started:** 2026-05-02T20:34:05Z
- **Completed:** 2026-05-02T20:43:25Z
- **Tasks:** 3 (Tasks 1-2 file edits; Task 3 verification gate, no commit)
- **Files modified:** 5 (4 new spec files + 1 helper update)

## Accomplishments

- 4 new characterization spec files cover the 4 most complex feature pages (diet/chat/charts/report) with 4-6 `it()` blocks each, totaling 21 new specs.
- Every characterization spec ends with `expectNoSeriousA11yViolations(fixture.nativeElement, ...)` — FOUND-05's in-spec a11y harness satisfied.
- charts-page spec includes the **b6149d2 regression at the page-integration level**: two same-day BP readings (120/80 morning + 130/90 evening) collapse into ONE chart label with averaged systolic 125 + diastolic 85.
- Per-spec factory helpers (`createValidMeal`, `createValidSavedFood`, `createValidConversation`, `createValidMessage`, `createBloodPressure`, `createCardioSession`, `createWeightEntry`, `dateInPast`) — D-07 honored, NO shared canonical fixtures file introduced.
- Standalone-component import pattern (`imports: [PageComponent]`) used everywhere; zero `declarations:` in the new specs.
- Full Karma suite: **269/269 SUCCESS** (was 248/248, +21 new specs).
- Production build: green (only pre-existing 531-byte budget warning).
- Phase 1 is now COMPLETE — this was the final plan; FOUND-04 and FOUND-05 both satisfied.

## Task Commits

Each task was committed atomically:

1. **Task 1: diet-page + chat-page characterization specs** — `90df6c7` (test)
2. **Task 2: charts-page + report-page characterization specs (b6149d2 regression)** — `258aafd` (test)
3. **Task 3: Cross-spec verification gate** — no commit (no file edits per plan)

**Plan metadata:** _(final docs commit appended after this SUMMARY)_

## Files Created/Modified

- `src/app/features/diet/diet-page.component.spec.ts` — 6 specs: saved-foods rendered from store, day's meals rendered, daily totals reflected, empty state when no meals, error state on storage init failure, axe-core a11y.
- `src/app/features/chat/chat-page.component.spec.ts` — 6 specs: conversation list rendered, switches active conversation, message list for active conversation, empty state when no conversations, error state when API key missing, axe-core a11y.
- `src/app/features/charts/charts-page.component.spec.ts` — 5 specs: b6149d2 same-day-average regression, date-range re-render, /report navigation on print/export click, empty state, axe-core a11y. Wires `provideCharts(withDefaultRegisterables())` for ng2-charts.
- `src/app/features/reports/report-page.component.spec.ts` — 4 specs: summaries from store within range, empty state across all sections, error state on `StorageError('PARSE_ERROR')`, axe-core a11y. Mocks `ActivatedRoute.queryParamMap`.
- `src/app/shared/a11y-test-helpers.ts` — added `A11yAssertionOptions { disableRules? }` parameter + sentinel `expect(severe.length).toBe(0)` so Jasmine doesn't emit "no expectations" warnings on green runs. File header documents the Phase 5 deferral rationale for `color-contrast`.

## Decisions Made

- **Defer color-contrast a11y to Phase 5 QUAL-08.** First in-spec axe-core runs uncovered 14 nodes failing `serious` color-contrast across the diet-page alone (e.g., `.muted` `#7f8c8d` on white = 3.29:1, `.btn-primary` white on `#3498db` = 3.15:1). Per CONTEXT.md D-13 the cross-app palette polish is QUAL-08/QUAL-09 work in Phase 5. Plan 08's explicit constraint is "Do NOT modify the feature page components themselves — specs only", so fixing the palette is out of scope here. The chosen path: extend `expectNoSeriousA11yViolations` with a `disableRules` option, pass `['color-contrast']` in the 4 specs with a documented rationale comment, and let Phase 5 (QUAL-08, the manual full-sweep) reset the palette globally and remove the disabled list. This keeps FOUND-04's structural-regression net (label association, ARIA roles, landmarks, focus order) firing on every test run.
- **dateInPast(daysAgo) helper.** charts-page and report-page filter all entries through `filterByRange` which uses `Date.now()` as `endMs` for non-`all` presets. Tests that used `new Date()` had timestamps drift past `endMs` and silently filtered out their seed data, corrupting assertions. Helper guarantees timestamps are at least 2 days in the past at noon local.
- **Per-spec TestBed rebuild + `afterEach(() => TestBed.resetTestingModule())`.** Plan calls for a `beforeEach` config, but the error-path specs need to override `storageService.initialize` to throw — easier to express with per-spec configuration than with `beforeEach` overrides.
- **Sentinel `expect` inside the a11y helper.** Without it, every green axe run logs `WARN: 'Spec '...' has no expectations.'`. The sentinel is harmless on failure paths because `fail()` already short-circuits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `provideCharts(withDefaultRegisterables())` to charts/report TestBed**
- **Found during:** Task 2 (charts-page spec first run)
- **Issue:** First charts-page spec runs failed with `Error: "line" is not a registered controller` from chart.js. The app provides `provideCharts(withDefaultRegisterables())` in `app.config.ts`, but TestBed doesn't auto-include `appConfig`.
- **Fix:** Added `provideCharts(withDefaultRegisterables())` to the TestBed providers in both charts-page and report-page specs.
- **Files modified:** src/app/features/charts/charts-page.component.spec.ts, src/app/features/reports/report-page.component.spec.ts
- **Verification:** Both specs run green; 5/5 charts and 4/4 report specs pass.
- **Committed in:** 258aafd (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added `disableRules` option to `expectNoSeriousA11yViolations`**
- **Found during:** Task 1 (diet-page first axe run)
- **Issue:** First in-spec axe-core run found 14 `serious` color-contrast violations against the existing global palette. Plan's hard constraint forbids modifying feature components. Without an opt-out, the spec would either (a) fail forever because the palette is below WCAG AA, or (b) require silently dropping the a11y assertion entirely (defeats FOUND-05).
- **Fix:** Extended the helper with an `A11yAssertionOptions { disableRules? }` parameter so callers can document specific Phase 5 deferrals. The 4 characterization specs each pass `['color-contrast']` with an inline reference to D-13. File header explains the Phase 5 follow-up.
- **Files modified:** src/app/shared/a11y-test-helpers.ts
- **Verification:** All 4 specs' a11y assertions pass; structural a11y rules (label association, ARIA, landmarks, focus order, color-independence other than contrast) continue to fire and would fail on regression.
- **Committed in:** 90df6c7 (Task 1 commit)

**3. [Rule 1 - Bug] Use `dateInPast(daysAgo)` instead of `new Date()` for seed timestamps**
- **Found during:** Task 2 (b6149d2 regression spec — initial assertion saw value 120, expected 125)
- **Issue:** Test seeded two BP readings on the same day, one at 8am and one at 8pm, then asserted the average. `filterByRange` uses `Date.now()` as `endMs` for the default `30d` preset; if the test runs before 8pm local time, the evening reading is filtered out as "future" and only the morning reading appears — averaging a single number returns that number, breaking the average assertion.
- **Fix:** Added a `dateInPast(daysAgo)` factory to charts-page and report-page specs and used it for all seed timestamps. Guarantees both readings predate `now`.
- **Files modified:** src/app/features/charts/charts-page.component.spec.ts, src/app/features/reports/report-page.component.spec.ts
- **Verification:** b6149d2 spec now reliably asserts averaged systolic = 125 and diastolic = 85.
- **Committed in:** 258aafd (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug)
**Impact on plan:** All three were necessary to reach the plan's acceptance criteria. The color-contrast deferral honors plan boundary ("specs only, do NOT modify feature components") AND CONTEXT.md D-13 (palette is QUAL-08 work). No scope creep.

## Issues Encountered

- **First axe-core run revealed 14 serious color-contrast violations across diet-page alone.** Initially considered fixing the palette globally (Rule 2), but the plan's explicit "specs only" constraint plus D-13's "cross-app polish is Phase 5 QUAL-08 work" pointed to the deferral path with documented opt-out. Resolution: deferral via `disableRules` with file-header rationale and Phase 5 follow-up.
- **chart.js controller registration not auto-included by Angular TestBed.** Resolution: explicit `provideCharts(withDefaultRegisterables())` in test providers, mirroring `app.config.ts`.
- **Wall-clock dependency in seed dates.** Resolution: `dateInPast` factory.

## TDD Gate Compliance

Plan 08's tasks have `tdd="true"` per the plan frontmatter. The TDD intent here is "write the spec first, watch it red against the current page, then verify the spec captures the existing behavior" — i.e., RED-against-existing-code-as-baseline rather than RED-then-implement. All 4 specs were written, run, iterated until they captured the dominant flow, then committed. Gate compliance: each task commit is a `test(...)` commit landing the characterization specs. No subsequent `feat(...)` or `refactor(...)` commits in this plan because no production code changes (specs only — that's the whole point of FOUND-04 in this phase).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 1 is COMPLETE.** This was the final plan (10 of 10) per the phase wave structure. All FOUND-01 through FOUND-07 requirements are satisfied:
  - FOUND-01 (coverage thresholds) ✅ plan 01
  - FOUND-02 (shared utilities) ✅ plans 02, 06
  - FOUND-03 (subscription hygiene) ✅ plan 04
  - FOUND-04 (characterization tests) ✅ **this plan**
  - FOUND-05 (puppeteer + axe-core scaffolds) ✅ plan 05 + **this plan** (axe-in-spec)
  - FOUND-06 (empty/error state pattern) ✅ plans 03, 07
  - FOUND-07 (schema-migration recovery banner) ✅ plans 08-old (recovery banner — committed prior under different numbering), 09, 10
- **Refactor safety net is in place** for Phases 2-5: the 4 most complex pages now have characterization specs that catch behavioral regressions in: data flow from services to template, empty/error state surfaces, page-level grouping math (b6149d2 regression), router navigation, and structural a11y.
- **Phase 5 follow-up:** QUAL-08 will reset the global palette to meet WCAG AA contrast and remove `disableRules: ['color-contrast']` from the 4 characterization specs. The follow-up reference is documented in `src/app/shared/a11y-test-helpers.ts` file header.
- **Ready for goal-backward verification (`gsd-verifier`) on the entire phase.**

## Self-Check: PASSED

- All 4 spec files exist on disk: diet/chat/charts/report-page.component.spec.ts.
- a11y-test-helpers.ts exists with the new disableRules option.
- Both task commits (90df6c7, 258aafd) reachable from HEAD.
- Full Karma suite: 269/269 SUCCESS.
- Production build: green.

---
*Phase: 01-foundations*
*Completed: 2026-05-02*
