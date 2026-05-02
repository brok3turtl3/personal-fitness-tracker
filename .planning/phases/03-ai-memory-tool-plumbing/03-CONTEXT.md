# Phase 3: AI Memory + Tool Plumbing — Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Land all the AI infrastructure the agentic loop will need — without changing what the user sees today. Phase 3 ships:

1. **V4→V5 schema migration** — adds `AppData.memoryFiles`, `AppData.userProfile`, `AppData.aiToolSettings`; lifts `ChatMessage.content: string` to `ChatMessage.blocks: ChatBlock[]` and **fully removes** `content` from the V5 shape (no transitional shim). Rides on FOUND-07's typed-legacy interfaces + backup-before-migrate + recovery banner already in place.
2. **MemoryStoreService + MemoryToolExecutor** — typed wrapper over `AppData.memoryFiles: Record<string, string>` implementing all 6 memory tool commands per Anthropic `memory_20250818` spec; path validation (`/memories` prefix required, `..` rejected).
3. **UserProfile model + service** — new `models/user-profile.model.ts` (sectioned free-form) and `services/user-profile.service.ts` (@Injectable get/save/update + per-section validation).
4. **ToolRegistryService** — single dispatch point; map of tool name → executor. Registered with `MemoryToolExecutor`; `DataQueryToolExecutor` slots in during Phase 4.
5. **/settings restructured into sub-routes** — `/settings/profile`, `/settings/ai`, `/settings/memory` under a new `settings-shell.component.ts`. Existing `settings-page.component.ts` becomes `settings-ai.component.ts`.
6. **ChatBlock plumbing** — discriminated union (text + tool_use + tool_result) replaces the flat `content: string`; `chat-block-serializer.ts` strips extension fields when writing back to the Anthropic API.
7. **@anthropic-ai/sdk adopted at the transport layer** — replaces the hand-rolled fetch wrapper in `anthropic-api.service.ts`. SDK types own the wire; our `ChatBlock` model owns persistence.
8. **Prompt-injection delimiter pattern** — `<user_profile_*>...</user_profile_*>` for profile sections, `<user_meal_note>...</user_meal_note>` for meal notes (etc.) inside the system prompt. Tool-call argument re-validation slot exists in the registry (no real calls fire in Phase 3 but the gate is wired).
9. **Confirm-before-write scaffold** — pending pill rendered in the chat message stream from `tool_use` blocks with `status: 'pending' | 'approved' | 'discarded' | 'edited'`. Dormant in Phase 3 (no agentic loop produces real proposals); spec'd via Karma + a dev-only seed button visible only on localhost.

**Hard scope rule:** No agentic loop. No `tools[]` in API requests. No `query_*` tools. No web search. Single-shot chat behavior is preserved (SC5). Phase 4 activates the loop and wires `tools[]` into requests.

**File-disjoint with Phase 2** — Phase 3 touches: `features/chat/**`, `features/settings/**`, `services/chat.service.ts`, `services/anthropic-api.service.ts`, `services/fitness-context.service.ts`, new memory/profile/tool-registry services, `models/ai-chat.model.ts`, `models/user-profile.model.ts` (new), `models/app-data.model.ts`, `migrateV4ToV5`. **V4→V5 must merge to main before Phase 2's V5→V6 work targets the V5 baseline.**

</domain>

<decisions>
## Implementation Decisions

### UserProfile shape & content (CHAT-04)

