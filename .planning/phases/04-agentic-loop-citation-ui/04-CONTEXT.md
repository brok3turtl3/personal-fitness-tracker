# Phase 4: Agentic Loop + Citation UI - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the chat from a single-shot snapshot bot into an **agentic coach**. Phase 4 activates the infrastructure Phase 3 landed dormant:

1. **`query_*` data tools (CHAT-02)** — six read-only client tools over the existing domain services: `query_cardio_sessions`, `query_weight_entries`, `query_readings`, `query_meals_in_range`, `query_daily_totals`, `query_saved_foods`. The AI fetches the user's *actual* logs on demand instead of receiving a full-data snapshot up front.
2. **Agentic loop (CHAT-05)** — `ChatService` runs `while (stop_reason === 'tool_use')`, dispatching through the existing `ToolRegistryService`, bounded by `aiToolSettings.maxAgentTurns` (default 10).
3. **Tool-use transparency UI (CHAT-06)** — `tool_use` / `tool_result` blocks render inline in the message stream, collapsed by default, expandable on demand.
4. **Per-claim confidence badges (CHAT-07)** — the locked 6-level taxonomy (`strong | moderate | weak | animal-only | anecdotal | speculative`) parsed from the model's inline token contract and rendered as badges; low-confidence states visually distinct (color + icon, never color alone).
5. **Source attribution (CHAT-08)** — each claim is marked "from your data" vs "from research".
6. **Citation safety (CHAT-09)** — only API-structured citation blocks ever become hyperlinks; free-text author-year strings render as plain text. (Web-search grounding that *produces* those structured citations is Phase 5 — Phase 4 ships the rule and the plain-text guard.)
7. **Real token accounting + slim prompt + cache (CHAT-10)** — `messages.countTokens` replaces `text.length / 4`; `cache_control: { type: 'ephemeral' }` on the system prompt; `FitnessContextService` emits a thin ~500-token "key facts" header instead of stuffing the full dataset.

**Hard scope rule:** No web search server tool (Phase 5). No CRUD-edit tools, quota/multi-tab/CSP/401 hardening, or a11y sweep (Phase 5). The agentic loop must already handle terminal stop reasons (`end_turn`, `max_tokens`, refusal, `pause_turn`) reliably so Phase 5 can add server tools on top.

**Depends on Phase 3:** tool registry, `chat-block-serializer.ts`, `ChatBlock` union, pending-pill scaffold, `@anthropic-ai/sdk` transport, V5 schema. **File scope:** `features/chat/**`, `services/chat.service.ts`, `services/anthropic-api.service.ts`, `services/fitness-context.service.ts`, `services/tool-registry.service.ts`, new `query_*` executor(s), `models/ai-chat.model.ts`, a new confidence/attribution parser module.

</domain>

<decisions>
## Implementation Decisions

> **Note on provenance:** The user delegated all four discussed gray areas to Claude with a single north star — **"maximize user experience, which includes quality of advice as well as transparency."** The decisions below are Claude's, made against that brief and grounded in the Phase 3 AI-SPEC invariants, the research SUMMARY/PITFALLS, and PROJECT.md's "source attribution + confidence labels instead of clinical guardrails" key decision. They are LOCKED for downstream agents unless the user revisits them. Fine-grained system-prompt wording and eval rubrics are explicitly handed to `/gsd-ai-integration-phase` (AI-SPEC) and visual specifics to `/gsd-ui-phase` (UI-SPEC).

### Live loop feedback & write-approval interleaving (CHAT-05, CHAT-06)

