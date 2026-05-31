# Phase 5: Web Search Grounding + Quality Sweep - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Two distinct bodies of work under one phase. The web-search half is the **upgrade
path Phase 4 deliberately left room for**; the quality half is the **final sweep**
that applies Phase 1's instrumentation to all Phase 2/3/4 code and closes the
cross-cutting concerns in CONCERNS.md.

### A) Web Search Grounding (RESCH-01..03)
1. **`web_search` server tool wired into `tools[]`** when `aiToolSettings.enableWebSearch === true` (default OFF). Unlike the Phase 4 client `query_*` tools, this is an Anthropic **server-side** tool — Anthropic executes the search and returns `web_search_tool_result` + `web_search_result_location` citation blocks inline in the assistant turn; the client never dispatches it. The agentic loop must tolerate this (and `pause_turn`, already a Phase 4 requirement).
2. **Grounded citations render as inline footnotes** — `web_search_tool_result` blocks display in the stream; only `https:` URLs are clickable. This is where a "from research" claim **upgrades** from Phase 4's "general knowledge — not a live source" plain-text framing to a real, structured, linked citation.
3. **Cost-aware controls + adversarial test** — `webSearchMaxUses` cap surfaced in `/settings`; an adversarial regression test proves "find a study about X" cannot produce free-generated (un-grounded) citation links.

### B) Quality Sweep (QUAL-01..10)
Type tightening (QUAL-01), quota detection banner 70%/95% (QUAL-02), CRUD edit parity for cardio/weight/readings (QUAL-03), multi-tab `storage`-event safety (QUAL-04), chat archival (QUAL-05), CSP (QUAL-06), 401 key-rotation prompt (QUAL-07), a11y pass (QUAL-08), UX-consistency pass (QUAL-09), mutation testing (QUAL-10).

**Hard scope rule (no creep):** No new tracking domains, no goals system, no data import/export feature, no IndexedDB migration, no Vitest migration, no Electron-update signing work (CONCERNS flags it but it is a future-milestone security item, not in v2 scope). External food databases / barcode scanning remain deferred (Phase 2 research — CORS/getUserMedia blockers).

**Depends on Phase 4:** the agentic loop must already handle `end_turn`, `max_tokens`, refusal, and `pause_turn` reliably before a server tool is dropped onto it (ROADMAP Phase 4→5 hand-off note).

**File scope (approximate):** `services/anthropic-api.service.ts`, `services/chat.service.ts`, `services/tool-registry.service.ts`, `services/fitness-context.service.ts`, `services/storage.service.ts`, `services/cardio.service.ts`, `services/weight.service.ts`, `services/readings.service.ts`, `features/chat/**`, `features/settings/**`, `features/cardio/**`, `features/weight/**`, `features/readings/**`, `models/ai-chat.model.ts`, `models/app-data.model.ts`, `src/index.html` (CSP), `app.component.ts` (multi-tab + quota banners), `validators.ts` (mutation-test target), plus new pure modules / specs.
</domain>

<decisions>
## Implementation Decisions

> **Note on provenance:** The user delegated **all** Phase 5 gray areas (and the
> matched-todo fold decisions) to Claude with a single explicit north star —
> **"follow coding best practices, established codebase patterns, and focus on
> user experience."** This mirrors the Phase 4 delegation. The decisions below
> are Claude's, made against that brief and grounded in PROJECT.md's "source
> attribution + confidence labels instead of clinical guardrails" key decision,
> the Phase 4 CONTEXT/AI-SPEC invariants, the research SUMMARY/STACK/PITFALLS,
> and CONCERNS.md. They are **LOCKED** for downstream agents unless the user
> revisits them. Fine-grained system-prompt wording + eval rubrics are handed to
> `/gsd-ai-integration-phase` (AI-SPEC); visual specifics to `/gsd-ui-phase`
> (UI-SPEC).

### Web-search tool version & transport (RESCH-01)

