# Phase 5: Web Search Grounding + Quality Sweep - Research

**Researched:** 2026-05-31
**Domain:** Anthropic server-side web-search tool layered onto an existing Angular 18 / TypeScript-strict agentic loop + a cross-cutting quality sweep (CRUD parity, quota safety, multi-tab safety, CSP, key rotation, archival, a11y/UX, mutation testing)
**Confidence:** HIGH (most claims verified against the installed SDK, the live Anthropic docs, and the actual codebase; the few `[ASSUMED]` items are flagged in the Assumptions Log)

## Summary

Phase 5 is overwhelmingly an **integration + sweep** phase, not a greenfield one. The web-search half (RESCH-01/02/03) is **net-zero new dependencies**: it registers one Anthropic *server-side* tool (`web_search_20250305`) into the `tools[]` array the Phase 4 agentic loop already sends, lets the loop render the resulting `server_tool_use` / `web_search_tool_result` blocks inline (never dispatching them), and narrows the structured `web_search_result_location` citations into `https:`-gated footnote links. I verified that **all the SDK types the AI-SPEC names are present in the installed `@anthropic-ai/sdk@0.92.0`** (`WebSearchTool20250305`, `ServerToolUseBlock`, `WebSearchToolResultBlock`, `WebSearchResultBlock`, `WebSearchToolResultError`, `CitationsWebSearchResultLocation`) and that the live Anthropic docs match the AI-SPEC's described response/error/citation shapes. The Phase 4 loop already filters `b.type === 'tool_use'` for dispatch (so `server_tool_use` is structurally never dispatched), already handles `pause_turn` defensively, and `isLinkableCitation` already admits `web_search_result_location`. The single biggest *real* implementation gap the planner must address is the **serializer + persistence model**: today `fromAnthropicMessage` lifts any non-text/non-tool_use block to a `[unsupported block type: …]` placeholder, and the persisted `TextBlock` has no `citations` field — so grounded citations and the `encrypted_content`/`encrypted_index` that Anthropic requires for multi-turn citation resolution would be destroyed on the first persist/round-trip.

The quality half (QUAL-01..10) is a punch-list against the existing codebase. I confirmed the concrete gaps: **CardioService/WeightService have no `update*` method** (only add/get/delete), **ReadingsService uses three add methods** on its discriminated union (so the three-method update split is the cleaner fit), **`getStorageInfo()` hardcodes the 5 MB estimate** (must move to `navigator.storage.estimate()`), **`saveData` matches only `QuotaExceededError`** (missing Firefox `NS_ERROR_DOM_QUOTA_REACHED`), **`lastModified` is written but never read** and **no `storage`-event listener exists** (multi-tab gap), **`src/index.html` has no CSP**, the **401 path currently surfaces a generic message** (needs the rotate-key prompt), and **Stryker is not installed** (QUAL-10 requires a dev-dependency add). `DietService.updateSavedFood`/`updateMeal` is the proven template for the new CRUD methods; `<app-error-state>`, `<app-recovery-banner>`, and `StorageService.getBackup` are the proven surfaces for the banners and the 401 prompt.

**Primary recommendation:** Build web-search as one track and the quality sweep as file-disjoint sub-tracks. On the web-search track, do the serializer + persistence-model work FIRST (extend `ChatBlock` with server-tool blocks + add `citations` to the persisted text block, pass server-tool blocks through verbatim), because every downstream rendering and round-trip correctness property depends on it. The adversarial citation regression test (E1) is the acceptance gate for RESCH-03 and must be built concurrently with the renderer, not after.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Web-search tool definition + `max_uses` wiring | API transport (`anthropic-api.service.ts`) | — | D-17: sole SDK importer; tool def maps to SDK params only here |
| Server-tool loop handling (`server_tool_use`/`pause_turn`) | Domain service (`chat.service.ts` `runAgenticLoop`) | API transport | The loop owns turn control; render-only, never dispatch |
| Citation narrowing + `https:` gate | Pure module (`web-citation-parser.ts`, new) | API transport (calls it) | SDK-free local shape crosses the D-17 boundary; mirrors `validators.ts` |
| Grounded-citation rendering (footnotes + Sources) | UI component (`chat-message-list.component.ts`) | — | UI-only; consumes the local `GroundedCitation[]` |
| Chat block persistence + verbatim server-tool round-trip | Pure module (`chat-block-serializer.ts`) + `StorageService` | Model (`ai-chat.model.ts`) | Encrypted fields must survive persist/reload; chokepoint invariant |
| CRUD edit (cardio/weight/readings) | Domain services + their feature components | `StorageService` | Validation/identity in services; in-place form toggle in components |
| Quota detection + thresholds | `StorageService` (estimate + error matching) | `app.component.ts` (banner host) | All `localStorage` access is the storage chokepoint; banner is app-level |
| Multi-tab change detection | `app.component.ts` (`storage` event) | `StorageService` (`lastModified`) | `window` event belongs at the app root; data via the chokepoint |
| CSP | `src/index.html` (meta tag) | — | Static local app: meta tag is the only delivery vehicle (no server) |
| 401 key-rotation prompt | `chat-page.component.ts` + `<app-error-state>` | `anthropic-api.service.ts` (maps 401) | Error surfacing is UI; the typed `AnthropicApiError.statusCode` already exists |
| Chat archival | `StorageService` (archive keys) | `chat.service.ts` / chat UI | Chokepoint owns the keys; lazy-load triggered from UI |
| a11y / UX consistency | Every feature component + axe specs | — | Per-route assertion via `expectNoSeriousA11yViolations` |
| Mutation testing | Dev tooling (Stryker config) | `validators.ts` (target) | Build-time only; no runtime/UI surface |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

> The user delegated **all** Phase 5 gray areas to Claude with a single north star: **"follow coding best practices, established codebase patterns, and focus on user experience."** The decisions below are LOCKED for downstream agents.

### Locked Decisions