- **D-01: Real-time, per-tool-call progress — never silent-until-done.** While the loop runs, each `tool_use` block renders live in the message stream the instant it fires, showing an in-flight status ("Reading your weight entries…"), then resolves in place to a completed summary row ("✓ Read 38 weight entries · Jan 1–May 31"). Transparency is a stated top priority; the user should watch the coach gather evidence, not stare at an undifferentiated spinner. This reuses the existing block-stream `@switch` render extended for `tool_use`/`tool_result`.
- **D-02: `query_*` tools auto-execute — no confirm.** They are read-only reads of the user's own already-stored data. Gating them behind approval would make the coach unusable. The confirm-before-write scaffold (D-10/D-11 in 03-CONTEXT) applies ONLY to mutations (memory / profile writes), never to queries.
- **D-03: The loop NEVER blocks synchronously on a write approval.** When the model proposes a memory/profile write mid-loop, the loop does not freeze waiting for the user. The proposal surfaces as a pending pill (Phase 3 scaffold, now live), and the loop is fed a synthetic `tool_result` indicating the proposal was surfaced for approval and is **not yet persisted**, so the model can finish its answer. Nothing is written until the user approves the pill — confirm-before-write is preserved without freezing a multi-turn coach mid-thought. **Implication for AI-SPEC:** the exact synthetic-result wording is an AI-SPEC deliverable; it must be consistent with D-16's "pending tool_use serializes to the API as plain text" rule from Phase 3. This honors the AI-SPEC §critical-failure-mode "unfinished tool_use must never wedge the loop".
- **D-04: Hitting `maxAgentTurns` degrades gracefully and visibly.** When the turn cap is reached mid-task, the loop stops, the model is asked for a best-effort answer with what it has, and the UI surfaces a quiet, honest notice ("Reached the tool-use limit ({n} turns) — answering with the data gathered so far."). Never a silent truncation, never a raw error. Transparency over false completeness.

### Tool-use transparency depth (CHAT-06)

- **D-05: Humanized summary as the collapsed label; raw structured detail on expand.** Collapsed (default) shows a scannable human line per tool call ("📊 Read 38 weight entries · Jan 1–May 31"). Expanding reveals the verifiable structured detail: tool name, formatted input parameters, and the formatted result (table/JSON). This satisfies CHAT-06's "verify what data the AI looked at" while keeping the default view clean — best of both for UX + transparency.
- **D-06: One collapsible per tool call, inline in execution order.** Not a single combined "data panel". Each query is a discrete, auditable fact-fetch; rendering them in stream order lets the user trace exactly which call produced which evidence. A multi-call turn yields a short stack of collapsed rows above the prose. Matches Phase 3's in-stream philosophy (proposals/results live next to the message that produced them).

### Confidence badge presentation (CHAT-07)

- **D-07: Inline chip immediately after the claim it qualifies.** The model emits an inline token contract (`[evidence: strong]` … per research SUMMARY) which a pure parser module extracts and replaces with a rendered badge positioned right after the sentence/clause. Per-claim attachment is the whole point — a single message-level grade would lose the milestone's core value. NOT superscript-only (too easy to miss exactly when it matters — low-confidence). NOT color-only (violates CLAUDE.md "color is never the only state indicator").
- **D-08: Triple-encoded badges — color + icon + text label, always.** Low-confidence states (`weak`, `animal-only`, `anecdotal`, `speculative`) use warm/alert colors + a caution/warning icon so they are scannable at a glance; high-confidence (`strong`, `moderate`) stay calm/neutral. Every badge carries all three channels (a11y). Exact palette/iconography is a UI-SPEC deliverable; the *requirement* is that a skimming user instantly distinguishes a `speculative` claim from a `strong` one without reading the label.
- **D-09: The confidence parser is a pure module (mirrors `chat-block-serializer.ts` / `validators.ts`).** Parsing the inline token contract out of assistant text and into structured `{ text, confidence, source }` spans is stateless, DI-free, and fully unit-tested — including an adversarial test that a malformed or absent token degrades safely (claim renders unbadged, never crashes, never fabricates a grade). Rendering lives in `chat-message-list`.

### Source attribution & the "from research" honesty problem (CHAT-08, CHAT-09)

