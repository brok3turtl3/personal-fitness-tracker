# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0.0 — Refinement

**Shipped:** 2026-06-03
**Phases:** 5 | **Plans:** 37 | **Commits:** 259

### What Was Built
- Diet UX overhaul — inline quick-add, per-food density units, search/Recent/Frequent, copy-a-meal, live %-of-target totals, charts diet series, DST-safe local-day math (DIET-01..10).
- Agentic AI coach — bounded `while(stop_reason==='tool_use')` loop, six read-only `query_*` tools, persistent `memory_20250818` store, editable `UserProfile`, real `countTokens` + ephemeral system-prompt caching.
- Evidence-graded, web-grounded output — confidence badges, data-vs-research attribution, API-structured-only citation links, opt-in `web_search_20250305` with https-only footnotes and cost caps.
- Quality/security/a11y sweep — CRUD parity, quota + multi-tab safety, CSP lockdown, 401 rotation, axe-core + manual a11y pass, Stryker mutation floor — all on a Phase-1 refactor-safe foundation (characterization tests, shared utils, subscription hygiene, typed backup-before-migrate).

### What Worked
- **Foundation-first sequencing.** Phase 1's characterization tests + schema-migration discipline meant later refactors (diet UI, chat block model) couldn't silently regress — the typed `LegacyAppDataVN` + backup-before-migrate harness carried three migrations (V4→V5→V6→V7) without a data-loss incident.
- **The D-17 SDK-boundary chokepoint.** Keeping `@anthropic-ai/sdk` confined to one service and using local structural types everywhere else kept models/parsers testable and SDK-version-agnostic across the whole AI build-out.
- **Pure-module extraction before UI.** `units.ts`, `food-ranking.ts`, `confidence-attribution-parser.ts`, `sumByDay` were built and spec'd as DI-free pure functions first, so the component work was thin and the hard logic was exhaustively tested (incl. adversarial degradation).
- **Standing gray-area delegation.** Deferring phase gray areas to a fixed north star (best practices + codebase patterns + UX) avoided per-decision round-trips without losing coherence.

### What Was Inefficient
- **Schema-version label drift.** DIET-10 was authored as "V5→V6" but Phases 3+5 shipped first and advanced the base to V6, forcing a V6→V7 retarget. Parallel-phase schema labels needed reconciling at execute time rather than plan time.
- **Dev-seed debugging churn.** Two debug sessions on dev-seed pending-pill rendering / approval-persist; the fix landed in code but the sessions were never formally closed — bookkeeping lag.
- **Trailing UAT/polish tail.** Phase-4 visual UAT (browser-only) and 6 Phase-2 code-review polish items slipped past phase close as deferred todos rather than being burned down in-phase.

### Patterns Established
- **Pattern 2 Form A** subscription cleanup: `private destroyRef = inject(DestroyRef)` field + `takeUntilDestroyed(this.destroyRef)` on every subscribe (bare `takeUntilDestroyed()` forbidden — NG0203).
- **Backup-before-migrate** with a recovery key + recovery banner as the standard for every schema bump.
- **Byte-stable cacheable system-prompt prefix** (`cache_control: ephemeral`) with volatile data pushed to a separate non-cached block and full detail moved to tools.
- **Allow-list-gated parsers that never throw / never fabricate** for any model-emitted token (confidence grades, citation linkability).

### Key Lessons
1. Reconcile schema-migration version labels against the *actual* merged baseline when phases run in parallel — author them as "next after current HEAD," not a hardcoded number.
2. A one-service SDK chokepoint pays for itself across a multi-phase integration: it isolates churn and keeps the rest of the tree unit-testable.
3. Browser-only UAT and code-review polish should have an explicit in-phase burndown gate, or they accumulate as a deferred tail across the milestone.

### Cost Observations
- Model mix: predominantly Opus (quality profile); subagents for research/planning/verification per phase.
- Notable: yolo mode + standing gray-area delegation kept human round-trips concentrated at phase boundaries and the final milestone close.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v2.0.0 Refinement | 5 | 37 | First full GSD milestone on this brownfield app — foundation-first sequencing + parallel file-disjoint phases (2‖3). |

### Cumulative Quality

| Milestone | Tests | Build | Notable |
|-----------|-------|-------|---------|
| v2.0.0 | 842/842 Karma green | prod exit 0 | Stryker mutation floor on validators.ts; zero `any` in production paths; CSP egress lock. |

### Top Lessons (Verified Across Milestones)

1. *(first milestone — trends accumulate from v3 onward)*

---
