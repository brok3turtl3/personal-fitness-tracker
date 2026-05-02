# Codebase Structure

**Analysis Date:** 2026-05-02

## Directory Layout

```
personal-fitness-tracker/
├── src/
│   ├── main.ts                       # Angular bootstrap
│   ├── index.html                    # Single-page HTML shell
│   ├── styles.css                    # Global stylesheet
│   └── app/
│       ├── app.component.ts          # Root component (nav + outlet)
│       ├── app.component.html
│       ├── app.component.css
│       ├── app.component.spec.ts
│       ├── app.config.ts             # Router + chart.js + zone providers
│       ├── app.routes.ts             # Lazy-loaded route table
│       ├── models/                   # Pure interfaces (no logic)
│       │   ├── app-data.model.ts     # AppData root + CURRENT_SCHEMA_VERSION + STORAGE_KEY
│       │   ├── cardio-session.model.ts
│       │   ├── weight-entry.model.ts
│       │   ├── health-reading.model.ts
│       │   ├── diet.model.ts         # SavedFood, MealItem, MealEntry, NutritionTotals
│       │   ├── ai-chat.model.ts      # ChatConversation, AISettings, CLAUDE_MODELS
│       │   └── index.ts              # Barrel export (does NOT re-export diet.model)
│       ├── services/
│       │   ├── storage.service.ts    # SOLE LocalStorage owner; migrations
│       │   ├── cardio.service.ts
│       │   ├── weight.service.ts
│       │   ├── readings.service.ts
│       │   ├── diet.service.ts
│       │   ├── chat.service.ts       # Calls Anthropic via anthropic-api.service
│       │   ├── ai-settings.service.ts
│       │   ├── fitness-context.service.ts  # Builds chat system prompt
│       │   ├── anthropic-api.service.ts    # fetch() to api.anthropic.com
│       │   ├── validators.ts         # Shared validation helpers + VALIDATION_LIMITS
│       │   └── *.spec.ts             # One spec per service + validators.spec.ts
│       ├── features/                 # One folder per route
│       │   ├── cardio/cardio-page.component.ts
│       │   ├── weight/weight-page.component.ts
│       │   ├── readings/readings-page.component.ts
│       │   ├── diet/diet-page.component.ts
│       │   ├── charts/charts-page.component.ts
│       │   ├── reports/report-page.component.ts
│       │   ├── settings/settings-page.component.ts
│       │   └── chat/                 # Multi-component feature
│       │       ├── chat-page.component.ts
│       │       ├── chat-conversation-list.component.ts
│       │       ├── chat-message-list.component.ts
│       │       └── chat-input.component.ts
│       └── shared/
│           ├── nav.component.ts      # Top nav, reads version from package.json
│           ├── date-range.ts         # Pure date helpers
│           └── date-range.spec.ts
├── public/
│   └── favicon.ico
├── electron/                         # Optional desktop shell
│   ├── main.js                       # BrowserWindow + electron-updater
│   ├── preload.js
│   └── icon.png
├── docs/                             # Design-phase reference docs (may be stale)
│   ├── data-model.md
│   ├── features.md
│   └── service-contracts.md
├── dist/                             # ng build output (gitignored)
├── release/                          # electron-builder output (gitignored)
├── angular.json                      # Angular CLI workspace config
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.spec.json
├── package.json                      # Scripts, deps, electron-builder config
├── package-lock.json
├── README.md
└── CLAUDE.md                         # Project overview / conventions
```

## Directory Purposes

**`src/`:**
- Purpose: Angular application source.
- Contains: bootstrap (`main.ts`), HTML/CSS shells, and `app/` subtree.

**`src/app/models/`:**
- Purpose: Pure data interfaces and constants — no Angular, no RxJS, no I/O.
- Contains: One file per logical entity (`*.model.ts`) plus `index.ts` barrel.
- Key files: `app-data.model.ts` (root container, `STORAGE_KEY = 'fitness_tracker_data'`, `CURRENT_SCHEMA_VERSION = 4`, `createEmptyAppData()`), `health-reading.model.ts` (discriminated union), `diet.model.ts`, `ai-chat.model.ts`.
- Note: `index.ts` re-exports `app-data`, `cardio-session`, `weight-entry`, `health-reading`, `ai-chat` — diet types are imported directly from `./diet.model` (the barrel intentionally does not include them today).

