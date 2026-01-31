# Implementation Plan: Printable Reports

**Branch**: `005-printable-reports` | **Date**: 2026-01-31 | **Spec**: [spec.md](./spec.md)

## Summary

Add a print-friendly report page that renders summaries + the existing charts for a selected date range. Expose a Print/Export button on `/charts`.

## Routing

- Add `path: 'report'` route to lazy-load a standalone report component.

## Data Flow

- Charts page builds a resolved range + selection state and passes it via query params to `/report`.
- Report page loads data via existing services, filters by the provided range, renders summary stats and charts.

Suggested query params:

- `startMs`, `endMs` (epoch milliseconds; omitted for all-time)
- `generatedAt` (ISO timestamp; for display)
- `readingType`
- `cardioShowDistance`, `cardioShowCalories`

## UI

- `/charts`: add "Print/Export" button.
- `/report`:
  - Header: title, date range, generated timestamp
  - Summary blocks: counts + totals/averages per dataset
  - Chart blocks: weight, cardio, readings
  - Actions: Print (calls `window.print()`), Back to charts

## Print Styling

- Add `@media print` rules (global) to:
  - hide nav + buttons/controls
  - remove drop shadows / background gray
  - avoid breaking inside chart blocks

## Testing

- Keep logic tests lightweight:
  - date-range tests already exist
  - add unit tests for report query parsing and summary calculations (pure functions)
