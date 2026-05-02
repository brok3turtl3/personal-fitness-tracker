# Coding Conventions

**Analysis Date:** 2026-05-02

## Naming Patterns

**Files:**
- Components: `<feature>-page.component.ts` (e.g., `cardio-page.component.ts`, `weight-page.component.ts`, `chat-message-list.component.ts`)
- Services: `<domain>.service.ts` (e.g., `cardio.service.ts`, `storage.service.ts`, `ai-settings.service.ts`)
- Models: `<entity>.model.ts` (e.g., `cardio-session.model.ts`, `app-data.model.ts`, `health-reading.model.ts`)
- Specs: co-located `<source>.spec.ts` (e.g., `cardio.service.spec.ts`, `validators.spec.ts`)
- Shared utilities: kebab-case file name (`date-range.ts`, `nav.component.ts`)
- Barrel exports: `index.ts` (only used in `src/app/models/index.ts`)
- All file/directory names use kebab-case; no PascalCase or snake_case file names

**Selectors (Angular components):**
- Prefix `app-` followed by kebab-case feature name (e.g., `app-cardio-page`, `app-nav`, `app-chat-input`)
- Set on the project via `angular.json` `prefix: "app"`

**Classes:**
- PascalCase: `CardioService`, `StorageService`, `CardioPageComponent`, `NavComponent`
- Custom errors suffix `Error`: `CardioValidationError`, `WeightValidationError`, `ReadingsValidationError`, `DietValidationError`, `StorageError`, `AnthropicApiError` (`src/app/services/cardio.service.ts:10`, `src/app/services/storage.service.ts:32`, `src/app/services/anthropic-api.service.ts:36`)

**Interfaces & Types:**
- PascalCase, no `I` prefix: `CardioSession`, `AppData`, `ValidationResult`, `StorageInfo`, `NutritionTotals`
- Pair the stored entity with a "create" interface that omits system fields: `CardioSession` + `CreateCardioSession`, `WeightEntry` + `CreateWeightEntry`, `BloodPressureReading` + `CreateBloodPressure` (`src/app/models/cardio-session.model.ts:16`, `src/app/models/cardio-session.model.ts:49`)
- Discriminated unions use lowercase string literal `type` field: `'blood_pressure' | 'blood_glucose' | 'ketone'` (`src/app/models/health-reading.model.ts`)
- Constants in SCREAMING_SNAKE_CASE: `VALIDATION_LIMITS`, `CARDIO_TYPES`, `STORAGE_KEY`, `CURRENT_SCHEMA_VERSION`, `DEFAULT_AI_SETTINGS` (`src/app/services/validators.ts:56`, `src/app/models/app-data.model.ts:41`)

**Functions / Methods:**
- camelCase verbs: `addSession`, `getSessions`, `deleteSession`, `validateCardio`, `migrateV0ToV1`, `generateUUID`
- Validation functions are top-level `validate<Domain>` exports in `src/app/services/validators.ts` (e.g., `validateCardio`, `validateWeight`, `validateBloodPressure`, `validateGlucose`, `validateKetone`)
- ID generation uses local `generateUUID()` helper duplicated in each domain service (`src/app/services/cardio.service.ts:24`, `src/app/services/weight.service.ts:24`, `src/app/services/readings.service.ts:38`, `src/app/services/diet.service.ts:26`, `src/app/services/chat.service.ts:13`)

**Variables:**
- camelCase: `cardioSessions`, `weightEntries`, `submitError`, `isSubmitting`, `mockAppData`
- Boolean state flags prefixed with `is`/`has`: `isSubmitting`, `isDeleting`, `isLocalStorageAvailable`
- Private class fields use `private` keyword (no `_` prefix or `#`): `private storageService: StorageService` (`src/app/services/cardio.service.ts:40`)
- Units encoded into property names: `durationMinutes`, `distanceKm`, `weightLbs`, `glucoseMmol`, `ketoneMmol`, `caloriesKcal`, `sodiumMg`, `gramsPerTbsp` (`src/app/models/cardio-session.model.ts:27`, `src/app/models/diet.model.ts:6`)

## Code Style

