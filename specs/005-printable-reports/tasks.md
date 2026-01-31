# Tasks: Printable Reports

## Phase 1: Spec + Routing

- [ ] T501 Add `specs/005-printable-reports/*`.
- [ ] T502 Add `/report` route in `src/app/app.routes.ts`.

## Phase 2: Report Page

- [ ] T503 Add `src/app/features/reports/report-page.component.ts` (standalone).
- [ ] T504 Parse query params and render range label + generated timestamp.
- [ ] T505 Load data via services and filter by `[startMs,endMs]`.

## Phase 3: Summaries + Charts

- [ ] T506 Implement summary stats (counts + totals/averages) for cardio/weight/readings.
- [ ] T507 Render charts in print-friendly layout.

## Phase 4: Print Integration

- [ ] T508 Add Print/Export button to `src/app/features/charts/charts-page.component.ts` that opens `/report` with params.
- [ ] T509 Add print CSS in `src/styles.css`.

## Phase 5: Verification

- [ ] T510 Run `ng test --no-watch`.
- [ ] T511 Run `ng build --configuration=production`.
- [ ] T512 Manual: export PDFs for preset and custom ranges.
