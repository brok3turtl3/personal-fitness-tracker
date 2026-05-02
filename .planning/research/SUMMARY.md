# Project Research Summary

**Project:** Personal Fitness Tracker — Refinement Milestone (v2)
**Domain:** Local-first single-user health/fitness tracker with embedded AI coach (Angular 18 SPA + Electron)
**Researched:** 2026-05-02
**Confidence:** HIGH

## Executive Summary

This is a brownfield refinement — not a greenfield build. The core stack (Angular 18 standalone, RxJS, chart.js, LocalStorage, Electron 33, TypeScript 5.5 strict) is locked and healthy. Three refinement targets drive this milestone: (1) a Diet UX overhaul to eliminate daily friction with food entry and unit handling, (2) an AI chat depth upgrade from "snapshot chatbot" to "coach that knows everything and grounds its advice," and (3) a quality pass to close the test-coverage gap, tighten types, and standardize UX patterns across all eight feature pages. The stack additions are minimal — three packages: `@anthropic-ai/sdk`, `convert`, and `axe-core` — and the architectural shape does not change; new pieces slot into the existing layered pattern.

The recommended approach for AI depth is Anthropic-native tool use: client-side `query_*` tools over the existing domain services (backed by `search_result` blocks for citation), the official `memory_20250818` tool backed by a new `AppData.memoryFiles` store, and the `web_search_20250305` server tool for research grounding — all behind a new `ToolRegistryService` driving an agentic `while(stop_reason === "tool_use")` loop inside `ChatService`. Confidence labelling uses an inline token contract (`[evidence: strong|moderate|weak|animal-only|anecdotal|speculative]`) parsed and rendered as UI badges; web-search citations come structured from the API and render as inline footnotes. For diet, the overhaul splits the 900-line `diet-page.component.ts` into a component hierarchy, adds a pure `units.ts` conversion module, and extends `SavedFood` with per-food density and preferred units.