**`src/app/services/`:**
- Purpose: Domain services, validation, and the single LocalStorage abstraction.
- Contains: one `*.service.ts` per domain plus shared `validators.ts` and per-file `*.spec.ts`.
- Key files: `storage.service.ts` (the persistence boundary), `validators.ts` (`VALIDATION_LIMITS`, `ValidationError`, `ValidationResult`).

**`src/app/features/`:**
- Purpose: Route-targeted UI pages.
- Contains: one folder per route, each holding a `<route>-page.component.ts`. The `chat` folder additionally contains presentational sub-components.
- Pattern: Standalone components only; lazy-loaded by `app.routes.ts`.

**`src/app/shared/`:**
- Purpose: Cross-cutting UI / utilities reused by multiple features.
- Contains: `nav.component.ts` (used by `AppComponent`), `date-range.ts` + spec (used by charts and reports).

**`public/`:**
- Purpose: Static assets copied verbatim into the build output.
- Contains: `favicon.ico`.

**`electron/`:**
- Purpose: Desktop shell that loads the built Angular bundle.
- Contains: `main.js` (creates `BrowserWindow`, wires `electron-updater`), `preload.js`, `icon.png`.

**`docs/`:**
- Purpose: Design-phase reference documentation.
- Contains: `data-model.md`, `features.md`, `service-contracts.md`. Treat as background — TypeScript source is authoritative.

**`dist/` and `release/`:**
- Generated. `dist/` is the Angular CLI build output; `release/` is the `electron-builder` output (`win-unpacked/`, `linux-unpacked/`).

## Key File Locations

**Entry Points:**
- `src/main.ts` — Angular bootstrap.
- `src/app/app.config.ts` — App-wide providers (router with hash location, charts).
- `src/app/app.routes.ts` — All routes, all `loadComponent`-based.
- `src/app/app.component.ts` + `src/app/app.component.html` — Root shell.
- `electron/main.js` — Desktop shell (alternate launch path; `package.json` `main`).

