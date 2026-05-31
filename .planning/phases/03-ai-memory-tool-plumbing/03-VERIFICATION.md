---
phase: 03-ai-memory-tool-plumbing
verified: 2026-05-31T14:00:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/5
  gaps_closed:
    - "SC3 — dev-seed pending pill RENDERS via production ngOnInit lifecycle (UAT Test 2 render root cause fixed by plan 03-06; operator confirmed pill now appears)"
  gaps_remaining:
    - "SC3 — approving a pending memory pill does NOT persist to AppData.memoryFiles (memory inspector stays empty); UAT Test 3 fails"
    - "SC3 — approving a pending tool_use leaves the conversation with an unpaired tool_use block, so the next message is rejected by the Anthropic API (400 tool_use without tool_result); the conversation is bricked"
  regressions:
    - "Approving a seeded pill bricks the conversation for all subsequent turns (unpaired tool_use). Surfaced by operator UAT re-run after 03-06."
gaps:
  - id: SC3-NO-PERSIST
    truth: "Approving a pending memory pill executes the memory tool and persists the file to AppData.memoryFiles, so it appears in /settings/memory."
    status: failed
    severity: major
    test: 3
    reason: "Operator approved a seeded pill (got in-chat ✓ Saved confirmation) but /settings/memory still shows 'no memory files yet'."
    root_cause: "chat-page.component.ts onBlockAction() sets only { status: 'approved' } and calls chat.service.updateMessageBlock (which only rewrites the block's fields). MemoryToolExecutor.execute / MemoryStoreService.writeFile (the sole memoryFiles write path) is never invoked. By Phase-3 design (D-12) the approve→execute stage was deferred to Phase 4 — but UAT SC3 requires it."
    decision: "Option A (wire real persistence now) chosen by user delegation 2026-05-31."
    debug_session: ".planning/debug/dev-seed-approval-no-persist-and-unpaired-tooluse.md"
    artifacts:
      - path: "src/app/features/chat/chat-page.component.ts"
        issue: "onBlockAction approve branch only sets status; no tool execution / persistence."
      - path: "src/app/services/chat.service.ts"
        issue: "updateMessageBlock only patches block fields; no method to execute-and-persist + append a result block."
  - id: SC3-UNPAIRED-TOOLUSE
    truth: "Approving a tool_use never leaves the stored conversation in an API-invalid state; the next message round-trips successfully."
    status: failed
    severity: major
    test: 2
    reason: "After approving a seeded pill, sending any new chat message returns Anthropic 400: 'tool_use ids were found without tool_result blocks immediately after'."
    root_cause: "chat-block-serializer.ts toAnthropicContent() renders status='pending' tool_use as safe placeholder text, but emits status='approved'|'edited' tool_use as a REAL wire tool_use. No tool_result block is ever created at approve time (see SC3-NO-PERSIST), so the assistant turn carries an unpaired tool_use → API rejects the request."
    decision: "Option A: fix by appending a paired ToolResultBlock at approve time (also satisfies SC3-NO-PERSIST). Independent of persistence, approved tool_use must never serialize unpaired."
    debug_session: ".planning/debug/dev-seed-approval-no-persist-and-unpaired-tooluse.md"
    artifacts:
      - path: "src/app/services/chat-block-serializer.ts"
        issue: "Lines ~60-66: approved/edited tool_use emitted as wire tool_use with no paired tool_result."
