# Implementation Plan: Charts Dashboard

**Branch**: `004-charts` | **Date**: 2026-01-30 | **Spec**: [spec.md](./spec.md)

## Summary

Create a new `/charts` page that visualizes cardio, weight, and readings data over a selectable date range. Use Chart.js via `ng2-charts` for rendering.

## Dependencies

- Add `chart.js` and `ng2-charts` to `package.json`.

## UI/UX

- New nav link: Charts
- Page layout:
  - Top: Range selector (preset dropdown/radio + custom start/end date/time)
  - Sections:
    - Weight chart
    - Cardio chart (+ metric toggles)
    - Readings chart (reading type selector)

## Data + Filtering

- Load raw data using existing services:
  - `CardioService.getSessions()`
  - `WeightService.getEntries()`
  - `ReadingsService.getReadings()`
- Filter client-side by `[start, end]` inclusive using each item’s `date` (ISO string).
- Presets computed relative to `now`:
  - 30/90 days: `now - N days`
  - 6 months / 1 year: `now - N months/years` (calendar-based)
  - All time: no start/end filtering

## Architecture

- Add `src/app/features/charts/charts-page.component.ts` (standalone; lazy-loaded)
- Add a small utility for date ranges:
  - `src/app/shared/date-range.ts` (pure functions: compute presets, validate custom, filter)

## Routing

- Update `src/app/app.routes.ts` to lazy-load Charts page at `path: 'charts'`.
- Update `src/app/shared/nav.component.ts` to add Charts tab.

## Testing

- Unit test date range utilities and filtering behavior:
  - `src/app/shared/date-range.spec.ts`
- Keep Chart.js rendering itself untested (DOM/canvas heavy); validate dataset creation and filtering outputs.

## Styling

- Reuse existing global form/list/button styles.
- Add minimal chart container styles in the component.