- **D-01:** Lock `web_search_20250305` (stable). The newer `web_search_20260209` (dynamic domain filtering) requires the `code_execution` tool and is DEFERRED. SDK `^0.92.0` already exposes the typed shapes.
- **D-02:** Server-tool handling, NOT client dispatch. `web_search` is registered in `tools[]` but NEVER routed through `ToolRegistryService.dispatch`; Anthropic runs it server-side, results arrive inline. The loop treats a `server_tool_use`/`web_search_tool_result` turn as a normal turn to render. `pause_turn` resume is the continuation path. `web_search` stays out of `WRITE_PROPOSAL_TOOLS` (`isWriteProposal` false).
- **D-03:** Grounded web citations render as inline numbered footnotes `[n]` + a per-message "Sources" list (title + clickable `https:` URL). Reuses/extends the `isLinkableCitation` allow-list; `web_search_result_location` becomes the only thing that becomes `<a href>`, gated to `https:`.
- **D-04:** The "from research" badge upgrades along the source × confidence axes. A claim backed by a live `web_search_result_location` → source axis "from research · grounded" + footnote link. An un-grounded "from research" claim stays plain text, no link (Phase 4 framing). The two must be visibly distinct by a non-color channel.
- **D-05:** Live in-stream search feedback ("🔎 Searching the web…" → "✓ Found N sources"), expandable to the structured detail, mirroring the Phase 4 tool rendering.
- **D-06:** `webSearchMaxUses` default stays `3`; surfaced as a configurable cap in `/settings/ai` (bounded range, field already ships `min=0 max=10`), value rendered near the toggle to visibly bound cost.
- **D-07:** No domain allow/block list this milestone. Trust mechanism is the citation-link guard + source/confidence labels, not domain gating. (Capture "curated/reputable-source allow-list" as deferred.)
- **D-08:** When to reach for the web is system-prompt-driven (AI-SPEC deliverable). Prefer the user's own data + training knowledge; reach for web for genuinely current/research-grounded questions.
- **D-09:** The adversarial citation test extends, not replaces, the Phase 4 guard. Full matrix: web search OFF → "find a study about X" yields zero links; web search ON → only structured `web_search_result_location` blocks become links, free-text prose stays plain.
- **D-10:** Privacy posture for web-enabled queries. Meal-note redaction toggle operates at per-entry free-text note granularity (not the aggregate numeric kcal/macro line). `validators.ts` re-validation of model-proposed tool args stays binding. System prompt discourages embedding personal/health specifics into web-search query strings.
- **D-11:** Edit reuses the existing per-page entry form, pre-filled, toggled into edit mode — NOT a modal or separate route. Per-row Edit button loads the row into the form; Save updates, Discard restores add mode. Mirrors `DietService` in-place update. Validators run unchanged.
- **D-12:** Edits preserve `id` + `createdAt`, refresh `updatedAt`, re-run validation. New `update*` methods on `CardioService`, `WeightService`, `ReadingsService` mirroring the `DietService` shape. For `HealthReading` (discriminated union), planner chooses single `updateReading(id, input)` (dispatch on `type`) vs. three-method split. Watch the `updateMeal` stale-`savedFoodName` bug as an adjacent hazard (fix only if trivially adjacent).
- **D-13:** Chat archival = lazy per-conversation archive key through `StorageService` (e.g. `fitness_tracker_archive_{conversationId}`). Pre-summary messages move out of the hot `AppData` slice, loaded on demand. ALL access through `StorageService`.
- **D-14:** The 95% block-write prompt offers archive/delete, NOT export. Quota uses `navigator.storage.estimate()`, cross-browser error matching (`QuotaExceededError` + Firefox `NS_ERROR_DOM_QUOTA_REACHED`). ≥70% soft warning banner; ≥95% writes blocked with archive/delete prompt. The `StorageService.getBackup` clipboard-copy may be surfaced as a 95% safety valve without building export.
- **D-15:** QUAL-01 (type tightening), QUAL-04 (multi-tab `storage` listener → "data changed elsewhere" banner; `lastModified` written-never-read), QUAL-06 (CSP meta in `src/index.html`: `default-src 'self'; connect-src 'self' https://api.anthropic.com; script-src 'self'; object-src 'none'; img-src 'self' data:`), QUAL-07 (401 → "rotate / re-enter key" prompt), QUAL-08 (axe-core per-route + manual keyboard + manual contrast; color-contrast deferral from Phase 1 D-13 now in-scope), QUAL-10 (mutation testing on `validators.ts` or `StorageService`) — executed per REQUIREMENTS.md acceptance criteria. Planner owns sequencing.
- **Folded IN-01:** Chat block-action errors (approve/discard/edit failures, currently `console.error`-only) surfaced via `<app-error-state>` — folded into QUAL-09.
- **Folded CR-04:** Resolved as D-10.

### Claude's Discretion
- System-prompt engineering (D-08/D-04/D-10 wording) → AI-SPEC (already delivered in 05-AI-SPEC.md §4b).
- Visual specifics (footnote/Sources styling, grounded badge, search row, edit-mode affordance, quota/multi-tab banner styling) → UI-SPEC (already delivered in 05-UI-SPEC.md).
- `updateReading` signature (single dispatch-on-`type` vs three methods), archive key naming + lazy-load trigger, `webSearchMaxUses` UI range, mutation-test tool/target → researcher/planner's call.
- Phase-internal sequencing (web-search vs quality sweep order; QUAL wave parallelization) → planner's call.

### Deferred Ideas (OUT OF SCOPE)
- `web_search_20260209` (dynamic domain filtering) — requires `code_execution`.
- Curated / reputable-source domain allow-list.
- Full data import/export (CSV / Apple Health / backup-restore).
- IndexedDB migration.
- Electron-update artifact signing/notarization.
- `updateMeal` stale-`savedFoodName` after food rename (fix only if trivially adjacent).
- **Hard scope rule (no creep):** No new tracking domains, no goals system, no data import/export, no IndexedDB, no Vitest migration. External food databases / barcode scanning stay deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESCH-01 | `web_search_20250305` server tool wired into `tools[]` when `enableWebSearch === true` (default off) | SDK types verified present in 0.92.0; `tools[]` assembly point is `runAgenticLoop` lines 312–317 + transport boundary `anthropic-api.service.ts`; `enableWebSearch` flag already exists in `AIToolSettings` (default false) |
| RESCH-02 | Web-search citations render as inline footnotes; only `https:` URLs clickable; `web_search_tool_result` blocks display in stream | `isLinkableCitation` already admits `web_search_result_location`; new pure `web-citation-parser.ts` narrows + `https:`-gates; renderer extends the Phase 4 `@switch`. **Anthropic end-user citation display is a binding compliance requirement** (see Pitfall 3) |
| RESCH-03 | `webSearchMaxUses` cap configurable; adversarial test proves "find a study about X" cannot produce un-grounded citation links | `webSearchMaxUses` field exists (default 3); `max_uses` maps to the SDK tool def; the adversarial spec extends the existing `chat-message-list.component.spec.ts` guard across the OFF/ON matrix (E1) |
| QUAL-01 | No `any` in production paths; documented exceptions carry `// TODO` | Existing convention already enforced (storage.service.ts has zero `any`); the new web-search casts at the transport boundary are the risk area |
| QUAL-02 | Quota detection + banner (≥70% warn, ≥95% block); `navigator.storage.estimate()`; cross-browser error matching | `getStorageInfo()` hardcodes 5 MB (must change); `saveData` matches only `QuotaExceededError`; banner host is `app.component.ts` |
| QUAL-03 | CRUD `update*` for cardio, weight, readings | **Confirmed gap:** Cardio/Weight have no update; Readings has 3 add methods. `DietService.updateSavedFood`/`updateMeal` is the template |
| QUAL-04 | Multi-tab `storage` event listener + "data changed elsewhere — refresh" banner | **Confirmed gap:** no `storage` listener; `lastModified` written in `saveData` but never read |
| QUAL-05 | Chat archival to lazy archive key (active slice stays small) | New `StorageService` archive-key methods; chat summary fields (`summary`, `summarizedMessageCount`) already exist on `ChatConversation` |
| QUAL-06 | CSP header: `default-src 'self'; connect-src 'self' https://api.anthropic.com; ...` | **Confirmed gap:** `src/index.html` has no CSP. Meta tag is the only delivery vehicle for a static/Electron app |
| QUAL-07 | 401 → "rotate / re-enter key" prompt, not console error | `AnthropicApiError.statusCode` already typed; chat-page already checks `statusCode === 401`; needs the specific rotate-key `<app-error-state>` |
| QUAL-08 | axe-core per route + manual keyboard + manual contrast across 8 pages; color-contrast now in-scope | `expectNoSeriousA11yViolations` helper exists; Phase 1 specs pass `disableRules: ['color-contrast']` — must remove that for QUAL-08 |
| QUAL-09 | UX consistency (forms, validation, empty/error states) across 8 pages; folds IN-01 | `<app-empty-state>`/`<app-error-state>` already retrofitted across pages (FOUND-03/06); IN-01 surfaces block-action errors |
| QUAL-10 | Mutation testing on ≥1 critical service | **Stryker not installed.** v9.6.1 + `@stryker-mutator/karma-runner` (`projectType: angular-cli`) is the path; target `validators.ts` (pure, fast) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Storage chokepoint:** ALL LocalStorage access goes through `StorageService` — never read/write `localStorage` directly elsewhere. Binds D-13 archive keys and QUAL-02/04. (Tree-wide grep gate exists from Phase 1: `localStorage.(getItem|setItem|removeItem)` outside `storage.service.ts(.spec)` returns no matches — Phase 5 must keep it green.)
- **Standalone components only** — no NgModules.
- **Strict TS, no `any`** in production paths except documented third-party-interface cases with `// TODO: type when lib supports it`. (QUAL-01 enforces this.)
- **One domain service per data type;** services handle validation, ID generation (`crypto.randomUUID()` via `shared/id.ts` `generateId()`), timestamps, delegate persistence to `StorageService`, sort by date descending.
- **Validation in `validators.ts` + services;** runs before persistence; invalid data throws. Ranges (duration 1–1440, distance 0.01–1000 km, weight 50–1000 lbs, systolic 60–250, diastolic 40–150, glucose 1.0–35.0, ketones 0.0–10.0, calories 0–20000); systolic > diastolic; notes ≤ 500 chars; net carbs = max(0, carbs − fiber).
- **Data model conventions:** all entities have `id` (UUID v4), `createdAt`, `updatedAt` (ISO 8601). `HealthReading` is a discriminated union on `type`. Optional fields use `?`, never `null`.
- **Schema migration discipline:** any `AppData` shape change bumps `CURRENT_SCHEMA_VERSION` (currently **5**) with a `migrateVxToVy()` + a backward-compat fixture test. Existing stored data without new fields must load without errors.
- **Component pattern:** UI only — delegate business logic to services. RxJS + async pipe; `takeUntilDestroyed(inject(DestroyRef))` on every `.subscribe`.
- **a11y basics:** semantic HTML, every input has a label/aria-label, keyboard navigable, **color is never the only state indicator** (binds D-04/D-05 badges + all banners).
- **Unit tests required** for every service/validator; mock storage/timers; tests order-agnostic.
- **Commit format:** `<type>(<scope>): <description>`.
- **SDK transport boundary (D-17):** only `anthropic-api.service.ts` and `chat-block-serializer.ts` may import `@anthropic-ai/sdk` (lint chokepoint).

