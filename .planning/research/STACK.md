# Stack Research

**Domain:** Local-first single-user health/fitness tracker (Angular 18 SPA + Electron) — refinement milestone
**Researched:** 2026-05-02
**Confidence:** HIGH for Anthropic API features, MEDIUM for diet/UX libs (multiple credible options, choice depends on UX taste), HIGH for testing/a11y tooling

---

## Scope Note (READ FIRST)

The **core stack is locked** and is NOT re-recommended here:
Angular 18.2.x standalone, RxJS 7.8, chart.js 4.5 + ng2-charts 7.0, LocalStorage via `StorageService`,
Electron 33, TypeScript 5.5 strict, Karma + Jasmine, electron-builder 25, electron-updater 6.

This document only recommends **additive** stack pieces required to deliver the three refinement targets:

1. AI chat depth upgrade (memory, full-data access, grounding, citations, confidence labels)
2. Diet UX overhaul (food entry, units, daily totals)
3. Quality pass tooling (coverage, a11y)

All recommendations honor the locked constraints: LocalStorage-only persistence, single-user, must keep
working under the Electron shell (file:// + hash routing), Angular 18 standalone components only,
strict TypeScript.

---

## Recommended Stack

### Core Additions

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Anthropic Messages API: web search tool** | `web_search_20250305` (stable) | Live web grounding for AI coach claims. Returns `web_search_result_location` citations with `url`, `title`, `cited_text` | Native server-side tool that Anthropic executes — no backend required. Citations are first-class. Honors our "source attribution" requirement directly. Stable tool version supported on browser-direct calls with `anthropic-dangerous-direct-browser-access: true`. ([docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)) |
| **Anthropic Messages API: prompt caching** | `cache_control: { type: "ephemeral" }` (5m default) and `ttl: "1h"` (extended) | Cache the large fitness-data system prompt across turns. Cache reads cost 10% of input tokens | Our `FitnessContextService.buildSystemPrompt()` will grow large once it includes "full data" instead of a snapshot. Prompt caching makes that economical: with Sonnet 4.5/4.6 input is $3/M but cache reads are $0.30/M. Min cacheable size: 1,024 tokens for Sonnet 4.5 / 4 / 3.7. Supports up to 4 explicit breakpoints per request. ([docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)) |
| **Anthropic Messages API: search_result content blocks** | Generally available; supported on Sonnet 4.5/4.6, Opus 4.x, Haiku 4.5 | First-class RAG: pass our local data as `search_result` blocks, get back `cited_text` citations pointing into the original blocks | Lets us treat the user's logged data (cardio, weight, readings, meals, prior conversations) as searchable "documents" Claude can cite back when explaining a coaching claim. Strictly better than stuffing everything into the system prompt for grounding + attribution. Models the "AI knows everything" requirement without unbounded token cost. ([docs](https://platform.claude.com/docs/en/build-with-claude/search-results)) |
| **Anthropic Messages API: tool use (client tools)** | `tools: [...]` with `stop_reason: "tool_use"` loop | Targeted retrieval: let Claude call `get_cardio_in_range`, `get_meal_history`, `get_weight_trend`, `get_chat_memory` tools that the Angular app fulfills locally | Avoids stuffing the entire `AppData` into every prompt (token bloat + privacy bloat). Claude pulls only what it needs. Pure client-side execution against `StorageService` — no backend required. ([docs](https://platform.claude.com/docs/en/build-with-claude/tool-use)) |
| **`@anthropic-ai/sdk`** | `^0.92.0` (latest as of May 2026) | Replace the hand-rolled `fetch` wrapper in `anthropic-api.service.ts` for typed requests/responses, streaming, tool-use loop helpers, and `messages.countTokens` | Official SDK, supports `dangerouslyAllowBrowser: true` (sets `anthropic-dangerous-direct-browser-access: true` automatically), exposes typed shapes for `web_search_20250305`, `search_result` blocks, `cache_control`, and tool use. Removes a maintenance liability (we're hand-typing API shapes today). HIGH confidence — verified against [official npm](https://www.npmjs.com/package/@anthropic-ai/sdk) and [official SDK repo](https://github.com/anthropics/anthropic-sdk-typescript). |

### Supporting Libraries — Diet UX

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`convert`** (by Lucas Garron) | `^5.x` | Type-safe unit conversion (g↔oz, ml↔cups, etc.). Zero deps, smallest + fastest TS-first option | When converting between standard physical units. Smaller than `convert-units`, cleaner TS types than `js-quantities`. ([npm](https://www.npmjs.com/package/convert)) |
| **No barcode scanner library (RECOMMENDED FOR THIS MILESTONE)** | — | — | Defer barcode scanning: it adds camera plumbing, requires a non-`file://` origin to access `getUserMedia` reliably under Electron, and barcode → nutrition only works if paired with a public food DB (which has CORS issues — see below). Not on the validated requirement list. If revisited: `@zxing/ngx-scanner` `^21` (Angular-native) over QuaggaJS (orphaned). ([npm](https://www.npmjs.com/package/@zxing/ngx-scanner)) |
| **No external food database in the browser this milestone (RECOMMENDED)** | — | — | **Open Food Facts API does NOT support CORS** for browser-direct calls (multiple open issues: [#2788](https://github.com/openfoodfacts/openfoodfacts-server/issues/2788), [#1977](https://github.com/openfoodfacts/openfoodfacts-server/issues/1977), [#1089](https://github.com/openfoodfacts/openfoodfacts-dart/issues/1089)). **USDA FoodData Central API also does not support CORS** ([docs](https://fdc.nal.usda.gov/api-guide/)) and requires an API key. Adding either requires a backend proxy or Electron `net` module routing — both violate the "no backend" pillar OR introduce a desktop/web split. Defer; build best-in-class manual entry first. |

### Supporting Libraries — Quality Pass

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`axe-core`** | `^4.x` (latest stable) | WCAG 2.0/2.1/2.2 (A, AA, AAA) automated accessibility checks against rendered DOM | Add to one or two integration-style spec files (e.g. `app.component.spec.ts`, plus a smoke spec per route) that mount the component and assert `axe.run()` returns no violations. Catches ~57% of WCAG issues automatically — pair with manual keyboard/contrast pass. ([axe-core repo](https://github.com/dequelabs/axe-core)) |
| **`karma-coverage` (already installed)** + threshold config | bundled with Angular CLI | Enforce coverage floors as part of CI (or as a tracked metric) | Add a `check:` block to `karma.conf.js` (e.g. statements 75%, branches 65% as starting floors; ratchet up). Already-installed, zero new dep. ([Angular testing guide](https://angular.dev/guide/testing/karma)) |
| **`messages.countTokens`** (Anthropic SDK method) | included in `@anthropic-ai/sdk ^0.92.0` | Accurate ground-truth token counts for the chat-window summarization heuristic in `chat.service.ts` (currently uses a `length / 4` estimate against `TOKEN_WINDOW_SIZE = 8000`) | Replace the rough `length / 4` estimate when deciding whether to summarize. Free endpoint, rate-limited. Avoids overcounting (premature summarization) or undercounting (over-budget calls). ([token counting docs](https://platform.claude.com/docs/en/build-with-claude/token-counting)) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Karma + Jasmine (existing) | Continue as primary test runner | Do **not** migrate to Jest or Vitest in this milestone. The migration cost (jest-preset-angular config, Karma → ESM differences, spec rewrites) is not justified for a single-developer codebase with 12 spec files. Stay-the-course is the right call. |
| `axe-core` invoked from spec files | A11y audit | Don't pull in `jest-axe` (we're on Karma) — call `axe.run(fixture.nativeElement)` directly inside Jasmine `it()` blocks. |
| `karma.conf.js` `check` block | Coverage thresholds | Configure thresholds per CLAUDE.md "every service has .spec.ts" — make it enforceable, not just aspirational. |

---

## Installation

```bash
# Core: Anthropic SDK (replaces hand-rolled fetch wrapper)
npm install @anthropic-ai/sdk

# Diet UX: type-safe unit conversion
npm install convert

# Quality pass: a11y audit (devDependency)
npm install -D axe-core
```

That's the entire net add for this milestone. **Three packages.** No barcode scanner, no food database client, no test-runner migration, no state-management library, no IndexedDB wrapper.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@anthropic-ai/sdk` | Keep hand-rolled `fetch` wrapper in `anthropic-api.service.ts` | If we want zero new dependencies. But the SDK gives us typed `web_search_20250305`, `search_result`, `cache_control`, `tool_use` shapes for free — keeping hand-rolled types is now a net cost. |
| `web_search_20250305` (stable) | `web_search_20260209` (with dynamic filtering, Opus 4.6/4.7 + Sonnet 4.6 only) | Use the newer version *only* if we standardize on Opus 4.6+ or Sonnet 4.6 *and* find that web search is consuming too many tokens. Also requires the `code_execution` tool to be enabled. Premature for this milestone. ([docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)) |
| Anthropic web search tool | Tavily / Brave / Exa API for grounding | If we needed structured search results plus our own ranking/filtering, or wanted ZDR isolation from a third party. Anthropic's tool already returns Claude-friendly results with citations baked in — adding a second search vendor would be redundant. |
| `search_result` content blocks (RAG via tool returns) | Stuffing full `AppData` into the system prompt every turn | The status quo. Works at small data sizes but gives the user no source attribution and grows token cost unbounded as logging history grows. Use the snapshot path *only* for genuinely conversational system framing (e.g. "user prefers metric, has no kidney conditions"); use `search_result` for everything claim-bearing. |
| `convert` | `convert-units`, `js-quantities` | `convert-units` is fine and has more measures, but `convert` is smaller (matters for renderer bundle), faster, and has stricter TS types. `js-quantities` is overkill (full quantity calculus) and types live in `@types/js-quantities` separately. |
| Defer barcode scanning | `@zxing/ngx-scanner` ^21 | Add only after manual diet entry is genuinely smooth and we have a CORS-resolvable food DB path (probably via Electron IPC route, not browser fetch). Even then, `getUserMedia` under `file://` Electron requires `webPreferences.permissions` config — not free. |
| Defer external food DB | Open Food Facts via Electron `net` module IPC | Possible long-term: the Electron main process can fetch without CORS (server-side request). But this immediately splits behavior between web-served and Electron-shelled distributions, and we don't currently ship a web-served distribution. Reconsider only if we add one. |
| Karma + Jasmine (keep) | Vitest (the new Angular CLI default for new projects), Jest | Migration is not justified at our codebase size. Vitest-first scaffolding is for fresh projects. ([source](https://medium.com/@roshannavale7/mastering-angular-testing-in-2025-best-practices-for-unit-and-e2e-testing-with-jest-cypress-and-8d9f461bc96f)) |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **A backend / proxy server** | Violates the "LocalStorage-only, only outbound traffic is the Anthropic call" pillar. The user's API key would have to live on a server, multiplying attack surface. | Direct browser-to-Anthropic with `dangerouslyAllowBrowser: true`; this is the BYO-key pattern Anthropic explicitly supports for client apps ([SDK source](https://github.com/anthropics/anthropic-sdk-typescript)). |
| **IndexedDB / Dexie / RxDB** | Adds storage abstraction we don't need. LocalStorage cap (~5MB) is sufficient — even a "full history" view of years of fitness data plus persistent chat memory fits comfortably (typical entries are <500B JSON). The whole `StorageService` migration discipline assumes one canonical store. | Stay on LocalStorage via `StorageService`. Add a chat-memory bucket to `AppData` (V5 migration) and a per-conversation token-budget cache, both still inside the same JSON blob. Revisit only if `getStorageInfo()` shows >50% utilization or the JSON parse on init exceeds ~50ms. |
| **Open Food Facts API direct from browser** | API does not support CORS — multiple open server-side issues confirm this is a known limitation, not a transient outage ([#2788](https://github.com/openfoodfacts/openfoodfacts-server/issues/2788), [#1089](https://github.com/openfoodfacts/openfoodfacts-dart/issues/1089)). Calls will be blocked by browser, including under Electron `file://`. | Keep diet entry manual for this milestone. If pursued later, route via Electron main-process `net` module (server-side fetch) and expose to renderer via `contextBridge` IPC. |
| **USDA FoodData Central API direct from browser** | No CORS support, requires API key ([API guide](https://fdc.nal.usda.gov/api-guide/)). Same blocker as Open Food Facts plus secret management. | Same — defer; if needed, IPC proxy via Electron main. |
| **QuaggaJS (original)** | Repository archived, fork-only maintenance. If we ever do barcode, the active fork is Quagga2, but `@zxing/ngx-scanner` is more idiomatic for Angular. | If barcode is added later: `@zxing/ngx-scanner ^21`. ([scanbot comparison](https://strich.io/strich-compared-to-zxing-js-and-quagga/)) |
| **`@anthropic-ai/tokenizer`** (the standalone tokenizer package) | Confirmed inaccurate for Claude 3+ models — tokenizer drift means rough estimates only. ([2025 guide](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025)) | Use `client.messages.countTokens(...)` from `@anthropic-ai/sdk` for ground-truth counting. |
| **`tiktoken` (OpenAI tokenizer) for Claude estimates** | Wrong tokenizer family; produces consistently inaccurate counts for Claude. ([2025 guide](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025)) | Same — use SDK's `messages.countTokens`. |
| **NgRx / Akita / signals-store** | We do not have a state management problem. `StorageService.cachedData` is the single source of truth and `providedIn: 'root'` services already handle change broadcasting via Observables. Adding a store would duplicate the cache, fight the migration discipline, and increase bundle size. | Continue the existing `StorageService` + per-domain service pattern. |
| **A second LLM provider (OpenAI / Gemini / etc.)** | Multiplies abstraction without product benefit. Citations + web search + caching + search-result blocks form a coherent Anthropic-native feature set; an abstraction layer would force lowest-common-denominator semantics and lose citations as first-class objects. | Stay Anthropic-native. The `AISettingsService` already model-switches across Claude variants. |
| **Migrate to Jest or Vitest** | High cost, low value at our scale (12 specs). Karma still works; Angular CLI 18 still ships first-class Karma support. | Stay on Karma + Jasmine; add coverage thresholds and `axe-core` in-test. |
| **A blanket clinical-disclaimer wrapper on AI output** | Already explicitly out of scope per `PROJECT.md` Key Decisions: "no clinical guardrails; uses source attribution + confidence labels instead." | Implement structured confidence labelling (see Patterns by Variant below) — that's the chosen mechanism. |

---

## Stack Patterns by Variant

### Pattern: AI memory across sessions (LocalStorage-only)

- **Use** a new `chatMemoryService` reading from a new `AppData.chatMemory` slice (V5 migration). Shape suggestion:
  ```ts
  interface ChatMemory {
    facts: MemoryFact[];      // { id, text, source: 'user' | 'inferred', createdAt, lastReferencedAt }
    preferences: Record<string, string>;  // 'units.weight' = 'lbs', 'goals.primary' = 'fat loss', etc.
    pinnedGoals: string[];    // user-promoted facts
  }
  ```
- **Inject** the memory + the rolling-summary into the system prompt with `cache_control` so it's cheap to re-send every turn.
- **Update** memory by giving Claude an `upsert_memory_fact` tool (client-side); writes go through the memory service into `StorageService`. This is strictly better than auto-summarization — Claude only commits durable facts when it decides to.
- **Why not** a vector DB / embeddings? Single user, ~hundreds of facts max. Linear scan over an array is faster than any embedding round-trip and adds zero new infra.

### Pattern: AI access to "full data and history"

- **Don't** stuff `AppData` into the system prompt. Use **tool use** (`tools: [...]`) with narrowly scoped retrieval functions:
  - `get_cardio_sessions(from?, to?, type?)` → returns sessions, fed back as `search_result` blocks for citation
  - `get_weight_entries(from?, to?)` → same
  - `get_health_readings(type, from?, to?)` → same
  - `get_meals(from?, to?, search?)` → same
  - `get_chat_memory(query?)` → from `chatMemoryService`
- **Why** this beats stuffing: token cost grows with the *answer* not the *dataset*; citations are accurate; the Anthropic web search tool can run in the same turn for grounding.
- **Confidence labels:** Implement as a structured suffix on Claude responses by including in the system prompt: *"For each non-trivial claim, append a tag in the form `[evidence: high|moderate|low|animal-only|n=small]`. The tag MUST appear at the end of the sentence it qualifies."* Then post-process tags in the chat UI into pill badges. Don't try to make Claude do JSON-structured output for this — inline tags are robust and don't break streaming.

### Pattern: Web search grounding

- **Use** `tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }]`. Cap `max_uses` to keep cost predictable ($10/1k searches; 3 max means ≤ 3¢ per turn that searches).
- **Honor** the rendering rule from Anthropic's docs: when Claude returns `web_search_result_location` citations, **the chat UI MUST link them back to the original source URL.** This is both a citation-quality win and an Anthropic policy ask.
- **Don't** add `allowed_domains` whitelisting unless we discover specific source-quality issues. Premature filtering will make Claude refuse-to-cite or over-rely on pop-science blogs that happen to be whitelisted.

### Pattern: Token budgeting (replaces current naive heuristic)

- **Replace** `chat.service.ts`' `TOKEN_WINDOW_SIZE = 8000` + `MESSAGE_WINDOW_SIZE = 20` rolling window with a two-tier strategy:
  1. **System prompt (cached):** memory + preferences + summarized prior conversation. `cache_control` 5-min ephemeral. Recomputed only when memory mutates.
  2. **Per-turn ground truth:** tool-driven retrieval into `search_result` blocks (no caching — they change per query).
- **Use** `client.messages.countTokens()` to verify the cached system prompt stays under a configurable budget (e.g. 50k tokens) and trigger summarization-of-summaries when it exceeds.

### Pattern: Diet daily totals UX

- **Compute** totals reactively from `MealItem.snapshot` (already the immutable nutrition record at log time per `diet.model.ts`). Don't re-fetch saved-food fields — the snapshot pattern is already correct.
- **Display** as a sticky daily-totals card at the top of `/diet` with: kcal, protein/fat/carbs/net-carbs grams, % of macros if user has set targets in `chatMemory.preferences`. No new lib needed — pure Angular signals + existing Reactive Forms.
- **Unit conversion** via `convert` happens at *entry* time (form converts oz/cups/servings → grams, then stores grams in `MealItem.snapshot`). Storage stays canonical-grams. Display can re-convert for the user's preferred unit.

### Pattern: Accessibility audit (in-test)

- **Per route**, write one `*-page.component.a11y.spec.ts` that bootstraps the component (with stubbed services), renders it, and asserts `axe.run(fixture.nativeElement)` returns `{ violations: [] }`.
- **Configure** `axe.configure({ rules: [...] })` to disable any violation that's known-and-accepted (with comment justifying it). Don't disable categories — disable specific rule ids only.
- **Do not** try to also do contrast checking via axe — Electron's headless Chrome may not match production rendering. Use the Chrome devtools manual contrast check for visual review.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@anthropic-ai/sdk@^0.92.0` | TypeScript 5.5, Angular 18 | Pure ESM-friendly, runs in browser when `dangerouslyAllowBrowser: true`. Requires `lib: ["DOM", "ES2022"]` (already set in `tsconfig.json`). Verified via [npm](https://www.npmjs.com/package/@anthropic-ai/sdk). |
| `web_search_20250305` tool | Claude Sonnet 3.7+, Sonnet 4.x, Sonnet 4.5, Sonnet 4.6, Haiku 3.5+, Haiku 4.5, Opus 4.x | All currently selectable models in `CLAUDE_MODELS` (`claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`, `claude-opus-4-20250514`) support it. |
| `search_result` content blocks | Claude Sonnet 4.5, 4.6, Haiku 4.5, Opus 4.x (4.1, 4.5, 4.6, 4.7); **NOT** Haiku 3.x | Of our currently exposed models, all three support search_result blocks. Verified against [search-results docs](https://platform.claude.com/docs/en/build-with-claude/search-results). |
| Prompt caching `cache_control` | All currently active Claude models | Min cacheable size: 1,024 tokens for Sonnet 4.5 / Sonnet 4 / Sonnet 3.7 / Opus 4 / Opus 4.1; 2,048 for Sonnet 4.6 / Haiku 3.5; 4,096 for Opus 4.5/4.6/4.7 + Haiku 4.5. Plan our system-prompt size around the smallest target model we offer (Haiku 4.5 → 4,096). |
| `axe-core@^4.x` | jsdom-based test envs (we're using Karma+Chrome real browser, also fine) | No Angular-specific install. Just `import axe from 'axe-core'`. |
| `convert@^5.x` | TypeScript 5.x | Type-safe at the call site. Tree-shakable. |
| Electron 33 + `dangerouslyAllowBrowser` | Confirmed working today | The existing `anthropic-api.service.ts` already passes `anthropic-dangerous-direct-browser-access: true` to call from `file://` Electron renderer; SDK does this automatically. No CSP changes required. |

---

## Confidence Per Recommendation

| Recommendation | Confidence | Basis |
|----------------|------------|-------|
| Adopt `@anthropic-ai/sdk` | HIGH | Verified against official npm + repo + SDK docs; latest version 0.92.0 |
| Use Anthropic web search tool (`web_search_20250305`) | HIGH | Verified against official tool-use docs with full request/response schemas |
| Use prompt caching for system prompt | HIGH | Verified pricing tables, TTL options, and per-model min sizes from official docs |
| Use `search_result` content blocks for RAG over local data | HIGH | Verified feature list and supported models from official docs; designed for exactly this RAG-with-citations use case |
| Use tool use for Claude-driven retrieval over `AppData` | HIGH | Standard Anthropic pattern; client tools well-documented |
| Add `axe-core` for in-spec a11y assertions | HIGH | Industry-standard, mature, framework-agnostic |
| Add `convert` for unit conversion | MEDIUM | Multiple credible options exist; `convert` chosen on bundle-size + TS-types criteria but `convert-units` would also be defensible |
| Use SDK `messages.countTokens` over heuristic | HIGH | Documented free endpoint, ground-truth method |
| Defer barcode scanning | HIGH | CORS + `getUserMedia` under `file://` + no public food-DB CORS = strong "not now" signal |
| Defer Open Food Facts / USDA FoodData direct integration | HIGH | CORS lack confirmed via multiple open issues + official docs |
| Stay on Karma + Jasmine | HIGH | Migration cost not justified at codebase size; Angular CLI 18 first-class support |
| Stay on LocalStorage (no IndexedDB) | HIGH | Honors locked constraint; size budget verified sufficient |
| New `AppData.chatMemory` slice via V5 migration | MEDIUM | Architectural fit obvious; exact shape will be refined during phase planning |

---

## Sources

- [Anthropic web search tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool) — verified `web_search_20250305` schema, response shape with citations, pricing, dynamic-filtering variant `web_search_20260209`, error codes
- [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — verified `cache_control` syntax, per-model minimums, exact pricing tables, TTL options, breakpoint limits (max 4)
- [Anthropic search_result content blocks docs](https://platform.claude.com/docs/en/build-with-claude/search-results) — verified RAG-with-citations feature, supported models list
- [Anthropic tool use docs](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — verified client-tool flow with `stop_reason: "tool_use"` loop
- [Anthropic citations API announcement](https://www.anthropic.com/news/introducing-citations-api) — verified citations design (cited_text doesn't count toward output tokens)
- [Anthropic CORS / dangerouslyAllowBrowser](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/) — verified browser-direct calling pattern
- [`@anthropic-ai/sdk` on npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — verified latest version 0.92.0 (May 2026)
- [`@anthropic-ai/sdk` GitHub](https://github.com/anthropics/anthropic-sdk-typescript) — verified `dangerouslyAllowBrowser` support, browser usage
- [Token counting docs](https://platform.claude.com/docs/en/build-with-claude/token-counting) — verified `messages.countTokens` is free + rate-limited
- [Token counting 2025 guide](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025) — verified `@anthropic-ai/tokenizer` and `tiktoken` are inaccurate for Claude 3+
- [Open Food Facts CORS issue #2788](https://github.com/openfoodfacts/openfoodfacts-server/issues/2788) — verified CORS not configured on key endpoints
- [Open Food Facts CORS issue #1977](https://github.com/openfoodfacts/openfoodfacts-server/issues/1977) — additional confirmation, separate endpoint
- [Open Food Facts Dart CORS issue #1089](https://github.com/openfoodfacts/openfoodfacts-dart/issues/1089) — confirmation that web clients are blocked
- [USDA FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/) — verified API key requirement and rate limits
- [`@zxing/ngx-scanner` on npm](https://www.npmjs.com/package/@zxing/ngx-scanner) — Angular barcode scanner (deferred but documented)
- [`convert` on npm](https://www.npmjs.com/package/convert) — type-safe unit conversion library
- [`axe-core` GitHub](https://github.com/dequelabs/axe-core) — accessibility engine
- [Angular Karma testing guide](https://angular.dev/guide/testing/karma) — confirmed Karma still first-class in Angular 18
- [Angular testing 2025 best practices](https://medium.com/@roshannavale7/mastering-angular-testing-in-2025-best-practices-for-unit-and-e2e-testing-with-jest-cypress-and-8d9f461bc96f) — Vitest is the new-project default; existing Karma codebases need not migrate

---
*Stack research for: Personal Fitness Tracker — refinement milestone (additive scope only)*
*Researched: 2026-05-02*
