# Feature Specification: Cardio Session Calories

**Feature Branch**: `002-cardio-calories`
**Created**: 2026-01-30
**Status**: Draft
**Input**: User description: "On the cardio tab the user can enter the number of calories burned in the session."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log Calories Burned With Cardio Session (Priority: P1)

As a fitness tracker user, I want to record calories burned for a cardio session so that I can track training effort over time.

**Why this priority**: Calories are a common outcome metric for cardio sessions and help interpret duration/distance.

**Independent Test**: Navigate to `/cardio`, enter a session including calories, submit, and verify calories display in the history list and persist after refresh.

**Acceptance Scenarios**:

1. **Given** I navigate to `/cardio`, **When** I enter date/time, type, duration, calories burned, and submit, **Then** the session is saved and immediately appears in the history list showing calories burned.
2. **Given** I have existing sessions, **When** the cardio page loads, **Then** sessions without calories still render correctly (calories display is blank/omitted).
3. **Given** I am adding a cardio session, **When** I enter an invalid calories value (negative, non-numeric, or above the max), **Then** I see a validation error and cannot save until corrected.
4. **Given** I previously saved a session with calories, **When** I refresh the page, **Then** the calories value persists and is displayed for that session.

---

### Edge Cases

- Existing LocalStorage data predating this feature should load without errors.
- Clearing the calories field should be treated as "not provided" rather than zero unless the user explicitly enters 0.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-201**: System MUST allow users to optionally enter calories burned when logging a cardio session.
- **FR-202**: System MUST validate calories burned when provided.
- **FR-203**: System MUST persist calories burned with the cardio session via LocalStorage.
- **FR-204**: System MUST display calories burned in the cardio history list when present.
- **FR-205**: System MUST remain backward-compatible with existing stored sessions that do not include calories.

### Validation Rules

| Field | Valid Range | Required | Unit |
|-------|-------------|----------|------|
| Calories burned | 0 - 20000 | No | kcal |

## Success Criteria *(mandatory)*

- **SC-201**: User can add a cardio session with calories and see it in the history list immediately.
- **SC-202**: Calories persist across reloads.
- **SC-203**: Existing stored sessions without calories still load and display.
- **SC-204**: Unit tests cover validation and storage round-trip for calories.

## Out of Scope

- Automatic calorie estimation or calculation
- Edit/delete existing sessions
- Unit conversions or alternate energy units