- **D-01: Lock `web_search_20250305` (stable).** Matches RESCH-01 verbatim and research STACK.md's recommendation. The newer `web_search_20260209` (dynamic domain filtering) additionally requires the `code_execution` tool enabled and is for token-cost optimization — premature for a single-user app. Note it as a deferred upgrade only if web-search token spend becomes a problem. The SDK (`@anthropic-ai/sdk ^0.92.0`, adopted Phase 3) already exposes typed shapes for `web_search_20250305`, `web_search_tool_result`, and `web_search_result_location`.
- **D-02: Server-tool handling, not client dispatch.** The web-search tool is registered in `tools[]` but NEVER routed through `ToolRegistryService.dispatch` — Anthropic runs it server-side and the results arrive inline in the assistant turn. The agentic loop (`runAgenticLoop`, Plan 04-04) must treat a turn containing `server_tool_use` / `web_search_tool_result` as a normal turn to render, not as a client `tool_use` to execute. `pause_turn` resume (Phase 4 D-16) is the relevant continuation path. `ToolRegistryService.isWriteProposal` stays false for it (read-only, like `query_*`).

### Web-search grounding UX (RESCH-02)

- **D-03: Grounded web citations render as inline numbered footnotes + a per-message "Sources" list.** A grounded claim gets a superscript/inline footnote marker `[1]`; the message foots with a compact source list (title + clickable `https:` URL). This reuses and extends the Phase 4 in-stream `@switch` renderer and the `isLinkableCitation` allow-list — `web_search_result_location` / `search_result` blocks are now the **only** thing that becomes `<a href>`, and the href is gated to `https:` (RESCH-02). Exact footnote/source-list styling is a UI-SPEC deliverable.
- **D-04: The "from research" badge upgrades along the existing two-axis (source × confidence) system.** Phase 4 D-12 rendered a "from research" claim as "general knowledge — not a live source" with **zero** hyperlinks. In Phase 5, when a claim is backed by a live `web_search_result_location`, the source axis upgrades to **"from research · grounded"** carrying the footnote link; an un-grounded "from research" claim (model training knowledge, web search off or unused) **stays plain text with no link**, exactly as in Phase 4. A skimming user must visibly distinguish a grounded-and-linked research claim from an un-grounded one. This is the honest reconciliation of CHAT-08 (attribute research) and CHAT-09 (no free-generated links) — the Phase 4 renderer was built to absorb this upgrade without rework.
- **D-05: Live in-stream search feedback, mirroring Phase 4 D-01/D-05.** A web-search invocation renders live ("🔎 Searching the web…") and resolves to a scannable summary row ("✓ Found N sources"), expandable to the structured `web_search_tool_result` detail — consistent with how `query_*` tool calls render. Transparency parity: the user watches the coach reach for the web the same way they watch it read their data.

### Web-search behavior & cost posture (RESCH-01, RESCH-03)

