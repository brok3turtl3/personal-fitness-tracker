# Tasks: Cardio Session Calories

**Input**: Design documents from `/specs/002-cardio-calories/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

---

## Phase 1: Model + Validation

- [ ] T201 [P] Update `src/app/models/cardio-session.model.ts` to add optional `caloriesBurned?: number`.
- [ ] T202 Update `src/app/services/validators.ts` to validate calories when provided (0-20000) and treat empty as undefined.
- [ ] T203 [P] Update `src/app/services/validators.spec.ts` to cover calories validation (missing/empty/0/negative/too-large).

---

## Phase 2: Service Layer

- [ ] T204 Update `src/app/services/cardio.service.ts` to accept/persist `caloriesBurned` and remain compatible with older stored sessions.
- [ ] T205 [P] Update `src/app/services/cardio.service.spec.ts` to cover persistence of calories.

---

## Phase 3: UI

- [ ] T206 Update `src/app/features/cardio/cardio-page.component.ts` to add a calories input to the reactive form and include the value when saving.
- [ ] T207 Update `src/app/features/cardio/cardio-page.component.ts` to display calories in the history list when present.

---

## Phase 4: Verification

- [ ] T208 Run `ng test --no-watch` and fix any failures.
- [ ] T209 Run `ng build --configuration=production` and fix any failures.
- [ ] T210 Manual check: add a session with calories, refresh, verify calories persists and sessions without calories still render.
