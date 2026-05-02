---
phase: 01-foundations
plan: 03
subsystem: shared-components
tags: [shared, components, empty-state, error-state, a11y, standalone, angular18, storage-error]

# Dependency graph
requires:
  - phase: 00-research
    provides: Pattern 4 (RESEARCH §397-485 — verbatim empty-state and error-state component code with friendlyMessage switch)
  - phase: 01-foundations
    plan: 01
    provides: karma.conf.js src/app/shared/** at 90/80/90/90 threshold (these new components live in that pattern)
provides:
  - "src/app/shared/empty-state.component.ts — <app-empty-state> standalone with required [title], optional [message], <ng-content> action slot, role=status + aria-live=polite"
  - "src/app/shared/error-state.component.ts — <app-error-state> standalone with required [title], optional [message]/[error], (retry) emit, friendlyMessage() switch on all 5 StorageErrorCode values, collapsed <details> for raw text, role=alert + aria-live=assertive"
  - "empty-state.component.spec.ts (5 it blocks) — required title, optional message present/absent, ng-content projection via host wrapper, role+aria a11y assertion"
  - "error-state.component.spec.ts (7 it blocks → 11 specs at runtime) — 5 StorageErrorCode mappings (parameterized), non-StorageError fallback, [message] override, <details>.open===false, role=alert+aria-live=assertive, retry-not-rendered when unobserved, retry-emit via host wrapper"
affects:
  - "01-07 (Wave 2 page retrofit) — 8 feature pages and recovery banner import EmptyStateComponent and ErrorStateComponent"
  - "01-10 (Wave 3 recovery banner) — consumes ErrorStateComponent for migration-failure UX (D-15)"
  - "01-08 (characterization specs) — page specs assert these components render in empty/error scenarios"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone-component scaffold mirrors src/app/shared/nav.component.ts (no NgModule, imports: [CommonModule], inline template + styles)"
    - "Angular 18 control-flow @if (no *ngIf) — idiomatic for new components in this codebase"
    - "@Input({ required: true }) for non-optional inputs — strictTemplates compile-error catches consumers that forget [title]"
    - "Required-input testing via fixture.componentRef.setInput('title', ...) — Angular 18 API; bare TestBed.createComponent + property-set does not satisfy strictTemplates"
    - "ng-content projection tested via wrapper @Component declared inline in the spec (only way to assert projection)"
    - "Conditional EventEmitter rendering via @Output().observed — Retry button only renders when a parent has subscribed, so pages that don't wire retry don't get a dead button"
    - "friendlyMessage() switch on a string-literal-union code — TypeScript exhaustiveness catches missing cases at compile time; runtime falls through to generic copy if a future code is added without updating this switch (T-03-02 fail-soft)"
    - "Severity-tiered ARIA: empty=role=status+aria-live=polite (non-interruptive); error=role=alert+aria-live=assertive (immediate announce). Both asserted in specs (T-03-03)"

key-files:
  created:
    - "src/app/shared/empty-state.component.ts — <app-empty-state> (62 lines)"
    - "src/app/shared/empty-state.component.spec.ts — 5 it blocks (63 lines)"
    - "src/app/shared/error-state.component.ts — <app-error-state> with friendlyMessage + rawErrorText (134 lines)"
    - "src/app/shared/error-state.component.spec.ts — 7 it blocks / 11 runtime specs (99 lines)"
  modified: []

key-decisions:
  - "Followed plan exactly; D-09 (two standalone components, not a mode-switched single component or structural directive) and D-10 (action via <ng-content>, not [config] input) were both pre-decided"
  - "Per CLAUDE.md guidance for surrounding convention: chose Angular 18 @if control flow over *ngIf — nav.component.ts uses neither, but @if is idiomatic for new Angular 18 components and aligns with how plans 04+ template their consumers"
  - "TDD per task: separate test() commit (RED) then feat() commit (GREEN). Plan frontmatter declared tdd=\"true\" on each task, so commits split rather than the merged-spec convention used in plan 01-02"
  - "Did NOT modify any feature page — Wave 2 plan 07 retrofits all 8 pages + the recovery banner. Plan 03's job is the components only"
  - "Did NOT mark FOUND-06 complete in REQUIREMENTS.md — FOUND-06 is 'Shared empty-state + error-state component pattern AVAILABLE FOR REUSE across feature pages'. The pattern exists but no consumer imports it yet. FOUND-06 flips to [x] when plan 07's page retrofit lands"
  - "non-StorageError + unknown-StorageErrorCode fallback to 'Something went wrong.' is deliberate (T-03-02): TypeScript exhaustiveness catches missing cases at compile time; runtime fallback prevents UI crash if a future schema change adds a code"

patterns-established:
  - "Pattern 4 — empty-state + error-state component pair (RESEARCH §397-485 applied verbatim with minor JSDoc additions)"
  - "Required @Input testing pattern via componentRef.setInput — for use in plan 07 page tests and plan 10 recovery-banner tests"
  - "ng-content projection test pattern via inline host @Component — same pattern reusable for any future shared component with content slots"
  - "EventEmitter.observed conditional render — `@if (retry.observed) { <button>... }` so unsubscribed parents don't get a dead button"

requirements-touched: [FOUND-06]
requirements-completed: []  # explicitly NOT marking — see key-decisions; FOUND-06 flips to [x] after plan 07's retrofit

# Metrics
duration: ~5m
completed: 2026-05-02
---

# Phase 1 Plan 03: Empty/Error Standalone Components Summary

**Two standalone Angular 18 components in src/app/shared/ — <app-empty-state> and <app-error-state> with StorageErrorCode → friendly-copy mapping and severity-tiered ARIA — ready for Wave 2 page retrofit.**

## Performance

- **Duration:** ~5 minutes
- **Started:** 2026-05-02T19:18:08Z
- **Completed:** 2026-05-02T19:23:00Z
- **Tasks:** 2 (each TDD: test commit + impl commit)
- **Files created:** 4

## Accomplishments

- `<app-empty-state>` shipped with required `[title]`, optional `[message]`, `<ng-content>` action slot, and `role=status` + `aria-live=polite` for non-interruptive a11y (D-09, D-10)
- `<app-error-state>` shipped with required `[title]`, optional `[message]`/`[error]`, `(retry)` emit, `friendlyMessage()` covering all 5 `StorageErrorCode` values, collapsed `<details>` for raw stack inspection (D-11), and `role=alert` + `aria-live=assertive` for severe a11y announcement
- Conditional Retry button via `retry.observed` — pages that don't wire retry get no dead button
- 16 specs (5 empty + 11 error) all pass under ChromeHeadless; production build succeeds; per-pattern coverage floor for `src/app/shared/**` (90/80/90/90) is met
- Both components are pure standalone (no NgModule); CLAUDE.md "What NOT To Do" `declarations:` rule honored

## Task Commits

Each TDD task split into RED (failing spec) and GREEN (passing impl):

1. **Task 1 RED: Failing spec for EmptyStateComponent** — `c9c12b2` (test)
2. **Task 1 GREEN: EmptyStateComponent impl** — `2227b9f` (feat)
3. **Task 2 RED: Failing spec for ErrorStateComponent** — `99f3d8b` (test)
4. **Task 2 GREEN: ErrorStateComponent impl** — `b28b39f` (feat)

**Plan metadata commit:** pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates committed below)

## Files Created/Modified

### Created (all 4 are new, in `src/app/shared/`)
- `empty-state.component.ts` — `<app-empty-state>` standalone component, 62 lines
- `empty-state.component.spec.ts` — 5 `it(...)` blocks, 63 lines
- `error-state.component.ts` — `<app-error-state>` standalone component with `friendlyMessage()` switch on all 5 `StorageErrorCode` values + `rawErrorText()` helper, 134 lines
- `error-state.component.spec.ts` — 7 `it(...)` blocks (one parameterized over all 5 codes → 11 specs at runtime), 99 lines

### Modified
None — plan 03 creates only. Wave 2 plan 07 modifies the 8 feature pages.

## Verification

- `ng test --no-watch --browsers=ChromeHeadless --include='src/app/shared/empty-state.component.spec.ts'` → 5/5 pass
- `ng test --no-watch --browsers=ChromeHeadless --include='src/app/shared/error-state.component.spec.ts'` → 11/11 pass
- Combined run → 16/16 pass
- `ng build --configuration=production` → exits 0 (Initial total 499.87 kB, no new lazy chunks since nothing imports the components yet)
- All grep-based acceptance criteria pass:
  - `selector: 'app-empty-state'` and `'app-error-state'` (1 each)
  - `standalone: true` (1 each)
  - `@Input({ required: true })` (1 each, on `title`)
  - `@Output() retry` (1 in error-state)
  - All 5 `StorageErrorCode` `case` labels present (5 matches)
  - `<details` element rendered (1 match)
  - `role="status"` + `aria-live="polite"` on empty-state wrapper (1 each in source + 1 each in spec)
  - `role="alert"` + `aria-live="assertive"` on error-state wrapper (1 each in source + 1 each in spec)
  - `retry.observed` guards button render (1 in template + 1 in css/spec — runtime confirmed by spec "should NOT render a Retry button when (retry) is not observed")
  - No `declarations:` field in either component (CLAUDE.md "no NgModules" honored)

## Decisions Made

- **Single feat() per impl + single test() per spec (TDD-discipline split commits).** Each task declared `tdd="true"` so I committed RED → GREEN as two commits per task. This contrasts with plan 01-02's merged-spec convention; reflects the per-task `tdd="true"` flag.
- **`@if` over `*ngIf`.** CLAUDE.md said match surrounding convention. `nav.component.ts` is purely structural (no conditionals), so neither convention was anchored. `@if` is idiomatic for new Angular 18 components and matches what plan 07 will template into the feature pages.
- **`retry.observed` for conditional Retry rendering.** Avoids a dead button when a parent doesn't subscribe; a spec asserts it stays hidden in that case (using the host-wrapper pattern to avoid "should not render this DOM" being silently true).
- **`<details>` is closed by default.** Spec asserts `details.open === false` as the T-03-01 mitigation — power users can inspect, but the default surface stays clean.
- **Fallback `'Something went wrong.'` for unknown codes.** TypeScript exhaustiveness catches missing cases at compile time; runtime fallback covers the case where a future migration adds a `StorageErrorCode` value without updating this switch (T-03-02 fail-soft).

## Deviations from Plan

None — plan executed exactly as written. Both component code blocks and both spec scaffolds applied verbatim from the plan's `<action>` sections (which themselves quote RESEARCH §lines 397-485 verbatim). Verified accept-criteria fixtures pass without source modification.

**Total deviations:** 0
**Impact on plan:** None — plan 03 is a clean shared-component build with no shared-state mutation, no feature-page coupling, and no runtime dependencies beyond `StorageError` (already present).

## Issues Encountered

None.

The acceptance criterion "at least 9 `it(...)` blocks" in the error-state spec is satisfied by behavior coverage (11 runtime specs across 7 source-level `it(...)` calls — one is a parameterized for-loop over the 5 `StorageErrorCode` values per the plan's own spec scaffold). The verbatim spec from the plan was used unchanged, so this is the plan's intended shape.

## User Setup Required

None.

## Next Phase Readiness

- **Plan 04** (typed legacy schemas + migration fixtures) is independent of plan 03 — Wave 1 parallelization holds.
- **Plan 07** (Wave 2 page retrofit) now has both components available to import. The retrofit is what flips `FOUND-06` from `[ ]` to `[x]` in REQUIREMENTS.md.
- **Plan 10** (Wave 3 recovery banner) has `ErrorStateComponent` available to consume per D-15 (banner uses `<app-error-state>` once it lands).
- No blockers. Both components compile under strict TypeScript with strictTemplates; production build succeeds; no `as any`, no NgModule declaration.

## Self-Check: PASSED

All claims verified:
- Files exist:
  - `src/app/shared/empty-state.component.ts` — FOUND
  - `src/app/shared/empty-state.component.spec.ts` — FOUND
  - `src/app/shared/error-state.component.ts` — FOUND
  - `src/app/shared/error-state.component.spec.ts` — FOUND
- Commits exist:
  - `c9c12b2` — FOUND (test: empty-state RED)
  - `2227b9f` — FOUND (feat: empty-state GREEN)
  - `99f3d8b` — FOUND (test: error-state RED)
  - `b28b39f` — FOUND (feat: error-state GREEN)

---

*Phase: 01-foundations*
*Plan: 03*
*Completed: 2026-05-02*
