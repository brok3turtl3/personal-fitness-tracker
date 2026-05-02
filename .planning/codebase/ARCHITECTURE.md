<!-- refreshed: 2026-05-02 -->
# Architecture

**Analysis Date:** 2026-05-02

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                  Bootstrap & Routing                         │
│  src/main.ts → src/app/app.config.ts → src/app/app.routes.ts │
│  src/app/app.component.ts (root: <app-nav> + <router-outlet>)│
└──────────────────────────────┬──────────────────────────────┘
                               │ lazy-loaded standalone components
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Feature Layer (UI)                        │
│ /cardio  /weight  /readings  /diet  /charts  /report         │
│ /chat    /settings                                           │
└────┬────────────────────────────────────────────────────────┘
     │ injects domain services + StorageService.initialize()
     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer (domain)                     │
│  cardio | weight | readings | diet | chat                   │
│  ai-settings | fitness-context | anthropic-api              │
│  Shared validation: services/validators.ts                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ getData() / saveData()  (Observable<AppData>)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│   src/app/services/storage.service.ts (single owner)        │
│   - cachedData: AppData                                     │
│   - initialize() reads + migrates on first call             │
│   - saveData() updates lastModified, JSON.stringify         │
│   - migrateData() runs V0→V1→V2→V3→V4 sequentially          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Browser LocalStorage (key: "fitness_tracker_data")         │
│  Optional Electron shell: electron/main.js loads dist/      │
└─────────────────────────────────────────────────────────────┘

External egress (only):
  anthropic-api.service.ts → https://api.anthropic.com/v1/messages
  via chat.service.ts; key from ai-settings.service.ts (AppData.aiSettings)
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Bootstrap | Bootstraps `AppComponent` with `appConfig` | `src/main.ts` |
| App config | Registers `provideRouter(routes, withHashLocation())`, zone-coalesced change detection, chart.js registerables | `src/app/app.config.ts` |
| Routes | Lazy-loads each feature page via `loadComponent` | `src/app/app.routes.ts` |
| Root component | Renders `<app-nav>` + `<router-outlet>` | `src/app/app.component.ts`, `src/app/app.component.html` |
| Nav | Top navigation; reads version from `package.json` | `src/app/shared/nav.component.ts` |
| Storage | Sole owner of LocalStorage I/O, schema migrations, in-memory cache | `src/app/services/storage.service.ts` |
| Cardio service | CRUD + validation for cardio sessions | `src/app/services/cardio.service.ts` |
| Weight service | CRUD + validation for weight entries | `src/app/services/weight.service.ts` |
| Readings service | CRUD + validation for BP / glucose / ketone readings | `src/app/services/readings.service.ts` |
| Diet service | CRUD + validation for saved foods, meals, totals | `src/app/services/diet.service.ts` |
| Chat service | Conversation CRUD, summarization, calls Anthropic via API service | `src/app/services/chat.service.ts` |
| AI settings | Persists API key + model into `AppData.aiSettings` | `src/app/services/ai-settings.service.ts` |
| Fitness context | Builds system-prompt snapshot of fitness data for chat | `src/app/services/fitness-context.service.ts` |
| Anthropic API | Stateless `fetch` wrapper for `api.anthropic.com/v1/messages` | `src/app/services/anthropic-api.service.ts` |
| Validators | Shared domain validation (cardio, weight, BP, glucose, ketones) | `src/app/services/validators.ts` |
| Date range | Pure helpers for chart/report date filtering | `src/app/shared/date-range.ts` |
| Models | Pure data interfaces and constants | `src/app/models/*.ts` |
| Electron shell | Optional desktop wrapper that loads built Angular bundle | `electron/main.js`, `electron/preload.js` |

## Pattern Overview

**Overall:** Layered single-page Angular application with a centralized storage abstraction. Standalone components only (no NgModules). UI → Domain Service → StorageService → LocalStorage.

**Key Characteristics:**
- Single-user, client-only (no server, no auth, no multi-user concerns).
- All persistence flows through `StorageService` — single read/write surface.
- Reactive data access via RxJS `Observable<T>`; UI mostly subscribes manually (some templates use async pipe).
- Schema versioning with sequential migrations runs once on `initialize()`.
- Standalone Angular components, lazy-loaded via `loadComponent`, one component per route.
- Each feature page injects only the domain services it needs.
- Single external integration (Anthropic Messages API) isolated behind one service.

## Layers

**Models — `src/app/models/`:**
- Purpose: Pure TypeScript interfaces and constants — no behavior.
- Contains: `AppData`, `CardioSession`, `WeightEntry`, `HealthReading` (discriminated union), `SavedFood` / `MealEntry` / `MealItem`, `ChatConversation` / `AISettings`, plus `Create*` DTOs and UI dropdown constants (`CARDIO_TYPES`, `READING_TYPES`, `CLAUDE_MODELS`).
- Depends on: nothing.
- Used by: services, features.
- Barrel: `src/app/models/index.ts` (note: barrel does not re-export `diet.model.ts` — diet types are imported directly).

