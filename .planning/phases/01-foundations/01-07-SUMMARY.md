---
phase: 01-foundations
plan: 07
subsystem: ui
tags: [retrofit, takeUntilDestroyed, DestroyRef, empty-state, error-state, subscription-hygiene, angular18, standalone-components]

# Dependency graph
requires:
  - phase: 01-foundations
    provides: |
      Plan 03: <app-empty-state> + <app-error-state> standalone components in src/app/shared/
      Plan 06: id.ts + chart-grouping consumer retrofit on diet/charts/reports pages (file-conflict sequencing)
provides:
  - "Subscription hygiene: every feature page subscribes via takeUntilDestroyed(this.destroyRef) — zero subscription leaks across all 8 pages"
  - "Empty/error retrofit: all 8 page components render <app-empty-state> and/or <app-error-state> in their data surfaces"
  - "User-visible error feedback: storage failures now surface in the UI via <app-error-state>, replacing silent console.error (CONCERNS.md \"Console-only error reporting\" closed)"
  - "Pattern 2 Form A established codebase-wide: `private destroyRef = inject(DestroyRef)` field initializer + `.pipe(takeUntilDestroyed(this.destroyRef))` per subscribe site"
affects: [02-diet, 03-ai-chat, 04-ui, 05-quality]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 2 Form A (RESEARCH §line 286-338): private destroyRef = inject(DestroyRef) as field initializer + takeUntilDestroyed(this.destroyRef) per subscribe — safe-everywhere variant; avoids NG0203 (Pitfall 1)"
    - "Three-state list rendering: error-state takes precedence over empty-state; both mutually exclusive with the populated list (control-flow @if/@else if/@else)"
    - "loadError field convention: `loadError: Error | null = null` set in subscribe error callback, consumed by <app-error-state [error]> + (retry)=reloadData()"

key-files:
  created: []
  modified:
    - src/app/features/cardio/cardio-page.component.ts
    - src/app/features/weight/weight-page.component.ts
    - src/app/features/readings/readings-page.component.ts
    - src/app/features/diet/diet-page.component.ts
    - src/app/features/charts/charts-page.component.ts
    - src/app/features/reports/report-page.component.ts
    - src/app/features/chat/chat-page.component.ts
    - src/app/features/settings/settings-page.component.ts

key-decisions:
  - "Settings page uses <app-error-state> only — no <app-empty-state>. Settings is a configuration form, not a data list (RESEARCH §Open Q 2)."
  - "Chat page nested subscribes (lines for messageSend / refresh-active-conversation) preserved; takeUntilDestroyed added to ALL 9 inner + outer subscribes. No switchMap refactor — out of Phase 1 scope per CONTEXT.md."
  - "rangeError on charts-page kept as the validation/load message and now flows through <app-error-state> via [message]. Splitting validation vs load into separate fields was deferred to keep the plan diff minimal."
  - "report-page loadData() promoted from private to public so the <app-error-state> (retry) callback can call it directly."
  - "loadError typed as Error | null (not string | null) on simple pages so <app-error-state [error]> can render the technical-details <details> block. settings/charts/reports use the [message] override on top of an Error/string for already-stringified messages."

patterns-established:
  - "Field-initializer DestroyRef injection — safe in any component lifecycle context. Never call inject(DestroyRef) inside ngOnInit/constructor body."
  - "Per-subscribe takeUntilDestroyed(this.destroyRef) call — explicit arg required (Pitfall 1 NG0203 avoidance). Never use bare takeUntilDestroyed()."
  - "Empty/error/list mutually-exclusive control-flow: @if (loadError) ... @else if (entries.length === 0) ... @else <list> ..."

requirements-completed: [FOUND-03, FOUND-06]

# Metrics
duration: 9m 17s
completed: 2026-05-02
---

# Phase 1 Plan 07: Empty/Error Retrofit + Subscription Hygiene Summary

