---
status: partial
phase: 03-ai-memory-tool-plumbing
source: [03-VERIFICATION.md]
started: 2026-05-03T18:00:00Z
updated: 2026-05-31T00:00:00Z
---

## Current Test

[awaiting operator browser re-run of Tests 2 and 3 after gap-closure plan 03-06]

## Tests

### 1. SC2 — UserProfile → AI sees on next message (round-trip via outbound system prompt)

**steps:** Open the app on localhost, go to `/settings/profile`, fill in the Goals field, save. Send a chat message. Inspect the outbound system-prompt text (DevTools Network tab on the `/v1/messages` POST, request body `system` field).

**expected:** The system prompt contains the profile block under `## User Profile`, with the saved Goals text wrapped in `<user_profile_goals>...</user_profile_goals>` delimiters. Changing the text in `/settings/profile` and sending another chat message reflects the new text immediately (no caching, no reload required).

**result:** pass

---

### 2. SC3 — Pending memory pill end-to-end (dev-seed → approve → persist)

**steps:** Go to `/settings/ai`, click "Seed pending memory proposal". Navigate to `/chat`. A pending pill should appear in the chat stream. Click "Save to memory". Refresh the page.

**expected:** Pending pill renders with header "AI wants to remember this:", three action buttons ("Save to memory", "Edit proposal", "Discard proposal"). Primary action receives auto-focus. Clicking "Save to memory" shows the ✓ Saved badge. After page refresh, the resolved badge is still shown (state persisted).

**result:** pending
**note:** Lifecycle bug fixed in gap-closure plan 03-06 (commit ef9ca46). `chat-page` ngOnInit now auto-selects (or seed-gated auto-creates) an active conversation BEFORE consuming the dev-seed sentinel, so the pill is appended on the next /chat visit. Regression spec drives ngOnInit end-to-end (chat-page.component.spec.ts) and passes (491/491 full Karma suite). Awaiting operator browser re-run to confirm in-browser render + persistence.

---

### 3. SC3 — Memory inspector shows persisted memory files after approval

**steps:** Continuing from test #2, go to `/settings/memory`. Initially (before any approval) the empty-state message should be shown. After approving the pending memory pill in test #2, reload `/settings/memory`.

**expected:** Empty-state message appears before any approval. After approval, the seeded memory file appears in the path-tree with `aria-label="{path}, N bytes"`, an expandable inline preview shows the seeded content, and Edit + Delete actions are functional. Delete with confirm removes the entry.

**result:** pending
**note:** Unblocked by plan 03-06 — Test 2 now produces a real pending pill the user can approve, so the persisted-memory inspection flow can finally be exercised. Empty-state behavior was already confirmed working in the prior run.

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
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

- truth: "Dev-seed pending memory proposal appears as a pending pill in the chat stream with header 'AI wants to remember this:' and three action buttons."
  status: resolved
  resolution: |
    Fixed in gap-closure plan 03-06 (commits b89e3c5 RED → ef9ca46 GREEN). The root cause — consumeDevSeedIfPresent() running in ngOnInit while activeConversationId was still null, destroying the sentinel before it could be acted on — is closed by reordering ngOnInit to load conversations and auto-select/seed-gated-auto-create an active conversation BEFORE consuming the seed (new private initializeActiveConversationAndConsumeSeed()). A mandatory regression spec drives ngOnInit end-to-end with NO manual activeConversationId assignment and asserts appendAssistantBlocks is called with the seeded block. Full Karma suite 491/491; production build exit 0; SC5 grep gate clean.
  reason: "User reported: I am not seeing the a pending memory pill in any of the chat streams after I click the 'Seed pending momory proposal' button. I do get a confirmation saying it was succesful though"
  severity: major
  test: 2
  resolved_by: "03-06 (commit ef9ca46)"
  verification: "Code + spec verified (5/5 must-haves at code level, 03-VERIFICATION.md). Final operator browser re-run of Tests 2 and 3 still pending."
  debug_session: ".planning/debug/dev-seed-pending-pill-not-rendering.md"
