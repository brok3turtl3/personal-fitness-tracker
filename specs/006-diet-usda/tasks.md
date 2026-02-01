# Tasks: Diet Logging (Manual Food Library)

## Phase 1: Models + Migration

- [ ] T601 Add diet models in `src/app/models/diet.model.ts` (SavedFood/MealEntry/NutritionTotals).
- [ ] T602 Update `src/app/models/app-data.model.ts` to add diet containers and bump schema version.
- [ ] T603 Update `src/app/services/storage.service.ts` with v1 -> v2 migration.
- [ ] T604 Add/adjust unit tests for storage migration (`src/app/services/storage.service.spec.ts`).

## Phase 2: Diet Service

- [ ] T607 Add `src/app/services/diet.service.ts` with saved foods + meals CRUD.
- [ ] T608 Add `src/app/services/diet.service.spec.ts` for totals and snapshots.
- [ ] T609 Add update/delete meals to `src/app/services/diet.service.ts` and tests.

## Phase 4: Diet UI

- [ ] T609 Add `src/app/features/diet/diet-page.component.ts` (standalone).
- [ ] T610 Add route in `src/app/app.routes.ts` and nav link in `src/app/shared/nav.component.ts`.
- [ ] T611 Implement “Add food” flow (manual nutrition per base unit).
- [ ] T612 Implement meal logging UI with serving selection + quantity.
- [ ] T612a Add edit/delete meal actions in the meals list.
- [ ] T613 Implement daily totals view and empty-states.

## Phase 5: Verification

- [ ] T614 Run `ng test --no-watch`.
- [ ] T615 Run `ng build --configuration=production`.
- [ ] T616 Manual: add a food, add custom serving, log meal, verify totals + persistence.