**Formatting:**
- `.editorconfig` is the only formatting source (no Prettier or ESLint config in repo)
- 2-space indentation, UTF-8 charset, final newline, trim trailing whitespace
- TypeScript: single quotes (`quote_type = single` in `.editorconfig`)
- Markdown: trailing whitespace and line length unrestricted

**Linting:**
- No ESLint config detected (no `.eslintrc*` or `eslint.config.*` files); `ng lint` is unconfigured
- `tsc` strict mode is the de facto linter

**TypeScript compiler strictness (`tsconfig.json`):**
- `strict: true`
- `noImplicitOverride: true` (subclass overrides must use `override`)
- `noPropertyAccessFromIndexSignature: true` (forces bracket access on `Record<string, ...>` types — see `src/app/services/anthropic-api.service.ts:82`)
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`
- Angular compiler: `strictTemplates: true`, `strictInjectionParameters: true`, `strictInputAccessModifiers: true`
- Target/module: `ES2022`; `moduleResolution: "bundler"`

## Import Organization

**Order observed across services and components:**
1. Angular core / common (`@angular/core`, `@angular/common`, `@angular/forms`, `@angular/router`)
2. Third-party libraries (`rxjs`, `chart.js`, `ng2-charts`)
3. Local services (`./storage.service`, `./validators`)
4. Local models with relative path (`../models/cardio-session.model`)

**Patterns:**
- All imports use single quotes and named imports
- Relative paths only — no path aliases configured in `tsconfig.json` `paths`
- `rxjs` operators imported by name from the root: `import { Observable, map, of, switchMap, throwError } from 'rxjs'` (`src/app/services/cardio.service.ts:2`)
- Models imported from individual files (e.g., `../models/cardio-session.model`); the `models/index.ts` barrel exists but is not heavily used

## Architectural Patterns

**Standalone components (no NgModules):**
- All components declare `standalone: true` and list their dependencies in `imports: []`
- Example pattern (`src/app/app.component.ts:5`):
  ```typescript
  @Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, NavComponent],
    templateUrl: './app.component.html'
  })
  ```
- Routes use `loadComponent` for lazy loading (`src/app/app.routes.ts:7`):
  ```typescript
  { path: 'cardio', loadComponent: () => import('./features/cardio/cardio-page.component').then(m => m.CardioPageComponent) }
  ```

**Service pattern — one domain service per data type:**
- Every service is `@Injectable({ providedIn: 'root' })` (singleton, tree-shakable)
- Services in `src/app/services/`: `StorageService`, `CardioService`, `WeightService`, `ReadingsService`, `DietService`, `ChatService`, `AISettingsService`, `FitnessContextService`, `AnthropicApiService`
- Services own validation, ID generation, timestamping, sorting; persistence is delegated to `StorageService`
- ALL data access goes through `StorageService`; no other code reads/writes `localStorage` directly
- All public methods return `Observable<T>` even when synchronous (forward-compatible with backend swap):
  ```typescript
  getSessions(): Observable<CardioSession[]>
  addSession(sessionData: CreateCardioSession): Observable<CardioSession>
  deleteSession(id: string): Observable<boolean>
  ```
- Standard CRUD shape (`src/app/services/cardio.service.ts:45`): `getData() -> map/switchMap -> saveData()`

**Reactive patterns:**
- Components subscribe to service observables in `ngOnInit` and store the result in a class field that the template renders
- `async` pipe usage in templates is rare; current pattern is imperative `.subscribe()` with `next`/`error` handlers (`src/app/features/cardio/cardio-page.component.ts:421`):
  ```typescript
  this.storageService.initialize().subscribe({
    next: () => this.loadSessions(),
    error: (err) => console.error('Failed to initialize storage:', err)
  });
  ```
- Tests use the `done` callback pattern or `firstValueFrom(...)` (see TESTING.md)

**Standalone forms:**
- Reactive forms via `ReactiveFormsModule`; built with `FormBuilder` in component constructors
- Form validators reference `VALIDATION_LIMITS` constants from `src/app/services/validators.ts` so HTML and service validation stay in sync (`src/app/features/cardio/cardio-page.component.ts:399`)

## Validation

**Layered validation:**
1. Reactive form validators (`Validators.required`, `Validators.min`, `Validators.max`, `Validators.maxLength`) for fast UX feedback
2. Pure functions in `src/app/services/validators.ts` (`validateCardio`, `validateWeight`, `validateBloodPressure`, `validateGlucose`, `validateKetone`) re-validate before persistence
3. All limits centralised in `VALIDATION_LIMITS` (`src/app/services/validators.ts:56`)

**Validation contract:**
- Validators return `ValidationResult { valid: boolean; errors: ValidationError[] }`
- `ValidationError { field: string; message: string; value?: unknown }` — note `value?: unknown` (never `any`)
- Services convert failed results into a typed `*ValidationError` thrown via `throwError(() => new CardioValidationError(...))`

**Key ranges (`src/app/services/validators.ts:56-85`):**
- Cardio: duration 1–1440 min, distance 0.01–1000 km, calories 0–20000 kcal
- Weight: 50–1000 lbs
- Blood pressure: systolic 60–250, diastolic 40–150, systolic > diastolic enforced
- Blood glucose: 1.0–35.0 mmol/L
- Ketones: 0.0–10.0 mmol/L
- Notes: max 500 chars (all entities)
- Diet: net carbs = `Math.max(0, carbsG - fiberG)`

## Error Handling

**Custom error classes:**
- Each domain has a `*ValidationError extends Error` carrying a `readonly errors: ValidationError[]` array (`src/app/services/cardio.service.ts:10`, `src/app/services/weight.service.ts:10`, `src/app/services/readings.service.ts:24`)
- `DietService` uses simple `string[]` errors instead of structured `ValidationError[]` (`src/app/services/diet.service.ts:16`) — minor inconsistency
- `StorageError` adds a typed `code: StorageErrorCode` (`'QUOTA_EXCEEDED' | 'PARSE_ERROR' | 'SERIALIZATION_ERROR' | 'NOT_AVAILABLE' | 'MIGRATION_FAILED'`) (`src/app/services/storage.service.ts:22`)
- `AnthropicApiError` carries `statusCode` and optional `errorType` (`src/app/services/anthropic-api.service.ts:36`)

**Service-level handling:**
- Services emit errors via `throwError(() => new ...)` rather than `Observable.throw`
- Components recognise specific error types in `subscribe` error handlers and surface a friendly message (`src/app/features/cardio/cardio-page.component.ts:486`):
  ```typescript
  if (err instanceof CardioValidationError) {
    this.submitError = err.errors.map(e => e.message).join(', ');
  } else {
    this.submitError = 'Failed to save session. Please try again.';
  }
  ```

**Components:**
- Display errors inline (`form-error` div, `error-message` span)
- Log non-display errors with `console.error('Failed to ...:', err)` (12 occurrences across feature components — see Logging)
- `submitError: string | null` state field is the standard pattern

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- Use `console.error('Failed to <verb>:', err)` for storage/load failures in component `subscribe` error handlers
- Used only in entry points and feature components (`src/main.ts:6`, `src/app/features/*/`*.component.ts`)
- Services do NOT log; they throw / emit errors and let the caller decide

## Comments & Documentation

**JSDoc/TSDoc:**
- Public service methods get a multi-line JSDoc with `@param`, `@returns`, `@throws` (`src/app/services/cardio.service.ts:42-65`):
  ```typescript
  /**
   * Add a new cardio session.
   * Validates input and persists to storage.
   *
   * @param sessionData - Session data without system fields
   * @returns Observable with the created session including generated fields
   * @throws CardioValidationError if validation fails
   */
  ```
- Model interfaces document each field inline (`src/app/models/cardio-session.model.ts:16-43`):
  ```typescript
  /** Unique identifier (UUID v4) */
  id: string;
  /** Duration in minutes (1-1440) */
  durationMinutes: number;
  ```
- Section banners using `// ===` comments separate logical regions in larger files (`src/app/services/validators.ts:52`, `src/app/services/validators.ts:87`)