- **D-10: Source is a second axis paired with confidence — "how do I know this".** Each graded claim also carries a source marker: **"from your data"** (distinct icon, e.g. 📈) vs **"from research"** (distinct icon, e.g. 📚). The two-axis annotation (source × confidence) IS the epistemic-honesty mechanism PROJECT.md chose over clinical disclaimers. A "from your data · strong" claim and a "from research · speculative" claim should look visibly different.
- **D-11: "From your data" claims are traceable to the tool call that fetched them.** Where feasible, a data-sourced claim links/anchors back to the relevant collapsed `tool_use` disclosure (D-05/D-06), so "your weight is trending down" visibly ties to *those* 38 entries. Exact linkage UX is a UI-SPEC deliverable; the intent is traceability, not a bare label.
- **D-12: "From research" in Phase 4 means the model's own training knowledge — labeled as such, NEVER as a cited source.** No web grounding exists until Phase 5, so a "from research" claim carries its confidence badge + a "general knowledge — not a live source" framing and **zero hyperlinks**. This is the honest reconciliation of CHAT-08 (attribute research) and CHAT-09 (no free-generated citation links). When Phase 5 adds the web-search server tool, grounded claims upgrade to real, structured, linked citations; the Phase 4 rendering must leave room for that upgrade without rework.
- **D-13: Citation-link guard ships and is adversarially tested now.** Even though Phase 4 produces no web citations, the renderer must already enforce: only `web_search_result_location` / `search_result` structured blocks become `<a href>`; any author-year / DOI / URL string the model wrote freely in prose renders as plain text. A regression test proves a "cite a study about X" prompt cannot produce a clickable link in Phase 4. (Closes research Pitfall 1 — hallucinated citations — at the rendering boundary before web search arrives.)

### Cross-cutting technical direction (CHAT-02, CHAT-05, CHAT-10) — researcher/planner own the detail

- **D-14: `query_*` tools are thin read-only wrappers over existing domain services, with bounded/summarized output.** Each accepts date-range / filter params and returns a *bounded* result (summarize or cap large ranges) to protect the token budget — a 5-year `query_weight_entries` must not dump the whole dataset back through the context window. Read-only ⇒ no write-validation needed, but per CHAT-11 any tool that ever accepts model-proposed values (the memory/profile writes) re-validates through `validators.ts`. Exact output shape, caps, and summarization strategy are the researcher's call.
- **D-15: Slim `FitnessContextService` header + `cache_control` + real token counts.** The system prompt becomes a ~500-token "key facts" header (today, units, profile-if-present, high-level counts / latest values) — specifics are fetched via `query_*`. `cache_control: { type: 'ephemeral' }` on the system-prompt prefix for ~10%-cost cache reads (keep the prefix stable — empty-profile omission from D-02/03-CONTEXT helps). `messages.countTokens` drives the rolling-window decision, replacing `text.length / 4`. Per-model cache minimums and the exact header contents are the researcher's call (re-fetch Anthropic prompt-caching + token-counting docs).
- **D-16: The loop must handle ALL terminal stop reasons before Phase 5.** `end_turn` (normal finish), `max_tokens` (note truncation to the user), refusal (surface honestly), `pause_turn` (resume per Anthropic guidance), plus the `maxAgentTurns` guard (D-04). This robustness is a Phase 4 success bar precisely because Phase 5 drops a server tool onto the same loop.

### Claude's Discretion
- **System-prompt engineering** — WHEN the model should grade a claim, WHEN to propose a memory write, the exact inline confidence-token contract syntax, and the synthetic "pending approval" tool_result wording (D-03): all deferred to `/gsd-ai-integration-phase` (AI-SPEC) per the milestone's AI-hint.
- **Visual specifics** — badge palette/iconography, collapsed-row styling, the data-claim→tool-call linkage affordance (D-11), and the loop progress animation: deferred to `/gsd-ui-phase` (UI-SPEC) per the milestone's UI-hint.
- **`query_*` output shape & caps (D-14)**, summarization strategy, and whether the six tools share one `DataQueryToolExecutor` or split: researcher/planner's call.
- **Web-search version decision** (`web_search_20250305` vs `web_search_20260209`) is explicitly NOT a Phase 4 decision — it's deferred to Phase 5 planning (see research SUMMARY open questions).
- **Streaming vs non-streaming responses** — whether to adopt SDK streaming for the live-feedback feel (D-01) or render progress from discrete loop iterations: researcher's call, provided D-01's per-tool-call visibility is achieved either way.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & milestone context
- `.planning/PROJECT.md` — Core Value ("evidence-graded guidance"), Key Decision "no clinical guardrails; source attribution + confidence labels instead", constraints (stateless Anthropic calls, key stays local, LocalStorage-only, strict TS)
- `.planning/REQUIREMENTS.md` — CHAT-02, CHAT-05, CHAT-06, CHAT-07, CHAT-08, CHAT-09, CHAT-10 are this phase's mandate; CHAT-11 (tool-arg re-validation) carries forward as a binding gate
- `.planning/ROADMAP.md` §"Phase 4: Agentic Loop + Citation UI" — goal, 5 success criteria, Phase 3 dependency, Phase 5 hand-off note ("loop must handle end_turn/max_tokens/refusal/pause_turn reliably")
- `.planning/STATE.md` — current position, schema-ordering decisions

