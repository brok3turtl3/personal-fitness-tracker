---
phase: 04-agentic-loop-citation-ui
plan: 04
subsystem: ai
tags: [anthropic, agentic-loop, tool-use, rxjs, observable, stop-reason, angular]

# Dependency graph
requires:
  - phase: 04-01
    provides: ChatTurnEvent union + Confidence/Attribution/ClaimSpan types (SDK-agnostic)
  - phase: 04-02
    provides: ToolRegistryService.dispatch/definitions/isWriteProposal + six query_* tools
  - phase: 04-03
    provides: AnthropicApiService transport carrying tools[]+cache_control + countTokens(system,tools); FitnessContextService.buildSystemPrompt() SystemTextBlock[]
provides:
  - "ChatService.runAgenticLoop(conversationId, apiKey): Observable<ChatTurnEvent> — the bounded while(stop_reason==='tool_use') multi-emit loop"
  - "Every terminal StopReason handled (D-16); pause_turn resume; tool_use continue; default complete"
  - "query_* auto-execute + tool_result in a USER turn; write proposals deferred via pending pill + synthetic tool_result (D-03 — never blocks)"
  - "maxAgentTurns cap → turn_limit + one final tools-less best-effort create (D-04)"
  - "countTokens-driven window/summarize decision (len/4 retired, D-15)"
  - "surfacePendingProposal + persistAssistantBlocks loop-persistence helpers (auto-run query tool_use persisted status:'approved' paired with its tool_result)"
affects: [04-05, 04-06, 04-07, phase-05-web-search]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-emit Observable wrapping an async IIFE; teardown sets cancelled checked each loop iteration (takeUntilDestroyed seam)"
    - "Loop stays SDK-agnostic via local Wire* structural shapes + type-only SDK import (D-17 chokepoint preserved)"
    - "Reuse buildApiMessages verbatim for tool_result→user-turn placement (do NOT re-solve 49e275b)"

key-files:
  created: []
  modified:
    - src/app/services/chat.service.ts
    - src/app/services/chat.service.spec.ts

key-decisions:
  - "Loop reads maxAgentTurns from getToolSettings() and selectedModel/maxResponseTokens/apiKey from getSettings() — the two settings objects are distinct; the plan's `settings.*` shorthand spans both."
  - "ToolDefinition[] / SystemTextBlock[] pass through `sendMessage` as structurally-assignable casts at the transport boundary; chat.service.ts keeps a type-only SDK import (no client/runtime import, D-17)."
  - "estimateTokens(len/4) retired and renamed approxMessageTokens (word-based, non-len/4) for the single-shot sendMessage persisted estimate; the loop's authoritative window decision runs through anthropicApi.countTokens once per construction (Pitfall 7-safe, best-effort)."
  - "pause_turn re-sends the conversation INCLUDING the paused assistant turn, unmodified, without net-decrementing the cap (Anthropic guidance; turn--; continue)."

patterns-established:
  - "Loop persistence: auto-executed query_* tool_use persisted status:'approved' co-located with its paired tool_result so toAnthropicContent replays a real wire tool_use (RESEARCH Open Q #1)."
  - "Write-proposal deferral: surfacePendingProposal persists a status:'pending' pill via appendAssistantBlocks; loop feeds a synthetic 'NOT yet persisted' tool_result and continues."

requirements-completed: [CHAT-02, CHAT-05]

# Metrics
duration: 7min
completed: 2026-05-31
---

# Phase 4 Plan 04: Agentic Loop Summary

**`ChatService.runAgenticLoop` — a bounded `while (stop_reason === 'tool_use')` multi-emit `Observable<ChatTurnEvent>` that auto-executes read-only `query_*` tools, defers write proposals without blocking, handles every terminal `StopReason`, degrades gracefully at the `maxAgentTurns` cap, and drives the context window with `countTokens` instead of `len/4`.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-31T18:08:17Z
- **Completed:** 2026-05-31T18:15:24Z
- **Tasks:** 1 (TDD: RED → GREEN, no refactor)
- **Files modified:** 2

