# Phase 1: Foundations - Research

**Researched:** 2026-05-02
**Domain:** Angular 18 brownfield refactor safety net (Karma+Jasmine, RxJS, axe-core, Puppeteer, schema-migration discipline)
**Confidence:** HIGH (every locked decision verified against official docs and the live codebase; one elective discovery — `crypto.randomUUID` Electron edge case — flagged with mitigation)

## Summary

Phase 1 ships seven instrumentation deliverables (FOUND-01..07) onto a healthy Angular 18 / TypeScript 5.5 / Karma+Jasmine codebase. The hard scope rule (no feature work) is the dominant constraint: every change either lifts existing duplication into a shared module (D-02 subscription hygiene, D-03 utilities, D-09 empty/error state), enforces a quality bar that doesn't exist today (D-01..04 coverage thresholds, D-08 axe-core), or hardens the schema-migration boundary that's about to take heavy use in Phases 2 and 3 (D-14..17). All 17 user decisions in CONTEXT.md are mechanically supported by current Angular and Karma docs — no decision needs to be reopened.

The two findings that affect planning beyond what CONTEXT.md says: (1) **`crypto.randomUUID()` in `file://` Electron** — MDN classifies `file://` as a "potentially trustworthy origin" and Electron 33 ships Chromium ~130+, but multiple production reports show old Electron / wrong-cwd configurations break the API; **D-02's `id.ts` should feature-detect** with a documented fallback rather than blindly call. (2) **`karma-coverage` `coverageReporter.check.each.overrides` is keyed by file glob**, exactly what D-02's per-pattern thresholds need — but the each-vs-overrides distinction matters: `each` is the floor for *every* file, and `overrides` raises the floor for matching globs. Phase 1 plans must stack these correctly so migration code (100%) overrides the services floor (90%) which overrides the global features floor (40%).

**Primary recommendation:** Land the work in three waves: (W0) `id.ts` + Wave-0 test infrastructure (a11y helper, fixture loader, characterization spec scaffold) — unblocks every other task. (W1) Independent parallel work — coverage config, shared utilities, characterization specs, `<app-empty-state>` / `<app-error-state>` components, typed `LegacyAppDataVN` interfaces. (W2) Convergent retrofit work — `takeUntilDestroyed` across all 8 pages, empty/error retrofit across all 8 pages, recovery banner (depends on `<app-error-state>` from W1). The only hard dependency is W2's recovery banner needing W1's `<app-error-state>`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Coverage threshold enforcement (FOUND-01) | Build / Test config | — | `karma.conf.js` is configuration; not application tier. Lives at repo root next to `angular.json`. |
| ID generation (FOUND-02) | Domain services | — | `id.ts` is a pure helper consumed by `cardio/weight/readings/diet/chat` services; CLAUDE.md is explicit components must NOT generate IDs. |
| Day-grouping helpers (FOUND-02) | Shared utilities | — | `groupByDay` / `toDateKey` / `round2` are pure functions used by Charts and Reports pages — `src/app/shared/` per existing convention (mirrors `date-range.ts`). |
| Subscription hygiene (FOUND-03) | UI components | — | `takeUntilDestroyed(this.destroyRef)` is component-tier; injected via `inject(DestroyRef)` in field initializer or constructor. |
| Characterization tests (FOUND-04) | Test layer | — | Karma TestBed DOM specs exercise real component behavior; mocks live in service layer. |
| Puppeteer e2e + axe-core scaffolds (FOUND-05) | Test layer (separate harness) | — | Lives outside `ng test` to avoid polluting unit run; new top-level `e2e/` folder. |
| Empty/error state pattern (FOUND-06) | Shared UI | UI components (consumers) | Standalone components in `src/app/shared/`; consumed by all 8 feature pages via template usage. |
| Schema migration discipline (FOUND-07) | Storage service + new typed-shape module | — | Backup-write is in `StorageService.initialize()` (the LocalStorage chokepoint); type-only `legacy-schemas.ts` is a peer to `validators.ts`. Migration functions stay pure shape transforms. |
| Recovery banner (FOUND-07) | UI shell | Shared UI | App-level shell (`AppComponent` or a new `<app-recovery-banner>`) — must intercept the migration error before any feature page renders. Uses `<app-error-state>` (D-09). |

## Standard Stack

### Core (already locked, used as-is)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Angular | `^18.2.0` | Framework, standalone components, `DestroyRef`, `inject()` | [VERIFIED: package.json:17-25] Locked stack per CONTEXT.md `<canonical_refs>`. |
| TypeScript | `~5.5.2` | Strict mode for typed legacy interfaces | [VERIFIED: package.json:47] `strict: true` per CONVENTIONS.md. |
| RxJS | `~7.8.0` | Observable surface; `takeUntilDestroyed` operator interop | [VERIFIED: package.json:28] |
| Karma | `~6.4.0` | Test runner; `coverageReporter.check` block | [VERIFIED: package.json:41] |
| karma-coverage | `~2.2.0` | Coverage instrumentation + threshold enforcement | [VERIFIED: package.json:43] Already installed; just needs config wiring. |
| Jasmine | `~5.2.0` | Spec framework | [VERIFIED: package.json:40] |
| karma-chrome-launcher | `~3.2.0` | ChromeHeadless for axe-core in specs | [VERIFIED: package.json:42] |
| Puppeteer | `^24.37.3` | Headless Chrome for e2e smoke harness | [VERIFIED: package.json:46] Already installed; not yet used. |

### New Dependency

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `axe-core` | `^4.11.4` | WCAG 2.0/2.1/2.2 violation detection inside Karma specs | [VERIFIED: `npm view axe-core version` → 4.11.4 (modified 2026-04-29)] Industry-standard, framework-agnostic. ~57% automatic WCAG coverage per the `axe-core` README. |

**Installation:**
```bash
npm install -D axe-core@^4
```

**Version verification:** `axe-core@4.11.4` confirmed via npm registry on 2026-05-02.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `axe-core` direct | `@axe-core/playwright` or `@axe-core/puppeteer` | The Karma path runs axe inside JSDOM-via-Karma-Chrome with the `fixture.nativeElement` already mounted; pulling in a Puppeteer wrapper is unneeded ceremony for D-08. The Puppeteer harness in FOUND-05 can use plain `axe-core` injected via `page.addScriptTag`. |
| `@types/axe-core` | (axe-core ships its own types since v4) | No separate types package needed since v4. [CITED: axe-core README] |
| Single `karma.conf.js` ratchet (no-decrease) | Per-pattern thresholds (D-01) | User explicitly rejected ratchet; per-pattern is more legible and easier to debug. CONTEXT.md `<deferred>` documents this. |
| Hand-roll an `OnDestroy + Subject` cleanup pattern | `takeUntilDestroyed` (Angular 16+, stable in v19 but available v16+) | Native operator avoids boilerplate. [VERIFIED: angular.dev/api/core/rxjs-interop/takeUntilDestroyed] |

## Architecture Patterns

### System Architecture Diagram

```
                         Phase 1 — Refactor Safety Net
                         ============================

   Build / Test config                Source code                       Persistence
   ───────────────────               ─────────────────                 ─────────────
                                                                       
   karma.conf.js  ◄────────         Feature pages (8)                  LocalStorage
   (D-03 extract)                   ─────────────────                  ─────────────
        │                            cardio  weight  readings           STORAGE_KEY:
        │ coverage check             diet    charts  reports            'fitness_tracker_data'
        │ (D-01..04)                 chat    settings                          ▲
        ▼                                  │                                   │
   coverageReporter:                       │ inject DestroyRef (D-03)          │
     each:    services 90%                 │ takeUntilDestroyed(this.destroyRef)│
              shared   90%                 │                                   │
              features 40%                 │ uses <app-empty-state> / <app-error-state> (D-09..13)
     overrides:                            │                                   │
       'src/app/services/storage*'  100%   ▼                                   │
       'src/app/services/legacy*'   100%   Domain services (consume id.ts)     │
                                         ─────────────────────────             │
                                          cardio  weight  readings  diet       │
                                          chat                                 │
                                                │                              │
                                                │ getData / saveData ──────────┘
                                                ▼
                            ╔═══════════════════════════════════════════╗
                            ║   StorageService.initialize() (D-14..17)   ║
                            ║   ───────────────────────────────────────  ║
                            ║   1. Read raw JSON from STORAGE_KEY         ║
                            ║   2. Parse → cast to LegacyAppDataV0..V4    ║◄─── legacy-schemas.ts (D-16)
                            ║   3. If schemaVersion < CURRENT:            ║     (typed interfaces)
                            ║      a. WRITE BACKUP to                     ║
                            ║         fitness_tracker_data.backup.v{N}.   ║
                            ║         {ISO-timestamp}                     ║
                            ║      b. Run migrateVxToVy chain             ║
                            ║      c. Persist migrated AppData            ║
                            ║      d. Prune backups beyond last 3         ║
                            ║   4. On migration failure:                  ║
                            ║      throw StorageError('MIGRATION_FAILED') ║──► AppComponent (D-15)
                            ║                                             ║    catches, renders
                            ╚═══════════════════════════════════════════╝    <app-error-state>
                                                                              recovery banner

   Test harness (Karma)
   ────────────────────
   service specs (existing)     +  characterization specs (new, D-05..08)
                                   ──────────────────────────────────────
                                   diet-page    chat-page
                                   charts-page  reports-page
                                   ┌──────────────────────────────┐
                                   │  TestBed.createComponent(X)  │
                                   │  fixture.detectChanges()     │
                                   │  await axe.run(              │
                                   │     fixture.nativeElement)   │
                                   │  filter impact ∈             │
                                   │   {serious, critical}        │
                                   └──────────────────────────────┘

   E2E harness (Puppeteer, separate from `ng test`)        ─── FOUND-05 / D-05
   ───────────────────────────────────────────────────
   e2e/run.mjs   ──► launches Puppeteer ──► page.goto(http://localhost:4200/...)
                                       └──► page.addScriptTag(axe-core) ──► axe.run
                                       └──► smoke: nav between routes, no console errors
   package.json scripts: "e2e", "e2e:smoke"
```

The diagram captures the three independent extension points (build/test config, source code, storage), the one new module (`legacy-schemas.ts`), and the strict separation between in-process axe (Karma) and out-of-process axe (Puppeteer).

### Recommended Project Structure (Phase 1 additions)

