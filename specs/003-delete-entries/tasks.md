# Tasks: Delete Entries

**Input**: Design documents from `/specs/003-delete-entries/`
**Prerequisites**: plan.md, spec.md

## Phase 1: Services + Tests

- [ ] T301 Add `deleteSession` to `src/app/services/cardio.service.ts` and tests to `src/app/services/cardio.service.spec.ts`.
- [ ] T302 Add `deleteEntry` to `src/app/services/weight.service.ts` and tests to `src/app/services/weight.service.spec.ts`.
- [ ] T303 Add `deleteReading` to `src/app/services/readings.service.ts` and tests to `src/app/services/readings.service.spec.ts`.

## Phase 2: UI

- [ ] T304 Add Delete controls + confirm flow to `src/app/features/cardio/cardio-page.component.ts`.
- [ ] T305 Add Delete controls + confirm flow to `src/app/features/weight/weight-page.component.ts`.
- [ ] T306 Add Delete controls + confirm flow to `src/app/features/readings/readings-page.component.ts`.

## Phase 3: Styling

- [ ] T307 Add `.btn-danger` styles in `src/styles.css` (or component-local equivalent).

## Phase 4: Verification

- [ ] T308 Run `ng test --no-watch`.
- [ ] T309 Run `ng build --configuration=production`.
- [ ] T310 Manual verification on `/cardio`, `/weight`, `/readings`: add + delete + refresh.
