---
phase: 02-diet-ux-overhaul
plan: 04
subsystem: diet-page-ui
tags: [angular, diet, ui, quick-add, search, food-ranking, copy-meal, daily-targets, inline-confirm, accessibility]

# Dependency graph
requires:
  - phase: 02-diet-ux-overhaul
    plan: 01
    provides: "units.ts (toBaseUnits/isMeasuredUnit/UnitConversionError/MeasuredUnit), food-ranking.ts (filterFoods/rankFoods/recentFoods), DailyTargets + widened FoodUnit/density model"
  - phase: 02-diet-ux-overhaul
    plan: 03
    provides: "DietService.copyMealItems / getMealsInRange / get-set-clearDailyTargets / widened addSavedFood; exported sumTotals/scaleFoodTotals"
provides:
  - "Overhauled diet-page meal-log UX: inline quick-add (D-01/D-02), search/Recent/Frequent picker (DIET-04), copy-a-meal (DIET-05), live totals + %-of-target bars (DIET-06), inline button-swap confirms"
  - "Density-gated serving unit picker + UnitConversionError-to-field-error mapping (DIET-03 graceful fallback)"
  - "toBaseUnitsForPreview deleted; conversion delegated to units.ts (UI owns no conversion math)"
affects: [02-05-charts-diet-series]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Component is UI-only: delegates filter/rank/recent to food-ranking.ts, conversion to units.ts, copy/targets to DietService (CLAUDE.md Component Pattern)"
    - "Inline button-swap confirm via a per-row confirmingDeleteId/confirmingClearTargets flag — no window.confirm, no modal"
    - "Live totals = sumTotals([...saved-day meal totals, ...pending previews]); recomputed on every pending mutation"
    - "Target bar: text label ALWAYS rendered (color never the sole a11y signal); bar width clamped to 100% while the label shows true pct / over-by"

key-files:
  created: []
  modified:
    - src/app/features/diet/diet-page.component.ts
    - src/app/features/diet/diet-page.component.spec.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Food picker selects into a transient selectedFood (replaced the savedFoodId form control); quick-add stages a base-unit pending item directly (servingId='') and onAddMeal filters serving-less items with a clear error"
  - "Recent/Frequent rank over a 90-day getMealsInRange window (allMeals), not just the selected day, so the groups are meaningful; a range-load failure degrades gracefully (empty ranks, page still loads)"
  - "Serving unit picker gates cross-dimension units on densityGramsPerMl via a local sameDimension() check over the MeasuredUnit set (Pitfall 5); base-only when density absent"

requirements-completed: [DIET-01, DIET-04, DIET-05, DIET-06, DIET-09]

# Metrics
duration: ~30min
completed: 2026-06-01
---

# Phase 2 Plan 04: Diet-Page UI Overhaul Summary

**Overhauled `diet-page.component.ts` (UI-only) into the phase's headline friction-killers: inline quick-add on a search miss that saves-and-logs without leaving the flow, a search-as-you-type picker with Recent + auto-ranked Frequent groups, one-action copy-a-meal landing editable pending items, live daily totals with always-labelled %-of-target bars, and inline button-swap confirms replacing every `window.confirm`. Deleted the duplicate `toBaseUnitsForPreview` and delegated conversion to `units.ts`. Full suite 833/833, production build clean.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 (both `type=auto`)
- **Files modified:** 3 (0 created)

## Accomplishments