```
.
├── karma.conf.js                                    # NEW — extracted per D-03; coverageReporter.check lives here
├── e2e/                                             # NEW — Puppeteer harness for FOUND-05
│   ├── run.mjs                                      # Entrypoint; spawns Puppeteer; assumes ng serve already running
│   ├── smoke.spec.mjs                               # Per-route navigation smoke + console-error gate
│   ├── a11y.spec.mjs                                # axe-core injected per route; serious/critical only
│   ├── fixtures/                                    # Seeded LocalStorage fixtures for repeatable e2e
│   │   └── seed-data.json
│   └── README.md                                    # How to run; port handling; ng serve coordination
├── src/app/
│   ├── shared/
│   │   ├── id.ts                                    # NEW — generateId() (D-02 area)  [FOUND-02]
│   │   ├── id.spec.ts                               # NEW — feature-detection + fallback test
│   │   ├── chart-grouping.ts                        # NEW — groupByDay/toDateKey/round2  [FOUND-02]
│   │   ├── chart-grouping.spec.ts                   # NEW
│   │   ├── empty-state.component.ts                 # NEW — <app-empty-state>  [FOUND-06]
│   │   ├── empty-state.component.spec.ts            # NEW
│   │   ├── error-state.component.ts                 # NEW — <app-error-state>  [FOUND-06]
│   │   ├── error-state.component.spec.ts            # NEW
│   │   └── a11y-test-helpers.ts                     # NEW — axe.run wrapper for Karma  [FOUND-05]
│   ├── services/
│   │   ├── legacy-schemas.ts                        # NEW — LegacyAppDataV0..V4 + LegacySavedFoodV2  [FOUND-07]
│   │   └── migrations/
│   │       └── fixtures/                            # NEW per D-17
│   │           ├── v0.json
│   │           ├── v1-expected.json
│   │           ├── v1.json
│   │           ├── v2-expected.json
│   │           ├── v2.json
│   │           ├── v3-expected.json
│   │           ├── v3.json
│   │           ├── v4-expected.json
│   │           └── malformed/                        # null.json, empty-object.json, wrong-types.json, missing-fields.json
│   └── features/
│       ├── diet/
│       │   └── diet-page.component.spec.ts          # NEW — characterization specs  [FOUND-04]
│       ├── chat/
│       │   └── chat-page.component.spec.ts          # NEW
│       ├── charts/
│       │   └── charts-page.component.spec.ts        # NEW
│       └── reports/
│           └── report-page.component.spec.ts        # NEW
└── angular.json                                      # MODIFIED — architect.test.options.karmaConfig: "./karma.conf.js"
```

### Pattern 1: `coverageReporter.check` per-pattern thresholds (FOUND-01, D-01..04)

**What:** Karma fails the run when coverage drops below per-glob floors, but only when `--code-coverage` is passed. Plain `ng test` stays threshold-free.

**When to use:** Every CI run that asserts test discipline. D-04 says CI command becomes `ng test --no-watch --code-coverage`.

**Example:**
```javascript
// karma.conf.js — Source: karma-coverage docs (https://github.com/karma-runner/karma-coverage/blob/master/docs/configuration.md)
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: { jasmine: {}, clearContext: false },
    jasmineHtmlReporter: { suppressAll: true },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/personal-fitness-tracker'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }, { type: 'lcovonly' }],

      // Threshold enforcement — only fires when --code-coverage is passed
      // because karma-coverage only runs when --code-coverage is in argv.
      check: {
        emitWarning: false,                          // hard fail, not warn
        global: {                                    // safety net across the whole codebase
          statements: 60,
          branches: 50,
          lines: 60,
          functions: 60,
        },
        each: {                                      // applied per-file as a default floor
          statements: 40,
          branches: 30,
          lines: 40,
          functions: 40,
          excludes: [
            'src/main.ts',
            'src/app/**/*.spec.ts',
            'src/environments/**',
          ],
          overrides: {                               // raises the floor for matching globs
            'src/app/services/**/*.ts': {
              statements: 90,
              branches: 80,
              lines: 90,
              functions: 90,
            },
            'src/app/shared/**/*.ts': {
              statements: 90,
              branches: 80,
              lines: 90,
              functions: 90,
            },
            // Migration code — data-loss risk demands 100%
            'src/app/services/storage.service.ts': {
              statements: 100,
              branches: 100,
              lines: 100,
              functions: 100,
            },
            'src/app/services/legacy-schemas.ts': {
              statements: 100,
              branches: 100,
              lines: 100,
              functions: 100,
            },
          },
        },
      },
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: { base: 'ChromeHeadless', flags: ['--no-sandbox'] },
    },
    restartOnFileChange: true,
  });
};
```

**Key facts (verified):**
- `coverageReporter.check.each.overrides` is keyed by glob; matching files use the override values *instead of* the `each` defaults. [CITED: karma-coverage configuration.md]
- `excludes` arrays accept globs and are honored by both `global` and `each`. [CITED: karma-coverage configuration.md]
- `karma-coverage` only runs when `--code-coverage` is in argv (Angular CLI's behavior); the `check` block is a no-op without it. [VERIFIED: angular.json:73-93 has no coverage settings, and `ng test` runs cleanly today — confirms `--code-coverage` is the trigger]
- Plain `ng test` invokes Karma without the coverage instrumentation, so threshold checks don't fire. [CITED: angular.dev/guide/testing/code-coverage]

**Wiring step:** Add `"karmaConfig": "./karma.conf.js"` to `angular.json` `architect.test.options` block (currently lines 73-93).

### Pattern 2: `takeUntilDestroyed(this.destroyRef)` retrofit (FOUND-03)

**What:** RxJS operator that completes the observable when the component (or any class with a registered `DestroyRef`) is destroyed. Replaces the `OnDestroy + Subject` pattern.

**When to use:** Every `.subscribe(...)` call inside a feature component. Today there are ~40 subscribe calls across 8 feature components, zero of which clean up. [VERIFIED: `grep -rn ".subscribe(" src/app/features` → 40 matches; `grep -rn "OnDestroy\|takeUntilDestroyed\|DestroyRef" src/app` → 0 matches]

**Two valid forms:**

```typescript
// Source: https://angular.dev/api/core/rxjs-interop/takeUntilDestroyed
//         https://angular.dev/api/core/DestroyRef

// Form A — preferred for retrofit: explicit DestroyRef field. Safe to call from any method.
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({ /* ... */ })
export class CardioPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  constructor(
    private storageService: StorageService,
    private cardioService: CardioService,
  ) {}

  ngOnInit(): void {
    this.storageService.initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ /* ... */ });

    this.cardioService.getSessions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ /* ... */ });
  }
}

// Form B — only valid in injection context (constructor / field initializer)
@Component({ /* ... */ })
export class FooComponent {
  private dataSub = this.fooService.data$
    .pipe(takeUntilDestroyed())   // no arg = grabs DestroyRef from current injection context
    .subscribe(/* ... */);
}
```

**Critical retrofit rules:**
- **Use Form A for retrofitting `ngOnInit` subscriptions.** Calling `takeUntilDestroyed()` (no arg) from inside a method throws `NG0203` because it's outside the injection context. Injecting `DestroyRef` once as a field makes every method-level call safe. [VERIFIED: angular.dev/api/core/DestroyRef states inject() works "within injection contexts like constructors, service initializers, and component/directive lifecycle methods"]
- **`inject(DestroyRef)` requires Angular 16+; stable since 18.** [CITED: angular.dev/api/core/DestroyRef "stable" badge in v18 docs]
- **Per-subscribe placement is fine.** No need to share the operator across multiple `.subscribe()` calls; each call gets its own `.pipe(takeUntilDestroyed(this.destroyRef))`.
- **Imports come from `@angular/core/rxjs-interop`**, not `rxjs`. [VERIFIED: angular.dev/api/core/rxjs-interop/takeUntilDestroyed]

**Anti-pattern:** Calling `takeUntilDestroyed()` (no DestroyRef arg) from inside `ngOnInit` body or any other method — runs outside injection context, throws `NG0203` at runtime. Always pass `this.destroyRef` when calling from outside the field initializer.

### Pattern 3: axe-core inside Karma characterization specs (FOUND-04, FOUND-05, D-08)

**What:** After mounting a standalone component in `TestBed`, run `axe.run(fixture.nativeElement)`, filter the violations array to `serious | critical`, fail the spec if any remain.

**When to use:** Every characterization spec for `diet-page`, `chat-page`, `charts-page`, `report-page`. D-08 says the harness lands once and is used everywhere.

**Example:**
```typescript
// src/app/shared/a11y-test-helpers.ts
// Source: https://github.com/dequelabs/axe-core/blob/develop/doc/API.md
import axe, { AxeResults, Result } from 'axe-core';

const SEVERE_IMPACTS: ReadonlyArray<Result['impact']> = ['serious', 'critical'];

export async function expectNoSerousA11yViolations(root: Element): Promise<void> {
  const results: AxeResults = await axe.run(root);
  const severe = results.violations.filter(v => SEVERE_IMPACTS.includes(v.impact));

  if (severe.length === 0) return;

  const summary = severe
    .map(v => `[${v.impact}] ${v.id}: ${v.help} — ${v.nodes.length} node(s)`)
    .join('\n');
  fail(`Found ${severe.length} serious/critical a11y violation(s):\n${summary}`);
}

// Usage in a feature characterization spec
// src/app/features/charts/charts-page.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ChartsPageComponent } from './charts-page.component';
import { expectNoSerousA11yViolations } from '../../shared/a11y-test-helpers';

describe('ChartsPageComponent (characterization)', () => {
  beforeEach(async () => {
    // ... TestBed setup with spied services per CardioServiceSpec scaffold ...
    await TestBed.configureTestingModule({
      imports: [ChartsPageComponent],
      providers: [
        provideRouter([]),
        // ...spied StorageService/CardioService/WeightService/ReadingsService
      ],
    }).compileComponents();
  });

  it('should render with no serious or critical a11y violations on initial load', async () => {
    const fixture = TestBed.createComponent(ChartsPageComponent);
    fixture.detectChanges();
    await expectNoSerousA11yViolations(fixture.nativeElement);
  });
});
```

**Key facts (verified):**
- `axe.run(context)` returns a Promise when no callback is passed; the result's `violations` array contains entries with `impact: 'minor' | 'moderate' | 'serious' | 'critical'`. [CITED: axe-core API.md]
- axe-core has no built-in option to filter by impact at run-time; filter the result array yourself. [CITED: axe-core API.md]
- axe-core works against a real DOM; Karma+Chrome (or ChromeHeadless) is a real DOM, so this Just Works. JSDom-only test environments can be lossy for layout-related rules — not our concern (we're on Karma+Chrome).

### Pattern 4: Standalone empty / error-state components (FOUND-06, D-09..13)

**What:** Two `standalone: true` components in `src/app/shared/`, consumed via element selector with `<ng-content>` for the action slot.

**When to use:** Every feature page that has a "no data yet" state, an "operation failed" state, or both. D-13 names all 8 pages.

**Example:**
```typescript
// src/app/shared/empty-state.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="empty-state" role="status" aria-live="polite">
      <h2 class="empty-state__title">{{ title }}</h2>
      @if (message) {
        <p class="empty-state__message">{{ message }}</p>
      }
      <div class="empty-state__action">
        <ng-content></ng-content>
      </div>
    </section>
  `,
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input() message?: string;
}

// src/app/shared/error-state.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageError } from '../services/storage.service';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="error-state" role="alert" aria-live="assertive">
      <h2 class="error-state__title">{{ title }}</h2>
      @if (friendlyMessage()) {
        <p class="error-state__message">{{ friendlyMessage() }}</p>
      }
      @if (rawErrorText()) {
        <details class="error-state__details">
          <summary>Technical details</summary>
          <pre>{{ rawErrorText() }}</pre>
        </details>
      }
      <div class="error-state__actions">
        <ng-content></ng-content>
        @if (retry.observed) {
          <button type="button" class="btn btn-secondary" (click)="retry.emit()">Retry</button>
        }
      </div>
    </section>
  `,
})
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

**Key facts:**
- `<ng-content>` for action gives templates full freedom. CONTEXT.md `<specifics>` calls this out: "[config] object input was explicitly rejected because pages that want richer states need template flexibility."
- `@Input({ required: true })` is the Angular 18 way to enforce required inputs at compile time. Strict templates will flag missing `[title]`. [VERIFIED: angular.json strict templates already on per `tsconfig.json` strictTemplates: true (in CONVENTIONS.md)]
- `retry.observed` (RxJS-backed property on `EventEmitter`) is the safe way to conditionally render the Retry button only when the parent has wired up `(retry)`. Available since Angular 17.

### Pattern 5: Backup-before-migrate + recovery banner (FOUND-07, D-14, D-15)

**What:** Inside `StorageService.initialize()`, between parsing the raw JSON and running migrations, write the pre-migration JSON to a timestamped recovery key. On migration failure, throw a `StorageError('MIGRATION_FAILED')` carrying the recovery key, the from/to versions, and the cause.

**When to use:** Every time `parsed.schemaVersion < CURRENT_SCHEMA_VERSION`. Not on first run (no data to back up). Not when versions match (no migration to run).

**Example:**
```typescript
// src/app/services/storage.service.ts — initialize() flow change
// Source: derived from current implementation at storage.service.ts:64-111

private static BACKUP_KEY_PREFIX = 'fitness_tracker_data.backup.';
private static MAX_BACKUPS_TO_KEEP = 3;

initialize(): Observable<void> {
  if (this.initialized) return of(undefined);

  if (!this.isLocalStorageAvailable()) {
    return throwError(() => new StorageError('LocalStorage is not available', 'NOT_AVAILABLE'));
  }

  const rawData = localStorage.getItem(STORAGE_KEY);

  if (rawData === null) {
    this.cachedData = createEmptyAppData();
    this.persistToStorage(this.cachedData);
    this.initialized = true;
    return of(undefined);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch (e) {
    return throwError(() => new StorageError(
      'Failed to parse stored data', 'PARSE_ERROR', e instanceof Error ? e : undefined
    ));
  }

  const fromVersion = (parsed as { schemaVersion?: number }).schemaVersion ?? 0;

  if (fromVersion < CURRENT_SCHEMA_VERSION) {
    // BACKUP BEFORE MIGRATE — D-14
    const backupKey = this.writeBackup(rawData, fromVersion);
    this.pruneOldBackups();

    try {
      this.cachedData = this.migrateData(parsed);  // typed flow over LegacyAppDataVN — D-16
      this.persistToStorage(this.cachedData);
    } catch (e) {
      // Migration failed — surface to UI shell — D-15
      return throwError(() => new StorageError(
        `Migration failed (v${fromVersion} → v${CURRENT_SCHEMA_VERSION}). Backup at ${backupKey}.`,
        'MIGRATION_FAILED',
        e instanceof Error ? e : undefined,
      ));
    }
  } else {
    this.cachedData = parsed as AppData;
  }

  this.initialized = true;
  return of(undefined);
}

private writeBackup(rawData: string, fromVersion: number): string {
  const ts = new Date().toISOString().replace(/[:]/g, '-');
  const key = `${StorageService.BACKUP_KEY_PREFIX}v${fromVersion}.${ts}`;
  // Best-effort: if backup write itself overflows, swallow and continue —
  // failing the migration because the backup couldn't be written would lose data.
  try { localStorage.setItem(key, rawData); } catch { /* logged below */ }
  return key;
}

private pruneOldBackups(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(StorageService.BACKUP_KEY_PREFIX)) keys.push(k);
  }
  // Sort by timestamp suffix descending; keep the first MAX_BACKUPS_TO_KEEP
  keys.sort().reverse();
  for (const k of keys.slice(StorageService.MAX_BACKUPS_TO_KEEP)) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}