**takeUntilDestroyed(destroyRef) and <app-empty-state>/<app-error-state> retrofitted across all 8 feature page components, replacing silent console.error storage failures with user-visible error surfaces and closing CONCERNS.md "No subscription cleanup in feature components"**

## Performance

- **Duration:** 9m 17s
- **Started:** 2026-05-02T20:06:28Z
- **Completed:** 2026-05-02T20:15:45Z
- **Tasks:** 3 / 3
- **Files modified:** 8 (no new files)

## Accomplishments

- Subscription hygiene retrofitted on all 8 feature pages: 40 total `.subscribe(...)` call sites now pipe through `takeUntilDestroyed(this.destroyRef)` (4+4+6+8+2+3+9+4)
- Pattern 2 Form A (`private destroyRef = inject(DestroyRef)` field initializer) established on every page — NG0203 anti-pattern (bare `takeUntilDestroyed()` in method body) eliminated
- Empty/error state retrofit on all 8 pages: 7 list/data pages have BOTH `<app-empty-state>` AND `<app-error-state>`; settings has `<app-error-state>` only (RESEARCH §Open Q 2)
- Storage failures now visible to users (CONCERNS.md "Console-only error reporting for storage failures" CLOSED) — every storage subscribe error now sets `loadError` consumed by `<app-error-state>` with a `(retry)=reloadData()` button
- 236/236 Karma specs SUCCESS after every task; production build green; zero Pitfall 1 anti-pattern occurrences

## Task Commits

Each task was committed atomically:

1. **Task 1: Retrofit cardio + weight + readings + diet pages** — `84c76c7` (refactor)
2. **Task 2: Retrofit charts + reports + chat + settings pages** — `f1bda40` (refactor)
3. **Task 3: Cross-page invariant grep gates + global build smoke** — _no commit_ (verification-only task; results documented below)

## Files Created/Modified

All 8 files modified — no new files:

- `src/app/features/cardio/cardio-page.component.ts` — DestroyRef field; takeUntilDestroyed on 4 subscribes; <app-empty-state> + <app-error-state> in history section; reloadData() retry; loadError field
- `src/app/features/weight/weight-page.component.ts` — Same shape, 4 subscribe sites
- `src/app/features/readings/readings-page.component.ts` — Same shape, 6 subscribe sites (3 base + 3 type-specific in onSubmit)
- `src/app/features/diet/diet-page.component.ts` — Same shape, 8 subscribe sites; <app-error-state> at top-of-page; <app-empty-state> on saved-foods empty + meals-day empty
- `src/app/features/charts/charts-page.component.ts` — Same shape, 2 subscribe sites; existing rangeError banner now flows through <app-error-state>; per-chart empty divs converted to <app-empty-state>
- `src/app/features/reports/report-page.component.ts` — Same shape, 3 subscribe sites (queryParamMap + storage init + forkJoin); per-chart empty divs converted to <app-empty-state>; loadError flows through <app-error-state> at top-of-page; loadData() promoted to public for retry
- `src/app/features/chat/chat-page.component.ts` — Same shape, 9 subscribe sites including 3 nested at sendMessage handlers; no-key prompt converted to <app-error-state>; new <app-empty-state> when conversations.length === 0
- `src/app/features/settings/settings-page.component.ts` — DestroyRef + takeUntilDestroyed on 4 subscribe sites; <app-error-state> only (no empty surface — settings is config, not data); reloadData() retry method extracted

## Decisions Made

1. **Pattern 2 Form A everywhere** — `private destroyRef = inject(DestroyRef)` as a field initializer, then `.pipe(takeUntilDestroyed(this.destroyRef))` per subscribe. Field initializers are an injection context, so this is the safe-everywhere variant. Bare `takeUntilDestroyed()` (no arg) inside method bodies — Pitfall 1's NG0203 trigger — is absent from all 8 files (Gate 3 PASS).

