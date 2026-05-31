---
phase: 05-web-search-grounding-quality-sweep
plan: 05
subsystem: api
tags: [anthropic-sdk, web-search, web_search_20250305, server-tool, agentic-loop, pause_turn, system-prompt, D-17]

# Dependency graph
requires:
  - phase: 05-02
    provides: web-citation-parser (toGroundedCitations/toSourcesList), ChatBlock server-tool/citation variants, serializer pass-through of server-tool blocks verbatim
  - phase: 05-04
    provides: prior chat.service.ts edits (serialized shared-file ownership)
  - phase: 04-agentic-loop-citation-ui
    provides: runAgenticLoop, pause_turn defensive branch (D-16), tool dispatch filter, byte-stable cached system prefix
provides:
  - "buildWebSearchTool(settings) at the D-17 transport boundary — opt-in web_search_20250305 def with max_uses cap"
  - "Render-only server-tool loop handling: web_search_started/results/error live events, never dispatched, no tool_result posted back"
  - "Live pause_turn resume for long web-search turns (turn-safe, no maxAgentTurns decrement)"
  - "System-prompt web-search steering: D-08 when-to-search, D-04 grounded-vs-un-grounded, D-10 query-string privacy (in the byte-stable cached prefix)"
  - "web_search confirmed read-only (isWriteProposal false) and never a dispatchable executor"
