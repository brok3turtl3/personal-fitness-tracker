---
phase: 03
plan: 07
subsystem: ai-chat
tags: [gap-closure, tool-use, memory, serializer, sc3]
requires:
  - "03-05/03-06: ChatBlock model, dev-seed pending pill render path, chat-block-serializer D-16"
  - "ToolRegistryService.dispatch → MemoryToolExecutor → MemoryStoreService.writeFile (Phase 3 memory plumbing)"
provides:
  - "PendingApprovalService.executeApprovedToolUse — SC5-clean tool-execution seam (sole new owner of ToolRegistryService import)"
  - "chat.service.approveToolUseBlock — atomic status-flip + paired ToolResultBlock append in one saveData write"
  - "toAnthropicContent paired-result defensive guard — approved/edited tool_use degrades to placeholder when unpaired"
affects:
  - src/app/services/chat-block-serializer.ts
  - src/app/services/chat.service.ts
  - src/app/features/chat/chat-page.component.ts
tech-stack:
  added: []
  patterns: ["thin execution seam service (resolution (a))", "atomic immutable-rebuild + single saveData", "defensive serializer guard"]
key-files:
  created:
    - src/app/services/pending-approval.service.ts
    - src/app/services/pending-approval.service.spec.ts
  modified:
    - src/app/services/chat.service.ts
    - src/app/services/chat.service.spec.ts
    - src/app/services/chat-block-serializer.ts
    - src/app/services/chat-block-serializer.spec.ts
    - src/app/features/chat/chat-page.component.ts
    - src/app/features/chat/chat-page.component.spec.ts
decisions:
  - "SC5 resolution (a): a new thin PendingApprovalService owns the ToolRegistryService import so both chat.service.ts and chat-page.component.ts stay grep-clean — chosen over (b) because it keeps every existing grep gate literally green and gives Phase 4's agentic loop a reusable execution seam."
  - "D-12 bend (user-delegated 2026-05-31, Option A): real persistence pulled forward for the discrete user-triggered approval action; the agentic while-loop stays deferred to Phase 4 and will reuse this plumbing."
metrics:
  duration: ~25m
  completed: 2026-05-31
---

# Phase 3 Plan 07: Approve → Execute → Persist → tool_result (SC3 gap closure) Summary

**One-liner:** Approving a pending memory pill now executes the memory tool through the existing ToolRegistryService → MemoryToolExecutor → MemoryStoreService.writeFile path and atomically appends a paired ToolResultBlock, closing UAT SC3's SC3-NO-PERSIST and SC3-UNPAIRED-TOOLUSE gaps.

## What Was Built

Three tasks closed the two SC3 lifecycle gaps surfaced after 03-06 fixed the pending-pill render path:

1. **Defensive serializer guard** (`chat-block-serializer.toAnthropicContent`): builds a `pairedToolResultIds` set before the loop; an `approved`/`edited` tool_use is emitted as a real wire `tool_use` ONLY when a paired `tool_result` for its id exists — otherwise it degrades to the same placeholder text used for `pending`. This is belt-and-suspenders protection against the Anthropic 400 ("tool_use ids were found without tool_result blocks") for legacy/half-migrated/bricked conversations.
2. **PendingApprovalService + chat.service.approveToolUseBlock**: a new thin `PendingApprovalService.executeApprovedToolUse` dispatches an approved tool_use through `ToolRegistryService` (never throws — unknown tool or dispatch error returns an `isError` result string so the tool_use still gets paired). `chat.service.approveToolUseBlock` flips the block to `status='approved'` AND appends a paired `ToolResultBlock` (`tool_use_id === block.id`) in ONE `getData → saveData` write.
3. **chat-page rewire**: the `onBlockAction` approve branch now routes through `PendingApprovalService.executeApprovedToolUse` (Promise bridged via `from(...)`) then persists via `chat.service.approveToolUseBlock`; `discard`/`edit` are unchanged through `updateMessageBlock`.

## Key Implementation Details

