# Feature Specification: Printable Reports (PDF Export)

**Feature Branch**: `005-printable-reports`
**Created**: 2026-01-31
**Status**: Draft
**Input**: "Print data summaries and graphs for selected time frames. Well formatted in a PDF or similar."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Print/Save Report For Selected Range (Priority: P1)

As a user, I want to generate a printable report (summaries + charts) for a selected date range so that I can save it as a PDF or print it.

**Independent Test**: Go to `/charts`, pick a range, click Print/Export, and in the browser print dialog choose "Save as PDF".

**Acceptance Scenarios**:

1. **Given** I am viewing `/charts`, **When** I click Print/Export, **Then** a report view opens with the same selected date range and chart selections.
2. **Given** the report view is open, **When** I print/save as PDF, **Then** the PDF contains a title, the selected date range, generated timestamp, summary stats, and the charts.
3. **Given** the report view is open, **When** I click Back, **Then** I return to `/charts`.

---

### User Story 2 - Report Formatting (Priority: P1)

As a user, I want the exported report to be readable and well formatted.

**Acceptance Scenarios**:

1. **Given** I export the report, **Then** the nav and interactive controls are not printed.
2. **Given** I export the report, **Then** each chart section is kept together (avoid page breaks inside a chart where possible).
3. **Given** there is no data in range for a section, **Then** the report shows a clear empty-state message for that section.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-501**: App MUST provide a Print/Export action from `/charts`.
- **FR-502**: App MUST generate a dedicated report view (e.g. `/report`) suitable for printing.
- **FR-503**: Report MUST include summaries and charts for the selected time range.
- **FR-504**: Report MUST support the same date ranges as `/charts` (30d/90d/6m/1y/all/custom).

### Export Method

- **Default (recommended)**: Use the browser print dialog (user can "Save as PDF").
- **Optional future**: Programmatic PDF generation + download.

### Non-Functional Requirements

- **NFR-501**: Report rendering SHOULD be fast for typical personal datasets.
- **NFR-502**: No schema migration.

## Success Criteria *(mandatory)*

- **SC-501**: User can export a report for any supported range.
- **SC-502**: Report matches the chart selections at export time.
- **SC-503**: `ng test --no-watch` and `ng build --configuration=production` pass.

## Out of Scope

- Scheduled/email reports
- Multi-report batching
- Server-side PDF rendering
