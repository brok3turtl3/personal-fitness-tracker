# Phase 1: Foundations - Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 27 NEW files (across utilities, components, specs, fixtures, e2e, config)
**Analogs found:** 22 / 27 (5 fixture/harness/config files have no in-repo analog)

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/app/shared/id.ts` | utility | pure-function | `src/app/shared/date-range.ts` | exact (pure utility module) |
| `src/app/shared/id.spec.ts` | spec | unit | `src/app/shared/date-range.spec.ts` | exact |
| `src/app/shared/chart-grouping.ts` | utility | pure-function | `src/app/shared/date-range.ts` | exact |
| `src/app/shared/chart-grouping.spec.ts` | spec | unit | `src/app/shared/date-range.spec.ts` | exact |
| `src/app/shared/a11y-test-helpers.ts` | utility | pure-function (test-side) | `src/app/services/validators.ts` (top of file, lines 1-50) | role-match (pure helper module, but test-only) |
| `src/app/shared/empty-state.component.ts` | standalone-component | input-projection | `src/app/shared/nav.component.ts` | role-match (standalone component in `src/app/shared/`) |
| `src/app/shared/empty-state.component.spec.ts` | spec | DOM | `src/app/app.component.spec.ts` | exact (standalone-component TestBed scaffold) |
| `src/app/shared/error-state.component.ts` | standalone-component | input + EventEmitter | `src/app/shared/nav.component.ts` | role-match |
| `src/app/shared/error-state.component.spec.ts` | spec | DOM | `src/app/app.component.spec.ts` | exact |
| `src/app/shared/recovery-banner.component.ts` | standalone-component | input + 3 EventEmitters; composes ErrorStateComponent | `src/app/shared/nav.component.ts` | role-match |
| `src/app/shared/recovery-banner.component.spec.ts` | spec | DOM | `src/app/app.component.spec.ts` | exact |
| `src/app/services/legacy-schemas.ts` | typed-schema (interfaces only, no logic) | none (types) | `src/app/services/validators.ts` (top, lines 1-30 — pure type/utility module pattern) + `src/app/models/cardio-session.model.ts` (interface-only file) | role-match (type-only file, no `@Injectable`) |
| `src/app/features/diet/diet-page.component.spec.ts` | spec | DOM characterization | `src/app/services/cardio.service.spec.ts:14-48` (factory + spy + TestBed) + `src/app/app.component.spec.ts` (standalone bootstrap) | exact (composite) |
| `src/app/features/chat/chat-page.component.spec.ts` | spec | DOM characterization | same as above | exact |
| `src/app/features/charts/charts-page.component.spec.ts` | spec | DOM characterization | same as above | exact |
| `src/app/features/reports/report-page.component.spec.ts` | spec | DOM characterization | same as above | exact |
| `src/app/services/storage.service.migration-fixtures.spec.ts` | spec | unit + I/O via mocked LocalStorage | `src/app/services/storage.service.spec.ts:13-29` (localStorage mock) + `:213-349` (existing migration cases) | exact |
| `src/app/services/migrations/fixtures/v0.json` … `v3.json` | fixture | data | `src/app/services/storage.service.spec.ts:240-265` (inline literal that mirrors the v0 shape) | partial (inline literal → external JSON; no existing JSON fixture in repo) |
| `src/app/services/migrations/fixtures/v{N}-expected.json` | fixture | data | same as above | partial |
| `src/app/services/migrations/fixtures/malformed/{null,empty-object,wrong-types,missing-fields}.json` | fixture | data | none (new convention) | none |
| `e2e/run.mjs` | e2e-harness | Node entrypoint | none in repo (`electron/main.js` is closest concept-wise but unrelated) | none — follow Pattern 8 in research |
| `e2e/smoke.spec.mjs` | e2e-harness | Puppeteer page nav | none | none |
| `e2e/a11y.spec.mjs` | e2e-harness | Puppeteer + axe-core | none | none |
| `e2e/fixtures/seed-data.json` | fixture | data | `src/app/models/app-data.model.ts` `createEmptyAppData()` shape | partial (data shape exists; serialized form is new) |
| `e2e/README.md` | docs | text | `README.md` (repo root) | partial |
| `karma.conf.js` | config | Karma config | `angular.json:73-93` (existing inline test target) — extract from here | partial (config moves out of JSON into JS; no JS-form analog) |

## Pattern Assignments

### `src/app/shared/id.ts` (utility, pure-function)

**Analog:** `src/app/shared/date-range.ts` (lines 64-80 — internal helpers; 1-46 — public API)

**Module shape pattern** (lines 1-13):
```typescript
export type DateRangePreset = '30d' | '90d' | '6m' | '1y' | 'all' | 'custom';