- **D-06: `webSearchMaxUses` default stays `3`; surfaced as a configurable cap in `/settings`.** The field + default already exist in `DEFAULT_AI_TOOL_SETTINGS`. Expose it in the AI-settings UI alongside `maxAgentTurns` with a sane bounded range (suggest 1–10; planner finalizes). 3 is a reasonable per-message cost ceiling for a single-user app. The cap must **visibly bound cost** (success-criterion 1) — render the configured value near the web-search toggle.
- **D-07: No domain allow/block list this milestone.** Over-restricting sources fights the "draws on both traditional AND cutting-edge sources" goal and adds curation maintenance. The trust mechanism is the **citation-link guard + source/confidence labels**, not domain gating. (Domain filtering also pulls toward `web_search_20260209`, which D-01 defers.) Capture "curated/reputable-source allow-list" as a deferred idea.
- **D-08: When to reach for the web is system-prompt-driven (AI-SPEC deliverable).** The coach should prefer the user's own data + its training knowledge and reach for web search for genuinely current / research-grounded questions (recent studies, current guidelines), labeling grounded claims via D-04. Exact prompt wording + eval rubric → `/gsd-ai-integration-phase`.
- **D-09: The adversarial citation test extends, not replaces, the Phase 4 guard (RESCH-03).** Phase 4 already proves a "cite a study about X" prompt yields zero `<a>` from free-text author-year/DOI/URL prose. Phase 5 adds the inverse axes: (a) web search **OFF** → "find a study about X" still produces zero links; (b) web search **ON** → only structured `web_search_result_location` blocks become links, and any free-text citation the model writes in prose stays plain. Closes research Pitfall 1 (14–95% citation fabrication) across the full matrix.
- **D-10: Privacy posture for web-enabled queries (resolves the folded redaction todo).** With web search enabled, the model formulates search queries that leave the device — so what the model knows about the user matters more. The meal-note redaction toggle (CHAT-11 / 03-CONTEXT) operates at **per-entry free-text note granularity** (the actual free text a user typed is the PII risk surface), NOT the aggregate numeric kcal/macro line (non-identifying). The existing delimiter-wrapping + `validators.ts` re-validation of model-proposed tool args stays binding. AI-SPEC should add a system-prompt instruction discouraging the model from embedding personal/health specifics into web-search query strings.

### Edit (CRUD) UX (QUAL-03)

- **D-11: Reuse the existing per-page entry form, pre-filled, toggled into edit mode — NOT a modal or separate route.** Each cardio/weight/readings feature page already pairs an entry form with a history list on one surface; `DietService` already does in-place `updateSavedFood`/`updateMeal`. An **Edit** button on each history-list row loads that row into the existing form (edit mode); **Save** updates, **Cancel** restores add mode. This is the established codebase pattern, the least new surface, and the most consistent UX. The form's existing validators run unchanged.
- **D-12: Edits preserve `id` + `createdAt`, refresh `updatedAt`, re-run validation (success-criterion 2).** A typo correction must keep the original identity. New service methods land on `CardioService`, `WeightService`, `ReadingsService` mirroring the `DietService` shape. For the `HealthReading` discriminated union, the planner chooses between a single `updateReading(id, input)` that re-validates per `type` vs. the three-method split (`updateBloodPressure`/`updateBloodGlucose`/`updateKetone`) CONCERNS.md sketches — lean to whichever keeps the discriminated-union type-safety cleanest; either is acceptable. Watch the `updateMeal` stale-`savedFoodName` bug (CONCERNS.md) as a known adjacent hazard, but fixing it is out of this phase's CRUD-parity scope unless trivially adjacent.

### Chat archival + quota-at-95% (QUAL-05, QUAL-02)

- **D-13: Chat archival = lazy-loaded per-conversation archive key, through `StorageService`.** Pre-summary messages move out of the hot `AppData` conversation slice into a separate storage key (e.g. `fitness_tracker_archive_{conversationId}`), loaded on demand only when the user scrolls back. Per-conversation keying (not one giant archive blob) keeps each read bounded. ALL access goes through `StorageService` (the chokepoint invariant from Phase 1 — zero `localStorage.*` outside `storage.service.ts`). This is the cap-pressure relief valve referenced in the locked "LocalStorage stays — quota detection + chat archival in Phase 5 is the relief valve" decision.
- **D-14: The 95% block-write prompt offers archive/delete, NOT export (export is out of scope).** Quota uses `navigator.storage.estimate()` (not a hardcoded 5 MB), with cross-browser error-name matching (`QuotaExceededError` + Firefox `NS_ERROR_DOM_QUOTA_REACHED`). At **≥70%** a soft warning banner shows; at **≥95%** writes are blocked with an honest prompt to free space by **archiving chat history (D-13) or deleting old entries** — no export button. The Phase 1 recovery-banner clipboard-copy affordance (`StorageService.getBackup` → copy JSON to clipboard) is the closest existing "get my data out" escape hatch and MAY be surfaced as a safety valve in the 95% prompt **without** building a full export feature.

### Quality-sweep items handed straight to the planner (well-specified — not gray)

