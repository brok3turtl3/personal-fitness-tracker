# Implementation Plan: Personal Fitness Tracker MVP

**Branch**: `001-fitness-tracker-mvp` | **Date**: 2025-01-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-fitness-tracker-mvp/spec.md`

## Summary

Build a local-first personal fitness tracking Angular web application that allows a single user to log and view cardio sessions, weight entries, and health readings (blood pressure, blood glucose, ketones). Data persists via LocalStorage through an abstraction layer designed for future migration to SQLite, Supabase, or a Go API backend.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled
**Framework**: Angular 17+ with standalone components
**Primary Dependencies**: Angular Router, Angular Forms (Reactive), RxJS
**Storage**: LocalStorage via StorageService abstraction (MVP); designed for future IndexedDB/API migration
**Testing**: Jasmine + Karma (Angular CLI defaults)
**Target Platform**: Modern web browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: Single frontend web application (no backend for MVP)
**Performance Goals**: <1 second list render with 1000+ entries; <60 second entry workflow
**Constraints**: Offline-capable (local storage only), single user, no authentication
**Scale/Scope**: Single user, 3 main views (cardio, weight, readings) - each with form + history list

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. Type-Safe Angular | Strict TypeScript, standalone components, no `any` | PASS | Angular 17+ with strict mode specified |
| II. Clean Architecture | Models/Services/Components separation | PASS | Feature folders with shared models and data service layer |
| III. Function Over Form | Functionality before styling | PASS | Minimal libraries, simple routing, basic UI |
| IV. Extensible Data Model | StorageService abstraction, versioned schema | PASS | LocalStorage via abstraction for future migration |
| V. Core Testing | Unit tests for services | PASS | Basic unit tests for storage and domain services specified |
| VI. Accessibility Basics | Semantic HTML, keyboard nav | PASS | Will use standard Angular form controls |

**Gate Status**: PASSED - All constitution principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/001-fitness-tracker-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (internal service contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── app.component.ts          # Root component
│   ├── app.config.ts             # App configuration
│   ├── app.routes.ts             # Route definitions
│   │
│   ├── models/                   # Shared domain models
│   │   ├── cardio-session.model.ts
│   │   ├── weight-entry.model.ts
│   │   ├── health-reading.model.ts
│   │   └── app-data.model.ts     # Root container with schema version
│   │
│   ├── services/                 # Shared services
│   │   ├── storage.service.ts    # LocalStorage abstraction
│   │   ├── storage.service.spec.ts
│   │   ├── cardio.service.ts
│   │   ├── cardio.service.spec.ts
│   │   ├── weight.service.ts
│   │   ├── weight.service.spec.ts
│   │   ├── readings.service.ts
│   │   └── readings.service.spec.ts
│   │
│   ├── features/                 # Feature modules (standalone components)
│   │   ├── cardio/
│   │   │   └── cardio-page.component.ts    # Form + history list combined
│   │   │
│   │   ├── weight/
│   │   │   └── weight-page.component.ts    # Form + history list combined
│   │   │
│   │   └── readings/
│   │       └── readings-page.component.ts  # Form + history list combined
│   │
│   └── shared/                   # Shared UI components
│       ├── nav.component.ts
│       └── entry-list.component.ts
│
├── assets/
├── environments/
├── index.html
├── main.ts
└── styles.css
```

**Structure Decision**: Single Angular application with feature folders. Each feature (cardio, weight, readings) has a single page component containing both the entry form and history list. Routes: `/cardio`, `/weight`, `/readings` (root redirects to `/cardio`). Shared domain models live in `models/`, and the storage abstraction layer in `services/` enables future backend migration without touching feature code.

## Complexity Tracking

> No constitution violations - no complexity justifications needed.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
