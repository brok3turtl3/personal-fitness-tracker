# Testing Patterns

**Analysis Date:** 2026-05-02

## Test Framework

**Runner:**
- Karma `~6.4.0` with `@angular-devkit/build-angular:karma` builder
- Config: declarative — defined in `angular.json` under `architect.test` (`angular.json:73-93`); no separate `karma.conf.js`
- Browser launcher: `karma-chrome-launcher ~3.2.0` (Chrome / ChromeHeadless)
- Reporters: `karma-jasmine ~5.1.0`, `karma-jasmine-html-reporter ~2.1.0`, `karma-coverage ~2.2.0`

**Assertion / spec framework:**
- Jasmine `~5.2.0` (`jasmine-core`) with `@types/jasmine ~5.1.0`
- Spec types resolved via `tsconfig.spec.json` (`tsconfig.spec.json:7-9`):
  ```json
  "types": ["jasmine"]
  ```
- Polyfills: `zone.js` and `zone.js/testing` (`angular.json:77-78`)

**Run Commands:**
```bash
ng test                               # Watch mode (default for development)
ng test --no-watch                    # Single run (CI)
ng test --no-watch --code-coverage    # Single run with coverage report
ng test --browsers=ChromeHeadless --no-watch  # Headless single run
npm test                              # Alias of `ng test`
```

Coverage output is written under `./coverage/` (Karma default) when `--code-coverage` is passed. There is no enforced coverage threshold in `angular.json`.

## Test File Organization

**Location:**
- Specs are co-located with the file under test, in the same directory and with the same base name
- All discovered specs live under `src/app/`:

```
src/app/
├── app.component.spec.ts                          # 31 lines
├── services/
│   ├── ai-settings.service.spec.ts                # 137 lines
│   ├── anthropic-api.service.spec.ts              # 133 lines
│   ├── cardio.service.spec.ts                     # 420 lines
│   ├── chat.service.spec.ts                       # 185 lines
│   ├── diet.service.spec.ts                       # 187 lines
│   ├── fitness-context.service.spec.ts            # 108 lines
│   ├── readings.service.spec.ts                   # 445 lines
│   ├── storage.service.spec.ts                    # 351 lines
│   ├── validators.spec.ts                         # 349 lines
│   └── weight.service.spec.ts                     # 338 lines
└── shared/
    └── date-range.spec.ts                         # 64 lines
```

**Naming:**
- `<source>.spec.ts` (e.g., `cardio.service.ts` → `cardio.service.spec.ts`)
- One top-level `describe('<ClassOrModuleName>', ...)` per spec file

**Spec discovery:**
- `tsconfig.spec.json` includes `"src/**/*.spec.ts"` (`tsconfig.spec.json:11-13`)

## Test Structure

**Suite organisation pattern (from `src/app/services/cardio.service.spec.ts:8-49`):**
```typescript
import { TestBed } from '@angular/core/testing';
import { CardioService, CardioValidationError } from './cardio.service';
import { StorageService } from './storage.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';
import { of } from 'rxjs';

describe('CardioService', () => {
  let service: CardioService;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;
  let mockAppData: AppData;

  // Helper to create a valid input
  const createValidSession = (overrides: Partial<CreateCardioSession> = {}): CreateCardioSession => ({
    date: '2025-01-27T10:00:00.000Z',
    type: 'running',
    durationMinutes: 30,
    ...overrides
  });

  beforeEach(() => {
    mockAppData = createEmptyAppData();

    storageServiceSpy = jasmine.createSpyObj('StorageService', ['initialize', 'getData', 'saveData']);
    storageServiceSpy.initialize.and.returnValue(of(undefined));
    storageServiceSpy.getData.and.returnValue(of(mockAppData));
    storageServiceSpy.saveData.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        CardioService,
        { provide: StorageService, useValue: storageServiceSpy }
      ]
    });

    service = TestBed.inject(CardioService);
  });

  describe('addSession - valid data', () => {
    it('should add a session with required fields only', (done) => {
      service.addSession(createValidSession()).subscribe(session => {
        expect(session.id).toBeDefined();
        expect(storageServiceSpy.saveData).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('addSession - invalid data', () => {
    it('should reject duration above maximum (1441)', (done) => {
      service.addSession(createValidSession({ durationMinutes: 1441 })).subscribe({
        next: () => fail('Expected error'),
        error: (err: CardioValidationError) => {
          expect(err.errors.some(e => e.field === 'durationMinutes')).toBeTrue();
          done();
        }
      });
    });
  });
});
```

