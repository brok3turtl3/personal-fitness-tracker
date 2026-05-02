# External Integrations

**Analysis Date:** 2026-05-02

## APIs & External Services

**AI / LLM:**
- Anthropic Messages API — Used by the in-app fitness assistant chat.
  - Endpoint: `https://api.anthropic.com/v1/messages` (constant `API_ENDPOINT` in `src/app/services/anthropic-api.service.ts`)
  - API version header: `anthropic-version: 2023-06-01`
  - Direct browser access: header `anthropic-dangerous-direct-browser-access: true` is set; calls go from the Angular renderer straight to Anthropic with no backend proxy.
  - SDK/Client: None. Raw `fetch()` wrapped in an RxJS `from(...)` Observable in `src/app/services/anthropic-api.service.ts` (`AnthropicApiService.sendMessage`).
  - Auth: `x-api-key` header. The key is supplied by the user in `/settings`, validated to start with `sk-ant-` (`src/app/services/ai-settings.service.ts` `hasValidApiKey`/`validate`), and persisted to LocalStorage inside the `AppData.aiSettings` object. There is no env var.
  - Models: Hardcoded list in `src/app/models/ai-chat.model.ts` (`CLAUDE_MODELS`):
    - `claude-sonnet-4-5-20250929` (Claude Sonnet 4.5)
    - `claude-haiku-4-5-20251001` (Claude Haiku 4.5)
    - `claude-opus-4-20250514` (Claude Opus 4)
  - Default `max_tokens`: 4096 (`DEFAULT_AI_SETTINGS` in `src/app/models/ai-chat.model.ts`); validated range 1–32768.
  - Error handling: `AnthropicApiError` class maps HTTP statuses 401/429/400/403/500/529 to friendly messages (`src/app/services/anthropic-api.service.ts` `getErrorMessage`).
  - Conversation orchestration: `src/app/services/chat.service.ts` builds the request body, applies a sliding window (`MESSAGE_WINDOW_SIZE = 20`, `TOKEN_WINDOW_SIZE = 8000`), and triggers automatic summarization beyond the window using a second Anthropic call with `max_tokens: min(maxTokens, 1024)`.
  - System prompt assembly: `src/app/services/fitness-context.service.ts` `buildSystemPrompt()` injects a snapshot of weight/cardio/health/nutrition data into the system prompt so the assistant can reference user fitness data.

**Auto-update:**
- GitHub Releases — Source of Electron app updates.
  - Client: `electron-updater` ^6.1.0, invoked at startup via `autoUpdater.checkForUpdatesAndNotify()` in `electron/main.js` line 35.
  - Publish provider configured in `package.json` `build.publish`: `provider: github`, `owner: brok3turtl3`, `repo: personal-fitness-tracker`, `releaseType: release`.
  - No auth needed for public release downloads. Publishing requires a `GH_TOKEN` env var when running `npm run electron:publish` (electron-builder convention; not configured in repo).

## Data Storage

**Databases:**
- None. No SQL/NoSQL database, no ORM, no remote DB client.

**Browser LocalStorage (primary persistence):**
- Key: `'fitness_tracker_data'` (constant `STORAGE_KEY` in `src/app/models/app-data.model.ts`)
- All access goes through `src/app/services/storage.service.ts` (`StorageService`). Direct `localStorage.*` calls outside that file are forbidden by `CLAUDE.md` and not present in the codebase.
- Single JSON-serialized `AppData` object containing: `cardioSessions`, `weightEntries`, `healthReadings`, `savedFoods`, `mealEntries`, `chatConversations`, `aiSettings`, `lastModified`, `schemaVersion` (`src/app/models/app-data.model.ts`).
- Quota assumed at 5 MB (`getStorageInfo` in `storage.service.ts` line 190). On `QuotaExceededError`, raises `StorageError` with code `QUOTA_EXCEEDED`.
- Schema versioning: `CURRENT_SCHEMA_VERSION = 4`. Sequential migrations in `migrateData()` (`migrateV0ToV1` … `migrateV3ToV4`, lines 234–321 of `storage.service.ts`):
  - V0→V1: adopt initial structured shape with arrays.
  - V1→V2: add `savedFoods`, `mealEntries`.
  - V2→V3: convert saved-food nutrients from per-100g to per-1g (`baseUnit: 'g'`); convert servings from `{grams}` to `{unit, amount}`.
  - V3→V4: add `chatConversations`, `aiSettings`.
- Availability probe: `isLocalStorageAvailable()` writes/removes a `__storage_test__` key to detect disabled storage.

**File Storage:**
- None at runtime. The app reads no files from disk.
- Build/release artifacts written to `dist/` (Angular build) and `release/` (electron-builder distributables) — both git-ignored.

**Caching:**
- In-memory only. `StorageService` keeps `cachedData: AppData | null` to avoid re-parsing LocalStorage on every read.
- No `Cache-Control` headers managed by app code; no service worker (no `ngsw-config.json`, no `provideServiceWorker`).

## Authentication & Identity

