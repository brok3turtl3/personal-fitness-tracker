---
phase: 2
slug: diet-ux-overhaul
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 02-RESEARCH.md `## Validation Architecture`. Per-Task Verification
> Map populated by the planner against the 5-plan / 3-wave structure.

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

> Every observable behavior maps to at least one automated task. The pure-module
> specs (units, food-ranking, sumByDay) and the migration fixtures are scheduled
> in the earliest wave (Plan 01 + Plan 02) — they ARE the Wave-0 test gaps, created
> alongside the modules under test (TDD), so no task runs without an automated verify.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 02-01 | 1 | DIET-02/03 | T-02-01-01/02 | Conversion never invents a global density; throws weight↔volume w/o `densityGramsPerMl` | unit | `ng test --no-watch --browsers=ChromeHeadless --include='**/units.spec.ts'` | ❌→✅ creates `units.spec.ts` | ⬜ pending |
| 01-T2 | 02-01 | 1 | DIET-04 | T-02-01-03 | Favorite ranking deterministic for fixed `now` + log set | unit | `ng test --no-watch --browsers=ChromeHeadless --include='**/food-ranking.spec.ts'` | ❌→✅ creates `food-ranking.spec.ts` | ⬜ pending |
| 01-T3 | 02-01 | 1 | DIET-08 | T-02-05-01 | `sumByDay` SUMS per local day on `dateTime`; DST-correct | unit | `ng test --no-watch --browsers=ChromeHeadless --include='**/chart-grouping.spec.ts'` | ✅ extend | ⬜ pending |
| 02-T1/T2 | 02-02 | 2 | DIET-10 | T-02-02-01..04 | V6→V7 additive; fdcId/gramsPerTbsp preserved; malformed loads-or-fails-loud; snapshots byte-stable | unit (fixture) | `ng test --no-watch --browsers=ChromeHeadless --include='**/storage.service.migration-fixtures.spec.ts'` | ❌→✅ creates v6/v7 fixtures | ⬜ pending |
| 03-T1 | 02-03 | 2 | DIET-02/03 | T-02-03-02/03 | toBaseUnits delegates to units.ts; density/target validators reject bad input | unit | `ng test --no-watch --browsers=ChromeHeadless --include='**/diet.service.spec.ts' --include='**/validators.spec.ts'` | ✅ extend | ⬜ pending |
| 03-T2 | 02-03 | 2 | DIET-05/06/09 | T-02-03-01 | Food edit leaves historical meals byte-identical; copy-meal/targets storage | unit | `ng test --no-watch --browsers=ChromeHeadless --include='**/diet.service.spec.ts'` | ✅ extend | ⬜ pending |
| 04-T1 | 02-04 | 3 | DIET-01/03/04 | T-02-04-01/02/03 | Inline quick-add (manual, no egress); density-gated picker; no window.confirm | unit/DOM | `ng test --no-watch --browsers=ChromeHeadless --include='**/diet-page.component.spec.ts'` | ✅ extend | ⬜ pending |
| 04-T2 | 02-04 | 3 | DIET-05/06/09 | T-02-04-04 | Live totals + target bars; copy-meal editable; history reads snapshot | unit/DOM | `ng test --no-watch --browsers=ChromeHeadless --include='**/diet-page.component.spec.ts'` | ✅ extend | ⬜ pending |
| 05-T1 | 02-05 | 3 | DIET-07/08 | T-02-05-01/02 | Diet series SUMS per local day (DST-correct); macros toggleable; no XSS sink | unit/DOM | `ng test --no-watch --browsers=ChromeHeadless --include='**/charts-page.component.spec.ts'` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Observable Behaviors That MUST Be Validated

(From 02-RESEARCH.md Validation Architecture — the Nyquist sampling targets. Each maps to a task above.)

1. **Unit conversion correctness (DIET-02/03):** mass↔mass, volume↔volume, named-serving↔base, and weight↔volume *only* when per-food `densityGramsPerMl` is present; absent density → explicit throw, **never** a global-density fallback. → **01-T1, 03-T1**
2. **DST day-boundary correctness (DIET-08):** `toDateKey`/`sumByDay` bucket meals by **local** day across spring-forward and fall-back with no drift. → **01-T3, 05-T1**
3. **Migration backward-compat (DIET-10):** V6→V7 additive; `gramsPerTbsp?` keeps working (and derives density); `fdcId` preserved; malformed/partial input does not throw-crash. → **02-T1/T2**
4. **Snapshot immutability (DIET-09):** editing a `SavedFood` produces **zero** change to historical `MealItem`/`MealEntry`; widened snapshot still captures new units. → **03-T2, 04-T2**
5. **Live daily-totals correctness (DIET-06):** kcal/protein/fat/carbs/**net carbs** recompute as pending items change; `netCarbs = max(0, carbs − fiber)`; %-of-target bars compute correctly. → **03-T1/T2, 04-T2**
6. **Favorite ranking determinism (DIET-04):** frequency+recency blend is a pure function of (log history, reference time) — same inputs ⇒ same order. → **01-T2**

---

## Wave 0 Requirements

These missing spec/fixture files are created in the earliest wave (Plan 01 + Plan 02), each alongside its module-under-test (TDD), so `wave_0_complete` flips at execution time:

- [ ] `src/app/services/units.ts` + `units.spec.ts` — DIET-02/03 (Plan 01-T1)
- [ ] `src/app/services/food-ranking.ts` + `food-ranking.spec.ts` — DIET-04 (Plan 01-T2)
- [ ] `sumByDay` in `chart-grouping.ts` + extended `chart-grouping.spec.ts` (DST stub) — DIET-08 (Plan 01-T3)
- [ ] V6→V7 migration fixtures + malformed matrix under `src/app/services/migrations/fixtures/` — DIET-10 (Plan 02-T2)
- [ ] Snapshot-immutability describe block in `diet.service.spec.ts` — DIET-09 (Plan 03-T2)

*Existing Karma/Jasmine infrastructure covers execution; the above are the missing spec files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inline quick-add "feels frictionless" mid-log | DIET-01 | Subjective UX feel | In `ng serve`: log a meal, search a non-existent food, use inline add, confirm food is logged + saved without leaving the flow |
| Charts diet series render legibly alongside cardio/weight | DIET-07 | Visual chart.js rendering | In `ng serve`: open Charts, toggle diet calories+macros, verify legibility + date-range response |
| Daily totals scannability + target bars | DIET-06 | Visual hierarchy | In `ng serve`: log items, set targets, verify live totals + %-of-target bars are scannable |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (all commands use `--no-watch`)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned (flips to verified at phase close)
