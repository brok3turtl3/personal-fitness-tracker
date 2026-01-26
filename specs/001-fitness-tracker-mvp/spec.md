# Feature Specification: Personal Fitness Tracker MVP

**Feature Branch**: `001-fitness-tracker-mvp`
**Created**: 2025-01-25
**Status**: Draft
**Input**: User description: "Build a personal fitness tracking web app for a single user on my local machine. MVP must track cardio sessions, weight entries, and health readings (blood pressure, blood glucose, ketones). Must support viewing history and adding new entries. Data stored locally, designed for future expansion."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log and View Cardio Sessions (Priority: P1)

As a fitness tracker user, I want to log my cardio workouts and view my history on a single page so that I can track my exercise over time.

**Why this priority**: Cardio tracking is the core fitness functionality. Without the ability to log workouts, the app provides no value.

**Independent Test**: Can be fully tested by navigating to `/cardio`, adding a session via the form, and seeing it appear in the history list below.

**Acceptance Scenarios**:

1. **Given** I navigate to `/cardio`, **When** I enter date/time, type (running), duration (30 min), distance (5 km), and optional notes and submit, **Then** the session is saved and immediately appears in the history list below the form.
2. **Given** I am on `/cardio` with existing sessions, **When** the page loads, **Then** I see all sessions sorted by date (newest first) with all recorded details.
3. **Given** I am adding a cardio session, **When** I leave required fields empty or enter invalid values, **Then** I see validation errors and cannot save until corrected.

---

### User Story 2 - Log and View Weight Entries (Priority: P1)

As a fitness tracker user, I want to log my weight measurements and view my history on a single page so that I can monitor my body weight trends.

**Why this priority**: Weight tracking is equally fundamental to fitness tracking as cardio. Users need both to have a complete picture.

**Independent Test**: Can be fully tested by navigating to `/weight`, adding an entry via the form, and seeing it appear in the history list below.

**Acceptance Scenarios**:

1. **Given** I navigate to `/weight`, **When** I enter date/time, weight value, and optional notes and submit, **Then** the entry is saved and immediately appears in the history list below the form.
2. **Given** I am on `/weight` with existing entries, **When** the page loads, **Then** I see all entries sorted by date (newest first) with weight and notes.
3. **Given** I am adding a weight entry, **When** I enter an invalid weight (outside valid range), **Then** I see a validation error.

---

### User Story 3 - Log and View Health Readings (Priority: P2)

As a fitness tracker user, I want to log my health readings (blood pressure, blood glucose, ketones) and view my history on a single page so that I can monitor key health metrics.

**Why this priority**: Health readings provide additional context but are secondary to the core fitness tracking (cardio and weight). Some users may not track these metrics.

**Independent Test**: Can be fully tested by navigating to `/readings`, adding each type of reading, and seeing them appear in the history list.

**Acceptance Scenarios**:

1. **Given** I navigate to `/readings`, **When** I select "Blood Pressure" and enter date/time, systolic, diastolic, and optional notes and submit, **Then** the reading is saved and appears in the history list.
2. **Given** I navigate to `/readings`, **When** I select "Blood Glucose" and enter date/time, glucose level (mmol/L), and optional notes and submit, **Then** the reading is saved and appears in the history list.
3. **Given** I navigate to `/readings`, **When** I select "Ketones" and enter date/time, ketone level (mmol/L), and optional notes and submit, **Then** the reading is saved and appears in the history list.
4. **Given** I am on `/readings` with various readings, **When** the page loads, **Then** I see all readings sorted by date (newest first), with reading type clearly indicated.

---

### Edge Cases