**Patterns:**
- One outer `describe` named after the class or module
- Nested `describe` per public method, occasionally split by scenario (`'addSession - valid data'`, `'addSession - invalid data'`)
- `it` titles use the form `'should <expected behaviour>'`
- `beforeEach` rebuilds spies and re-injects the service every test — no shared mutable state between tests
- Test bodies follow Arrange / Act / Assert flow

## Setup Pattern: TestBed + jasmine.SpyObj

**Standard service-test scaffold (used by every domain service spec):**
1. Build a `jasmine.SpyObj<DependencyService>` with `jasmine.createSpyObj('Name', ['method1', 'method2'])`
2. Stub each spy method with `.and.returnValue(of(...))` or `.and.callFake(...)` for stateful behaviour
3. Configure `TestBed` with the real service plus `{ provide: DependencyService, useValue: spy }`
4. Resolve the service with `TestBed.inject(<Service>)`

**Stateful spy variant (used by `chat.service.spec.ts:38-43` and `ai-settings.service.spec.ts:17-21`):**
```typescript
mockStorageService.getData.and.callFake(() => of(mockAppData));
mockStorageService.saveData.and.callFake((data: AppData) => {
  mockAppData = data;          // Persist mutation back into the local mock
  return of(undefined);
});
```
Use this when the test needs subsequent reads to see writes performed earlier in the test.

## Mocking Strategies

**1. Spy on dependent services with `jasmine.createSpyObj` (preferred for service-to-service deps):**
- Used in: `cardio.service.spec.ts`, `weight.service.spec.ts`, `readings.service.spec.ts`, `diet.service.spec.ts`, `chat.service.spec.ts`, `ai-settings.service.spec.ts`, `fitness-context.service.spec.ts`
- Provide stub return values via `spy.method.and.returnValue(of(...))`
- Verify calls with `expect(spy.method).toHaveBeenCalled()` and `spy.method.calls.mostRecent().args` (`cardio.service.spec.ts:138`)

**2. Spy directly on globals with `spyOn(...)` (for browser APIs):**
- `localStorage` mocked with an in-memory map in `storage.service.spec.ts:13-26`:
  ```typescript
  let localStorageMock: { [key: string]: string };
  beforeEach(() => {
    localStorageMock = {};
    spyOn(localStorage, 'getItem').and.callFake((key) => localStorageMock[key] ?? null);
    spyOn(localStorage, 'setItem').and.callFake((key, value) => { localStorageMock[key] = value; });
    spyOn(localStorage, 'removeItem').and.callFake((key) => { delete localStorageMock[key]; });
  });
  ```
- `fetch` mocked in `anthropic-api.service.spec.ts:13-22`:
  ```typescript
  function mockFetch(response: Partial<Response>): jasmine.Spy {
    const mockResponse = { ok: true, status: 200, json: () => Promise.resolve({}), ...response } as Response;
    return spyOn(globalThis, 'fetch').and.returnValue(Promise.resolve(mockResponse));
  }
  ```

**3. Test-data factories (helper functions inside the `describe`):**
- `createValid<Entity>(overrides)` builds the `Create*` input type
- `createStored<Entity>(overrides)` builds the persisted shape with `id`, `createdAt`, `updatedAt`
- Both accept a `Partial<...>` overrides argument so individual tests vary only the field under test
- Examples: `cardio.service.spec.ts:14-30`, `weight.service.spec.ts:14-28`, `readings.service.spec.ts:22-51`, `diet.service.spec.ts:32-52`

