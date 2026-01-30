# Implementation Plan: Delete Entries

**Branch**: `003-delete-entries` | **Date**: 2026-01-30 | **Spec**: [spec.md](./spec.md)

## Summary

Add delete operations for cardio sessions, weight entries, and health readings. Expose delete controls on each page’s history list with a confirmation prompt. Persist removals through `StorageService.saveData`.

## Technical Approach

### Service Layer

- Add delete methods:
  - `CardioService.deleteSession(id: string): Observable<boolean>`
  - `WeightService.deleteEntry(id: string): Observable<boolean>`
  - `ReadingsService.deleteReading(id: string): Observable<boolean>`

Behavior:
- If the item exists: remove it from the relevant array and call `StorageService.saveData(...)`.
- If the item does not exist: return `false` and do not write.
- If storage is uninitialized: throw an error (matches existing add flows).

### UI

- Add a Delete button to each history item on:
  - `src/app/features/cardio/cardio-page.component.ts`
  - `src/app/features/weight/weight-page.component.ts`
  - `src/app/features/readings/readings-page.component.ts`

- Use `window.confirm(...)` for confirmation (simple, accessible, no new components).
- On successful delete, reload list from the service.

### Tests

- Add unit tests for deletion to:
  - `src/app/services/cardio.service.spec.ts`
  - `src/app/services/weight.service.spec.ts`
  - `src/app/services/readings.service.spec.ts`

### Styling

- Add a minimal `.btn-danger` variant (global) for delete actions.

## Data Model / Migration

- No schema version bump: deletes only remove items.
