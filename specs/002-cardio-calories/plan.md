# Implementation Plan: Cardio Session Calories

**Branch**: `002-cardio-calories` | **Date**: 2026-01-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-cardio-calories/spec.md`

## Summary

Add an optional `caloriesBurned` field to cardio sessions. Update the Cardio data model, validators, CardioService, and the `/cardio` page form + history display. Maintain backwards compatibility with existing LocalStorage data.

## Technical Context

**Language/Version**: TypeScript (strict)
**Framework**: Angular (standalone components)
**Storage**: LocalStorage via `StorageService`
**Testing**: Jasmine + Karma

## Constitution Check

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. Type-Safe Angular | Strict TypeScript, no `any` | PASS | New field is optional and typed |
| II. Clean Architecture | Models/Services/Components separation | PASS | Change spans model, validator/service, and UI |
| III. Function Over Form | Functionality before styling | PASS | Minimal UI changes |
| IV. Extensible Data Model | Backward compatible | PASS | Optional field, no breaking migration |
| V. Core Testing | Unit tests for services/validators | PASS | Extend existing specs |

## Proposed Changes

### Data Model

- Update `src/app/models/cardio-session.model.ts`:
  - Add `caloriesBurned?: number` to `CardioSession`.

### Validation

- Update `src/app/services/validators.ts`:
  - When calories are provided, validate finite number within `0..20000`.
  - Treat empty input as `undefined` (not zero).
- Update `src/app/services/validators.spec.ts` for new validation cases.

### Service Layer

- Update `src/app/services/cardio.service.ts`:
  - Accept and persist `caloriesBurned`.
  - Ensure stored sessions can omit `caloriesBurned` without errors.
- Update `src/app/services/cardio.service.spec.ts` for round-trip persistence and sorting unaffected.

### UI (Cardio Page)

- Update `src/app/features/cardio/cardio-page.component.ts`:
  - Add a numeric input for calories burned (`kcal`) to the reactive form.
  - Display calories in the history list when present.
  - Add validation messaging consistent with existing fields.

## Migration Strategy

- No schema version bump required because the new field is optional.
- Sessions loaded from storage without `caloriesBurned` should be treated as `undefined`.