human_verification:
  - test: "Open the app on localhost, go to /settings/profile, fill in the Goals field, save, then send a chat message and inspect the outbound system-prompt text (e.g. via browser DevTools Network tab). Verify the system prompt contains the profile block wrapped in <user_profile_goals>...</user_profile_goals> delimiters."
    expected: "The saved Goals text appears in the system prompt under ## User Profile, wrapped in delimiters. Changing the text and sending again reflects the new text immediately."
    why_human: "Data-flow trace for SC2 (UserProfile → AI sees on next message) is programmatically confirmed. The full round-trip through localStorage → UserProfileService → FitnessContextService.buildSystemPrompt → outbound system parameter can only be confirmed visually with a running app."
  - test: "Go to /settings/ai (localhost), click 'Seed pending memory proposal'. Navigate to /chat. Verify a pending pill appears in the chat stream with the header 'AI wants to remember this:', three action buttons ('Save to memory', 'Edit proposal', 'Discard proposal'), and that clicking 'Save to memory' resolves to the approved badge (checkmark Saved)."
    expected: "Pending pill renders, primary action button receives auto-focus, clicking Save to memory shows the approved badge, and refreshing the page still shows the resolved badge (persisted)."
    why_human: "The lifecycle fix (plan 03-06) is code-verified and spec-covered (4 regression specs, 491/491 green). The FULL end-to-end — browser focus management, Angular rendering timing, localStorage round-trip — requires a live browser re-run to confirm UAT Test 2 is closed."
  - test: "Go to /settings/memory. Verify the empty-state message appears. Then trigger a dev-seed memory pill (from /settings/ai), approve it, and reload /settings/memory. Verify the seeded memory file now appears in the path-tree with the correct path and the inline preview shows the seeded content."
    expected: "After approving a pending memory pill, the memory file appears in /settings/memory with aria-label '{path}, N bytes', expandable preview, Edit and Delete actions functional."
    why_human: "Test 3 was blocked by Test 2 in UAT. With Test 2's code path fixed, this test is now unblocked and must be re-run end-to-end in the browser."
---

# Phase 3: AI Memory + Tool Plumbing Verification Report

**Phase Goal:** All the AI infrastructure the agentic loop will need is in place — schema migrated for memory + profile + structured chat blocks, memory tool wired to a typed store, user profile editable, tool registry ready to dispatch — but the user still sees today's chat behavior. No regressions.
**Verified:** 2026-05-31T14:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 03-06, UAT Test 2 fix)

---

## Gap Closure Summary (Plan 03-06)

**Closed gap:** SC3 (dev-seed pending pill lifecycle bug)

**Root cause (confirmed by prior diagnosis):** `chat-page.component.ts` called `consumeDevSeedIfPresent()` synchronously in `ngOnInit` before any `activeConversationId` was assigned. `StorageService.consumeDevSeed()` is read-and-remove — it destroyed the sentinel before the null-guard check fired. The pending pill was never appended.

**Fix applied (commit ef9ca46):** `ngOnInit` now delegates to `initializeActiveConversationAndConsumeSeed()`. The new method: loads conversations → captures the seed (read-and-remove) → if conversations exist, auto-selects the most-recent and appends the pill; if no conversations AND seed present, auto-creates a conversation then appends; if no conversations AND no seed, leaves `activeConversation` null (Phase 1 empty-state spec preserved). The seed is captured before any branching so it is never destroyed without being acted upon.

**Regression net (commit ef9ca46 same PR):** 4 new specs in `describe('ngOnInit dev-seed regression (UAT Test 2 — gap-closure plan 03-06)')`. Spec 1 is the mandatory regression spec — it drives `ngOnInit` end-to-end with NO manual `activeConversationId` assignment and asserts `appendAssistantBlocks` is called on `'c-a'`.