### Prior phase context (DIRECT dependency — read in full)
- `.planning/phases/03-ai-memory-tool-plumbing/03-CONTEXT.md` — **the foundation this phase activates.** D-10/D-11 (pending pill, `ToolUseBlock.status`), D-14 (ChatBlock kinds), D-16 (`chat-block-serializer` strips persistence fields, renders `status='pending'` as plain text — the loop MUST respect this), D-17 (SDK transport boundary)
- `.planning/phases/03-ai-memory-tool-plumbing/03-AI-SPEC.md` — **critical-failure-mode rubric for Phase 4.** §"unfinished tool_use must never wedge the loop", §tool-input validation through `validators.ts`, §memory hygiene (facts not interpretations), §confirm-before-write; the eval rubric ingredients `/gsd-ai-integration-phase` will turn into measurable rubrics
- `.planning/phases/03-ai-memory-tool-plumbing/03-UI-SPEC.md` — block-aware rendering contract the badge/transparency UI extends
- `.planning/phases/01-foundations/01-CONTEXT.md` — characterization-test pattern (chat-page spec is the regression net), axe-core severity gate, empty/error-state + `takeUntilDestroyed` patterns every new component reuses

### Research outputs (re-read relevant sections)
- `.planning/research/SUMMARY.md` §"Phase 3: Agentic Loop + Citation UI" (note: research numbering is offset — this maps to roadmap Phase 4) — agentic loop shape, inline confidence-token contract, citation rendering, slim FitnessContextService + cache_control
- `.planning/research/PITFALLS.md` — Pitfall 1 (hallucinated citations, 14–95% fabrication — drives D-12/D-13), Pitfall 10 (low-confidence must be visually distinct — drives D-08)
- `.planning/research/ARCHITECTURE.md` — `ChatService` agentic-loop refactor + `ToolRegistryService` dispatch + slim `FitnessContextService` structural changes
- `.planning/research/STACK.md` — `@anthropic-ai/sdk ^0.92.0` (already adopted Phase 3), `messages.countTokens`, `cache_control`

### Codebase analysis
- `.planning/codebase/ARCHITECTURE.md` — locked layered shape (UI → domain services → StorageService → LocalStorage; Anthropic API as sole external path); ChatService orchestration
- `.planning/codebase/INTEGRATIONS.md` — Anthropic Messages API integration; SDK transport boundary at `anthropic-api.service.ts`
- `.planning/codebase/TESTING.md` — Karma+Jasmine spec patterns, `expectNoSeriousA11yViolations` helper (every new component/parser spec uses it)
- `.planning/codebase/CONVENTIONS.md` — strict TS, no `any` in production paths, standalone components, pure-module pattern (`validators.ts`)
- `CLAUDE.md` — "Component Pattern" (UI only, logic in services), "Validation Pattern", "Accessibility basics" ("color is never the only state indicator" — binds D-07/D-08), "Service Pattern"

