# Codebase Concerns

**Analysis Date:** 2026-05-02
**Focus:** concerns
**Scope:** full repo scan

## Tech Debt

### `any`-typed code in schema migration

- Issue: V2 → V3 saved-food migration drops out of strict-TypeScript by repeatedly casting through `any` to read pre-V3 fields (`nutrientsPer100g`, `servings[].grams`).
- Files: `src/app/services/storage.service.ts:296`, `:298`, `:306`, `:324`, `:350`
- Impact: A typo in a legacy field name silently produces zero-valued nutrition for older foods after migration; the type system no longer catches it. Conflicts with CLAUDE.md "No `any` except when interfacing with untyped third-party libs."
- Fix approach: Define explicit `LegacySavedFoodV2` / `LegacyServingV2` interfaces and have `migrateV2ToV3` consume those typed shapes.

### Duplicated, non-cryptographic UUID generator

- Issue: A custom `Math.random`-based UUID generator is copy-pasted into 6 files instead of using `crypto.randomUUID()` (which CLAUDE.md explicitly prescribes).
- Files: `src/app/services/cardio.service.ts:24`, `src/app/services/weight.service.ts:24`, `src/app/services/readings.service.ts:38`, `src/app/services/diet.service.ts:26`, `src/app/services/chat.service.ts:13`, `src/app/features/diet/diet-page.component.ts:9`
- Impact: Six identical functions to maintain; `Math.random()` is not cryptographically strong; statistically more likely to collide than `crypto.randomUUID()`; violates CLAUDE.md ID-generation rule.
- Fix approach: Add a single `src/app/services/id.ts` exporting `generateId()` that calls `crypto.randomUUID()`; replace all six copies.

### ID generation leaked into a feature component

- Issue: `diet-page.component.ts` carries its own `generateUUID()` and uses it inside the component at lines 774 and 846 — components should not generate IDs (CLAUDE.md "Components handle UI rendering and user interaction only — delegate business logic to services").
- Files: `src/app/features/diet/diet-page.component.ts:9-15`, `:774`, `:846`
- Impact: Hard to unit-test deterministically; bypasses the consolidated id helper above.
- Fix approach: Move all ID assignment into `DietService`; have the component pass plain shape objects without `id`.

### Missing update / edit operations in CRUD services

- Issue: `CardioService`, `WeightService`, and `ReadingsService` expose only `add*` / `delete*` / `get*` — no `update*` method. `DietService` does have `updateSavedFood` and `updateMeal`, so the asymmetry is jarring.
- Files: `src/app/services/cardio.service.ts:39-148`, `src/app/services/weight.service.ts:39-145`, `src/app/services/readings.service.ts:50-215`, vs. `src/app/services/diet.service.ts:133`, `:287`
- Impact: Users cannot correct mistakes (typos, wrong date) without losing history.
- Fix approach: Add `updateSession`, `updateEntry`, `updateBloodPressure` / `updateBloodGlucose` / `updateKetone` that preserve `id` and `createdAt`, refresh `updatedAt`, run validation.

### Console-only error reporting for storage failures

- Issue: All feature-page `ngOnInit` paths swallow storage init / load errors into `console.error` with no user-visible feedback. Charts at least sets a `rangeError` banner.
- Files: `src/app/features/cardio/cardio-page.component.ts:421-430`, `src/app/features/weight/weight-page.component.ts:315-324`, `src/app/features/readings/readings-page.component.ts:459-468`, `src/app/features/diet/diet-page.component.ts:587-592`, `:898`, `:908`
- Impact: If LocalStorage is disabled, full, or returns a parse error, the user sees an empty page silently and will think their data was deleted.
- Fix approach: Add a top-level error banner; surface `StorageError.code` distinctly.

### No subscription cleanup in feature components

- Issue: All feature pages subscribe in `ngOnInit` (and inside event handlers) but do not implement `OnDestroy`, do not use `takeUntilDestroyed()`, and do not use the `async` pipe — despite CLAUDE.md prescribing "Reactive patterns: use RxJS + async pipe in templates." `grep` for `OnDestroy` / `ngOnDestroy` returned zero matches in the source tree.
- Files: every component in `src/app/features/**`, e.g., `charts-page.component.ts:307-367`, `chat-page.component.ts:185-267`, `cardio-page.component.ts:421-440`, `weight-page.component.ts:315-336`, `readings-page.component.ts:458-487`, `diet-page.component.ts:587-908`, `report-page.component.ts:296-349`, `settings-page.component.ts:228-277`
- Impact: For services that return `of(...)` this is harmless today, but the moment any `Observable<T>` becomes long-lived (e.g., a future `BehaviorSubject` in `StorageService`), routing away from a page will leak subscriptions and double-handle data.
- Fix approach: Refactor to `async` pipe with shared view-models, or inject `DestroyRef` and use `takeUntilDestroyed(this.destroyRef)` on every subscribe.

