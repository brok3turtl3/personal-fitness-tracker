# Tasks: Personal Fitness Tracker MVP

**Input**: Design documents from `/specs/001-fitness-tracker-mvp/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/

**Tests**: Unit tests are INCLUDED for StorageService and domain service validators as specified.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Angular project**: `src/app/` for application code
- **Models**: `src/app/models/`
- **Services**: `src/app/services/`
- **Features**: `src/app/features/{feature}/`
- **Shared**: `src/app/shared/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create Angular project with `ng new personal-fitness-tracker --standalone --routing --style=css --ssr=false`
- [x] T002 Verify TypeScript strict mode is enabled in tsconfig.json
- [x] T003 Create directory structure: `src/app/models/`, `src/app/services/`, `src/app/features/`, `src/app/shared/`
- [x] T004 [P] Configure app.config.ts with provideRouter and provideHttpClient

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Models (All Stories Depend On These)

- [x] T005 [P] Create AppData interface in src/app/models/app-data.model.ts (schemaVersion, arrays, lastModified)
- [x] T006 [P] Create CardioSession interface and CardioType in src/app/models/cardio-session.model.ts
- [x] T007 [P] Create WeightEntry interface in src/app/models/weight-entry.model.ts
- [x] T008 [P] Create HealthReading discriminated union (BloodPressure, BloodGlucose, Ketone) in src/app/models/health-reading.model.ts

### Storage Service (Foundation for All Data Operations)

- [ ] T009 Create StorageService in src/app/services/storage.service.ts with initialize(), getData(), saveData(), clearData()
- [ ] T010 Add schema migration hook to StorageService for future version upgrades
- [ ] T011 Create StorageService unit tests in src/app/services/storage.service.spec.ts covering: initialize, getData, saveData, clearData, migration

### Validation Utilities

- [ ] T012 [P] Create validation utility functions in src/app/services/validators.ts (validateCardio, validateWeight, validateBloodPressure, validateGlucose, validateKetone)
- [ ] T013 [P] Create validator unit tests in src/app/services/validators.spec.ts covering all validation rules and edge cases

### Shared Components

- [ ] T014 Create NavComponent in src/app/shared/nav.component.ts with links to /cardio, /weight, /readings
- [ ] T015 Configure routing in src/app/app.routes.ts with redirect from / to /cardio

### App Shell

- [ ] T016 Update AppComponent in src/app/app.component.ts to include NavComponent and router-outlet
- [ ] T017 Add basic styles in src/styles.css for layout (nav, main content area)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Log and View Cardio Sessions (Priority: P1) 🎯 MVP

**Goal**: Users can add cardio sessions and view their history on `/cardio`

**Independent Test**: Navigate to `/cardio`, add a session with date, type, duration, distance, notes → see it appear in history list sorted newest first

### Tests for User Story 1

- [ ] T018 [P] [US1] Create CardioService unit tests in src/app/services/cardio.service.spec.ts covering: getSessions, addSession (valid/invalid), sorting

### Implementation for User Story 1

- [ ] T019 [US1] Create CardioService in src/app/services/cardio.service.ts with getSessions(), addSession()
- [ ] T020 [US1] Create CardioPageComponent in src/app/features/cardio/cardio-page.component.ts with reactive form and history list
- [ ] T021 [US1] Add cardio form fields: date/time picker, type dropdown, duration input, distance input (optional), notes textarea
- [ ] T022 [US1] Add cardio history list displaying sessions sorted by date (newest first)
- [ ] T023 [US1] Wire up form validation with error messages showing valid ranges
- [ ] T024 [US1] Add route for /cardio in src/app/app.routes.ts pointing to CardioPageComponent

**Checkpoint**: User Story 1 fully functional - can add and view cardio sessions independently

---

## Phase 4: User Story 2 - Log and View Weight Entries (Priority: P1)

**Goal**: Users can add weight entries and view their history on `/weight`

**Independent Test**: Navigate to `/weight`, add an entry with date, weight, notes → see it appear in history list sorted newest first

### Tests for User Story 2

- [ ] T025 [P] [US2] Create WeightService unit tests in src/app/services/weight.service.spec.ts covering: getEntries, addEntry (valid/invalid), sorting

### Implementation for User Story 2

- [ ] T026 [US2] Create WeightService in src/app/services/weight.service.ts with getEntries(), addEntry()
- [ ] T027 [US2] Create WeightPageComponent in src/app/features/weight/weight-page.component.ts with reactive form and history list
- [ ] T028 [US2] Add weight form fields: date/time picker, weight input (kg), notes textarea
- [ ] T029 [US2] Add weight history list displaying entries sorted by date (newest first)
- [ ] T030 [US2] Wire up form validation with error messages showing valid range (50-1000 lbs)
- [ ] T031 [US2] Add route for /weight in src/app/app.routes.ts pointing to WeightPageComponent

