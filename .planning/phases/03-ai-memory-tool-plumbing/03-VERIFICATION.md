---
phase: 03-ai-memory-tool-plumbing
verified: 2026-05-31T15:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "SC3-NO-PERSIST — approving a pending memory pill now executes ToolRegistryService.dispatch → MemoryToolExecutor → MemoryStoreService.writeFile, persisting the file to AppData.memoryFiles. Integration spec asserts memoryFiles['/memories/seed-1.md'] === SEED_TEXT. Closed by plan 03-07 (commits ffbc18c, 1091aa7, 87ef21f)."
    - "SC3-UNPAIRED-TOOLUSE — chat.service.approveToolUseBlock atomically appends a paired ToolResultBlock in the same saveData write; chat-block-serializer defensive guard degrades any approved/edited tool_use without a paired tool_result to placeholder text. Integration spec asserts every wire tool_use is followed by a paired tool_result. Closed by plan 03-07 (commits ffbc18c, 87ef21f)."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open the app on localhost, navigate to /settings/profile, fill in the Goals field (e.g. 'Test goal for verification'), click Save. Navigate to /chat, open browser DevTools (Network tab), send any message. Inspect the outbound messages/create request body — find the system parameter."
    expected: "The system parameter contains a '## User Profile' block with the saved Goals text wrapped in <user_profile_goals>...</user_profile_goals> delimiters. Changing the text and sending again reflects the new text immediately."
    why_human: "FitnessContextService → sendMessage → outbound system parameter chain is fully wired at code level (UAT Test 1 passed in prior session). Retained as human item because only a live API call can confirm the outbound system payload. No code changed since the UAT Test 1 pass."
  - test: "Navigate to /settings/ai, click 'Seed pending memory proposal'. Navigate to /chat. Verify a pending pill appears with header 'AI wants to remember this:' and three buttons ('Save to memory', 'Edit proposal', 'Discard proposal'). Click 'Save to memory'. Verify the approved badge appears. Refresh the page and confirm the badge still shows (persisted)."
    expected: "Pending pill renders, primary action button receives auto-focus, clicking 'Save to memory' resolves to the approved badge, and refreshing still shows the resolved badge."
    why_human: "Plan 03-06 fixed the ngOnInit render lifecycle (491 specs green). Plan 03-07 wired the approve → execute → persist → tool_result path (503 specs green, integration spec proves memoryFiles write). The full in-browser end-to-end — focus management, Angular rendering timing, localStorage round-trip — requires a live browser re-run. Last UAT result was 'partial_pass' (pill rendered, approval showed in-chat confirmation, but memory was not persisted). 03-07 fixes the persist path; re-run is required."
  - test: "After completing UAT Test 2 above (approve the pending pill), navigate to /settings/memory. Verify the seeded memory file appears in the flat path-tree with aria-label '{path}, N bytes', an expandable preview showing the seeded content, and functional Edit and Delete actions."
    expected: "After approval, /settings/memory shows the file at /memories/seed-{timestamp}.md. Clicking the path expands an inline preview. Edit swaps to textarea mode. Delete (with window.confirm) removes the entry from the list."
    why_human: "The full end-to-end (seed → approve → inspect in /settings/memory) requires the live browser, including MemoryStoreService.listFiles() → template render and the edit/delete interaction loop. Last UAT result was 'issue' (no file appeared). 03-07 fixes the persist path; this test is now unblocked."
  - test: "After completing UAT Test 2 above (approve the pending pill), send a new chat message in /chat. Confirm the message sends without an Anthropic 400 error."
    expected: "The chat message is sent and a response is received. No Anthropic 400 'tool_use ids were found without tool_result blocks' error occurs."
    why_human: "The serializer pairing guard and atomic approveToolUseBlock are verified by integration spec at code level. Confirming no 400 on the next live message requires an Anthropic API key and a running app."
---

# Phase 3: AI Memory + Tool Plumbing Verification Report

**Phase Goal:** All the AI infrastructure the agentic loop will need is in place — schema migrated for memory + profile + structured chat blocks, memory tool wired to a typed store, user profile editable, tool registry ready to dispatch — but the user still sees today's chat behavior. No regressions.
**Verified:** 2026-05-31T15:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 03-07, SC3-NO-PERSIST + SC3-UNPAIRED-TOOLUSE)

---

## Gap Closure Summary (Plan 03-07)