The two highest-leverage pitfalls are **hallucinated citations** (fabrication rates measured at 14–95% across LLMs; mitigated by shipping confidence-label-only first and only surfacing citations grounded through the web_search API's structured response blocks) and **LocalStorage quota silent overflow** (chat history + AI memory will hit the 5 MB cap in months of daily use; mitigated by quota detection, visible banners, chat archival, and per-collection storage keys). Two schema migrations are needed and they must ship in order: V4→V5 for AI fields (`memoryFiles`, `userProfile`, `aiToolSettings`, `ChatMessage.blocks`) and V5→V6 for diet fields (`SavedFood.densityGramsPerMl`, `preferredUnits`).

---

## Key Findings

### Recommended Stack

The locked stack stays intact. Three additive packages cover the full milestone scope. `@anthropic-ai/sdk ^0.92.0` replaces the hand-rolled `fetch` wrapper in `anthropic-api.service.ts`, giving typed shapes for `web_search_20250305`, `search_result` blocks, `cache_control`, tool use, and `messages.countTokens`. `convert ^5.x` provides type-safe, tree-shakable unit conversion (g↔oz, ml↔cups) for the diet UX. `axe-core ^4.x` (dev-only) enables automated WCAG assertions in Karma component specs. Barcode scanning and external food databases are explicitly deferred: Open Food Facts and USDA FoodData Central both lack CORS support for browser-direct calls (confirmed via multiple open issues), and `getUserMedia` under Electron `file://` requires non-trivial permissions config. Karma+Jasmine migration to Vitest is also deferred — migration cost is not justified for 12 existing spec files.

**Core additions:**
- `@anthropic-ai/sdk ^0.92.0`: replaces hand-rolled fetch wrapper; typed tool-use, streaming, `messages.countTokens`, `dangerouslyAllowBrowser`
- `web_search_20250305` (server tool): live research grounding with first-class structured citations — no backend required
- Prompt caching (`cache_control: { type: "ephemeral" }`): system-prompt cache reads cost 10% of input tokens; critical once tool-use grows the effective context
- `search_result` content blocks: first-class RAG — user's logged data as typed documents Claude can cite back
- Tool use (client tools): `query_cardio`, `query_weight`, `query_readings`, `query_meals`, `query_daily_totals`, `update_profile`, `memory_20250818` — Claude pulls only what it needs
- `convert ^5.x`: type-safe unit conversion for diet UX
- `axe-core ^4.x` (devDependency): per-route WCAG violation assertions in Karma specs
- `messages.countTokens` (SDK method): replaces `text.length / 4` heuristic in `chat.service.ts`

**Key "do not use" decisions:**
- No backend/proxy — API key stays local; `dangerouslyAllowBrowser: true` is the supported BYO-key pattern
- No vector DB/embeddings for memory — tool calls over typed services beat RAG for single user with bounded structured data
- No NgRx/state-management — `StorageService.cachedData` + `providedIn: 'root'` services is sufficient
- No standalone `@anthropic-ai/tokenizer` or `tiktoken` — confirmed inaccurate for Claude 3+

### Expected Features

**Must have — Diet UX (v2.0):**
- Per-food native unit definition (`SavedFood.units: { name, gramsEquivalent }[]`) + meal logging in those units — the primary daily friction source
- Recent foods + auto-ranked favorites in the meal logging flow
- Search-as-you-type over saved foods library
- Quick-add new food from inside the meal logger (no context switch)
- Copy meal from a previous day
- Daily totals (kcal, P/F/C, net carbs, % of optional target) scannable while logging
- Diet integrated into the charts page
- Optional per-day macro/calorie targets with % display (diet-scoped only; no general goals surface)

**Must have — AI chat depth (v2.0):**
- Anthropic tool-use infrastructure: `query_cardio_sessions`, `query_weight_entries`, `query_readings`, `query_meals_in_range`, `query_daily_totals`
- Persistent user memory via `memory_20250818` tool backed by `AppData.memoryFiles`
- `update_profile` tool for structured user goals/preferences with confirm-before-write UI
- Source attribution rendered as inline footnotes — "from your data" vs. "from research (web search)"
- Per-claim confidence labels as inline badges (`[evidence: strong|moderate|weak|animal-only|anecdotal|speculative]`)
- Reasoning transparency: collapsed tool-call blocks in the message stream

**Must have — Quality pass (v2.0):**
- Coverage measured + thresholds set in `karma.conf.js`
- Shared `id.ts` helper replacing 5x duplicated `generateUUID`
- Empty-state + error-state pattern applied consistently across all eight feature pages
- axe-core automated a11y assertions per route
- Type tightening pass
- `takeUntilDestroyed` subscription hygiene propagated to all components

**Should have — after v2.0 validation:**
- AI memory inspector UI (`/settings` or `/chat/memory`)
- Pre-computed correlation tools for AI (keeps token costs predictable on cross-domain queries)
- Per-meal time-of-day patterns in diet charts

**Defer to future milestones:** Sleep/mood/steps/hydration, standalone goals feature, data import/export, barcode scanning, external food databases, multi-device sync

**Anti-features (explicitly not built):**
- Clinical disclaimers — replaced by confidence labels + source attribution per PROJECT.md Key Decision
- AI-generated meal or workout plans auto-saved as future log entries — corrupts the data record
- Continuous background AI calls — conflicts with "only outbound traffic is the user-initiated chat request"
- RAG over a vector DB — overkill for single user with bounded structured data

### Architecture Approach

All new pieces slot into the locked layered shape: `UI (standalone components) → Domain services → StorageService → LocalStorage` with `AnthropicApiService → api.anthropic.com` as the only external path. The critical structural changes are: (1) `ChatService` refactored to drive an agentic `while(stop_reason === "tool_use")` loop, dispatching to a new `ToolRegistryService`; (2) `FitnessContextService` slimmed from full-data snapshot to a thin ~500-token "key facts" header; (3) `diet-page.component.ts` split from 900 lines into a container + `food-library/`, `meal-log/`, and `shared/` sub-components; (4) two independent schema migrations (V4→V5 for AI, V5→V6 for diet).

`ChatMessage.content: string` becomes `ChatMessage.blocks: ChatBlock[]` (text | tool_use | tool_result | server_tool_use | web_search_tool_result) to enable multi-turn tool history and citation replay. Existing V4 messages are lifted to `blocks: [{ type: 'text', text: content }]` during the V4→V5 migration. The `memory_20250818` tool is client-executed (Anthropic docs are explicit on this) backed by `AppData.memoryFiles: Record<string, string>`. `UserProfile` is separate from memory: profile is structured, user-edited, shown in `/settings`; memory is the AI's free-form notebook.

**Major new components:**
1. `ToolRegistryService` — single dispatch point; map of tool name → executor; routes server vs. client tools
2. `MemoryToolExecutor` + `MemoryStoreService` — implements 6 memory tool commands per Anthropic spec; path validation (`/memories` prefix required, `..` rejected)
3. `DataQueryToolExecutor` — implements `query_*` tools by delegating to existing `CardioService`, `WeightService`, `ReadingsService`, `DietService`
4. `UserProfileService` — manages `AppData.userProfile`; used by system prompt and `update_profile` tool
5. `units.ts` (pure module) — stateless conversion alongside `validators.ts`: `FoodUnit`, `convertSameKind`, `convertWithDensity`, `toBaseUnits`
6. Diet component hierarchy — `food-library/`, `meal-log/`, `shared/unit-picker.component.ts`, `nutrition-display.component.ts`

**Consolidated schema migration plan:**

V4→V5 (AI fields — ships in Phase 2B):
- `AppData.memoryFiles: Record<string, string>` — default `{}`
- `AppData.userProfile: UserProfile` — default `{}`
- `AppData.aiToolSettings: AIToolSettings` — default `{ enableDataQueryTools: true, enableMemoryTool: true, enableWebSearch: false, webSearchMaxUses: 3, maxAgentTurns: 10 }`
- `ChatMessage.blocks: ChatBlock[]` — lift existing `content: string` to `blocks: [{ type: 'text', text: content }]`; keep `content?: string` transitionally

V5→V6 (diet fields — ships in Phase 2A, after V5 is the baseline):
- `SavedFood.densityGramsPerMl?: number` — migration: `gramsPerTbsp / 14.787` for foods with `gramsPerTbsp`
- `SavedFood.preferredUnits?: FoodUnit[]` — migration: `[baseUnit]`
- `SavedFood.baseUnit: FoodUnit` — widened from `'g' | 'tbsp'` to full `FoodUnit` union

Both migrations require: typed `LegacyAppDataVN` interfaces (no `as any` reads), backup pre-migration JSON to a recovery key, `vN-fixture.json → vN+1-expected.json` characterization tests, malformed-input coverage (`null`, `{}`, wrong types).

### Critical Pitfalls

1. **Hallucinated citations** — LLM citation fabrication rates 14–95% across LLMs (GhostCite arXiv, Nature). The user's "no clinical guardrails, source transparency instead" stance makes this the highest-stakes pitfall: polished citation UI with fabricated sources damages trust that is hard to rebuild. **Prevention:** ship confidence labels without free-generated citations in Phase 3; only surface citations from `web_search_result_location` API blocks (Phase 4). Never render author-year strings or DOIs the model generated freely.

2. **LocalStorage quota silently exceeded** — Chat history (1–4 KB/message) + AI memory will hit the 5–10 MB cap in months of daily use. Today `QuotaExceededError` is swallowed to `console.error` (CONCERNS.md). **Prevention:** detect quota errors by name (including Firefox `NS_ERROR_DOM_QUOTA_REACHED`), surface visible UI banners, implement chat archival in Phase 4, use `navigator.storage.estimate()` instead of hardcoded 5 MB, warn at 70% / block at 95%.

3. **Schema migration data corruption** — V2→V3 already used `as any` casts for legacy field reads (CONCERNS.md). **Prevention:** typed `LegacyAppDataV4` interfaces before V5 migration; backup-before-migrate recovery key; characterization tests with malformed inputs.

4. **Edit-saved-food retroactively rewrites historical meals** — Diet UX overhaul adds per-food unit changes; without snapshot enforcement, a saved-food edit silently rewrites every historical meal. CONCERNS.md already flags the partial bug in `updateMeal`. **Prevention:** snapshot `savedFoodName`, `servingLabel`, `nutritionSnapshot`, `gramsPerServing` at log time; display snapshots not live lookups; explicit warning in the food-edit UI.

5. **Refactoring without behavior tests first** — Zero feature components have specs (CONCERNS.md). Diet component split + chat service refactor will produce silent regressions without characterization tests in place first. **Prevention:** Phase 1 writes characterization tests for every component before it is touched; Puppeteer e2e wiring before Phase 2A/2B touches any component.

---

## Implications for Roadmap

Research across all four files converges on the same build order. After foundations are established, two chains run in parallel: **Chain A (diet)** and **Chain B (AI plumbing)** touch disjoint files. The quality pass then applies to both chains' output.

### Phase 1: Quality Pass Foundations

**Rationale:** Quality scaffolding is cheapest first. Subscription hygiene, shared utilities, and characterization tests are reused by every later phase. No schema changes — safe and fast.

**Delivers:**
- Coverage baseline measured; thresholds set in `karma.conf.js`
- Shared `id.ts` replacing 5x duplicated `generateUUID`
- `groupByDay` / `toDateKey` extracted to `shared/` (fixes existing same-day-averaging drift between charts and report)
- `takeUntilDestroyed(this.destroyRef)` propagated to all components that subscribe
- Characterization tests (DOM snapshots, key user flows) for `diet-page`, `chat-page`, `charts-page`, `reports-page`
- Puppeteer e2e wiring; navigation smoke test
- `axe-core` per-route a11y spec files
- Empty-state + error-state shared pattern across all eight feature pages
- `ng build --configuration=production` added to pre-commit / CI loop

**Avoids:** Pitfall 13 (refactoring without behavior tests), Pitfall 14 (strict-template regressions)
**Research flags:** Standard patterns — skip research-phase.

---

### Phase 2A: Diet Multi-Unit + UX Split (parallel with 2B)

**Rationale:** Zero file overlap with AI work. Delivers visible daily-friction reduction immediately. Cleaner diet data means AI query tools in Phase 3 get nicer data.

**Delivers:**
- `units.ts` pure module + spec
- Schema V5→V6: `SavedFood.densityGramsPerMl`, `preferredUnits`, widened `baseUnit`; `migrateV5ToV6` with fixture characterization test
- `DietService` updated to call `toBaseUnits` for meal-item snapshots
- `diet-page.component.ts` split into `food-library/`, `meal-log/`, `shared/` sub-components with specs
- Recent + auto-ranked favorite foods; search-as-you-type; quick-add modal; copy-meal-from-prior-day
- Daily totals card scannable while logging; optional diet targets with % display
- Diet charts integration
- Day-boundary / timezone fix in `date-range.ts`; DST fixture tests
- E2E: add-food → log-meal → see-totals

**Avoids:** Pitfall 5 (snapshot contract), Pitfall 6 (unit conversion precision), Pitfall 7 (timezone bugs)
**Research flags:** Standard patterns — skip research-phase.

---

### Phase 2B: AI Memory Layer + Tool Use Plumbing (parallel with 2A)

**Rationale:** Establishes all foundations that Phase 3's agentic loop requires. At phase end, `tools[]` is wired but `ChatService` still sends single-shot requests — no behavior change for the user yet.

**Delivers:**
- Schema V4→V5: `memoryFiles`, `userProfile`, `aiToolSettings`, `ChatMessage.blocks` lift; fixture characterization test
- `MemoryStoreService` + spec; `MemoryToolExecutor` + spec (all 6 commands, path validation)
- `ToolRegistryService` + spec
- `UserProfileService` + spec
- `AnthropicApiService` extended: `tools[]`, `ToolUseBlock`, `ToolResultBlock`, `pause_turn`
- `/settings`: AI tool toggles, profile editor, memory file viewer
- Prompt injection delimiter pattern in `FitnessContextService.buildSystemPrompt()`
- `QuotaExceededError` detection + UI banner in `StorageService` (prerequisite before AI memory writes grow storage)

**Avoids:** Pitfall 3 (quota detection), Pitfall 4 (typed legacy migration interfaces), Pitfall 8 (prompt injection), Pitfall 9 (two-tier memory schema)
**Research flags:** Confirm `memory_20250818` canonical return strings against current docs at implementation time.

---

### Phase 3: Agentic Loop + Citation UI

**Rationale:** Requires Phase 2B's registry, memory executor, and extended API types. Splits plumbing (2B) from activation (3) so the loop can be tested against stubbed API responses.

**Delivers:**
- `ChatService` refactored: `while(stop_reason === "tool_use")` loop with `maxAgentTurns` guard; multi-emit `Observable<ChatTurn>` for streaming UI
- `DataQueryToolExecutor` + spec: `query_cardio`, `query_weight`, `query_readings`, `query_meals`, `query_daily_totals`, `query_saved_foods`
- `FitnessContextService` slimmed: ~500-token thin snapshot + `cache_control` on system prompt
- `ChatMessage.blocks` rendering: text, collapsed tool_use, collapsed tool_result, confidence badge parsing
- Inline footnote rendering for `web_search_result_location` citations (placeholder; server tool added in Phase 4)
- Cross-domain AI insights emerges from tool access + system-prompt instructions
- Integration test: full tool-use round trip with spied `AnthropicApiService`
- `messages.countTokens` replaces `text.length / 4` heuristic

**Addresses:** All P1 AI chat features from FEATURES.md
**Avoids:** Pitfall 1 (confidence labels ship; no free-generated citations), Pitfall 2 (evidence grading rubric + adversarial regression tests), Pitfall 9 (confirm-before-write for memory updates), Pitfall 10 (low-confidence badges visually distinct — amber/red)
**Research flags:** Token-budget two-tier strategy and `pause_turn` handling warrant a focused research-phase during planning.

---

### Phase 4: Web Search Grounding + Full Quality Sweep

**Rationale:** Web search is one more tool type once the agentic loop is solid. The quality sweep applies Phase 1 instrumentation to all new Phase 2A/2B/3 code.

**Delivers:**
- `web_search_20250305` in `tools[]` when `aiToolSettings.enableWebSearch === true` (default off)
- `web_search_tool_result` + `citations[]` rendering as inline footnotes; citation links only for `https:` scheme
- Settings: enable toggle + `webSearchMaxUses` cap (cost-aware)
- Final type tightening sweep
- CRUD parity: `update*` on cardio/weight/readings (CONCERNS.md gap)
- `storage` event listener + "data changed elsewhere" banner
- Chat archival: pre-summary messages to lazy-loaded key; `getStorageBreakdown()` per collection
- CSP header: `default-src 'self'; connect-src 'self' https://api.anthropic.com; script-src 'self'; object-src 'none'`
- API key 401 → prompt-to-rotate flow
- Tool-call argument re-validation through domain validators
- Final axe + Lighthouse a11y pass; manual keyboard/contrast review
- Mutation test on at least one critical service

**Avoids:** Pitfall 1 (only API-structured citations as links), Pitfall 3 (chat archival closes quota growth vector), Pitfall 11 (CSP + 401 rotation), Pitfall 12 (multi-tab `storage` event listener)
**Research flags:** Verify `pause_turn` handling and `web_search_20250305` response shape against current Anthropic docs at implementation time. Decide `web_search_20250305` vs. `web_search_20260209` based on which model the user is running.

---

### Phase Ordering Rationale

- **Phase 1 before everything:** test scaffolding, subscription hygiene, and characterization tests are reused by every later phase; doing them first is cheaper than retrofitting
- **2A and 2B are genuinely parallel:** they touch disjoint files (diet components vs. AI services); if working serially, do diet (2A) first for earlier visible friction reduction
- **V4→V5 before V5→V6:** the AI migration includes `ChatMessage.blocks` — the most invasive data change; it must be stable before diet migration extends the same schema version chain
- **2B before 3:** the agentic loop requires the registry, memory executor, extended API types, and profile service; splitting plumbing from activation enables isolated review
- **3 before 4:** the loop must handle `end_turn`, `max_tokens`, and refusal correctly before adding server tools that emit `pause_turn`

### Research Flags

**Needs research-phase during planning:**
- **Phase 3:** token-budget two-tier strategy; `pause_turn` handling; prompt-caching min-size floor (Haiku 4.5 requires 4,096 tokens — tightest constraint across exposed models)
- **Phase 4:** `web_search_20250305` vs. `web_search_20260209` decision; `encrypted_index` replay requirement for multi-turn citation continuity

**Standard patterns — skip research-phase:**
- Phase 1: well-documented Angular 18 testing and subscription cleanup patterns
- Phase 2A: unit conversion is standard arithmetic; component split follows existing chat precedent
- Phase 2B: `memory_20250818` spec is prescriptive; confirm canonical return strings at implementation time

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All three additions verified against official npm and Anthropic docs. CORS blockers for food DBs confirmed via open issues. |
| Features | HIGH | Diet table-stakes verified against Cronometer/MyFitnessPal references and PMC peer-reviewed survey. AI features verified against Anthropic API docs and arXiv memory architecture research. |
| Architecture | HIGH | Verified against official Anthropic tool-use, memory-tool, and search-result docs. Internal sources read directly from codebase. `ChatMessage.blocks` shape derived from Anthropic multi-turn tool-use requirements. |
| Pitfalls | HIGH | Most pitfalls verified against external sources (OWASP, Nature, PMC, Lakera, arXiv) and internal CONCERNS.md. |

**Overall confidence:** HIGH

### Gaps to Address

- **`memory_20250818` canonical return strings:** Confirm exact expected return strings for all 6 memory commands against current Anthropic memory tool docs before writing `MemoryToolExecutor`. Quick check, not a full research phase.
- **Prompt caching min-size at runtime:** Haiku 4.5 requires 4,096 tokens minimum. System prompt design for Phase 3 must target this floor; validate the slim `FitnessContextService` output reaches it under typical conditions.
- **`web_search_20260209` vs. `web_search_20250305` decision:** Defer to Phase 4 planning — depends on which model the user is running and whether dynamic filtering is needed.
- **Chat archival implementation detail:** General strategy is clear (per-conversation keys or lazy-loaded archive); concrete UX for "archive old chats" prompt needs a design decision in Phase 4 planning.
- **Confirm-before-write UX for memory writes:** Architecture is clear (surface every memory write before persisting); UX design — inline banner vs. toast vs. pending indicator — needs resolution in Phase 2B/3 planning.

---

## Sources

### Primary (HIGH confidence)

- [Anthropic web search tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool) — `web_search_20250305` schema, response shape, pricing, error codes
- [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — `cache_control` syntax, per-model minimums (Haiku 4.5: 4,096 tokens), pricing
- [Anthropic search_result content blocks docs](https://platform.claude.com/docs/en/build-with-claude/search-results) — RAG-with-citations, supported models
- [Anthropic tool use docs](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — client-tool `stop_reason: "tool_use"` loop
- [Anthropic memory tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) — 6 commands, canonical return strings, client-execution confirmation
- [Anthropic token counting docs](https://platform.claude.com/docs/en/build-with-claude/token-counting) — `messages.countTokens` free + rate-limited
- [`@anthropic-ai/sdk` npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — verified v0.92.0, `dangerouslyAllowBrowser`
- Internal: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/CONVENTIONS.md`, `CLAUDE.md`
- [Open Food Facts CORS issues #2788, #1977](https://github.com/openfoodfacts/openfoodfacts-server/issues/2788) — browser-direct calls blocked
- [USDA FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/) — API key required + no CORS

### Secondary (MEDIUM confidence)

- [GhostCite: LLM citation validity — arXiv 2602.06718](https://arxiv.org/html/2602.06718) — citation fabrication rates 14–95%
- [Hallucinated citations in scientific literature — Nature](https://www.nature.com/articles/d41586-026-00969-z)
- [LLM Prompt Injection Prevention — OWASP LLM01:2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Focused Review of Smartphone Diet-Tracking Apps — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6543803/)
- [Personalized Long-term Interactions in LLM Agents — arXiv 2510.07925](https://arxiv.org/html/2510.07925) — goals/preferences/profile memory split
- [Handling localStorage quota errors — Matteo Mazzarolo](https://mmazzarolo.com/blog/2022-06-25-local-storage-status/) — `QuotaExceededError` + Firefox error handling
- [LLM Chat History Summarization — mem0.ai](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) — summarization loss and memory drift
- [`convert` npm](https://www.npmjs.com/package/convert) — type-safe unit conversion, zero deps
- [`axe-core` GitHub](https://github.com/dequelabs/axe-core) — ~57% automatic WCAG issue detection

### Tertiary (context and validation)

- [Cronometer vs MyFitnessPal — VegFAQs](https://vegfaqs.com/cronometer-vs-myfitnesspal/) — copy-meal-from-prior-day as expected behavior
- [Token counting accuracy 2025 — PropelCode](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025) — `@anthropic-ai/tokenizer` and `tiktoken` inaccurate for Claude 3+
- [Angular takeUntilDestroyed docs](https://angular.dev/ecosystem/rxjs-interop/take-until-destroyed) — injection context requirements

---
*Research completed: 2026-05-02*
*Ready for roadmap: yes*
