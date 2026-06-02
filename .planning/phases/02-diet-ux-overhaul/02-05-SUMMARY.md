---
phase: 02-diet-ux-overhaul
plan: 05
subsystem: charts
tags: [angular, typescript, chartjs, diet, charts, sum-by-day, dst, multi-axis]

# Dependency graph
requires:
  - phase: 02-diet-ux-overhaul
    plan: 01
    provides: "sumByDay (SUM-per-local-day keyed via toDateKey/dateOf, DST-correct)"
  - phase: 02-diet-ux-overhaul
    plan: 03
    provides: "DietService.getMealsInRange(startMs, endMs) — range-bounded meals sorted by dateTime"
provides:
  - "Diet calories + separately-toggleable protein/fat/carbs/net-carbs series on the EXISTING charts page (D-10)"
  - "buildDietChart: sumByDay (sum-per-local-day, DST-correct) keyed on MealEntry.dateTime — never groupByDay (DIET-08, D-11)"
  - "dietShow* checkbox controls mirroring cardioShow*, driven by the shared date-range filter (DIET-07)"
  - "formatShortDate now renders bare YYYY-MM-DD day-keys in LOCAL time (closes UTC label drift for diet AND readings)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Diet macros bucket via sumByDay (SUM), never groupByDay (average) — Pitfall 2"
    - "Calories on primary y axis; macros (g) share secondary y1 with grid.drawOnChartArea:false (existing multi-axis treatment)"
    - "Fetch all meals once (open range) then re-apply the resolved date-range via filterByRange per rebuild — mirrors the cardio/weight path, no re-query on control change"
    - "Bare day-key labels parsed in local time to avoid Date('YYYY-MM-DD')=UTC-midnight drift"

key-files:
  created: []
  modified:
    - src/app/features/charts/charts-page.component.ts
    - src/app/features/charts/charts-page.component.spec.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Fetch meals once via getMealsInRange(0, Date.now()) in loadAllData, then range-filter in buildDietChart with filterByRange — keeps the diet path consistent with cardio/weight (changing the date range never re-queries storage) while honoring the getMealsInRange contract"
  - "formatShortDate bare-day-key local-time fix is in-scope (Rule 1): the plan requires the DST-boundary meal to bucket to the CORRECT LOCAL-DAY LABEL; the latent UTC-midnight parse rendered day-keys a day early in any UTC-negative timezone (also fixes a pre-existing readings-label drift)"
  - "All five macro/calorie series gate on their own dietShow* control; macros share y1, calories own y; y1 axis only materializes when at least one macro is shown"

requirements-completed: [DIET-07, DIET-08]

# Metrics
duration: ~25min
completed: 2026-06-01
---

# Phase 2 Plan 05: Diet Series on the Charts Page Summary

**Integrated diet history into the EXISTING charts page — a calories series (reusing the cardio energy hue) plus separately-toggleable protein/fat/carbs/net-carbs macros — driven by the shared date-range filter and `controlsForm` checkbox pattern, bucketed by LOCAL day via `sumByDay` (SUMS, keyed on `dateTime`) so multi-meal days are never halved and a DST-boundary meal keys to the correct local day. DIET-07 + DIET-08 complete; full suite 837/837, production build clean.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 1 (auto)
- **Files modified:** 3 (0 created, 3 modified)

## Accomplishments

- **`DietService` injected** into `ChartsPageComponent`; `loadAllData` forkJoin now includes `diet: getMealsInRange(0, Date.now())`, fetching every meal once. `buildDietChart` re-applies the resolved date-range via `filterByRange` on each rebuild — mirroring the cardio/weight path so a date-range change never re-queries storage (DIET-07, D-10).
- **`buildDietChart` SUMS per LOCAL day** via `sumByDay(meals, m => m.dateTime, m => [calories, protein, fat, carbs, netCarbs])` — never `groupByDay` (averaging would halve a two-meal day; RESEARCH Pitfall 2 / D-11). Locked palette: calories `#e67e22` on primary `y`; protein `#16a085`, fat `#f1c40f`, carbs `#8e44ad`, net carbs `#c0392b` (dashed `borderDash:[4,4]`) on secondary `y1` with `grid.drawOnChartArea:false` (the existing multi-axis treatment). All series `pointRadius:2`, `tension:0.25`, `rgba(…,0.12)` fills.
- **`dietShow*` checkbox controls** (`dietShowCalories/Protein/Fat/Carbs/NetCarbs`) added to `controlsForm`, mirroring `cardioShow*` exactly, each `(change)="onControlsChanged()"` with an aria-label — macros separately toggleable (DIET-07). New "Diet metrics" control group + "Diet" chart section + diet empty-state (`<app-empty-state>` with the LOCKED copy "No diet data in this range" / "Log some meals or widen the date range…").
- **`formatShortDate` local-day fix (Rule 1):** a bare `YYYY-MM-DD` day-key (produced by `toDateKey` via `sumByDay`/`groupByDay`) is now parsed in LOCAL time, not UTC. `new Date('2026-03-08')` is spec'd to parse as UTC midnight, which renders a day early in any UTC-negative runner — the exact DST/TZ label drift DIET-08/D-11 forbids. Full ISO timestamps keep their original parsing. This also closes a latent same-shape drift in the readings chart labels.
- **Spec extended** with a `DietService` spy + 4 new diet tests: same-local-day calories are SUMMED (1000, not the 500 average); the protein dataset adds/removes as `dietShowProtein` toggles; a 23:30-local spring-forward (`2026-03-08`) meal buckets to the correct local-day label; the diet section shows its empty-state when no meals are in range. axe-core inline assertion carried forward (contrast enforced per QUAL-08).