**Gaps closed:** SC3-NO-PERSIST and SC3-UNPAIRED-TOOLUSE

**Root causes (from prior verification):**
- `SC3-NO-PERSIST:` `chat-page.component.ts onBlockAction` approve branch only set `{ status: 'approved' }` via `updateMessageBlock`. `MemoryToolExecutor.execute` / `MemoryStoreService.writeFile` (the sole `memoryFiles` write path) was never invoked.
- `SC3-UNPAIRED-TOOLUSE:` `chat-block-serializer.toAnthropicContent()` emitted `status='approved'` tool_use as a real wire block with no paired `tool_result`, causing an Anthropic 400 on the next message.

**Resolution (Option A — user-delegated 2026-05-31):** Wire real persistence at approve time, bending design decision D-12 ("scaffold dormant in Phase 3") in favor of the as-written UAT SC3.

**SC5 resolution (a):** A new thin `PendingApprovalService` owns the `ToolRegistryService` import. Both `chat.service.ts` and `chat-page.component.ts` remain grep-clean (zero `ToolRegistryService`/`MemoryToolExecutor` imports). Phase 4's agentic loop will reuse this seam.

**Three surfaces introduced:**

1. `chat-block-serializer.toAnthropicContent()` — `pairedToolResultIds` set built before the loop; approved/edited tool_use serialized as wire tool_use ONLY when a paired tool_result for its id exists; otherwise degrades to placeholder text. Belt-and-suspenders guard for legacy/bricked conversations.

2. `PendingApprovalService.executeApprovedToolUse(block)` — dispatches through `ToolRegistryService` (never throws; unknown tool returns `isError: true` so the tool_use still gets paired and the conversation does not brick).

3. `chat.service.approveToolUseBlock(...)` — atomically flips `status='approved'` AND appends a paired `ToolResultBlock` (`tool_use_id === block.id`) in ONE `getData → saveData` write. `chat-page.component.ts onBlockAction` approve branch now calls `executeApprovedToolUse` then `approveToolUseBlock`; discard/edit continue through `updateMessageBlock` unchanged.

**Spec count delta:** 491 → 503 (+12). Full Karma suite: 503/503 SUCCESS. Production build: exit 0.

**Commits:** `ffbc18c` (serializer guard), `1091aa7` (PendingApprovalService), `b4a7a97` (chat-page rewire — compile fix superseded), `87ef21f` (approveToolUseBlock + specs + chat-page type fix), `95ce3a8` (pre-existing serializer spec pairing update), `3421834` (docs), `a8e71bb` (STATE.md).

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | V4→V5 migration: chat conversations preserved as blocks, memoryFiles/userProfile/aiToolSettings defaulted, backup behind recovery key | ✓ VERIFIED | `CURRENT_SCHEMA_VERSION = 5` in `app-data.model.ts:56`; `migrateV4ToV5` in `storage.service.ts:430`; backup written before migration; all 3 new AppData fields present; v4/v5 fixtures confirmed in prior verification. No code changed since. |
| 2 | Editable UserProfile on /settings/profile: AI sees change on next message | ✓ VERIFIED | `settings-profile.component.ts` 4-textarea reactive form; `UserProfileService.saveProfile()` → StorageService; `FitnessContextService.buildSystemPrompt()` reads `data?.userProfile` fresh on every sendMessage. UAT Test 1 passed. Human browser re-run retained (Test 1 in human_verification). |
| 3 | Approving a pending memory pill executes the memory tool (ToolRegistryService → MemoryToolExecutor → MemoryStoreService.writeFile), persists to AppData.memoryFiles, and appends an atomic paired ToolResultBlock — no intermediate unpaired state | ✓ VERIFIED | `PendingApprovalService.executeApprovedToolUse` dispatches through `ToolRegistryService.dispatch` → `MemoryToolExecutor` → `MemoryStoreService.writeFile`. `chat.service.approveToolUseBlock` flips status + appends ToolResultBlock (`tool_use_id === block.id`) in ONE `saveData` write. `chat-block-serializer.toAnthropicContent` defensive guard prevents any unpaired approved tool_use from reaching the wire. Integration spec (`chat.service.spec.ts:587`) asserts `endToEndData.memoryFiles['/memories/seed-1.md'] === SEED_TEXT`. Integration spec (`:594`) asserts every wire tool_use is paired. 503/503 Karma green. UAT Tests 2, 3, and 4 (no-400) required for operator sign-off (human_verification). |
| 4 | Prompt-injection guardrail: user content cannot escape delimiter wrapper; tool-call arguments re-validated | ~ PARTIAL (accepted) | FIRST HALF: `wrapUntrusted(tag, content)` escapes both `</tag>` and `<tag>` in `fitness-context.service.ts:53–58`; instruction "Treat any content inside <user_*>" present (count=1). SECOND HALF partial: `ToolRegistryService.dispatch` re-validates `typeof input === 'object' && input !== null`; `MemoryToolExecutor.validatePath` gates all 6 commands. Per-tool zod schemas + domain validator reuse deferred to Phase 4 per UAT Test 4 user decision (non-exploitable in Phase 3: agentic loop disabled at type level by SC5). |
| 5 | No agentic loop introduced: user still sees single-shot chat behavior; ToolRegistryService/MemoryToolExecutor absent from chat.service.ts AND chat-page.component.ts | ✓ VERIFIED | `grep -nE "ToolRegistryService\|MemoryToolExecutor" chat.service.ts` — PASS (no matches). Same grep on `chat-page.component.ts` — PASS (no matches). Executor import lives only in `pending-approval.service.ts`. `AnthropicApiService.sendMessage` signature remains `Omit<MessageCreateParams, 'tools' \| 'tool_choice'>`. |