export interface ResolvedDateRange {
  startMs?: number;
  endMs?: number;
}

export function resolveDateRange(
  preset: DateRangePreset,
  now: Date,
  customStart?: Date,
  customEnd?: Date
): { range: ResolvedDateRange; error: string | null } {
```

**Convention to mirror:**
- No `@Injectable`, no class, no Angular imports — exported `function` declarations only.
- `export` only on the public surface (`generateId`); helpers (e.g., a fallback random hex generator) stay file-private like `subtractDays/Months/Years` (lines 64-80).
- Single-quote strings, 2-space indent, named exports only (no defaults). [CONVENTIONS.md §"Module Design", §"Code Style"]

**Differs from analog:**
- `id.ts` must contain a feature-detection branch for `crypto.randomUUID` per Pitfall 5 (Electron `file://` edge case in research §line 883). `date-range.ts` has no environment-detection logic.
- The 6 existing `generateUUID` functions to replace (`cardio.service.ts:24-30`, `weight.service.ts:24`, `readings.service.ts:38`, `diet.service.ts:26`, `chat.service.ts:13-19`, `diet-page.component.ts:9-15`) all use the same `Math.random` template-replace pattern — that pattern is explicitly the fallback path in the new `generateId()`, not the primary one.

---

### `src/app/shared/id.spec.ts` (spec, unit)

**Analog:** `src/app/shared/date-range.spec.ts`

**Spec scaffold pattern** (lines 1-12):
```typescript
import { filterByRange, resolveDateRange } from './date-range';

describe('date-range', () => {
  describe('resolveDateRange', () => {
    it('should resolve 30d preset', () => {
      const now = new Date(Date.UTC(2026, 0, 30, 12, 0, 0));
      const { range, error } = resolveDateRange('30d', now);

      expect(error).toBeNull();
      expect(range.endMs).toBe(now.getTime());
      expect(range.startMs).toBe(new Date(Date.UTC(2025, 11, 31, 12, 0, 0)).getTime());
    });
```

**Convention to mirror:**
- No `TestBed` for pure-function specs — direct import of the module under test.
- Nested `describe` per public function; `it('should …')` Jasmine phrasing.
- Arrange → Act → Assert in three visual blocks separated by blank lines.

**Differs from analog:**
- `id.spec.ts` must mock `globalThis.crypto` to test both branches (available + undefined). Use `spyOnProperty(globalThis, 'crypto', 'get').and.returnValue(undefined)` or save/restore the property. `date-range.spec.ts` has no environment mocking.
- UUID-format assertion via regex: `expect(generateId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)`.

---

### `src/app/shared/chart-grouping.ts` (utility, pure-function)

**Analog:** `src/app/shared/date-range.ts` for module shape; **source of the code itself** is `src/app/features/charts/charts-page.component.ts:594-646` (delete from there, paste here).

**Existing code to lift verbatim** (`charts-page.component.ts:594-646`):
```typescript
function toDateKey(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function groupByDay<T extends { date: string }>(
  readings: T[],
  extractor: (r: T) => number[]
): { labels: string[]; averages: number[][] } {
  const map = new Map<string, number[][]>();

  for (const r of readings) {
    const key = toDateKey(r.date);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(extractor(r));
  }

  const sortedKeys = Array.from(map.keys()).sort();
  // ... (averaging loop, lines 626-640)
  return { labels, averages };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
```

**Convention to mirror:**
- All three functions become `export function`s (currently file-private at the bottom of `charts-page.component.ts`).
- Generic constraint `<T extends { date: string }>` is preserved exactly — chart data points all carry an ISO `date` field.
- Keep the JSDoc blocks at lines 594-597 and 606-609 verbatim (they document the timezone-locality decision).

**Differs from analog (`date-range.ts`):**
- `chart-grouping.ts` exports more than one public function (3 exports: `toDateKey`, `groupByDay`, `round2`). `date-range.ts` exports 2 (`resolveDateRange`, `filterByRange`). Both ship a barrel-style flat module — no sub-namespaces.

---

### `src/app/shared/chart-grouping.spec.ts` (spec, unit)

**Analog:** `src/app/shared/date-range.spec.ts:52-63` (the `filterByRange` table-style block).

**Convention to mirror** (lines 52-63):
```typescript
describe('filterByRange', () => {
  it('should filter inclusively by start and end', () => {
    const items = [
      { id: 'a', t: 100 },
      { id: 'b', t: 200 },
      { id: 'c', t: 300 }
    ];

    const filtered = filterByRange(items, i => i.t, { startMs: 200, endMs: 300 });
    expect(filtered.map(i => i.id)).toEqual(['b', 'c']);
  });
});
```

**Required cases for `chart-grouping.spec.ts` (per RESEARCH §1175-1176):**
- Boundary: empty array, single reading, multiple readings on the same day, readings spanning months.
- Regression for commit `b6149d2` (averaging fix). CONCERNS.md flags this as the failure mode most likely to regress — write the spec around the actual averaging math.
- Local-timezone behavior of `toDateKey` (the JSDoc in `charts-page.component.ts:594-597` flags this as deliberate).

---

### `src/app/shared/a11y-test-helpers.ts` (utility, pure-function — test-side)

**Analog:** `src/app/services/validators.ts` lines 1-50 (pure helper module pattern with no `@Injectable`).

**Module shape pattern** (`validators.ts:1-50`):
```typescript
import { CreateCardioSession, CardioType, CARDIO_TYPES } from '../models/cardio-session.model';
// ...

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function validResult(): ValidationResult { return { valid: true, errors: [] }; }
function invalidResult(errors: ValidationError[]): ValidationResult { return { valid: false, errors }; }
```

**Convention to mirror:**
- Exported types + exported async helper (`expectNoSeriousA11yViolations(root: Element): Promise<void>`).
- Internal helpers (e.g., a filter for severity `serious | critical` per D-08) stay un-exported.
- Live in `src/app/shared/` (per D-12 — "no new `shared/ui/` sub-tree this phase").

**Differs from analog:**
- This file imports `axe-core` (the only Phase 1 net-new dep, per RESEARCH §"Standard Stack"). `validators.ts` has no third-party imports — only local model types.
- Async return type (`Promise<void>` thrown via `fail()` or rejected) vs. `validators.ts`'s synchronous `ValidationResult`.
- Lives next to component specs in import paths but is not itself a `.spec.ts` — the `tsconfig.spec.json` `include` glob already picks up everything under `src/app/`.

---

### `src/app/shared/empty-state.component.ts` (standalone-component, input-projection)

**Analog:** `src/app/shared/nav.component.ts`

**Standalone-component scaffold** (`nav.component.ts:5-9, 83-85`):
```typescript
@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="main-nav">
      ...
    </nav>
  `,
  styles: [`...`]
})
export class NavComponent {
  version = packageJson.version;
}
```

**Convention to mirror:**
- `standalone: true` and explicit `imports: [...]` (Phase 1 must keep using `CommonModule` so the `@if`/`@for` blocks work; CONTEXT.md §"Claude's Discretion" says match surrounding components).
- Inline `template:` and `styles:` (kebab-case CSS classnames matching `nav-brand`, `nav-links` style — e.g., `empty-state__title`). [CONVENTIONS.md §"Naming Patterns" — kebab-case file names; selectors `app-<name>`]
- Selector follows `app-<name>`: `app-empty-state`, `app-error-state`, `app-recovery-banner`.

**Differs from analog:**
- `<ng-content>` projection slot for the action button (D-10 explicitly chose this over a `[config]` input). `nav.component.ts` has no `<ng-content>`.
- `@Input({ required: true }) title!: string;` — `nav.component.ts` has no inputs at all. Required-input syntax is Angular 18-supported and is verified against `tsconfig.json` `strictTemplates: true`.
- Optional `[message]?: string` rendered with `@if (message) { ... }` block (CONTEXT.md §"Claude's Discretion" — match the surrounding component's control-flow style; new components in `shared/` can use the new `@if` blocks since they have no template legacy).
- Accessibility: `role="status"` and `aria-live="polite"` on the wrapper `<section>`. `nav.component.ts` uses semantic `<nav>` — both follow CONVENTIONS.md §"Accessibility".

---

### `src/app/shared/empty-state.component.spec.ts` (spec, DOM)

**Analog:** `src/app/app.component.spec.ts`

**TestBed scaffold for standalone components** (`app.component.spec.ts:1-30`):
```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the nav component', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-nav')).toBeTruthy();
  });
});
```

**Convention to mirror:**
- `imports: [Component]` (NEVER `declarations`) — standalone-component testing pattern.
- `fixture.detectChanges()` before any DOM assertion.
- `fixture.nativeElement as HTMLElement` cast for `querySelector`.

**Differs from analog:**
- No `provideRouter([])` needed — empty-state has no router dependencies.
- Required-input test must use a host wrapper `@Component` or `componentRef.setInput('title', '...')` (Angular 18 API). `app.component.spec.ts` has no inputs to test.
- Required spec cases per RESEARCH §1201: title-required, message-optional, ng-content-slot-renders.

---

### `src/app/shared/error-state.component.ts` (standalone-component, input + EventEmitter)

**Analog:** `src/app/shared/nav.component.ts` for the standalone scaffold; **specific code is provided verbatim** in RESEARCH §Pattern 4 (lines 430-485).

**Convention to mirror (from `nav.component.ts`):** same `standalone: true`, inline template, kebab-case CSS, `app-` selector prefix.

**Specific behaviors required by D-09..D-13 (research-supplied code at lines 460-485):**
```typescript
export class ErrorStateComponent {
  @Input({ required: true }) title!: string;
  @Input() message?: string;
  @Input() error?: Error | string;
  @Output() retry = new EventEmitter<void>();