**Services — `src/app/services/`:**
- Purpose: Business logic, validation, ID/timestamp generation, persistence orchestration.
- Contains: domain services (`cardio`, `weight`, `readings`, `diet`, `chat`, `ai-settings`, `fitness-context`), the `StorageService` boundary, the `AnthropicApiService` HTTP wrapper, and `validators.ts`.
- Depends on: models, `StorageService`, RxJS.
- Used by: feature components.

**Shared — `src/app/shared/`:**
- Purpose: Cross-cutting UI / utilities reused across features.
- Contains: `nav.component.ts` (standalone), `date-range.ts` (pure date helpers).
- Used by: `AppComponent`, `ChartsPageComponent`, `ReportPageComponent`.

**Features — `src/app/features/`:**
- Purpose: Route-targeted UI pages.
- Contains: one `*-page.component.ts` per route; the `chat` feature is split into `chat-page`, `chat-conversation-list`, `chat-message-list`, `chat-input`.
- Depends on: services, models, shared.
- Used by: router (`src/app/app.routes.ts`).

**Bootstrap & app shell:**
- `src/main.ts` calls `bootstrapApplication(AppComponent, appConfig)`.
- `src/app/app.config.ts` provides `provideRouter(routes, withHashLocation())` (so the app works under `file://` in Electron), `provideZoneChangeDetection({ eventCoalescing: true })`, and `provideCharts(withDefaultRegisterables())`.
- `src/app/app.component.ts` + `app.component.html` render `<app-nav>` and `<router-outlet>`.

## Data Flow

**Primary write path (e.g. add a cardio session):**
1. `CardioPageComponent.onSubmit()` (`src/app/features/cardio/cardio-page.component.ts:451`).
2. Component builds a `CreateCardioSession` and calls `cardioService.addSession(...)` (`src/app/services/cardio.service.ts:66`).
3. `validateCardio()` runs (`src/app/services/validators.ts:94`); on failure, `throwError(new CardioValidationError(...))` propagates and the component shows the error.
4. On success the service generates a UUID v4, sets `createdAt`/`updatedAt`, and merges into `AppData` (`src/app/services/cardio.service.ts:90`).
5. `StorageService.saveData(updatedData)` updates `lastModified`, then `JSON.stringify`s and writes to `localStorage` under `fitness_tracker_data` (`src/app/services/storage.service.ts:129`).
6. Component re-runs `loadSessions()` → `cardioService.getSessions()` → re-render.

All other domain services follow the same shape (`weight`, `readings`, `diet`, `chat`).

**Read path (page load):**
1. Each feature page calls `storageService.initialize()` in `ngOnInit` (e.g. `src/app/features/cardio/cardio-page.component.ts:419`).
2. `initialize()` (`src/app/services/storage.service.ts:64`) reads raw JSON, runs `migrateData()`, persists if migrated, caches `AppData` in memory.
3. Subsequent `getData()` returns `of(this.cachedData)` — no re-parse.
4. Domain services map collections into sorted/filtered/aggregated views (e.g. `getSessions()` sorts by `date` desc).

**Schema migration path:**
1. `initialize()` parses existing JSON and inspects `schemaVersion` (defaults to 0 if missing).
2. `migrateData()` (`src/app/services/storage.service.ts:234`) applies in sequence:
   - `migrateV0ToV1` — adds versioning + ensures cardio/weight/readings arrays.
   - `migrateV1ToV2` — adds `savedFoods` + `mealEntries` (diet).
   - `migrateV2ToV3` — converts saved foods from per-100g to per-1g `nutrientsPerUnit` and `{ unit, amount }` servings; helper `migrateSavedFoodV2ToV3` at `src/app/services/storage.service.ts:324`.
   - `migrateV3ToV4` — adds `chatConversations` + optional `aiSettings`.
3. If the resulting `schemaVersion` differs, the migrated `AppData` is persisted immediately.
4. `CURRENT_SCHEMA_VERSION = 4` in `src/app/models/app-data.model.ts:41`.

**Chat flow (only network path):**
1. `ChatPageComponent` → `ChatService.sendMessage(...)` (`src/app/services/chat.service.ts`).
2. `ChatService` builds the rolling message window and asks `FitnessContextService.buildSystemPrompt()` for an `AppData` snapshot (`src/app/services/fitness-context.service.ts:16`).
3. `AISettingsService.getSettings()` provides the API key + selected model from `AppData.aiSettings`.
4. `AnthropicApiService.sendMessage(apiKey, request)` POSTs to `https://api.anthropic.com/v1/messages` (`src/app/services/anthropic-api.service.ts:47`).
5. Response is appended to the conversation; conversation is summarized when the rolling window exceeds `MESSAGE_WINDOW_SIZE` (20) or `TOKEN_WINDOW_SIZE` (8000); updated `chatConversations` array is persisted via `StorageService`.