## Standard Stack

### Core (all already installed — net-zero new runtime deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.92.0 (installed, verified) | Web-search server tool types + transport | Already adopted Phase 3; web-search is a *request parameter*, not a package. All needed types present (verified below) |
| `@angular/*` | 18.2.x | Framework | Locked stack |
| `rxjs` | 7.8.x | Observables | Locked stack |
| `axe-core` | 4.11.4 (installed) | Per-route a11y assertions (QUAL-08) | Already wired via `expectNoSeriousA11yViolations` |

### Supporting (new dev-only dependency for QUAL-10)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@stryker-mutator/core` | 9.6.1 (verified current) | Mutation testing runner | QUAL-10 — install as devDependency |
| `@stryker-mutator/karma-runner` | 9.6.1 (verified current; peer `@stryker-mutator/core@9.6.1`) | Runs Stryker mutants through the project's own Karma | QUAL-10 — `projectType: angular-cli` uses `ng test` |

**Installation (QUAL-10 only):**
```bash
npm install --save-dev @stryker-mutator/core@9.6.1 @stryker-mutator/karma-runner@9.6.1
```

`stryker.config.json` shape for this project (HIGH — from official Angular guide):
```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "karma",
  "karma": {
    "projectType": "angular-cli",
    "configFile": "karma.conf.js",
    "config": { "browsers": ["ChromeHeadless"] }
  },
  "reporters": ["html", "clear-text", "progress"],
  "concurrency": 2,
  "mutate": ["src/app/services/validators.ts"],
  "coverageAnalysis": "perTest"
}
```
> **Karma config gotcha:** the `angular-cli` projectType drives Stryker via `ng test`. This project currently has **no `karma.conf.js` checked in** (Angular CLI generates an implicit one). Stryker's `angular-cli` runner works without an explicit file in recent versions, but planning should budget a task to `ng generate config karma` (or add a minimal `karma.conf.js`) if Stryker can't locate the config — confirm at implementation time. `[CITED: stryker-mutator.io/docs/stryker-js/guides/angular]`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `web_search_20250305` | `web_search_20260209` | Dynamic domain filtering + token savings, but **requires `code_execution` tool** and is not ZDR-eligible by default — premature for single-user. LOCKED to stable per D-01. |
| Stryker | Hand-rolled "kill a line, re-run tests" | No tooling, no mutation operators, no score report. Stryker is the standard for TS/Angular. |
| CSP via server header | CSP via `<meta http-equiv>` | This is a static/Electron-renderer app with no server in the loop; **meta tag is the only delivery vehicle**. (See CSP pitfall — `frame-ancestors`/`sandbox`/`report-uri` are ignored in meta form, but none are needed here.) |

## Architecture Patterns

### System Architecture Diagram (web-search data flow)

```
User message (chat-input)
        │
        ▼
chat-page.component ──persist user msg──▶ StorageService (AppData.chat)
        │
        ▼
ChatService.runAgenticLoop  (Observable<ChatTurnEvent>)
        │  builds tools[] = query_* + memory + [web_search IF enableWebSearch]   ← RESCH-01
        ▼
AnthropicApiService.sendMessage  (D-17 sole SDK importer)
        │  appends WebSearchTool20250305 to MessageCreateParams.tools
        ▼
   Anthropic Messages API  ──runs the search SERVER-SIDE──▶ web
        │  returns ONE assistant turn containing, inline:
        │    text · server_tool_use · web_search_tool_result(+encrypted_content) · text(+citations)
        ▼
runAgenticLoop receives Message
        ├─ stop_reason switch:
        │     'tool_use'   → dispatch CLIENT tools (query_*/memory) only  ← b.type==='tool_use' filter
        │     'pause_turn' → re-send unmodified, turn-- (server-side search continuation)  ← D-02
        │     'end_turn'   → done (a web-search turn typically ends here)
        │  server_tool_use / web_search_tool_result are RENDER-ONLY (never dispatched)  ← D-02
        ▼
fromAnthropicMessage  (chat-block-serializer)  ── MUST preserve server-tool blocks + citations verbatim  ← KEY GAP
        ▼
ChatBlock[] persisted via StorageService   (encrypted_content/encrypted_index must round-trip)  ← Pitfall 7
        │
        ▼
web-citation-parser.toGroundedCitations()  ── narrow TextCitation[] → GroundedCitation[], https-gate  ← NEW PURE MODULE
        ▼
chat-message-list @switch  ── footnote [n] + Sources list (https-only <a>) + "research · grounded" badge  ← RESCH-02 / D-03/D-04
        │  + live "🔎 Searching…/Found N" rows from ChatTurnEvent  ← D-05
        ▼
Rendered message
```

