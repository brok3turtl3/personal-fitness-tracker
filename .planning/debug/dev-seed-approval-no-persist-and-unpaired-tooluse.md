---
status: diagnosed
phase: 03-ai-memory-tool-plumbing
source: operator UAT re-run (Test 2 + Test 3) after gap-closure plan 03-06
created: 2026-05-31T00:00:00Z
updated: 2026-05-31T00:00:00Z
severity: major
---

# Debug: Approving a seeded pending pill does not persist memory AND bricks the conversation

## Symptoms (operator-reported)

After plan 03-06 landed (pending pill now renders on /chat):

1. Clicking **"Save to memory"** on the pending pill shows an in-chat ✓ Saved confirmation, BUT
   `/settings/memory` still shows **"no memory files yet"** — the memory was never persisted.
2. Sending **any subsequent chat message** fails with an Anthropic API 400:
   > messages.N: `tool_use` ids were found without `tool_result` blocks immediately after: `<id>`.
   > Each `tool_use` block must have a corresponding `tool_result` block in the next message.

## Root cause — two bugs, one missing lifecycle stage

The Phase 3 pending pill is a **dormant scaffold** (03-CONTEXT.md D-12): it renders and the
Save/Edit/Discard buttons fire, but the approve→**execute**→**persist**→**tool_result** stage was
slated for Phase 4 (the agentic loop). The dev-seed button lets an operator reach the `approved`
state that the Phase 3 serializer is not prepared to emit safely.

### Bug 1 — approval never executes the memory tool (no persistence)

`src/app/features/chat/chat-page.component.ts` `onBlockAction()` (~line 340-379):
```ts
if (action === 'approve') {
  patch = { status: 'approved' };   // ← only the block status changes
}
// ... chatService.updateMessageBlock(...)  // saves the status patch and nothing else
```
- `updateMessageBlock()` (`chat.service.ts:195-249`) only rewrites the block's fields in storage.
- It never calls `MemoryToolExecutor.execute()` (`memory-tool-executor.service.ts:54-81`,
  `createCommand` at 165-177) → `MemoryStoreService.writeFile()` (`memory-store.service.ts:58-70`),
  which is the only path that writes `AppData.memoryFiles`.
- Therefore `memoryFiles` is never updated and the inspector stays empty.
- The execution path EXISTS and works (`ToolRegistryService.dispatch` → `MemoryToolExecutor`), it is
  simply **never invoked** from the approve handler.

### Bug 2 — approved tool_use is serialized without a paired tool_result (API 400)

`src/app/services/chat-block-serializer.ts` `toAnthropicContent()` (lines 41-79):
```ts
case 'tool_use':
  if (b.status === 'discarded') continue;            // dropped — safe
  if (b.status === 'pending') { out.push({type:'text', ...placeholder}); continue; }  // safe
  // 'approved' | 'edited': emit a REAL wire tool_use:
  out.push({ type: 'tool_use', id: b.id, name: b.name, input: b.input });  // ← unpaired!
```
- A `pending` tool_use is rendered as placeholder text so the API never sees an open tool loop —
  this was the deliberate Phase-3 safety mechanism (D-16).
- But an **`approved`** (or `edited`) tool_use is emitted as a genuine wire `tool_use`. Because no
  `tool_result` block is ever created at approve time (Bug 1), the assistant turn carries a
  `tool_use` with no following `tool_result` → the API rejects the whole request.
- Net effect: approving a seeded pill **permanently breaks** that conversation for all future turns.

## SC5 constraint note

SC5 forbids **`chat.service.ts`** from importing `ToolRegistryService`/`MemoryToolExecutor` (grep gate).
It does NOT name `chat-page.component.ts`. The approve handler lives in the UI container component, so
wiring approval-time tool execution there (a discrete user-triggered action, not the agentic
`while (stop_reason === 'tool_use')` loop) is defensible without violating SC5 as written. The
agentic loop itself stays deferred to Phase 4.

## Fix options

### Option A — Wire real memory persistence at approve time (closes SC3 as UAT-specified)
On approve, execute the memory tool, persist to `memoryFiles`, AND append a paired `ToolResultBlock`
to the same assistant message so the transcript is API-valid. Fixes BOTH bugs.
- Touch points: `chat-page.component.ts` (inject a tool executor — `ToolRegistryService` directly, or
  a new thin `PendingApprovalService`, to keep the SC5 boundary crisp), and a new
  `chat.service` method (e.g. `approveToolUseBlock`) that atomically flips status to `approved`,
  appends the `tool_result` block, and (for memory `create`) the file is written.
- Pulls part of the Phase 4 lifecycle forward; bends D-12 ("scaffold dormant in Phase 3").
- Requires new regression specs: approve-persists-to-memoryFiles, approve-appends-tool_result,
  post-approve message round-trip produces a valid (paired) API request.

### Option B — Keep scaffold dormant; only stop the conversation from bricking (defer persistence to Phase 4)
Make `approved`/`edited` tool_use blocks serialize safely when there is no paired `tool_result`
(treat them like `pending` → placeholder text), so chat keeps working. Do NOT wire persistence.
- Smaller, fully inside Phase 3 design intent (D-12/D-16); SC5 fully untouched.
- BUT "Save to memory" remains non-functional in Phase 3 — UAT Test 3 (inspector shows file) is
  reclassified as a Phase 4 deliverable, and the dev-seed button is honestly a preview only.

## Recommendation

Bug 2 (chat-bricking) must be fixed regardless of path — it is a data-integrity defect. The real
decision is Bug 1: wire persistence now (Option A) or defer to Phase 4 (Option B). Option A matches
operator expectation ("Save to memory" should save) and SC3 as written; Option B honors the
documented Phase-3 boundary at the cost of a non-functional dev button until Phase 4.