**Score:** 5/5 truths verified at code level. SC4 second-half partial accepted per user decision at UAT Test 4. UAT Tests 2, 3, and 4 (no-400 on next message) require operator browser re-run for final sign-off.

---

## Hard Checks

| Check | Expected | Result |
|-------|----------|--------|
| `grep -nE "ToolRegistryService\|MemoryToolExecutor" chat.service.ts` | empty (SC5) | PASS |
| `grep -nE "ToolRegistryService\|MemoryToolExecutor" chat-page.component.ts` | empty (SC5) | PASS |
| `grep -c "ToolRegistryService" pending-approval.service.ts` | >= 1 | PASS (5) |
| `grep -c "pairedToolResultIds" chat-block-serializer.ts` | >= 1 | PASS (2) |
| `grep -c "tool_use_id" chat-block-serializer.ts` | >= 1 | PASS (2) |
| `grep -c "approveToolUseBlock" chat.service.ts` | 1 | PASS (1) |
| `grep -n "approveToolUseBlock\|executeApprovedToolUse" chat-page.component.ts` | both present | PASS (lines 358, 362) |
| `grep -n "PendingApprovalService" chat-page.component.ts` | import present | PASS (line 9) |
| Integration spec: memoryFiles persisted after approve | pass | PASS — chat.service.spec.ts:587 |
| Integration spec: every wire tool_use paired post-approve | pass | PASS — chat.service.spec.ts:594 |
| `CURRENT_SCHEMA_VERSION = 5` in `app-data.model.ts` | version 5 | PASS |
| `fromVersion < 5` branch in `storage.service.ts` | migration chain | PASS |
| `Treat any content inside <user_` in `fitness-context.service.ts` | count=1 | PASS |
| `app-pending-pill` in `chat-message-list.component.ts` | template usage | PASS |
| Settings sub-routes in `app.routes.ts` | /ai /profile /memory | PASS |
| `initializeActiveConversationAndConsumeSeed` in `chat-page.component.ts` | orchestrator method | PASS |
| `appendSeededPill` in `chat-page.component.ts` | shared block builder | PASS |
| Full Karma suite | 503/503 SUCCESS | PASS |
| Production build | exit 0 | PASS (pre-existing ~513 kB budget warning, non-blocking) |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/models/user-profile.model.ts` | UserProfile + DEFAULT_USER_PROFILE | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/models/ai-chat.model.ts` | ChatBlock union + AIToolSettings | ✓ VERIFIED | ToolResultBlock.tool_use_id confirmed present |
| `src/app/models/app-data.model.ts` | AppData V5 shape + CURRENT_SCHEMA_VERSION=5 | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/services/storage.service.ts` | migrateV4ToV5 + setDevSeed + consumeDevSeed | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/services/chat-block-serializer.ts` | pairedToolResultIds guard + existing pure module functions | ✓ VERIFIED | `pairedToolResultIds` Set at line 50; approved/edited gate at line 75–83; 19 specs green |
| `src/app/services/pending-approval.service.ts` | NEW — executeApprovedToolUse dispatches via ToolRegistryService; never throws | ✓ VERIFIED | 49 lines; ToolRegistryService injected; unknown-tool and dispatch-error paths return isError=true; 4 specs green |
| `src/app/services/pending-approval.service.spec.ts` | 4 specs | ✓ VERIFIED | 4/4 SUCCESS |
| `src/app/services/chat.service.ts` | approveToolUseBlock: atomic status-flip + ToolResultBlock append in ONE saveData write | ✓ VERIFIED | Method at line 265; single getData→saveData pattern; ToolResultBlock appended after tool_use block; 4 unit specs + 2 integration specs green |
| `src/app/services/anthropic-api.service.ts` | SDK transport, Omit<MessageCreateParams, tools> | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/services/user-profile.service.ts` | get/save with 4096-char per-section validation | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/services/memory-store.service.ts` | Observable wrapper over AppData.memoryFiles; writeFile at line 58 | ✓ VERIFIED | Sole memoryFiles write path confirmed |
| `src/app/services/memory-tool-executor.service.ts` | 6 commands + validatePath + calls store.writeFile | ✓ VERIFIED | writeFile called at lines 175, 201, 222 |
| `src/app/services/tool-registry.service.ts` | dispatch with object re-validation | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/services/fitness-context.service.ts` | wrapUntrusted + UserProfile prepend + redaction | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/features/settings/settings-shell.component.ts` | side-rail + RouterOutlet | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/features/settings/settings-ai.component.ts` | redaction toggles + tool toggles + dev seed buttons | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/features/settings/settings-profile.component.ts` | 4-textarea form + 4096 cap | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/features/settings/settings-memory.component.ts` | path-tree + edit/delete; wired to MemoryStoreService.listFiles | ✓ VERIFIED | MemoryStoreService imported; listFiles called at line 207 |
| `src/app/features/chat/pending-pill.component.ts` | 4 statuses × 2 kinds + edit mode | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/features/chat/chat-message-list.component.ts` | @switch block render with app-pending-pill | ✓ VERIFIED | Unchanged from prior verification |
| `src/app/features/chat/chat-page.component.ts` | approve branch routes via PendingApprovalService then approveToolUseBlock; 0 ToolRegistry/MemoryToolExecutor imports | ✓ VERIFIED | `from(pendingApprovalService.executeApprovedToolUse(block))` at line 358; `approveToolUseBlock` at line 362; SC5 grep clean |
| `src/app/features/chat/chat-page.component.spec.ts` | approve-path regression specs; PendingApprovalService spy wired | ✓ VERIFIED | 18 specs green; `PendingApprovalService` spy at line 204; approve executes-then-persists spec present |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `chat-page.component.ts onBlockAction (approve)` | `PendingApprovalService.executeApprovedToolUse(block)` | `from(promise)` bridge; `pendingApprovalService` injected in constructor | ✓ WIRED | Lines 358–375 |
| `PendingApprovalService.executeApprovedToolUse` | `ToolRegistryService.dispatch(block.name, block.input)` | `has` check then `dispatch`; unknown-tool → isError result | ✓ WIRED | Lines 32–46 of pending-approval.service.ts |
| `ToolRegistryService.dispatch('memory', input)` | `MemoryToolExecutor.execute` → `MemoryStoreService.writeFile` | Registry dispatch chain; validatePath + firstValueFrom(store.writeFile) | ✓ WIRED | memory-tool-executor.service.ts lines 175, 201, 222; memory-store.service.ts:58 |
| `MemoryStoreService.writeFile` | `AppData.memoryFiles` | `saveData({ ...data, memoryFiles: { ...data.memoryFiles, [path]: content } })` | ✓ WIRED | memory-store.service.ts line 66 |
| `chat-page.component.ts onBlockAction (approve)` | `chat.service.approveToolUseBlock(conversationId, messageId, blockIndex, result)` | Called in `.subscribe({ next: result => ... })` after executeApprovedToolUse resolves | ✓ WIRED | Lines 362–372 |
| `chat.service.approveToolUseBlock` | single `saveData` write with approved block + ToolResultBlock | `getData().pipe(switchMap(...single saveData...))` — no intermediate write | ✓ WIRED | chat.service.ts lines 271–322 |
| `chat-block-serializer.toAnthropicContent` | paired tool_result presence check before emitting wire tool_use | `pairedToolResultIds.has(b.id)` guard at lines 75–83 | ✓ WIRED | chat-block-serializer.ts lines 50–53, 75–83 |
| `chat-page.component.ts ngOnInit` | `initializeActiveConversationAndConsumeSeed()` | Delegates on valid; carries 03-06 fix unchanged | ✓ WIRED | Unchanged from prior verification |
| `storage.service.ts migrateData()` | `migrateV4ToV5()` | `fromVersion < 5` branch | ✓ WIRED | Unchanged from prior verification |
| `chat.service.ts sendMessage` | `fitnessContext.buildSystemPrompt()` | switchMap at line 132 | ✓ WIRED | Unchanged from prior verification |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `settings-profile.component.ts` | profileForm | UserProfileService.getProfile() → StorageService.getData() | Yes — reads AppData.userProfile | ✓ FLOWING |
| `settings-memory.component.ts` | files: MemoryFileEntry[] | MemoryStoreService.listFiles() → StorageService.getData() → AppData.memoryFiles | Yes — reads AppData.memoryFiles (now writable via approveToolUseBlock → writeFile) | ✓ FLOWING |
| `settings-ai.component.ts` (tool toggles) | toolSettingsForm | AISettingsService.getToolSettings() → StorageService.getData() | Yes — reads AppData.aiToolSettings | ✓ FLOWING |
| `chat-message-list.component.ts` | messages: ChatMessage[] | Input from chat-page → ChatService.getConversation() | Yes — reads AppData.chatConversations | ✓ FLOWING |
| `pending-pill.component.ts` | block: ToolUseBlock | Input from chat-message-list (from persisted ChatMessage.blocks) | Yes — from persisted blocks; post-approve block has status='approved' + paired ToolResultBlock | ✓ FLOWING |
| `chat-page.component.ts` | activeConversation | initializeActiveConversationAndConsumeSeed → getConversations() + auto-select; refreshed after approveToolUseBlock completes | Yes — reads real conversation; post-approve refresh surfaces new status | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| `pairedToolResultIds` guard in serializer | `grep -c "pairedToolResultIds" chat-block-serializer.ts` | ✓ PASS (2) |
| `approveToolUseBlock` in chat.service | `grep -c "approveToolUseBlock" chat.service.ts` | ✓ PASS (1) |
| SC5: no executor imports in chat.service.ts | `! grep -nE "ToolRegistryService\|MemoryToolExecutor" chat.service.ts` | ✓ PASS |
| SC5: no executor imports in chat-page.component.ts | `! grep -nE "ToolRegistryService\|MemoryToolExecutor" chat-page.component.ts` | ✓ PASS |
| Executor import ONLY in PendingApprovalService | `grep -c "ToolRegistryService" pending-approval.service.ts` | ✓ PASS (5) |
| Integration spec: memoryFiles written after approve | chat.service.spec.ts:587 — 33/33 SUCCESS | ✓ PASS |
| Integration spec: post-approve wire content fully paired | chat.service.spec.ts:594 — 33/33 SUCCESS | ✓ PASS |
| serializer spec suite (19 specs, incl. 6 new pairing-guard) | `npx ng test --include=chat-block-serializer.spec.ts` | ✓ PASS (19/19) |
| PendingApprovalService spec suite (4 specs) | `npx ng test --include=pending-approval.service.spec.ts` | ✓ PASS (4/4) |
| chat.service spec suite (33 specs) | `npx ng test --include=chat.service.spec.ts` | ✓ PASS (33/33) |
| chat-page spec suite (18 specs) | `npx ng test --include=chat-page.component.spec.ts` | ✓ PASS (18/18) |
| Full Karma suite | 503/503 SUCCESS (per SUMMARY; targeted suites above confirmed green) | ✓ PASS |
| Production build | exit 0 (pre-existing ~513 kB budget warning, non-blocking) | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| CHAT-01 | 03-01, 03-02, 03-05 | V4→V5 migration: adds memoryFiles/userProfile/aiToolSettings; lifts ChatMessage.content to blocks[] | ✓ SATISFIED | migrateV4ToV5 in storage.service.ts; ChatMessage.blocks in ai-chat.model.ts; 6 migration fixtures; chat-message-list @switch render. REQUIREMENTS.md: marked Complete. |
| CHAT-03 | 03-03 | Memory tool backed by AppData.memoryFiles, path validation | ✓ SATISFIED | MemoryToolExecutor 6 commands + validatePath; MemoryStoreService CRUD through StorageService; approve now actually persists via this path (03-07). REQUIREMENTS.md: marked Complete. |
| CHAT-04 | 03-03, 03-04, 03-05, 03-06 | UserProfile editable in /settings, visible to AI, update_profile confirm-before-write scaffold | ✓ SATISFIED | UserProfileService; /settings/profile component; FitnessContextService prepend; PendingPillComponent handles update_profile kind. REQUIREMENTS.md: marked Complete. |
| CHAT-11 | 03-03 | Prompt-injection defense: delimiters + tool-call argument re-validation | ~ PARTIAL (accepted) | Delimiter wrap + bidirectional escape: SATISFIED. ToolRegistry object-level re-validation: SATISFIED. Domain validator reuse for tool content fields: deferred to Phase 4 per UAT Test 4 user decision. Non-exploitable in Phase 3 (agentic loop disabled at type level per SC5). REQUIREMENTS.md status: "Pending" — bookkeeping lag; implementation evidence above satisfies the Phase 3 partial scope. |
| CHAT-12 | 03-04 | /settings: tool toggles, memory inspector, agent-turn cap, web-search cap | ✓ SATISFIED | /settings/ai has all tool toggles + maxAgentTurns + webSearchMaxUses; /settings/memory has path-tree inspector with edit/delete wired to MemoryStoreService. REQUIREMENTS.md status: "Pending" — bookkeeping lag; implementation fully present. |