**Configuration:**
- `angular.json` — CLI workspace (build/test/serve targets).
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json` — TypeScript configs (strict mode).
- `package.json` — Scripts (`ng serve`, `ng test`, `ng build`, `electron:dev`, `electron:build`, `electron:publish`); `build` block holds `electron-builder` config.

**Core Logic:**
- `src/app/services/storage.service.ts` — The persistence boundary. All schema migrations live here.
- `src/app/services/validators.ts` — Shared validation rules and `VALIDATION_LIMITS`.
- `src/app/models/app-data.model.ts` — Root data shape and `CURRENT_SCHEMA_VERSION`.

**Testing:**
- `src/app/**/*.spec.ts` — Co-located unit specs (Jasmine + Karma).
- `src/app/services/*.spec.ts` — One spec per service.
- `src/app/services/validators.spec.ts` — Pure-function validator tests.
- `src/app/shared/date-range.spec.ts` — Pure-function date helpers tests.
- `src/app/app.component.spec.ts` — Root component sanity test.

## Naming Conventions

**Files:**
- Models: `<entity>.model.ts` (kebab-case + `.model.ts`); barrel at `index.ts`.
- Services: `<domain>.service.ts` with sibling `<domain>.service.spec.ts`.
- Page components: `<route>-page.component.ts` inside `features/<route>/`.
- Sub-components (chat): `<feature>-<role>.component.ts` (e.g. `chat-message-list.component.ts`).
- Shared utilities: kebab-case `.ts` (e.g. `date-range.ts`); shared components: `<name>.component.ts`.
- Tests: always `<source>.spec.ts`, co-located with the source file.

**Directories:**
- `features/<route>/` — one directory per top-level route; matches the URL segment.
- All other folders are flat under `src/app/` (`models`, `services`, `shared`).

**Symbols (TypeScript):**
- Interfaces: `PascalCase` (e.g. `CardioSession`, `AppData`, `MealEntry`).
- DTO inputs: `Create<Entity>` (e.g. `CreateCardioSession`, `CreateMealEntry`).
- Discriminator literals: snake_case strings (`'blood_pressure'`, `'blood_glucose'`, `'ketone'`).
- Constants: `SCREAMING_SNAKE_CASE` (`CURRENT_SCHEMA_VERSION`, `STORAGE_KEY`, `VALIDATION_LIMITS`, `CARDIO_TYPES`, `READING_TYPES`, `CLAUDE_MODELS`).
- Selectors: `app-<name>` (e.g. `app-cardio-page`, `app-nav`, `app-chat-input`).

**Routes:**
- Path matches feature folder (`/cardio`, `/weight`, `/readings`, `/diet`, `/charts`, `/chat`, `/settings`).
- Exception: `/report` (singular) loads from `features/reports/report-page.component.ts`.

## Where to Add New Code

**New domain entity (e.g. "exercise plan"):**
1. Add interface(s) in `src/app/models/<entity>.model.ts` with `id`, `createdAt`, `updatedAt` (ISO 8601 strings) and a `Create<Entity>` DTO.
2. Add the new collection to `AppData` in `src/app/models/app-data.model.ts`, bump `CURRENT_SCHEMA_VERSION`, and add a `migrateVxToVy()` in `src/app/services/storage.service.ts` that defaults the field for existing users; append it to the chain inside `migrateData()`.
3. Re-export from `src/app/models/index.ts` (or import directly, following the diet precedent).
4. Create `src/app/services/<entity>.service.ts` with `@Injectable({ providedIn: 'root' })`, validation, UUID + timestamp generation, and Observable CRUD.
5. Add `src/app/services/<entity>.service.spec.ts` (Jasmine).
6. Add validation rules to `src/app/services/validators.ts` if they're shared, otherwise inline in the service.

**New route / page:**
- Create `src/app/features/<route>/<route>-page.component.ts` (standalone, `selector: 'app-<route>-page'`).
- Add the lazy `loadComponent` route to `src/app/app.routes.ts`.
- Add a nav link to `src/app/shared/nav.component.ts`.
- Initialize storage in `ngOnInit` via `storageService.initialize()` (mirror `src/app/features/cardio/cardio-page.component.ts:419`).

**New cross-cutting utility:**
- Pure helpers: `src/app/shared/<helper>.ts` + co-located spec.
- Shared standalone UI: `src/app/shared/<name>.component.ts`.

**Shared validation rules:**
- Add to `src/app/services/validators.ts` and extend `VALIDATION_LIMITS`. Keep service-specific validation inline in the service if it isn't reused.

**New external integration:**
- Mirror `src/app/services/anthropic-api.service.ts`: a thin, stateless service that wraps `fetch`, exposes `Observable<T>`, and defines a typed `*ApiError`.
- Persist credentials/settings inside `AppData` via a dedicated settings service (mirror `src/app/services/ai-settings.service.ts`), and add a migration if the shape changes.

## Special Directories

**`docs/`:**
- Purpose: Design-phase reference documentation (`data-model.md`, `features.md`, `service-contracts.md`).
- Generated: No.
- Committed: Yes.
- Note: TypeScript source is authoritative; docs may be stale.

**`dist/`:**
- Purpose: Angular CLI production/development build output.
- Generated: Yes (`ng build`).
- Committed: No (gitignored).

**`release/`:**
- Purpose: `electron-builder` output (installers, `win-unpacked/`, `linux-unpacked/`).
- Generated: Yes (`npm run electron:build`).
- Committed: No.

**`electron/`:**
- Purpose: Desktop shell source.
- Generated: No.
- Committed: Yes.

**`public/`:**
- Purpose: Static assets copied as-is into the build (favicon).
- Generated: No.
- Committed: Yes.

**`.planning/codebase/`:**
- Purpose: Target directory for codebase mapper documents (currently empty).
- Generated: Yes (by GSD mapper agents).
- Committed: Per project policy.

*Structure analysis: 2026-05-02*