### Recommended Project Structure (delta from existing tree)
```
src/app/
├── models/
│   ├── ai-chat.model.ts          # +ServerToolUseBlock/WebSearchToolResultBlock persisted shapes;
│   │                              #  +citations on the persisted text block; +GroundedCitation;
│   │                              #  +ChatTurnEvent web_search_started/results/error variants
│   └── app-data.model.ts          # archival index (if needed) → V6 migration; web-search flags already present
├── services/
│   ├── anthropic-api.service.ts   # buildWebSearchTool() → tools[]; narrow citations → GroundedCitation[]
│   ├── chat.service.ts            # emit web_search_* events; pause_turn already handled
│   ├── chat-block-serializer.ts   # pass server-tool blocks through VERBATIM (currently lifts to placeholder)
│   ├── web-citation-parser.ts     # NEW pure module — narrow + https-gate + dedupe (mirrors validators.ts)
│   ├── cardio.service.ts          # +updateSession (mirror DietService)
│   ├── weight.service.ts          # +updateEntry
│   ├── readings.service.ts        # +update{BloodPressure,BloodGlucose,Ketone} (3-method split, see below)
│   ├── fitness-context.service.ts # +system-prompt: when-to-search (D-08) + query-privacy (D-10)
│   └── storage.service.ts         # navigator.storage.estimate(); cross-browser quota matching; archive keys
└── features/
    ├── chat/chat-message-list.component.ts   # footnote/Sources/grounded-badge + live search row
    ├── chat/chat-page.component.ts           # 401 rotate-key prompt; block-action error surface
    ├── settings/settings-ai.component.ts     # webSearchMaxUses cost-context helper line
    ├── {cardio,weight,readings}/*-page.component.ts  # edit-mode form toggle + per-row Edit button
    └── (app.component.ts)         # quota + multi-tab banners ahead of <router-outlet>
```

### Pattern 1: Build the web-search server tool only when opted in
**What:** A pure builder at the transport boundary returns the SDK tool def or null.
**When to use:** Assembling `tools[]` in `anthropic-api.service.ts` / `runAgenticLoop`.
```typescript
// Verified shape against installed @anthropic-ai/sdk@0.92.0 WebSearchTool20250305
function buildWebSearchTool(settings: { enableWebSearch: boolean; webSearchMaxUses: number }):
  WebSearchTool20250305 | null {
  if (!settings.enableWebSearch) return null;          // OFF by default — opt-in (D-10)
  return { type: 'web_search_20250305', name: 'web_search', max_uses: settings.webSearchMaxUses ?? 3 };
}
// allowed_domains / blocked_domains / user_location: intentionally UNSET (D-07; user_location would leak coarse location)
```
> **Codebase note:** `runAgenticLoop` already filters tools by `enableMemoryTool`/`enableDataQueryTools` (chat.service.ts:312–317). Append web-search to that same filtered array, gated on `enableWebSearch`. The actual SDK-typed mapping must live in `anthropic-api.service.ts` per D-17.

### Pattern 2: The loop already protects against the worst server-tool bug
**What:** The agentic loop builds its dispatch list with `response.content.filter(b => b.type === 'tool_use')` (chat.service.ts:412–419). A `server_tool_use` block has `type: 'server_tool_use'`, so it is **structurally excluded from dispatch already**.
**When to use:** This is a *reassurance* for the planner — the D-02 "never dispatch the server tool" property is largely free. The remaining work is: (a) don't add `'web_search'` to `WRITE_PROPOSAL_TOOLS`, (b) emit the live `web_search_*` UI events, (c) preserve the blocks through persistence.
**Source:** `src/app/services/chat.service.ts:411–419` `[VERIFIED: codebase]`

### Pattern 3: In-place edit-mode toggle (CRUD parity)
**What:** Reuse the existing per-page form; toggle to edit mode on a per-row Edit click; `patchValue` the row; Save calls the new `update*` method.
**When to use:** cardio/weight/readings pages (D-11).
```typescript
// Service method — mirrors DietService.updateSavedFood (diet.service.ts:126–175)
updateSession(id: string, input: CreateCardioSession): Observable<CardioSession> {
  const v = validateCardio(input);                       // SAME validators (D-12)
  if (!v.valid) return throwError(() => new CardioValidationError(v.errors));
  return this.storageService.getData().pipe(switchMap(data => {
    if (!data) return throwError(() => new Error('Storage not initialized'));
    const idx = data.cardioSessions.findIndex(s => s.id === id);
    if (idx < 0) return throwError(() => new Error('Cardio session not found'));
    const existing = data.cardioSessions[idx];
    const updated: CardioSession = {
      ...existing, ...input,                              // overwrite editable fields
      id: existing.id, createdAt: existing.createdAt,     // PRESERVE identity (D-12)
      updatedAt: new Date().toISOString(),                // REFRESH (D-12)
    };
    const cardioSessions = [...data.cardioSessions];
    cardioSessions[idx] = updated;
    return this.storageService.saveData({ ...data, cardioSessions }).pipe(map(() => updated));
  }));
}
```
> **Readings discriminated union (D-12 decision):** ReadingsService already has **three** add methods (`addBloodPressure`/`addBloodGlucose`/`addKetone`) and a generic `saveReading<T>`. **Recommendation: three-method split** (`updateBloodPressure`/`updateBloodGlucose`/`updateKetone`) — it mirrors the existing add shape exactly, keeps each input type narrow (no runtime `type` dispatch), and preserves discriminated-union type safety with zero casts. A single `updateReading(id, input)` would have to re-discriminate at runtime and widen the input type. `[VERIFIED: codebase readings.service.ts:73–135]`

### Pattern 4: Quota detection with `navigator.storage.estimate()`
**What:** Replace the hardcoded 5 MB in `getStorageInfo()` with the real estimate; match both quota error names in `saveData`.
```typescript
// async — navigator.storage.estimate() returns { usage, quota }
async function readQuota(): Promise<{ pct: number } | null> {
  if (!navigator.storage?.estimate) return null;         // older browsers — graceful null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return quota > 0 ? { pct: (usage / quota) * 100 } : null;
}
// Cross-browser quota error matching (D-14) — extend saveData's catch (storage.service.ts:272)
function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException &&
    (e.name === 'QuotaExceededError' ||                  // Chrome/Safari + spec
     e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||          // Firefox
     e.code === 22 || e.code === 1014);                  // legacy numeric fallbacks
}
```
> **Caveat:** `navigator.storage.estimate()` reports **origin-wide** usage/quota (all storage for the origin, not just LocalStorage), and quota is browser/disk dependent (often far larger than 5 MB). The 70/95% thresholds are therefore against the *browser-reported origin quota*, which is the correct, honest signal (better than the old fake 5 MB). LocalStorage itself still has its own ~5–10 MB cap that surfaces as the `QuotaExceededError` on `setItem` regardless — so **both** signals matter: estimate-driven banner (proactive) + error-name matching on write (reactive). `[VERIFIED: MDN]`

