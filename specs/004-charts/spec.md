# Feature Specification: Charts Dashboard

**Feature Branch**: `004-charts`
**Created**: 2026-01-30
**Status**: Draft
**Input**: User request: "Provide graphical representation of the data. User can select date ranges (30/90 days, 6 months, 1 year, all time, custom). Graphs on a separate tab."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Charts On Dedicated Tab (Priority: P1)

As a fitness tracker user, I want a dedicated Charts tab so that I can visualize my tracked data.

**Independent Test**: Navigate to `/charts` and verify charts render (or empty-state if no data).

**Acceptance Scenarios**:

1. **Given** I open the app, **When** I click the Charts tab, **Then** I am routed to `/charts`.
2. **Given** I have no saved data, **When** I view `/charts`, **Then** I see an empty-state message for each chart (no errors).

---

### User Story 2 - Filter By Date Range (Priority: P1)

As a user, I want to filter charts by date range so that I can focus on recent trends.

**Supported ranges**:
- Last 30 days
- Last 90 days
- Last 6 months
- Last 1 year
- All time
- Custom (start date/time + end date/time)

**Acceptance Scenarios**:

1. **Given** I am on `/charts`, **When** I select a preset range, **Then** all charts update to show only entries within that range.
2. **Given** I select Custom, **When** I enter a valid start and end date/time, **Then** all charts update to that range.
3. **Given** I am using Custom, **When** start is after end, **Then** I see a validation error and charts do not update.
4. **Given** I select All time, **When** charts render, **Then** they include all entries.

---

### User Story 3 - Appropriate Chart Types Per Data (Priority: P1)

As a user, I want each dataset visualized appropriately so that it is easy to interpret.

**Proposed charts**:
- Weight: line chart of `weightLbs` over time
- Cardio: line chart of `durationMinutes` over time with optional toggles for `distanceKm` and `caloriesBurned`
- Readings: line charts by type:
  - Blood pressure: two lines (`systolic`, `diastolic`)
  - Blood glucose: line (`glucoseMmol`)
  - Ketones: line (`ketoneMmol`)

**Acceptance Scenarios**:

1. **Given** I have weight entries in range, **When** I view the Weight chart, **Then** the line reflects my entry values ordered by date.
2. **Given** I have cardio sessions in range, **When** I view the Cardio chart, **Then** it visualizes duration over time.
3. **Given** I have readings in range, **When** I view the Readings section, **Then** I can switch reading type and see the correct chart.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-401**: App MUST add a new `/charts` route and navigation link.
- **FR-402**: Charts MUST be filtered by a selectable date range (presets + custom).
- **FR-403**: Charts MUST be based on the existing persisted data (LocalStorage) via existing services.
- **FR-404**: App MUST not require a schema migration for this feature.

### Non-Functional Requirements

- **NFR-401**: Charts page MUST load quickly for typical personal datasets (hundreds of points).
- **NFR-402**: If there is no data in range, show a friendly empty-state instead of an empty chart.

### Accessibility Requirements

- Range selector MUST be keyboard accessible.
- Custom range inputs MUST have labels and inline validation.

## Success Criteria *(mandatory)*

- **SC-401**: `/charts` renders at least one chart for each dataset when data exists.
- **SC-402**: Preset and custom ranges correctly filter all charts.
- **SC-403**: `ng test --no-watch` and `ng build --configuration=production` pass.

## Out of Scope

- Exporting charts/images
- Aggregation controls (daily/weekly/monthly bucketing)
- Editing data from charts