**Auth Provider:**
- None. Single-user local app. No login, no session, no JWT, no OAuth.
- The only credential in the system is the user-supplied Anthropic API key, stored in LocalStorage and used as a request header.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry, Datadog, Rollbar, or similar SDK in `package.json`.
- Errors surface to the UI via service-level `Observable.throwError(...)` and component-level error state. Console logging on bootstrap failure only (`src/main.ts` line 6).

**Logs:**
- `console.error` on bootstrap failure in `src/main.ts`. No structured logging framework. No remote log shipping.

## CI/CD & Deployment

**Hosting:**
- Static-file hosting for the Angular bundle (no built-in deploy config, no `firebase.json`, no `vercel.json`, no `netlify.toml`).
- Desktop distribution via Electron + GitHub Releases (electron-builder `publish` provider).

**CI Pipeline:**
- None detected. No `.github/workflows/`, no `.gitlab-ci.yml`, no `.circleci/`. Karma + Jasmine tests run locally via `ng test --no-watch` (documented in `CLAUDE.md`).

## Environment Configuration

**Required env vars (build/runtime):**
- None for the browser app.
- For `npm run electron:publish` only: electron-builder reads `GH_TOKEN` from the environment to upload release assets to GitHub. Not configured in repo and not needed for development.

**Secrets location:**
- `package.json` `build.publish` block declares the GitHub repo target but contains no token.
- `.gitignore` excludes `.env*` files. No `.env` files are present.
- The Anthropic API key is a runtime user secret persisted in LocalStorage by `AISettingsService` (`src/app/services/ai-settings.service.ts`); it is never committed.

## Webhooks & Callbacks

**Incoming:**
- None. No HTTP server, no webhook endpoints.

**Outgoing:**
- Anthropic chat completions — POST to `https://api.anthropic.com/v1/messages` (`src/app/services/anthropic-api.service.ts`).
- GitHub Releases update check — `electron-updater` polls the GitHub releases feed for the configured repo (`electron/main.js` line 35).

## Third-Party Libraries (Browser-Visible)

- `chart.js` ^4.5.1 — Charting engine. Direct type imports (`ChartConfiguration`, `ChartData`) in `src/app/features/charts/charts-page.component.ts` and `src/app/features/reports/report-page.component.ts`.
- `ng2-charts` ^7.0.0 — Angular wrapper. Globally registered via `provideCharts(withDefaultRegisterables())` in `src/app/app.config.ts`. `BaseChartDirective` used in the two chart-rendering components above.
- `rxjs` ~7.8.0 — Reactive composition throughout services.
- `zone.js` ~0.14.10 — Angular change-detection polyfill (`angular.json` polyfills).
- `tslib` ^2.3.0 — TypeScript runtime helpers (`importHelpers: true`).
- `@angular/cdk` ^18.2.14 — Installed but no direct imports detected; available for future overlay/a11y/portal needs.

## Browser & Platform APIs

- `localStorage` — Read/write of `fitness_tracker_data` (`src/app/services/storage.service.ts` lines 77, 168, 186, 214–215, 227). Used inside `StorageService` only.
- `crypto.randomUUID` — Documented in `CLAUDE.md` as the convention but not used in source. All services define a private `generateUUID()` helper that builds a v4 UUID via `Math.random()` (in `src/app/services/cardio.service.ts`, `weight.service.ts`, `readings.service.ts`, `diet.service.ts`, `chat.service.ts`). This is a documentation-vs-code drift; see CONCERNS.md if refreshed.
- `window.confirm` — Native delete-confirmation dialogs in feature pages: `src/app/features/cardio/cardio-page.component.ts:435`, `src/app/features/weight/weight-page.component.ts:329`, `src/app/features/readings/readings-page.component.ts:473`, `src/app/features/diet/diet-page.component.ts:638` and `:873`.
- `window.print` — Print/export of report view in `src/app/features/reports/report-page.component.ts:322`.
- `Blob` — Used to size the stored JSON for `getStorageInfo` (`src/app/services/storage.service.ts` line 187).
- `fetch` — Anthropic API calls (`src/app/services/anthropic-api.service.ts` line 55). No `HttpClientModule` is registered.
- `Date` / `toISOString` / `toLocaleDateString` — Pervasive for timestamps (ISO 8601 storage, locale formatting in UI).
- `JSON.stringify` / `JSON.parse` — LocalStorage serialization in `StorageService`.

## Electron-Specific Integrations

- `electron` (`app`, `BrowserWindow`, `shell`) — Window lifecycle and external link handler in `electron/main.js`. `webContents.setWindowOpenHandler` opens non-`file://` URLs in the system browser via `shell.openExternal`.
- `electron-updater` (`autoUpdater`) — Auto-update against GitHub Releases at startup (`electron/main.js` line 35).
- Preload bridge: `electron/preload.js` is currently a placeholder; no `contextBridge` APIs exposed. Renderer runs with `contextIsolation: true`, `nodeIntegration: false`.

---

*Integration audit: 2026-05-02*