### Pattern 5: CSP via meta tag for a static/Electron app
```html
<!-- src/index.html <head> — QUAL-06 exact policy from D-15 -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; connect-src 'self' https://api.anthropic.com; script-src 'self'; object-src 'none'; img-src 'self' data:;">
```
> **Angular 18 gotcha (MEDIUM):** Angular's runtime injects component styles as inline `<style>` tags. The CSP above omits `style-src`, so it falls back to `default-src 'self'` — which **blocks inline styles** unless you add `style-src 'self' 'unsafe-inline'`. The D-15 policy as written may break Angular's style injection. **Recommendation:** verify at implementation time whether `style-src 'self' 'unsafe-inline'` is needed (Angular CLI can emit styles as files, but component `styles: [...]` arrays inject inline). Angular 18 supports per-build CSP nonces via `ngCspNonce`, but that needs a server to set the nonce — not available here. Document the chosen `style-src` as an explicit decision. `[ASSUMED → needs verification at build]` See Pitfall 5.

### Anti-Patterns to Avoid
- **Treating a `server_tool_use` block as a client `tool_use` to dispatch** → double-bill/wedge. The loop's `type === 'tool_use'` filter already prevents this; do not "helpfully" widen it.
- **Posting a `tool_result` back for the web-search tool** → Anthropic already returned the result inline; an extra `tool_result` confuses the next turn. Server tools need no round-trip.
- **Letting the serializer lift server-tool blocks to a text placeholder** → destroys `encrypted_content`/citations (current behavior — see Pitfall 7).
- **Rendering model-authored prose citation strings as links** → the fabrication failure mode (Pitfall 3). Only structured `web_search_result_location` blocks become `<a>`.
- **Hardcoding the 5 MB quota** → use `navigator.storage.estimate()` (QUAL-02 acceptance criterion).
- **Reading/writing `localStorage` outside `StorageService`** → breaks the chokepoint grep gate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Web search execution | A fetch-the-web client / scraper | The `web_search_20250305` server tool | Anthropic runs it server-side; no executor to write; ZDR-eligible |
| Citation link rendering | Markdown autolinker / regex URL→`<a>` | Structured `web_search_result_location` only, `https:`-gated | Autolinking model prose IS the fabrication vuln (14–95% rate) |
| HTML in messages | `innerHTML` / `bypassSecurityTrust*` | The existing strict markdown subset | XSS + lets fabricated links through |
| Quota estimate | Hardcoded byte budget | `navigator.storage.estimate()` | Browser-accurate, origin-wide; acceptance criterion |
| Quota error detection | `try/catch` swallow | Name + numeric-code matching across browsers | Firefox uses `NS_ERROR_DOM_QUOTA_REACHED` |
| Cross-tab sync | Polling / custom BroadcastChannel | The `storage` `window` event | Fires automatically on other-tab writes; spec-standard |
| Mutation testing | "comment a line, re-run" | Stryker `karma-runner` | Real mutation operators + score report |
| UUID / date grouping | New helpers | `shared/id.ts generateId()`, `shared/chart-grouping.ts` | Already centralized (FOUND-02) |
| Empty/error UI | New components | `<app-empty-state>` / `<app-error-state>` | Already retrofitted across pages (FOUND-06) |

**Key insight:** Nearly every "new" capability in this phase has an existing, tested analog in the codebase. The phase's risk is not invention — it's *correctly extending* the persistence/serialization model so structured citations and encrypted server-tool fields survive a save/reload round-trip.

## Runtime State Inventory

> This phase adds new LocalStorage keys (D-13 archival) and changes the persisted chat-block shape. Inventory of state that outlives a code change:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (1) `AppData` under `fitness_tracker_data` (V5) — persisted `ChatBlock[]` will need to carry server-tool blocks + citations. (2) NEW archive keys `fitness_tracker_archive_{conversationId}` (D-13). (3) Existing backup keys `fitness_tracker_data.backup.*` (Phase 1). | Schema: if `AppData`/`ChatBlock` shape changes, **bump to V6 with `migrateV5ToV6` + backward-compat fixture** (CLAUDE.md). Archive keys are new, additive, routed through `StorageService`. Backward-compat: V5 chats with no citations must load unchanged. |
| Live service config | None — no external service stores app strings. The only egress is the Anthropic API request (stateless). | None. |
| OS-registered state | Electron app (`electron:build`/`electron-updater`), but Phase 5 introduces no new OS registration. | None — Electron-update signing is explicitly deferred. |
| Secrets/env vars | API key stored in `AppData.aiSettings.apiKey` via `StorageService` (local only). 401 handling (QUAL-07) surfaces a rotate prompt; the key itself is user-entered, not an env var. | None — QUAL-07 is a UI/error-mapping change, not a key-storage change. |
| Build artifacts | Stryker (QUAL-10) generates `reports/mutation/` and `.stryker-tmp/`. | Add both to `.gitignore`; they are dev-only outputs. |

**Schema-migration note:** Whether a V6 migration is needed depends on the planner's persistence choice for grounded citations. If grounded citations are stored on the persisted text block (recommended, so they survive reload), `ChatBlock`/`TextBlock` shape changes → **V6 + migration + fixture required**. If the planner chooses to re-derive citations only at render time and *not* persist them, no migration is needed but multi-turn citation resolution still requires the `encrypted_content`/`encrypted_index` to be persisted on the server-tool blocks — which is itself a `ChatBlock` union change → still V6. **Plan for a V6 migration.**

## Common Pitfalls

### Pitfall 1: Serializer destroys server-tool blocks and citations on round-trip (HIGHEST STAKES)
**What goes wrong:** `chat-block-serializer.ts fromAnthropicMessage` currently maps any block that isn't `text`/`tool_use` to `{ type: 'text', text: '[unsupported block type: …]' }` (lines 127–135), and `toAnthropicContent` only handles `text`/`tool_use`/`tool_result`. A web-search turn's `server_tool_use` + `web_search_tool_result` (with `encrypted_content`) and the `citations` on text blocks would be **silently flattened to placeholder text** on persist, and on the next turn the encrypted indices Anthropic needs are gone — citations stop resolving and grounding breaks.
**Why it happens:** The persisted `ChatBlock` union (`TextBlock | ToolUseBlock | ToolResultBlock`) has no variant for server-tool blocks, and `TextBlock` has no `citations` field.
**How to avoid:** Extend the `ChatBlock` union with server-tool block variants and add a `citations?` field to the persisted text block; make the serializer pass these through verbatim (both directions); add a round-trip spec asserting `encrypted_content`/`encrypted_index` are byte-stable (fixture F13). This is the foundational task on the web-search track. `[VERIFIED: codebase chat-block-serializer.ts:113–137 + ai-chat.model.ts:9–64]`
**Warning signs:** Citations vanish on the second turn; "[unsupported block type: web_search_tool_result]" appears in a transcript; multi-turn grounded answers lose their links.