**What to mock:**
- All collaborating services (`StorageService`, `AnthropicApiService`, `AISettingsService`, `FitnessContextService`)
- Browser/global APIs touched directly (`localStorage`, `fetch`)
- Use `createEmptyAppData()` from `src/app/models/app-data.model.ts` as the canonical empty `AppData` fixture

**What NOT to mock:**
- Pure utility modules (e.g., `validators.ts`, `date-range.ts`) — call them directly in their own specs
- The class under test — never `spyOn` its own methods
- Angular `TestBed` itself — always use it for DI rather than manually constructing services

## Async Test Patterns

**Pattern A — Jasmine `done` callback (used in `cardio.service.spec.ts`, `weight.service.spec.ts`, `readings.service.spec.ts`, `diet.service.spec.ts`):**
```typescript
it('should add a session', (done) => {
  service.addSession(input).subscribe(session => {
    expect(session.id).toBeDefined();
    done();
  });
});
```
Errors use the two-callback form:
```typescript
service.addSession(input).subscribe({
  next: () => fail('Expected error'),
  error: (err: CardioValidationError) => {
    expect(err).toBeInstanceOf(CardioValidationError);
    done();
  }
});
```

**Pattern B — `async` / `firstValueFrom` (used in `storage.service.spec.ts`, `chat.service.spec.ts`, `ai-settings.service.spec.ts`, `fitness-context.service.spec.ts`, `anthropic-api.service.spec.ts`):**
```typescript
import { firstValueFrom } from 'rxjs';

it('should create empty data on first run', async () => {
  await firstValueFrom(service.initialize());
  const data = await firstValueFrom(service.getData());
  expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
});
```
Errors caught via `try/catch + fail`:
```typescript
try {
  await firstValueFrom(service.initialize());
  fail('Should have thrown an error');
} catch (e) {
  expect(e instanceof StorageError).toBe(true);
  expect((e as StorageError).code).toBe('PARSE_ERROR');
}
```

Either pattern is acceptable; new specs may follow the surrounding file's style. `firstValueFrom` reads cleaner for sequential async steps; `done` is fine for single-emit observables.

## Component Tests

**Standalone-component bootstrap (`src/app/app.component.spec.ts`):**
```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],          // Standalone components go in `imports`, NOT `declarations`
      providers: [provideRouter([])]    // Provide router (and other DI) the component needs
    }).compileComponents();
  });

  it('should render the nav component', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-nav')).toBeTruthy();
  });
});
```
Key points: standalone components are listed in `imports`, never `declarations`. Provide router/DI via `provideRouter([])` and similar functional providers. Currently `AppComponent` is the only component-level spec; feature-page components do not have their own specs.

## Pure-Function Tests

**Validators (`src/app/services/validators.spec.ts`):**
- No `TestBed` — import the function and call directly
- Use literal valid input as a baseline, then spread overrides per test:
  ```typescript
  const validCardio: CreateCardioSession = { date: validDate, type: 'running', durationMinutes: 30, ... };
  const result = validateCardio({ ...validCardio, durationMinutes: 1441 });
  expect(result.valid).toBe(false);
  expect(result.errors.some(e => e.field === 'durationMinutes')).toBe(true);
  ```
- Test boundaries explicitly: min, min-1, max, max+1
- Reference `VALIDATION_LIMITS` constants instead of hard-coding ranges

**Date utilities (`src/app/shared/date-range.spec.ts`):**
- Use deterministic `Date.UTC(...)` values so tests are time-zone independent

## Coverage

**Requirements:**
- No enforced threshold (no `karmaConfig` `coverageReporter.check` rule)
- Project rule (`CLAUDE.md`): "Every service must have a `.spec.ts` file" — currently satisfied for all 9 services in `src/app/services/`

**Currently tested:**
- All 9 domain services (`Cardio`, `Weight`, `Readings`, `Diet`, `Storage`, `Chat`, `AISettings`, `FitnessContext`, `AnthropicApi`)
- All validators (`validators.spec.ts` covers `validateCardio`, `validateWeight`, `validateBloodPressure`, `validateGlucose`, `validateKetone`)
- Shared `date-range` utility
- `AppComponent` smoke test