**When to comment:**
- Document units, ranges, and "what" the field stores
- Explain non-obvious flow (e.g., migration ordering, snapshot rationale)
- Avoid commenting trivial code

## Function Design

**Size & shape:**
- Service methods are short (5–25 lines) and pipe RxJS operators rather than nesting subscribes
- Prefer immutable updates: spread the existing array and `AppData` (`src/app/services/cardio.service.ts:96`):
  ```typescript
  const updatedData = { ...data, cardioSessions: [...data.cardioSessions, newSession] };
  ```

**Returns:**
- Always `Observable<T>` from services (never `Promise`)
- Use `?? null` to coalesce missing optional values rather than `||`
- Return `null` from "find by id" lookups when not found, never throw

**Parameters:**
- Use `Create<Entity>` input type for "add" operations (excludes `id`, `createdAt`, `updatedAt`)
- Use `Partial<T>` overrides only inside test helpers, not in production APIs

## Module Design

**Exports:**
- Named exports only; no default exports anywhere in `src/app/`
- Models in `src/app/models/index.ts` re-export with `export * from ...` (barrel)
- Services and validators are imported by direct path

**Standalone scoping:**
- Each component's `imports: [...]` array lists only what its template needs (`CommonModule`, `ReactiveFormsModule`, `RouterLink`, `BaseChartDirective`, etc.)