```

**Key facts:**
- Backup write goes inside `StorageService` — the LocalStorage chokepoint per ARCHITECTURE.md. Migration functions stay pure. [VERIFIED: storage.service.ts:129-161 is the existing chokepoint per CONTEXT.md `<code_context>`]
- `localStorage.length` and `localStorage.key(i)` are the standards-compliant way to iterate keys; works under Electron `file://`. [CITED: MDN Storage API]
- Timestamp format `2026-05-02T14-30-12-123Z` (colons replaced) keeps the key safe for any LocalStorage backend.
- D-14 explicitly chose **timestamped** keys over single-rolling backup so chained migrations (V3→V4→V5) don't lose intermediate snapshots. CONTEXT.md `<specifics>` confirms.

### Pattern 6: Typed legacy-shape migrations (FOUND-07, D-16)

**What:** One `LegacyAppDataVN` interface per from-version, exported from `src/app/services/legacy-schemas.ts`. Each `migrateVxToVy()` accepts a typed `LegacyAppDataVN` and returns `LegacyAppDataV{N+1}` (or `AppData` for the latest hop). No `as any` reads anywhere.

**When to use:** Every existing migration (V0→V4) and every future migration (V4→V5 in Phase 3, V5→V6 in Phase 2).

**Example:**
```typescript
// src/app/services/legacy-schemas.ts
// Source: typed shapes derived from current storage.service.ts:260-321 + V2→V3 in :295-321
import { CardioSession } from '../models/cardio-session.model';
import { WeightEntry } from '../models/weight-entry.model';
import { HealthReading } from '../models/health-reading.model';

/** Pre-versioning shape (no schemaVersion field). May be partial. */
export interface LegacyAppDataV0 {
  cardioSessions?: CardioSession[];
  weightEntries?: WeightEntry[];
  healthReadings?: HealthReading[];
  lastModified?: string;
  // any other top-level fields tolerated as `unknown`
}

export interface LegacyAppDataV1 {
  schemaVersion: 1;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  lastModified: string;
}

export interface LegacySavedFoodV2 {
  id: string;
  fdcId?: number;
  name: string;
  nutrientsPer100g?: {
    caloriesKcal?: number;
    proteinG?: number;
    fatG?: number;
    carbsG?: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    netCarbsG?: number;
  };
  servings?: Array<{ id: string; label: string; grams?: number }>;
  createdAt: string;
  updatedAt: string;
  // Note: no baseUnit, no nutrientsPerUnit — those are V3+
}

export interface LegacyAppDataV2 {
  schemaVersion: 2;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  savedFoods: LegacySavedFoodV2[];
  mealEntries: unknown[];   // existing migration leaves these unchanged; type later if Phase 2 needs
  lastModified: string;
}

export interface LegacyAppDataV3 {
  schemaVersion: 3;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  savedFoods: import('../models/diet.model').SavedFood[];
  mealEntries: import('../models/diet.model').MealEntry[];
  lastModified: string;
  // No chatConversations / aiSettings yet — those are V4+
}
```

```typescript
// src/app/services/storage.service.ts — migration chain rewritten with typed shapes
private migrateData(data: unknown): AppData {
  const fromVersion = (data as { schemaVersion?: number }).schemaVersion ?? 0;

  let v1: LegacyAppDataV1 = (fromVersion < 1)
    ? this.migrateV0ToV1(data as LegacyAppDataV0)
    : (data as LegacyAppDataV1);

  let v2: LegacyAppDataV2 = (fromVersion < 2)
    ? this.migrateV1ToV2(v1)
    : (data as LegacyAppDataV2);

  let v3: LegacyAppDataV3 = (fromVersion < 3)
    ? this.migrateV2ToV3(v2)
    : (data as LegacyAppDataV3);

  let v4: AppData = (fromVersion < 4)
    ? this.migrateV3ToV4(v3)
    : (data as AppData);

  return v4;
}

private migrateV0ToV1(data: LegacyAppDataV0): LegacyAppDataV1 { /* same as today, but typed */ }
private migrateV1ToV2(data: LegacyAppDataV1): LegacyAppDataV2 { /* ... */ }
private migrateV2ToV3(data: LegacyAppDataV2): LegacyAppDataV3 {
  const savedFoods = Array.isArray(data.savedFoods)
    ? data.savedFoods.map(f => migrateSavedFoodV2ToV3(f))   // f is LegacySavedFoodV2 — no `as any`
    : [];
  return { /* ... */ };
}
private migrateV3ToV4(data: LegacyAppDataV3): AppData { /* same as today, but typed */ }
```

**Key facts:**
- `legacy-schemas.ts` is type-only — no behavior, no `@Injectable`. Mirrors `validators.ts` precedent of pure-module exports. [VERIFIED: validators.ts is a pure module per CONVENTIONS.md]
- Existing migration tests at `storage.service.spec.ts:213-350` continue to pass after the refactor — they test behavior, not types. [VERIFIED: read storage.service.spec.ts above; tests assert on data shape, not on `as any` paths]
- `LegacySavedFoodV2.nutrientsPer100g` and `LegacySavedFoodV2.servings[].grams` are explicitly modeled as optional, so the migration's existing defensive `safeNumber()` pattern still works. [VERIFIED: storage.service.ts:325-356]
- Strict-TS catches typos in legacy field names, exactly as CONCERNS.md "any-typed code in schema migration" risk demands.

### Pattern 7: Fixture-driven migration tests (FOUND-07, D-17)

**What:** A small JSON fixture per from-version + an expected JSON per to-version. Tests load the fixture, run the migration, deep-equal against expected. Plus a malformed-input matrix.