## Accomplishments
- `runAgenticLoop()` implemented as a bounded multi-emit Observable; the `for` loop condition is `turn < maxAgentTurns && !cancelled` (the takeUntilDestroyed cancellation seam).
- Every terminal `StopReason` handled explicitly (D-16): `end_turn`/`stop_sequence`/`max_tokens`/`refusal` complete; `pause_turn` re-sends unmodified without counting the turn; `tool_use` is the only continue branch; `default` completes (never fires in practice).
- Read-only `query_*` auto-execute via `ToolRegistryService.dispatch` (D-02); their `tool_result` blocks always go back in a **user** turn (49e275b regression locked by spec); a dispatch throw becomes an `is_error` `tool_result` the model recovers from (CHAT-11).
- Model-proposed writes (`isWriteProposal('memory')`) surface a `status:'pending'` pill and are fed a synthetic "NOT yet persisted" `tool_result` — the loop NEVER blocks (D-03).
- The `maxAgentTurns` cap emits `turn_limit` and makes ONE final `sendMessage` WITHOUT `tools` for a best-effort answer (D-04).
- Auto-executed query `tool_use` persists as `status:'approved'` paired with its `tool_result`, so the serializer replays a real wire `tool_use` (RESEARCH Open Q #1) — proven by a `toAnthropicContent` replay assertion.
- The window/summarize decision is driven by `anthropicApi.countTokens` (model + system + messages + tools); the `len/4` heuristic is retired (D-15).
- `ChatService` now injects `ToolRegistryService` (the Phase 3 grep-gate forbidding this import is intentionally lifted in Phase 4).

## Task Commits

1. **Task 1 (RED): failing E2 spec for runAgenticLoop** - `d7a6f63` (test)
2. **Task 1 (GREEN): implement runAgenticLoop bounded agentic loop** - `37f753f` (feat)

**Plan metadata:** see final docs commit.

## Files Created/Modified
- `src/app/services/chat.service.ts` - Added `runAgenticLoop` + private `surfacePendingProposal`, `persistAssistantBlocks`, `maybeSummarizeByTokenCount`; injected `ToolRegistryService`; retired `estimateTokens(len/4)` → `approxMessageTokens` (word-based) for the single-shot path; local `Wire*` structural shapes keep the loop SDK-agnostic.
- `src/app/services/chat.service.spec.ts` - New `runAgenticLoop` describe block (12 specs) covering every `stop_reason`, the cap (turn_limit + tools-less final create), the write proposal (pending pill + synthetic result, no block), the user-turn tool_result regression, the approved-status serializer replay, dispatch-error recovery, unsubscribe cancellation, and SDK-error→RxJS-error-channel; added `getToolSettings`/`countTokens` mocks and a `ToolRegistryService` spy.

## Decisions Made
- **Two settings sources.** `maxAgentTurns` lives in `AIToolSettings` (`getToolSettings()`), while `apiKey`/`selectedModel`/`maxResponseTokens` live in `AISettings` (`getSettings()`). The loop reads both; the plan's `settings.maxAgentTurns` shorthand is satisfied via `getToolSettings()`.
- **SDK-agnostic transport pass-through.** `tools` (`ToolDefinition[]`) and `system` (`SystemTextBlock[]`) are passed to `sendMessage` via structural casts; `chat.service.ts` keeps only a **type-only** SDK import (`MessageParam`/`ContentBlockParam`) — no SDK client or runtime import (D-17 chokepoint intact).
- **countTokens drives the window, best-effort.** Called once per loop construction (never per keystroke — Pitfall 7); a count failure is swallowed and the loop falls back to the `buildApiMessages` sliding-window cap, never wedging.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Retired `estimateTokens(len/4)` while keeping the single-shot `sendMessage` path intact**
- **Found during:** Task 1 (GREEN — D-15 window-decision requirement)
- **Issue:** The plan requires the `len/4` heuristic gone from the window decision but also says "leave the single-shot `sendMessage` path intact." `estimateTokens` was the only `len/4` call site, used to seed the persisted user-message `tokenEstimate` that the sliding window reads.
- **Fix:** Removed the `estimateTokens` function (and its `Math.ceil(len/4)` formula); replaced its single call with `approxMessageTokens` (a deterministic word-based tally, explicitly not `len/4`) so `sendMessage` stays synchronous and its 9 existing specs stay green. The loop's authoritative window/summarize decision now runs through `anthropicApi.countTokens` in `maybeSummarizeByTokenCount`. Grep confirms `length / 4` is REMOVED; the only remaining `estimateTokens` token is a pre-existing comment.
- **Files modified:** src/app/services/chat.service.ts
- **Verification:** `grep "length / 4"` → REMOVED; `grep "countTokens"` → PASS; full suite 563 SUCCESS.
- **Committed in:** `37f753f`

**2. [Rule 1 - Bug] Corrected the `pause_turn` resume assertion in the spec**
- **Found during:** Task 1 (GREEN — first spec run, 48/49)
- **Issue:** The initial RED assertion expected the resumed send's `messages` to be byte-identical to the paused send's. Anthropic's documented behavior (and the implementation) is to re-send the conversation **including** the paused assistant turn, unmodified — so the resume has exactly one more (assistant) turn, not an identical array.
- **Fix:** Re-asserted: the resumed send has `first.length + 1` messages, the single added turn is the paused **assistant** turn, and NO `tool_result` was injected between the paused and resumed sends. This is the correct, stronger invariant.
- **Files modified:** src/app/services/chat.service.spec.ts
- **Verification:** `pause_turn` spec green; `sendMessage` called exactly twice.
- **Committed in:** `37f753f`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both necessary for correctness. Deviation 1 resolves a genuine tension between two plan instructions in the lowest-risk way (single-shot path behavior preserved, `len/4` eliminated, loop uses `countTokens`). Deviation 2 hardens the `pause_turn` test to assert the correct Anthropic resume semantics. No scope creep.

## Issues Encountered
- TypeScript narrowing friction: a type-predicate filter over the `WireMessage.content` index-signature shape left `tu` fields typed via the index signature (TS4111/TS2322). Resolved by mapping the filtered `tool_use` blocks into clean `WireToolUse` objects (`id: String(b['id'])`, etc.) rather than relying on the predicate. The `response.content` → `ContentBlockParam[]` push required a cast through `unknown` (the structural shapes don't overlap), which is the documented D-17 boundary cast.

## Known Stubs
None — `runAgenticLoop` is fully wired into `ToolRegistryService`, `AnthropicApiService`, `FitnessContextService`, and the Phase 3 serializer. The chat-page UI consumer is intentionally deferred to Plan 06 (the plan states "Leave the existing single-shot `sendMessage` path intact for now (Plan 06 rewires chat-page to the loop)").

## Threat Flags
None — no new network endpoints, auth paths, file access, or schema changes were introduced beyond the plan's `<threat_model>`. All four registered threats (T-04-04-01 wedged loop, T-04-04-02 tool_result placement, T-04-04-03 unapproved write, T-04-04-04 dispatch error) are mitigated and covered by the E2 spec.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The agentic loop is live and fully unit-tested; Plans 05/06/07 can consume `runAgenticLoop`'s `ChatTurnEvent` stream (assistant_text / tool_use_started / tool_result / turn_limit / done) to render live per-tool-call progress (D-01), confidence/source badges (D-07/D-08/D-10), the citation guard (D-13), and the pending-pill approve flow (D-03).
- Plan 06 still owns rewiring `chat-page.component.ts` from the single-shot `sendMessage` to `runAgenticLoop` (deferred by design).
- The `pause_turn` branch is defensive in Phase 4 (no server tool yet) and load-bearing in Phase 5 when `web_search` drops onto this exact loop.

## Self-Check: PASSED

- `04-04-SUMMARY.md` exists.
- Commits `d7a6f63` (RED test) and `37f753f` (GREEN feat) present in git history.
- `runAgenticLoop` present in `chat.service.ts`.

---
*Phase: 04-agentic-loop-citation-ui*
*Completed: 2026-05-31*