2. **Settings is error-state-only** — RESEARCH §Open Q 2 confirmed settings is a configuration surface, not a data list. There is no "no settings yet" state because the form is always populated (with defaults if storage is empty). Acceptance criterion verified: `grep -q "app-error-state" settings && ! grep -q "app-empty-state" settings` PASS.

3. **Chat nested subscribes preserved** — chat-page has 3 nested subscribes (in `onSendMessage`'s next/error handlers, refreshing the active conversation). Plan and CONTEXT.md explicitly forbid refactoring these to switchMap in Phase 1. Each nested subscribe got its own `.pipe(takeUntilDestroyed(this.destroyRef))` per the plan §Pitfall 1 guard. Final count: 9 subscribe sites, 9 takeUntilDestroyed calls, 1 inject(DestroyRef) field.

4. **rangeError reused on charts-page (not split)** — Existing `rangeError: string | null` already captured both date-range validation errors and storage load errors. Splitting into separate fields was deferred (out of plan scope). The same string flows through `<app-error-state [message]="rangeError">`. The error-state surface lives inside the controls form (where it logically belongs since it can also be a date-range validation error).

5. **report-page `loadData()` promoted to public** — Required so `<app-error-state (retry)="loadData()">` can call it. No other change to its signature or callers.

6. **loadError typed Error | null** on cardio/weight/readings/diet pages — supports the `<details>Technical details</details>` block of `<app-error-state>`. settings/charts/reports use the `[message]` override on top of a string for already-stringified user-friendly messages (existing rangeError / loadError as string).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] chat-page subscribe count was 9, not 7 as plan documented**

- **Found during:** Task 2 (chat-page retrofit)
- **Issue:** Plan §interfaces §line 1213-1222 listed chat as "7 (including nested subscribes at lines 187, 246, 261)". Actual file had 9 `.subscribe(` call sites — `loadConversations` (1), `onSelectConversation` (1), `onNewChat` (1), `onDeleteConversation` (1), `onSendMessage outer` (1), 3 nested in onSendMessage handlers (2 + 1) = 9. Two extra outer subscribes (the nested ones counted differently than plan estimated).
- **Fix:** Added `.pipe(takeUntilDestroyed(this.destroyRef))` to ALL 9 subscribe call sites. Acceptance criterion was "at least one subscribe per page", which is satisfied; the explicit count was an estimate. No functional change.
- **Files modified:** `src/app/features/chat/chat-page.component.ts`
- **Verification:** Gate 1 PASS. `grep -c '\.subscribe(' chat-page.component.ts` = 9 = `grep -c 'takeUntilDestroyed(this.destroyRef)' chat-page.component.ts`.
- **Committed in:** `f1bda40` (Task 2 commit).

---

**Total deviations:** 1 auto-fixed (1 missing critical — undercount in plan estimate corrected with extra coverage)
**Impact on plan:** No scope creep. The deviation is purely a more thorough application of the same retrofit pattern; subscribe count was conservative in plan, actual code received complete coverage.

## Issues Encountered

None. Plan executed cleanly through all 3 tasks. Test suite stayed green (236/236 SUCCESS) at every commit checkpoint. Production build exit 0 after every task.

## Cross-Page Invariant Gate Results (Task 3)

All 5 gates from the plan §Task 3 §automated PASS:

| Gate | Description | Result |
|------|-------------|--------|
| 1 | Every component with `.subscribe(` has `inject(DestroyRef)` AND `takeUntilDestroyed(this.destroyRef)` | PASS — 8/8 components |
| 2 | All 8 page components reference `app-empty-state` or `app-error-state` (or both) | PASS — 8/8 pages |
| 3 | No bare `takeUntilDestroyed()` in method bodies (NG0203 anti-pattern, Pitfall 1) | PASS — zero hits |
| 4 | No `OnDestroy` interface introduced under `src/app/features/` | PASS — zero hits |
| 5 | `ng build --configuration=production` exits 0 | PASS |