- **D-15:** QUAL-01 (type tightening — zero `any` in production paths; documented exceptions carry `// TODO: type when …`), QUAL-04 (multi-tab `storage`-event listener → "data changed elsewhere — refresh" banner; note `lastModified` is written but never read today — CONCERNS.md), QUAL-06 (CSP meta in `src/index.html`: `default-src 'self'; connect-src 'self' https://api.anthropic.com; script-src 'self'; object-src 'none'; img-src 'self' data:`), QUAL-07 (401 from Anthropic → "rotate / re-enter key" prompt, not a console error — note Electron could route via IPC but in-renderer prompt is acceptable for v2), QUAL-08 (axe-core per-route + manual keyboard + manual contrast across all 8 pages — note Phase 1 deferred `color-contrast` axe rule to this phase per 01-CONTEXT D-13, so contrast is now in-scope), and QUAL-10 (mutation testing on at least one critical service — `validators.ts` or `StorageService`) are executed per their REQUIREMENTS.md acceptance criteria. These have concrete contracts and need no further user decisions; the planner owns sequencing and detail.

### Claude's Discretion
- **System-prompt engineering** — WHEN the coach should reach for web search vs. training knowledge (D-08), how grounded vs. un-grounded research claims are framed in prose, and the web-search-query privacy instruction (D-10): deferred to `/gsd-ai-integration-phase` (AI-SPEC).
- **Visual specifics** — footnote marker + per-message "Sources" list styling (D-03), the grounded-research badge treatment (D-04), live search-progress row (D-05), the Edit-mode form affordance + row Edit button (D-11), and the 70%/95% quota banner + multi-tab banner styling (D-14, QUAL-04): deferred to `/gsd-ui-phase` (UI-SPEC).
- **`updateReading` signature** (single dispatch-on-`type` vs. three methods, D-12), archive key naming + lazy-load trigger (D-13), `webSearchMaxUses` UI range (D-06), and mutation-test tool/target (QUAL-10): researcher/planner's call.
- **Phase-internal sequencing** — whether web-search (A) or the quality sweep (B) is built first, and how QUAL items wave-parallelize (many are file-disjoint): planner's call. A natural split is web-search as one track and the quality sweep as file-disjoint sub-tracks.

### Folded Todos
- **Surface block-action errors in chat-page (IN-01).** Approve/discard/edit failures in `chat-page` currently `console.error` only and are never shown to the user. Folded into **QUAL-09 (UX-consistency / error-state pass)** — surfacing these via the existing `<app-error-state>` pattern is exactly the error-state consistency QUAL-09 mandates across the 8 pages.
- **Clarify meal-note redaction granularity (CR-04).** Resolved as **D-10**: the redaction toggle operates at per-entry free-text note granularity, not the aggregate kcal line. Folded because web-search grounding makes the device-egress privacy posture materially more important this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & milestone context
- `.planning/PROJECT.md` — Core Value ("evidence-graded guidance, nothing leaving the machine except the AI request"); Key Decision "no clinical guardrails — source attribution + confidence labels instead"; Out-of-Scope (no data import/export, no cloud/sync, no IndexedDB) which bounds D-14; constraints (stateless Anthropic calls, key stays local, LocalStorage-only ~5 MB, strict TS).
- `.planning/REQUIREMENTS.md` — RESCH-01/02/03 and QUAL-01..10 are this phase's mandate (verbatim acceptance criteria; the QUAL items are the planner's contract per D-15). CHAT-11 (model tool-arg re-validation through `validators.ts`) carries forward as a binding gate (relevant to D-10).
- `.planning/ROADMAP.md` §"Phase 5: Web Search Grounding + Quality Sweep" — goal, 5 success criteria, and the Phase 4→5 hand-off note ("the loop must handle end_turn / max_tokens / refusal / pause_turn reliably before adding server tools").
- `.planning/STATE.md` — current position; open Phase 5 decisions now resolved here (web-search version → D-01; chat archival → D-13).