### External specs (re-fetch at implementation time)
- [Anthropic tool use docs](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — `stop_reason: 'tool_use'` loop, ToolUseBlock/ToolResultBlock, strict tool definitions, terminal stop reasons (D-16)
- [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — `cache_control: ephemeral` syntax, per-model token minimums, pricing (D-15)
- [Anthropic token counting docs](https://platform.claude.com/docs/en/build-with-claude/token-counting) — `messages.countTokens` (D-15)
- [Anthropic search_result content blocks](https://platform.claude.com/docs/en/build-with-claude/search-results) — structured citation blocks that may become links (D-13; the producing server tool is Phase 5)
- [`@anthropic-ai/sdk` npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — typed `Message`/`ContentBlock`/`Usage`, `countTokens`, `dangerouslyAllowBrowser`, streaming

### Existing code touchpoints (line anchors approximate — re-confirm at plan time)
- `src/app/services/chat.service.ts` — gains the `while (stop_reason === 'tool_use')` loop; `buildApiMessages` (~178–212) and `maybeSummarize` (~214–283) already block-aware from Phase 3; `updateMessageBlock` / `approveToolUseAndAppendResult` (~190–294) are the write-approval primitives D-03 builds on
- `src/app/services/tool-registry.service.ts` — `query_*` executor(s) register here alongside the memory executor
- `src/app/services/fitness-context.service.ts` — slimmed to a ~500-token header + `cache_control` (D-15); keeps the CHAT-11 delimiter wrapping
- `src/app/services/anthropic-api.service.ts` — SDK transport; surfaces `countTokens`, `tools[]`, `cache_control` now that the loop is live
- `src/app/services/chat-block-serializer.ts` — the persistence↔wire bridge the loop runs through every turn (respect D-16 pending→plaintext rule)
- `src/app/features/chat/chat-message-list.component.ts` — extended `@switch` render for `tool_use`/`tool_result` collapsibles (D-05/D-06) + confidence/attribution badge rendering (D-07/D-08/D-10)
- `src/app/features/chat/pending-pill.component.ts` — the dormant Phase 3 scaffold that now receives real proposals (D-03); the dev-only seed button (03-CONTEXT D-12) must be removed/gated before real proposals fire
- `src/app/features/chat/chat-page.component.spec.ts` — Phase 1 characterization net; must keep passing across the loop activation
- `src/app/models/ai-chat.model.ts` — `AIToolSettings.maxAgentTurns` (default 10) drives the loop guard; may add confidence/attribution span types
- `src/app/services/validators.ts` — the canonical ranges any model-proposed write re-validates against (CHAT-11)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ToolRegistryService`** (Phase 3) — single dispatch point already wired with the memory executor; `query_*` executors slot in here. No new dispatch architecture needed.
- **`chat-block-serializer.ts`** (Phase 3, fully tested) — already strips persistence-only fields, drops `discarded`, renders `pending` tool_use as plain text. The loop leans on this every turn; Phase 4 finally exercises the path Phase 3 built and tested in advance.
- **Pending-pill component + `ToolUseBlock.status`** (Phase 3) — the confirm-before-write UI is built and spec'd; Phase 4 supplies the first real proposals (D-03). Remove/gate the dev-only seed button.
- **`@anthropic-ai/sdk` transport + `messages.countTokens`** (Phase 3) — `tools[]`, `cache_control`, and `countTokens` are already reachable through the typed transport; the loop drops onto typed surfaces with a small diff (per AI-SPEC §framework rationale).
- **Domain services** (`cardio/weight/readings/diet.service.ts`) — `query_*` tools are thin read-only wrappers over these existing, validated services; no new data access path.
- **Block-aware `chat-message-list` `@switch` render** (Phase 3) — extended, not rebuilt, for `tool_use`/`tool_result` collapsibles and badges.
- **Phase 1 patterns** — `expectNoSeriousA11yViolations` (every new spec), `takeUntilDestroyed(this.destroyRef)` (every new component subscription), empty/error-state components, the chat-page characterization spec as the regression net.
- **`validators.ts` + pure-module pattern** — model for the new confidence/attribution parser (D-09), and the re-validation gate for any model-proposed write (CHAT-11).

### Established Patterns
- **Pure, DI-free modules for stateless logic** — confidence/attribution parser mirrors `chat-block-serializer.ts` / `validators.ts`.
- **`@Injectable({ providedIn: 'root' })` services with constructor-injected `StorageService`** — `query_*` executors follow this; reads flow through domain services, never direct `localStorage.*`.
- **`Observable<T>` service returns** — preserved across the loop; SDK promises wrapped with `from(...)`.
- **Standalone components only; strict TS, no `any` in production paths** — applies to tool input/output typing, the parser span types, badge components.
- **SDK types stay at the transport boundary** (`anthropic-api.service.ts`); `ChatBlock` model owns persistence; the serializer bridges (D-17 from Phase 3, still binding).
- **`color + icon + text`, never color alone** — CLAUDE.md a11y rule binds the badge design (D-08).

### Integration Points
- **`ChatService` send flow** — wraps the current single request in `while (stop_reason === 'tool_use')`, dispatching tool calls via `ToolRegistryService`, appending `tool_result` blocks, re-calling until a terminal stop reason or `maxAgentTurns` (D-04/D-16).
- **`ToolRegistryService`** — `query_*` executors registered alongside memory; the request now sends `tools[]` (Phase 3 hard-rule "tools absent" is intentionally lifted in Phase 4).
- **`FitnessContextService.buildSystemPrompt`** — slimmed to the ~500-token header + `cache_control`; keeps CHAT-11 delimiter wrapping and D-09 redaction toggles from Phase 3.
- **`anthropic-api.service.ts`** — now passes `tools[]`, `cache_control`, and exposes `countTokens` to the window logic.
- **`chat-message-list.component.ts`** — the main UI surface: live tool-call progress (D-01), collapsed tool disclosures (D-05/D-06), confidence + source badges (D-07/D-08/D-10/D-11), citation-link guard (D-13).
- **`chat-page.component.ts`** — orchestrates the loop's streaming/iteration feedback into the view; remove/gate the dev seed button.

</code_context>

<specifics>
## Specific Ideas

- **The north star is one sentence:** "maximize user experience — quality of advice AND transparency." When a Phase 4 decision is genuinely 50/50, break the tie toward the option that makes the AI's reasoning more *visible and honest* to the user, not the one that's terser or prettier.
- **The two-axis annotation (source × confidence) is the product's epistemic heart** — it's the chosen replacement for clinical disclaimers (PROJECT.md). A claim should always answer "how confident?" and "from where?" A `from research · speculative` claim must look unmistakably weaker than a `from your data · strong` one.
- **Don't let the loop freeze on approvals (D-03).** A coach that hangs mid-thought waiting for a memory-write click is a worse experience than one that finishes its answer and leaves the write proposal sitting as a pill. Confirm-before-write is preserved by *deferring persistence*, not by *blocking the loop*.
- **Ship the citation-link guard before the citations exist (D-13).** Phase 4 has no web search, but the renderer must already refuse to hyperlink anything the model wrote freely — with an adversarial regression test. This closes the highest-stakes pitfall (fabricated citations) at the rendering boundary one phase early.
- **Live progress is a feature, not chrome (D-01).** Watching "Reading your weight entries… ✓ 38 entries" *is* the transparency promise being kept turn by turn. Silent-until-done would technically satisfy CHAT-06 but waste the trust-building moment.
- **Keep the cache prefix stable (D-15).** The empty-UserProfile omission (03-CONTEXT D-02/D-03) and a fixed key-facts header order matter now that `cache_control` is live — a churning prefix defeats the 10%-cost cache read.

</specifics>

<deferred>
## Deferred Ideas

- **Web-search server tool + grounded, linked citations** — Phase 5 (RESCH-01..03). Phase 4 ships only the *rule* (D-13) and the plain-text guard; the tool that produces structured `web_search_result_location` blocks is next phase.
- **`web_search_20250305` vs `web_search_20260209` version + `encrypted_index` replay** — Phase 5 planning decision (research SUMMARY open question).
- **Chat archival / LocalStorage quota hardening** — Phase 5 (QUAL-02/03). The agentic loop grows history faster (tool_use + tool_result blocks per turn), which raises the stakes, but the durable fix is Phase 5.
- **Multi-tab clobber of just-saved memory** — Phase 5 (QUAL-04). Higher floor of consistency expectation for AI memory, but not fixed here.
- **CRUD-edit tools for the AI (vs read-only `query_*`)** — out of scope; Phase 4 tools are strictly read-only. Any future write tools must clear the CHAT-11 re-validation gate. Not currently on the roadmap.
- **Multiple-pending-proposal queue/ordering semantics** — surfaces for real now that the loop can emit >1 write proposal per turn (deferred from 03-CONTEXT). Render in stream order; richer queueing only if usage shows a need.
- **Undo-after-approve window for memory writes** — revisit once real proposals fire and usage shows whether it's needed (deferred from 03-CONTEXT).
- **Streaming token-by-token rendering of the final answer** — D-01 requires per-tool-call visibility, not necessarily SDK streaming of prose; full streaming UX can be a later polish if the discrete-iteration feel is insufficient.

</deferred>

---

*Phase: 4-Agentic-Loop-Citation-UI*
*Context gathered: 2026-05-31*