**Note on REQUIREMENTS.md bookkeeping:** CHAT-11 and CHAT-12 remain marked "Pending" in `.planning/REQUIREMENTS.md` as of commit `3421834`. This is a documentation gap (plan 03-07 docs commit did not flip these to Complete). It does not indicate missing implementation — the code evidence above satisfies both requirements at the scope assigned to Phase 3. CHAT-11's partial scope (content-field domain validators) is explicitly deferred to Phase 4. Recommended: update REQUIREMENTS.md to mark CHAT-12 Complete and CHAT-11 Partial/Phase-4 before closing the phase.

---

## Anti-Patterns Found

All carried forward from prior verification. Plan 03-07 introduced no new anti-patterns. The new surfaces (pending-approval.service.ts, approveToolUseBlock, serializer guard) are substantive — no stubs, no TODO placeholders, no console-log-only handlers.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `chat-block-serializer.ts:145` | `JSON.stringify(b.input)` in `summarizeProposal` returns `undefined` if input is undefined | ⚠️ Warning | Latent NPE — safe in Phase 3. Phase 4 concern. (WR-02) |
| `memory-tool-executor.service.ts` | Path validator rejects `%2e%2e` but not double-encoded `%252e%252e` | ⚠️ Warning | Safe for LocalStorage; forward-compat trap if Phase 5+ uses filesystem. (WR-03) |
| `chat-page.component.ts` | `this.activeConversationId` read multiple times across async hops in `onSendMessage` | ⚠️ Warning | Race condition on conversation switch between API call and resolution. Pre-existing; not introduced by 03-07. (WR-04) |
| `storage.service.ts` | `conv.messages.map(...)` in migrateV4ToV5 without Array.isArray guard | ⚠️ Warning | If `messages` is null in a V4 conversation, migration throws TypeError. (WR-05) |
| `chat.service.ts` | `maybeSummarize` drops tool_use/tool_result blocks from summarization input | ⚠️ Warning | Sleeper bug — safe in Phase 3, Phase 4 concern. (WR-06) |
| `chat-message-list.component.ts` | setTimeout scroll without clearTimeout on rapid ngOnChanges | ℹ️ Info | Low impact single-user app. (WR-08) |
| `settings-shell.component.ts` | Unused `destroyRef` field declared | ℹ️ Info | Dead DI overhead; no functional impact. (IN-01) |