**Example:**
```typescript
// src/app/services/storage.service.migration-fixtures.spec.ts
// Source: extends storage.service.spec.ts patterns at :213-350
import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { STORAGE_KEY, CURRENT_SCHEMA_VERSION } from '../models/app-data.model';
import { firstValueFrom } from 'rxjs';

import v0Fixture from './migrations/fixtures/v0.json';
import v1Expected from './migrations/fixtures/v1-expected.json';
import v2Fixture from './migrations/fixtures/v2.json';
import v3Expected from './migrations/fixtures/v3-expected.json';

describe('StorageService migrations (fixture-driven)', () => {
  let service: StorageService;
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    localStorageMock = {};
    spyOn(localStorage, 'getItem').and.callFake((k: string) => localStorageMock[k] ?? null);
    spyOn(localStorage, 'setItem').and.callFake((k: string, v: string) => { localStorageMock[k] = v; });
    spyOn(localStorage, 'removeItem').and.callFake((k: string) => { delete localStorageMock[k]; });
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
  });

  it('V0 → final: produces v1-expected shape (and continues to current)', async () => {
    localStorageMock[STORAGE_KEY] = JSON.stringify(v0Fixture);
    await firstValueFrom(service.initialize());
    const data = await firstValueFrom(service.getData());
    // Deep-check the V1 invariants we care about
    expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data?.cardioSessions).toEqual(v1Expected.cardioSessions);
    // ... etc.
  });

  describe('malformed-input matrix', () => {
    const malformed: Array<[string, unknown]> = [
      ['null', null],
      ['empty object', {}],
      ['wrong-type savedFoods', { schemaVersion: 2, savedFoods: 'not-an-array' }],
      ['missing required fields', { schemaVersion: 1 }],
    ];

    for (const [name, payload] of malformed) {
      it(`tolerates ${name} without throwing or losing data silently`, async () => {
        localStorageMock[STORAGE_KEY] = JSON.stringify(payload);
        // Should either initialize cleanly with defaults OR throw a typed StorageError —
        // never silently corrupt.
        try {
          await firstValueFrom(service.initialize());
          const data = await firstValueFrom(service.getData());
          expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        } catch (e) {
          expect((e as StorageError).code).toBe('MIGRATION_FAILED');
          // backup must exist for the user to recover
          const backups = Object.keys(localStorageMock).filter(k => k.startsWith('fitness_tracker_data.backup.'));
          expect(backups.length).toBeGreaterThan(0);
        }
      });
    }
  });
});
```

**Note on fixture imports:** Karma + Angular CLI 18 needs `"resolveJsonModule": true` in `tsconfig.spec.json`. Check current setting; if absent, add it. [CITED: Angular CLI build options reference]

### Pattern 8: Puppeteer e2e harness wired separately from `ng test` (FOUND-05)

**What:** A separate Node.js harness in `e2e/` that launches Puppeteer, points at a `ng serve` instance, runs smoke specs and per-route axe-core audits. Lives outside `ng test` so unit-test runs stay fast.

**Wire-up:**
```javascript
// e2e/run.mjs — Source: pptr.dev guides
import puppeteer from 'puppeteer';
import { runSmoke } from './smoke.spec.mjs';
import { runA11y } from './a11y.spec.mjs';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4200';

const browser = await puppeteer.launch({
  headless: 'new',                      // v22+ default
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  await runSmoke(browser, BASE_URL);
  await runA11y(browser, BASE_URL);
  console.log('e2e PASS');
} finally {
  await browser.close();
}
```

```json
// package.json scripts additions
{
  "scripts": {
    "e2e": "node e2e/run.mjs",
    "e2e:smoke": "concurrently --kill-others --success first \"ng serve --port 4200\" \"wait-on http-get://localhost:4200 && node e2e/run.mjs\""
  }
}
```

**Recommended approach for Phase 1:**
- **Don't add `concurrently`/`wait-on` deps in Phase 1.** Document the two-terminal flow in `e2e/README.md` (Terminal 1: `ng serve`, Terminal 2: `npm run e2e`). Keep Phase 1 net-additive deps to **just `axe-core`** as STACK.md says.
- **Phase 1 ships one minimal smoke spec and one a11y spec.** Phase 2 (and beyond) extend the harness rather than invent it. Per FOUND-05.

**Key facts:**
- Puppeteer v24 ships its own Chromium binary — no system Chrome needed. [VERIFIED: package.json:46 has `puppeteer ^24.37.3`; `node_modules/.bin/puppeteer` includes the bundled Chromium download]
- `headless: 'new'` is the default since v22; specify it explicitly to avoid relying on the default. [CITED: puppeteer release notes]
- `--no-sandbox --disable-setuid-sandbox` flags are required in some CI sandboxes (WSL, Docker root). Safe to include unconditionally for a developer laptop. [CITED: puppeteer troubleshooting docs]
- Inject axe-core into the page via `page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })`, then `page.evaluate(() => axe.run())`. [CITED: axe-core README integration examples]

### Anti-Patterns to Avoid

- **Calling `takeUntilDestroyed()` (no arg) from inside `ngOnInit` body.** Throws `NG0203`. Always pass `this.destroyRef`. (Pattern 2.)
- **Using `as any` to read legacy schema fields.** Defeats the point of FOUND-07 / D-16. Every legacy read goes through a `LegacyAppDataVN` interface. (Pattern 6.)
- **Putting backup-write logic inside individual `migrateVxToVy()` functions.** Single-responsibility violation; backup is a `StorageService` concern (LocalStorage chokepoint), not a migration concern. (Pattern 5.)
- **Adding axe-core severity filtering as run-time options to `axe.run()`.** axe-core has no such option; filter the result `violations` array yourself. (Pattern 3.)
- **Running coverage thresholds on plain `ng test`.** D-04 says only `--code-coverage` runs trigger the check; test the karma.conf.js doesn't break dev iteration.
- **Generating IDs inside components.** CLAUDE.md "What NOT To Do" rule plus CONCERNS.md flag for `diet-page.component.ts:9-15`. Move the leak in passing during D-02 retrofit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID v4 generation | `Math.random()` polynomial generator (current 6 copies) | `crypto.randomUUID()` with feature-detection fallback | CLAUDE.md prescribes it; statistically stronger than `Math.random`; CONCERNS.md flags 6 duplicates as a top tech-debt item. |
| Coverage threshold check | Custom CI grep over coverage HTML | `karma-coverage`'s `coverageReporter.check` block | Built-in, supports per-glob `overrides`, fails the run when violated. [CITED: karma-coverage docs] |
| Subscription cleanup | `OnDestroy` + `Subject` + `takeUntil(destroy$)` boilerplate | `takeUntilDestroyed(this.destroyRef)` | Native operator since Angular 16; no boilerplate; injection-context-aware. [CITED: angular.dev] |
| WCAG violation detection | Hand-checked `aria-*` attribute audits | `axe-core@^4` `axe.run(fixture.nativeElement)` | ~57% automatic WCAG coverage; framework-agnostic; runs in real Chrome. |
| Headless browser scripting | Hand-rolled `child_process.spawn('chrome')` | Puppeteer (already in devDependencies) | Bundled Chromium; mature API; no system-Chrome assumption. |
| Date manipulation utilities | `Date.prototype.set*` chains scattered across components | Centralize in `src/app/shared/date-range.ts` (already exists; extend it) | Pattern 1 of CONCERNS.md fragile areas. Existing `date-range.ts:64-79` already has the bug-prone `setUTC*` issue — Phase 1 doesn't fix it (out of scope), but doesn't extend it either. |
| Empty-state / error-state UI per page | Per-page custom `<div class="empty">` markup | `<app-empty-state>` / `<app-error-state>` | Consistency across 8 pages; one component to update copy/styling later (QUAL-09). |

**Key insight:** Phase 1 is fundamentally a "promote duplicates to shared modules" milestone. Every "Don't Hand-Roll" item above already exists in the codebase 6+ times — the work is consolidation, not invention.

## Runtime State Inventory

> Phase 1 is a refactor + new-test-infrastructure phase. Some categories are non-trivially affected; document explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | LocalStorage `STORAGE_KEY = 'fitness_tracker_data'` is the only persisted key today. **Phase 1 introduces a new key namespace:** `fitness_tracker_data.backup.v{N}.{ISO}`. No existing key is renamed; no existing data needs migration. | **Code only.** No data migration. Existing user data continues to load through the V0→V4 chain unchanged. The new backup keys are written *prospectively* the first time a Phase 2/3 user upgrades to V5. |
| Live service config | None. There is no external service (Anthropic API key lives in `AppData.aiSettings`, not in service config). Electron `electron/main.js` has no Phase-1-relevant config. | None. |
| OS-registered state | None — Electron auto-update reads from GitHub releases; nothing in Phase 1 changes registry / Task Scheduler / launchd. | None. |
| Secrets / env vars | None. Anthropic API key is user-entered into `AppData.aiSettings.apiKey` (LocalStorage); no environment variable is read by the app. CI does not exist (no `.github/workflows/`). | None. |
| Build artifacts / installed packages | `node_modules/axe-core` will be added (`npm install -D axe-core`). `karma.conf.js` will be created at repo root, referenced from `angular.json`. No `.egg-info`-style stale artifacts; no compiled binaries. | **One-time:** `npm install` after `package.json` is updated. |

**Nothing found in category — explicit:** Live service config, OS-registered state, secrets/env vars all explicitly verified absent in this codebase. The only persisted state Phase 1 cares about is LocalStorage, and Phase 1 does not migrate any existing key — it only introduces a *new* key prefix for backups.

## Common Pitfalls