**State Management:**
- Single source of truth: `StorageService.cachedData: AppData | null`.
- No global store (no NgRx, no signals store). Components hold local view state and re-fetch after writes.
- `initialize()` is idempotent (`this.initialized` guard) — whichever feature mounts first sets up the cache for the whole app.

## Key Abstractions

**`AppData` (root container):**
- Purpose: Entire persisted state — schema version, all domain collections, last-modified timestamp.
- Files: `src/app/models/app-data.model.ts`.
- Pattern: One JSON object per app; mutated immutably and re-saved whole.

**`StorageService` (persistence boundary):**
- Purpose: The only module allowed to call `localStorage.*` for app data.
- Files: `src/app/services/storage.service.ts`.
- Pattern: Observable methods (`initialize`, `getData`, `saveData`, `clearData`, `getStorageInfo`); typed `StorageError` with `StorageErrorCode` union (`QUOTA_EXCEEDED | PARSE_ERROR | SERIALIZATION_ERROR | NOT_AVAILABLE | MIGRATION_FAILED`).

**Domain services (one per data type):**
- Purpose: Encapsulate validation, ID/timestamp generation, sort order, and read-modify-write of one slice of `AppData`.
- Files: `src/app/services/cardio.service.ts`, `weight.service.ts`, `readings.service.ts`, `diet.service.ts`, `chat.service.ts`.
- Pattern: `@Injectable({ providedIn: 'root' })`, constructor-injects `StorageService`, returns `Observable<T>`, throws typed `*ValidationError` from validation failures.

**Validation result types:**
- `ValidationError`, `ValidationResult` in `src/app/services/validators.ts`.
- Validators return `{ valid, errors[] }`; services wrap into `CardioValidationError`, `WeightValidationError`, `ReadingsValidationError`, `DietValidationError`.

**Discriminated unions:**
- `BloodPressureReading | BloodGlucoseReading | KetoneReading` in `src/app/models/health-reading.model.ts` (narrow on `type`).

**Snapshot pattern (diet):**
- `MealItem.snapshot` in `src/app/models/diet.model.ts` — meal items capture nutrition at log time so editing a saved food does not retroactively change history.

## Entry Points

**Browser bootstrap:**
- `src/main.ts` — calls `bootstrapApplication(AppComponent, appConfig)`; logs bootstrap errors to console.

**App configuration:**
- `src/app/app.config.ts` — `provideRouter(routes, withHashLocation())`, `provideZoneChangeDetection({ eventCoalescing: true })`, `provideCharts(withDefaultRegisterables())`.

**Routes:**
- `src/app/app.routes.ts` — `/cardio`, `/weight`, `/readings`, `/charts`, `/diet`, `/report`, `/chat`, `/settings`; `''` redirects to `/cardio`. All targets use `loadComponent`.

**Root component:**
- `src/app/app.component.ts` + `src/app/app.component.html` — renders `<app-nav>` + `<router-outlet>`.

**Electron shell (optional desktop entry):**
- `electron/main.js` — `package.json` `main` field points here. Creates `BrowserWindow` loading `dist/personal-fitness-tracker/browser/index.html`, `contextIsolation: true`, opens external links via `shell.openExternal`. `electron-updater` checks for updates on launch. Preload: `electron/preload.js`.

## Architectural Constraints

- **Threading:** Single-threaded browser event loop. Synchronous `localStorage` reads are wrapped in `of(...)` Observables to permit a future async backend without changing call sites.
- **Global state:** `StorageService.cachedData` is the only module-level singleton (`providedIn: 'root'`). Treat `AppData` as authoritative — never mutate in place; pass a new object to `saveData()`.
- **Persistence boundary:** Only `src/app/services/storage.service.ts` may touch `localStorage` for app data. Tests may set up `localStorage` directly; no other production code should.
- **Schema versioning:** `AppData.schemaVersion` must monotonically increase. Migrations are sequential (`V0→V1→V2→V3→V4`) and idempotent. New shape changes require a new `migrateVxToVy()` and a bumped `CURRENT_SCHEMA_VERSION`.
- **Standalone components only:** No NgModules. Every component declares `standalone: true` with its own `imports`.
- **No `null` for absent data:** Optional fields use `?` and are omitted (`undefined`), never stored as `null`.
- **Hash-location routing:** Required so the app runs from `file://` under Electron; do not switch to PathLocationStrategy without verifying Electron behavior.
- **Network egress:** The only external host any production code calls is `https://api.anthropic.com/v1/messages` (`src/app/services/anthropic-api.service.ts`).

