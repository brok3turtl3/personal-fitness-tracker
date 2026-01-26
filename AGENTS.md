# Personal Fitness Tracker Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-01-25

## Active Technologies

- TypeScript 5.x + Angular Router, Angular Forms (Reactive), RxJS (001-fitness-tracker-mvp)
- LocalStorage via StorageService abstraction (001-fitness-tracker-mvp)

## Project Structure

```text
src/
├── app/
│   ├── models/           # Shared domain interfaces
│   ├── services/         # Data services with tests
│   ├── features/         # Feature modules (cardio, weight, readings, dashboard)
│   └── shared/           # Shared UI components
└── tests/
```

## Commands

```bash
# Development
ng serve                              # Start dev server
ng test                               # Run unit tests
ng test --no-watch --code-coverage    # CI test with coverage
ng build --configuration=production   # Production build
ng lint                               # Lint (if configured)

# Code generation
ng generate service services/[name]   # New service with tests
ng generate component features/[feature]/[name] --standalone
```

## Code Style

TypeScript + Angular: Follow standard conventions
- Strict TypeScript (`strict: true`)
- Standalone components (no NgModules)
- Services for business logic, components for UI only
- RxJS with async pipe in templates

## Recent Changes

- 001-fitness-tracker-mvp: Added TypeScript 5.x + Angular 17+

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