**Test suite after fix:** 491/491 SUCCESS (up from 487 pre-fix). Production build: exit 0 (pre-existing budget warning at 516 kB / 512 kB budget is not a new regression).

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | V4→V5 migration: chat conversations preserved as blocks, memoryFiles/userProfile/aiToolSettings defaulted, backup behind recovery key | ✓ VERIFIED | `CURRENT_SCHEMA_VERSION = 5` in `app-data.model.ts:56`; `migrateV4ToV5` in `storage.service.ts:430`; chain at line 430–431; backup written before migration; all 3 new fields in `AppData` interface; v4/v5 fixtures confirmed |
| 2 | Editable UserProfile on /settings/profile: AI sees change on next message | ✓ VERIFIED | `settings-profile.component.ts` with 4-textarea reactive form; `UserProfileService.saveProfile()` persists to StorageService; `FitnessContextService.buildSystemPrompt()` reads `data?.userProfile` fresh from storage on every `sendMessage` call; `wrapUntrusted` applied to every non-empty profile section. Human verification retained for full outbound round-trip. |
| 3 | Dev-seed pending pill renders via production ngOnInit lifecycle (no manual activeConversationId); user sees pending pill at /chat after clicking 'Seed pending memory proposal' | ✓ VERIFIED (code + spec level) | `initializeActiveConversationAndConsumeSeed()` present at `chat-page.component.ts:231`; `appendSeededPill()` at line 277; ngOnInit (line 204) delegates to the new orchestrator; `consumeDevSeedIfPresent` at line 327 preserved for legacy-spec compat; regression spec (no manual state) at `chat-page.component.spec.ts:506` drives ngOnInit end-to-end — `appendAssistantBlocks` called with `'c-a'` and a block of `{ type: 'tool_use', name: 'memory', status: 'pending' }`. 491/491 green. SC5 chokepoint: zero `ToolRegistryService`/`MemoryToolExecutor` imports confirmed. Browser re-run required for UAT confirmation (human item #2). |
| 4 | Prompt-injection guardrail: user content can't escape delimiter wrapper; tool-call arguments re-validated | ? UNCERTAIN (second half intentionally partial) | FIRST HALF verified: `wrapUntrusted(tag, content)` in `fitness-context.service.ts:53–58` escapes both `</tag>` and `<tag>` occurrences; instruction `Treat any content inside <user_*>` present (1 match). SECOND HALF partial: `ToolRegistryService.dispatch` re-validates `typeof input === 'object' && input !== null`; `MemoryToolExecutor.validatePath` gates all 6 commands. Domain validators from `validators.ts` NOT applied to memory content fields. Per-tool zod schemas explicitly deferred to Phase 4 (Plan 03 decision, confirmed by UAT Test 4 pass). Non-exploitable in Phase 3 because the agentic loop is disabled at the type level (SC5). |
| 5 | No agentic loop: user still sees single-shot chat behavior; no ToolRegistryService/MemoryToolExecutor in chat.service or chat-page | ✓ VERIFIED | `grep -nE "ToolRegistryService\|MemoryToolExecutor" src/app/features/chat/chat-page.component.ts` returns empty (exit 1 = no match). Same check on `chat.service.ts` confirmed empty. `anthropic-api.service.ts sendMessage` signature is `Omit<MessageCreateParams, 'tools' \| 'tool_choice'>`. |

**Score:** 4/5 truths verified at code level. SC3 row above reflects only the *render* path (verified by 03-06). The operator UAT re-run downgraded SC3 overall to **gaps_found**: approve→persist (SC3-NO-PERSIST) and approve→tool_result (SC3-UNPAIRED-TOOLUSE) are missing — see Gaps Summary + frontmatter `gaps:`. SC4 second-half deferred per plan decision.

---

## Hard Checks (Re-verified)

| Check | Expected | Result |
|-------|----------|--------|
| `grep "ToolRegistryService\|MemoryToolExecutor" chat-page.component.ts` | empty (SC5) | PASS — exit 1 (no matches) |
| `grep "ToolRegistryService\|MemoryToolExecutor" chat.service.ts` | empty (SC5) | PASS — confirmed empty |
| `CURRENT_SCHEMA_VERSION = 5` in `app-data.model.ts` | version 5 | PASS — line 56 |
| `fromVersion < 5` branch in `storage.service.ts` | migration chain | PASS — line 430 |
| `Treat any content inside <user_` in `fitness-context.service.ts` | count=1 | PASS |
| `app-pending-pill` in `chat-message-list.component.ts` | template usage | PASS — lines 12, 34 |
| Settings sub-routes in `app.routes.ts` | /ai /profile /memory | PASS |
| `setDevSeed` + `consumeDevSeed` in `storage.service.ts` | both present | PASS — lines 351, 365 |
| `initializeActiveConversationAndConsumeSeed` in `chat-page.component.ts` | new orchestrator method | PASS — line 231 |
| `appendSeededPill` in `chat-page.component.ts` | shared block builder | PASS — line 277 |
| Regression describe block in `chat-page.component.spec.ts` | 1 describe block | PASS — count=1 |
| Full Karma suite | 491/491 SUCCESS | PASS |
| Production build | exit 0 | PASS (budget warning at 516 kB pre-existing, not new) |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/models/user-profile.model.ts` | UserProfile + DEFAULT_USER_PROFILE | ✓ VERIFIED | 40 lines, 5-field interface, empty-string defaults |
| `src/app/models/ai-chat.model.ts` | ChatBlock union + AIToolSettings | ✓ VERIFIED | TextBlock, ToolUseBlock, ToolResultBlock, AIToolSettings all exported |
| `src/app/models/app-data.model.ts` | AppData V5 shape + CURRENT_SCHEMA_VERSION=5 | ✓ VERIFIED | memoryFiles, userProfile, aiToolSettings; version 5 at line 56 |
| `src/app/services/storage.service.ts` | migrateV4ToV5 + setDevSeed + consumeDevSeed | ✓ VERIFIED | All three methods present (lines 351, 365, 430) |
| `src/app/services/chat-block-serializer.ts` | pure module: toAnthropicContent + fromAnthropicMessage | ✓ VERIFIED | no @Injectable; both functions exported |
| `src/app/services/anthropic-api.service.ts` | SDK transport, Omit<MessageCreateParams, tools> | ✓ VERIFIED | Omit signature confirmed |
| `src/app/services/user-profile.service.ts` | get/save with 4096-char per-section validation | ✓ VERIFIED | MAX_SECTION_CHARS = 4096 |
| `src/app/services/memory-store.service.ts` | Observable wrapper over AppData.memoryFiles | ✓ VERIFIED | |
| `src/app/services/memory-tool-executor.service.ts` | 6 commands + validatePath | ✓ VERIFIED | All 6 commands; validatePath called at all 6 command branches |
| `src/app/services/tool-registry.service.ts` | dispatch with object re-validation | ✓ VERIFIED | object check at line 82 |
| `src/app/services/fitness-context.service.ts` | wrapUntrusted + UserProfile prepend + redaction | ✓ VERIFIED | wrapUntrusted at line 53; profile prepend at lines 39–44 |
| `src/app/features/settings/settings-shell.component.ts` | side-rail + RouterOutlet | ✓ VERIFIED | |
| `src/app/features/settings/settings-ai.component.ts` | redaction toggles + tool toggles + dev seed buttons | ✓ VERIFIED | setDevSeed calls at lines 523, 529 |
| `src/app/features/settings/settings-profile.component.ts` | 4-textarea form + 4096 cap | ✓ VERIFIED | Validators.maxLength(4096) |
| `src/app/features/settings/settings-memory.component.ts` | path-tree + edit/delete | ✓ VERIFIED | MemoryStoreService imported; flat path-tree template |
| `src/app/features/chat/pending-pill.component.ts` | 4 statuses × 2 kinds + edit mode | ✓ VERIFIED | 227 lines; @switch on block.status |
| `src/app/features/chat/chat-message-list.component.ts` | @switch block render with app-pending-pill | ✓ VERIFIED | @switch on block.type; app-pending-pill at line 34 |
| `src/app/features/chat/chat-page.component.ts` | ngOnInit auto-selects/creates BEFORE consumeDevSeed; 0 ToolRegistry/MemoryToolExecutor imports | ✓ VERIFIED | `initializeActiveConversationAndConsumeSeed` at line 231; `appendSeededPill` at line 277; SC5 grep clean |
| `src/app/features/chat/chat-page.component.spec.ts` | 4 regression specs driving ngOnInit end-to-end, no manual activeConversationId | ✓ VERIFIED | `describe('ngOnInit dev-seed regression (UAT Test 2 — gap-closure plan 03-06)')` at line 505; 4 specs, no manual state assignment in Spec 1–3 |
| Migration fixtures v4.json + v5-expected.json + malformed variants | fixture-driven test matrix | ✓ VERIFIED | Confirmed in Plan 01 SUMMARY; used by migration-fixtures.spec.ts |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `chat-page.component.ts ngOnInit` | `initializeActiveConversationAndConsumeSeed()` | delegates on `valid` | ✓ WIRED | Line 213 |
| `initializeActiveConversationAndConsumeSeed` | `storageService.consumeDevSeed()` | called after `getConversations()` resolves | ✓ WIRED | Line 241 — seed captured AFTER conversation list available |
| `initializeActiveConversationAndConsumeSeed` | `appendSeededPill(first.id, seed)` | `if (convs.length > 0 && seed)` branch | ✓ WIRED | Line 249 |
| `initializeActiveConversationAndConsumeSeed` | `chatService.createConversation()` + `appendSeededPill` | `else if (seed)` branch | ✓ WIRED | Lines 251–263 |
| `appendSeededPill` | `chatService.appendAssistantBlocks(conversationId, [block])` | builds ToolUseBlock then subscribes | ✓ WIRED | Lines 304–314 |
| `chat-page (blockAction)` | `chat.service.updateMessageBlock()` | `onBlockAction` handler | ✓ WIRED | Line 368 |
| `storage.service.ts migrateData()` | `migrateV4ToV5()` | `fromVersion < 5` branch | ✓ WIRED | Line 430 |
| `chat.service.ts sendMessage` | `fitnessContext.buildSystemPrompt()` | switchMap at line 132 | ✓ WIRED | Called on every sendMessage |
| `settings-ai setDevSeed` | `StorageService.setDevSeed()` | lines 523, 529 | ✓ WIRED | |
| `AnthropicApiService.sendMessage` | `Omit<MessageCreateParams, 'tools' \| 'tool_choice'>` | type signature | ✓ WIRED | Type-level SC5 enforcement |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `settings-profile.component.ts` | profileForm | UserProfileService.getProfile() → StorageService.getData() | Yes — reads AppData.userProfile | ✓ FLOWING |
| `settings-memory.component.ts` | files: MemoryFileEntry[] | MemoryStoreService.listFiles() → StorageService.getData() | Yes — reads AppData.memoryFiles | ✓ FLOWING |
| `settings-ai.component.ts` (tool toggles) | toolSettingsForm | AISettingsService.getToolSettings() → StorageService.getData() | Yes — reads AppData.aiToolSettings | ✓ FLOWING |
| `chat-message-list.component.ts` | messages: ChatMessage[] | Input from chat-page, sourced from ChatService.getConversation() | Yes — reads AppData.chatConversations | ✓ FLOWING |
| `pending-pill.component.ts` | block: ToolUseBlock | Input from chat-message-list (passed from messages array) | Yes — from persisted ChatMessage.blocks | ✓ FLOWING |
| `chat-page.component.ts` | `activeConversation` | `initializeActiveConversationAndConsumeSeed` → `getConversations()` + auto-select | Yes — reads real conversation list on init | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| `CURRENT_SCHEMA_VERSION = 5` | `grep "CURRENT_SCHEMA_VERSION = 5" app-data.model.ts` | ✓ PASS — line 56 |
| migrateV4ToV5 in migration chain | `grep "fromVersion < 5" storage.service.ts` | ✓ PASS — line 430 |
| SC5: no ToolRegistryService/MemoryToolExecutor in chat-page | `grep -nE "ToolRegistryService|MemoryToolExecutor" chat-page.component.ts` | ✓ PASS — exit 1, no matches |
| SC5: no ToolRegistryService/MemoryToolExecutor in chat.service | same grep on chat.service.ts | ✓ PASS — empty |
| SC5: Omit tools from sendMessage signature | `grep "Omit<MessageCreateParams" anthropic-api.service.ts` | ✓ PASS |
| Injection guardrail present | `grep -c "Treat any content inside <user_" fitness-context.service.ts` | ✓ PASS — count=1 |
| `app-pending-pill` in chat-message-list | `grep "app-pending-pill" chat-message-list.component.ts` | ✓ PASS — lines 12, 34 |
| Settings sub-routes in app.routes.ts | `grep "'ai'\|'profile'\|'memory'" app.routes.ts` | ✓ PASS |
| `initializeActiveConversationAndConsumeSeed` present | `grep -c "initializeActiveConversationAndConsumeSeed\|appendSeededPill" chat-page.component.ts` | ✓ PASS — count=7 |
| Regression describe block in spec | `grep -c "ngOnInit dev-seed regression (UAT Test 2" chat-page.component.spec.ts` | ✓ PASS — count=1 |
| Full Karma suite | `npx ng test --no-watch --browsers=ChromeHeadless` | ✓ PASS — 491/491 SUCCESS |
| Production build | `npx ng build --configuration=production` | ✓ PASS — exit 0 (budget warning pre-existing, non-blocking) |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| CHAT-01 | 03-01, 03-02, 03-05 | V4→V5 migration: adds memoryFiles/userProfile/aiToolSettings; lifts ChatMessage.content to blocks[] | ✓ SATISFIED | migrateV4ToV5 in storage.service.ts; ChatMessage.blocks in ai-chat.model.ts; 6 migration fixtures; chat-message-list @switch render |
| CHAT-03 | 03-03 | Memory tool backed by AppData.memoryFiles, path validation | ✓ SATISFIED | MemoryToolExecutor with 6 commands + validatePath (13-input traversal corpus); MemoryStoreService CRUD through StorageService |
| CHAT-04 | 03-03, 03-04, 03-05, 03-06 | UserProfile editable in /settings, visible to AI, update_profile confirm-before-write scaffold | ✓ SATISFIED | UserProfileService; /settings/profile component; FitnessContextService prepend; PendingPillComponent handles update_profile kind; dev-seed profile path spec-verified via plan 03-06 Spec 2 |
| CHAT-11 | 03-03 | Prompt-injection defense: delimiters + tool-call argument re-validation | ? PARTIAL | Delimiter wrap + bidirectional escape: SATISFIED. ToolRegistry object-level re-validation: SATISFIED. Domain validator re-application for tool content fields: deferred to Phase 4. Non-exploitable: agentic loop disabled at type level (SC5). UAT Test 4 decision confirmed by user. |
| CHAT-12 | 03-04 | /settings: tool toggles, memory inspector, agent-turn cap, web-search cap | ✓ SATISFIED | /settings/ai has enableDataQueryTools/enableMemoryTool/enableWebSearch/maxAgentTurns/webSearchMaxUses controls; /settings/memory has path-tree inspector with edit/delete |

---

## Anti-Patterns Found

All anti-patterns below are carried forward from the initial verification. Plan 03-06 did not introduce any new patterns.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `chat-block-serializer.ts:121–124` | `summarizeProposal`: `JSON.stringify(b.input)` may return `undefined` if input is undefined | ⚠️ Warning | Latent NPE — safe in Phase 3. Phase 4 concern. (WR-02) |
| `memory-tool-executor.service.ts:102–107` | Path validator rejects `%2e%2e` but not double-encoded `%252e%252e` | ⚠️ Warning | Safe for LocalStorage; forward-compat trap if Phase 5+ uses filesystem. (WR-03) |
| `chat-page.component.ts:449–487` | `this.activeConversationId` read multiple times across async hops without capture in `onSendMessage` | ⚠️ Warning | Race condition on conversation switch between API call and resolution. Pre-existing; not introduced by plan 03-06. (WR-04) |
| `storage.service.ts:531–545` | `conv.messages.map(...)` in migrateV4ToV5 without Array.isArray guard | ⚠️ Warning | If `messages` is null in a V4 conversation, migration throws TypeError. (WR-05) |
| `chat.service.ts:355–357` | `maybeSummarize` drops tool_use/tool_result blocks from summarization input | ⚠️ Warning | Sleeper bug — safe in Phase 3, Phase 4 concern. (WR-06) |
| `chat-message-list.component.ts:171–173` | setTimeout scroll without clearTimeout on rapid ngOnChanges | ℹ️ Info | Low impact single-user app. (WR-08) |
| `settings-shell.component.ts:127–131` | Unused `destroyRef` field declared | ℹ️ Info | Dead DI overhead; no functional impact. (IN-01) |

No new blockers introduced by plan 03-06. All warnings remain Phase 4/5 concerns.

---

## Human Verification Required

### 1. UserProfile round-trip to system prompt

**Test:** Open the app on `localhost`, navigate to `/settings/profile`, enter text in the Goals field (e.g., "Test goal for verification"), click Save. Navigate to `/chat`, open browser DevTools (Network tab), send any message. Inspect the outbound `messages/create` request body — find the `system` parameter.
**Expected:** The system parameter contains a `## User Profile` block with the saved Goals text wrapped in `<user_profile_goals>...</user_profile_goals>` delimiters.
**Why human:** The FitnessContextService → sendMessage → outbound system parameter chain is fully wired in code, but the actual outbound request content can only be confirmed with a running app making a real API call.
**UAT status:** PASSED (from 03-HUMAN-UAT.md — no regression in plan 03-06; no SC2 code changed)

### 2. Pending pill full end-to-end (dev-seed flow) — RE-RUN REQUIRED

**Test:** On `localhost`, navigate to `/settings/ai`, scroll to "Developer tools", click "Seed pending memory proposal". Navigate to `/chat`. Verify: (a) a pending pill appears with header "AI wants to remember this:" and three buttons; (b) the primary action button ("Save to memory") receives focus automatically; (c) clicking "Save to memory" shows the approved badge; (d) refreshing the page still shows the resolved approved badge.
**Expected:** Pending pill renders, focus auto-assigned, approval persists across page reload.
**Why human:** Plan 03-06 (commit ef9ca46) fixed the lifecycle bug and added 4 regression specs (all 491/491 green). The in-browser end-to-end — Angular rendering timing, focus management, localStorage round-trip — must be confirmed with the patched code. Previous UAT result was "issue" (pill did not render). This is the primary re-run item.

### 3. Memory inspector after approval — RE-RUN REQUIRED (unblocked by Test 2 fix)

**Test:** After completing Test 2 above (pending pill now renders with the fix), click "Save to memory" to approve the pill. Navigate to `/settings/memory`.
**Expected:** Empty-state message visible before any approval. After approval, the seeded memory file appears in the flat path-tree list (path: `/memories/seed-{timestamp}.md`) with a correct byte count in the aria-label. Clicking the path expands an inline preview showing "This is a seeded memory proposal for development testing." The Edit button swaps to textarea mode; the Delete button with window.confirm deletes the file and removes it from the list.
**Why human:** Test 3 was blocked in UAT because Test 2 failed (no pill rendered, no memory could be persisted to inspect). With the lifecycle fix landed, Test 3 is now unblocked. MemoryStoreService data-flow and the inspector's edit/delete interactions require a live browser.

---

## Gaps Summary

**Status: gaps_found.** The operator UAT re-run (2026-05-31) confirmed plan 03-06 fixed the pill *render* path — the pending pill now appears on /chat and "Save to memory" shows an in-chat ✓ confirmation. But the re-run surfaced two deeper SC3 gaps in the **approve→execute→persist→tool_result** lifecycle, both diagnosed in `.planning/debug/dev-seed-approval-no-persist-and-unpaired-tooluse.md`:

- **SC3-NO-PERSIST (major):** Approving a pending memory pill does not write to `AppData.memoryFiles`; `/settings/memory` stays empty. `onBlockAction` only sets `status: 'approved'` — `MemoryToolExecutor`/`MemoryStoreService.writeFile` is never invoked. UAT Test 3 fails.
- **SC3-UNPAIRED-TOOLUSE (major):** After approval, the stored conversation holds a `tool_use` block with no paired `tool_result`. `chat-block-serializer.ts` emits `approved` tool_use as a real wire block, so the next message is rejected by the Anthropic API (400). The conversation is bricked.

**Resolution decision (user-delegated, 2026-05-31): Option A — wire real persistence now.** On approve, execute the memory tool → persist to `memoryFiles` → append a paired `ToolResultBlock` (which also fixes SC3-UNPAIRED-TOOLUSE). SC5-compliant: the executor is injected into the UI container `chat-page.component.ts` (SC5 names only `chat.service.ts`); the agentic `while`-loop stays deferred to Phase 4 and will reuse this plumbing. This bends design decision D-12 ("scaffold dormant in Phase 3") in favor of the as-written UAT SC3 — documented here and in the debug session.

Criteria standing after the re-run:

- SC1 (V4→V5 migration): ✓ verified — unchanged.
- SC2 (UserProfile → AI): ✓ wired; UAT Test 1 passed; no regression in 03-06.
- SC3 (memory pill end-to-end): ✗ **gaps_found** — render fixed (03-06) but approve→persist and approve→tool_result are missing (two gaps above).
- SC4 (prompt-injection + tool-arg validation): ~ partial, accepted per UAT Test 4 user decision; content-field validators deferred to Phase 4.
- SC5 (no agentic loop): ✓ grep gate confirms zero `ToolRegistryService`/`MemoryToolExecutor` imports in `chat-page.component.ts` and `chat.service.ts`. **Note:** Option A injects a tool executor into `chat-page.component.ts` — the gap-closure plan must keep `chat.service.ts` clean and confirm the SC5 grep gate still passes for `chat.service.ts` (and decide whether the chat-page gate text needs revising vs. routing execution through a new thin service).

Next: `/gsd-plan-phase 3 --gaps` consumes the `gaps:` frontmatter block above to produce a gap-closure plan; then `/gsd-execute-phase 3 --gaps-only`.

---

_Verified: 2026-05-31T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after plan 03-06 gap closure (UAT Test 2 dev-seed lifecycle fix)_
