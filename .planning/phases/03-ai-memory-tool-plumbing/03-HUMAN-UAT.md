---
status: partial
phase: 03-ai-memory-tool-plumbing
source: [03-VERIFICATION.md]
started: 2026-05-03T18:00:00Z
updated: 2026-05-03T18:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SC2 — UserProfile → AI sees on next message (round-trip via outbound system prompt)

**steps:** Open the app on localhost, go to `/settings/profile`, fill in the Goals field, save. Send a chat message. Inspect the outbound system-prompt text (DevTools Network tab on the `/v1/messages` POST, request body `system` field).

**expected:** The system prompt contains the profile block under `## User Profile`, with the saved Goals text wrapped in `<user_profile_goals>...</user_profile_goals>` delimiters. Changing the text in `/settings/profile` and sending another chat message reflects the new text immediately (no caching, no reload required).

**result:** [pending]

---

### 2. SC3 — Pending memory pill end-to-end (dev-seed → approve → persist)

**steps:** Go to `/settings/ai`, click "Seed pending memory proposal". Navigate to `/chat`. A pending pill should appear in the chat stream. Click "Save to memory". Refresh the page.

**expected:** Pending pill renders with header "AI wants to remember this:", three action buttons ("Save to memory", "Edit proposal", "Discard proposal"). Primary action receives auto-focus. Clicking "Save to memory" shows the ✓ Saved badge. After page refresh, the resolved badge is still shown (state persisted).

**result:** [pending]

---

### 3. SC3 — Memory inspector shows persisted memory files after approval

**steps:** Continuing from test #2, go to `/settings/memory`. Initially (before any approval) the empty-state message should be shown. After approving the pending memory pill in test #2, reload `/settings/memory`.

**expected:** Empty-state message appears before any approval. After approval, the seeded memory file appears in the path-tree with `aria-label="{path}, N bytes"`, an expandable inline preview shows the seeded content, and Edit + Delete actions are functional. Delete with confirm removes the entry.

**result:** [pending]

---

### 4. SC4 — Decision needed: tool-arg domain-validator deferral to Phase 4

**steps:** N/A — this is a decision item, not a test.

**expected:** Confirm or revise the Phase 3 sign-off decision: ROADMAP SC4 second-half ("any AI tool-call argument is re-validated through the same domain validators that guard direct user input") is partially deferred to Phase 4. In Phase 3, the agentic loop never fires (SC5 enforced — `chat.service.ts` has zero references to `ToolRegistryService`/`MemoryToolExecutor`), so tool dispatch is never executed in production. The current `ToolRegistryService.dispatch()` re-validates `typeof input === 'object' && input !== null`; per-tool zod schemas + reuse of `validators.ts` domain functions are scheduled for Phase 4 when the loop activates.

**result:** [pending]

---

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
