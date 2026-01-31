# Tasks: Charts Dashboard

## Phase 1: Spec + Skeleton

- [ ] T401 Create `src/app/features/charts/charts-page.component.ts` skeleton with range selector UI.
- [ ] T402 Add `/charts` route in `src/app/app.routes.ts`.
- [ ] T403 Add Charts link in `src/app/shared/nav.component.ts`.

## Phase 2: Charting Dependency

- [ ] T404 Add `chart.js` + `ng2-charts` dependencies; wire up a basic line chart.

## Phase 3: Date Range Utilities

- [ ] T405 Add `src/app/shared/date-range.ts` for preset/custom range calculations + filtering.
- [ ] T406 Add `src/app/shared/date-range.spec.ts` for preset bounds + validation.

## Phase 4: Data Series

- [ ] T407 Weight series (date vs weight).
- [ ] T408 Cardio series (duration; optional toggles for distance/calories).
- [ ] T409 Readings series (selector for type; appropriate series per type).
- [ ] T410 Empty-states for no-data-in-range.

## Phase 5: Verification

- [ ] T411 Run `ng test --no-watch`.
- [ ] T412 Run `ng build --configuration=production`.
- [ ] T413 Manual verification: switch ranges, verify charts update.