### Storage-info "available bytes" is hard-coded to 5 MB

- Issue: `getStorageInfo()` assumes a fixed 5 MB cap. Real LocalStorage limits vary by browser (~10 MB on Chrome/Firefox, ~5 MB on Safari) and per-origin policy.
- Files: `src/app/services/storage.service.ts:184-206`
- Impact: `percentUsed` is wrong on most browsers — at best off by 2x.
- Fix approach: Use `navigator.storage.estimate()` where available; fall back to the 5 MB heuristic only if missing.

## Known Bugs / Fragile Areas (informed by recent fix history)

The last six fix commits cluster in chart layout, chart data shaping, and chrome around print/export — these are the most fragile areas:

- `3c29c47 fix(chat): constrain chat layout so message list scrolls internally`
- `3b1c1b4 fix(chat): allow message list to scroll when conversation exceeds viewport`
- `e2000f1 fix(nav): read version dynamically from package.json`
- `b6149d2 fix(charts): average same-day health readings in charts and reports`
- `92bd0a3 fix(charts): use router navigation for print/export report`

### Chat / chart fixed-pixel layout regressions

- Symptoms: Two consecutive chat-layout fixes plus a charts-print fix in a small window. Chat page uses `height: calc(100vh - 120px)`, brittle if nav height changes.
- Files: `src/app/features/chat/chat-page.component.ts:73-96`, `src/app/features/charts/charts-page.component.ts:228-241`
- Workaround: Audit every `calc(100vh - Npx)` rule when nav changes; prefer flexbox/grid that derives heights from siblings.

### Same-day reading averaging is duplicated, not shared

- Symptoms: `b6149d2` added `groupByDay()` / `toDateKey()` / `round2()` as private helpers at the bottom of `charts-page.component.ts` (`:594-646`). Reports page does its own filtering (`report-page.component.ts:472-565`) and may not share averaging.
- Files: `src/app/features/charts/charts-page.component.ts:594-646`, `src/app/features/reports/report-page.component.ts:472-565`
- Trigger: A future bug fix to averaging will need to be applied in two places — exactly the failure mode that caused the previous bug.
- Workaround: Move `groupByDay` / `toDateKey` / `round2` into `src/app/shared/date-range.ts` (or a new `chart-grouping.ts`) and import from both pages.

### Date math uses UTC offsets but display uses local time

- Symptoms: `resolveDateRange()` subtracts days/months/years using `setUTCDate / setUTCMonth / setUTCFullYear` while charts/reports display via `toLocaleDateString` and `groupByDay` keys by local `getFullYear/getMonth/getDate`.
- Files: `src/app/shared/date-range.ts:64-79`, `src/app/features/charts/charts-page.component.ts:582-604`, `src/app/services/diet.service.ts:426-430`
- Trigger: Users west of UTC near midnight, or DST boundaries, will see a "30 day" range that omits the most recent local day. Same-day grouping may also place a late-evening reading in the wrong day.
- Workaround: Pick one timezone convention (recommended: local) for both range math and grouping. Replace `setUTC*` with local-time equivalents in `date-range.ts`.

### `localDayBounds` parses date with ambiguous-TZ `Date` constructor

- Symptoms: `new Date('2026-05-02T00:00:00')` and `new Date('2026-05-02T23:59:59.999')` are interpreted as local time but with no explicit offset — fragile across DST transitions.
- Files: `src/app/services/diet.service.ts:426-430`
- Trigger: Diet page filtering of "today's meals" can mismatch around DST, or if Karma runs the spec under a different TZ than the user's runtime.
- Workaround: Use `new Date(year, monthIndex, day, hh, mm, ss)` constructor (unambiguously local).

### Diet `updateMeal` can leave stale `savedFoodName` after food rename

- Symptoms: `updateMeal` short-circuits when `sameMealItems(existing, input)` returns true (`:311-324`) and reuses existing item snapshots. The comparator only checks `savedFoodId / servingId / quantity`, so if the underlying `savedFoods[i].name` was changed via `updateSavedFood`, the meal will still display the old `savedFoodName`.
- Files: `src/app/services/diet.service.ts:287-343`, `:371-383`
- Trigger: User adds meal with food "Egg", later renames it to "Egg, large", later edits the meal's date — meal will continue to show "Egg".
- Workaround: When items are unchanged, still refresh `savedFoodName` and `servingLabel` from current `savedFoods`; keep nutritional `snapshot.totals` immutable.

## Security Considerations

### Anthropic API key stored in plaintext LocalStorage