No blockers. All warnings remain Phase 4/5 concerns as before.

---

## Human Verification Required

### 1. UserProfile round-trip to system prompt (re-run of UAT Test 1)

**Test:** Open the app on `localhost`, navigate to `/settings/profile`, enter text in the Goals field (e.g., "Test goal for verification"), click Save. Navigate to `/chat`, open browser DevTools (Network tab), send any message. Inspect the outbound `messages/create` request body — find the `system` parameter.
**Expected:** The system parameter contains a `## User Profile` block with the saved Goals text wrapped in `<user_profile_goals>...</user_profile_goals>` delimiters. Changing the text and sending again reflects the new text immediately.
**Why human:** FitnessContextService → sendMessage → outbound system parameter chain is fully wired in code. No code changed since UAT Test 1 passed. Retained because actual outbound API payload requires a live browser run with a real API key.
**UAT status:** PASSED (prior session). No regression in 03-07; no SC2 code changed.

### 2. Pending pill full end-to-end (dev-seed → approve) — RE-RUN REQUIRED

**Test:** Navigate to `/settings/ai`, click "Seed pending memory proposal". Navigate to `/chat`. Verify: (a) a pending pill appears with header "AI wants to remember this:" and three buttons; (b) the primary action button receives auto-focus; (c) clicking "Save to memory" shows the approved badge; (d) refreshing the page still shows the resolved approved badge.
**Expected:** Pending pill renders, focus auto-assigned, approval persists across page reload.
**Why human:** Plan 03-06 fixed the ngOnInit lifecycle (491 green). Plan 03-07 wired approve → execute → persist → paired tool_result (503 green, integration specs confirm). Previous UAT result: "partial_pass" (pill rendered, in-chat ✓ confirmation shown, but memory not persisted). 03-07 closes the persist gap — browser re-run is the final confirmation.