## Task Commits

1. **Task 1: Inject DietService + buildDietChart (calories + toggleable macros) via sumByDay + controls** — `28d7979` (feat)

## Files Modified

- `src/app/features/charts/charts-page.component.ts` — DietService injection, `dietChartData`/`dietOptions` fields, `dietShow*` controls + template control group + Diet chart section + empty-state, `buildDietChart` (sumByDay + locked palette + y/y1 multi-axis), forkJoin diet fetch, `formatShortDate` local-day-key fix
- `src/app/features/charts/charts-page.component.spec.ts` — DietService spy in `makeSpies`/`configureBed`, `createMeal`/`createTotals` factories, 4 diet specs (SUM-not-average, protein toggle, DST label, empty-state)
- `.planning/REQUIREMENTS.md` — DIET-07 + DIET-08 checked + traceability rows annotated

## Decisions Made

- **Single fetch + per-rebuild filter:** `getMealsInRange(0, Date.now())` once in `loadAllData`, then `filterByRange` inside `buildDietChart` on every control change. This keeps the diet path byte-for-byte consistent with cardio/weight (which also hold all-data and re-filter), avoids a storage round-trip per range change, and still uses the `getMealsInRange` API the 02-03 plan provided for this page.
- **`formatShortDate` fix is in-scope (Rule 1 bug):** the plan's DST acceptance criterion asserts the boundary meal renders the CORRECT LOCAL-DAY LABEL. The bucketing (`sumByDay`/`toDateKey`) was already correct; the display layer parsed the resulting bare date-key as UTC, drifting the label a day in UTC-negative timezones. Fixed at the formatter so both the new diet labels and the pre-existing readings labels render the user's local day.
- **y1 axis materializes only with a visible macro:** when no macro is toggled on, the diet chart is single-axis (calories on `y`); the secondary grams axis appears only when at least one of protein/fat/carbs/net-carbs is shown — matching the cardio chart's conditional-axis pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `formatShortDate` rendered bare day-keys a day early in UTC-negative timezones**
- **Found during:** Task 1 (DST-boundary label spec)
- **Issue:** The new DST spec (and the pre-existing readings label path) feed `formatShortDate` a bare `YYYY-MM-DD` day-key from `toDateKey`. `new Date('2026-03-08')` parses as UTC midnight per spec; in the UTC-4 test runner that rendered "Mar 7, 26" instead of "Mar 8, 26" — the precise DST/TZ label drift DIET-08/D-11 forbids.
- **Fix:** Parse a bare `YYYY-MM-DD` key via local `new Date(y, m-1, d)`; full ISO timestamps (with a time component) keep their original parsing.
- **Files modified:** src/app/features/charts/charts-page.component.ts
- **Commit:** 28d7979

### Acceptance-criterion literalism note (not a behavior deviation)

- The criterion `grep -c 'groupByDay' charts-page.component.ts returns 0` reads literally as 6, but every match is either the shared import, one of the THREE pre-existing readings-chart `groupByDay` calls, or an explanatory comment in the diet code stating diet does NOT use it. **`buildDietChart` calls `sumByDay` exclusively** — the substantive criterion ("diet does NOT use the averaging helper") holds. Removing the pre-existing readings `groupByDay` usage is out of scope (it correctly averages same-day readings — the b6149d2 behavior the existing spec guards).

## Threat-Model Compliance

- **T-02-05-01 (Tampering / day-bucketing correctness, mitigate):** `sumByDay` SUMS (not averages) and keys via `toDateKey` on `dateTime`; the spec asserts the same-local-day SUM (1000, not 500) AND the 23:30 spring-forward local-day label — no UTC drift, no halved macros.
- **T-02-05-02 (Tampering / chart label XSS, mitigate):** chart data/labels pass via ng2-charts `[data]` binding (data, not HTML); no `innerHTML`/`bypassSecurityTrust*` introduced (grep clean).
- **T-02-05-03 (Info disclosure / charts egress, accept):** charts read local meal data via `DietService`→`StorageService`; no `fetch(` introduced (grep clean).

## Verification

- Targeted spec: `charts-page.component.spec.ts` — **9/9 SUCCESS** (5 existing + 4 new diet).
- Full Karma suite: **837/837 SUCCESS** (828 baseline + 9 new).
- `ng build --configuration=production`: **exit 0** (only pre-existing CSS-budget warnings in unrelated cardio/readings/diet/chat components — out of scope; no new charts-page budget breach).
- Chokepoint grep `innerHTML|bypassSecurityTrust|fetch\(` on charts-page: **no matches**.
- Acceptance greps: `sumByDay`≥1 (4), `getMealsInRange|DietService`≥1 (3), `dietShowCalories|dietShowProtein`≥1 (6), `#16a085|#8e44ad`≥1 (2). `groupByDay` literal=6 but all pre-existing readings/import/comment — diet path uses sumByDay only (see deviation note).

## Issues Encountered

- The DST label spec surfaced the latent `formatShortDate` UTC-midnight parse (resolved as the Rule 1 fix above). No other issues.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

- DIET-07 + DIET-08 complete; the diet series now lives on the charts page driven by the shared date-range filter, and local-time day boundaries are consistent across diet/charts/reports.
- No blockers.

## Self-Check: PASSED

- `src/app/features/charts/charts-page.component.ts` and `.spec.ts` present and modified.
- Task commit `28d7979` present in git history.
- Full Karma suite 837/837; production build exit 0; chokepoint grep clean.

---
*Phase: 02-diet-ux-overhaul*
*Completed: 2026-06-01*