- Risk: `apiKey` is persisted to LocalStorage as part of `aiSettings` and never encrypted. Any XSS or malicious extension on the same origin can exfiltrate it.
- Files: `src/app/services/ai-settings.service.ts:18-45`, `src/app/models/app-data.model.ts:31`, `src/app/models/ai-chat.model.ts:21-25`
- Current mitigation: `<input type="password">` toggle (`src/app/features/settings/settings-page.component.ts:24-34`); user is informed via copy.
- Recommendations: For Electron, prefer `safeStorage` / OS keychain via a preload bridge. For web, document the trade-off and consider a "session-only" mode.

### Direct browser → Anthropic call uses dangerous-direct-browser-access flag

- Risk: `AnthropicApiService` sets `'anthropic-dangerous-direct-browser-access': 'true'`. Anthropic intentionally requires that opt-in flag because exposing a long-lived API key to the browser is discouraged.
- Files: `src/app/services/anthropic-api.service.ts:54-79` (flag at `:61`)
- Current mitigation: None.
- Recommendations: For Electron, route the call from the main process via IPC. For web, document the risk and add a 401 retry-after-rotate flow.

### No Content Security Policy and no Trusted Types

- Risk: `src/index.html` has no CSP meta tag; `app.config.ts` registers no Trusted Types provider. The codebase does not currently use `bypassSecurityTrust*` or `innerHTML` (grep is clean), but there is no defense-in-depth.
- Current mitigation: Angular's default escaping in interpolation.
- Recommendations: Add a strict CSP (`connect-src` limited to `https://api.anthropic.com` and self; no `'unsafe-inline'`).

### Electron renderer with auto-update from GitHub

- Risk: `electron/main.js` calls `autoUpdater.checkForUpdatesAndNotify()`. Releases are pulled from GitHub. `package.json` build config has `win.target = nsis` and `mac.target = dmg` with no signing config.
- Files: `electron/main.js:33-36`, `package.json` build section
- Current mitigation: Distribution is via the user's own GitHub repo (`brok3turtl3/personal-fitness-tracker`).
- Recommendations: Sign Windows installers (NSIS) and macOS DMGs; notarize macOS. `autoUpdater` will refuse unsigned mac updates by default but will accept unsigned Windows updates.

### Last-write-wins concurrency (multiple tabs)

- Risk: `StorageService.saveData()` always overwrites the entire `AppData` object. Two tabs can clobber each other.
- Files: `src/app/services/storage.service.ts:129-161`
- Current mitigation: `lastModified` is updated on every save, but is never *read* before a write.
- Recommendations: Listen for `storage` event; refuse writes if `lastModified` advanced since the in-memory snapshot, or merge per-collection. Display a "data was changed in another tab" banner.

## Performance Bottlenecks

### Whole-AppData JSON write on every mutation

- Problem: Every `addSession` / `addEntry` / `addReading` / `addMeal` / `sendMessage` re-stringifies the entire `AppData` and runs a single `localStorage.setItem`. As chat history grows, serialization cost grows linearly with total data.
- Files: `src/app/services/storage.service.ts:225-227`
- Improvement path: Migrate to IndexedDB with one object store per collection; the existing `Observable`-returning abstraction makes this straightforward.

### Chat conversations have no per-message pruning

- Problem: `ChatConversation.messages` grows unbounded. The only "compaction" is `summarizedMessageCount`, which leaves all original messages on disk and only constrains the API request window.
- Files: `src/app/services/chat.service.ts:9`, `:185-219`, `:221-290`, `src/app/models/ai-chat.model.ts:11-19`
- Improvement path: After summarization runs, archive (do not display) messages older than `summarizedMessageCount`, or move them to a separate lazy-loaded `archivedMessages` array.

### Each component re-fetches storage on entry

- Problem: Every navigation re-runs `storageService.initialize()` and re-`forkJoin`s collection fetches. The service caches `AppData` so disk hits are avoided, but the subscription work is repeated.
- Files: `src/app/features/charts/charts-page.component.ts:307-367`, `cardio-page.component.ts:421-430`, etc.
- Improvement path: Convert `StorageService` to a `BehaviorSubject<AppData>`; have each domain service expose a derived `Observable<T[]>` (e.g., `cardioSessions$`); use `async` pipe in templates.

### `forkJoin` in charts/report fetches all three collections always

- Problem: Charts page always loads cardio + weight + readings even if the user only wants the readings chart.
- Files: `src/app/features/charts/charts-page.component.ts:351-355`, `src/app/features/reports/report-page.component.ts:330-334`
- Improvement path: Lazy-fetch each collection per chart section. Negligible today, matters under IndexedDB.

## Scaling Limits

### LocalStorage hard cap (~5–10 MB)

- Current capacity: ~250-byte fitness entries → ~20,000 entries fit.
- Limit: Chat messages are ~1–4 KB each. 5 MB / 2 KB ≈ 2,500 messages — reachable in months of daily use.
- Scaling path: IndexedDB. The `StorageService` abstraction was designed for this.