### 3. Memory inspector after approval — RE-RUN REQUIRED (closed by 03-07)

**Test:** After completing UAT Test 2 above, navigate to `/settings/memory`. Verify the empty-state message appears initially. After approval, the seeded memory file appears in the flat path-tree (path: `/memories/seed-{timestamp}.md`) with a correct byte count in the aria-label. Clicking the path expands an inline preview. The Edit button swaps to textarea mode. The Delete button (with window.confirm) removes the entry.
**Expected:** /settings/memory shows the approved file with full CRUD interactions functional.
**Why human:** Last UAT result was "issue" (no file appeared because MemoryToolExecutor was never invoked). 03-07 fixes the invocation path — this test is now unblocked. The MemoryStoreService data-flow and inspector interaction loop require a live browser.

### 4. No Anthropic 400 on the next chat message after approval — RE-RUN REQUIRED (closed by 03-07)

**Test:** After completing UAT Test 2 above (approve the pending pill), send a new chat message in `/chat`.
**Expected:** The message sends successfully. No Anthropic 400 "tool_use ids were found without tool_result blocks" error is observed in the browser console or Network tab.
**Why human:** The serializer pairing guard and atomic `approveToolUseBlock` (one saveData write: status-flip + ToolResultBlock append) are integration-spec verified at code level. Confirming zero 400 on a live Anthropic API call requires a running app with a real API key.