**Not currently tested:**
- Feature page components in `src/app/features/*/` (no `*.component.spec.ts` for `cardio-page`, `weight-page`, `readings-page`, `charts-page`, `report-page`, `diet-page`, `chat-page`, `chat-input`, `chat-conversation-list`, `chat-message-list`, `settings-page`, or shared `nav`)
- New components are not strictly required to have specs by `CLAUDE.md`, but services and validators are

**View coverage:**
```bash
ng test --no-watch --code-coverage
# Open coverage/personal-fitness-tracker/index.html in a browser
```

## Test Independence

- `beforeEach` resets every spy and rebuilds `mockAppData` from `createEmptyAppData()`
- Tests do not depend on execution order; can be run with `--random=true` (Jasmine default)
- No `beforeAll` or `afterAll` setting up shared state in this codebase
- No real timers — services use `new Date().toISOString()` directly; tests verifying timestamps capture `before`/`after` ISO strings and use lexical comparison (`cardio.service.spec.ts:156-167`)

## Test Types

**Unit tests:**
- Services tested in isolation with mocked dependencies
- Validators and date utilities tested as pure functions

**Integration tests:**
- `StorageService` spec is a light integration test — it exercises real serialisation/migration logic with an in-memory `localStorage` mock
- Migration paths v0→v1, v1→v3, v2→v3 (food shape change), v3→v4 (chat fields) are all covered (`storage.service.spec.ts:213-350`)

**E2E tests:**
- `puppeteer ^24.37.3` is in `devDependencies` but no E2E test files exist; no protractor / Cypress / Playwright setup

## Common Patterns

**Verifying persisted data:**
```typescript
expect(storageServiceSpy.saveData).toHaveBeenCalled();
const savedData = storageServiceSpy.saveData.calls.mostRecent().args[0];
expect(savedData.cardioSessions[0].caloriesBurned).toBe(0);
```

**Verifying error type & code:**
```typescript
expect(e instanceof StorageError).toBe(true);
expect((e as StorageError).code).toBe('PARSE_ERROR');
```

**Mocking schema-versioned localStorage data for migration tests (`storage.service.spec.ts:286-304`):**
```typescript
const v3Data = {
  schemaVersion: 3,
  cardioSessions: [],
  weightEntries: [],
  healthReadings: [],
  savedFoods: [],
  mealEntries: [],
  lastModified: '2026-02-14T00:00:00.000Z'
};
localStorageMock[STORAGE_KEY] = JSON.stringify(v3Data);
await firstValueFrom(service.initialize());
const data = await firstValueFrom(service.getData());
expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
expect(data?.chatConversations).toEqual([]);
```

## Adding Tests for a New Service

1. Create `<service>.spec.ts` next to `<service>.ts` in `src/app/services/`
2. Build the standard scaffold: `let service`, `let storageServiceSpy`, `let mockAppData`
3. In `beforeEach`: reset `mockAppData = createEmptyAppData()`, build the spy with `jasmine.createSpyObj`, configure `TestBed.configureTestingModule({ providers: [...] })`, `service = TestBed.inject(...)`
4. Add `createValidX` and `createStoredX` factory helpers for the data shapes the service handles
5. Cover for each public method:
   - Happy path returning expected shape
   - Sort/filter behaviour (newest-first ordering)
   - Validation failures (one assertion per validation rule)
   - Boundary values (min, min−1, max, max+1)
   - Persistence side-effect via `storageServiceSpy.saveData.calls.mostRecent().args[0]`
6. Run `ng test --no-watch` to verify all tests pass and that the rest of the suite still passes

## Adding Tests for a New Validator

1. Add the test inside `src/app/services/validators.spec.ts` under a new `describe('validate<Name>', ...)` block
2. Define a literal valid input as a baseline
3. Add `it` blocks for: valid input, missing required fields, below minimum, above maximum, boundary values, invalid types, and notes-too-long
4. Reference `VALIDATION_LIMITS` constants — never hard-code ranges
5. Assert `result.valid` and `result.errors.some(e => e.field === '<field>')`

---

*Testing analysis: 2026-05-02*