- **Inline quick-add (DIET-01 / D-01 / D-02):** when `filterFoods` returns empty for a non-empty query, the picker shows `No match. Add "{query}" as a new food`; clicking expands an `.inline-form` (inside the meal panel — no modal, no context-switch) pre-filled with the typed name and the locked helper "Enter macros once — this food stays in your library for next time." Macros are typed MANUALLY (no external lookup). "Add food & log it" calls `dietService.addSavedFood(...)`, and on success immediately stages the new food as a pending item — saved AND logged in one action.
- **Search / Recent / Frequent (DIET-04 / D-06):** a "Search foods…" input drives `filterFoods(savedFoods, query)` (rendered as `.history-list` results). On focus with an empty query, two `.subpanel` groups render as `.pill` rows: "Recent" (`recentFoods`) and auto-ranked "Frequent" (`rankFoods`) — never "Favorites", never manual starring. All ranking delegates to `food-ranking.ts`.
- **Density-gated unit picker (DIET-03 graceful fallback):** custom-serving unit options only include cross-dimension units when the food has `densityGramsPerMl`; otherwise base-dimension units only, with the locked note "No density set — you can log this food in weight or volume units, but not convert between them." `onAddMealItem` delegates to `units.ts` `toBaseUnits` inside try/catch, mapping `UnitConversionError` to a field error rather than crashing.
- **`toBaseUnitsForPreview` deleted:** the duplicate conversion helper is gone; the component imports `toBaseUnits`/`isMeasuredUnit`/`UnitConversionError`/`MeasuredUnit` from `units.ts`.
- **Inline confirms:** `window.confirm` removed everywhere. Delete-food, delete-meal, and clear-targets each swap their button in place to the locked confirm copy with `[Confirm]`/`[Cancel]` `.btn-sm`. Remove-pending-item stays no-confirm (`.btn-sm.btn-danger` "Remove").
- **Live totals + target bars (DIET-06 / D-08):** `liveTotals = sumTotals([...saved-day meal totals, ...pending previews])` recomputes on every add/remove/quick-add. `.target-bar` renders below a metric when a target is set — locked styling (track `#ecf0f1`, 8px, 999px; fill `#2471a3` at/under, `#c0392b` over) with an ALWAYS-present text label ("{value} / {target} {unit} · {pct}%" or "· over by {n}"), bar width clamped to 100% while the label shows the true percentage. Inline targets editor delegates to `set/clearDailyTargets`.
- **Copy-a-meal (DIET-05):** "Repeat yesterday" (one tap) and "Copy from another day…" (date-source picker) both call `dietService.copyMealItems(meal, savedFoods)` (re-derive from the current food) and append editable pending items, surfacing "Copied {n} items — edit or remove any before saving." Yesterday's key is derived via the local-date helper (no hand-rolled UTC math).
- **History renders snapshots (DIET-09):** the meals list reads `meal.totals` / item snapshot fields, never re-resolving the live food — covered by a new DOM test that edits the live food to 999 kcal and asserts the history row still shows the frozen 155.

## Task Commits

1. **Task 1: inline quick-add + search/Recent/Frequent + delegate conversion + inline confirms** — `d00fad8` (feat)
2. **Task 2: live totals + %-of-target bars + targets editor + copy-a-meal + spec** — `3f7bdb2` (feat)

## Files Modified

- `src/app/features/diet/diet-page.component.ts` — full meal-log UX overhaul (picker, quick-add, density-gated units, conversion delegation, inline confirms, live totals, target bars, targets editor, copy-a-meal); `toBaseUnitsForPreview` removed
- `src/app/features/diet/diet-page.component.spec.ts` — widened spy surface (getMealsInRange/copyMealItems/get-set-clearDailyTargets) + 5 new characterization tests (live-totals-on-add, over/under target-bar labels, Repeat-yesterday editable pending, DIET-09 snapshot render)
- `.planning/REQUIREMENTS.md` — DIET-01/04/05/06/09 checked complete; DIET-03 row advanced (UI density-gating shipped); traceability rows annotated with the 02-04 contribution

## Decisions Made

