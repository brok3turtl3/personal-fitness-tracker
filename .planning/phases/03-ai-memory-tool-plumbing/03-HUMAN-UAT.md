---
status: diagnosed
phase: 03-ai-memory-tool-plumbing
source: [03-VERIFICATION.md]
started: 2026-05-03T18:00:00Z
updated: 2026-05-31T13:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. SC2 — UserProfile → AI sees on next message (round-trip via outbound system prompt)

**steps:** Open the app on localhost, go to `/settings/profile`, fill in the Goals field, save. Send a chat message. Inspect the outbound system-prompt text (DevTools Network tab on the `/v1/messages` POST, request body `system` field).

**expected:** The system prompt contains the profile block under `## User Profile`, with the saved Goals text wrapped in `<user_profile_goals>...</user_profile_goals>` delimiters. Changing the text in `/settings/profile` and sending another chat message reflects the new text immediately (no caching, no reload required).

**result:** pass

---

### 2. SC3 — Pending memory pill end-to-end (dev-seed → approve → persist)

**steps:** Go to `/settings/ai`, click "Seed pending memory proposal". Navigate to `/chat`. A pending pill should appear in the chat stream. Click "Save to memory". Refresh the page.

**expected:** Pending pill renders with header "AI wants to remember this:", three action buttons ("Save to memory", "Edit proposal", "Discard proposal"). Primary action receives auto-focus. Clicking "Save to memory" shows the ✓ Saved badge. After page refresh, the resolved badge is still shown (state persisted).

**result:** issue
**reported:** "I am not seeing the a pending memory pill in any of the chat streams after I click the 'Seed pending momory proposal' button. I do get a confirmation saying it was succesful though"
**severity:** major

---

### 3. SC3 — Memory inspector shows persisted memory files after approval

**steps:** Continuing from test #2, go to `/settings/memory`. Initially (before any approval) the empty-state message should be shown. After approving the pending memory pill in test #2, reload `/settings/memory`.

**expected:** Empty-state message appears before any approval. After approval, the seeded memory file appears in the path-tree with `aria-label="{path}, N bytes"`, an expandable inline preview shows the seeded content, and Edit + Delete actions are functional. Delete with confirm removes the entry.

**result:** blocked
**blocked_by:** prior-test
**reason:** "Empty-state ('No memory files yet') confirmed working. Inspect/edit/delete portion cannot be verified because Test 2 dev-seed mechanism is broken — no memory can be persisted to inspect."
**partial_pass:** Empty-state behavior verified

---

### 4. SC4 — Decision needed: tool-arg domain-validator deferral to Phase 4

**steps:** N/A — this is a decision item, not a test.

**expected:** Confirm or revise the Phase 3 sign-off decision: ROADMAP SC4 second-half ("any AI tool-call argument is re-validated through the same domain validators that guard direct user input") is partially deferred to Phase 4. In Phase 3, the agentic loop never fires (SC5 enforced — `chat.service.ts` has zero references to `ToolRegistryService`/`MemoryToolExecutor`), so tool dispatch is never executed in production. The current `ToolRegistryService.dispatch()` re-validates `typeof input === 'object' && input !== null`; per-tool zod schemas + reuse of `validators.ts` domain functions are scheduled for Phase 4 when the loop activates.

**result:** pass
**decision:** Deferral to Phase 4 confirmed by user. Per-tool zod schemas + domain-validator reuse will be implemented in Phase 4 when the agentic loop is activated; gap is non-exploitable in Phase 3 because the loop is disabled at the type level.

---

## Summary

total: 4
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 1

## Gaps

- truth: "Dev-seed pending memory proposal appears as a pending pill in the chat stream with header 'AI wants to remember this:' and three action buttons."
  status: failed
  reason: "User reported: I am not seeing the a pending memory pill in any of the chat streams after I click the 'Seed pending momory proposal' button. I do get a confirmation saying it was succesful though"
  severity: major
  test: 2
  root_cause: |
    chat-page.component.ts:217 calls consumeDevSeedIfPresent() synchronously in ngOnInit, but at that moment activeConversationId is still null — it is only assigned in response to a user click (onSelectConversation/onNewChat), never auto-assigned during init. The early-return guard at chat-page.component.ts:233 (`if (!this.activeConversationId) return;`) fires AFTER StorageService.consumeDevSeed() has already read-and-removed the sentinel from localStorage (storage.service.ts:369). Net effect: seed is silently consumed and thrown away; appendAssistantBlocks is never invoked; no pending pill ever renders. Unit tests at chat-page.component.spec.ts:415-417 bypass the bug by manually setting activeConversationId before invocation.
  artifacts:
    - path: "src/app/features/chat/chat-page.component.ts"
      issue: "ngOnInit invokes consumeDevSeedIfPresent() before any conversation is selected; null-guard at line 233 fires after the sentinel is already destroyed"
    - path: "src/app/services/storage.service.ts"
      issue: "consumeDevSeed() reads-and-removes atomically (lines 367-369), making the sentinel non-recoverable when the caller can't act on it"
    - path: "src/app/features/chat/chat-page.component.spec.ts"
      issue: "Dev-seed specs (lines 401-471) bypass production lifecycle by manually setting activeConversationId — regression net missing"
  missing:
    - "Defer seed consumption until a conversation exists (auto-select most-recent on init, or auto-create one if none exist), then consume."
    - "OR make consumeDevSeed() non-destructive on null-conversation (peek + separate clear, or re-write sentinel when caller can't act)."
    - "Add a regression spec that exercises ngOnInit end-to-end with seed present + no manual activeConversationId assignment, asserting appendAssistantBlocks is called."
  debug_session: ".planning/debug/dev-seed-pending-pill-not-rendering.md"
