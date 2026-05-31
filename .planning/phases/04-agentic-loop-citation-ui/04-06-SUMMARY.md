---
phase: 04-agentic-loop-citation-ui
plan: 06
subsystem: ui
tags: [angular, rxjs, takeUntilDestroyed, agentic-loop, anthropic, chat, citation-ui]

# Dependency graph
requires:
  - phase: 04-04 (agentic loop)
    provides: ChatService.runAgenticLoop() multi-emit Observable<ChatTurnEvent>
  - phase: 04-05 (citation UI)
    provides: chat-message-list badges/disclosures/citation-guard + pending-pill
provides:
  - chat-page drives runAgenticLoop and renders incremental ChatTurnEvents (D-01)
  - turn-limit (D-04) + terminal (D-16) notices with LOCKED UI-SPEC copy
  - takeUntilDestroyed cancellation seam on the loop subscription (stops billing)
  - real write proposals surface as pending pills; dev-seed synthetic path removed
  - ToolUseBlock.resolvedAt + pending-pill real resolved timestamp
affects: [phase-05, chat, settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-emit loop Observable consumed in a component; each ChatTurnEvent refreshes the active conversation from storage (the loop persists each block as it emits)"
    - "destroyRef.onDestroy guard flag prevents post-teardown re-subscription (NG0911) in a takeUntilDestroyed complete handler"

key-files:
  created: []
  modified:
    - src/app/features/chat/chat-page.component.ts
    - src/app/features/chat/chat-page.component.spec.ts
    - src/app/features/chat/pending-pill.component.ts
    - src/app/features/chat/pending-pill.component.spec.ts
    - src/app/services/chat.service.ts
    - src/app/models/ai-chat.model.ts
    - src/app/features/settings/settings-ai.component.ts
    - src/app/features/settings/settings-ai.component.spec.ts

key-decisions:
  - "Loop events refresh the conversation from disk rather than mutating view state directly — the loop already persists each ChatBlock as it emits, so the chat-page is a thin renderer (single source of truth = storage)."
  - "Added ChatService.appendUserMessage so the chat-page persists the user turn before runAgenticLoop reads the transcript (the loop reads from disk; mirrors the user-message write at the head of sendMessage minus the API call)."
  - "Dev-seed synthetic-pill path REMOVED entirely (not gated): chat-page no longer consumes the seed sentinel on init, and the settings-ai dev 'Seed pending proposal' buttons + setDevSeed handlers were deleted. Real write proposals now surface via the live loop, so a synthetic pill can never collide with a real one (T-04-06-03). Auto-select-most-recent (plan 03-06) preserved; empty-state surface preserved (Phase 1 spec)."
  - "ToolUseBlock.resolvedAt (persistence-only, ISO-8601) added to the model; pending-pill reads the real timestamp and omits it gracefully when absent on legacy blocks (no fabricated new Date())."
  - "401 transport failure stays on the inline error banner (Phase 5 owns the rotate-key UX); generic transport failures surface a recoverable <app-error-state> with Retry that re-invokes the loop."

patterns-established:
  - "Loop-consumer pattern: .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: handleTurnEvent, error: handleLoopError, complete: refresh }) with a destroyed guard on the complete/refresh path."

requirements-completed: [CHAT-02, CHAT-05, CHAT-06]

# Metrics
duration: ~40min
completed: 2026-05-31
---

# Phase 4 Plan 06: Chat-Page Agentic-Loop Orchestration Summary

**chat-page now drives ChatService.runAgenticLoop, rendering live in-flight tool rows → resolved summaries → final answer (D-01) with LOCKED turn-limit/terminal notices, a takeUntilDestroyed cancel seam, and a removed dev-seed path so real write proposals fire cleanly.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-05-31T18:30Z (approx)
- **Completed:** 2026-05-31
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Rewired `onSendMessage` from single-shot `sendMessage` to the multi-emit `runAgenticLoop`, piped through `takeUntilDestroyed(this.destroyRef)` (the cancellation seam — navigating away mid-loop tears it down and stops the API/billing, T-04-06-01).
- `handleTurnEvent` refreshes the active conversation per event so the extended message-list (Plan 05) re-renders in-flight → resolved → prose blocks (D-01); `turn_limit` (D-04), `max_tokens` truncation, and `refusal` (D-16) render with verbatim LOCKED 04-UI-SPEC copy (`role="status"` `aria-live="polite"`).
- `handleLoopError` preserves the existing 401 inline mapping and surfaces a recoverable `<app-error-state>` with LOCKED transport copy + Retry for generic failures (never console-only — T-04-06-04).
- Removed the dev-only synthetic-pill seeding path end-to-end (chat-page init consume + settings-ai seed buttons/handlers) so real write proposals can never collide with synthetic ones (T-04-06-03); auto-select-most-recent and empty-state surfaces preserved.
- Added `ToolUseBlock.resolvedAt`; the pending pill renders the real persisted resolved timestamp (approve/discard/edit) and omits it gracefully on legacy blocks.

## Task Commits

1. **Task 1: Drive runAgenticLoop events into the view + terminal/turn-limit notices** — `d7ed324` (feat)
2. **Task 2: Remove dev-only seed path + real pending-pill resolvedAt** — `99abc47` (feat)

## Files Created/Modified
- `src/app/features/chat/chat-page.component.ts` — onSendMessage → runAgenticLoop (multi-emit, takeUntilDestroyed); handleTurnEvent/handleLoopError/applyTerminalNotice/onRetryLoop; turn-limit + terminal notices + loop <app-error-state>; dev-seed init consumption removed; destroyed guard.
- `src/app/features/chat/chat-page.component.spec.ts` — 10 loop-orchestration specs (multi-emit refresh, turn_limit role=status, max_tokens/refusal notices, takeUntilDestroyed teardown, 401 preserved, generic error → error-state + Retry); dev-seed specs replaced with removal assertions; Phase 1 characterization specs preserved (23 green).
- `src/app/features/chat/pending-pill.component.ts` — resolvedTime() reads real block.resolvedAt; timestamp omitted (not fabricated) when absent.
- `src/app/features/chat/pending-pill.component.spec.ts` — resolvedAt render + legacy-omit specs (19 green).
- `src/app/services/chat.service.ts` — added appendUserMessage(); resolvedAt stamped on approveToolUseBlock.
- `src/app/models/ai-chat.model.ts` — ToolUseBlock.resolvedAt (persistence-only).
- `src/app/features/settings/settings-ai.component.ts` — removed dev seed buttons + setDevSeed handlers.
- `src/app/features/settings/settings-ai.component.spec.ts` — seed-button specs replaced with removal assertions.

## Decisions Made
See `key-decisions` frontmatter. Summary: storage is the single source of truth (loop persists, chat-page re-reads); user message persisted via a new `appendUserMessage` before the loop; dev-seed path fully removed (not gated); `resolvedAt` added to the model with graceful legacy fallback; 401 stays inline, generic errors recover via `<app-error-state>` + Retry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ChatService.appendUserMessage**
- **Found during:** Task 1
- **Issue:** `runAgenticLoop` reads the persisted transcript from disk and expects the user message already on disk, but no public method persisted *only* the user turn (`sendMessage` does the full single-shot API call; `appendAssistantBlocks` is assistant-only).
- **Fix:** Added `appendUserMessage(conversationId, text): Observable<ChatMessage>` mirroring the user-message write at the head of `sendMessage` (minus the API call). The chat-page persists the user turn through it before starting the loop.
- **Files modified:** src/app/services/chat.service.ts
- **Verification:** chat-page spec asserts `appendUserMessage` called with ('c-1', text) before `runAgenticLoop`; full suite green.
- **Committed in:** d7ed324

**2. [Rule 3 - Blocking] Added ToolUseBlock.resolvedAt to the model + approve stamping**
- **Found during:** Task 2
- **Issue:** The plan requires the pending pill to render a *real* `resolvedAt`, but the field did not exist on `ToolUseBlock` and was never persisted.
- **Fix:** Added `resolvedAt?: string` (persistence-only) to `ToolUseBlock`; stamped it in `approveToolUseBlock` (chat.service) and on discard/edit patches (chat-page). Pending-pill reads it; omits the timestamp when absent (legacy blocks) rather than fabricating `new Date()`.
- **Files modified:** src/app/models/ai-chat.model.ts, src/app/services/chat.service.ts, src/app/features/chat/chat-page.component.ts, src/app/features/chat/pending-pill.component.ts
- **Verification:** pending-pill spec asserts the persisted ISO timestamp renders and is omitted when absent; full suite green.
- **Committed in:** 99abc47 (model/pending-pill) + d7ed324 (approve stamping)

**3. [Rule 3 - Blocking] Removed orphaned dev-seed buttons in settings-ai**
- **Found during:** Task 2
- **Issue:** After removing the chat-page seed consumer, the `isLocalhost`-gated "Seed pending proposal" buttons in settings-ai set a sentinel nothing read — a dead, misleading path. The plan's Task 2 truth requires the seed button to be removed/gated so it cannot fire alongside real proposals.
- **Fix:** Deleted the dev seed buttons, the `onSeedMemoryProposal`/`onSeedProfileProposal` handlers, and their `setDevSeed` calls; updated the settings-ai spec (4 seed specs → 1 removal assertion). `isLocalhost` retained for any future localhost-only tools.
- **Files modified:** src/app/features/settings/settings-ai.component.ts, src/app/features/settings/settings-ai.component.spec.ts
- **Verification:** settings-ai spec asserts the buttons + handlers are gone and `setDevSeed` is never called; full suite green.
- **Committed in:** 99abc47

**4. [Rule 1 - Bug] Guarded post-teardown re-subscription (NG0911)**
- **Found during:** Task 1 (takeUntilDestroyed teardown spec)
- **Issue:** `takeUntilDestroyed` completes the loop subscription on component destroy, firing the `complete` handler, which called `loadConversations()` / `refreshActiveConversation()` — those re-subscribe through `takeUntilDestroyed(this.destroyRef)` on an already-destroyed ref → `NG0911: View has already been destroyed` (test hang/disconnect).
- **Fix:** Added a `destroyed` flag set via `destroyRef.onDestroy(...)`; the `complete` handler and `refreshActiveConversation` short-circuit when destroyed.
- **Files modified:** src/app/features/chat/chat-page.component.ts
- **Verification:** teardown spec asserts no further events are processed post-destroy; full suite green (no NG0911).
- **Committed in:** d7ed324

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** All four were necessary supporting work for the plan's stated truths (persist user turn, real resolvedAt, remove dev-seed path) plus one correctness fix for the cancellation seam. The `appendUserMessage`, `resolvedAt`, and settings-ai edits extend beyond the plan's literal `files_modified` list (chat.service.ts, ai-chat.model.ts, settings-ai.*) but are required to deliver the must-haves. No scope creep beyond the loop-orchestration goal.

## Issues Encountered
- NG0911 on teardown (see Deviation 4) — resolved with a destroyed guard.
- A spec typing wrinkle: `of({...} as never)` inferred `Observable<null>`; resolved by importing `AISettings` and building a typed `settings` constant.

## Verification
- `ng test --no-watch --browsers=ChromeHeadless` full suite: **583 SUCCESS** (was 579; net +4 after spec additions/removals). Phase 1 chat-page characterization spec + Phase 3 specs all still pass.
- `ng build --configuration=production`: **exit 0** (two pre-existing budget warnings: 4.87 kB initial overage and the 69-byte chat-message-list component-style overage from plan 04-05 — not regressions).
- Acceptance grep gates: `runAgenticLoop` + `takeUntilDestroyed` + `statusCode === 401` present in chat-page; zero `appendSeededPill`/`consumeDevSeed` code matches in chat-page; `resolvedAt` present in pending-pill; `runAgenticLoop` present in spec; key-link multiline pattern `runAgenticLoop(...).pipe(...takeUntilDestroyed)` present.

## Threat-model compliance
- **T-04-06-01** (runaway-loop DoS on navigate-away): loop subscription piped through `takeUntilDestroyed`; teardown spec asserts no further event processing → loop's `cancelled` flips, API calls stop.
- **T-04-06-02** (unapproved write persisted): real write proposals surface as pending pills via the unchanged `onBlockAction` approve→`approveToolUseBlock` path; the pill is the confirmation (D-03). Unchanged this plan.
- **T-04-06-03** (dev-seed firing alongside real proposals): synthetic-pill seeding path removed end-to-end.
- **T-04-06-04** (silent failure): generic transport/401 failures surface visible UI (error-state with Retry / inline 401 banner), never console-only.

## Known Stubs
None — the loop is fully wired into the view; all rendered notices use real LOCKED copy and real persisted data. The `resolvedAt` timestamp is the only data-completeness item and degrades gracefully on legacy blocks by design.

## Next Phase Readiness
- CHAT-05/CHAT-06 are closed at the page level: success criterion #1 ("ask how's my weight trending → AI fetches real data via query_* and answers") is now user-visible. Operator manual verification (per 04-VALIDATION Manual-Only) is the remaining gate: run `ng serve`, ask "how's my weight trending vs my goal?", confirm live tool rows + real-data answer + badges/disclosures.
- Phase 5 owns the 401-specific rotate-key UX (QUAL-07) — Phase 4 surfaces a generic recoverable error as designed.

## Self-Check: PASSED

All modified files present on disk; both task commits (`d7ed324`, `99abc47`) present in git history.

---
*Phase: 04-agentic-loop-citation-ui*
*Completed: 2026-05-31*
