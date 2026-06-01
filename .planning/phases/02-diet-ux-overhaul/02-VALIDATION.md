---
phase: 2
slug: diet-ux-overhaul
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 02-RESEARCH.md `## Validation Architecture`. The planner fills the
> Per-Task Verification Map once task IDs exist; this scaffold locks infrastructure,
> sampling rate, and the Wave 0 test gaps.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jasmine + Karma (Angular CLI defaults) |
| **Config file** | `angular.json` (test target); `tsconfig.spec.json` |
| **Quick run command** | `ng test --no-watch --browsers=ChromeHeadless` |
| **Full suite command** | `ng test --no-watch --code-coverage --browsers=ChromeHeadless` |
| **Estimated runtime** | ~30–60 seconds (whole suite, headless) |

---

## Sampling Rate

- **After every task commit:** Run `ng test --no-watch --browsers=ChromeHeadless` (scoped to the touched spec where practical)
- **After every plan wave:** Run `ng test --no-watch --code-coverage --browsers=ChromeHeadless`
- **Before `/gsd-verify-work`:** Full suite green + `ng build --configuration=production` succeeds
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Populated by the planner from PLAN.md task IDs. Every observable behavior below
> MUST map to at least one automated task; Wave 0 stubs the missing spec files first.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | 0 | DIET-02/03 | — | Conversion never invents a global density; throws when weight↔volume needs absent `densityGramsPerMl` | unit | `ng test --no-watch --browsers=ChromeHeadless` | ❌ W0 (`units.spec.ts`) | ⬜ pending |
| TBD | — | 0 | DIET-04 | — | Favorite ranking is deterministic for fixed clock + log set | unit | `ng test --no-watch --browsers=ChromeHeadless` | ❌ W0 (`food-ranking.spec.ts`) | ⬜ pending |
| TBD | — | 0 | DIET-10 | T-02-MIG | V6→V7 migrates fixtures + malformed input without data loss; `fdcId`/`gramsPerTbsp` preserved | unit | `ng test --no-watch --browsers=ChromeHeadless` | ❌ W0 (V6/V7 fixtures) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Observable Behaviors That MUST Be Validated

(From 02-RESEARCH.md Validation Architecture — the Nyquist sampling targets.)

1. **Unit conversion correctness (DIET-02/03):** mass↔mass, volume↔volume, named-serving↔base, and weight↔volume *only* when per-food `densityGramsPerMl` is present; absent density → explicit throw, **never** a global-density fallback.
2. **DST day-boundary correctness (DIET-08):** `toDateKey`/`sumByDay` bucket meals by **local** day across a spring-forward and fall-back transition with no drift.
3. **Migration backward-compat (DIET-10):** V6→V7 is additive; existing foods with `gramsPerTbsp?` keep working (and derive `densityGramsPerMl` where sensible); `fdcId` passthrough preserved; malformed/partial input does not throw-crash (backup-before-migrate honored).
4. **Snapshot immutability (DIET-09):** editing a `SavedFood` produces **zero** change to historical `MealItem`/`MealEntry` nutrition/serving/unit; widened snapshot still captures new units.
5. **Live daily-totals correctness (DIET-06):** kcal/protein/fat/carbs/**net carbs** recompute as pending items change; `netCarbs = max(0, carbs − fiber)`; %-of-target bars compute correctly when `DailyTargets` set.
6. **Favorite ranking determinism (DIET-04):** frequency+recency blend is a pure function of (log history, reference time) — same inputs ⇒ same order.

---

## Wave 0 Requirements

- [ ] `src/app/services/units.spec.ts` — conversion stubs for DIET-02/03 (incl. density-absent throw + DST-independent unit math)
- [ ] `src/app/services/food-ranking.spec.ts` (or co-located) — deterministic favorite-ranking stubs for DIET-04
- [ ] V6→V7 migration fixtures + malformed-input matrix under `src/app/services/migrations/fixtures/` — DIET-10
- [ ] Snapshot-immutability test stubs against `diet.service.ts` — DIET-09
- [ ] DST day-boundary test stub for `sumByDay`/`toDateKey` usage — DIET-08

*Existing Karma/Jasmine infrastructure covers execution; the above are the missing spec files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inline quick-add "feels frictionless" mid-log | DIET-01 | Subjective UX feel not fully unit-testable | In `ng serve`: log a meal, search a non-existent food, use inline add, confirm food is logged + saved without leaving the flow |
| Charts diet series render legibly alongside cardio/weight | DIET-07 | Visual chart.js rendering | In `ng serve`: open Charts, toggle diet calories+macros series, verify legibility + correct date-range response |
| Daily totals scannability + target bars | DIET-06 | Visual hierarchy / scannability | In `ng serve`: log items, set targets, verify live totals + %-of-target bars are scannable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (all commands use `--no-watch`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