- **D-01: Sectioned free-form text.** `UserProfile = { goals: string; preferences: string; dietaryConstraints: string; trainingHistory: string; updatedAt: string }`. Each field is multi-line markdown the user writes themselves. AI reads it verbatim in the system prompt. Editor is 4 textareas. No structured-item arrays, no enums. Matches the "AI's notebook for facts the USER asserts" framing.
- **D-02: Empty defaults, no placeholders or templates.** All four fields default to `''`. Editor shows empty textareas with subtle inline placeholder hints only (e.g. "e.g., lose 15 lbs by July, train for a 10K..."). The system-prompt UserProfile section is omitted entirely when all four are empty — don't pollute the prompt with "no profile yet". V4→V5 migration also defaults to empty.
- **D-03: AI sees a wrapped section before fitness data.** `FitnessContextService.buildSystemPrompt()` prepends a `## User Profile` block before the existing fitness snapshot. Each non-empty section is wrapped in untrusted-data delimiters: `<user_profile_goals>...</user_profile_goals>`, `<user_profile_preferences>...</user_profile_preferences>`, etc. Same delimiter pattern that meal notes / cardio notes / weight notes get for prompt-injection defense (CHAT-11). Empty sections omitted from the prompt entirely.
- **D-04: New files for profile.** `models/user-profile.model.ts` (UserProfile interface + DEFAULT_USER_PROFILE constant), `services/user-profile.service.ts` (@Injectable get/save/update through StorageService + validation). Barrel-exported from `models/index.ts`. Mirrors the one-domain-per-service pattern (cardio.service.ts, weight.service.ts, etc.).
- **D-05: Per-section cap is 4 KB, profile total ~16 KB.** `validateUserProfile` enforces 4096 chars per section. Inline editor errors on save. Keeps the system prompt bounded and prevents AppData blowup. Reasonable for "a paragraph or two of context per category."

### Settings page expansion (CHAT-12)