### Pitfall 2: Fabricated citation links (the headline RESCH-03 failure — 14–95% LLM citation fabrication)
**What goes wrong:** Web search now produces real links, which tempts relaxing the guard. But the model can still write an author-year string / bare DOI / bare URL *in prose* with no backing `web_search_result_location`; if that becomes an `<a>`, an authoritative-looking link launders an unsupported claim.
**Why it happens:** Markdown autolinking, `innerHTML`, or treating any URL-shaped string as linkable.
**How to avoid:** ONLY a `web_search_result_location` citation (via `isLinkableCitation`, already present) becomes a link, narrowed + `https:`-gated by the new `web-citation-parser.ts`. `bypassSecurityTrust*`/`innerHTML`/prose autolinking stay forbidden. The adversarial E1 spec asserts `querySelectorAll('a').length === 0` for model-authored prose across the OFF/ON matrix. `[VERIFIED: PITFALLS Pitfall 1 + 05-AI-SPEC CFM-1]`
**Warning signs:** An `<a>` in a rendered message that doesn't trace to a structured citation block; a non-`https:` URL clickable.

### Pitfall 3: Anthropic's end-user citation display is a binding compliance requirement
**What goes wrong:** Showing web-search-derived text to the user without surfacing the source citations violates Anthropic's terms.
**Why it happens:** Treating the Sources list as optional polish.
**How to avoid:** The per-message Sources list (D-03) is not just UX — it's required. Anthropic docs: *"When displaying API outputs directly to end users, citations must be included to the original source."* The grounded footnote + Sources list satisfies this. `[CITED: platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool]`
**Warning signs:** A grounded claim with no visible source link.