### Prior phase context (DIRECT dependency — read in full)
- `.planning/phases/04-agentic-loop-citation-ui/04-CONTEXT.md` — **the foundation this phase upgrades.** D-01/D-05/D-06 (live in-stream tool rendering — D-03/D-05 here extend it), D-07/D-08/D-10 (confidence × source two-axis badges — D-04 here upgrades the source axis), **D-12 (Phase 4 "from research = general knowledge, zero links" — D-04 here is its upgrade path), D-13 (citation-link guard + adversarial test — D-09 here extends it), D-16 (loop handles all terminal stop reasons incl. `pause_turn` — D-02 here depends on it).
- `.planning/phases/04-agentic-loop-citation-ui/04-AI-SPEC.md` — critical-failure-mode rubric (unfinished tool_use must never wedge the loop; tool-arg validation through `validators.ts`); the eval-rubric ingredients `/gsd-ai-integration-phase` extends for web-search grounding (D-08).
- `.planning/phases/04-agentic-loop-citation-ui/04-UI-SPEC.md` — the citation/badge/disclosure rendering contract that D-03/D-04/D-05 extend.
- `.planning/phases/03-ai-memory-tool-plumbing/03-CONTEXT.md` — `AIToolSettings` shape (`enableWebSearch`, `webSearchMaxUses`, `maxAgentTurns`), the `/settings/{ai,profile,memory}` sub-route structure D-06's UI lands in, CHAT-11 delimiter-wrap + redaction toggle (D-10), D-17 SDK transport boundary (the sole `@anthropic-ai/sdk` importer is `anthropic-api.service.ts`).
- `.planning/phases/01-foundations/01-CONTEXT.md` — characterization-test pattern (chat/diet/charts/report page specs are the regression net every Phase 5 change must keep green), axe-core severity gate (D-13 there deferred `color-contrast` to QUAL-08 — now in-scope), `<app-empty-state>`/`<app-error-state>` + `takeUntilDestroyed` patterns every new component reuses, and the `StorageService.getBackup` recovery-banner clipboard affordance referenced by D-14.

### Research outputs (re-read relevant sections; numbering offset — research "Phase 4" == roadmap Phase 5)
- `.planning/research/SUMMARY.md` §"Phase 4: Web Search Grounding + Full Quality Sweep" (lines ~207–242) — web-search tool shape, inline-footnote citation rendering, and the explicit open decisions (web_search version → resolved D-01; `pause_turn` + response-shape verification at implementation time).
- `.planning/research/STACK.md` — `web_search_20250305` (stable) schema/response/pricing, the `web_search_20260209` trade-off table (drives D-01), `@anthropic-ai/sdk ^0.92.0` typed web-search shapes, `axe-core ^4.x` (QUAL-08), `convert` (diet — not this phase).
- `.planning/research/PITFALLS.md` — Pitfall 1 (hallucinated citations 14–95% — drives D-09); any quota / multi-tab / CSP pitfalls relevant to QUAL-02/04/06.
- `.planning/research/ARCHITECTURE.md` — `ChatService` loop + `ToolRegistryService` dispatch shape (D-02 server-tool handling threads through this).

### Codebase analysis
- `.planning/codebase/CONCERNS.md` — **the punch-list QUAL closes.** "Missing update/edit operations in CRUD services" (D-11/D-12), "No CSP" (QUAL-06), "No multi-tab conflict UI / `lastModified` written-never-read" (QUAL-04), 401 handling (QUAL-07), `updateMeal` stale-`savedFoodName` hazard (D-12 note). Read before planning the sweep.
- `.planning/codebase/INTEGRATIONS.md` — Anthropic Messages API integration; SDK transport boundary at `anthropic-api.service.ts` (where the web-search tool + `webSearchMaxUses` wire in).
- `.planning/codebase/TESTING.md` — Karma+Jasmine patterns + `expectNoSeriousA11yViolations` helper (every new component/spec uses it; QUAL-08/10 build on this).
- `.planning/codebase/ARCHITECTURE.md` — locked layered shape (UI → domain services → `StorageService` → LocalStorage; Anthropic API as sole external path — the CSP `connect-src` in QUAL-06 encodes exactly this).
- `.planning/codebase/CONVENTIONS.md` — strict TS / no `any` in production paths (QUAL-01), standalone components, pure-module pattern (mutation-test target candidate `validators.ts`).
- `CLAUDE.md` — Component Pattern (UI only — D-11 keeps logic in services), Validation Pattern (D-12 re-validates), "color is never the only state indicator" (binds D-04/D-05 badge work), Storage-chokepoint "What NOT To Do" (binds D-13/D-14), Schema Migration Checklist (if archival/CRUD needs an `AppData` shape change → V6+ migration with backward-compat test).

