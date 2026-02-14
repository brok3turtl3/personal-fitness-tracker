# Personal Fitness Tracker

## Project Overview

Single-user local fitness tracking web app. Tracks cardio sessions, weight entries, health readings (blood pressure, blood glucose, ketones), diet/meals with nutrition, and provides charts and printable reports. All data persisted in browser LocalStorage with schema versioning for migrations.

## Tech Stack

- **Framework**: Angular 18 with standalone components (no NgModules)
- **Language**: TypeScript 5.5 with strict mode (`strict: true` in tsconfig.json)
- **Reactivity**: RxJS with async pipe in templates; Angular signals where applicable
- **Charts**: chart.js
- **Testing**: Jasmine + Karma (Angular defaults)
- **Styling**: Minimal custom CSS, semantic HTML, no CSS framework
- **Storage**: LocalStorage via `StorageService` abstraction layer
- **Build**: Angular CLI

## Commands

```bash
ng serve                              # Start dev server (http://localhost:4200)
ng test                               # Run unit tests (watch mode)
ng test --no-watch                    # Run unit tests once (CI)
ng test --no-watch --code-coverage    # Run tests with coverage report
ng build --configuration=production   # Production build
ng lint                               # Lint (if configured)
```

## Project Structure

```
src/app/
├── models/                  # Pure data interfaces (no logic)
│   ├── app-data.model.ts    # Root AppData container with schemaVersion
│   ├── cardio-session.model.ts
│   ├── weight-entry.model.ts
│   ├── health-reading.model.ts
│   ├── diet.model.ts        # SavedFood, MealItem, Meal, DailyDietLog
│   └── index.ts             # Barrel export
├── services/
│   ├── storage.service.ts   # LocalStorage abstraction (all data access goes through here)
│   ├── cardio.service.ts    # Cardio CRUD + validation
│   ├── weight.service.ts    # Weight CRUD + validation
│   ├── readings.service.ts  # Health readings CRUD + validation
│   ├── diet.service.ts      # Diet/meal CRUD + validation
│   ├── validators.ts        # Shared validation utilities
│   └── *.spec.ts            # Unit tests for each service
├── features/
│   ├── cardio/              # /cardio route — entry form + history list
│   ├── weight/              # /weight route — entry form + history list
│   ├── readings/            # /readings route — entry form + history list
│   ├── diet/                # /diet route — food library, meal logging, daily totals
│   ├── charts/              # /charts route — chart.js visualizations with date range filter
│   └── reports/             # /report route — print-friendly report view
├── shared/
│   ├── nav.component.ts     # Navigation bar
│   └── date-range.ts        # Shared date range utilities (+ spec)
├── app.component.ts         # Root component
├── app.config.ts            # App configuration
└── app.routes.ts            # Route definitions
```

## Architecture Patterns

### Storage Layer
- ALL data access goes through `StorageService` — never read/write LocalStorage directly
- `StorageService` manages a single `AppData` object under key `fitness_tracker_data`
- Operations return `Observable<T>` (async-ready for future backend migration)
- `AppData.schemaVersion` tracks the data format version; migrations run in sequence on load

### Service Pattern
- One domain service per data type (CardioService, WeightService, ReadingsService, DietService)
- Services are `@Injectable({ providedIn: 'root' })`
- Services handle validation, ID generation (`crypto.randomUUID()`), timestamps, and delegate persistence to `StorageService`
- Services sort results by date descending (newest first)

### Validation Pattern
- Validation functions live in `validators.ts` (shared) and within each domain service
- Validation runs before persistence; invalid data throws errors
- Key ranges: duration 1-1440 min, distance 0.01-1000 km, weight 50-1000 lbs, systolic 60-250, diastolic 40-150, glucose 1.0-35.0 mmol/L, ketones 0.0-10.0 mmol/L, calories 0-20000 kcal
- Blood pressure: systolic must be > diastolic
- Notes: max 500 characters
- Net carbs = max(0, carbs - fiber)

### Component Pattern
- Standalone components only (no NgModules)
- Components handle UI rendering and user interaction only — delegate business logic to services
- Reactive patterns: use RxJS + async pipe in templates

### Data Model Conventions
- All entities have `id` (UUID v4), `createdAt`, `updatedAt` (ISO 8601 strings)
- Dates stored as ISO 8601 strings for JSON serialization
- HealthReading uses discriminated union on `type` field (`'blood_pressure'` | `'blood_glucose'` | `'ketone'`)
- Optional fields use `?` — never store `null` for "not provided"
- Diet meal items store nutrition snapshots at log time (immutable after logging)

## Coding Conventions

1. **Strict TypeScript**: No `any` except when interfacing with untyped third-party libs (document with `// TODO: type when lib supports it`)
2. **Clean separation**: Models = pure interfaces in `models/`, services = business logic in `services/`, components = UI only
3. **No circular dependencies**: Use dependency inversion when needed
4. **Function over form**: Working functionality before visual polish
5. **Unit tests required**: Every service must have a `.spec.ts` file; mock external dependencies (storage, timers); tests must be independent and order-agnostic
6. **Accessibility basics**: Semantic HTML (`<button>`, `<nav>`, `<main>`, `<form>`), all inputs have `<label>` or `aria-label`, keyboard navigable, color is never the only state indicator
7. **Commit format**: `<type>(<scope>): <description>` — types: feat, fix, refactor, test, docs, chore

## Adding a New Feature

1. **Model**: Add/extend interfaces in `src/app/models/` and update `index.ts` barrel export
2. **Schema migration** (if changing AppData shape): Bump `CURRENT_SCHEMA_VERSION` in `storage.service.ts`, add a `migrateVxToVy()` function that runs in sequence during `initialize()`
3. **Service**: Create domain service in `src/app/services/` with validation, CRUD, and tests
4. **Component**: Create standalone component in `src/app/features/<name>/`
5. **Route**: Add route in `app.routes.ts`, add nav link in `nav.component.ts`
6. **Verify**: `ng test --no-watch` passes, `ng build --configuration=production` succeeds

### Schema Migration Checklist
- Existing stored data without new fields must load without errors (backward compatibility)
- New optional fields default to `undefined`, not `null`
- Migration function transforms old shape to new shape
- Add a test for the migration path

## What NOT To Do

- Do NOT access LocalStorage directly from components or services other than `StorageService`
- Do NOT use NgModules — all components must be standalone
- Do NOT put business logic in components — delegate to services
- Do NOT use `any` type without documented justification
- Do NOT store `null` for absent optional fields — use `undefined` / omit the field
- Do NOT skip unit tests for new services or validators
- Do NOT break backward compatibility with existing stored data without a migration

## Known Limitations

- **LocalStorage only**: ~5 MB limit; sufficient for ~50 years of typical use but no cloud sync
- **Single user**: No authentication or multi-user support
- **No data import/export**: Manual entry only (except future enhancements)
- **Imperial weight, metric distance**: Weight in lbs, distance in km, glucose/ketones in mmol/L — no unit conversion
- **Last-write-wins**: Concurrent tabs may overwrite each other
- **Browser data clearing**: If user clears browser data, all fitness data is lost

## Reference Documentation

Design-phase documentation is preserved in `docs/` for reference. **The TypeScript source code is the authoritative source of truth** — docs may be outdated.