  friendlyMessage(): string {
    if (this.message) return this.message;
    if (this.error instanceof StorageError) {
      switch (this.error.code) {
        case 'PARSE_ERROR':       return "Stored data couldn't be read.";
        case 'QUOTA_EXCEEDED':    return 'Browser storage is full.';
        case 'NOT_AVAILABLE':     return 'Browser storage is unavailable.';
        case 'SERIALIZATION_ERROR': return 'Could not serialize data for storage.';
        case 'MIGRATION_FAILED':  return 'Stored data could not be upgraded to the current version.';
      }
    }
    return 'Something went wrong.';
  }

  rawErrorText(): string {
    if (!this.error) return '';
    if (typeof this.error === 'string') return this.error;
    return this.error.stack ?? this.error.message;
  }
}
```

**Differs from analog:**
- Imports `StorageError` from `../services/storage.service` to drive `friendlyMessage()` switch. `nav.component.ts` has no service imports.
- `@Output() retry = new EventEmitter<void>()` with conditional `retry.observed` rendering. `nav.component.ts` has no outputs.
- Template uses `<details><summary>` for raw error (D-11). Project has no existing `<details>` usage to mirror; this is a Phase 1 new convention.
- `role="alert"` and `aria-live="assertive"` (vs `polite` on empty-state).

---

### `src/app/shared/error-state.component.spec.ts` (spec, DOM)

**Analog:** `src/app/app.component.spec.ts`

Same TestBed scaffold as `empty-state.component.spec.ts`. Required cases per RESEARCH §1203:
- `StorageError` code mapping (test all 5 `StorageErrorCode` values from `storage.service.ts:22-27`).
- `(retry)` output emits when button clicked.
- `<details>` collapsed by default (`expect(detailsEl.open).toBe(false)`).
- Friendly-message fallback for non-`StorageError` errors.

**Differs from `app.component.spec.ts`:**
- Multiple `componentRef.setInput(...)` calls per spec to drive different inputs.
- Spy/mock the EventEmitter via `jasmine.createSpy()` or subscribe and assert.

---

### `src/app/shared/recovery-banner.component.ts` (standalone-component, composes ErrorStateComponent)

**Analog:** `src/app/shared/nav.component.ts` for standalone scaffold.

**Convention to mirror (from `nav.component.ts`):** same standalone shape, inline template, `app-recovery-banner` selector.

**Specific behaviors required by D-15:**
- Composes `<app-error-state>` with three projected `<button>` actions: "Retry migration", "Copy backup JSON to clipboard", "Continue with empty data".
- Three `@Output()` EventEmitters: `(retry)`, `(copyBackup)`, `(continueEmpty)`.
- `@Input({ required: true }) recoveryKey: string;`
- `@Input({ required: true }) fromVersion: number;`
- `@Input({ required: true }) toVersion: number;`
- Uses `<app-error-state>` from `./error-state.component` — listed in `imports: [ErrorStateComponent]`.

**Clipboard handling pattern (from D-15 + Pitfall 5 caution):**
- Feature-detect `navigator.clipboard?.writeText` before calling; fall back to a hidden `<textarea>` + `document.execCommand('copy')` or simply expose the JSON in a copy-friendly `<textarea>`. Project has no existing clipboard code, so this is a new convention; reference Pitfall 5's `crypto` feature-detection pattern as the shape to follow.

**Differs from analog:**
- Composes another standalone component (`ErrorStateComponent`); `nav.component.ts` only composes Angular built-ins.
- Three outputs; `nav.component.ts` has none.

---

### `src/app/shared/recovery-banner.component.spec.ts` (spec, DOM)

**Analog:** `src/app/app.component.spec.ts` for TestBed scaffold; reference spy patterns from `cardio.service.spec.ts:33-45` for `EventEmitter` testing.

Required cases per RESEARCH §1233:
- Each of the three action buttons emits its corresponding output.
- Clipboard fallback when `navigator.clipboard` is `undefined` (override via `spyOnProperty` on `navigator`).
- Renders `recoveryKey`, `fromVersion`, `toVersion` text content.

---

### `src/app/services/legacy-schemas.ts` (typed-schema, types-only)

**Analog:** `src/app/services/validators.ts` lines 1-50 (pure type/helper module pattern with no `@Injectable`) AND `src/app/models/cardio-session.model.ts` (interface-only file with JSDoc-per-field).

**Convention to mirror (from `validators.ts:1-20`):**
```typescript
import { CreateCardioSession, CardioType, CARDIO_TYPES } from '../models/cardio-session.model';
// imports of model types only

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
```

**Convention to mirror (from `cardio-session.model.ts:16-43` — JSDoc-per-field):**
```typescript
/** Unique identifier (UUID v4) */
id: string;
/** Duration in minutes (1-1440) */
durationMinutes: number;
```

**Phase 1 specifics (D-16, RESEARCH §Pattern 6, §line 1224):**
- Exports `LegacyAppDataV0`, `LegacyAppDataV1`, `LegacyAppDataV2`, `LegacyAppDataV3`, plus `LegacySavedFoodV2` (the per-100g shape).
- `LegacyAppDataVN` is a `Partial<...>`-style "describe what was actually stored at version N" shape — derived from inspecting `storage.service.ts:260-321` migration code that currently uses `as any`.
- No runtime code, no `@Injectable`, no class — file-grain matches `validators.ts`'s "types + pure functions" model but with **types only**.

**Differs from analogs:**
- `validators.ts` co-locates types + functions; `legacy-schemas.ts` is types-only.
- `cardio-session.model.ts` lives in `src/app/models/`; `legacy-schemas.ts` lives in `src/app/services/` (next to its sole consumer `storage.service.ts`). Per CONTEXT.md `<code_context>` and CONVENTIONS.md, models in `models/` are project-stable; legacy shapes are an implementation detail of the migration system, hence `services/`.

---

### `src/app/features/diet/diet-page.component.spec.ts` (spec, DOM characterization)

**Analog (factory + spy + TestBed):** `src/app/services/cardio.service.spec.ts:14-48`
**Analog (standalone-component bootstrap):** `src/app/app.component.spec.ts:1-30`

**Factory + spy + TestBed scaffold** (`cardio.service.spec.ts:13-48`):
```typescript
// Helper to create a valid cardio session input
const createValidSession = (overrides: Partial<CreateCardioSession> = {}): CreateCardioSession => ({
  date: '2025-01-27T10:00:00.000Z',
  type: 'running',
  durationMinutes: 30,
  ...overrides
});