## Anti-Patterns

**Direct LocalStorage access from components or non-storage services**
- What happens: Code calls `localStorage.getItem`/`setItem`/`removeItem` directly.
- Why wrong: Breaks the persistence boundary, evades migrations, defeats the in-memory cache, blocks future migration to IndexedDB or backend.
- Do this instead: Inject `StorageService` and use `getData()` / `saveData()`. See `src/app/services/cardio.service.ts:46`.

**Business logic in components**
- What happens: A page validates ranges, generates UUIDs, or computes nutrition totals inline.
- Why wrong: Duplicates rules, defeats unit tests for services, drifts from validated behavior.
- Do this instead: Components only translate form values into `Create*` DTOs and call the domain service. See `CardioPageComponent.onSubmit` (`src/app/features/cardio/cardio-page.component.ts:451`).

**Using NgModules or non-standalone components**
- What happens: A new component is declared in an NgModule or omits `standalone: true`.
- Why wrong: This codebase has no NgModules; mixing styles fights `loadComponent` lazy routes.
- Do this instead: Always set `standalone: true` and import dependencies inline. See `src/app/features/cardio/cardio-page.component.ts:11`.

**Storing `null` for "not provided" optional fields**
- What happens: Code persists `caloriesBurned: null` or `notes: null`.
- Why wrong: Models declare optional fields with `?` (meaning omitted/`undefined`); `null` widens types and complicates migrations.
- Do this instead: Convert blank form inputs to `undefined`. See `src/app/features/cardio/cardio-page.component.ts:465`.

**Mutating `AppData` in place**
- What happens: A service calls `data.cardioSessions.push(newSession)` then `saveData(data)`.
- Why wrong: Mutates the cached object before save completes; bypasses the immutability contract.
- Do this instead: Spread into a new object: `const updatedData = { ...data, cardioSessions: [...data.cardioSessions, newSession] }`. See `src/app/services/cardio.service.ts:96`.

**Bumping `CURRENT_SCHEMA_VERSION` without a migration**
- What happens: A new field is added to `AppData` and the version is bumped, but no `migrateVxToVy()` is added.
- Why wrong: Existing users' data still has the old version; the migration chain has a gap; new field is `undefined` when the app expects a populated shape.
- Do this instead: For every schema change, add a sequential `migrateVxToVy()` that defaults the new field, append it to the chain in `migrateData()`, and add a unit test. Reference: `migrateV3ToV4` at `src/app/services/storage.service.ts:314`.

## Error Handling

**Strategy:** Throw typed `Error` subclasses through Observable streams; components catch in `subscribe({ error })` and translate to user-facing messages.

**Patterns:**
- `StorageError` with `StorageErrorCode` discriminator — `src/app/services/storage.service.ts:32`.
- `*ValidationError` per domain — `CardioValidationError`, `WeightValidationError`, `ReadingsValidationError`, `DietValidationError`. They wrap an array of `ValidationError { field, message, value? }`.
- `AnthropicApiError` carries `statusCode` + `errorType` from the Messages API — `src/app/services/anthropic-api.service.ts:36`.
- Components branch on `instanceof` to render specific messages and fall back to a generic "Failed to save" string. Example: `src/app/features/cardio/cardio-page.component.ts:486`.
- `QuotaExceededError` is caught inside `StorageService.saveData` and re-thrown as `StorageError('QUOTA_EXCEEDED')`.

## Cross-Cutting Concerns

**Logging:** `console.error` at component error boundaries (e.g. "Failed to initialize storage"). No structured logger.

**Validation:** Two complementary layers — Angular `Validators.*` on reactive forms for UX feedback, plus authoritative domain validators in `src/app/services/validators.ts` and inside `diet.service.ts` that run before persistence.

**Authentication:** None. Single-user, local-only. The Anthropic API key lives in `AppData.aiSettings.apiKey` in LocalStorage and is sent only to `api.anthropic.com`.

**Date handling:** All dates serialized as ISO 8601 strings. Date filtering for charts/reports goes through `src/app/shared/date-range.ts` (`resolveDateRange`, `filterByRange`).

**ID generation:** Each domain service inlines a `generateUUID()` helper that produces a UUID v4 via `Math.random()` (not `crypto.randomUUID()` despite CLAUDE.md). Duplicated across `cardio.service.ts`, `weight.service.ts`, `readings.service.ts`, `diet.service.ts`, and `chat.service.ts`.

**Charts:** Provided globally via `provideCharts(withDefaultRegisterables())` in `app.config.ts`; consumed via `BaseChartDirective` from `ng2-charts` in charts and reports pages.

*Architecture analysis: 2026-05-02*
