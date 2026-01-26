<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Modified principles: None
Added sections:
  - Workflow & Checkpoints (new section under Development Workflow)
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (no changes needed - Constitution Check is generic)
  - .specify/templates/spec-template.md ✅ (no changes needed - already aligned)
  - .specify/templates/tasks-template.md ✅ (no changes needed - supports incremental delivery)
Follow-up TODOs: None
-->

# Personal Fitness Tracker Constitution

## Core Principles

### I. Type-Safe Angular

All code MUST adhere to Angular best practices and strict TypeScript standards:

- TypeScript strict mode MUST be enabled (`strict: true` in tsconfig.json)
- No use of `any` type except when interfacing with untyped third-party libraries
  (must be documented with `// TODO: type when lib supports it`)
- Angular signals SHOULD be preferred over traditional change detection where applicable
- Standalone components MUST be used (no NgModules for new components)
- Reactive patterns using RxJS MUST follow the async pipe pattern in templates

**Rationale**: Type safety catches errors at compile time, reduces runtime bugs, and
improves IDE support for refactoring.

### II. Clean Architecture

Code MUST follow separation of concerns with clear boundaries:

- **Models**: Pure data interfaces/types in `src/app/models/`
- **Services**: Business logic and data access in `src/app/services/`
- **Components**: UI rendering and user interaction only
- Components MUST NOT contain business logic; delegate to services
- Services MUST be injectable and stateless where possible (state in dedicated state services)
- Circular dependencies are forbidden; use dependency inversion when needed

**Rationale**: Clean architecture enables independent testing, easier maintenance, and
supports future migration to different storage or API backends.

### III. Function Over Form

Development MUST prioritize working functionality over visual polish:

- Features MUST be fully functional before any styling beyond basic usability
- Use Angular Material or native HTML controls for MVP; custom styling is deferred
- No CSS frameworks or complex theming until core features are complete
- UI feedback (loading states, error messages) MUST be present but MAY be unstyled
- Performance optimization comes after correctness

**Rationale**: A working product with plain UI delivers value; a beautiful product that
doesn't work delivers nothing.

### IV. Extensible Data Model

Data persistence MUST use LocalStorage for MVP while maintaining extensibility:

- All data access MUST go through a dedicated `StorageService` abstraction
- Data models MUST be versioned (include a `schemaVersion` field)
- Storage operations MUST be async-ready (return Observables/Promises) even if
  LocalStorage is synchronous, to ease future migration
- Data shape MUST support future expansion (use optional fields, avoid rigid structures)
- Migration utilities MUST exist for schema version upgrades

**Rationale**: LocalStorage provides zero-setup persistence for MVP while the abstraction
layer ensures painless migration to IndexedDB, backend API, or cloud sync later.

### V. Core Testing

Unit tests are REQUIRED for all core services and utilities:

- Every service in `src/app/services/` MUST have corresponding `.spec.ts` file
- Utility functions MUST have unit tests covering edge cases
- Test coverage for services SHOULD target >80% line coverage
- Tests MUST be independent and not rely on execution order
- Mock external dependencies (storage, timers) in unit tests
- Integration/E2E tests are OPTIONAL for MVP but encouraged for critical user flows

**Rationale**: Core services contain business logic that, if broken, breaks the entire
application. Tests ensure refactoring safety and catch regressions early.

### VI. Accessibility Basics

All UI MUST meet basic accessibility standards:

- Semantic HTML elements MUST be used (`<button>`, `<nav>`, `<main>`, `<form>`, etc.)
- All form inputs MUST have associated `<label>` elements or `aria-label` attributes
- Interactive elements MUST be keyboard-navigable (logical tab order, Enter/Space activation)
- Color MUST NOT be the only indicator of state (add icons, text, or patterns)
- Images MUST have `alt` attributes (empty string for decorative images)

**Rationale**: Accessibility benefits all users (keyboard users, screen reader users,
users with motor impairments) and is easier to build in from the start than retrofit.

## Technology Constraints

- **Framework**: Angular 17+ with standalone components
- **Language**: TypeScript 5.x with strict mode enabled
- **Storage**: LocalStorage via abstraction layer (MVP); IndexedDB or API (future)
- **Testing**: Jasmine + Karma (Angular defaults) or Jest if configured
- **Styling**: Angular Material for components; minimal custom CSS
- **Build**: Angular CLI (`ng build`, `ng serve`, `ng test`)

## Development Workflow

### Incremental Delivery

All development MUST follow small, incremental commits:

- Each commit SHOULD represent a single logical change
- Commits MUST leave the codebase in a buildable state (`ng build` must pass)
- Feature branches SHOULD be merged frequently (avoid long-lived branches)
- Work-in-progress commits are acceptable but MUST be squashed before merge

### Workflow & Checkpoints

Implementation MUST proceed in small, verifiable increments with explicit user approval:

**Increment Scope**:
- Implement one task at a time, OR one sub-step within a user story (model → service → UI → test)
- Never bundle multiple unrelated changes into a single increment
- Each increment MUST be independently verifiable

**Checkpoint Protocol**:
After completing each increment, STOP and present:
1. **Files changed**: List all files created, modified, or deleted
2. **Commands run**: List any CLI commands executed (e.g., `ng generate`, `ng test`)
3. **Manual verification**: Provide clear steps for the user to verify the change works

**User Approval**:
- WAIT for explicit user approval before proceeding to the next increment
- If user requests changes, address them before continuing
- Never assume approval; always pause at checkpoints

**Git Commit Policy**:
- NEVER run `git commit` automatically unless explicitly instructed by the user
- At each checkpoint, SUGGEST a conventional commit message but do not execute it
- Commit message format: `<type>(<scope>): <description>`
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
  - Scope: feature area (e.g., `cardio`, `storage`, `models`)
  - Example: `feat(storage): implement StorageService with LocalStorage backend`

**Rationale**: Incremental checkpoints give the user visibility and control over the
implementation process, catch issues early, and maintain a clean git history.

### Code Quality Gates

Before any merge to main:

1. `ng build --configuration=production` MUST succeed
2. `ng test --no-watch --code-coverage` MUST pass
3. `ng lint` MUST pass (if configured)
4. New services MUST have corresponding unit tests

## Governance

This constitution governs all development decisions for the Personal Fitness Tracker
project. It supersedes informal practices and ad-hoc decisions.

### Amendment Procedure

1. Propose amendment with rationale in a dedicated PR
2. Document impact on existing code/patterns
3. Update constitution version according to semantic versioning:
   - **MAJOR**: Removal or incompatible redefinition of principles
   - **MINOR**: New principles or materially expanded guidance
   - **PATCH**: Clarifications, typo fixes, non-semantic refinements
4. Update `LAST_AMENDED_DATE` to amendment date

### Compliance Review

- All PRs SHOULD be reviewed against constitution principles
- Plan documents MUST include a "Constitution Check" section
- Violations require documented justification in the Complexity Tracking section

**Version**: 1.1.0 | **Ratified**: 2025-01-25 | **Last Amended**: 2025-01-25
