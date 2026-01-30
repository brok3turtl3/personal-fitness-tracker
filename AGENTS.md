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
## Feature Development Workflow (Spec Kit)

Use this process for each new feature after the MVP.

### 1) Branch

```bash
git checkout main
git pull
git checkout -b 00X-feature-slug
```

### 2) Spec Folder

Create a new folder: `specs/00X-feature-slug/`

Minimum recommended files:

- `specs/00X-feature-slug/spec.md` (scope + acceptance criteria)
- `specs/00X-feature-slug/plan.md` (files/modules impacted; approach)
- `specs/00X-feature-slug/tasks.md` (ordered steps; maps cleanly to commits)

Common optional files:

- `specs/00X-feature-slug/data-model.md` (model/storage shape changes)
- `specs/00X-feature-slug/contracts/*.contract.md` (service boundaries)
- `specs/00X-feature-slug/quickstart.md` (manual verification steps)

### 3) Spec “Ready To Implement” Checklist

- Acceptance criteria are concrete and testable
- Validation rules (ranges/required/optional) are explicit
- Backward compatibility/migration notes are included (LocalStorage)
- `tasks.md` is small-step and names exact file paths

### 4) Implement

Run the same Spec Kit workflow used for MVP:

```text
/specify implement specs/00X-feature-slug/spec.md
```

(If the repo’s Spec Kit entrypoint differs, follow the pattern used by the last completed feature in `specs/`.)

### 5) Verify

```bash
ng test --no-watch
ng build --configuration=production
```

### 6) Commit

Prefer one feature-focused commit (or a small series of commits if the change is larger).

```bash
git add -A
git commit
```

### 7) Merge + Cleanup

```bash
git checkout main
git pull
git merge 00X-feature-slug
git push origin main
git branch -d 00X-feature-slug
```

<!-- MANUAL ADDITIONS END -->