**Subscribe-site coverage map** (from `grep -c '\.subscribe('` per file):

| Page | .subscribe sites | takeUntilDestroyed(this.destroyRef) calls |
|------|------------------|-------------------------------------------|
| cardio | 4 | 4 |
| weight | 4 | 4 |
| readings | 6 | 6 |
| diet | 8 | 8 |
| charts | 2 | 2 |
| reports | 3 | 3 |
| chat | 9 | 9 |
| settings | 4 | 4 |
| **Total** | **40** | **40** |

**Empty/error-state coverage map** (per page):

| Page | <app-empty-state> | <app-error-state> | EmptyStateComponent imported | ErrorStateComponent imported |
|------|-------------------|-------------------|------------------------------|------------------------------|
| cardio | yes | yes | yes | yes |
| weight | yes | yes | yes | yes |
| readings | yes | yes | yes | yes |
| diet | yes | yes | yes | yes |
| charts | yes | yes | yes | yes |
| reports | yes | yes | yes | yes |
| chat | yes | yes | yes | yes |
| settings | **no** (intentional — RESEARCH §Open Q 2) | yes | no | yes |

## Threat-Model Compliance

| Threat ID | Disposition | Verification |
|-----------|-------------|--------------|
| T-07-01 (subscription leak — info disclosure) | mitigate | All 40 `.subscribe(` paired with `takeUntilDestroyed(this.destroyRef)` (Gate 1 PASS) |
| T-07-02 (silent storage failure — repudiation) | mitigate | All 8 pages render `<app-error-state>` for storage failures; loadError field set in subscribe error handlers; CONCERNS.md "Console-only error reporting" closed (Gate 2 PASS) |
| T-07-03 (NG0203 from bare takeUntilDestroyed() in method body) | mitigate | All 40 sites use `takeUntilDestroyed(this.destroyRef)` explicitly; Gate 3 zero hits |

## Stub Tracking

No stubs introduced. The retrofit only restructures existing subscribe call sites and adds explicit user-visible empty/error surfaces — no placeholder data, no hardcoded empty arrays for UI, no "coming soon" copy.

## Self-Check: PASSED

All claimed artefacts verified to exist on disk:

- `src/app/features/cardio/cardio-page.component.ts` — FOUND, modified
- `src/app/features/weight/weight-page.component.ts` — FOUND, modified
- `src/app/features/readings/readings-page.component.ts` — FOUND, modified
- `src/app/features/diet/diet-page.component.ts` — FOUND, modified
- `src/app/features/charts/charts-page.component.ts` — FOUND, modified
- `src/app/features/reports/report-page.component.ts` — FOUND, modified
- `src/app/features/chat/chat-page.component.ts` — FOUND, modified
- `src/app/features/settings/settings-page.component.ts` — FOUND, modified

Commits verified in `git log --oneline`:
- `84c76c7` — FOUND (Task 1)
- `f1bda40` — FOUND (Task 2)

## User Setup Required

None — no external service configuration required. Existing localhost-only Angular app; no env vars or third-party dashboards involved in this plan.

## Next Phase Readiness

**Wave 3 complete after plan 10 (recovery banner) lands.** Plan 07 closes:
- **FOUND-03** subscription hygiene — every feature component subscribes safely
- **FOUND-06** empty/error pattern consumed across all 8 pages

Plan 08 (Wave 4 — characterization specs) now has retrofitted pages to write specs against. The diet/chat/charts/reports pages all now have stable, predictable failure surfaces (`loadError` field + `<app-error-state>`) that characterization specs can assert on.

**Remaining Phase 1 work:**
- Plan 10 (Wave 3): recovery banner + AppComponent integration to close FOUND-07
- Plan 08 (Wave 4): characterization specs for diet/chat/charts/reports (closes FOUND-04 + FOUND-05's Karma side)

---
*Phase: 01-foundations*
*Completed: 2026-05-02*