affects: [05-08-citation-renderer, 05-settings-web-search-toggle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Net-zero deps: web_search_20250305 is a request parameter, not a package"
    - "Server-tool render-only loop: separate filter from the b.type==='tool_use' client-dispatch filter"
    - "Opt-in egress surface built only at the D-17 boundary; OFF by default"

key-files:
  created: []
  modified:
    - src/app/services/anthropic-api.service.ts
    - src/app/services/anthropic-api.service.spec.ts
    - src/app/models/ai-chat.model.ts
    - src/app/services/chat.service.ts
    - src/app/services/chat.service.spec.ts
    - src/app/services/tool-registry.service.ts
    - src/app/services/tool-registry.service.spec.ts
    - src/app/services/fitness-context.service.ts
    - src/app/services/fitness-context.service.spec.ts

key-decisions:
  - "Citation narrowing stays on the persist path (serializer 05-02 + web-citation-parser) — no extra narrowing method added to anthropic-api.service; documented WebSearchSdkSurface type alias instead to keep the response-side SDK types type-checked at the D-17 boundary"
  - "Trimmed the WEB_SEARCH_INSTRUCTIONS text (~150 chars) to keep the cached prefix under the existing ~2500-char slim-header budget rather than relaxing the budget assertion"
  - "tools[] retyped unknown[] in chat.service so the SDK-typed web-search def can be appended without an SDK import (D-17 type-only boundary held)"

patterns-established:
  - "Render-only server-tool events: emit live ChatTurnEvents from a SEPARATE filter; never widen the client-dispatch filter"
  - "Opt-in tool defs built at the transport boundary return null when disabled, so the caller appends nothing"

requirements-completed: [RESCH-01]

# Metrics
duration: 22min
completed: 2026-05-31
---

# Phase 5 Plan 05: Web Search Server-Tool Loop Wiring Summary

**Opt-in `web_search_20250305` wired into the agentic loop: built with the `webSearchMaxUses` cap at the D-17 boundary, rendered (never dispatched) via live `web_search_started/results/error` events, pause_turn-safe, error-resilient on the HTTP-200 error union, and steered by the when-to-search + query-privacy system prompt — RESCH-01 complete at the service layer.**

## Performance

- **Duration:** ~22 min
- **Completed:** 2026-05-31
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- `buildWebSearchTool(settings)` at the sole SDK importer (`anthropic-api.service.ts`): returns `null` when `enableWebSearch` is false (OFF by default, D-10), else `{ type:'web_search_20250305', name:'web_search', max_uses: webSearchMaxUses ?? 3 }` (D-01/D-06); `allowed_domains`/`blocked_domains`/`user_location` left unset (D-07).
- Three SDK-free `ChatTurnEvent` variants (`web_search_started`/`web_search_results`/`web_search_error`) added to `ai-chat.model.ts`.
- `chat.service.runAgenticLoop`: appends the opt-in tool def to the same `tools[]` (counted by `countTokens`), and a SEPARATE render-only filter emits live web-search events for inline `server_tool_use`/`web_search_tool_result` blocks — zero dispatch, zero `tool_result` posted back; the HTTP-200 error union is narrowed to an honest `web_search_error` with no retry/no throw; the `pause_turn` branch is now live (paused turn re-sent unmodified, no `maxAgentTurns` decrement).
- `tool-registry.service.ts`: documented + asserted `web_search` is read-only (`isWriteProposal` false) and never a dispatchable executor.
- `fitness-context.service.ts`: added the D-08/D-04/D-10 web-search steering instructions (with two PII-free/grounded few-shot exemplars) to the byte-stable cached prefix; web search stays OFF by default; `redactMealNotes` per-note gating unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: buildWebSearchTool + tools[] assembly + ChatTurnEvent variants** - `ebb1bda` (feat)
2. **Task 2: Render-only server-tool loop handling + pause_turn live + registry read-only guard** - `5ec6c54` (feat)
3. **Task 3: System-prompt when-to-search (D-08) + grounded framing (D-04) + query-privacy (D-10)** - `981c0f0` (feat)

## Files Created/Modified
- `src/app/services/anthropic-api.service.ts` - `buildWebSearchTool` + `WebSearchSdkSurface` type alias documenting the response-side SDK web-search types this boundary owns
- `src/app/services/anthropic-api.service.spec.ts` - E6 cap binding + opt-in gate + D-07 unset
- `src/app/models/ai-chat.model.ts` - `web_search_started`/`web_search_results`/`web_search_error` ChatTurnEvent variants (SDK-free)
- `src/app/services/chat.service.ts` - tools[] assembly gated on `enableWebSearch`; render-only server-tool filter; pause_turn made live
- `src/app/services/chat.service.spec.ts` - F9/F10/F11/F12 E3/E4 cases; `buildWebSearchTool` added to the AnthropicApiService spy
- `src/app/services/tool-registry.service.ts` - D-02 clarifying comment on the write-proposal allow-list
- `src/app/services/tool-registry.service.spec.ts` - `isWriteProposal('web_search')` false; `has('web_search')` false; not in `definitions()`
- `src/app/services/fitness-context.service.ts` - `WEB_SEARCH_INSTRUCTIONS` in the cached prefix
- `src/app/services/fitness-context.service.spec.ts` - E5 substring + byte-stability assertions

## Decisions Made
- **Citation narrowing path:** The 05-02 serializer already narrows `TextBlock.citations` to `GroundedCitation[]` on persist (via `web-citation-parser`), so no additional narrowing method was added to `anthropic-api.service`. Instead a `WebSearchSdkSurface` type alias references the response-side SDK web-search types so they stay type-checked at the D-17 boundary (a future SDK rename breaks here, not silently). This satisfies the Task 1 action's "confirm the serializer already does the narrowing" branch.
- **Instruction text trimmed, not budget relaxed:** Adding the web-search steering text initially pushed the large-dataset cached prefix to 2585 chars, over the existing ~2500-char slim-header budget. Trimmed the instruction wording (~150 chars) to fit, preserving the budget guarantee rather than raising the threshold.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `buildWebSearchTool` to the AnthropicApiService spy in chat.service.spec.ts**
- **Found during:** Task 2 (loop spec run)
- **Issue:** The `mockAnthropicApi` spy object was created with only `['sendMessage', 'countTokens']`. After Task 1 wired the loop to call `anthropicApi.buildWebSearchTool(toolSettings)`, all 13 existing `runAgenticLoop` specs (plus the 5 new ones) failed with `buildWebSearchTool is not a function`.
- **Fix:** Added `buildWebSearchTool` to the `createSpyObj` list and defaulted it to return the def when `enableWebSearch` is true, else `null` (matching the OFF-by-default tool settings).
- **Files modified:** src/app/services/chat.service.spec.ts
- **Verification:** All 57 chat.service specs pass.
- **Committed in:** `5ec6c54` (Task 2 commit)

**2. [Rule 1 - Bug] Trimmed WEB_SEARCH_INSTRUCTIONS to stay under the slim-header budget**
- **Found during:** Task 3 (fitness-context spec run)
- **Issue:** The new stable instruction block pushed the cached-prefix budget test to 2585 chars (limit 2500).
- **Fix:** Tightened the instruction wording while keeping all three D-08/D-04/D-10 substrings and both few-shot exemplars.
- **Files modified:** src/app/services/fitness-context.service.ts
- **Verification:** All 30 fitness-context specs pass; prefix back under 2500.
- **Committed in:** `981c0f0` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes were required to keep the suite green for the new wiring; no scope creep.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## Verification Results
- `anthropic-api.service.spec.ts`: 20/20 pass (incl. E6 cap binding).
- `chat.service.spec.ts`: 57/57 pass (incl. F9/F10/F11/F12 E3/E4).
- `tool-registry.service.spec.ts`: 15/15 pass.
- `fitness-context.service.spec.ts`: 30/30 pass (incl. E5).
- Full suite: 687/692 pass; the only 5 failures are the intentionally-RED diet/chat/charts/reports characterization color-contrast/a11y specs owned by 05-09 (EXPECTED — not touched by this plan).
- D-17 grep gate GREEN: actual `from '@anthropic-ai/sdk` imports in production code are ONLY the 3 sanctioned files (`anthropic-api.service.ts`, `chat-block-serializer.ts`, `web-citation-parser.ts`). The dispatch filter `b.type === 'tool_use'` is unchanged.
- `ng build --configuration=production`: exits 0 (pre-existing budget warnings only).

## User Setup Required
None - no external service configuration required. Web search remains OFF by default; the renderer (footnotes + Sources list) and the settings toggle are owned by later waves (05-08 / settings plan).

## Next Phase Readiness
- Service-layer web-search grounding is complete: transport + loop + registry + prompt + model are wired for the opt-in server tool.
- 05-08 (renderer) can now consume the persisted `GroundedCitation[]` + the live `web_search_*` events to render footnotes, the Sources list, and the live "Searching the web…/Found N sources" rows.
- The settings UI (`enableWebSearch` toggle + visible `webSearchMaxUses` cap, E6 component half) is still pending.

## Self-Check: PASSED

- Commits `ebb1bda`, `5ec6c54`, `981c0f0` all present in git history.
- All claimed created/modified files exist on disk.

---
*Phase: 05-web-search-grounding-quality-sweep*
*Completed: 2026-05-31*
