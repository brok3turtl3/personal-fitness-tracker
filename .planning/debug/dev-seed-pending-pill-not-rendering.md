---
status: diagnosed
trigger: "User clicked 'Seed pending memory proposal' button on /settings/ai, received a success confirmation, but no pending memory pill appeared in the chat stream at /chat."
created: 2026-05-31T12:30:00Z
updated: 2026-05-31T12:45:00Z
---

## Current Focus

hypothesis: CONFIRMED — `consumeDevSeedIfPresent()` is invoked during `ngOnInit` while `activeConversationId === null`, so the early return at chat-page.component.ts:233 fires BEFORE `appendAssistantBlocks` is called. The sentinel is silently consumed (removed from localStorage at storage.service.ts:369) before the early-return check, so the seed is permanently lost and the user must re-seed.
test: read chat-page ngOnInit lifecycle, consumeDevSeedIfPresent guard, loadConversations assignment behavior, storage.service.consumeDevSeed side effects
expecting: the sequence (a) seed written to localStorage on /settings/ai, (b) user navigates to /chat, (c) chat-page ngOnInit calls loadConversations (async) and consumeDevSeedIfPresent (sync), (d) at the moment consumeDevSeedIfPresent runs activeConversationId is still null, (e) consumeDevSeed() reads-and-removes the sentinel from localStorage, (f) early return — no pill is appended — to be confirmed
next_action: write up root cause and return ROOT CAUSE FOUND diagnosis

## Symptoms

expected: |
  After clicking "Seed pending memory proposal" on /settings/ai and navigating to /chat,
  a pending memory pill renders in the chat stream with header "AI wants to remember this:"
  and three action buttons (Save to memory, Edit proposal, Discard proposal). The primary
  action button receives auto-focus.

actual: |
  User report: "I am not seeing the a pending memory pill in any of the chat streams
  after I click the 'Seed pending momory proposal' button. I do get a confirmation
  saying it was succesful though"
  Success toast fires, but pill is not visible in chat stream UI at /chat.

errors: None reported by user.
reproduction: |
  1. Start ng serve, open localhost:4200
  2. Navigate to /settings/ai
  3. Click "Seed pending memory proposal"
  4. See success confirmation toast
  5. Navigate to /chat
  6. Expected: pending pill in stream. Actual: nothing.
started: Discovered during Phase 3 UAT on 2026-05-31. Dev-seed flow was added in Phase 3 Plan 03/04.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-05-31T12:30:00Z
  checked: 03-VERIFICATION.md Key Link Verification table
  found: |
    Claims wiring is correct end-to-end:
    - settings-ai setDevSeed → StorageService.setDevSeed() (lines 523, 529 of settings-ai)
    - chat-page.component.ts ngOnInit → StorageService.consumeDevSeed() (lines 217, 230-231)
    - chat-message-list.component.ts template → app-pending-pill for tool_use (lines 31-39)
    - Plan 04: pending-pill.component.ts is 227 lines, @switch on block.status; chat-message-list uses @switch on block.type
  implication: All declared links exist, but verification is only line-presence. The actual data flow has a lifecycle gap.

- timestamp: 2026-05-31T12:40:00Z
  checked: src/app/features/chat/chat-page.component.ts (full file read)
  found: |
    Line 192: `activeConversationId: string | null = null;` (component-instance state, NOT persisted).
    Lines 204-221: ngOnInit chains `storage.initialize()` → `aiSettingsService.hasValidApiKey()` → on valid: `loadConversations()` then immediately `consumeDevSeedIfPresent()` (synchronous call).
    Line 230-271: `consumeDevSeedIfPresent()` body:
      Line 231: const seed = storageService.consumeDevSeed();   ← REMOVES from localStorage
      Line 232: if (!seed) return;
      Line 233: if (!this.activeConversationId) return;          ← EARLY RETURN here
      Line 258: chatService.appendAssistantBlocks(activeConversationId, [block])
    Line 342-351: `loadConversations()` only reads conversations; never auto-assigns activeConversationId. Only assignments are at line 354 (onSelectConversation) and line 367 (onNewChat).
  implication: |
    At the moment consumeDevSeedIfPresent runs in ngOnInit:
    1) loadConversations is in-flight (async subscription not yet resolved)
    2) activeConversationId === null (initialized, never assigned during init)
    3) consumeDevSeed() at storage.service.ts:367-369 reads-and-removes the sentinel atomically (removeItem is called BEFORE the parsed.kind check, see storage.service.ts:369)
    4) Early return at chat-page.ts:233 fires
    5) appendAssistantBlocks is never called
    6) The sentinel is permanently lost — the user must click "Seed pending memory proposal" again, but the same bug repeats every time.

- timestamp: 2026-05-31T12:42:00Z
  checked: src/app/services/storage.service.ts:365-380 (consumeDevSeed implementation)
  found: |
    Line 367-369: getItem('dev_seed_pending'), then if raw exists, removeItem('dev_seed_pending') IMMEDIATELY — before parse, before type guard, before any caller can inspect the value.
  implication: The sentinel is consumed by storage even if the caller subsequently aborts. Combined with chat-page's null-activeConversationId early return, the sentinel is destroyed without being acted upon.

- timestamp: 2026-05-31T12:43:00Z
  checked: src/app/features/chat/chat-page.component.spec.ts:401-471 (3 dev-seed specs)
  found: |
    Lines 415-417 (and similarly 443-444, 466-467): the specs MANUALLY set fixture.componentInstance.activeConversationId = 'c-active' BEFORE calling consumeDevSeedIfPresent(). The spec comment at line 415 even reads "Manually set active conversation since the Phase 1 spec doesn't auto-select".
  implication: The unit tests bypass the production-code lifecycle gap by directly mutating the component state. They prove the dev-seed-handling code works WHEN activeConversationId is set, but never exercise the actual ngOnInit call path. The production bug was not caught because the test setup does not mirror production.

- timestamp: 2026-05-31T12:43:30Z
  checked: chat-page.component.ts:342-351 (loadConversations) and grep for activeConversationId assignments
  found: |
    All four assignments to activeConversationId:
    - Line 354: this.activeConversationId = id  (onSelectConversation — user click)
    - Line 367: this.activeConversationId = conv.id  (onNewChat — user click)
    - Line 380: this.activeConversationId = null  (onDeleteConversation reset)
    - Line 192: initializer = null
    No path during ngOnInit ever sets activeConversationId to a real value.
  implication: When the user lands on /chat fresh (regardless of whether they have prior conversations), activeConversationId is null until they CLICK a conversation in the sidebar. consumeDevSeedIfPresent always runs before that click. Bug is 100% reproducible.

## Resolution

root_cause: |
  chat-page.component.ts:217 calls `consumeDevSeedIfPresent()` synchronously inside ngOnInit, but `activeConversationId` is `null` at that moment (only set on user click in onSelectConversation/onNewChat — never auto-assigned during init). The guard at chat-page.component.ts:233 (`if (!this.activeConversationId) return;`) fires AFTER the sentinel is already read-and-removed from localStorage by storage.service.ts:369 (removeItem is called before the early-return check in the caller). Result: the seed is silently consumed and discarded; appendAssistantBlocks is never called; no pending pill ever renders. The unit tests at chat-page.component.spec.ts:415-417 manually set activeConversationId before invoking consumeDevSeedIfPresent, bypassing the production lifecycle gap, which is why the specs passed but the production behavior fails.
fix: (empty — diagnosis-only mode)
verification: (empty — diagnosis-only mode)
files_changed: []
