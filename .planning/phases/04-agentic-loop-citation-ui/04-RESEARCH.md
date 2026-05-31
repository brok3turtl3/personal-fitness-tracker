# Phase 4: Agentic Loop + Citation UI - Research

**Researched:** 2026-05-31
**Domain:** Bounded multi-turn agentic tool loop over `@anthropic-ai/sdk` (browser/Electron, Angular 18), with epistemic-honesty rendering (per-claim confidence + source badges, citation-link guard) and real token accounting + prompt caching
**Confidence:** HIGH

## Summary

Phase 4 is an *activation* phase, not a greenfield one. Every dependency it needs already shipped dormant in Phase 3: the `@anthropic-ai/sdk@0.92.0` transport (`anthropic-api.service.ts`), the `ToolRegistryService` dispatcher, the `chat-block-serializer.ts` pure bridge (which already moves `tool_result` into user turns, plain-texts `pending` proposals, and drops `discarded` blocks), the `ChatBlock` persistence union, the pending-pill UI, and the V5 schema with `AIToolSettings.maxAgentTurns` (default 10). I verified all of this directly in the codebase, and I verified the AI-SPEC's SDK claims against the *installed* 0.92.0 type definitions on disk — `StopReason` is exactly the 6-value union, `cache_control?: CacheControlEphemeral` exists on the param block types, `TextCitation` carries both `search_result_location` and `web_search_result_location` with the documented field shapes, and `messages.countTokens` accepts `system` (as `TextBlockParam[]`) and `tools`. The AI-SPEC, UI-SPEC, and CONTEXT for this phase are unusually complete and prescriptive; this research confirms them against reality and fills in the executor/parser/window mechanics the specs explicitly delegated to the researcher.

The work splits into five buildable units: (1) the agentic loop in `chat.service.ts` — a `for (turn < maxAgentTurns)` wrapping a `stop_reason` switch, returning a multi-emit `Observable<ChatTurnEvent>` so the UI can render live per-tool-call progress; (2) a new `data-query-tool-executor.ts` exposing six read-only `query_*` tools that wrap the existing domain services and return *bounded, summarized strings*; (3) a new pure `confidence-attribution-parser.ts` (mirrors `validators.ts` / `chat-block-serializer.ts`) that narrows assistant text into typed `ClaimSpan[]` and degrades safely on malformed tokens; (4) extending the `chat-message-list` `@switch` render with tool-call `<details>` disclosures, inline confidence/source badges, and the citation-link guard; (5) slimming `FitnessContextService` to a ~500-token cacheable prefix with `cache_control: ephemeral`, and switching the window decision from `text.length/4` to real `messages.countTokens`.

The three highest-stakes correctness surfaces — all unit-testable against pure modules under the existing Karma+Jasmine harness with zero new dependencies — are: the **citation-link guard** (E1, the headline adversarial test: a "cite a study" prompt must produce *zero* `<a href>`), the **loop terminal-stop-reason robustness** (E2, the loop must never wedge — every `stop_reason` branch handled, the cap degrades gracefully, write proposals never block, `tool_result` always serializes to a `user` turn), and the **confidence parser's safe degradation** (E3, malformed token → unbadged claim, never a crash, never a fabricated grade).

**Primary recommendation:** Build non-streaming (await the full `Message` per turn; deliver the live-progress feel via `ChatTurnEvent` emissions between turns) — this keeps the confidence parser and citation guard operating on complete text, and it is exactly the shape the UI-SPEC was written against. Reuse the Phase 3 `buildApiMessages`/serializer machinery verbatim for the wire-shape rules; do not re-solve the `tool_result`-in-user-turn problem (commit `49e275b` already did).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Agentic loop orchestration (`while stop_reason === 'tool_use'`) | `ChatService` (domain/orchestration service) | `AnthropicApiService` (transport) | Loop is business logic over the conversation; SDK calls stay behind the transport chokepoint (D-17) |
| SDK calls + `tools[]`/`cache_control`/`countTokens` | `AnthropicApiService` (sole SDK consumer) | — | D-17 chokepoint; lint forbids the SDK import elsewhere except the serializer |
| `query_*` data reads | `DataQueryToolExecutor` → existing domain services (`Weight/Cardio/Readings/Diet`) → `StorageService` | — | CLAUDE.md: all data access goes through domain services → StorageService, never `localStorage.*` |
| Tool dispatch | `ToolRegistryService` | — | Single dispatch point already wired (Phase 3) |
| Confidence/source token parsing | `confidence-attribution-parser.ts` (pure module) | — | Stateless, DI-free, fully unit-tested (mirrors `validators.ts`) |
| Slim system prompt + cache prefix + token counts | `FitnessContextService` (prefix) + `ChatService` (window decision) | `AnthropicApiService.countTokens` | Context assembly is a service concern; the count drives the window decision in the loop |
| Tool-use disclosures + confidence/source badges + citation guard | `chat-message-list.component.ts` (UI only) | — | CLAUDE.md component pattern: UI renders, services compute |
| Pending write-proposal surfacing | `pending-pill.component.ts` + `chat-page.component.ts` | `ChatService` (defer-persist) | Phase 3 scaffold, now fed real proposals; loop never blocks on it (D-03) |

## User Constraints (from CONTEXT.md)

### Locked Decisions

These are LOCKED for downstream agents (Claude's decisions made against the user's north star "maximize user experience — quality of advice AND transparency"). Verbatim from 04-CONTEXT.md `<decisions>`:

- **D-01:** Real-time, per-tool-call progress — never silent-until-done. Each `tool_use` renders live (in-flight "Reading your weight entries…") then resolves in place to a completed summary row. Reuses the block-stream `@switch`.
- **D-02:** `query_*` tools auto-execute — no confirm. Read-only reads of the user's own data. Confirm-before-write applies ONLY to mutations.
- **D-03:** The loop NEVER blocks synchronously on a write approval. A proposed memory/profile write surfaces as a pending pill; the loop is fed a synthetic `tool_result` ("surfaced for approval, NOT yet persisted") so the model finishes. Nothing is written until the user approves the pill.
- **D-04:** Hitting `maxAgentTurns` degrades gracefully and visibly. Loop stops, asks for a best-effort answer, shows an honest notice ("Reached the tool-use limit ({n} turns)…"). Never silent, never raw error.
- **D-05:** Humanized summary as the collapsed label; raw structured detail on expand (tool name, params, result).
- **D-06:** One collapsible per tool call, inline in execution order.
- **D-07:** Inline confidence chip immediately after the claim. Model emits inline token contract (`[evidence: strong]`); a pure parser extracts and renders a badge. NOT superscript-only, NOT color-only.
- **D-08:** Triple-encoded badges — color + icon + text label, always. Low-confidence (`weak`/`animal-only`/`anecdotal`/`speculative`) use warm/alert colors + caution icon; high-confidence (`strong`/`moderate`) stay calm/neutral.
- **D-09:** The confidence parser is a pure module (mirrors `chat-block-serializer.ts`/`validators.ts`). Stateless, DI-free, unit-tested incl. adversarial test that a malformed/absent token degrades safely (unbadged, never crash, never fabricate a grade).
- **D-10:** Source is a second axis paired with confidence — "from your data" (📈) vs "from research" (📚). Two-axis (source × confidence) IS the epistemic-honesty mechanism.
- **D-11:** "From your data" claims are traceable to the tool call that fetched them (link/anchor back to the collapsed disclosure where feasible).
- **D-12:** "From research" in Phase 4 means the model's own training knowledge — labeled as such, NEVER as a cited source. Carries confidence badge + "general knowledge — not a live source" framing + zero hyperlinks. Must leave room for the Phase 5 grounded-citation upgrade without rework.
- **D-13:** Citation-link guard ships and is adversarially tested now. Only `web_search_result_location`/`search_result` structured blocks become `<a href>`; any author-year/DOI/URL string the model wrote freely renders as plain text. Regression test proves "cite a study about X" cannot produce a clickable link in Phase 4.
- **D-14:** `query_*` tools are thin read-only wrappers over existing domain services, with bounded/summarized output. Accept date-range/filter params; cap/summarize large ranges to protect the token budget. Read-only ⇒ no write-validation; but any tool accepting model-proposed values (memory write) re-validates through `validators.ts` (CHAT-11). Exact output shape/caps/summarization are the researcher's call.
- **D-15:** Slim `FitnessContextService` header (~500-token "key facts") + `cache_control: ephemeral` on the system-prompt prefix + real `messages.countTokens` replacing `text.length/4`. Keep the prefix stable. Per-model cache minimums + exact header are the researcher's call.
- **D-16:** The loop must handle ALL terminal stop reasons before Phase 5: `end_turn`, `max_tokens` (note truncation), `refusal` (surface honestly), `pause_turn` (resume per Anthropic guidance), plus the `maxAgentTurns` guard.