- **D-06: Sub-routes under a /settings shell.** New routes: `/settings/profile`, `/settings/ai`, `/settings/memory`. New files: `settings-shell.component.ts` (renders side-rail nav + `<router-outlet>`), `settings-profile.component.ts`, `settings-ai.component.ts` (rename of existing settings-page.component.ts), `settings-memory.component.ts`. Each new page targets ≤ ~200 lines. Cleanest separation; matches how the AI surface grows in Phase 4/5; avoids ballooning a single file past 700 lines.
- **D-07: Default redirect is `/settings` → `/settings/ai`.** Preserves existing daily muscle memory — the API key + model + max-tokens fields users already use are still where they land. Profile and Memory are reached via the side-rail nav. Routes registered in `app.routes.ts` with `pathMatch: 'full'` redirect for the bare segment.
- **D-08: Memory inspector is a path-tree with inline preview + edit/delete.** `memoryFiles` keys are paths under `/memories/` (e.g. `/memories/preferences.md`, `/memories/training/2026-04.md`). Render as a path-tree; click a node to expand inline preview (read-only by default). "Edit" button swaps content for a textarea + Save; "Delete" uses `window.confirm` matching the existing native-confirm pattern in cardio/weight/readings/diet pages.
- **D-09: AI-context redaction toggles ship in /settings/ai now.** New "What the AI sees" subsection with toggles: `redactHealthReadings` (omit BP/glucose/ketones from system prompt), `redactWeightEntries`, `redactMealNotes` (still send macros, omit free-text notes). `FitnessContextService` respects them. Persisted on `aiToolSettings` (researcher to confirm whether it's a sibling `aiPrivacySettings` block or merged into `aiToolSettings` for parsimony). Defaults: all redaction **off** (single sophisticated user opted-in to seeing everything; the toggles exist for the next time the data set grows or for screen-sharing situations). Closes Pitfall 11 data-minimization concern in Phase 3 instead of Phase 5.

### Confirm-before-write UX scaffold (CHAT-03 + CHAT-04)

- **D-10: Pending pill in the message stream.** Each AI proposal (memory write or profile update) renders as its own card in the chat scroll, between the AI's text response and the next user input: `[ AI wants to remember: <text>. (Save) (Discard) (Edit) ]` for memory; `[ AI proposes profile update to <section>: <diff>. (Save) (Discard) (Edit) ]` for profile. Stays in conversation flow; doesn't block typing; one pill per proposal (multiples render in stream order). Matches "the AI's reasoning is attached to the message that produced it" — clear context for the user's decision.
- **D-11: State lives on the `tool_use` block with a `status` field.** `ToolUseBlock` is a SUPERSET of Anthropic's tool_use shape: it adds `status: 'pending' | 'approved' | 'discarded' | 'edited'` and `editedFromText?: string`. Pending blocks render with action buttons; resolved blocks render as a static badge ("saved 2026-05-03 14:22"). Status survives reload; full audit trail per conversation. **Implication:** writing back to the Anthropic API requires stripping the extension fields — see D-15.
- **D-12: Phase 3 verification = Karma spec + dev-only seed button.** A Karma component spec on `chat-message-list` renders a synthetic `ChatMessage` with a pending tool_use block and asserts the Save/Discard/Edit buttons render and click handlers fire. PLUS: a dev-only "Seed pending proposal" button visible only when `location.hostname === 'localhost'` (or behind an `aiToolSettings.devToolsEnabled` flag). Lets the operator manually flip the scaffold on for visual verification. Removed/gated in Phase 4 once the agentic loop produces real proposals. Real users see SC5 single-shot behavior unchanged.
- **D-13: Edit = inline swap to textarea, status='edited' preserves the original.** Clicking "Edit" on a pending pill swaps its rendered content for a textarea pre-filled with the proposal text. "Save" applies the edited text and marks `status='edited'` with the original AI text in `editedFromText`. "Cancel" restores the pending state. Stays in chat scroll; no nav disruption.

### ChatBlock model breadth + migration (CHAT-01)

- **D-14: Block kinds for Phase 3 — text + tool_use + tool_result.** `ChatBlock = TextBlock | ToolUseBlock | ToolResultBlock`. `TextBlock = { type: 'text'; text: string }`. `ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown; status: 'pending' | 'approved' | 'discarded' | 'edited'; editedFromText?: string }`. `ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string; isError?: boolean }`. Server tool blocks (`server_tool_use`, `web_search_tool_result`) deferred to Phase 5. Lean schema; ready for Phase 4 client-tool dispatch; no premature modeling of Phase 5 surface.
- **D-15: Full cut-over for ChatMessage.content.** V4→V5 migration lifts every existing `ChatMessage.content: string` into `ChatMessage.blocks: [{ type: 'text', text: content }]` AND **deletes** the `content` field from the V5 shape. `ChatMessage` interface no longer has `content`. Every reader is updated:
  - `chat.service.ts buildApiMessages` — derive text from blocks
  - `chat-message-list` template — render blocks instead of content
  - `maybeSummarize` extractor — reduce blocks to text for summarization input
  - any spec that asserts on `.content` — updated to assert on `.blocks`
  - Per CLAUDE.md "Avoid backwards-compatibility hacks". Cleaner type discipline; one less field to keep in sync; tightest contract. Diverges from research-recommended transitional `content?` shim.
- **D-16: Dedicated `chat-block-serializer.ts` in `services/`.** New pure module exporting `toAnthropicContent(blocks: ChatBlock[]): AnthropicContentBlock[]`. Strips `status` and `editedFromText`. Drops blocks with `status='discarded'`. Renders `status='pending'` tool_use blocks as plain text (e.g. `[user has not yet responded to AI proposal: <text>]`) so the API never sees an unfinished tool_use loop. Phase 3 ships this fully tested even though it rarely runs in production (no `tools[]` in requests yet); Phase 4 leans on it heavily. Mirrors `validators.ts` as a pure-module pattern.
- **D-17: Adopt `@anthropic-ai/sdk` at the transport layer NOW (Phase 3).** Replace the hand-rolled `fetch` wrapper in `anthropic-api.service.ts` with the official SDK using `dangerouslyAllowBrowser: true`. SDK owns: HTTP transport, typed request/response shapes (`Message`, `MessageParam`, `ContentBlock`, `Usage`, `MessagesCountTokensRequest`), `messages.countTokens`, retry/backoff. **Boundary mapping:** SDK types live at the transport layer (`anthropic-api.service.ts`); our `ChatBlock` model owns persistence. `chat-block-serializer.ts` is the bridge. SC5 preserved by keeping `ChatService` orchestration logic identical — SDK is just the transport. Smaller diff in Phase 4 when the agentic loop drops onto already-typed surfaces.

### Claude's Discretion
- **Memory tool implementation details:** Confirm `memory_20250818` canonical return strings against current Anthropic docs at planning time. Path validator implementation (regex vs. parsed-segment check) — researcher's call. Memory key naming convention beyond `/memories/` prefix.
- **Tree component for memory inspector:** New small component or inline template in `settings-memory.component.ts` — researcher's call based on complexity.
- **`aiToolSettings` vs. `aiPrivacySettings` split:** Whether redaction toggles live in `aiToolSettings` or a sibling `aiPrivacySettings` field. Researcher to recommend based on whether toggles are read by the same code paths.
- **Side-rail nav implementation in `settings-shell.component.ts`:** layout/styling — match the project's "minimal custom CSS, semantic HTML" voice.
- **Specific copy strings** for placeholder hints, redaction toggle labels, pending pill text, dev seed-button label.
- **Dev-flag mechanism for the seed button:** `location.hostname === 'localhost'` vs. `aiToolSettings.devToolsEnabled` vs. an Angular env file — researcher/planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — milestone scope, key decisions, constraints
- `.planning/REQUIREMENTS.md` — 42 v2 requirements; CHAT-01, CHAT-03, CHAT-04, CHAT-11, CHAT-12 are this phase's mandate
- `.planning/ROADMAP.md` §"Phase 3: AI Memory + Tool Plumbing" — goal, success criteria, dependencies
- `.planning/STATE.md` §"Decisions Locked In" + §"Active Decisions Pending" — schema-migration ordering and other non-negotiables

### Prior phase context
- `.planning/phases/01-foundations/01-CONTEXT.md` — FOUND-07 typed-legacy schema-migration discipline, recovery banner UX, characterization-test pattern, axe-core severity gate (D-08), empty/error-state pattern that settings sub-pages should reuse

### Research outputs
- `.planning/research/SUMMARY.md` §"Phase 2B: AI Memory Layer + Tool Use Plumbing" — agreed deliverables, schema-migration plan
- `.planning/research/PITFALLS.md` — Pitfalls 1, 2, 3, 4, 8, 9, 10, 11 most relevant; Pitfall 8 (prompt injection) and Pitfall 11 (API key + data minimization) shape the delimiter pattern and redaction toggles
- `.planning/research/ARCHITECTURE.md` — schema-migration plan (V4→V5 specifics), component boundaries, layered shape
- `.planning/research/STACK.md` — `@anthropic-ai/sdk ^0.92.0` is the net-additive dep for this phase

### Codebase analysis
- `.planning/codebase/ARCHITECTURE.md` — locked layered shape: UI → Domain services → StorageService → LocalStorage; ChatService orchestration pattern at lines 145–151
- `.planning/codebase/INTEGRATIONS.md` — Anthropic API integration pattern (current hand-rolled fetch wrapper at `anthropic-api.service.ts:53`)
- `.planning/codebase/STACK.md` — `@anthropic-ai/sdk` is NOT yet installed; researcher confirms version compatibility with Angular 18 + TS 5.5 strict
- `.planning/codebase/CONCERNS.md` — `text.length / 4` token estimator drift, swallowed storage errors (now closed by Phase 1), 5 MB hardcode (Phase 5)
- `.planning/codebase/CONVENTIONS.md` — strict TS, standalone components, commit format, `crypto.randomUUID()` rule (now via `shared/id.ts`)
- `.planning/codebase/TESTING.md` — Karma+Jasmine spec patterns, `expectNoSeriousA11yViolations` axe helper from Plan 01-08
- `CLAUDE.md` — "Storage Layer", "Service Pattern", "Validation Pattern", "Component Pattern", "What NOT To Do" all binding; "Avoid backwards-compatibility hacks" governs D-15

### External specs (re-fetch at implementation time)
- [Anthropic memory tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) — `memory_20250818` 6 commands, canonical return strings, client-execution confirmation, `/memories` path validation
- [Anthropic tool use docs](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — `stop_reason: 'tool_use'`, ToolUseBlock + ToolResultBlock shapes, strict tool definitions
- [`@anthropic-ai/sdk` npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — v0.92.0, `dangerouslyAllowBrowser`, `messages.countTokens`, typed `Message`/`MessageParam`/`ContentBlock`
- [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — relevant for Phase 4 system-prompt cache; Phase 3 only needs to ensure the system-prompt structure won't block caching later
- [OWASP LLM01:2025 prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) — instruction-data boundary pattern for the delimiter wrapping (CHAT-11)

### Existing code touchpoints (line-anchored where useful)
- `src/app/services/chat.service.ts:178-212` — `buildApiMessages` (current sliding-window builder); will adapt to derive text from `blocks` per D-15
- `src/app/services/chat.service.ts:214-283` — `maybeSummarize`; same content→blocks adaptation
- `src/app/services/anthropic-api.service.ts:1-100` — hand-rolled fetch wrapper to be replaced by SDK transport (D-17)
- `src/app/services/fitness-context.service.ts:16-33` — `buildSystemPrompt`; gets the UserProfile prepend (D-03) and the prompt-injection delimiter pattern (CHAT-11)
- `src/app/features/chat/chat-message-list.component.ts` — block-aware rendering for D-15 + the pending pill UI for D-10
- `src/app/features/settings/settings-page.component.ts` (315 lines) — renamed/migrated to `settings-ai.component.ts` per D-06
- `src/app/services/storage.service.ts:234-321` — migration chain; new `migrateV4ToV5` lands here per FOUND-07's typed-legacy harness
- `src/app/models/app-data.model.ts:41` — `CURRENT_SCHEMA_VERSION = 4` → bump to 5
- `src/app/models/ai-chat.model.ts:1-33` — `ChatMessage`/`ChatConversation`/`AISettings` updates (D-15) + new `ChatBlock` union (D-14) + `AIToolSettings` interface
- `src/app/services/legacy-schemas.ts` (Phase 1) — extend with `LegacyAppDataV4` for the V5 migration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 1 typed-legacy migration harness** (`src/app/services/legacy-schemas.ts` + `migrations/fixtures/`) — V4→V5 lands as another step in the existing chain; fixture pattern is `v4.json` → `v5-expected.json` plus malformed-input matrix. CONCERNS.md "Migration error path not tested" stays closed.
- **Phase 1 recovery banner** (`src/app/shared/recovery-banner.component.ts`) — V4→V5 failures surface through the same MIGRATION_FAILED path; no new error UX needed.
- **Phase 1 empty/error-state components** (`src/app/shared/empty-state.component.ts`, `error-state.component.ts`) — every new settings sub-page reuses them. Memory inspector empty state (no files yet) → `<app-empty-state>`. Storage failures on profile save → `<app-error-state>`.
- **Phase 1 axe-core helper** (`src/app/shared/a11y-test-helpers.ts`) — every new component spec asserts `expectNoSeriousA11yViolations(fixture)` after representative render. Plan 01-08's per-spec inline pattern is the model.
- **Phase 1 chat-page characterization spec** (`src/app/features/chat/chat-page.component.spec.ts`) — the regression net for the V4→V5 ChatMessage.content→blocks cut-over. Must keep passing.
- **Phase 1 shared `id.ts`** (`src/app/shared/id.ts`) — `generateId()` for new tool_use block IDs, memory file IDs, etc.
- **Phase 1 takeUntilDestroyed pattern** — every new component (`settings-shell`, `settings-profile`, `settings-ai`, `settings-memory`) declares `private destroyRef = inject(DestroyRef)` and pipes every `.subscribe(...)` through `takeUntilDestroyed(this.destroyRef)`.
- **`services/cardio.service.spec.ts:14-30`** — service-spec scaffold for the new `UserProfileService`, `MemoryStoreService`, `MemoryToolExecutor`, `ToolRegistryService`, `chat-block-serializer` specs.

### Established Patterns
- **Standalone components only.** Every new settings sub-page goes in `imports: [...]`, never `declarations`.
- **`@Injectable({ providedIn: 'root' })` services with constructor-injected `StorageService`.** UserProfileService, MemoryStoreService follow this.
- **Pure modules (no DI) for stateless logic.** `chat-block-serializer.ts` mirrors `validators.ts`.
- **`Observable<T>` returns from services.** UserProfileService, MemoryStoreService — even synchronous-feeling reads return `of(value)` for backend-future-proofing.
- **`StorageService` is the sole LocalStorage chokepoint.** memoryFiles, userProfile, aiToolSettings all flow through `getData()` / `saveData()` — never direct `localStorage.*` (Phase 1 chokepoint gate enforces this tree-wide).
- **`crypto.randomUUID()` via `shared/id.ts`** for any new IDs (block IDs, conversation IDs, tool_use IDs).
- **Native `window.confirm` for destructive actions.** Memory file delete matches the existing pattern in cardio/weight/readings/diet pages.
- **Hash-based routing stays.** New sub-routes register with `loadComponent`; `withHashLocation()` already configured in `app.config.ts`.
- **Strict TS, no `any` in production paths** — applies to ChatBlock union, tool input typing, SDK adapters.

### Integration Points
- **`StorageService.initialize()`** (`storage.service.ts`) — new `migrateV4ToV5()` appended to the migrate chain. Must be idempotent; defaults `memoryFiles = {}`, `userProfile = DEFAULT_USER_PROFILE`, `aiToolSettings = DEFAULT_AI_TOOL_SETTINGS`; lifts `messages[].content` to `messages[].blocks` and removes `content`.
- **`anthropic-api.service.ts`** — full rewrite using `@anthropic-ai/sdk` Anthropic class. `sendMessage()` returns SDK-typed `Message`. Service surface stays as `Observable<...>` (wrap SDK promises with `from(...)`). Existing `AnthropicApiError` class either retained as a wrapper around SDK errors or replaced by SDK's own `APIError` taxonomy — researcher's call.
- **`fitness-context.service.ts buildSystemPrompt`** — prepends `## User Profile` block per D-03; wraps user-entered fields (meal notes, cardio notes, weight notes, reading notes) in delimiters per CHAT-11. Also gates each section behind redaction toggles per D-09.
- **`chat.service.ts buildApiMessages`** (lines 178–212) — adapts to derive text/blocks via `chat-block-serializer.toAnthropicContent`. Sliding window logic (MESSAGE_WINDOW_SIZE=20, TOKEN_WINDOW_SIZE=8000) preserved unchanged.
- **`chat.service.ts maybeSummarize`** (lines 214–283) — adapts to extract text from blocks for the summarization prompt.
- **`chat-message-list.component.ts`** — renders blocks via `@switch (block.type)`. Text → existing markdown render. tool_use → pending pill (D-10) with edit/save/discard handlers and `status` switch.
- **`app.routes.ts`** — `/settings` route migrates from a single `loadComponent` to a child-route shell: parent loads `settings-shell.component.ts`, children load profile/ai/memory components; `''` redirects to `'ai'` per D-07.
- **`shared/nav.component.ts`** — no change to top-level nav; the side-rail nav for settings sub-pages lives in `settings-shell.component.ts`, not nav.
- **`models/app-data.model.ts`** — `CURRENT_SCHEMA_VERSION` bumps to 5; `AppData` gains `memoryFiles: Record<string, string>`, `userProfile: UserProfile`, `aiToolSettings: AIToolSettings`; `createEmptyAppData()` initializes all three to defaults.
- **`models/ai-chat.model.ts`** — `ChatMessage` loses `content: string`, gains `blocks: ChatBlock[]`. New `ChatBlock` union exported. New `AIToolSettings` interface (defaults `enableDataQueryTools: true, enableMemoryTool: true, enableWebSearch: false, webSearchMaxUses: 3, maxAgentTurns: 10` per research; redaction defaults all false per D-09).

</code_context>

<specifics>
## Specific Ideas

- **`ToolUseBlock.status` is the persistence-only field that distinguishes our model from Anthropic's wire format.** It MUST be stripped by `chat-block-serializer.toAnthropicContent` before the block goes into a Messages API request. Phase 4 will lean on this; Phase 3 ships the serializer fully tested even though `tools[]` is never sent in Phase 3 requests.
- **`status='pending'` blocks must NOT be serialized as tool_use blocks to the API.** D-16: render them as plain text `[user has not yet responded to AI proposal: <text>]` so the API never sees an unfinished tool_use loop. This is critical for Phase 4 when an unresolved proposal could otherwise wedge the agentic loop.
- **The dev-only seed button (D-12) is the manual-test affordance.** It must be removed (or gated behind a flag never enabled in production) before Phase 4 ships real proposals — otherwise it could accidentally inject fake proposals into a real conversation.
- **UserProfile system-prompt section is omitted entirely when all four fields are empty.** Don't write `## User Profile\n\n(none yet)` — the AI gets a slightly cleaner prompt and the cache_control benefit (Phase 4) gets a slightly more stable prefix.
- **Redaction toggles default OFF (D-09).** Single sophisticated user opted in to seeing everything. Toggles exist for the next time the dataset grows or for screen-sharing. This is a reversal of the typical "default-deny privacy" stance — documented here intentionally.
- **`@anthropic-ai/sdk` adoption is transport-only.** Our `ChatBlock` model owns persistence; SDK types own the wire. `chat-block-serializer.ts` is the explicit bridge. Don't let SDK types leak into `models/` or `services/storage.service.ts`.
- **V4→V5 migration must lift ChatMessage.content to blocks BEFORE removing content.** A bad migration that drops content first and fails on the lift loses every message. The migration runs inside the Phase 1 backup-before-migrate try/catch, but the operation order matters: build new blocks array, validate, swap, remove. Test the malformed-input matrix per FOUND-07 (null content, missing content, content with control chars).
- **Memory inspector tree view assumes `/memories/` paths.** Memory tool keys MUST be validated to start with `/memories/` (and reject `..`) — the path validator gates the tree view's correctness as much as it gates the security model. Single source of validation in `MemoryToolExecutor`.
- **Settings sub-route paths chosen for stability.** `/settings/profile`, `/settings/ai`, `/settings/memory` — short, semantic, future-friendly. Don't name them after Phase 3 internals (`/settings/tools` would suggest the agentic loop is active in Phase 3, which it isn't).

</specifics>

<deferred>
## Deferred Ideas

- **Multiple-pending-proposal queue/parallelism behavior** — Phase 4 design decision once the agentic loop actually emits >1 proposal per turn. Phase 3 scaffold renders multiple pills in stream order; no queueing logic yet.
- **Undo-after-approve window** — not needed for the dormant scaffold; revisit in Phase 4 when real proposals fire.
- **AI-side prompt instructions for WHEN to propose updates** — system-prompt engineering decision belongs in `gsd-ai-integration-phase` territory, not here.
- **Onboarding banner for empty UserProfile** — rejected in favor of placeholder hints in textareas. If post-Phase-4 usage shows users not discovering the profile, revisit.
- **Single redaction toggle vs. per-domain toggles** — rejected single-toggle in favor of three (health / weight / meal-notes); revisit if usage shows the granularity is unused.
- **Sub-routes with index landing card** — rejected in favor of `/settings` redirect to `/settings/ai` for muscle-memory continuity.
- **Pending pill as a modal or toast** — rejected; in-stream pill is the chosen pattern. Revisit only if Phase 4 user testing shows missed proposals.
- **Onboarding tour for the new settings layout** — out of scope. Phase 5 QUAL-09 UX consistency review can revisit if needed.
- **Backup/export of memoryFiles** — out of scope; deferred IO milestone.
- **Memory file versioning / git-style history** — overkill. The audit trail comes from tool_use block status history per conversation.
- **Cross-conversation memory diff view** — out of scope.
- **`settings-shell` left-rail nav as a globally-reusable nav-rail component** — premature abstraction; build inline first, extract if Phase 5 needs it elsewhere.

</deferred>

---

*Phase: 3-AI-Memory-Tool-Plumbing*
*Context gathered: 2026-05-02*