### Pitfall 1: `takeUntilDestroyed` retrofit causes NG0203 at runtime, not at compile time
**What goes wrong:** Developer adds `.pipe(takeUntilDestroyed())` (no arg) to a `subscribe` call inside `ngOnInit` instead of inside the field initializer. Compile passes, `ng serve` works on first load, then throws `NG0203 - inject() must be called from an injection context` the moment the component is created.
**Why it happens:** `takeUntilDestroyed()` with no argument calls `inject(DestroyRef)` internally; `inject()` only works inside an injection context (constructor, field initializer). Method bodies are not injection contexts. [VERIFIED: angular.dev/api/core/DestroyRef]
**How to avoid:** Establish a single retrofit pattern (Pattern 2 Form A): `private destroyRef = inject(DestroyRef);` as a field, then `.pipe(takeUntilDestroyed(this.destroyRef))` everywhere — including in `ngOnInit`, in event handlers, anywhere. This works from any context because the `inject(DestroyRef)` call happens at field-init time (which IS an injection context).
**Warning signs:** First `ng test` after retrofit shows `NG0203` errors. `ng build --configuration=production` passes (since it's a runtime error). Spec failures clustered in components recently retrofitted.

### Pitfall 2: `coverageReporter.check` fires on plain `ng test`
**What goes wrong:** Developer runs `ng test` for a quick sanity check; Karma fails the run because coverage is at 0% (no instrumentation = 0% reported). Dev loop is broken.
**Why it happens:** Some Karma configs put the `check` block at top level instead of inside `coverageReporter`, or wire it via a plugin that runs unconditionally.
**How to avoid:** Place the `check` block strictly inside `coverageReporter` (Pattern 1). `karma-coverage` only runs when `--code-coverage` is in argv; if it doesn't run, the `check` block is never evaluated. Verify by running `ng test --no-watch` (no `--code-coverage`) — should pass with no threshold messages.
**Warning signs:** `ng test` (without `--code-coverage`) prints `Coverage check failed` or similar.

### Pitfall 3: axe-core flags moderate violations as failures
**What goes wrong:** D-08 says fail on `serious | critical` only, but the spec is wired to fail on any non-empty `violations` array. Dev's `<input>` without an explicit `aria-label` (low-impact, has `<label for>` already) starts failing CI.
**Why it happens:** `results.violations` includes all impacts; filtering must be explicit. axe-core has no built-in impact filter. [VERIFIED: axe-core API.md]
**How to avoid:** Use the `expectNoSerousA11yViolations` helper (Pattern 3) which filters to `serious | critical` only. Add a comment in the helper explaining why moderates are not failures (QUAL-08 in Phase 5 does the manual sweep).
**Warning signs:** Many spec failures with `[moderate]` or `[minor]` impact tags in the failure message.

### Pitfall 4: Backup write itself overflows quota
**What goes wrong:** User's LocalStorage is at 99% used. They reload, parsed JSON triggers a migration, backup write attempts to add a copy of the existing data — `setItem` throws `QuotaExceededError`. The migration then can't proceed; user sees a recovery banner pointing at a backup that doesn't exist.
**Why it happens:** Doubling LocalStorage usage by writing a backup before any pruning is a real risk for chat-heavy users (CONCERNS.md flagged this is reachable in months).
**How to avoid:** (1) `pruneOldBackups()` runs **before** the new backup write to free space first. (2) Best-effort backup: catch the QuotaExceededError, log it, continue with migration. Migration failure should NOT depend on backup success — losing data due to a missing backup is worse than running migration without one. (3) Recovery banner copy should mention "Backup may not be available if storage is full." (4) QUAL-02 in Phase 5 adds quota detection at the UI; Phase 1 just does best-effort.
**Warning signs:** Migration succeeds but `localStorage.length` for backup keys is 0 immediately after.

### Pitfall 5: `crypto.randomUUID` undefined in Electron `file://`
**What goes wrong:** New `id.ts` blindly calls `crypto.randomUUID()`. Multiple production reports show this throws `crypto.randomUUID is not a function` in older Electron versions running from `file://`, even though MDN classifies `file://` as a potentially trustworthy origin.
**Why it happens:** Chromium <92 didn't expose the API; Electron 33 ships Chromium ~130, so it should be safe. **But**: feature detection is cheap insurance and matches the real MDN guidance ("This feature is available in secure contexts (HTTPS), in some or all supporting browsers"). [VERIFIED: MDN Crypto.randomUUID]
**How to avoid:** Implement `id.ts` with feature detection and a documented `Math.random()` fallback that matches the existing 6 copies' shape (so callers see no behavior change). Add a `// TODO: drop fallback once minimum Electron is N` comment with the version where this can be removed safely.
```typescript
// src/app/shared/id.ts
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts / very old engines.
  // Matches the existing per-service generateUUID() shape so this is a drop-in replacement.
  // TODO: remove once minimum supported runtime guarantees crypto.randomUUID (Electron >= 22, modern browsers).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```
**Warning signs:** Test harness on a developer laptop passes; user on shipped Electron build sees `crypto.randomUUID is not a function` in DevTools console after creating any new entity.

### Pitfall 6: Characterization specs over-assert on rendered text
**What goes wrong:** D-06 says "key user-flow specs (~3-6 per page), not full DOM snapshots." A spec that asserts `expect(el.textContent).toBe('Cardio Session: Running, 30 min, 5 km')` fails when QUAL-09 in Phase 5 makes a copy tweak. The test catches a non-bug.
**Why it happens:** The temptation when writing characterization tests is to capture *everything*. The point is to capture enough to detect regression in the *behavior*, not the wording.
**How to avoid:** Per D-06 examples ("renders day's meals from store", "add-meal flow updates daily totals", "empty state shows when no meals exist") — assert on shape, not text. `expect(el.querySelectorAll('.meal-row').length).toBe(3)` over `expect(el.textContent).toContain('Egg, large')`. Reserve text assertions for fixed UI scaffolding (page title, error code copy, etc.).
**Warning signs:** Phase 5 QUAL-09 PRs trip 20+ character spec failures all about text micro-changes.

### Pitfall 7: Missing `tsconfig.spec.json` `resolveJsonModule` blocks fixture imports
**What goes wrong:** Fixture-driven migration tests do `import v0Fixture from './migrations/fixtures/v0.json'` and the spec build fails with `TS2307: Cannot find module './migrations/fixtures/v0.json'`.
**Why it happens:** `resolveJsonModule` is `false` by default in TS; needs to be true to import JSON. Angular CLI's `tsconfig.app.json` may have it; `tsconfig.spec.json` may not.
**How to avoid:** Verify `tsconfig.spec.json` has `"resolveJsonModule": true, "esModuleInterop": true` before writing fixture imports. If absent, add them; this is not a behavior change for any production code. Alternative: load fixtures via `fetch()` from `assets/` — clunkier but config-free.
**Warning signs:** First migration-fixture spec compile error mentions JSON module resolution.

## Code Examples

Verified patterns from official sources, ready for the planner to reference task-by-task.

### `generateId()` with feature detection (D-02 area, FOUND-02)
See Pitfall 5 above for full code.

### `groupByDay` extraction (FOUND-02)
```typescript
// src/app/shared/chart-grouping.ts
// Source: lifted verbatim from charts-page.component.ts:594-646 with one rename
//         and one new export so reports-page.component.ts can consume it.

/** Local-time YYYY-MM-DD key for grouping by calendar day. */
export function toDateKey(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Group `readings` by local calendar day, averaging numeric fields the extractor returns. */
export function groupByDay<T extends { date: string }>(
  readings: T[],
  extractor: (r: T) => number[],
): { labels: string[]; averages: number[][] } {
  const map = new Map<string, number[][]>();
  for (const r of readings) {
    const key = toDateKey(r.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(extractor(r));
  }
  const sortedKeys = Array.from(map.keys()).sort();
  const labels: string[] = [];
  const averages: number[][] = [];
  for (const key of sortedKeys) {
    const group = map.get(key)!;
    const fieldCount = group[0].length;
    const avg: number[] = [];
    for (let i = 0; i < fieldCount; i++) {
      const sum = group.reduce((s, vals) => s + vals[i], 0);
      avg.push(sum / group.length);
    }
    labels.push(key);
    averages.push(avg);
  }
  return { labels, averages };
}

/** Round a value to two decimal places; small helper used by reports/charts. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
```

Then both `charts-page.component.ts` and `report-page.component.ts` import from `../../shared/chart-grouping`. Spec mirrors `date-range.spec.ts`.

### Standalone-component characterization scaffold (FOUND-04)
See Pattern 3 above.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `OnDestroy` lifecycle + `Subject` + `takeUntil(destroy$)` | `takeUntilDestroyed(this.destroyRef)` | Angular 16 (May 2023); stable in v18 | Less boilerplate; no `OnDestroy` interface needed; works in any class with a registered DestroyRef. |
| `as any` casts to read legacy migration fields | `LegacyAppDataVN` typed interfaces | TypeScript 4.x best practice; required by FOUND-07 / D-16 | Type system catches typos in legacy field names that previously slipped silently. |
| Per-page custom empty/error markup | Shared `<app-empty-state>` / `<app-error-state>` | QUAL-09's consistency review will rely on this | One component to update for app-wide copy/styling. |
| `Math.random()` UUID generator | `crypto.randomUUID()` with feature-detection fallback | Web Crypto API v2 (March 2022 widespread) | Cryptographically strong; statistically lower collision rate; one source of truth instead of six. |
| `tsconfig.json` `coverageInstrumentation` (long deprecated) | `karma-coverage` `check` block | karma-coverage 2.0+ | Per-pattern thresholds; integrates cleanly with Karma's reporter pipeline. |
| `OnDestroy + ngOnDestroy + chart.destroy()` for ng2-charts | (Phase 1 doesn't change this — Phase 5 may; CONCERNS.md flags ng2-charts upgrade risk) | n/a | Out of scope for Phase 1. |

**Deprecated/outdated in our codebase that Phase 1 does NOT fix (out of scope):**
- `setUTCDate / setUTCMonth / setUTCFullYear` in `date-range.ts:64-79` — CONCERNS.md flags this; **Phase 1 leaves it alone**, Phase 2 (DIET-08) fixes the timezone bug. Phase 1 only **extracts** `groupByDay/toDateKey/round2` to `shared/`, doesn't refactor the existing `date-range.ts`.
- `getStorageInfo()` hardcoded 5 MB — QUAL-02 in Phase 5 fixes via `navigator.storage.estimate()`.
- `<input type="password">` for API key without `safeStorage` — Phase 5 quality sweep.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tsconfig.spec.json` either has `"resolveJsonModule": true` or can have it added without breaking other specs | Pitfall 7 + Pattern 7 | Migration fixture tests need a different import strategy (e.g., `fetch` from assets). One Wave-0 verification step resolves this. |
| A2 | Angular 18.2 runs cleanly with `karma-coverage ~2.2.0`'s `check.each.overrides` (no breaking change between karma-coverage 2.x minors) | Pattern 1 | Plan must include a 5-minute spike: write the karma.conf.js, run `ng test --no-watch --code-coverage`, confirm threshold messages appear. |
| A3 | All 8 feature pages have at least one obvious "no data yet" or "error loading" surface that warrants the new component (D-13 retrofit is sensible everywhere) | Empty/error retrofit scope | Some pages (settings) may legitimately not need an empty-state. Per-page audit is the planner's responsibility — this research only confirms the components are reachable from every page, not that every page must use both. |
| A4 | The 6 `generateUUID` copies have identical behavior (same regex, same `Math.random` math) so a single `generateId()` is a drop-in replacement | Pattern 5 / D-02 area | Verified by `grep` (4 copies confirmed identical at services; chat.service.ts, diet-page.component.ts copies confirmed identical from spot-reads). Risk: zero. |
| A5 | Strict templates (`strictTemplates: true` per CONVENTIONS.md) will not fight the `@Input({ required: true })` pattern in `<app-empty-state>` | Pattern 4 | Falsifiable cheaply: write the component, run `ng build --configuration=production`. |
| A6 | The `retry.observed` pattern works under Angular 18 strict templates without complaint | Pattern 4 | Same falsification as A5. If it fights, fall back to an `@Input() showRetry: boolean = false`. |
| A7 | Puppeteer 24.37.3 bundles a Chromium that runs in WSL2 (the user's dev environment) without additional flags beyond `--no-sandbox` | Pattern 8 | Common WSL2 issue. If it fails on first run, add `--disable-gpu` and `--disable-dev-shm-usage`. |
| A8 | `localStorage.key(i)` and `localStorage.length` work correctly under Electron `file://` for backup-key iteration in `pruneOldBackups()` | Pattern 5 | These are W3C standard; broadly safe. Verified working under Chrome/Firefox; Electron uses Chromium so safe. |
| A9 | The recovery banner UX wording can wait until D-09's `<app-error-state>` lands (Claude's discretion area in CONTEXT.md) | Throughout | Per CONTEXT.md `<decisions>` "Claude's Discretion" — copy is intentionally not locked. Planner may iterate. |

**If this table is empty:** Not empty — these are open implementation-time decisions, all manageable with cheap one-step verification. None are blockers.

## Open Questions

1. **Should `chart-grouping.ts` merge into `date-range.ts`, or live as a separate module?**
   - What we know: CONTEXT.md `<code_context>` says "likely extending `date-range.ts` or a new `chart-grouping.ts`" — leaves it open.
   - What's unclear: `date-range.ts` is currently scoped to *date-range filtering* (`resolveDateRange`, `filterByRange`); `groupByDay/toDateKey/round2` are *grouping/aggregation* helpers. Different concerns.
   - Recommendation: **Separate module — `src/app/shared/chart-grouping.ts`.** Single-responsibility. Smaller test files. Easier to extend in Phase 2 (diet charts integration) without inflating `date-range.ts`. CONTEXT.md explicitly tags this as Claude's discretion.

2. **Empty-state vs error-state per page audit — which pages need both, which need one?**
   - What we know: D-13 says retrofit all 8 pages; copy/spacing/labels go to QUAL-09 in Phase 5.
   - What's unclear: Which surface(s) on each page get the new components.
   - Recommendation: Per-page audit lives in the planner's task decomposition. Defaults: every list page (cardio, weight, readings, charts, reports, diet meal log) needs **empty-state** for "no entries yet"; every page that does `storageService.initialize()` needs **error-state** for storage failures. Settings page gets error-state only (configuration, not data). Chat page gets both: empty for "no conversations" and error for "API key missing or invalid."

3. **Recovery banner: separate component or inline `<app-error-state>` in `AppComponent.html`?**
   - What we know: D-15 says "Uses `<app-error-state>` from D-09 once that lands."
   - What's unclear: Whether the banner is a thin wrapper that knows the recovery semantics (clipboard copy, retry, continue-empty), or a usage of `<app-error-state>` directly inside `AppComponent` template.
   - Recommendation: **Thin wrapper component `<app-recovery-banner>` in `src/app/shared/`**, internally composes `<app-error-state>` with the three D-15 actions and the recovery-key payload. Keeps `AppComponent` simple; isolates the LocalStorage/clipboard logic. The wrapper's actions delegate to a method on `StorageService` (e.g., `retryMigration()`, `getBackupJson(key)`).

4. **Where do the V0..V3 migration fixtures come from?**
   - What we know: D-17 says `src/app/services/migrations/fixtures/v{N}.json → v{N+1}-expected.json`.
   - What's unclear: Whether these are hand-built minimal examples or extracted from real-world data shapes seen in the wild.
   - Recommendation: **Hand-built minimal examples covering each migration's pivot fields.** V0 has no schemaVersion + cardio/weight/readings only. V1 has schemaVersion=1. V2 adds `nutrientsPer100g` and `servings.grams`. V3 has the post-V2→V3 shape. Each fixture is the smallest input that exercises every conditional branch in the corresponding `migrateVxToVy()`.

5. **Do characterization specs need to mock `Date.now()` for stable assertions?**
   - What we know: Cardio service spec uses `'should not use real timers'` per TESTING.md.
   - What's unclear: Charts/reports characterization may render "today" in `range presets`, which depends on wall-clock.
   - Recommendation: Use **`jasmine.clock().install()` per-spec where wall-clock matters**; reset in `afterEach`. Keep the existing per-service spec convention (use real `Date.now()`) intact for service specs. Document in the Wave-0 characterization-spec scaffold so all 4 page specs follow the same pattern.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All build/test commands | yes | v24.13.1 | — |
| npm | Dependency install | yes | 11.8.0 | — |
| Angular CLI (local) | `ng test`, `ng build`, `ng serve` | yes | `node_modules/.bin/ng` (Angular 18.2.21) | — |
| Karma | `ng test` | yes | `~6.4.0` (devDep) | — |
| Jasmine | `ng test` | yes | `~5.2.0` (devDep) | — |
| Chrome / ChromeHeadless | Karma test runner, axe-core in specs, Puppeteer e2e | yes (via karma-chrome-launcher 3.2.0; bundled with Puppeteer) | n/a | — |
| Puppeteer | FOUND-05 e2e harness | yes | `^24.37.3` (devDep, unused so far) | — |
| `axe-core` | FOUND-04 a11y assertions, FOUND-05 a11y harness | **no — must `npm install -D`** | not installed | — (no fallback; this is the chosen library) |
| Git | Commit hooks, branch ops | yes (working tree clean per gitStatus) | — | — |

**Missing dependencies with no fallback:**
- `axe-core` — must be installed. Single command: `npm install -D axe-core@^4`. Verified version 4.11.4 latest.

**Missing dependencies with fallback:**
- None.

**Verified absent (and explicitly NOT in Phase 1 scope):**
- `concurrently`, `wait-on` — could simplify e2e wiring but D-05 and STACK.md keep Phase 1 net-additive deps to one. E2E runs as two terminals (documented in `e2e/README.md`).
- `@axe-core/puppeteer` — unneeded. Plain `axe-core` with `page.addScriptTag` + `page.evaluate` is sufficient for the FOUND-05 scaffold.

## Validation Architecture

> `nyquist_validation` is enabled per `.planning/config.json`. This section defines the test dimensions Nyquist VALIDATION.md will extract.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Karma `~6.4.0` + Jasmine `~5.2.0` (existing) + axe-core `^4.11.4` (new dev dep) + Puppeteer `^24.37.3` (existing, unused) |
| Config file | `karma.conf.js` (NEW — extracted at repo root in Phase 1, D-03) |
| Quick run command | `ng test --no-watch` (no coverage check; fast iteration) |
| Full suite command | `ng test --no-watch --code-coverage` (triggers `coverageReporter.check` per D-04) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | `ng test --no-watch --code-coverage` fails when services drop below 90% statements | unit (config-level) | `ng test --no-watch --code-coverage` (full suite); spike spec that imports `karma.conf.js` and asserts threshold values | ❌ Wave 0 (`karma.conf.js`) |
| FOUND-01 | `ng test --no-watch` (no coverage) does NOT fail on threshold | unit (config-level) | `ng test --no-watch` exits 0 even with low coverage | ❌ Wave 0 |
| FOUND-02 | `generateId()` returns a UUID-shaped string under both `crypto.randomUUID` available and unavailable paths | unit | `pytest`-equivalent: `ng test --include='src/app/shared/id.spec.ts'` | ❌ Wave 0 (`src/app/shared/id.spec.ts`) |
| FOUND-02 | All 6 services produce IDs from `generateId()` (no remaining `Math.random` in services or components) | unit | grep regression in CI: `! grep -rn "Math.random()" src/app --include="*.ts"` (Wave 0 adds the negative-grep gate) | ❌ Wave 0 |
| FOUND-02 | `groupByDay` produces stable keys + averaged values (regression for `b6149d2`) | unit | `ng test --include='src/app/shared/chart-grouping.spec.ts'` | ❌ Wave 0 |
| FOUND-03 | Subscribing-then-destroying a feature page does not leak the subscription | unit (component) | `ng test --include='**/cardio-page.component.spec.ts'` (and 7 others) — assert `fixture.destroy()` followed by emitting on the source observable does NOT trigger the subscription handler | ❌ Wave 0 (8 page specs) |
| FOUND-04 | `diet-page` renders day's meals from store (characterization) | unit (component) | `ng test --include='**/diet-page.component.spec.ts'` | ❌ Wave 0 |
| FOUND-04 | `chat-page` renders conversation list and active conversation (characterization) | unit (component) | `ng test --include='**/chat-page.component.spec.ts'` | ❌ Wave 0 |
| FOUND-04 | `charts-page` renders chart with grouped data (characterization) | unit (component) | `ng test --include='**/charts-page.component.spec.ts'` | ❌ Wave 0 |
| FOUND-04 | `report-page` renders printable view with date range (characterization) | unit (component) | `ng test --include='**/report-page.component.spec.ts'` | ❌ Wave 0 |
| FOUND-05 | Puppeteer smoke navigates `/cardio`, `/weight`, `/readings`, `/diet`, `/charts`, `/report`, `/chat`, `/settings` without console errors | e2e (manual until smoke is wired) | `npm run e2e` (with `ng serve` running in another terminal) | ❌ Wave 0 (`e2e/run.mjs`, `e2e/smoke.spec.mjs`) |
| FOUND-05 | axe-core injected per route returns no `serious|critical` violations | e2e (manual) | `npm run e2e` (a11y spec runs as part of harness) | ❌ Wave 0 (`e2e/a11y.spec.mjs`) |
| FOUND-05 | (in-spec) every characterization spec runs `axe.run(fixture.nativeElement)` | unit (component) | Embedded in FOUND-04 specs | ❌ Wave 0 (`src/app/shared/a11y-test-helpers.ts`) |
| FOUND-06 | `<app-empty-state>` renders title + ng-content action; spec mounts it standalone | unit (component) | `ng test --include='**/empty-state.component.spec.ts'` | ❌ Wave 0 |
| FOUND-06 | `<app-error-state>` maps `StorageError.code === 'PARSE_ERROR'` to "Stored data couldn't be read" | unit (component) | `ng test --include='**/error-state.component.spec.ts'` | ❌ Wave 0 |
| FOUND-06 | All 8 pages reference at least one of the new components (verifiable via DOM assertion in characterization specs OR via grep in CI) | unit / static | Grep gate: `for f in src/app/features/**/*.component.ts; do grep -l 'app-empty-state\|app-error-state' $f; done | wc -l` ≥ 8 | ❌ Wave 0 |
| FOUND-07 | Backup key written to `fitness_tracker_data.backup.v{N}.{ISO}` before every migration run | unit | `ng test --include='**/storage.service.spec.ts'` — assert backup key matches regex after migration | partial: `storage.service.spec.ts` exists; new `describe` blocks added |
| FOUND-07 | Migration `as any` casts replaced — TS strict-check catches typos | unit (compile-level) | `ng build --configuration=production` succeeds; no `as any` in `storage.service.ts` (negative grep) | partial — needs verification |
| FOUND-07 | V0→V4 migrations produce expected fixture shapes | unit | `ng test --include='**/storage.service.migration-fixtures.spec.ts'` | ❌ Wave 0 |
| FOUND-07 | Migration failure throws `StorageError('MIGRATION_FAILED')` carrying recovery key | unit | `ng test` — corrupt fixture in localStorageMock; assert error code + recovery key string | ❌ Wave 0 |
| FOUND-07 | Malformed input matrix (`null`, `{}`, wrong types, missing fields) does not silently corrupt data | unit | Same as above; `describe('malformed-input matrix', ...)` block | ❌ Wave 0 |
| FOUND-07 | Backups beyond last 3 are pruned | unit | `ng test` — pre-seed 4 backup keys with sortable timestamps; assert oldest is removed after migration | ❌ Wave 0 |
| FOUND-07 | Recovery banner renders on migration failure with key visible | unit (component) | `ng test --include='**/recovery-banner.component.spec.ts'` (or assert in `app.component.spec.ts`) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `ng test --no-watch` (skips coverage threshold; ~< 30s after all Phase 1 specs land)
- **Per wave merge:** `ng test --no-watch --code-coverage` + `ng build --configuration=production`
- **Phase gate:** Both above + `npm run e2e` (smoke + a11y) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `karma.conf.js` — covers FOUND-01 (config-level)
- [ ] `src/app/shared/id.ts` + `id.spec.ts` — covers FOUND-02 (UUID consolidation)
- [ ] `src/app/shared/chart-grouping.ts` + `chart-grouping.spec.ts` — covers FOUND-02 (grouping extraction)
- [ ] `src/app/shared/a11y-test-helpers.ts` — covers FOUND-04/FOUND-05 (axe in specs)
- [ ] `src/app/shared/empty-state.component.ts` + spec — covers FOUND-06
- [ ] `src/app/shared/error-state.component.ts` + spec — covers FOUND-06
- [ ] `src/app/shared/recovery-banner.component.ts` (recommended thin wrapper, see Open Q3) + spec — covers FOUND-07
- [ ] `src/app/services/legacy-schemas.ts` — covers FOUND-07 (typed legacy interfaces)
- [ ] `src/app/services/migrations/fixtures/v0..v3.json` + `v1..v4-expected.json` — covers FOUND-07 (fixture-driven tests)
- [ ] `src/app/services/migrations/fixtures/malformed/*.json` — covers FOUND-07 (malformed-input matrix)
- [ ] `src/app/services/storage.service.migration-fixtures.spec.ts` — wires fixtures
- [ ] `src/app/features/diet/diet-page.component.spec.ts` + 3 more (chat, charts, reports) — covers FOUND-04
- [ ] `e2e/run.mjs`, `e2e/smoke.spec.mjs`, `e2e/a11y.spec.mjs`, `e2e/README.md`, `e2e/fixtures/` — covers FOUND-05
- [ ] **No new framework install** beyond `npm install -D axe-core@^4`. (Karma + Jasmine + Puppeteer already installed.)

## Security Domain

> `security_enforcement: true` and `security_asvs_level: 1` per `.planning/config.json`. Phase 1 is largely test/instrumentation; security surface is small but not zero.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — single-user local app, no authentication. |
| V3 Session Management | no | n/a — no sessions. |
| V4 Access Control | no | n/a — no multi-user model. |
| V5 Input Validation | partial | Phase 1's typed `LegacyAppDataVN` interfaces (D-16) act as **input validators on the LocalStorage→memory boundary**. Stored JSON is the input; typed shapes ensure unknown / wrong-typed fields don't reach business logic. The malformed-input migration matrix (D-17) is the V5 test surface. |
| V6 Cryptography | partial | `crypto.randomUUID()` is the chosen ID source (FOUND-02). Pattern 5 (feature detection + `Math.random` fallback) explicitly notes the fallback is **not cryptographically strong** but is acceptable because IDs are local-only identifiers, not authentication tokens or session keys. Document this in `id.ts` JSDoc so future readers don't mistake fallback IDs for crypto-strength. |
| V12 File and Resources | yes | Recovery-key cleanup (`pruneOldBackups()`) operates on LocalStorage keys filtered by prefix; **must not** delete keys outside the prefix. Spec asserts `STORAGE_KEY` itself is never matched by the prune. |

### Known Threat Patterns for Phase 1 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Untyped legacy data corrupts after migration | Tampering (data integrity) | Typed `LegacyAppDataVN` interfaces (D-16); fixture-driven tests + malformed-input matrix (D-17). |
| Migration failure silently destroys user data | Repudiation, Denial of Service | Backup-before-migrate (D-14); migration-failure recovery banner (D-15) with explicit recovery-key surface. |
| Backup key collision wipes a different store | Tampering | `pruneOldBackups()` filters strictly on `BACKUP_KEY_PREFIX`; spec asserts `STORAGE_KEY` is never matched. |
| `crypto.randomUUID` fallback weakens ID entropy | Spoofing (collision) | IDs are local identifiers, not security tokens. Document in `id.ts` JSDoc. CLAUDE.md never claims IDs are cryptographically strong; this is consistent. |
| Recovery banner leaks raw error stack to user | Information Disclosure | `<details>` collapsed by default; raw text is the user's own error from the user's own machine — not a multi-tenant disclosure risk. Acceptable for single-user local app. |
| `.subscribe()` leak retains references including potentially sensitive data | Information Disclosure (memory) | `takeUntilDestroyed` retrofit (FOUND-03) directly fixes the long-running-observable-retains-component case. |

## Project Constraints (from CLAUDE.md)

The planner must verify every Phase 1 plan against these binding directives. Quoted from `./CLAUDE.md`:

- **Standalone components only:** "All components declare `standalone: true` and list their dependencies in `imports: []`." → `<app-empty-state>`, `<app-error-state>`, characterization-spec mounts use `imports: [TheStandaloneComponent]`, never `declarations`.
- **No NgModules:** "Do NOT use NgModules — all components must be standalone." → No NgModule introduced for the new shared components.
- **Storage chokepoint:** "Do NOT access LocalStorage directly from components or services other than `StorageService`." → Backup write logic (D-14) lives inside `StorageService`. The recovery banner consumes via `StorageService` methods, not `localStorage.getItem`.
- **No `any`:** "Do NOT use `any` type without documented justification." → FOUND-07 / D-16 explicitly removes the existing 5 `as any` casts in `storage.service.ts`.
- **No `null` for absent fields:** "Do NOT store `null` for absent optional fields — use `undefined` / omit the field." → New `LegacyAppDataVN` interfaces use optional `?` properties; new `<app-error-state>` `error?` input never receives `null`.
- **Unit tests required:** "Every service must have a `.spec.ts` file." → Every new module ships with a spec: `id.spec.ts`, `chart-grouping.spec.ts`, `empty-state.component.spec.ts`, `error-state.component.spec.ts`, migration-fixtures spec, etc.
- **Schema migration discipline:** "For every schema change, add a sequential `migrateVxToVy()` that defaults the new field, append it to the chain in `migrateData()`, and add a unit test." → Phase 1 doesn't add a new migration but **strengthens the existing chain** with typed shapes + fixtures. Phases 2/3 build on this.
- **Commit format:** `<type>(<scope>): <description>` → `feat(test)`, `feat(shared)`, `refactor(storage)`, `test(migrations)`, `docs(01)`, etc.
- **Function over form:** "Working functionality before visual polish." → Recovery banner copy and empty/error component styling are Claude's discretion (CONTEXT.md); QUAL-09 in Phase 5 polishes.

## File-Level Plan (grouped by decision)

> Concrete file-touch list the planner can decompose into tasks. **NEW** = file does not exist; **MOD** = file exists, modify; **DEL** = file exists, delete.

### D-01..D-04 — Coverage thresholds (FOUND-01)
- **NEW** `karma.conf.js` (repo root) — full Karma config + `coverageReporter.check` block (Pattern 1).
- **MOD** `angular.json` (lines 73-93) — add `"karmaConfig": "./karma.conf.js"` to `architect.test.options`.
- **MOD** `package.json` — add `npm install -D axe-core@^4` (devDependency add); no script changes (D-04 keeps `ng test` for dev).
- **NEW** (optional) `tsconfig.spec.json` patch — `"resolveJsonModule": true` if absent (verify; see Pitfall 7).

### D-02 area — Shared utilities (FOUND-02)
- **NEW** `src/app/shared/id.ts` — `generateId()` with feature detection (Pattern 5 / Pitfall 5 code).
- **NEW** `src/app/shared/id.spec.ts` — covers crypto-available + fallback paths.
- **NEW** `src/app/shared/chart-grouping.ts` — `groupByDay`, `toDateKey`, `round2` lifted from `charts-page.component.ts:594-646`.
- **NEW** `src/app/shared/chart-grouping.spec.ts` — boundary tests + characterization for `b6149d2` averaging fix.
- **MOD** `src/app/services/cardio.service.ts:24` — replace local `generateUUID` with `import { generateId } from '../shared/id'`.
- **MOD** `src/app/services/weight.service.ts:24` — same.
- **MOD** `src/app/services/readings.service.ts:38` — same.
- **MOD** `src/app/services/diet.service.ts:26` — same. (Multiple call sites: lines 74, 80, 120, 163, 250, 267, 403.)
- **MOD** `src/app/services/chat.service.ts:13` — same.
- **MOD** `src/app/features/diet/diet-page.component.ts:9-15` — DELETE the local `generateUUID`, lift IDs into `DietService` per CONCERNS.md "ID generation leaked into a feature component". Lines 774, 846 are the call sites.
- **MOD** `src/app/features/charts/charts-page.component.ts:594-646` — DELETE the three private functions; import from `../../shared/chart-grouping`.
- **MOD** `src/app/features/reports/report-page.component.ts:472-565` — refactor to import `groupByDay`/`toDateKey`/`round2` from the same place. Per CONCERNS.md, this page may not currently share the averaging — D-02 explicitly fixes that drift.

### D-03 — Karma config extraction (FOUND-01)
- See D-01 above (`karma.conf.js` creation + `angular.json` wiring).

### D-04 — `--code-coverage` gates the check (FOUND-01)
- See D-01 above; behavior is governed by `karma-coverage`'s argv detection.

### D-05..D-08 — Characterization tests + axe-core (FOUND-04, FOUND-05)
- **NEW** `src/app/shared/a11y-test-helpers.ts` — `expectNoSerousA11yViolations(root)` (Pattern 3).
- **NEW** `src/app/features/diet/diet-page.component.spec.ts` — ~3-6 specs per D-06: "renders saved foods from store", "renders day's meals", "add-meal flow updates daily totals", "empty state when no meals", "error state when storage fails", "no serious/critical a11y violations". Mocks: `DietService`, `StorageService`.
- **NEW** `src/app/features/chat/chat-page.component.spec.ts` — ~3-6 specs: "renders conversation list", "switches active conversation", "renders message list for active conversation", "empty state when no conversations", "no serious/critical a11y violations". Mocks: `ChatService`, `AISettingsService`, `StorageService`.
- **NEW** `src/app/features/charts/charts-page.component.spec.ts` — ~3-6 specs: "renders chart with grouped readings (regression for b6149d2)", "responds to date range change", "print/export button navigates", "no serious/critical a11y violations". Mocks: `CardioService`, `WeightService`, `ReadingsService`, `StorageService`.
- **NEW** `src/app/features/reports/report-page.component.spec.ts` — ~3-6 specs paralleling charts. Mocks: same as charts.

### D-09..D-13 — Empty/error state pattern (FOUND-06)
- **NEW** `src/app/shared/empty-state.component.ts` (Pattern 4 code).
- **NEW** `src/app/shared/empty-state.component.spec.ts` — title required, message optional, ng-content slot renders.
- **NEW** `src/app/shared/error-state.component.ts` (Pattern 4 code).
- **NEW** `src/app/shared/error-state.component.spec.ts` — `StorageError` code mapping, retry emits, `<details>` collapsed by default.
- **MOD** `src/app/features/cardio/cardio-page.component.ts` — import `EmptyStateComponent` + `ErrorStateComponent`; add to template at the empty-list and error-load spots.
- **MOD** `src/app/features/weight/weight-page.component.ts` — same.
- **MOD** `src/app/features/readings/readings-page.component.ts` — same.
- **MOD** `src/app/features/diet/diet-page.component.ts` — same (food library empty + meal log empty + storage error).
- **MOD** `src/app/features/charts/charts-page.component.ts` — same (empty data range + error). Existing `rangeError` banner in `charts-page` may merge into `<app-error-state>`.
- **MOD** `src/app/features/reports/report-page.component.ts` — same.
- **MOD** `src/app/features/chat/chat-page.component.ts` — same (no conversations + API key missing/invalid).
- **MOD** `src/app/features/settings/settings-page.component.ts` — same (storage error only; settings has no empty surface).

### FOUND-03 — Subscription hygiene (orthogonal to D-XX letters)
- **MOD** `src/app/features/cardio/cardio-page.component.ts` — `private destroyRef = inject(DestroyRef);` field; add `.pipe(takeUntilDestroyed(this.destroyRef))` to all 4+ subscribe calls.
- **MOD** `src/app/features/weight/weight-page.component.ts` — same shape.
- **MOD** `src/app/features/readings/readings-page.component.ts` — same.
- **MOD** `src/app/features/diet/diet-page.component.ts` — 8 subscribe sites (lines 587, 641, 690, 724, 822, 877, 893, 903 per grep above).
- **MOD** `src/app/features/charts/charts-page.component.ts` — same.
- **MOD** `src/app/features/reports/report-page.component.ts` — same.
- **MOD** `src/app/features/chat/chat-page.component.ts` — 7 subscribe sites including nested ones at lines 187, 246, 261. Nested subscribes deserve a refactor to `switchMap` while in there, but **do not refactor in Phase 1** — out of scope; only retrofit `takeUntilDestroyed`.
- **MOD** `src/app/features/settings/settings-page.component.ts` — 3 subscribe sites.

### D-14..D-17 — Schema migration discipline (FOUND-07)
- **NEW** `src/app/services/legacy-schemas.ts` — `LegacyAppDataV0..V3`, `LegacySavedFoodV2` (Pattern 6).
- **MOD** `src/app/services/storage.service.ts:64-111` — refactor `initialize()` to: (a) backup-before-migrate, (b) prune backups, (c) call typed migrate chain, (d) throw typed `StorageError('MIGRATION_FAILED')` on failure.
- **MOD** `src/app/services/storage.service.ts:234-321` — replace `(data as any)` casts with `LegacyAppDataVN` typed parameters; migration functions become `migrateV0ToV1(data: LegacyAppDataV0): LegacyAppDataV1` and so on.
- **MOD** `src/app/services/storage.service.ts:184-206` — leave `getStorageInfo()` alone (Phase 5 / QUAL-02 fixes hardcoded 5 MB; Phase 1 out of scope).
- **NEW** `src/app/services/migrations/fixtures/v0.json`, `v1.json`, `v2.json`, `v3.json`, plus `v1-expected.json`, `v2-expected.json`, `v3-expected.json`, `v4-expected.json`.
- **NEW** `src/app/services/migrations/fixtures/malformed/null.json`, `empty-object.json`, `wrong-types.json`, `missing-fields.json`.
- **NEW** `src/app/services/storage.service.migration-fixtures.spec.ts` — fixture-driven tests + malformed-input matrix (Pattern 7 code).
- **MOD** `src/app/services/storage.service.spec.ts` — add `describe('backup-before-migrate', ...)` and `describe('migration failure recovery', ...)` blocks. Existing tests at lines 213-350 stay green.
- **NEW** `src/app/shared/recovery-banner.component.ts` — thin wrapper composing `<app-error-state>` with three actions: Retry / Copy backup JSON / Continue empty (Open Question 3 recommendation).
- **NEW** `src/app/shared/recovery-banner.component.spec.ts` — covers all three action paths + clipboard fallback if `navigator.clipboard` unavailable.
- **MOD** `src/app/app.component.ts` + `app.component.html` — catch the migration error from `StorageService.initialize()` and render `<app-recovery-banner>` ahead of `<router-outlet>`. Suppress `<router-outlet>` until banner is dismissed (Continue empty) or migration succeeds (Retry).
- **MOD** `src/app/app.component.spec.ts` — add a spec asserting the banner renders when initialize fails with `MIGRATION_FAILED`.

### FOUND-05 — Puppeteer + axe-core e2e scaffolds (separate harness)
- **NEW** `e2e/run.mjs` — entrypoint (Pattern 8 code).
- **NEW** `e2e/smoke.spec.mjs` — per-route navigation; assert no console errors.
- **NEW** `e2e/a11y.spec.mjs` — `page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })` + `page.evaluate(() => axe.run())`.
- **NEW** `e2e/fixtures/seed-data.json` — minimal AppData seed for repeatable runs.
- **NEW** `e2e/README.md` — two-terminal flow; environment variables; how to add a new page to the smoke list.
- **MOD** `package.json` — add `"e2e": "node e2e/run.mjs"` script. **Do not** add concurrency / wait-on deps.

## Sources

### Primary (HIGH confidence)
- [Angular: takeUntilDestroyed API reference](https://angular.dev/api/core/rxjs-interop/takeUntilDestroyed) — function signature, optional DestroyRef parameter, stable since v19 [VERIFIED via WebFetch 2026-05-02]
- [Angular: DestroyRef API reference](https://angular.dev/api/core/DestroyRef) — `inject(DestroyRef)` injection-context rules, scope semantics [VERIFIED via WebFetch 2026-05-02]
- [karma-coverage configuration docs](https://github.com/karma-runner/karma-coverage/blob/master/docs/configuration.md) — `coverageReporter.check.global / each / overrides` syntax with glob keys [VERIFIED via WebFetch 2026-05-02]
- [axe-core API.md](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md) — `axe.run(context, options?)` Promise/callback dual API; violation impact taxonomy `minor | moderate | serious | critical`; result-array filtering [VERIFIED via WebFetch 2026-05-02]
- [MDN: Crypto.randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) — secure-context requirement, browser availability since March 2022 [VERIFIED via WebFetch 2026-05-02]
- [MDN: Secure Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) — `file://` is potentially trustworthy, qualifies as secure context [VERIFIED via WebFetch 2026-05-02]
- Internal: `.planning/phases/01-foundations/01-CONTEXT.md` — 17 locked decisions D-01..D-17
- Internal: `.planning/REQUIREMENTS.md` — FOUND-01..07
- Internal: `.planning/ROADMAP.md` §"Phase 1: Foundations"
- Internal: `.planning/codebase/TESTING.md`, `CONCERNS.md`, `CONVENTIONS.md`, `ARCHITECTURE.md`, `STRUCTURE.md` (read directly)
- Internal: `.planning/research/SUMMARY.md`, `PITFALLS.md`, `STACK.md`, `ARCHITECTURE.md`
- Internal: `CLAUDE.md` — binding project instructions
- Internal source files (read directly): `src/app/services/storage.service.ts`, `storage.service.spec.ts`, `cardio.service.ts`, `chat.service.ts`, `app.component.spec.ts`, `angular.json`, `package.json`, `tsconfig.json`, `tsconfig.spec.json` (referenced), `src/app/shared/date-range.ts`, `src/app/features/charts/charts-page.component.ts`

### Secondary (MEDIUM confidence)
- npm registry queries for current versions: `axe-core@4.11.4`, `convert@7.0.0`, `@anthropic-ai/sdk@0.92.0` [VERIFIED via `npm view <pkg> version` 2026-05-02; only `axe-core` is Phase 1 relevant]
- WebSearch — `crypto.randomUUID undefined Electron file:// renderer 2025` — multiple production reports of feature-detection-required pattern [several sources, MEDIUM]

### Tertiary (background)
- [puppeteer release notes / pptr.dev](https://pptr.dev) — `headless: 'new'` default since v22 [WebFetch returned 404 on direct URL; cross-referenced from search results]
- Existing project research at `.planning/research/PITFALLS.md` Pitfalls 3 (schema corruption), 4 (typed legacy interfaces), 5 (snapshot enforcement — applies to Phase 2 not Phase 1), 13 (refactoring without behavior tests), 14 (strict-template / NG0203)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library version, every API surface confirmed against official docs (Angular, karma-coverage, axe-core, MDN) within 24 hours of writing this research.
- Architecture: HIGH — every locked decision in CONTEXT.md is mechanically supported by the verified API surfaces. No decision needs to be reopened.
- Pitfalls: HIGH — five Phase 1-specific pitfalls verified against either official docs (NG0203, axe filtering) or production reports (`crypto.randomUUID` Electron edge case). Two more (resolveJsonModule, characterization-spec over-assertion) are common Karma/test-discipline gotchas that any Angular team faces.

**Research date:** 2026-05-02
**Valid until:** 2026-06-01 (30 days; stable Angular 18.2.x ecosystem). Re-verify the `axe-core` version pin and `@axe-core/puppeteer` decision if Phase 1 work slips past June.

## RESEARCH COMPLETE