**Checkpoint**: User Story 2 fully functional - can add and view weight entries independently

---

## Phase 5: User Story 3 - Log and View Health Readings (Priority: P2)

**Goal**: Users can add blood pressure, glucose, and ketone readings and view their history on `/readings`

**Independent Test**: Navigate to `/readings`, add each type of reading → see them appear in history list with type indicator, sorted newest first

### Tests for User Story 3

- [ ] T032 [P] [US3] Create ReadingsService unit tests in src/app/services/readings.service.spec.ts covering: getReadings (all/filtered), addBloodPressure, addGlucose, addKetone, validation

### Implementation for User Story 3

- [ ] T033 [US3] Create ReadingsService in src/app/services/readings.service.ts with getReadings(), addBloodPressure(), addBloodGlucose(), addKetone()
- [ ] T034 [US3] Create ReadingsPageComponent in src/app/features/readings/readings-page.component.ts with type selector, dynamic form, and history list
- [ ] T035 [US3] Add reading type selector (Blood Pressure, Blood Glucose, Ketones)
- [ ] T036 [US3] Add dynamic form fields based on selected type: BP (systolic/diastolic), Glucose (mmol/L), Ketones (mmol/L)
- [ ] T037 [US3] Add readings history list displaying all readings with type badge, sorted by date (newest first)
- [ ] T038 [US3] Wire up form validation with type-specific error messages and ranges
- [ ] T039 [US3] Add route for /readings in src/app/app.routes.ts pointing to ReadingsPageComponent

**Checkpoint**: User Story 3 fully functional - can add and view all health reading types independently

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T040 Add empty state messages for each history list ("No entries yet")
- [ ] T041 Add loading/saving feedback (brief indicator when saving)
- [ ] T042 [P] Add keyboard navigation support (tab order, enter to submit)
- [ ] T043 [P] Add aria-labels to form inputs for accessibility
- [ ] T044 Run `ng test --no-watch --code-coverage` and verify all tests pass
- [ ] T045 Run `ng build --configuration=production` and verify build succeeds
- [ ] T046 Manual validation: test complete user flows per quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - can start after Phase 2
- **User Story 2 (Phase 4)**: Depends on Foundational - can start after Phase 2 (parallel with US1)
- **User Story 3 (Phase 5)**: Depends on Foundational - can start after Phase 2 (parallel with US1, US2)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories - fully independent
- **User Story 2 (P1)**: No dependencies on other stories - fully independent
- **User Story 3 (P2)**: No dependencies on other stories - fully independent

### Within Each User Story

1. Tests FIRST (write tests that fail)
2. Service implementation (makes tests pass)
3. Component with form and list
4. Form validation wiring
5. Route configuration

### Parallel Opportunities

Within Phase 2 (Foundational):
```
Parallel group 1: T005, T006, T007, T008 (all models)
Sequential: T009 → T010 → T011 (StorageService + tests)
Parallel group 2: T012, T013 (validators + tests)
Sequential: T014 → T015 → T016 → T017 (nav, routing, app shell)
```

After Phase 2 completes, all user stories can run in parallel:
```
Developer A: US1 (T018-T024)
Developer B: US2 (T025-T031)
Developer C: US3 (T032-T039)
```

---

## Parallel Example: Foundational Models

```bash
# Launch all model tasks together (different files, no dependencies):
Task: T005 "Create AppData interface in src/app/models/app-data.model.ts"
Task: T006 "Create CardioSession interface in src/app/models/cardio-session.model.ts"
Task: T007 "Create WeightEntry interface in src/app/models/weight-entry.model.ts"
Task: T008 "Create HealthReading union in src/app/models/health-reading.model.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Cardio)
4. **STOP and VALIDATE**: Test cardio add/view flow independently
5. Demo/use MVP: Single working feature

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 (Cardio) → Test independently → Usable MVP!
3. Add User Story 2 (Weight) → Test independently → Enhanced product
4. Add User Story 3 (Readings) → Test independently → Full MVP
5. Polish → Production-ready

### Suggested MVP Scope

For fastest initial delivery: **Complete through Phase 3 (User Story 1)** - this gives a working cardio tracker that can be used immediately while remaining stories are in progress.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Run `ng test` frequently to catch regressions
- All validation ranges are defined in spec.md Validation Rules table