- **selectedFood replaces the `savedFoodId` form control:** the picker now selects a food into a transient `selectedFood`, which drives the serving options and the add-to-meal form. This keeps the search/recents/quick-add surface as the single entry point (cleaner UX than a parallel `<select>`). Quick-add stages a base-unit pending item directly (no serving), and `onAddMeal` filters serving-less pending items with the message "Pick a serving for each item before saving." so a persisted meal always has resolvable items.
- **90-day ranking window:** Recent/Frequent rank over `getMealsInRange(now-90d, now)` (loaded into `allMeals`) rather than only the selected day, so the groups are actually useful. A range-load error degrades gracefully — empty ranks, the page still renders (ranking is a nicety, not load-critical).
- **Local `sameDimension()` gate:** the unit picker's cross-dimension gating uses a small mass-unit set check over the `MeasuredUnit` union (UI-side presentation logic). The authoritative no-default-density rule still lives in `units.ts` (which throws); the gate is purely "don't offer a unit that would throw."

## Deviations from Plan

### Auto-fixed Issues

None requiring code fixes. One documented build observation below.

## Known Build Warnings (accepted, out of scope)

- **diet-page component-style budget:** the new locked elements (`.target-bar`/`.target-fill`/`.target-label`, `.confirm-swap`, `.food-picker`, `.pill-button`/`.result-button`) push the component CSS ~334 bytes over the 2.05 kB per-component style budget — a WARNING, not an error; `ng build --configuration=production` exits 0. Sibling pages (cardio, readings, chat) carry the identical pre-existing warning, so this matches the established in-tree pattern. The additions are the minimum CSS for the LOCKED target-bar styling + inline-confirm layout the UI-SPEC mandates; the rest of the surface reuses global classes. Not "fixed" to avoid regressing the locked visual contract.

## Threat-Model Compliance

- **T-02-04-01 (XSS, mitigate):** all user-entered food names/macros render via Angular `{{ }}` interpolation (auto-escaped); `grep -rnE "innerHTML|bypassSecurityTrust|fetch\(|XMLHttpRequest"` on the component returns no matches (T-XSS / T-EGRESS upheld).
- **T-02-04-02 (density-less cross-dimension, mitigate):** the serving unit picker gates cross-dimension units on `densityGramsPerMl`; `onAddMealItem` try/catches `UnitConversionError` → field error, never a silent wrong macro.
- **T-02-04-03 (external food-DB egress, mitigate):** quick-add is MANUAL entry only — no `fetch`/network call introduced (Phase 5 CSP / T-EGRESS preserved).
- **T-02-04-04 (snapshot immutability, mitigate):** history reads `meal.totals`/`item.snapshot`; the DIET-09 DOM test proves a live-food edit (999 kcal) does not change the rendered history row (155). Copy-meal re-derivation targets a NEW meal only.

## Verification

- Targeted spec: `diet-page.component.spec.ts` 11/11 green.
- Full Karma suite: **833/833 SUCCESS** (828 baseline + 5 new diet-page tests).
- `ng build --configuration=production`: **exit 0** (only the accepted component-style budget warnings noted above).
- Acceptance greps all pass: `toBaseUnitsForPreview`=0, `window.confirm`=0, `filterFoods/rankFoods/recentFoods`≥1, `from '.../services/units'`=1, `Frequent`≥1 & `Favorites`=0, `Add food & log it`≥1, `sumTotals`≥1, `getDailyTargets/setDailyTargets`≥1, `copyMealItems/Repeat yesterday`≥1, `over by`≥1.
- Threat greps: no `innerHTML`/`bypassSecurityTrust`/`fetch(`/`XMLHttpRequest` in the component.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

- **02-05 (charts):** the diet-page consumes `getMealsInRange`/`getDailyTargets`/`sumTotals`; the charts plan reuses `getMealsInRange` + `sumByDay` for the diet series. No diet-page coupling blocks it.
- No blockers.

## Self-Check: PASSED

- Modified files present: `diet-page.component.ts`, `diet-page.component.spec.ts`, `.planning/REQUIREMENTS.md`.
- Both task commits present in git history: `d00fad8`, `3f7bdb2`.
- Full Karma suite 833/833; production build exit 0; all acceptance + threat greps pass.

---
*Phase: 02-diet-ux-overhaul*
*Completed: 2026-06-01*