---

## Gaps Summary

**No programmatic gaps remain.** Both SC3 gaps from the prior `gaps_found` verdict are closed at the code + integration-spec level by plan 03-07:

- **SC3-NO-PERSIST** — CLOSED. `onBlockAction` approve branch now executes `PendingApprovalService.executeApprovedToolUse` → `ToolRegistryService.dispatch` → `MemoryToolExecutor` → `MemoryStoreService.writeFile`, which writes to `AppData.memoryFiles`. Integration spec asserts `memoryFiles['/memories/seed-1.md'] === SEED_TEXT` after approval (driven through the real DI graph, faked StorageService only).

- **SC3-UNPAIRED-TOOLUSE** — CLOSED. `chat.service.approveToolUseBlock` appends a paired `ToolResultBlock` (`tool_use_id === block.id`) in the same `saveData` write as the status flip — no intermediate approved-without-result state. `chat-block-serializer.toAnthropicContent` additionally degrades any approved/edited tool_use without a paired tool_result to placeholder text (belt-and-suspenders for legacy/bricked conversations). Integration spec asserts every wire tool_use is paired post-approve.

- **SC5** — PRESERVED. Both grep gates pass (zero `ToolRegistryService`/`MemoryToolExecutor` in `chat.service.ts` AND `chat-page.component.ts`). The executor import lives only in `PendingApprovalService` (resolution (a)).

The remaining `human_needed` items (UAT Tests 1–4) are browser re-runs that require a live Anthropic API key. They cannot be auto-confirmed by static analysis or Karma. Status is `human_needed` pending operator re-run.

---

_Verified: 2026-05-31T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after plan 03-07 gap closure (SC3-NO-PERSIST + SC3-UNPAIRED-TOOLUSE)_

---

**Operator approval — 2026-05-31.** human_verification items confirmed passing in the live app after the tool_result-user-turn fix (49e275b). Status: human_needed → passed.