### Pitfall 4: Web-search errors arrive in an HTTP 200 (not a transport failure)
**What goes wrong:** A rate-limit / `max_uses_exceeded` / `query_too_long` returns `content: { type: 'web_search_tool_result_error', error_code }` inside a **200** response. Treating it as a hard failure, assuming `content` is always an array, or blindly retrying crashes the render or re-bills.
**How to avoid:** Always narrow `WebSearchToolResultBlock.content` against the error union; surface an honest "couldn't reach the web" row (D-05) and let the model finish from its own knowledge; never retry. Errored searches are **not billed**. Error codes (verified from docs): `too_many_requests`, `invalid_input`, `max_uses_exceeded`, `query_too_long`, `unavailable`. (The SDK's `WebSearchToolResultErrorCode` union also includes `invalid_tool_input` and `request_too_large` — handle the full SDK union defensively.) `[VERIFIED: Anthropic docs + SDK 0.92.0 types]`
**Warning signs:** A thrown error on a search turn; a blank/crashed message; duplicate search billing.

### Pitfall 5: Angular inline styles vs the CSP `style-src` fallback
**What goes wrong:** The D-15 policy has no `style-src`, so it inherits `default-src 'self'`, which forbids the inline `<style>` blocks Angular injects from component `styles: [...]` arrays — pages render unstyled or the console floods with CSP violations.
**Why it happens:** Angular 18 injects component styles inline at runtime by default.
**How to avoid:** Verify at implementation whether `style-src 'self' 'unsafe-inline'` must be added. There is no server to set a per-request nonce (`ngCspNonce` needs one), so `'unsafe-inline'` for styles is the pragmatic choice for a local app. Document the final `style-src` value as an explicit deviation/addition to the D-15 string, and confirm `connect-src 'self' https://api.anthropic.com` actually permits the SDK's request (it should — SDK calls `api.anthropic.com`). `[ASSUMED → verify at build]`
**Warning signs:** Unstyled UI after adding the meta tag; `Refused to apply inline style` CSP console errors.

### Pitfall 6: `storage` event does not fire in the tab that made the change
**What goes wrong:** A naive multi-tab test in one tab never sees its own event and concludes the listener is broken.
**How to avoid:** The `storage` event fires only in *other* same-origin tabs/windows, by spec. Test it with two contexts (the Puppeteer e2e harness can open two pages) or by dispatching a synthetic `StorageEvent` in a unit test. The banner should compare the incoming `lastModified` (currently written-never-read, QUAL-04) against the in-memory value to avoid false positives from unrelated keys. `[VERIFIED: MDN]`
**Warning signs:** Banner never appears in manual single-tab testing; banner appears on the writing tab.

### Pitfall 7: Edit must preserve identity, and the readings union must stay type-safe
**What goes wrong:** A typo-fix edit that re-creates the entry loses `id`/`createdAt` (breaks chart history continuity and any future references); a single generic `updateReading` widens the input type and needs runtime `type` dispatch, risking a wrong-shape write into the discriminated union.
**How to avoid:** Spread `...existing` then explicitly re-pin `id` + `createdAt`, refresh `updatedAt`, re-validate (D-12). For readings, use the three-method split mirroring the three add methods. `[VERIFIED: codebase]`
**Warning signs:** Edited entries jump to "now" on charts; an `as` cast appears in a readings update path.

## Code Examples

### Narrow + https-gate web citations (the new pure module)
```typescript
// services/web-citation-parser.ts — PURE, no DI (mirrors validators.ts / confidence-attribution-parser.ts)
// Verified: CitationsWebSearchResultLocation { url, title: string|null, cited_text, encrypted_index }
//           is exported from @anthropic-ai/sdk@0.92.0 (grep-confirmed in node_modules)
import type { TextCitation } from '@anthropic-ai/sdk/resources/messages';

export interface GroundedCitation { readonly url: string; readonly title: string; readonly citedText: string; }

export function toGroundedCitations(citations: readonly TextCitation[] | undefined): GroundedCitation[] {
  if (!citations) return [];
  const out: GroundedCitation[] = [];
  for (const c of citations) {
    if (c.type !== 'web_search_result_location') continue;     // allow-list (D-09)
    let parsed: URL;
    try { parsed = new URL(c.url); } catch { continue; }       // unparseable → drop
    if (parsed.protocol !== 'https:') continue;                // https gate (D-03/RESCH-02)
    out.push({ url: parsed.toString(), title: c.title?.trim() || parsed.host, citedText: c.cited_text ?? '' });
  }
  return out;
}
export function toSourcesList(cs: readonly GroundedCitation[]): GroundedCitation[] {
  const seen = new Set<string>();
  return cs.filter(c => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}
```
> Source: 05-AI-SPEC §4b (verified against the installed SDK types this session).

### Verified Anthropic web-search response shape (for fixture authoring)
```jsonc
// [VERIFIED: live Anthropic docs 2026-05-31] — the canned-fixture template
{ "role": "assistant", "stop_reason": "end_turn", "content": [
  { "type": "text", "text": "I'll search for…" },
  { "type": "server_tool_use", "id": "srvtoolu_…", "name": "web_search", "input": { "query": "…" } },
  { "type": "web_search_tool_result", "tool_use_id": "srvtoolu_…", "content": [
    { "type": "web_search_result", "url": "https://…", "title": "…", "encrypted_content": "Eq…", "page_age": "April 30, 2025" } ] },
  { "type": "text", "text": "Claude Shannon was born on April 30, 1916…", "citations": [
    { "type": "web_search_result_location", "url": "https://…", "title": "…", "encrypted_index": "Eo…", "cited_text": "…" } ] }
] }
// Error variant: web_search_tool_result.content = { "type": "web_search_tool_result_error", "error_code": "max_uses_exceeded" }
// usage.server_tool_use.web_search_requests counts billed searches
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded 5 MB quota guess | `navigator.storage.estimate()` | Standard for years | QUAL-02 acceptance criterion; honest origin-wide signal |
| `web_search_20250305` only | `web_search_20260209` (dynamic filtering) now exists | 2026-02-09 | Token savings, needs `code_execution` — **deferred (D-01)** |
| `text.length/4` token heuristic | SDK `messages.countTokens` | Phase 3/4 (done) | Already migrated; web results inflate window across turns |

**Deprecated/outdated:** None blocking. Note the AI-SPEC pins model default `claude-sonnet-4-6`; `CLAUDE_MODELS` in code lists sonnet-4-6/haiku-4-5/opus-4-8 — consistent.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding `style-src 'self' 'unsafe-inline'` will be needed for Angular inline component styles under the D-15 CSP | Pitfall 5 / Pattern 5 | If wrong (styles emitted as files), the extra directive is harmless; if right and omitted, the app renders unstyled. Verify at build by adding the meta tag and loading a page. |
| A2 | Stryker `angular-cli` runner works without an explicit `karma.conf.js` checked in | Standard Stack | If wrong, QUAL-10 needs a `ng generate config karma` task added. Low risk — easy to add. |
| A3 | A V6 schema migration will be required (citations/server-tool blocks persisted) | Runtime State Inventory | If the planner chooses render-time-only citations AND doesn't persist encrypted fields, multi-turn citations break instead. Recommendation stands: plan for V6. |

## Open Questions (RESOLVED)

1. **Persist grounded citations + encrypted fields, or re-derive at render?** — **RESOLVED (plan 05-02).**
   - What we know: Multi-turn citation resolution *requires* `encrypted_content`/`encrypted_index` to be sent back; the renderer needs `web_search_result_location` to draw footnotes.
   - Resolution: Plan **05-02** persists the `server_tool_use` / `web_search_tool_result` server-tool blocks + `TextBlock.citations` **verbatim** through `chat-block-serializer.ts` (byte-stable `encrypted_content`/`encrypted_index`, F13 round-trip spec) and ships the **V6 schema migration** (`migrateV5ToV6`) so the extended `ChatBlock` shape persists with backward compatibility. The slimmer-form option is rejected (risks Pitfall 1/7).

2. **CSP `style-src` final value (A1).** — **RESOLVED (plan 05-07).**
   - Resolution: Plan **05-07** Task 2 commits `style-src 'self' 'unsafe-inline'` as an explicit addition to the D-15 CSP `<meta>` string (Angular 18 injects component `styles:[...]` inline at runtime — Pitfall 5), verified by the 05-07 e2e console-error check (no `Refused to apply inline style`) and matched against the 05-01 `index.html.csp-assertion.spec.ts` contract. `script-src` stays `'self'` (no inline-script loosening).

3. **Banner stacking vs one-at-a-time (UI-SPEC Open Item 4).** — **RESOLVED (plan 05-07).** Planner's call exercised in 05-07 Task 1: banners stack by severity (recovery > 95% block > multi-tab > 70% warn) with collapse-to-most-severe permitted; the UI contract holds either way.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` | RESCH-01/02/03 | ✓ | 0.92.0 (web-search types confirmed) | — |
| `axe-core` | QUAL-08 | ✓ | 4.11.4 | — |
| Angular CLI / Karma / Jasmine | all tests | ✓ | 18.2.x / 6.4 / 5.2 | — |
| Puppeteer (e2e a11y harness) | QUAL-08 / multi-tab e2e | ✓ | 24.37.3 | — |
| `@stryker-mutator/core` + `karma-runner` | QUAL-10 | ✗ | needs `9.6.1` | None — must install (dev dep) |
| `navigator.storage.estimate()` | QUAL-02 | runtime API | — | Graceful `null` on old browsers; LocalStorage error-matching still works |
| `ChromeHeadless` | Karma + Stryker | ✓ (karma-chrome-launcher present) | — | — |

**Missing dependencies with no fallback:** Stryker (QUAL-10) — install as devDependency.
**Missing dependencies with fallback:** `navigator.storage.estimate()` — fall back to write-time error matching if absent.

## Validation Architecture

> Nyquist validation is enabled (no `workflow.nyquist_validation: false` found). Eval strategy is fully specified in 05-AI-SPEC §5 (E1–E9) and the 14-fixture reference dataset (F1–F14). This section maps it to runnable signals.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jasmine 5.2 + Karma 6.4 (+ axe-core 4.11.4); Puppeteer 24 for e2e |
| Config file | Angular CLI implicit (no checked-in `karma.conf.js`); tsconfig.spec.json |
| Quick run command | `ng test --no-watch` (single service/component via `--include` or fdescribe) |
| Full suite command | `ng test --no-watch --code-coverage` |
| Build gate | `ng build --configuration=production` |
| Mutation (QUAL-10) | `npx stryker run` (after install) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESCH-01 | web_search appended to tools[] iff enableWebSearch; max_uses=webSearchMaxUses | unit | `ng test --no-watch` (anthropic-api.service.spec) | ✅ extend |
| RESCH-02 | only https web_search_result_location → `<a>`; Sources list renders | unit/DOM | chat-message-list.component.spec + NEW web-citation-parser.spec | ✅ extend / ❌ Wave 0 new |
| RESCH-03 (E1) | OFF/ON adversarial: prose citations → zero `<a>` | unit/DOM | chat-message-list.component.spec (querySelectorAll('a')) | ✅ extend — **acceptance gate** |
| RESCH (E3) | server_tool_use → 0 dispatch; pause_turn resume no turn decrement; encrypted fields byte-stable | unit | chat.service.spec + chat-block-serializer.spec | ✅ extend |
| RESCH (E4) | each web_search_tool_result_error code → honest row, no retry, no throw | unit | chat.service.spec / anthropic-api.service.spec | ✅ extend |
| RESCH (E5) | system prompt contains D-10 privacy instruction; OFF by default | unit | fitness-context.service.spec | ✅ extend |
| RESCH (E6) | buildWebSearchTool max_uses === setting; value in settings DOM | unit | anthropic-api.service.spec + settings-ai.component.spec | ✅ extend |
| QUAL-01 | no `any` in production paths | static | grep gate / `ng build` strict | n/a (grep) |
| QUAL-02 | ≥70% warn / ≥95% block; estimate()-driven; both error names matched | unit | storage.service.spec + app.component.spec | ✅ extend |
| QUAL-03 | update* preserves id+createdAt, refreshes updatedAt, re-validates | unit | cardio/weight/readings.service.spec | ✅ extend |
| QUAL-04 | storage event → banner; lastModified compared | unit (synthetic StorageEvent) + e2e (2 tabs) | app.component.spec + e2e | ✅ extend |
| QUAL-05 | pre-summary messages move to archive key; lazy load restores | unit | storage.service.spec + chat.service.spec | ✅ extend |
| QUAL-06 | CSP meta present; connect-src allows api.anthropic.com only | static + e2e | index.html assertion / e2e console-error check | ❌ Wave 0 (add assertion) |
| QUAL-07 | 401 → rotate-key error-state, not console | unit/DOM | chat-page.component.spec | ✅ extend |
| QUAL-08 | zero serious/critical axe violations + color-contrast (deferral lifted) | unit (axe) + manual | per-route specs (remove `disableRules:['color-contrast']`) + e2e a11y | ✅ extend — **remove the deferral** |
| QUAL-09 | empty/error/validation consistency; block-action errors surfaced | unit/DOM | per-page specs + chat-page.component.spec | ✅ extend |
| QUAL-10 | mutation score floor on validators.ts | mutation | `npx stryker run` | ❌ Wave 0 (install + config) |

### Sampling Rate
- **Per task commit:** the spec(s) for the touched file (`ng test --no-watch --include`).
- **Per wave merge:** `ng test --no-watch --code-coverage` (full Karma suite — currently 269+ specs green) + `ng build --configuration=production`.
- **Phase gate:** Full suite green + the E1 adversarial test green (zero tolerance) + `npx stryker run` meets the agreed mutation-score floor + manual keyboard/contrast pass (QUAL-08) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/app/services/web-citation-parser.ts` + `web-citation-parser.spec.ts` — covers RESCH-02 (allow-list, https gate, null-title host fallback, dedupe).
- [ ] Server-tool fixtures (F1–F14 from 05-AI-SPEC §5) — canned `Message`-shaped TS/JSON, SDK transport spied; **build concurrently with implementation**.
- [ ] `ChatBlock` union + serializer round-trip spec (F13) — encrypted-field byte stability.
- [ ] `stryker.config.json` + `npm i -D @stryker-mutator/core@9.6.1 @stryker-mutator/karma-runner@9.6.1` (QUAL-10).
- [ ] CSP presence assertion (index.html / e2e console-error check) for QUAL-06.
- [ ] Agree the QUAL-10 mutation-score floor (suggest: a concrete % the planner pins — e.g. ≥80% on `validators.ts`; researcher recommends starting by measuring the baseline and setting the floor at the measured score, then ratcheting).
- [ ] Remove `disableRules: ['color-contrast']` from existing characterization/a11y specs (QUAL-08).
- *(Existing infra covers the rest: 269+ Jasmine specs, axe helper, Puppeteer e2e harness, migration-fixture pattern.)*

## Security Domain

> `security_enforcement` not set to false — included. This is a single-user, local, privacy-first app; the security surface is data egress + injection + citation integrity, not multi-user auth.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts; single local user. API key is user-held, stored locally. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No multi-user authorization. |
| V5 Input Validation | **yes** | `validators.ts` re-validates user input AND model-proposed tool args (CHAT-11). Web-search query is model-authored + egresses → system-prompt PII control (D-10). |
| V6 Cryptography | partial | Pass Anthropic's `encrypted_content`/`encrypted_index` back verbatim — never decode/modify. No hand-rolled crypto. |
| V7 Errors/Logging | **yes** | 401 surfaced as a rotate-key prompt, not console (QUAL-07); web-search errors surfaced honestly (E4); local-only logging (no egress tracer — AI-SPEC §7). |
| V12 Files/Resources | **yes** (CSP) | CSP `connect-src 'self' https://api.anthropic.com` is the egress allow-list (QUAL-06). |
| V14 Configuration | **yes** | CSP, `dangerouslyAllowBrowser` is required for the renderer (documented). |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fabricated citation link laundering an unsupported claim | Spoofing / Tampering | Structured-citation-only + `https:` gate; adversarial E1 test (zero tolerance) |
| PII egress via model-authored web-search query | Information Disclosure | System-prompt PII discouragement (D-10); OFF by default; per-note redaction; `validators.ts` re-validation of client tool args |
| Prompt injection from user free-text notes into the system prompt | Tampering | Existing `<user_*>` delimiter wrapping (CHAT-11) carries forward |
| XSS via model output rendered as HTML | Tampering / Elevation | Strict markdown subset; `bypassSecurityTrust*`/`innerHTML` forbidden |
| Uncontrolled outbound connections | Information Disclosure | CSP `connect-src` allow-list (QUAL-06) |
| Server-tool loop double-bill / wedge | DoS / cost | `type==='tool_use'` dispatch filter (already present); no `tool_result` round-trip; `pause_turn` cap (MAX_CONSECUTIVE_PAUSES already present) |

## Sources

### Primary (HIGH confidence)
- Installed `@anthropic-ai/sdk@0.92.0` type defs (`node_modules/@anthropic-ai/sdk/resources/messages/`) — grep-confirmed exports: `WebSearchTool20250305`, `ServerToolUseBlock`, `WebSearchResultBlock`, `WebSearchToolResultBlock`, `WebSearchToolResultError`, `CitationsWebSearchResultLocation`.
- [Anthropic web search tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool) — response shape, citation display compliance note, HTTP-200 error format + error codes, `encrypted_content`/`encrypted_index` multi-turn requirement, `max_uses`, $10/1000 pricing, `pause_turn`.
- Codebase (this session): `chat.service.ts` (loop, `type==='tool_use'` filter, `pause_turn` handling), `chat-block-serializer.ts` (the placeholder gap), `tool-registry.service.ts` (`WRITE_PROPOSAL_TOOLS`), `chat-message-list.component.ts` (`isLinkableCitation`), `cardio.service.ts`/`readings.service.ts`/`diet.service.ts` (CRUD analogs), `storage.service.ts` (quota/`lastModified`/`getBackup`), `ai-chat.model.ts` (`ChatBlock`/`ChatTurnEvent`/settings flags), `app.component.ts` (banner host), `src/index.html` (no CSP).
- 05-CONTEXT.md, 05-AI-SPEC.md, 05-UI-SPEC.md (locked decisions + design contracts).

### Secondary (MEDIUM confidence)
- [Stryker Angular guide](https://stryker-mutator.io/docs/stryker-js/guides/angular/) + [Karma runner](https://stryker-mutator.io/docs/stryker-js/karma-runner/) — `projectType: angular-cli`, uses project's own Karma.
- `npm view @stryker-mutator/core version` → 9.6.1; `@stryker-mutator/karma-runner` peer `@stryker-mutator/core@9.6.1` (verified this session).
- [MDN StorageManager.estimate()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate) and [storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) — origin-wide quota; event fires only in other tabs.

### Tertiary (LOW confidence / needs build-time verification)
- Angular 18 CSP `style-src 'unsafe-inline'` need for inline component styles — flagged A1, verify at implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SDK types verified in `node_modules`; Stryker version verified via npm.
- Architecture / web-search integration: HIGH — verified against live Anthropic docs + the actual loop code; the serializer/persistence gap is a confirmed code reading.
- CRUD / quota / multi-tab gaps: HIGH — confirmed by direct codebase inspection.
- CSP `style-src` interaction: MEDIUM — needs a 5-minute build-time check (A1).
- Pitfalls: HIGH for 1–4/6/7 (code + docs verified); MEDIUM for 5 (Angular CSP).

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (stable libraries; re-fetch Anthropic web-search docs + re-check SDK version if the SDK is bumped before implementation)