### Claude's Discretion

- **System-prompt engineering** (WHEN to grade, WHEN to propose a write, exact inline confidence-token syntax, synthetic "pending approval" tool_result wording): deferred to AI-SPEC. *(AI-SPEC §4 has now specified the `[evidence: …][source: …]` contract and the synthetic-result wording — see Standard Stack below.)*
- **Visual specifics** (badge palette/iconography, collapsed-row styling, D-11 linkage affordance, loop progress animation): deferred to UI-SPEC. *(UI-SPEC has now locked these — calm/alert tiers, `✓`/`≈`/`⚠` icons, `📈`/`📚` source icons.)*
- **`query_*` output shape & caps (D-14)**, summarization strategy, and whether the six tools share one `DataQueryToolExecutor` or split: **researcher/planner's call.** → This research recommends one shared `DataQueryToolExecutor` with a tool-name switch (see Architecture Patterns).
- **Web-search version decision** (`web_search_20250305` vs `web_search_20260209`): NOT a Phase 4 decision — Phase 5.
- **Streaming vs non-streaming:** researcher's call provided D-01 per-tool-call visibility is achieved either way. → This research recommends **non-streaming** (see Summary + Architecture Patterns).

### Deferred Ideas (OUT OF SCOPE)

- Web-search server tool + grounded/linked citations (Phase 5, RESCH-01..03).
- `web_search_20250305` vs `web_search_20260209` + `encrypted_index` replay (Phase 5).
- Chat archival / LocalStorage quota hardening (Phase 5, QUAL-02/03).
- Multi-tab clobber of just-saved memory (Phase 5, QUAL-04).
- CRUD-edit tools for the AI (Phase 4 tools are strictly read-only).
- Multiple-pending-proposal queue/ordering semantics (render in stream order; richer queueing only if usage shows a need).
- Undo-after-approve window for memory writes.
- Streaming token-by-token rendering of the final answer (later polish).
- a11y `color-contrast` sweep, 401/CSP hardening (Phase 5).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-02 | AI fetches the user's actual logs on demand via `query_*` data tools | `DataQueryToolExecutor` (new) — six read-only wrappers over `Weight/Cardio/Readings/Diet` services; bounded output (Standard Stack + Don't Hand-Roll). Domain services already return `Observable<T[]>`; executor filters/caps in-memory. |
| CHAT-05 | `ChatService` runs the `while (stop_reason === 'tool_use')` agentic loop bounded by `maxAgentTurns` | Loop pattern verified against installed SDK `StopReason` union; reuses Phase 3 `buildApiMessages`/serializer for wire shape (Architecture Patterns, Code Examples). |
| CHAT-06 | User can expand any AI message to see `tool_use`/`tool_result` blocks (collapsed default) | Native `<details>`/`<summary>` disclosure in `chat-message-list` (UI-SPEC + Architecture Patterns). |
| CHAT-07 | Per-claim confidence badges (6-level taxonomy), low-confidence visually distinct | `confidence-attribution-parser.ts` pure module → `ClaimSpan[]` → triple-encoded badges (Standard Stack, Code Examples, Pitfall 3). |
| CHAT-08 | Source attribution: "from your data" vs "from research" | Second axis in the same parser/`ClaimSpan`; rendered as a paired source chip (D-10). |
| CHAT-09 | Only API-structured citations become links; free-text author-year renders plain | Citation-link guard verified against installed `TextCitation` shapes; `bypassSecurityTrust*` forbidden (Pitfall 1, Code Examples, Validation Architecture). |
| CHAT-10 | Real `messages.countTokens`, `cache_control: ephemeral`, ~500-token slim header | `FitnessContextService` slim + cacheable prefix; widen the `countTokens` wrapper to accept `system: TextBlockParam[]` + `tools` (Standard Stack, Pitfall 4, State of the Art). |
| CHAT-11 (carried gate) | Tool-arg re-validation through `validators.ts` for any model-proposed write | Memory write tool re-validates; query inputs bounds-checked; range failure → `is_error: true` tool_result, never a throw-through (Don't Hand-Roll, Validation Architecture E5). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `0.92.0` (pinned, installed) | Messages API transport: `messages.create` (with `tools[]` + `cache_control`), `messages.countTokens`, typed `Message`/`ContentBlock`/`StopReason`/`TextCitation`/`Usage` | Already adopted Phase 3; net-zero new deps for Phase 4 `[VERIFIED: npm ls @anthropic-ai/sdk → 0.92.0; node_modules/@anthropic-ai/sdk/package.json version 0.92.0]` |
| Angular | `18.2.x` | Standalone components, RxJS `Observable` surface, `takeUntilDestroyed` | Project framework `[VERIFIED: package.json]` |
| RxJS | `7.8.x` | Promise→Observable bridge (`from`), the multi-emit loop Observable | Project reactivity layer `[VERIFIED: package.json]` |
| Karma + Jasmine | (Angular defaults) | The deterministic eval gate (`ng test --no-watch`) for E1–E7 | Existing in-repo harness; no hosted eval platform `[VERIFIED: package.json devDeps; AI-SPEC §5]` |

**No new runtime dependency is required for Phase 4.** `[VERIFIED: AI-SPEC §3 "net-zero new dependencies"; package.json unchanged for Phase 4]`

### Supporting (new in-repo modules — not packages)
| Module | Location | Purpose | When to Use |
|--------|----------|---------|-------------|
| `DataQueryToolExecutor` | `src/app/services/data-query-tool-executor.ts` (new) | Six `query_*` read-only tools wrapping domain services; bounded/summarized string output (D-14) | Registered in `ToolRegistryService` alongside the memory executor |
| `confidence-attribution-parser.ts` | `src/app/services/` (new, PURE) | Parse inline `[evidence: …][source: …]` tokens → `ClaimSpan[]`; safe degradation (D-09) | Runs over `TextBlock.text` after each turn; output rendered by `chat-message-list` |
| `ChatTurnEvent` union + `ClaimSpan`/`Confidence`/`Attribution` types | `src/app/models/ai-chat.model.ts` (extend) | Multi-emit loop events; typed confidence/source spans | Loop emits events; parser/UI consume span types |

### SDK surfaces verified against installed 0.92.0

| Surface | Verified shape | Source |
|---------|----------------|--------|
| `StopReason` | `'end_turn' \| 'max_tokens' \| 'stop_sequence' \| 'tool_use' \| 'pause_turn' \| 'refusal'` | `[VERIFIED: messages.d.ts:874]` |
| `cache_control` | `cache_control?: CacheControlEphemeral \| null` present on `TextBlockParam`, `ToolResultBlockParam`, `Tool`, etc. | `[VERIFIED: messages.d.ts — 20+ occurrences incl. lines 139, 301, 1255]` |
| `TextCitation` (response) | union incl. `CitationsSearchResultLocation` (`{ type:'search_result_location', source, title, cited_text, search_result_index, start_block_index, end_block_index }`) and `CitationsWebSearchResultLocation` (`{ type:'web_search_result_location', url, title, cited_text, encrypted_index }`) | `[VERIFIED: messages.d.ts:251-269, :896]` |
| `messages.countTokens` params | `{ model, messages, system?: string \| TextBlockParam[], tools?: MessageCountTokensTool[], tool_choice?, thinking? }` → returns `MessageTokensCount` (`input_tokens`) | `[VERIFIED: messages.d.ts:2081 + field grep; messages.d.ts:93]` |

**Installation:** none. **Version verification (run at plan time):**
```bash
npm ls @anthropic-ai/sdk        # expect 0.92.0
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct SDK `while`-loop | Claude Agent SDK / LangGraph / LangChain | All ruled out in AI-SPEC §2: Node-runtime / server-checkpoint / abstraction-overhead anti-patterns in a browser, single-user, ~30-line loop. **Do not introduce.** `[CITED: 04-AI-SPEC §2]` |
| Inline `[evidence:…]` token contract | Forced JSON / `tool_choice` structured output | Forced-JSON couples grading to whole-message success and breaks per-claim granularity (D-07); inline tokens survive partial output. **Use inline tokens.** `[CITED: 04-AI-SPEC §4b(a)]` |
| One shared `DataQueryToolExecutor` (tool-name switch) | Six separate executor classes | One executor keeps the diff small and the `definitions()`/`dispatch()` wiring uniform; six classes add boilerplate for no behavioral gain. **Recommend one executor.** `[CITED: 04-AI-SPEC §4 Tool Use — "planner's call; one executor keeps the diff small"]` |

## Architecture Patterns

### System Architecture Diagram

```
 chat-page.component (subscribes once, takeUntilDestroyed)
        │  user message text
        ▼
 ChatService.runAgenticLoop(conversationId, apiKey) ──► Observable<ChatTurnEvent>  (multi-emit)
        │
        │  build once per loop:
        │   ├─ system  ← FitnessContextService.buildSystemPrompt()  [slim ~500-tok prefix + cache_control]  (D-15)
        │   ├─ tools[] ← ToolRegistryService.definitions()          [6 query_* + memory write]
        │   └─ messages ← buildApiMessages()  [Phase 3 serializer: tool_result→user turn, pending→plaintext]
        ▼
   ┌─────────────────────────  for (turn < maxAgentTurns)  ─────────────────────────┐
   │  AnthropicApiService.send(apiKey, {model, max_tokens, system, messages, tools}) │
   │        │  Message { content, stop_reason, usage }                              │
   │        ▼                                                                         │
   │  emit assistant_text  ──►  confidence-attribution-parser → ClaimSpan[]          │
   │        │                                                                         │
   │  switch (stop_reason):                                                          │
   │    end_turn|stop_sequence|max_tokens|refusal ──► emit done; complete()  (D-16)  │
   │    pause_turn ──► turn--; continue  (resend unmodified; defensive for Ph5)       │
   │    tool_use   ──► for each tool_use block:                                       │
   │         ├─ isWriteProposal? ─► surface pending pill + synthetic tool_result      │
   │         │                       ("not yet persisted") — NEVER block  (D-03)      │
   │         └─ query_* ─► ToolRegistryService.dispatch(name,input)                   │
   │                          │                                                       │
   │                          ▼  DataQueryToolExecutor                                │
   │                          ├─ WeightService / CardioService / ReadingsService /    │
   │                          │   DietService  (Observable<T[]> → firstValueFrom)     │
   │                          └─ StorageService → LocalStorage  [read-only]           │
   │                          ◄─ BOUNDED summarized string  (D-14)                    │
   │         emit tool_use_started / tool_result                                      │
   │         messages.push({ role:'user', content: toolResults })   ◄── user turn!    │
   └──────────────────────────────────────────────────────────────────────────────┘
        │  cap reached ─► emit turn_limit; one final create WITHOUT tools (best-effort)  (D-04)
        ▼
 chat-message-list.component  (UI only)
   ├─ tool_use/tool_result ─► <details> disclosure (collapsed default, exec order)  (D-05/D-06)
   ├─ text ─► ClaimSpan[] ─► inline confidence chip + source chip (+ view-source link)  (D-07/D-08/D-10/D-11)
   ├─ CITATION GUARD: only structured TextCitation → <a href>; prose stays plain text  (D-13)
   └─ turn_limit / max_tokens / refusal ─► honest in-stream notice  (D-04/D-16)
```

### Recommended Project Structure
```
src/app/
├── models/
│   └── ai-chat.model.ts                 # extend: ChatTurnEvent union, ClaimSpan/Confidence/Attribution;
│                                         #  fix CLAUDE_MODELS lineup (see State of the Art).
├── services/
│   ├── anthropic-api.service.ts          # remove the Phase-3 Omit<…,'tools'|'tool_choice'>; widen
│   │                                     #  countTokens params to {system?: TextBlockParam[], tools?}.
│   ├── chat.service.ts                   # add runAgenticLoop(); REUSE buildApiMessages verbatim.
│   ├── chat-block-serializer.ts          # NO CHANGE needed for the loop (already correct); add ONLY if
│   │                                     #  parsing TextBlock.citations into ChatBlock is in scope.
│   ├── tool-registry.service.ts          # register DataQueryToolExecutor; add isWriteProposal(name).
│   ├── data-query-tool-executor.ts       # NEW: 6 query_* tools, bounded output (D-14).
│   ├── fitness-context.service.ts        # slim to ~500-tok cacheable prefix + cache_control (D-15).
│   └── confidence-attribution-parser.ts  # NEW PURE module (mirrors validators.ts).
└── features/chat/
    ├── chat-message-list.component.ts    # extend @switch: disclosures + badges + citation guard.
    ├── chat-page.component.ts            # drive runAgenticLoop() events into the view; gate dev-seed.
    └── pending-pill.component.ts         # receives real proposals; no visual change.
```

### Pattern 1: The bounded agentic loop as a multi-emit Observable (recommend non-streaming)
**What:** Wrap the whole multi-turn sequence in a single `new Observable<ChatTurnEvent>(...)` running an `async` IIFE. Promises stay *inside*; the component subscribes once and pipes `takeUntilDestroyed`. The teardown sets a `cancelled` flag the loop checks each iteration (stops billing on navigate-away).
**When to use:** The Phase 4 send flow. This is the AI-SPEC §3 Entry Point pattern verbatim — adopt it.
**Why non-streaming:** await the full `Message` per turn so the confidence parser sees complete text and the citation guard inspects complete `citations` arrays; the live feel comes from emitting `tool_use_started`/`tool_result` events between turns. `[CITED: 04-AI-SPEC §4 stream, §4b Async-First]`

### Pattern 2: `query_*` executors wrap domain services, filter + bound in-memory (D-14)
**What:** The domain services expose only full-list getters (`WeightService.getEntries()`, `CardioService.getSessions()`, `ReadingsService.getReadings(type?)`, `DietService.getMealsForDay(dayLocal)` / `getSavedFoods()`) — **none take a date range** `[VERIFIED: grep of each *.service.ts]`. So each `query_*` executor: `firstValueFrom(...)` the relevant getter, filter by the model-supplied `from`/`to`/filter, then **cap and summarize** before returning a string. For wide ranges return aggregates + the most-recent-N rows, never the full set.
**When to use:** All six tools. `query_daily_totals` and `query_meals_in_range` aggregate `MealEntry.totals`; `query_readings` accepts an optional `type` filter passing through to `getReadings(type)`.
**Note:** No new data-access path — executors call the validated domain services, which call `StorageService` (CLAUDE.md chokepoint preserved).

### Pattern 3: Confidence/source parsing as a pure total function
**What:** `parseClaimSpans(assistantText: string): ClaimSpan[]` — stateless, DI-free, never throws. Split into claim chunks, scan trailing `[evidence:…]`/`[source:…]` tokens against `ReadonlySet` allow-lists, strip tokens from the rendered text, leave `confidence`/`source` `undefined` when absent/unknown. Mirrors `validators.ts` and `chat-block-serializer.ts`.
**When to use:** Over `TextBlock.text` after the loop returns the assistant turn. It takes a plain `string`, NOT SDK types — keeps the SDK boundary at the transport layer (D-17).

### Pattern 4: Slim, byte-stable cacheable system prefix (D-15)
**What:** `buildSystemPrompt()` returns the system as a structured `TextBlockParam[]` whose stable prefix block carries `cache_control: { type: 'ephemeral' }`. Fixed field order; volatile values ("today") in a deterministic slot; stable empty-profile omission. The cached prefix = slim ~500-tok key-facts header + the auto-generated tools system block (≈497 tok on Sonnet 4.6) + stable grading instructions/exemplars — the *combined* block must clear the per-model cache floor (Sonnet 4.6 = 1,024 tok).
**When to use:** Every send in the loop. Per-turn ground truth (`query_*` results) returns as `tool_result` blocks — never cached, they change per query.

### Anti-Patterns to Avoid
- **Posting `tool_result` in an assistant turn → API 400.** `tool_result` blocks go in the **next `user`** message. Already fixed in commit `49e275b`; the serializer/`buildApiMessages` already enforce this — do not re-introduce. `[VERIFIED: chat.service.ts:406-417 splits tool_result into user turns; CONTEXT canonical_refs cites 49e275b]`
- **Blocking the loop on a write approval.** Surface the pending pill, feed a synthetic "not yet persisted" `tool_result`, continue (D-03).
- **Counting `pause_turn` against the cap or mutating the paused turn.** `turn--; continue;` and resend the conversation unmodified.
- **`countTokens` in a getter/template/per-keystroke.** It is free but rate-limited — call once when building the request; cache the count on the message.
- **`bypassSecurityTrust*` or markdown autolinking of prose.** The citation guard forbids these — only structured `TextCitation` → `<a>`.
- **Re-implementing token estimation.** Replace `estimateTokens(text)=ceil(len/4)` in `chat.service.ts` with `messages.countTokens` for the window decision (D-15). `[VERIFIED: chat.service.ts:26-28]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| The agentic loop framework | A LangGraph/agent-framework wrapper | A ~30-line `for`+`switch` over the typed SDK | Browser/single-user/no-backend kills every framework (AI-SPEC §2) `[CITED: 04-AI-SPEC §2]` |
| Wire-shape rules (tool_result→user turn, pending→plaintext, drop discarded, coalesce roles) | A new serializer | The existing `chat-block-serializer.ts` + `buildApiMessages` | Fully built and tested in Phase 3; the loop runs through it `[VERIFIED: chat-block-serializer.ts; chat.service.ts:370-436]` |
| Token counting | `text.length / 4` | `messages.countTokens` (free, accurate, accepts system+tools) | The Phase 3 heuristic is the explicit CHAT-10 drift item to retire `[VERIFIED: messages.d.ts:93,2081]` |
| Direct LocalStorage reads in `query_*` | `localStorage.getItem(...)` in the executor | The existing domain services (which call `StorageService`) | CLAUDE.md chokepoint: StorageService is the sole LocalStorage path; tree-wide grep gate exists `[VERIFIED: CLAUDE.md "What NOT To Do"; ROADMAP Plan 01-10 grep gate]` |
| Tool-arg validation for the memory write | A new validator | `validators.ts` (CHAT-11 gate) | Same ranges that guard direct user input; range failure → `is_error: true` tool_result `[CITED: REQUIREMENTS CHAT-11; 04-AI-SPEC §4b(b)]` |
| Tool-result execution for *approved* proposals | New dispatch | `PendingApprovalService.executeApprovedToolUse` + `chat.service.approveToolUseBlock` | Built in Phase 3 gap-closure (03-07); the agentic loop reuses `ToolRegistryService.dispatch` directly `[VERIFIED: pending-approval.service.ts; chat.service.ts:265-325]` |
| Citation detection | A regex that "finds citations" to linkify | A type check on `TextBlock.citations[].type` (structured only) | Linkifying prose is exactly the fabrication failure mode (14–95%); guard at the type boundary `[CITED: 04-AI-SPEC §1b citation-link integrity]` |

**Key insight:** Phase 4's correctness comes from *not* re-solving Phase 3's wire mechanics and *not* adding an agent framework. The genuinely new code is small and pure (the loop switch, the query executor, the confidence parser, the badge/disclosure render, the slim prefix) — and each new pure module is independently unit-testable, which is exactly why the eval strategy can gate the critical dimensions deterministically.

## Runtime State Inventory

Phase 4 is an activation/feature phase, not a rename/refactor/migration. No string-rename or data-migration runtime state to inventory. Two adjacent state items to confirm at plan time:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `ChatBlock[]` in `AppData` (V5) — Phase 4 writes more blocks per turn (tool_use + tool_result) but introduces **no new schema version**. The `tool_use` blocks default `status:'pending'` from `fromAnthropicMessage`; for *auto-executed* `query_*` the loop persists them as resolved with a paired `tool_result`. | Decide persistence status for auto-executed query tool_use (NOT `pending` — they were auto-run, not awaiting approval). No migration. `[VERIFIED: chat-block-serializer.ts:113-137; ai-chat.model.ts ToolUseBlock.status]` |
| Live service config | None — single-user browser app, no external service registrations. | None — verified by codebase (only external path is `api.anthropic.com` via the SDK). |
| OS-registered state | None. | None. |
| Secrets/env vars | Anthropic API key stored in `AISettings.apiKey` (LocalStorage, user-supplied). Phase 4 changes nothing about key handling. | None — verified by `anthropic-api.service.ts` (key passed per-call). |
| Build artifacts | None new — net-zero new dependencies. | None. |

## Common Pitfalls

### Pitfall 1: A free-generated citation rendered as a clickable link (HIGHEST STAKES — E1)
**What goes wrong:** The model, asked about research, writes `Smith et al. 2019` / a bare DOI / a plausible PubMed URL in prose; the renderer (markdown autolinking, or `bypassSecurityTrust*`) turns it into an `<a href>`, implying a verifiable source that does not exist (documented 14–95% fabrication; JMIR 19.9%).
**Why it happens:** Phase 4 produces *no* real citations (no web tool yet), so anything citation-shaped in prose is fabricated by definition.
**How to avoid:** Render assistant prose as a strict text/markdown subset that NEVER autolinks; the ONLY path to an `<a href>` is a structured `TextBlock.citations[]` entry whose `type` is `search_result_location`/`web_search_result_location` — and none exist in Phase 4, so zero anchors render. `bypassSecurityTrust*` forbidden.
**Warning signs:** Any `querySelectorAll('a')` returning a non-zero length on an adversarial "cite a study about creatine/ketones" prompt. `[CITED: 04-AI-SPEC §1 FM1, §1b, §5 E1]`

### Pitfall 2: The loop wedges on an unfinished `tool_use` (E2)
**What goes wrong:** Loop freezes, spins past the cap, blocks synchronously on a write approval, drops a turn on `pause_turn`, or posts `tool_result` in an assistant turn (→ API 400).
**Why it happens:** A missing branch in the `stop_reason` switch, or treating a write proposal as a normal tool that must resolve before continuing.
**How to avoid:** Handle every `StopReason` value explicitly (verified union: `end_turn|max_tokens|stop_sequence|tool_use|pause_turn|refusal`); `tool_use` is the *only* continue branch; write proposals get a synthetic tool_result and never block (D-03); `pause_turn` does `turn--; continue`; the cap degrades to a best-effort answer (D-04); `tool_result` always serializes to a `user` turn (reuse `buildApiMessages`).
**Warning signs:** A `default:` branch ever hit; a test driving `refusal`/`max_tokens` that hangs; an assistant message carrying a `tool_result`. `[VERIFIED: messages.d.ts:874; chat.service.ts:406-417]`

### Pitfall 3: The confidence parser fabricates a grade or throws (E3)
**What goes wrong:** A garbled `[evidence: ???]` coerces to a real grade, or a missing token throws and drops the claim text.
**Why it happens:** Permissive parsing that maps unknown tokens to a default grade.
**How to avoid:** Allow-list the six confidence values + two source values in `ReadonlySet`s; unknown/malformed → leave `undefined` (unbadged); total function, never throws; no LLM retry (re-calling doubles cost and still guarantees nothing). Adversarial unit test: malformed token ⇒ unbadged span, no throw, no fabricated grade.
**Warning signs:** A parser spec without a "garbled token" and "missing token" case; any code path that defaults `confidence` to a real value. `[CITED: 04-AI-SPEC §4b(a), §5 E3, D-09]`

### Pitfall 4: The cache prefix churns → 1.25× write every turn instead of 0.1× read (E7)
**What goes wrong:** `buildSystemPrompt()` reorders the key-facts header, puts a volatile timestamp mid-prefix, or conditionally emits an empty-profile block in a shifting position — the cached prefix hash changes and you pay the write price every turn.
**Why it happens:** The current `FitnessContextService` embeds `new Date().toISOString()` mid-prompt and assembles a full volatile data snapshot `[VERIFIED: fitness-context.service.ts:43-44]` — both must change for a stable cacheable prefix.
**How to avoid:** Fixed header field order; volatile "today" in a deterministic slot; stable empty-profile omission; ONE `cache_control` breakpoint at the end of the stable prefix; move the full data snapshot out of the system prompt (it's now fetched via `query_*`).
**Warning signs:** Two consecutive `buildSystemPrompt()` builds producing a non-byte-identical cacheable prefix. `[VERIFIED: fitness-context.service.ts; CITED: 04-AI-SPEC §3 Context Window Strategy, §5 E7]`

### Pitfall 5: A persisted/in-flight pending write proposal round-trips to the API as a real `tool_use`
**What goes wrong:** The model waits forever for a `tool_result` that never comes.
**Why it happens:** Skipping either the D-03 synthetic tool_result (current turn) or the serializer's pending→plaintext rule (replay of persisted proposals).
**How to avoid:** Both paths exist — `chat-block-serializer.toAnthropicContent` already plain-texts persisted `pending` proposals `[VERIFIED: chat-block-serializer.ts:66-72]`; the loop adds the synthetic tool_result for the *current* turn's proposal. Both are unit-tested.

### Pitfall 6: Unbounded `query_*` output dumps the whole dataset (E6)
**What goes wrong:** A 5-year `query_weight_entries` returning every row blows the token budget and forces premature summarization.
**How to avoid:** Each executor caps/summarizes (aggregates + most-recent-N); the tool description tells the model the output is bounded. Validate with a "5-year range stays under X tokens via `countTokens`" test. `[CITED: 04-AI-SPEC §3 Pitfall 3, §5 E6, D-14]`

## Code Examples

### The agentic loop (canonical shape — verified against installed SDK types)
```typescript
// services/chat.service.ts — runAgenticLoop returns a multi-emit Observable<ChatTurnEvent>.
// Source: 04-AI-SPEC §3 Entry Point Pattern, validated against installed @anthropic-ai/sdk@0.92.0.
for (let turn = 0; turn < maxAgentTurns && !cancelled; turn++) {
  const response: Message = await this.anthropicApi.send(apiKey, {
    model, max_tokens, system, messages, tools,          // tools[] present in Phase 4
  });
  subscriber.next({ kind: 'assistant_text', blocks: fromAnthropicMessage(response) });
  messages.push({ role: 'assistant', content: response.content as ContentBlockParam[] });

  switch (response.stop_reason) {                         // StopReason union VERIFIED messages.d.ts:874
    case 'end_turn': case 'stop_sequence': case 'max_tokens': case 'refusal':
      subscriber.next({ kind: 'done', stopReason: response.stop_reason });
      subscriber.complete(); return;
    case 'pause_turn':                                    // resume unmodified; don't count the turn
      turn--; continue;
    case 'tool_use': break;
    default:
      subscriber.next({ kind: 'done', stopReason: response.stop_reason });
      subscriber.complete(); return;
  }

  const toolUseBlocks = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
  const toolResults: ToolResultBlockParam[] = [];
  for (const tu of toolUseBlocks) {
    subscriber.next({ kind: 'tool_use_started', block: tu });
    if (this.toolRegistry.isWriteProposal(tu.name)) {     // D-03: never block
      this.surfacePendingProposal(conversationId, tu);
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id,
        content: 'Proposal surfaced for approval, NOT yet persisted. Continue using only confirmed data.' });
      continue;
    }
    try {                                                 // D-02/D-14: query_* auto-execute, bounded
      const result = await this.toolRegistry.dispatch(tu.name, tu.input);
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
      subscriber.next({ kind: 'tool_result', toolUseId: tu.id, summary: result });
    } catch (e) {                                         // CHAT-11: recoverable error, not a throw-through
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id,
        content: `Error: ${(e as Error).message}`, is_error: true });
    }
  }
  messages.push({ role: 'user', content: toolResults });  // tool_result ALWAYS in a user turn
}
// cap reached: emit turn_limit; one final create WITHOUT tools for a best-effort summary (D-04).
```

### The citation-link guard (the headline test)
```typescript
// Render rule: prose is NEVER autolinked. Only a structured TextCitation becomes <a>.
// TextCitation shapes VERIFIED messages.d.ts:251-269 (search_result_location / web_search_result_location).
function isLinkableCitation(c: TextCitation): boolean {
  return c.type === 'search_result_location' || c.type === 'web_search_result_location';
}
// In Phase 4 no tool produces citations → TextBlock.citations is always absent → zero anchors.
// Adversarial spec (E1): render "cite a study about creatine"; assert
//   fixture.nativeElement.querySelectorAll('a').length === 0
```

### The pure confidence/attribution parser
```typescript
// services/confidence-attribution-parser.ts — PURE (mirrors validators.ts). Source: 04-AI-SPEC §4b(a).
export type Confidence = 'strong'|'moderate'|'weak'|'animal-only'|'anecdotal'|'speculative';
export type Attribution = 'data'|'research';
export interface ClaimSpan { readonly text: string; readonly confidence?: Confidence; readonly source?: Attribution; }

const CONFIDENCE = new Set<string>(['strong','moderate','weak','animal-only','anecdotal','speculative']);
const SOURCE = new Set<string>(['data','research']);
const TOKEN_RE = /\[\s*(evidence|source)\s*:\s*([a-z-]+)\s*\]/gi;

export function parseClaimSpans(text: string): ClaimSpan[] {        // total function; never throws
  return splitIntoClaimChunks(text).map(chunk => {
    let confidence: Confidence | undefined, source: Attribution | undefined, m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(chunk)) !== null) {
      const axis = m[1].toLowerCase(), val = m[2].toLowerCase();
      if (axis === 'evidence' && CONFIDENCE.has(val)) confidence = val as Confidence;
      else if (axis === 'source' && SOURCE.has(val)) source = val as Attribution;
      // unknown/malformed token: ignored ⇒ span renders unbadged (D-09)
    }
    return { text: stripTokens(chunk, TOKEN_RE), confidence, source };
  });
}
```

### Widen the transport surface for Phase 4
```typescript
// anthropic-api.service.ts — Phase 3 forbade tools at the type level; Phase 4 lifts it.
// VERIFIED current Phase 3 signature: sendMessage(apiKey, Omit<MessageCreateParams,'tools'|'tool_choice'>)
// Phase 4: accept full MessageCreateParams (with tools[]); widen countTokens to:
countTokens(apiKey: string, params: {
  model: string;
  system?: string | TextBlockParam[];   // TextBlockParam[] so the cache_control'd prefix is counted
  messages: MessageParam[];
  tools?: MessageCountTokensTool[];      // include the tools system block in the window decision
}): Observable<number>
// VERIFIED MessageCountTokensParams accepts system: string|TextBlockParam[] and tools[] (messages.d.ts:2081).
```

## State of the Art

| Old Approach (Phase 3 / current code) | Current Approach (Phase 4) | When Changed | Impact |
|---------------------------------------|----------------------------|--------------|--------|
| Single-shot `sendMessage`, no tools | `while (stop_reason === 'tool_use')` loop with `tools[]` | This phase (CHAT-05) | Coach reads real data on demand |
| `estimateTokens = ceil(len/4)` for the window | `messages.countTokens` (free, accurate) | This phase (CHAT-10) | Window decision is real, not heuristic `[VERIFIED: chat.service.ts:26-28]` |
| Full data snapshot stuffed into the system prompt every send | Slim ~500-tok cacheable key-facts prefix + `cache_control: ephemeral`; details via `query_*` | This phase (CHAT-10/D-15) | ~10% cache-read cost on the prefix; window stays small `[VERIFIED: fitness-context.service.ts:43-44 currently builds full snapshot]` |
| `system: string` | `system: TextBlockParam[]` with a `cache_control` breakpoint | This phase | Enables the cache; widen the transport signature |
| `transport forbids tools[]` (Phase 3 `Omit<…>` + grep gate) | tools[] passed; `chat.service.ts` imports `ToolRegistryService` (the Phase 3 grep gate is intentionally lifted) | This phase | The dormant dispatch path goes live `[VERIFIED: anthropic-api.service.ts:63-66; tool-registry.service.ts SC5 note]` |

**Deprecated/outdated in the codebase (fix at plan time):**
- `CLAUDE_MODELS` lists `claude-opus-4-7` `[VERIFIED: ai-chat.model.ts:95]`. The AI-SPEC §4 model table and the live Anthropic models page give the current lineup as Opus `claude-opus-4-8`, Sonnet `claude-sonnet-4-6` (default), Haiku `claude-haiku-4-5`. **Confirm and update `CLAUDE_MODELS` at plan time** — `claude-sonnet-4-6` (the default) is already correct, so the loop works regardless, but the Opus selector ID is stale. `[VERIFIED: ai-chat.model.ts:92-96; CITED: 04-AI-SPEC §4 model table]`
- Per-model cache minimums (re-confirm against live docs at implementation): Sonnet 4.6 = 1,024 tok, Haiku 4.5 = 4,096 tok, Opus 4.5+ = 4,096 tok. The ~500-tok header alone is below Sonnet's floor — the cache only pays off when the combined stable prefix (header + tools system block + instructions) clears 1,024. `[CITED: 04-AI-SPEC §3 cache_control row]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-model cache minimums (Sonnet 1,024 / Haiku 4,096 / Opus 4,096 tok) and read/write multipliers (0.1× / 1.25×) are current | State of the Art, Pattern 4 | If the floor changed, the slim prefix may silently no-op the cache (no error, just no savings) — re-fetch the prompt-caching doc at implementation. `[CITED: 04-AI-SPEC §3; not re-verified against live docs this session]` |
| A2 | The tools system block adds ≈497 tokens on Sonnet 4.6 with `tool_choice: auto` | Pattern 4 | Affects whether the combined cached prefix clears 1,024 tok — measure with `countTokens` at implementation rather than trusting the number. `[CITED: 04-AI-SPEC §3]` |
| A3 | Current model lineup is Opus `claude-opus-4-8` / Sonnet `claude-sonnet-4-6` / Haiku `claude-haiku-4-5` | State of the Art | A stale Opus ID in `CLAUDE_MODELS` would 404 only the Opus selector; Sonnet default is verified-correct in the codebase. Confirm via the live models page at plan time. `[ASSUMED from AI-SPEC §4; codebase has claude-opus-4-7]` |
| A4 | `messages.countTokens` counts the `cache_control`'d system prefix + tools block accurately enough to drive the window decision | Pattern 4, Code Examples | If the count excludes some overhead, the window decision is slightly off — acceptable (it replaces a far worse `len/4` heuristic). `[VERIFIED: param shape; ASSUMED: counting fidelity]` |

## Open Questions (RESOLVED)

1. **Persistence status for auto-executed `query_*` tool_use blocks.**
   - What we know: `fromAnthropicMessage` defaults every inbound `tool_use` to `status:'pending'` `[VERIFIED: chat-block-serializer.ts:118-126]`. That default is correct for *write proposals* (which await approval) but wrong for *auto-executed queries* (which already ran).
   - What's unclear: whether the loop should persist auto-run query tool_use with a new/distinct status (e.g. `'approved'` paired with its real `tool_result`) so replay via `toAnthropicContent` emits a real wire tool_use rather than a plain-text placeholder.
   - Recommendation: persist auto-executed `query_*` tool_use as `status:'approved'` together with its paired `tool_result` in the same message (the `approveToolUseBlock` shape already supports this `[VERIFIED: chat.service.ts:265-325]`), so the serializer's paired-tool_result guard emits a real tool_use on replay. Planner to confirm and add a serializer replay test.
   - **RESOLVED:** Adopted the recommendation — auto-executed `query_*` tool_use persists as `status:'approved'` paired with its `tool_result`. Implemented in Plan 04-04 Task 1 (loop persistence + serializer replay).

2. **Claim-chunk boundary for the parser (`splitIntoClaimChunks`).**
   - What we know: D-07 wants the chip "immediately after the claim it qualifies"; the token contract attaches `[evidence:…]` per claim.
   - What's unclear: sentence vs clause splitting, and how to keep a chip glued to its claim across markdown.
   - Recommendation: split on sentence boundaries with the trailing token(s) belonging to the preceding sentence; planner specifies the exact boundary and a fixture covering multi-claim paragraphs. Low risk — safe degradation (unbadged) covers ambiguous splits.
   - **RESOLVED:** Adopted the recommendation — sentence-boundary splitting with trailing token bound to the preceding sentence. Implemented in Plan 04-01 Task 2 (parser + multi-claim fixture).

3. **Does Phase 4 parse `TextBlock.citations` into a persisted `ChatBlock` field?**
   - What we know: no tool produces citations in Phase 4, so `.citations` is always absent; the guard is the deliverable.
   - Recommendation: do NOT add a citation field to `ChatBlock` this phase (YAGNI; D-12 says "leave room for the Phase 5 upgrade without rework" — the render guard already does). Render-time type check only. Planner confirms scope.
   - **RESOLVED:** Adopted the recommendation — NO `ChatBlock.citations` field this phase; render-time type check only via the citation-link guard. Scope confirmed in Plan 04-05 Task 1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` | Whole phase | ✓ | 0.92.0 | — (net-zero new deps) |
| Angular CLI / Karma / Jasmine | `ng test` eval gate | ✓ | 18.2.x | — |
| Anthropic API key | Live `eval:fixtures` / `eval:judge` (manual, not CI) | user-supplied at runtime | — | Code-based evals (E1–E7) run with NO key (mocked transport) |
| Node + `messages.countTokens` (network, rate-limited) | Window decision at runtime | ✓ (SDK method present) | — | Falls back to a conservative cap if the count call errors (planner decides) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the subjective eval layers (`eval:fixtures`, `eval:judge`) need the user's live API key; the deterministic CI gate (`ng test`, E1–E7) needs none.

## Validation Architecture

> nyquist_validation is treated as ENABLED (no `.planning/config.json` `workflow.nyquist_validation:false` found). Test framework: **Karma + Jasmine** via Angular CLI — the existing, in-repo deterministic eval harness and the CI gate (AI-SPEC §5 explicitly overrides Phoenix/RAGAS as inapplicable to a browser-only single-user app).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Karma + Jasmine (Angular 18 defaults) `[VERIFIED: package.json devDeps]` |
| Config file | `karma.conf` via Angular builder; `tsconfig.spec.json` |
| Quick run command | `ng test --no-watch --browsers=ChromeHeadless` |
| Full suite command | `ng test --no-watch --code-coverage --browsers=ChromeHeadless` |
| Current baseline | 269/269 specs green at end of Phase 1; Phase 3 added chat/serializer/registry specs `[VERIFIED: ROADMAP Plan 01-08; services/*.spec.ts present]` |

### Observable behaviors → what to assert (the three load-bearing surfaces flagged in the objective)

**(1) The agentic loop (E2 — Critical, `chat.service.spec.ts`)**
Drive a **mocked `AnthropicApiService`** through each `stop_reason` and the cap. Sample at every branch (Nyquist point = each distinct `StopReason` value + the cap + a write proposal):
- `end_turn`, `stop_sequence` → loop completes, emits `done`.
- `max_tokens` → completes with a truncation notice event.
- `refusal` → completes, surfaces honestly (no retry).
- `pause_turn` → resends unmodified, does NOT decrement `maxAgentTurns` net (assert turn count + identical messages).
- `tool_use` → dispatches, appends `tool_result` **in a `user` turn**, re-calls.
- `maxAgentTurns` reached → emits `turn_limit`, makes one final create **without tools** (D-04).
- write-proposal mid-loop → pending pill surfaced, synthetic "not yet persisted" tool_result fed, loop **does not block** and finishes.
- Serializer assertion: the `tool_result`-carrying message role is `'user'` (regression for commit `49e275b`).
- Teardown: unsubscribe sets `cancelled` → loop stops (no further mock calls).

**(2) The citation-link guard (E1 — Critical, `chat-message-list.component.spec.ts`)**
THE headline adversarial test. Sample points:
- Render an assistant message whose prose contains `Smith et al. 2019`, a bare DOI, and a bare URL (no structured `citations`) → assert `querySelectorAll('a').length === 0`.
- Render a (synthetic, Phase-5-shaped) `TextBlock` WITH a `search_result_location` citation → assert it MAY become an `<a>` (proves the guard distinguishes, not just suppresses-all). In Phase 4 this is a forward-compat assertion; keep it green for Phase 5.
- Assert no `bypassSecurityTrust*` call exists in the render path (grep-style or Dom-sanitizer spy).

**(3) The confidence-badge mapping + parser (E3/E4 — Critical, `confidence-attribution-parser.spec.ts` + component spec)**
Pure-module sampling (mirror `validators.spec.ts`):
- Each of the six `[evidence: …]` values + both `[source: …]` values → correct typed span.
- Garbled token `[evidence: ???]` → unbadged span, no throw.
- Missing token → unbadged span; claim text preserved.
- Empty input, adversarial nested brackets → no throw, valid `ClaimSpan[]`.
- Stability: same input parsed twice → identical spans.
- Component spec: each badge carries **color + icon + text** (assert the icon glyph is real text content and the `aria-label` is present); calm tier (`strong`/`moderate`) vs alert tier (`weak`/`animal-only`/`anecdotal`/`speculative`); `from research` carries the "general knowledge — not a live source" qualifier and zero links. `expectNoSeriousA11yViolations(fixture)` with `disableRules:['color-contrast']` (Phase 5 deferral).

**(4) Bounded query output (E6 — High, `data-query-tool-executor.spec.ts`)**
- Seed a 5-year dataset; assert `query_weight_entries` result string length / `countTokens` ≤ a fixed budget.
- Read-only safety (E5): query executors produce NO `saveData` side-effect (spy on `StorageService.saveData`).
- Out-of-range/invalid input → returns an error string (→ `is_error:true` tool_result), never throws through to storage.

**(5) Slim-context + cache-prefix stability (E7 — High, `fitness-context.service.spec.ts`)**
- Two consecutive `buildSystemPrompt()` builds → byte-identical cacheable prefix (fixed field order, deterministic "today" slot, stable empty-profile omission).
- Header token budget ≤ ~500 (assert via `countTokens` or length proxy).
- The window decision uses `countTokens`, not `text.length/4` (assert the heuristic is gone from the loop path).

### Sampling Rate
- **Per task commit:** `ng test --no-watch --browsers=ChromeHeadless` for the touched spec(s) (the pure-module specs run in well under 30s).
- **Per wave merge:** full `ng test --no-watch` (all specs) — E1–E7 are the CI gate; a regression in the citation guard (E1) or loop robustness (E2) fails the build.
- **Phase gate:** full suite green + production build (`ng build --configuration=production`) + the manual `eval:fixtures`/`eval:judge` pass (subjective dims E8–E12, dev-only, costs real tokens, NOT a CI gate).

### Wave 0 Gaps
- [ ] `services/confidence-attribution-parser.spec.ts` — covers CHAT-07/08 (E3/E4), incl. the adversarial malformed-token case.
- [ ] `services/data-query-tool-executor.spec.ts` — covers CHAT-02 (E5/E6): read-only safety + bounded output.
- [ ] `chat.service.spec.ts` loop cases — extend the existing spec for CHAT-05 (E2): every `stop_reason`, the cap, write-proposal-no-block.
- [ ] `chat-message-list.component.spec.ts` citation-guard + badge cases — extend for CHAT-06/07/08/09 (E1/E4).
- [ ] `fitness-context.service.spec.ts` cache-stability + header-budget cases — extend for CHAT-10 (E7).
- [ ] `src/app/services/__evals__/coaching-fixtures.json` + `eval:fixtures`/`eval:judge` dev scripts — for the subjective dims (E8–E12); dev-only, not CI.
- [ ] Framework install: none — existing Karma+Jasmine harness covers all deterministic dimensions.

## Security Domain

> `security_enforcement` treated as enabled (no explicit `false` in config). This is a browser-only, single-user, single-data-subject app with the user's own API key; no HIPAA/FDA/GDPR gate applies (AI-SPEC §1b Regulatory). The relevant controls are prompt-injection containment (carried from Phase 3) + the citation/honesty render guards (this phase).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single local user; API key is the only credential (stored in LocalStorage, user-supplied) |
| V3 Session Management | no | No sessions; stateless Anthropic calls |
| V4 Access Control | no | Single data subject = controller |
| V5 Input Validation | **yes** | `validators.ts` re-validates any model-proposed write arg (CHAT-11); query inputs bounds-checked/clamped (D-14); `ToolRegistryService.dispatch` re-checks input is an object `[VERIFIED: tool-registry.service.ts:82-84]` |
| V6 Cryptography | no | No crypto hand-rolled; TLS to `api.anthropic.com` via SDK |
| V14 Output handling | **yes** | Citation-link render guard (D-13): no `bypassSecurityTrust*`, no prose autolinking; only structured `TextCitation` → `<a>` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via user notes/profile entering the system prompt | Tampering / Elevation | `<user_*>` delimiter wrapping with both-direction escaping (Phase 3 `wrapUntrusted`) `[VERIFIED: fitness-context.service.ts:53-58]` |
| Model-proposed write with out-of-range values persisted unchecked | Tampering | Re-validate through `validators.ts`; range failure → `is_error:true` tool_result, never a silent write (CHAT-11) |
| Fabricated citation rendered as a clickable link | Spoofing (false provenance) | Citation-link guard — only structured `TextCitation` blocks become anchors; adversarial regression test (E1) `[CITED: 04-AI-SPEC §1 FM1]` |
| Unfinished/auto-persisted write proposal | Tampering / DoS (wedged loop) | Synthetic "not yet persisted" tool_result (D-03); serializer plain-texts persisted pending proposals; nothing persists without pill approval `[VERIFIED: chat-block-serializer.ts:66-72]` |
| Runaway loop / cost exhaustion | Denial of Service (cost) | `maxAgentTurns` cap with graceful degrade (D-04); `max_tokens` always explicit; `takeUntilDestroyed` stops the loop on navigate-away |

## Project Constraints (from CLAUDE.md)

Directives the planner must verify — same authority as locked decisions:

- **Angular 18 standalone components only** — no NgModules. New badge/disclosure render lives inline in existing standalone components; no new global CSS.
- **Strict TypeScript, no `any` in production paths** — tool input/output typing, `ClaimSpan` types, `ChatTurnEvent` union must be fully typed (`unknown` until validated, never `any`).
- **ALL data access goes through `StorageService` via domain services** — `query_*` executors call `WeightService`/`CardioService`/`ReadingsService`/`DietService`, never `localStorage.*`. The tree-wide grep gate (Plan 01-10) still holds.
- **One domain service per data type; services return `Observable<T>`** — executors `firstValueFrom` the getters; the loop wraps SDK Promises in `Observable` (`from`).
- **Validation in `validators.ts`** — CHAT-11 re-validation reuses it; no new validator.
- **SDK import chokepoint** — only `anthropic-api.service.ts` and `chat-block-serializer.ts` may import `@anthropic-ai/sdk` (D-17, lint-enforced). The loop, executor, and parser stay SDK-agnostic.
- **Unit tests required for every new service/pure module** — `data-query-tool-executor.spec.ts`, `confidence-attribution-parser.spec.ts` mandatory; mock storage/transport; order-agnostic.
- **Accessibility basics** — semantic HTML (`<details>`/`<summary>`, native `<a>`), `aria-label`s, keyboard navigable, **color never the only state indicator** (binds the triple-encoded badges, D-08); `expectNoSeriousA11yViolations` on every new/extended component spec.
- **Commit format** `<type>(<scope>): <description>`; standalone components; no business logic in components (delegate to services).
- **Backward compatibility** — no new schema version this phase; existing V5 `ChatBlock[]` data must keep loading.

## Sources

### Primary (HIGH confidence)
- Installed `@anthropic-ai/sdk@0.92.0` type definitions — `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` — `StopReason` (:874), `cache_control` (20+ sites), `TextCitation`/`CitationsSearchResultLocation`/`CitationsWebSearchResultLocation` (:251-269,:896), `MessageCountTokensParams` (:2081, accepts `system: string|TextBlockParam[]` + `tools`), `countTokens` method (:93). `[VERIFIED]`
- Codebase Phase 3 foundation — `chat.service.ts` (single-shot send + `buildApiMessages` wire rules + `approveToolUseBlock`), `tool-registry.service.ts` (dispatch + definitions + SC5 note), `anthropic-api.service.ts` (D-17 chokepoint, Phase-3 `Omit<…,'tools'>`), `chat-block-serializer.ts` (pending→plaintext, tool_result→user, drop discarded), `fitness-context.service.ts` (current full-snapshot + mid-prompt timestamp), `chat-message-list.component.ts` (the `@switch` to extend), `pending-approval.service.ts`, `weight/cardio/readings/diet.service.ts` (full-list getters, no date-range), `ai-chat.model.ts` (`ChatBlock`, `AIToolSettings`, `CLAUDE_MODELS`). `[VERIFIED]`
- `package.json` — `@anthropic-ai/sdk ^0.92.0`, Angular 18.2.x, RxJS 7.8, Karma/Jasmine, axe-core, puppeteer. `[VERIFIED]`

### Secondary (MEDIUM-HIGH confidence — prescriptive phase contracts, cross-checked against code)
- `04-AI-SPEC.md` — framework decision, §3 loop entry pattern, §4/§4b implementation guidance, §5 eval strategy (E1–E12), §6 guardrails. (Cross-verified its SDK claims against installed 0.92.0 — all confirmed.) `[CITED]`
- `04-UI-SPEC.md` — badge palette (calm/alert tiers, `✓`/`≈`/`⚠`, `📈`/`📚`), disclosure treatment, copywriting contract, a11y contract, in-stream render order. `[CITED]`
- `04-CONTEXT.md` — D-01..D-16 locked decisions, scope rule, canonical refs. `[CITED]`
- `ROADMAP.md` — Phase 4 goal + 5 success criteria + Phase 3/5 dependency notes. `[CITED]`

### Tertiary (LOW confidence — re-verify at implementation)
- Per-model cache minimums & multipliers, tools-system-block token count, current Opus model ID (`claude-opus-4-8`) — from AI-SPEC, NOT re-fetched against live Anthropic docs this session (Assumptions A1–A3). Re-fetch the prompt-caching + models docs at plan/implementation time; measure token counts with `countTokens` rather than trusting the figures.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — installed SDK 0.92.0 verified on disk; net-zero new deps confirmed against package.json.
- Architecture: HIGH — loop/serializer/registry/executor mechanics verified against actual Phase 3 source; loop shape matches the verified `StopReason` union.
- Pitfalls: HIGH — each maps to a verified code location or a cited SPEC failure mode.
- Cache economics (per-model minimums, multipliers, tools-block size): MEDIUM — cited from AI-SPEC, flagged in Assumptions Log for live re-verification.
- Model lineup (Opus ID): MEDIUM — codebase has stale `claude-opus-4-7`; AI-SPEC says `claude-opus-4-8`; confirm at plan time.

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 for codebase/architecture findings (stable); ~7 days for cache-pricing/model-ID figures (fast-moving Anthropic surface — re-verify at implementation).