## What NOT To Do (project rules — enforce in new code)

- Do NOT access `localStorage` outside `StorageService` (`src/app/services/storage.service.ts`)
- Do NOT use `NgModule`; all new code MUST use standalone components
- Do NOT put business logic in components — delegate to services
- Do NOT use `any` without a documented justification (current `any` usage is confined to migration code in `src/app/services/storage.service.ts:296-369`)
- Do NOT store `null` for absent optional fields — use `undefined` or omit the field (model interfaces use `?` everywhere)
- Do NOT skip unit tests for new services or validators
- Do NOT break backward compatibility with stored `AppData` without bumping `CURRENT_SCHEMA_VERSION` and adding a `migrateVxToVy` function (`src/app/services/storage.service.ts:234`)
- Do NOT use default exports
- Do NOT introduce path aliases — all imports stay relative

## Accessibility

**Required for forms and interactive elements:**
- Every input has an associated `<label for="...">` (`src/app/features/cardio/cardio-page.component.ts:21-30`)
- Add `aria-label` for icon-only or otherwise unlabelled controls
- Mark required fields with `aria-required="true"` and visible `*`
- Reflect validation state with `[attr.aria-invalid]="isFieldInvalid('...')"` and CSS `.invalid` class — color is never the only state indicator
- Loading states use `[attr.aria-busy]="isSubmitting"` on the submit button
- Use semantic landmarks: `<nav>`, `<main>`, `<form>`, `<section>`, `<ul>` with `role="list"` for history lists
- Confirm destructive actions via `window.confirm(...)` before deletion (`src/app/features/cardio/cardio-page.component.ts:435`)

## Schema Migration Conventions

- Bump `CURRENT_SCHEMA_VERSION` in `src/app/models/app-data.model.ts:41`
- Add a `private migrateVxToVy(data: AppData): AppData` method on `StorageService` and call it from `migrateData(...)` in version order (`src/app/services/storage.service.ts:234-255`)
- New optional fields default to `undefined` (or `[]` for arrays), never `null`
- Add at least one migration test in `src/app/services/storage.service.spec.ts` (e.g., `'should migrate v3 data to v4 by adding AI chat fields'` at line 286)

## Commit Conventions

**Format:** `<type>(<scope>): <description>`

**Types observed in `git log`:**
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code restructure without behaviour change
- `test` — tests only
- `docs` — documentation only
- `chore` — build/tooling/config
- `style` — formatting/visual styling

**Scopes observed:**
- Component / feature names: `cardio`, `chat`, `charts`, `nav`, `weight`, `entries`, `reports`, `diet`, `app`, `routing`
- Subsystems: `storage`, `models`, `electron`, `build`, `setup`

**Examples (from recent history):**
- `fix(chat): constrain chat layout so message list scrolls internally`
- `feat(cardio): add calories burned field`
- `feat(storage): implement StorageService with LocalStorage backend`
- `test(cardio): add CardioService unit tests`
- `chore: bump version to 1.2.1` (scope optional for repo-level chores)

**Style:**
- Imperative mood ("add", "fix", "implement"), lowercase after the colon
- Short subject (< 72 chars), no trailing period
- Body optional; used for non-trivial changes

---

*Convention analysis: 2026-05-02*