### External specs (re-fetch at implementation time)
- [Anthropic web search tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool) — `web_search_20250305` schema, `web_search_tool_result` / `web_search_result_location` response shape, `max_uses`, pricing, error codes, browser-direct support (`anthropic-dangerous-direct-browser-access`). **The primary ref for D-01/D-02/D-03/D-06.**
- [Anthropic tool use docs](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — `server_tool_use` vs client `tool_use`, terminal stop reasons + `pause_turn` resume (D-02).
- [Anthropic search_result content blocks](https://platform.claude.com/docs/en/build-with-claude/search-results) — structured citation blocks that may become links (D-03/D-09).
- [`@anthropic-ai/sdk` npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — typed `WebSearchTool20250305`, `WebSearchToolResultBlock`, citation blocks, `dangerouslyAllowBrowser`.
- [MDN `navigator.storage.estimate()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate) — quota detection for QUAL-02 (D-14).
- [MDN `storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) — cross-tab change detection for QUAL-04.
- [Stryker Mutator for TypeScript/Angular](https://stryker-mutator.io/docs/) — candidate mutation-testing tool for QUAL-10 (researcher confirms Karma-runner compatibility).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`isLinkableCitation` allow-list + `parseClaimSpans` (Phase 4, `chat-message-list.component.ts` + the confidence-attribution parser).** Already enforces "only structured citation blocks become `<a>`". D-03/D-04/D-09 extend this — `web_search_result_location` joins the allow-list; href gated to `https:`. The pure parser pattern (DI-free, fully unit-tested, never fabricates) is the model for any new web-citation parsing.
- **Live in-stream `@switch` block renderer (Phase 4 D-05/D-06).** Renders `tool_use`/`tool_result` as collapsed disclosures with humanized summaries. D-05 reuses it verbatim for `web_search` invocations.
- **`<app-error-state>` standalone component (Phase 1).** The surface for surfacing chat block-action errors (folded IN-01 → QUAL-09), the 401 rotate-key prompt (QUAL-07), and the quota banners (QUAL-02).
- **`StorageService.getBackup(key)` + recovery-banner clipboard-copy (Phase 1).** The "copy all data as JSON" affordance D-14 may reuse as a 95%-quota safety valve without building export.
- **`DietService.updateSavedFood` / `updateMeal` (existing).** The template shape for the new `CardioService`/`WeightService`/`ReadingsService` update methods (D-11/D-12) — preserve `id`+`createdAt`, refresh `updatedAt`, re-validate.
- **Phase 1 characterization specs (diet/chat/charts/report page) + `expectNoSeriousA11yViolations`.** The regression net every Phase 5 change keeps green; QUAL-08/10 extend the a11y + mutation surface.
- **`AIToolSettings` already carries `enableWebSearch` (false) + `webSearchMaxUses` (3).** No model change needed for the web-search flags; D-06 just surfaces them in the `/settings/ai` UI.

### Established Patterns
- **Storage chokepoint (Phase 1, tree-wide grep gate):** zero `localStorage.*` outside `storage.service.ts`. Binds D-13 (archive keys) and QUAL-02/04 — all new storage access routes through `StorageService`.
- **Pattern 2 Form A subscription cleanup:** every feature component declares `private destroyRef = inject(DestroyRef)` and pipes `.subscribe(...)` through `takeUntilDestroyed(this.destroyRef)`. New edit-mode wiring (D-11) and the multi-tab listener (QUAL-04) follow it.
- **D-17 SDK transport boundary:** `anthropic-api.service.ts` is the sole `@anthropic-ai/sdk` importer; the web-search tool definition + `max_uses` map to SDK params here, never leaking SDK types into models/services (D-02).
- **Schema-migration discipline (FOUND-07):** any `AppData` shape change (archival index, if needed) lands a typed `migrateVxToVy` with a backward-compat fixture test.
- **`isWriteProposal` allow-list (Phase 4):** web search defaults to non-write — it must NOT be added to `WRITE_PROPOSAL_TOOLS` (D-02).

### Integration Points
- **`anthropic-api.service.ts`** — web-search tool + `max_uses` enter `tools[]`/`MessageCreateParams` here; CSP `connect-src https://api.anthropic.com` (QUAL-06) is the policy this path must satisfy.
- **`runAgenticLoop` (`chat.service.ts`, Plan 04-04)** — must render `server_tool_use`/`web_search_tool_result` turns and honor `pause_turn` (D-02).
- **`chat-message-list.component.ts`** — footnote + Sources-list + grounded-badge rendering (D-03/D-04/D-05).
- **`/settings/ai` sub-page (Phase 3)** — `webSearchMaxUses` + `enableWebSearch` toggle UI (D-06).
- **`app.component.ts`** — host for the multi-tab "refresh" banner (QUAL-04) and the 70%/95% quota banners (QUAL-02), alongside the existing recovery banner.
- **`cardio/weight/readings` feature pages** — Edit button per history row + edit-mode form toggle (D-11).
- **`src/index.html`** — CSP meta tag (QUAL-06).

</code_context>

<specifics>
## Specific Ideas

- The user's standing directive (Phase 4 and Phase 5): **maximize user experience — quality of advice + transparency — following best practices and established codebase patterns.** Every Phase 5 decision above is anchored to it.
- Web search is **off by default** and must stay a deliberate opt-in (privacy posture: nothing leaves the machine except the user-initiated AI request; web search widens what the model may send outward — see D-10).
- The grounded-citation rendering must leave the Phase 4 un-grounded "from research" framing intact for the no-web-search path — both must coexist visibly distinct (D-04).

</specifics>

<deferred>
## Deferred Ideas

- **`web_search_20260209` (dynamic domain filtering).** Requires `code_execution` enabled; revisit only if web-search token spend becomes a problem (D-01).
- **Curated / reputable-source domain allow-list.** Deliberately not shipped (D-07) — revisit if the coach surfaces low-quality sources in practice.
- **Full data import/export (CSV / Apple Health / backup-restore).** Out of scope per PROJECT.md; the 95% quota prompt offers archive/delete + the clipboard JSON safety valve instead (D-14). A future milestone owns real export.
- **IndexedDB migration.** LocalStorage stays this milestone; archival (D-13) + quota detection (D-14) are the relief valve.
- **Electron-update artifact signing/notarization (CONCERNS.md).** Real security gap but a future-milestone item, not v2 quality-sweep scope.
- **`updateMeal` stale-`savedFoodName` after food rename (CONCERNS.md).** Adjacent to CRUD work but not part of QUAL-03's cardio/weight/readings parity; fix only if trivially adjacent, else defer.

### Reviewed Todos (not folded)
- **Complete Phase 4 visual UAT (04-HUMAN-UAT.md, 3 browser-only items).** Reviewed and **not folded** — this is Phase 4 *verification*, not Phase 5 *scope*. It belongs to `/gsd-verify-work 4`, kept as its own task so Phase 5's boundary stays clean.

</deferred>

---

*Phase: 5-web-search-grounding-quality-sweep*
*Context gathered: 2026-05-31*