### Chat sliding-window token budget

- Current capacity: `MESSAGE_WINDOW_SIZE = 20`, `TOKEN_WINDOW_SIZE = 8000`.
- Limit: Token estimate is `Math.ceil(text.length / 4)` (`src/app/services/chat.service.ts:21-23`) — diverges from real Claude tokenization for non-English text and code.
- Scaling path: Use a real tokenizer or trust API `400 too_many_tokens` and retry with smaller window.

## Dependencies at Risk

### `ng2-charts ^7.0.0` + `chart.js ^4.5.1`

- Risk: `ng2-charts` is a thin wrapper that lags Angular major releases. Project is on Angular 18; ng2-charts 7 supports Angular 17+. Future Angular 19/20 upgrades may stall here.
- Files: `package.json`
- Migration plan: Use `chart.js` directly via a small Angular directive (~30 lines) that creates and disposes the chart in `ngAfterViewInit` / `ngOnDestroy`.

### `electron-updater ^6.1.0` + GitHub Releases provider (no signing)

- Risk: Auto-update silently pulls binaries from GitHub. A compromise of the publisher account would push malicious updates to all installed apps.
- Files: `electron/main.js:2`, `:35`, `package.json` `build.publish`
- Migration plan: Sign all artifacts (NSIS + DMG); notarize macOS. Consider a manual "check for updates" instead of automatic on launch.

### `electron ^33.0.0`

- Risk: Electron majors land every ~8 weeks with breaking Chromium changes; CVEs force frequent re-packaging.
- Migration plan: Pin to a known LTS; subscribe to release calendar; CI re-package job on dependabot bumps.

## Missing Critical Features

### No data export / import

- Problem: No way to export/import the LocalStorage `AppData` blob. Browser data clearing or browser switch = total data loss.
- Blocks: User trust, multi-device use, recovery from corruption, schema-migration debugging.

### No edit / update flows for cardio, weight, readings

- Problem: Only delete + re-add. See "Missing update / edit operations in CRUD services."
- Blocks: Correcting typos, adjusting wrong-day timestamps, fixing duplicate entries.

### No multi-tab conflict UI

- Problem: Last-write-wins with no detection. See "Last-write-wins concurrency."
- Blocks: Reliable use across tabs / windows.

### No backup before destructive operations

- Problem: `StorageService.clearData()` (`src/app/services/storage.service.ts:166-179`) replaces all data with empty defaults. No "are you sure?" UI surface; no auto-snapshot.
- Blocks: Safe recovery from accidental clear.

## Test Coverage Gaps

### Zero feature-component specs

- What's not tested: None of `src/app/features/**/*.component.ts` has a `.spec.ts`. Search returned 0 matches.
- Files: every component in `src/app/features/**`
- Risk: Form wiring, validators, deletion confirmations, edit flow, query-param parsing, chart rebuilding — all unverified. Recent fix commits in chat layout and chart logic could regress without notice.
- Priority: High.

### `groupByDay` and `toDateKey` are private to charts page

- What's not tested: Same-day averaging logic is unreachable from tests because it lives as private functions inside the charts component. Recent fix `b6149d2` lacks a regression spec.
- Files: `src/app/features/charts/charts-page.component.ts:594-646`
- Priority: High — this is the function most likely to regress.

### No Puppeteer e2e tests despite the dependency

- What's not tested: `puppeteer ^24.37.3` is in `package.json` devDependencies with no scripts and no specs anywhere. CLAUDE.md references Puppeteer for testing but no e2e directory exists.
- Risk: Print/export, chart rendering, navigation — all the integration concerns above — have no automated coverage.
- Priority: Medium — would cover most fragile-area concerns at once.

### `FitnessContextService` snapshot output barely tested

- What's not tested: `buildSystemPrompt()` formats fitness data into the LLM system prompt. The spec asserts only "should include fitness expert persona" (`src/app/services/fitness-context.service.spec.ts:29`).
- Risk: Format drift means Claude gets stale or malformed user context, lowering response quality silently.
- Priority: Medium.

### Migration error path not tested

- What's not tested: `migrateV2ToV3` defends against `Array.isArray(savedFoods)` returning false (`src/app/services/storage.service.ts:297`), but `storage.service.spec.ts` lacks a malformed-`savedFoods` case (e.g., `null`, `{}`, a string).
- Priority: Medium.

### `AnthropicApiService` error parsing matrix incomplete

- What's not tested: `getErrorMessage()` (`src/app/services/anthropic-api.service.ts:81-99`) maps HTTP statuses to user-facing copy. Spec is short (133 lines); a full status-code matrix is not asserted.
- Priority: Low.

*Concerns analysis: 2026-05-02*