// Helper to create a CardioSession (as stored)
const createStoredSession = (overrides: Partial<CardioSession> = {}): CardioSession => ({
  id: 'test-uuid-1',
  date: '2025-01-27T10:00:00.000Z',
  type: 'running',
  durationMinutes: 30,
  createdAt: '2025-01-27T10:00:00.000Z',
  updatedAt: '2025-01-27T10:00:00.000Z',
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
```

**Component-spec adaptations required (per RESEARCH §1194):**
- `imports: [DietPageComponent]` (standalone-component pattern from `app.component.spec.ts:8`), not `providers: [...]` only.
- Inject mocked `DietService`, `StorageService` via `providers: [{ provide: ..., useValue: spy }]`.
- ~3-6 specs: "renders saved foods from store", "renders day's meals", "add-meal flow updates daily totals", "empty state when no meals", "error state when storage fails", "no serious/critical a11y violations".
- a11y assertion uses `expectNoSeriousA11yViolations(fixture.nativeElement)` from `src/app/shared/a11y-test-helpers.ts` (D-08).

**Subscribe pattern in component specs** (`cardio.service.spec.ts:51-56`):
```typescript
service.getSessions().subscribe(sessions => {
  expect(sessions).toEqual([]);
  done();
});
```
Either `done` callback (shown above) or `firstValueFrom` (used in `storage.service.spec.ts:33` — `await firstValueFrom(service.initialize())`) is acceptable per CONTEXT.md `<code_context>` "Established Patterns".

**Differs from analogs:**
- Component specs need `fixture.detectChanges()` to render the template; service specs don't.
- Component specs assert against `fixture.nativeElement.querySelector(...)` (per `app.component.spec.ts:28-29`); service specs assert against returned values.

---

### `src/app/features/chat/chat-page.component.spec.ts`, `charts-page.component.spec.ts`, `report-page.component.spec.ts`

Same combined analog as `diet-page.component.spec.ts` above. Per-file mock list per RESEARCH §1195-1197:
- chat: `ChatService`, `AISettingsService`, `StorageService`
- charts: `CardioService`, `WeightService`, `ReadingsService`, `StorageService`
- reports: same as charts

Same factory-helper convention applies — define `createValidMeal`, `createValidCardio`, etc. per-spec rather than sharing a global fixtures file (D-07).

---

### `src/app/services/storage.service.migration-fixtures.spec.ts` (spec, unit + LocalStorage mock)

**Analog (LocalStorage mock):** `src/app/services/storage.service.spec.ts:6-29`
**Analog (existing migration test cases):** `src/app/services/storage.service.spec.ts:213-349`

**LocalStorage mock pattern** (`storage.service.spec.ts:6-29`):
```typescript
describe('StorageService', () => {
  let service: StorageService;

  // Mock localStorage
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    localStorageMock = {};

    spyOn(localStorage, 'getItem').and.callFake((key: string) => {
      return localStorageMock[key] ?? null;
    });

    spyOn(localStorage, 'setItem').and.callFake((key: string, value: string) => {
      localStorageMock[key] = value;
    });

    spyOn(localStorage, 'removeItem').and.callFake((key: string) => {
      delete localStorageMock[key];
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
  });
```

**Existing migration test pattern to extend** (`storage.service.spec.ts:286-304` — V3→V4):
```typescript
it('should migrate v3 data to v4 by adding AI chat fields', async () => {
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
  expect(data?.aiSettings).toBeUndefined();
});
```

**Convention to mirror:**
- Inline-literal v_N data → `JSON.stringify` → `localStorageMock[STORAGE_KEY]` → `service.initialize()` → assert against `service.getData()`.
- `firstValueFrom` for the async chain (line 4 import).
- Assert against `CURRENT_SCHEMA_VERSION` constant (imported from `app-data.model`), not a literal `4`.

**Phase 1 adaptation (per RESEARCH §1230, D-17):**
- Replace inline literals with `import v0Fixture from './migrations/fixtures/v0.json'` (requires `tsconfig.spec.json` `resolveJsonModule: true` per Pitfall 7, lines 911-915).
- Add malformed-input matrix: `null`, `{}`, wrong types, missing required fields → expect `StorageError` with code `MIGRATION_FAILED` (or `PARSE_ERROR` for the malformed-JSON cases).
- Existing tests at `storage.service.spec.ts:213-349` MUST stay green during the typed-legacy refactor (D-16) — characterization regression check.

**Differs from analog:**
- External JSON fixtures vs inline literals (`storage.service.spec.ts` uses inline literals throughout).
- Backup-key assertions: after `initialize()`, expect `localStorageMock` to contain a key matching `/^fitness_tracker_data\.backup\.v\d+\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/` (D-14).

---

### `src/app/services/migrations/fixtures/v{N}.json`, `v{N}-expected.json`

**Source pattern:** the inline literals at `storage.service.spec.ts:240-265` (V0 shape), `:268-275` (V1 shape), `:307-334` (V2 shape with legacy `nutrientsPer100g`), `:286-296` (V3 shape).

**Example to extract from inline → fixture file** (`storage.service.spec.ts:240-254`, the v0 fixture content):
```typescript
const oldData = {
  cardioSessions: [{
    id: 'cardio-1',
    date: '2025-01-25T08:00:00Z',
    type: 'running',
    durationMinutes: 30,
    distanceKm: 5,
    createdAt: '2025-01-25T08:00:00Z',
    updatedAt: '2025-01-25T08:00:00Z'
  }],
  weightEntries: [],
  healthReadings: [],
  lastModified: '2025-01-25T08:00:00Z'
};
```
Becomes `v0.json`:
```json
{
  "cardioSessions": [
    {
      "id": "cardio-1",
      "date": "2025-01-25T08:00:00Z",
      "type": "running",
      "durationMinutes": 30,
      "distanceKm": 5,
      "createdAt": "2025-01-25T08:00:00Z",
      "updatedAt": "2025-01-25T08:00:00Z"
    }
  ],
  "weightEntries": [],
  "healthReadings": [],
  "lastModified": "2025-01-25T08:00:00Z"
}
```

**Convention (new — no in-repo analog):**
- Path: `src/app/services/migrations/fixtures/v{N}.json` per CONTEXT.md `<specifics>` ("Stable path for Phase 2/3 to drop `v4.json` and `v5.json` next to `v0..v3` without restructuring").
- Pretty-printed (2-space indent) for diff readability.
- One file per pre-migration version; matching `v{N}-expected.json` for the post-migration shape.

**Differs from analog:**
- External JSON instead of TypeScript object literal — requires `tsconfig.spec.json` patch.
- Malformed cases live under `migrations/fixtures/malformed/` per RESEARCH §1229.

---

### `e2e/run.mjs`, `e2e/smoke.spec.mjs`, `e2e/a11y.spec.mjs`, `e2e/fixtures/seed-data.json`, `e2e/README.md`

**No in-repo analog.** Project has `puppeteer@^24` already in `package.json:46` devDeps but no existing usage. Follow Pattern 8 in RESEARCH (lines 773-819) verbatim.

**Closest reference for `package.json` script convention** (`package.json:5-14`):
```json
"scripts": {
  "ng": "ng",
  "start": "ng serve",
  "build": "ng build",
  "watch": "ng build --watch --configuration development",
  "test": "ng test",
  "electron:dev": "ng build --configuration=production && electron .",
  ...
}
```

Add `"e2e": "node e2e/run.mjs"` per RESEARCH §1243. **Do not** chain `ng serve` into the script — RESEARCH §1243 explicitly says "two-terminal flow" and rejects concurrency/wait-on deps.

**Closest reference for `e2e/fixtures/seed-data.json` shape:** `src/app/models/app-data.model.ts` `createEmptyAppData()` produces the runtime shape. The seed-data.json mirrors this serialized form, with a couple of records pre-populated (one cardio session, one weight, one meal — enough to exercise empty-state-vs-populated paths).

---

### `karma.conf.js` (config)

**Source of code to extract:** `angular.json:73-93` (the existing `architect.test` block).

**Existing inline test config** (`angular.json:73-91`):
```json
"test": {
  "builder": "@angular-devkit/build-angular:karma",
  "options": {
    "polyfills": [
      "zone.js",
      "zone.js/testing"
    ],
    "tsConfig": "tsconfig.spec.json",
    "assets": [
      {
        "glob": "**/*",
        "input": "public"
      }
    ],
    "styles": [
      "src/styles.css"
    ],
    "scripts": []
  }
}
```

**Convention to mirror:**
- Standard Angular CLI test target (Karma + Jasmine via `@angular-devkit/build-angular:karma`).
- Polyfills `zone.js` and `zone.js/testing`.
- `tsConfig: tsconfig.spec.json`.

**Phase 1 adaptation (per RESEARCH §Pattern 1, lines 187-285, D-01..D-04):**
- Move into `karma.conf.js` at repo root using the standard `module.exports = function (config) { config.set({ ... }); }` shape.
- `angular.json:73-93` updates to point `architect.test.options.karmaConfig: "./karma.conf.js"` (RESEARCH §1168).
- Add `coverageReporter.check` block with per-pattern thresholds (D-02): `src/app/services/**` and `src/app/shared/**` at 90/90/80, `src/app/features/**` at 40/40, migration code at 100.
- D-04: gate the check via Karma's argv detection so plain `ng test` stays fast.

**Differs from analog:**
- Karma config moves from JSON inline form → standalone `.js` file with `module.exports`.
- Adds `karma-coverage` configuration block (RESEARCH lines 187-285); `package.json:43` already has `karma-coverage@~2.2.0` so no new dep.
- This is the only **repo-root** new file in Phase 1; everything else is under `src/`, `e2e/`, or `.planning/`.

---

## Shared Patterns

### Pattern S-1: `crypto.randomUUID()` with feature-detection fallback
**Source of new pattern:** RESEARCH §"Code Examples" lines 921-973 + Pitfall 5 (lines 883-904).
**Apply to:** `src/app/shared/id.ts`. Replaces the duplicated `generateUUID` at:
- `src/app/services/cardio.service.ts:24-30`
- `src/app/services/weight.service.ts:24` (same shape)
- `src/app/services/readings.service.ts:38` (same shape)
- `src/app/services/diet.service.ts:26` (same shape)
- `src/app/services/chat.service.ts:13-19`
- `src/app/features/diet/diet-page.component.ts:9-15` (DELETE — id-generation moves into `DietService`)

**Existing pattern that all 6 sites share** (`cardio.service.ts:21-30`):
```typescript
/**
 * Generates a UUID v4 string.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```
This `Math.random` template-replace is the **fallback** path in the new `generateId()`. The primary path is `globalThis.crypto.randomUUID()`. Per CLAUDE.md §"Data Model Conventions" — `crypto.randomUUID()` is the prescribed source.

---

### Pattern S-2: Standalone-component template control flow
**Source:** RESEARCH §Pattern 4 (line 416) uses Angular 18 `@if (message) { ... }` blocks.
**Apply to:** All 4 NEW components in `src/app/shared/` (empty-state, error-state, recovery-banner, plus their specs).

**CONTEXT.md §"Claude's Discretion" rule:** match the surrounding component's control-flow style. New components in `shared/` have no template legacy → use `@if`/`@for`. Retrofits to existing `*.component.ts` files (per RESEARCH §1204-1212) MUST match the existing component's style — most use `*ngIf`/`*ngFor` today.

---

### Pattern S-3: Service spec scaffold (factory + spy + TestBed)
**Source:** `src/app/services/cardio.service.spec.ts:8-48`
**Apply to:** All 4 NEW characterization specs (`diet-page`, `chat-page`, `charts-page`, `report-page`).

**Concrete scaffold** (already excerpted above under `diet-page.component.spec.ts`):
```typescript
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
```

CONTEXT.md `<code_context>` calls this out: D-07 explicitly mandates the per-spec factory pattern — no shared canonical fixtures file.

---

### Pattern S-4: LocalStorage mock for migration tests
**Source:** `src/app/services/storage.service.spec.ts:6-29`
**Apply to:** `src/app/services/storage.service.migration-fixtures.spec.ts`.

The `localStorageMock: { [key: string]: string }` + 3 `spyOn` pattern is the project's only LocalStorage testing convention. It must extend (not replace) the existing pattern — Phase 1's typed-legacy refactor cannot break the existing 5 migration tests at lines 213-349.

---

### Pattern S-5: Custom error class with typed code field
**Source:** `src/app/services/storage.service.ts:22-46`
**Apply to:** `error-state.component.ts` `friendlyMessage()` switch — already wired in research code (lines 466-485). New error categories MUST extend `StorageErrorCode` if added (currently 5 codes; D-15 reuses `MIGRATION_FAILED`).

```typescript
export type StorageErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'PARSE_ERROR'
  | 'SERIALIZATION_ERROR'
  | 'NOT_AVAILABLE'
  | 'MIGRATION_FAILED';

export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public override readonly cause?: Error;
  // ...
}
```

Per CONVENTIONS.md §"Error Handling": custom errors suffix `Error`, carry a typed code where applicable. CONVENTIONS.md flags `*ValidationError` classes per domain — Phase 1 introduces no new error classes (`StorageError` already covers `MIGRATION_FAILED`).

---

### Pattern S-6: ISO 8601 timestamp generation
**Source:** `src/app/services/cardio.service.ts:74` (`const now = new Date().toISOString();`)
**Apply to:** Backup-recovery-key timestamp in `storage.service.ts` initialize refactor (D-14: `fitness_tracker_data.backup.v{N}.{ISO-timestamp}`).

CLAUDE.md §"Data Model Conventions": "Dates stored as ISO 8601 strings for JSON serialization". The recovery-key timestamp uses the same format but with `:` replaced by `-` (filesystem/key-safety convention from D-14: `2026-05-02T14-30-12Z`). Project has no existing analog — first time a `.` -separated, `-` -timestamped key appears.

---

## No Analog Found

Files with no close in-repo match (planner: lean on RESEARCH.md patterns referenced beside each):

| File | Role | Reason | Reference |
|------|------|--------|-----------|
| `src/app/services/migrations/fixtures/malformed/*.json` | fixture | No malformed-input matrix exists yet | RESEARCH §1229; create per D-17 |
| `e2e/run.mjs` | e2e-harness | First Puppeteer harness in repo (puppeteer dep was already added but unused) | RESEARCH §Pattern 8 (lines 773-819) |
| `e2e/smoke.spec.mjs` | e2e-harness | First e2e spec | RESEARCH §1239 |
| `e2e/a11y.spec.mjs` | e2e-harness | First axe-core e2e | RESEARCH §1240 + axe-core API.md |
| `e2e/README.md` | docs | First per-directory README beyond repo root | RESEARCH §1242 ("two-terminal flow; environment variables; how to add a new page") |

For these 5 files, the planner should follow the verbatim code blocks in RESEARCH §Pattern 8 rather than a codebase analog.

---

## Metadata

**Analog search scope:**
- `src/app/shared/` (existing utilities + standalone component)
- `src/app/services/` (services, validators, custom errors, migration code)
- `src/app/services/*.spec.ts` (Jasmine + TestBed conventions)
- `src/app/app.component.{ts,spec.ts}` (standalone bootstrap)
- `src/app/features/diet/diet-page.component.ts:1-15` (leaked `generateUUID` site)
- `src/app/features/charts/charts-page.component.ts:580-647` (functions to extract)
- `angular.json` (test target inline form)
- `package.json` (deps + scripts)

**Files scanned:** 12 (read directly), plus directory listings via the structure already captured in `.planning/codebase/STRUCTURE.md`.

**Pattern extraction date:** 2026-05-02

**Coverage summary:**
- Files with exact analog: 14
- Files with role-match analog: 8
- Files with partial / no analog: 5

---

## PATTERN MAPPING COMPLETE
