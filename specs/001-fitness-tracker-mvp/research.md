# Research: Personal Fitness Tracker MVP

**Feature**: 001-fitness-tracker-mvp
**Date**: 2025-01-25

## Technology Decisions

### 1. Frontend Framework: Angular 17+

**Decision**: Use Angular 17+ with standalone components

**Rationale**:
- User requirement specifies Angular with standalone components
- Angular 17+ provides improved performance with signals and control flow
- Standalone components simplify the application structure (no NgModules)
- Built-in support for reactive forms, routing, and dependency injection

**Alternatives Considered**:
- NgModules-based architecture: Rejected due to added complexity and user preference for standalone
- React/Vue: Not considered - user specified Angular

### 2. State Management: Service-Based with RxJS

**Decision**: Use injectable services with BehaviorSubjects for state management

**Rationale**:
- Simple and sufficient for single-user local application
- No need for NgRx or complex state management libraries
- Services can expose Observables for reactive UI updates
- Easy to test with dependency injection

**Alternatives Considered**:
- NgRx: Overkill for MVP scope with single user and no complex async flows
- Signals only: Could work but RxJS provides better async composition for storage operations

### 3. Storage Abstraction: LocalStorage with Service Layer

**Decision**: Implement `StorageService` interface that wraps LocalStorage, returning Observables

**Rationale**:
- User requirement: "LocalStorage via a storage abstraction so we can later swap in SQLite/Supabase/Go API"
- Async interface (Observable/Promise) enables seamless migration to IndexedDB, HTTP APIs, or other backends
- Single point of change when storage backend evolves
- Testable with mock implementations

**Implementation Pattern**:
```typescript
interface StorageService {
  get<T>(key: string): Observable<T | null>;
  set<T>(key: string, value: T): Observable<void>;
  delete(key: string): Observable<void>;
  clear(): Observable<void>;
}
```

**Alternatives Considered**:
- Direct LocalStorage access: Rejected - violates extensibility principle
- IndexedDB for MVP: Rejected - adds complexity without immediate benefit

### 4. Application Structure: Feature Folders

**Decision**: Organize code by feature (cardio, weight, readings) with shared models and services

**Rationale**:
- User requirement: "feature folders (cardio, weight, readings), shared domain models, and a data service layer"
- Clear boundaries make it easy to add new data types later
- Each feature is self-contained with its own routes and components
- Shared services provide cross-cutting functionality

**Structure Pattern**:
```
features/
  cardio/       # Cardio-specific components and routes
  weight/       # Weight-specific components and routes
  readings/     # Readings-specific components and routes
models/         # Shared domain interfaces
services/       # Shared data services
```

### 5. Routing: Angular Router with Lazy Loading

**Decision**: Simple flat routing structure with optional lazy loading per feature

**Rationale**:
- User requirement: "simple routing"
- ~5 views don't require complex nested routing
- Lazy loading can be added later if bundle size becomes a concern

**Route Structure**:
- `/` - Dashboard (summary view)
- `/cardio` - Cardio list
- `/cardio/new` - Add cardio session
- `/weight` - Weight list
- `/weight/new` - Add weight entry
- `/readings` - Readings list
- `/readings/new` - Add health reading

### 6. Forms: Reactive Forms with Validation

**Decision**: Use Angular Reactive Forms for all data entry

**Rationale**:
- Type-safe form definitions align with TypeScript strict mode
- Built-in validation support
- Easy to unit test form logic
- Better control over form state

**Alternatives Considered**:
- Template-driven forms: Less type-safe and harder to test

### 7. Testing Strategy: Jasmine/Karma for Unit Tests

**Decision**: Focus unit tests on storage service and domain services

**Rationale**:
- User requirement: "basic unit tests for storage and domain services"
- Services contain critical business logic
- Components are simple wrappers - can add E2E tests later if needed
- Angular CLI defaults to Jasmine/Karma

**Test Coverage Focus**:
1. `StorageService` - CRUD operations, error handling, schema versioning
2. `CardioService` - Add/list cardio sessions, validation
3. `WeightService` - Add/list weight entries, validation
4. `ReadingsService` - Add/list readings by type, validation

## Best Practices for This Domain

### LocalStorage Best Practices

1. **Key Naming**: Use namespaced keys (e.g., `fitness_tracker_v1_cardio`)
2. **Data Structure**: Store as single JSON object per entity type for atomic updates
3. **Size Limits**: Monitor usage (typically 5-10MB limit per origin)
4. **Error Handling**: Gracefully handle QuotaExceededError
5. **Schema Version**: Include version field for future migrations

### Angular Standalone Component Best Practices

1. **Imports**: Explicitly import all dependencies in component decorator
2. **Providers**: Provide services at root level for singletons
3. **Routing**: Use `loadComponent` for route definitions
4. **Signals**: Use signals for component state, RxJS for async operations

### Health Data Validation Ranges

| Metric | Normal Range | Valid Range (allow logging) |
|--------|--------------|----------------------------|
| Weight (kg) | 40-150 | 1-500 |
| Weight (lbs) | 90-330 | 1-1100 |
| Blood Pressure Systolic | 90-120 | 50-250 |
| Blood Pressure Diastolic | 60-80 | 30-150 |
| Blood Glucose (mg/dL) | 70-140 | 20-600 |
| Ketones (mmol/L) | 0.5-3.0 | 0-10 |

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| Which Angular version? | Angular 17+ (user specified) |
| NgModules or standalone? | Standalone (user specified) |
| State management library? | None - service-based with RxJS |
| How to handle units? | Store unit with value, no auto-conversion for MVP |
| Delete/edit entries? | Out of scope for MVP (add-only, view history) |