- What happens when LocalStorage is full? Display a clear error message indicating storage is full.
- What happens when browser clears local data? Data is lost; user should be warned about this limitation.
- How are timezone changes handled? All dates stored in local time; no timezone conversion needed for single-user local app.
- What happens with concurrent tabs? LocalStorage synchronizes across tabs; last write wins.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to add cardio sessions with: date/time (required), type (required), duration in minutes (required), distance in km (optional), and notes (optional).
- **FR-002**: System MUST allow users to add weight entries with: date/time (required), weight in lbs (required), and notes (optional).
- **FR-003**: System MUST allow users to add blood pressure readings with: date/time (required), systolic in mmHg (required), diastolic in mmHg (required), and notes (optional).
- **FR-004**: System MUST allow users to add blood glucose readings with: date/time (required), glucose level in mmol/L (required), and notes (optional).
- **FR-005**: System MUST allow users to add ketone readings with: date/time (required), ketone level in mmol/L (required), and notes (optional).
- **FR-006**: System MUST display history lists for each data type sorted by date (newest first) on the same page as the entry form.
- **FR-007**: System MUST persist all data to browser LocalStorage.
- **FR-008**: System MUST validate all inputs against defined ranges (see Validation Rules below).
- **FR-009**: System MUST provide navigation between three routes: `/cardio`, `/weight`, `/readings`.
- **FR-010**: Data model MUST support versioning to enable future schema migrations.

### Validation Rules

| Field | Valid Range | Unit |
|-------|-------------|------|
| Duration | 1 - 1440 | minutes |
| Distance | 0.01 - 1000 | km |
| Weight | 50 - 1000 | lbs |
| Blood Pressure (systolic) | 60 - 250 | mmHg |
| Blood Pressure (diastolic) | 40 - 150 | mmHg |
| Blood Glucose | 1.0 - 35.0 | mmol/L |
| Ketones | 0.0 - 10.0 | mmol/L |

Additional validation:
- Systolic MUST be greater than diastolic
- Notes field: maximum 500 characters

### Routing Structure

| Route | Content |
|-------|---------|
| `/` | Redirect to `/cardio` (or simple dashboard with nav links) |
| `/cardio` | Cardio entry form + cardio history list |
| `/weight` | Weight entry form + weight history list |
| `/readings` | Readings entry form (with type selector) + readings history list |

### Key Entities *(include if feature involves data)*

- **CardioSession**: Represents a single cardio workout (date, type, durationMinutes, distanceKm, notes, timestamps)
- **WeightEntry**: Represents a single weight measurement (date, weightLbs, notes, timestamps)
- **HealthReading**: Represents a health metric reading with discriminated union:
  - BloodPressure: systolic (mmHg), diastolic (mmHg)
  - BloodGlucose: glucoseMmol (mmol/L)
  - Ketone: ketoneMmol (mmol/L)
- **AppData**: Root container with schema version for migration support

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add any entry type in under 60 seconds from app launch.
- **SC-002**: History lists display within 1 second even with 1000+ entries per category.
- **SC-003**: All entered data persists across browser sessions (close and reopen browser).
- **SC-004**: Form validation prevents submission of invalid data with clear error messages showing the valid range.
- **SC-005**: Users can navigate between all views using keyboard only.
- **SC-006**: Adding a new data type in the future requires changes only to models and UI, not to storage infrastructure.

## Assumptions

- **Single user**: No authentication or multi-user support needed.
- **Local only**: No network connectivity, cloud sync, or data export required for MVP.
- **Modern browser**: App targets modern browsers with LocalStorage support (Chrome, Firefox, Safari, Edge).
- **Imperial weight, metric distance**: Weight in lbs, distance in km, glucose in mmol/L. No unit conversion.
- **No historical imports**: Users enter data manually; no bulk import functionality for MVP.
- **No data visualization**: MVP focuses on data entry and list views; charts/graphs are future enhancements.
- **No goals/targets**: Goal setting and progress tracking are future enhancements.
- **No combined history feed**: Each route shows only its own data type; no unified timeline view.

## Out of Scope (MVP)

- Edit/delete existing entries
- Combined/unified history view across all data types
- Unit conversions (mg/dL for glucose, kg for weight, miles for distance)
- Data export/import
- Charts and visualizations
- Goal tracking and progress indicators