- **SC5 resolution (a):** the `ToolRegistryService` import lives ONLY in `pending-approval.service.ts`. Both grep gates pass: `! grep -nE "ToolRegistryService|MemoryToolExecutor"` exits 0 for `chat.service.ts` AND `chat-page.component.ts`. `grep -c "ToolRegistryService" pending-approval.service.ts` = 2.
- **Atomicity (T-3-07-BRICK):** status flip + tool_result append happen in a single `saveData` call — no intermediate approved-without-result state. The chat.service spec asserts `saveData` called exactly once, block[0].status==='approved', and a paired tool_result present with `tool_use_id==='tu1'`.
- **Persistence-path reuse (T-3-RG):** the file lands in `AppData.memoryFiles` ONLY via `ToolRegistryService.dispatch → MemoryToolExecutor.validatePath → MemoryStoreService.writeFile`. No second write path was added. The end-to-end integration spec drives the real DI graph (real ToolRegistryService/MemoryToolExecutor/MemoryStoreService/PendingApprovalService/ChatService, faked StorageService) and asserts `currentData.memoryFiles['/memories/seed-1.md']` equals the seeded `file_text`.
- **`isError` omission:** the tool_result omits the `isError` key when `result.isError` is false (spec asserts `'isError' in toolResult === false`), matching the optional-field-as-`undefined` CLAUDE.md convention.

## Mandatory Regression / Integration Specs (which close which gap)

- `chat.service.spec.ts` integration spec 1 — "approving a seeded memory pill writes the file to AppData.memoryFiles" → closes **SC3-NO-PERSIST**.
- `chat.service.spec.ts` integration spec 2 — "post-approve transcript serializes to API-valid content (every wire tool_use has a paired tool_result)" → closes **SC3-UNPAIRED-TOOLUSE**.
- `chat-block-serializer.spec.ts` — 6 pairing-guard specs (paired→wire tool_use; unpaired approved/edited→placeholder; discarded dropped; pending placeholder; standalone tool_result passthrough) → defensive guard.
- `chat-page.component.spec.ts` — approve executes-then-persists; discard/edit still route through `updateMessageBlock` with no execution.
- SC5 grep gates green for both files; executor import only in `pending-approval.service.ts`.

## Spec Count Delta

- Full Karma suite: **491 → 503 SUCCESS** (+12 net).
- Per-file: serializer spec 13 → 18 it()-blocks (6 new pairing-guard + 2 existing approved/edited updated to require pairing); pending-approval.service.spec 4 (new file); chat.service.spec 7 → 13 (+4 approveToolUseBlock +2 integration); chat-page.component.spec 6 → 8 (+3 approve-path, −1 stale approve spec replaced).
- Production build: exit 0 (pre-existing ~513 kB / 512 kB budget warning is NOT a regression and was not chased).

## Threat-Model Compliance Evidence

- **T-3-RG (single seam):** `grep -c "ToolRegistryService" pending-approval.service.ts` = 2; execution flows only through `dispatch → MemoryToolExecutor → MemoryStoreService.writeFile`; no second `memoryFiles` write path added.
- **T-3-07-BRICK (paired):** atomic approve appends the paired ToolResultBlock in the same write; serializer defensive guard degrades any unpaired approved/edited tool_use to placeholder; integration spec asserts every post-approve wire tool_use is paired.
- **T-3-07-SC5 (grep gates):** `! grep -nE "ToolRegistryService|MemoryToolExecutor"` exits 0 for both `chat.service.ts` and `chat-page.component.ts`. No agentic while-loop introduced.

UAT Test 3 (memory inspector after approval) and UAT Test 2 (no 400 on next message) ready for operator re-run.

D-12 bend confirmed: persistence pulled forward for the discrete user-triggered approval action; the agentic while-loop remains deferred to Phase 4 and will reuse this plumbing (PendingApprovalService / approveToolUseBlock / paired-result serializer guard).

## Deviations from Plan

None of substance — plan executed as written. Two minor, in-scope adjustments required by the new contract (not behavior deviations):

1. **Stale serializer specs updated** (Task 1): the two pre-existing "emits approved/edited tool_use as real tool_use" specs had no paired tool_result, so under the new guard they would now degrade to placeholder. They were updated to include a paired `tool_result` block (matching the new pairing contract) and renamed "...when paired". This is the intended behavior change, not a regression.
2. **Stale chat-page approve spec replaced** (Task 3): the pre-existing "approves a pending tool_use block (status → approved)" spec asserted `updateMessageBlock` was called for approve — which is no longer true. It was removed and superseded by the new "executes via PendingApprovalService then persists via approveToolUseBlock" spec.

Commit style matched the repo's recent conventional commits (no Co-Authored-By trailer, consistent with the last several commits).

## Self-Check: PASSED
