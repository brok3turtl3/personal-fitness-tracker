---
phase: 03-ai-memory-tool-plumbing
plan: 02
subsystem: ai-transport
tags: [angular, typescript-strict, anthropic-sdk, chat-blocks, serializer, sc5-enforcement, transport-layer]

# Dependency graph
requires:
  - phase: 03-ai-memory-tool-plumbing
    plan: 01
    provides: "ChatBlock discriminated union, AIToolSettings, V5 baseline (memoryFiles/userProfile/aiToolSettings auto-defaulted), interim blocksToText() in chat.service.ts marked for replacement"
provides:
  - "@anthropic-ai/sdk ^0.92.0 installed; SDK Message/MessageParam/MessageCreateParams own the wire surface"
  - "chat-block-serializer.ts pure module: toAnthropicContent() + fromAnthropicMessage() — single seam between persisted ChatBlock[] and Anthropic ContentBlockParam[]"
  - "anthropic-api.service.ts SDK transport rewrite — dangerouslyAllowBrowser:true, per-key client cache, APIError mapping, optional requestId field"
  - "Type-level SC5 enforcement — sendMessage signature is Omit<MessageCreateParams, 'tools' | 'tool_choice'>; tsc rejects callers passing the forbidden Phase 3 fields"
  - "chat.service.ts buildApiMessages returns MessageParam[] via toAnthropicContent; assistant response parse uses fromAnthropicMessage; tokenEstimate (assistant) uses response.usage.output_tokens (replaces estimateTokens heuristic)"
  - "CLAUDE_MODELS updated to current family: claude-sonnet-4-6 (default), claude-haiku-4-5, claude-opus-4-7"
affects:
  - 03-03 (memory + tool-registry services): wire-side bridge already exists; tool dispatcher's ToolUseBlock/ToolResultBlock types map cleanly through chat-block-serializer
  - 03-04 (settings sub-routes): no direct impact — model dropdown labels/values updated through CLAUDE_MODELS
  - 03-05 (chat-page block rendering): no direct impact — block-rendering surface unchanged from Plan 01
  - Phase 4 agentic loop: drops onto already-typed surfaces with a small diff (just remove the Omit, register tools[], dispatch tool_use blocks)

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk ^0.92.0 (runtime dependency) — net-additive Phase 3 dep per RESEARCH.md STACK"
  patterns:
    - "Pure-module bridge between persistence shape and SDK wire shape (mirrors validators.ts: no @Injectable, no class, exported functions only)"
    - "Type-level invariant enforcement via Omit<X, K1 | K2> — TypeScript rejects forbidden Phase-3 fields at the call site"
    - "Compile-saving aliases for transitional refactors — type X = SDKType used as throwaway shim across a single plan, removed when consumers migrate"

key-files:
  created:
    - "src/app/services/chat-block-serializer.ts (pure module — toAnthropicContent + fromAnthropicMessage; D-15, D-16)"
    - "src/app/services/chat-block-serializer.spec.ts (13 specs covering full round-trip + 4-status tool_use matrix + forward-compat unknown-block lift)"
  modified:
    - "package.json (+@anthropic-ai/sdk ^0.92.0)"
    - "package-lock.json (1251 packages added)"
    - "src/app/models/ai-chat.model.ts (CLAUDE_MODELS → claude-sonnet-4-6 / claude-haiku-4-5 / claude-opus-4-7)"
    - "src/app/services/anthropic-api.service.ts (full rewrite to SDK transport; AnthropicApiError preserves statusCode+errorType, gains optional requestId; sendMessage uses Omit; mapError catches Anthropic.APIError; friendlyMessage switch verbatim)"
    - "src/app/services/anthropic-api.service.spec.ts (rewrite — 15 specs via spyOn(Messages.prototype.create) replacing the 6 fetch-spy specs; full status-code coverage + SC5 runtime audit + requestId propagation)"
    - "src/app/services/chat.service.ts (buildApiMessages returns MessageParam[] via toAnthropicContent; assistant blocks built via fromAnthropicMessage; tokenEstimate from response.usage.output_tokens; maybeSummarize uses fromAnthropicMessage on the response; interim blocksToText helper removed)"
    - "src/app/services/chat.service.spec.ts (mockApiResponse → SDK Message shape; +4 new specs: SC5 runtime audit, ContentBlockParam[] outbound, blocks-length round-trip, tokenEstimate from usage.output_tokens)"
    - "src/app/services/ai-settings.service.spec.ts (Rule 1 deviation — 6 references to old model ID 'claude-sonnet-4-5-20250929' replaced with 'claude-sonnet-4-6' to satisfy validator)"

key-decisions:
  - "Compile-saving type aliases (AnthropicMessage = MessageParam, AnthropicResponse = Message) introduced in Task 3 then removed in Task 4 — kept the tree compiling across the boundary between deleting old interfaces and the chat.service.ts/spec.ts migration. Aliases were `type` not `interface`, satisfying the Task 3 verification gate."
  - "SDK error.message composition workaround — the SDK builds err.message as '<status> <body-json>', so mapError extracts err.error.message (the typed body payload) for the friendly-message mapping. Without this, the friendly-message contract regresses on 400/418 (which return the API's message verbatim)."
  - "fromAnthropicMessage for the summary parse path too — instead of duplicating the inline `block.type === 'text'` filter with strict TS narrowing, route through fromAnthropicMessage (already typed as TextBlock) and apply a domain-typed filter on the resulting ChatBlock[]."
  - "Spec spy strategy — spied on Messages.prototype.create (and countTokens) directly; this works because the SDK constructs a per-instance `messages` field by calling the Messages class constructor. Constructor-time seam (passing a fake client) was rejected as more invasive."
  - "type-only chat.service.ts SDK import accepted as widening of the chokepoint — Task 4 plan explicitly directs `import type { MessageParam, Message }` here; the threat-model intent (T-3-SDK-LK) is no SDK runtime usage outside the 2 transport files, which still holds."

patterns-established:
  - "TDD plan-level gate respected for the new code path (Task 2): RED commit (test failing) precedes GREEN commit (implementation). Existing `tdd=true` rewrites in Task 3/4 commit as `refactor`/`feat` because the tests existed already and the work is contract-preserving."
  - "Spec fixture cast pattern: `as unknown as Message` (or `as unknown as Record<string, unknown>` for assertion intermediates) is the spec-only escape hatch when SDK types require fields that are noise for the test. Production code never uses this pattern."
  - "Type-level invariant via Omit<X, K> — apply to public service signatures where a contract forbids a field at the call site; remove the Omit when the contract changes (Phase 4 lifts SC5)."

requirements-completed: [CHAT-01]

# Metrics
duration: 14m
completed: 2026-05-03
---

# Phase 3 Plan 02: @anthropic-ai/sdk transport rewrite + chat-block-serializer Summary

**Adopt `@anthropic-ai/sdk ^0.92.0` at the transport layer (D-17). Ship `chat-block-serializer.ts` as the pure-module bridge between persisted `ChatBlock[]` and Anthropic wire `ContentBlockParam[]` (D-15, D-16). Type-level SC5 enforcement via `Omit<MessageCreateParams, 'tools' | 'tool_choice'>`. ChatService now sends through the serializer for outbound and `fromAnthropicMessage` for inbound — no inline reduce remains.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-05-03T10:55:19Z
- **Completed:** 2026-05-03T11:09:45Z
- **Tasks:** 4/4
- **Files created:** 2 (chat-block-serializer.ts + spec)
- **Files modified:** 7 (package.json/lock, ai-chat.model.ts, anthropic-api.service.ts/spec, chat.service.ts/spec, ai-settings.service.spec.ts)
- **Spec count delta:** Plan 01 baseline 282 → 308 SUCCESS (+26)
  - +13 chat-block-serializer specs (Task 2 — full round-trip + 4-status tool_use matrix + forward-compat)
  - +9 net-new anthropic-api specs (15 new minus 6 deleted fetch-spy specs)
  - +4 net-new chat.service specs (17 vs 13 — SC5 runtime audit, outbound ContentBlockParam[], fromAnthropicMessage round-trip, response.usage.output_tokens)

## Accomplishments

- **`@anthropic-ai/sdk ^0.92.0` installed** as a runtime dependency. Verified version, dependency entry, and chokepoint.
- **`CLAUDE_MODELS` updated** to the current family per AI-SPEC.md §4: `claude-sonnet-4-6` (default), `claude-haiku-4-5`, `claude-opus-4-7`. Sonnet 4.6 stays at index 0 for muscle-memory continuity.
- **`chat-block-serializer.ts` pure module shipped** — single seam between persisted `ChatBlock[]` and Anthropic `ContentBlockParam[]`. Strips `status`/`editedFromText` (T-3-WL); drops `status='discarded'` blocks; replaces `status='pending'` tool_use blocks with a plain-text placeholder (T-3-PT). Spec covers all 12 contract branches plus an empty-array edge case (13 specs total).
- **`anthropic-api.service.ts` rewritten** to SDK transport — default-imports `Anthropic`, type imports from `@anthropic-ai/sdk/resources/messages`. `AnthropicApiError` public surface preserved verbatim (statusCode + errorType still satisfy `chat-page.component.ts:286`); new optional `requestId` 4th constructor arg per AI-SPEC.md §3. `sendMessage` signature: `Omit<MessageCreateParams, 'tools' | 'tool_choice'>` — type-level SC5. `countTokens` added. Per-key client cache with `dangerouslyAllowBrowser: true` and `maxRetries: 2`.
- **Friendly-message switch preserved verbatim** across 401/403/429/400/500/529 + default — `chat-page.component.ts` user-facing strings are byte-identical to the pre-SDK behavior.
- **Spec rewrite for `anthropic-api.service.spec.ts`** — 15 specs (was 6), uses `spyOn(Messages.prototype.create)` and `Messages.prototype.countTokens` with hand-built `Anthropic.APIError` fixtures. Coverage: every status code (401/403/429/400/500/529/418) + network error (statusCode 0, errorType 'NetworkError') + success path + **SC5 runtime audit** (`'tools' in callArgs === false`) + `requestId` propagation + countTokens success and error.
- **`chat.service.ts` wired through the serializer** — `buildApiMessages` returns `MessageParam[]` and uses `toAnthropicContent` for the per-message conversion; sliding-window math (MESSAGE_WINDOW_SIZE=20, TOKEN_WINDOW_SIZE=8000) preserved unchanged. Assistant response uses `fromAnthropicMessage(response)` directly to populate blocks. `assistantMessage.tokenEstimate` now reads `response.usage.output_tokens` (replaces `estimateTokens` heuristic for assistant messages — CONCERNS.md drift item).
- **`maybeSummarize` adapted** — text extraction routes through `fromAnthropicMessage` for the response and a domain-typed inline filter for the summarization input. Sliding-window math unchanged.
- **`chat.service.spec.ts` adapted** — `mockApiResponse` now SDK-shaped (`Message`); 4 new specs cover the SC5 runtime audit, ContentBlockParam[] outbound shape, `fromAnthropicMessage` round-trip, and `response.usage.output_tokens` token-estimate.
- **Compile-saving boundary preserved** — temporary `AnthropicMessage`/`AnthropicResponse` `type` aliases bridged Task 3 and Task 4 atomically; aliases removed in Task 4.
- **Full Karma suite green:** 308/308 SUCCESS. **Production build green** (warn-only on bundle size, +4.0 kB over the 512 kB soft budget).

## Task Commits

Each task was committed atomically (all on `worktree-agent-a4ef27f87fca8c570`):

1. **Task 1: Install @anthropic-ai/sdk + update CLAUDE_MODELS** — `bf03546` (feat)
2. **Task 2 RED: chat-block-serializer failing spec** — `faf9526` (test)
3. **Task 2 GREEN: chat-block-serializer pure module impl** — `deab316` (feat)
4. **Task 3: anthropic-api SDK transport rewrite** — `6ac505d` (refactor)
5. **Task 4: wire chat.service through chat-block-serializer** — `0049fe4` (feat)

## Files Created/Modified

### Created (2)

- `src/app/services/chat-block-serializer.ts` — Pure-module bridge: `toAnthropicContent(blocks: ChatBlock[]): ContentBlockParam[]`, `fromAnthropicMessage(msg: Message): ChatBlock[]`. No `@Injectable`. Header comment locks the pure-module pattern.
- `src/app/services/chat-block-serializer.spec.ts` — 13 specs: text round-trip, 4-status tool_use matrix (approved/edited clean wire, discarded dropped, pending → text placeholder), pending placeholder JSON-truncation at 200 chars, tool_result with/without isError → is_error rename, mixed-block order, empty-array, fromAnthropicMessage text-only / tool_use defaulting to pending / unknown-block forward-compat lift.

### Modified (7)

- `package.json` — `@anthropic-ai/sdk: ^0.92.0` added to `dependencies`.
- `package-lock.json` — SDK + transitive deps locked.
- `src/app/models/ai-chat.model.ts` — `CLAUDE_MODELS` updated to current family (`claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-7`); Sonnet 4.6 stays at index 0.
- `src/app/services/anthropic-api.service.ts` — Full rewrite. Default-imports Anthropic; type imports `Message`/`MessageCreateParams`/`MessageParam`. `AnthropicApiError` constructor: `(message, statusCode, errorType?, requestId?)`. `sendMessage(apiKey, params: Omit<MessageCreateParams, 'tools' | 'tool_choice'>): Observable<Message>`. `countTokens(apiKey, params): Observable<number>`. Per-key `clientCache: Map<string, Anthropic>`. `dangerouslyAllowBrowser: true`. `mapError` catches `Anthropic.APIError`, extracts `err.error.message` for friendly mapping. Network errors → `statusCode 0, errorType 'NetworkError'`. Friendly-message switch verbatim across 401/403/429/400/500/529 + default fallback.
- `src/app/services/anthropic-api.service.spec.ts` — Full rewrite. 15 specs via `spyOn(Messages.prototype.create)` and `Messages.prototype.countTokens`. Hand-built `Anthropic.APIError` fixtures with `Object.defineProperty(err, 'name'/'requestID')` for fixture control. Covers all status codes, network error, success path, SC5 runtime audit, requestId propagation.
- `src/app/services/chat.service.ts` — Removed `blocksToText` interim helper. Imports `toAnthropicContent`, `fromAnthropicMessage` from `./chat-block-serializer`; type-only `MessageParam` from SDK. `buildApiMessages` returns `MessageParam[]`. `assistantMessage.blocks = fromAnthropicMessage(response)`; `tokenEstimate = response.usage.output_tokens`. Summary prepend uses `ContentBlockParam[]` form. `maybeSummarize` text-extraction uses `fromAnthropicMessage` for response + inline TextBlock filter for input.
- `src/app/services/chat.service.spec.ts` — `mockApiResponse` cast as `unknown as Message` with full SDK shape. Updated model IDs to `claude-sonnet-4-6`. +4 new specs: SC5 outbound audit, ContentBlockParam[] outbound shape, fromAnthropicMessage round-trip, tokenEstimate from `response.usage.output_tokens`.
- `src/app/services/ai-settings.service.spec.ts` — 6 references to the stale `claude-sonnet-4-5-20250929` model ID replaced with `claude-sonnet-4-6` (Rule 1 deviation — Task 1's CLAUDE_MODELS update broke this spec via the `Invalid model selected` validator).

## Decisions Made

1. **Compile-saving aliases across Task 3 ↔ Task 4 boundary.** Deleting `AnthropicMessage`/`AnthropicResponse` interfaces in Task 3 broke `chat.service.ts` (line 5 + 199–229) and `chat.service.spec.ts` (lines 5 + 33). Two paths considered: (a) merge Task 3 + Task 4 into a single commit; (b) introduce throwaway `type X = SDKType` aliases that satisfy Task 3's verification gate (which forbids `interface` not `type`). Chose (b) for cleaner per-task atomic commits. Aliases removed in Task 4.

2. **SDK `err.message` composition workaround.** `Anthropic.APIError.makeMessage` builds `err.message` as `'<status> <body-json>'` (e.g. `'400 {"error":{"type":"...","message":"..."}}'`). The pre-SDK fetch wrapper used `body.error.message` directly. Without compensation, the friendly-message mapping for 400/418 (which fall through to `apiMessage || ...`) would return SDK-composed strings. Compensated in `mapError` by extracting `err.error.message` (typed body payload) before passing to `friendlyMessage`. This preserves the contract that `chat-page.component.ts` already depends on.

3. **`fromAnthropicMessage` for the summary parse path.** Originally planned to keep the inline `response.content.filter(b => b.type === 'text').map(b => b.text)` reduce. Strict-TS narrowing on `ContentBlock` (which now includes `ThinkingBlock` etc.) rejected the inline filter. Routing through `fromAnthropicMessage` gives a typed `ChatBlock[]` with proper `TextBlock` narrowing — and ensures unknown SDK block types lift to text placeholders rather than silently dropping content. This is a serializer-consistency bonus; the alternative (custom `b is TextBlock` predicate) was rejected as duplicate logic.

4. **Spy strategy — `Messages.prototype.create` not constructor seam.** Two spec patterns considered: (a) `spyOn(Messages.prototype, 'create')` (works because the SDK constructs `messages` per-instance via `new Messages(this)` — the prototype is shared); (b) constructor-time seam — inject a fake client through a `@internal _setClient(client)` method on `AnthropicApiService`. Picked (a) — less invasive, no production API surface for tests, exercises the real SDK class.

5. **chat.service.ts SDK type-only import is the new chokepoint floor.** Task 4 plan explicitly directs `import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'` in `chat.service.ts`. The threat-model gate (T-3-SDK-LK) is "no SDK runtime usage outside the 2 transport files" — type-only imports satisfy the intent (no runtime coupling, only type-level coupling for the public boundary). Documented here as a deliberate widening of the original chokepoint scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ai-settings.service.spec.ts model-ID drift broke 3 specs after Task 1**

- **Found during:** Task 3 (full Karma suite check)
- **Issue:** Task 1's `CLAUDE_MODELS` update changed the validator's accepted set. `ai-settings.service.spec.ts` had 6 references to the stale `claude-sonnet-4-5-20250929` ID, causing 3 specs to fail with `Error: Invalid model selected`: `should persist valid settings`, `should allow saving without API key`, `should remove the API key`.
- **Fix:** Replaced all 6 occurrences with `claude-sonnet-4-6` (Sonnet 4.6 stays at the same logical index).
- **Files modified:** `src/app/services/ai-settings.service.spec.ts` (6 lines)
- **Verification:** `npx ng test --include='**/ai-settings.service.spec.ts'` → 9 SUCCESS
- **Committed in:** `6ac505d` (Task 3 commit — fix landed alongside the SDK transport rewrite)

**2. [Rule 3 - Blocking] chat.service.spec.ts mockApiResponse incompatible with strict SDK Message type**

- **Found during:** Task 3 (full Karma suite check)
- **Issue:** Task 3's deletion of `AnthropicResponse` interface and replacement with the strict SDK `Message` type made `chat.service.spec.ts:33` fail tsc — `Message.usage` requires `cache_creation_input_tokens`/`cache_read_input_tokens`/etc; `Message.stop_sequence` is required.
- **Fix:** Wrapped `mockApiResponse` with `as unknown as Message`; added `stop_sequence: null` and full `Usage` shape. Spec-only escape hatch.
- **Files modified:** `src/app/services/chat.service.spec.ts` (Task 3 minimal compile-saver; Task 4 fully migrated to SDK Message type with proper citations field)
- **Verification:** `npx tsc --noEmit` clean; spec runs 17 SUCCESS post-Task 4.
- **Committed in:** `6ac505d` (Task 3) — refined further in `0049fe4` (Task 4)

**3. [Rule 3 - Blocking] anthropic-api.service.ts type aliases needed to keep chat.service.ts compiling across Task 3 ↔ Task 4**

- **Found during:** Task 3 (full Karma suite check, TS error on chat.service.ts:5)
- **Issue:** Task 3's verification gate forbids `export interface AnthropicMessage|AnthropicRequest|...` but does NOT forbid `export type` aliases. Removing the interfaces broke `chat.service.ts`'s named import of `AnthropicMessage`. Two options: (a) merge Task 3 + Task 4; (b) introduce `type X = SDKType` aliases for the duration of Task 3.
- **Fix:** Added `export type AnthropicMessage = MessageParam;` and `export type AnthropicResponse = Message;` to `anthropic-api.service.ts` in Task 3. Removed in Task 4.
- **Files modified:** `src/app/services/anthropic-api.service.ts` (Task 3 added 13 lines, Task 4 removed them)
- **Verification:** `grep "^export interface ..."` returns nothing (gate held); `grep "AnthropicMessage|AnthropicResponse" anthropic-api.service.ts` returns nothing post-Task 4 (alias removed).
- **Committed in:** Added `6ac505d` (Task 3); removed `0049fe4` (Task 4).

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 2 Rule 3)

**Impact on plan:** No scope creep. All deviations were tightly bounded: model-ID drift fix in 1 spec file, compile-savers strictly limited to the Task 3 ↔ Task 4 transitional period. The plan's verification gates (`! grep -E "^export interface (AnthropicMessage|...)\b"`, `Omit<MessageCreateParams`, `dangerouslyAllowBrowser: true`, focused-spec pass, full-suite pass, production build) all hold.

## Issues Encountered

None — execution was clean. The 3 deviations above were predictable consequences of the model-ID change and the interface removal; both were caught by the test/build feedback loop within a single iteration.

## Threat Model Compliance

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-3-WL (persistence-only fields leak onto wire) | mitigate | `chat-block-serializer.toAnthropicContent` strips `status`/`editedFromText` for `approved`/`edited` tool_use; spec asserts `'status' in wire[0]` is false and `'editedFromText' in wire[0]` is false (specs 2 + 3). |
| T-3-PT (status='pending' tool_use round-trips as real tool_use) | mitigate | Serializer replaces pending tool_use with text placeholder; spec asserts `wire[0].type === 'text'` and text starts with `'[user has not yet responded'` (spec 5). Pending placeholder truncates JSON > 200 chars (spec 6). |
| T-3-RG (SC5 regression — `tools[]` accidentally enabled) | mitigate (type-level + runtime) | Type-level: `sendMessage` signature is `Omit<MessageCreateParams, 'tools' \| 'tool_choice'>` — TS rejects callers passing tools (`grep -c "Omit<MessageCreateParams"` returns 2 in `anthropic-api.service.ts`). Runtime: `chat.service.spec.ts` "SC5: outbound request shape has no tools field" + `anthropic-api.service.spec.ts` "SC5 (runtime audit)" both spy on the outbound call and assert `'tools' in args === false`. |
| T-3-AK (API key leaked via SDK error logs) | mitigate | `mapError` surfaces only `err.status`, `err.name`, `err.error.message`, `err.requestID` — no API key field. Friendly-message strings preserve the pre-SDK contract (e.g., 401 → "Invalid API key. Please check your key in Settings." — no key value). |
| T-3-NB (SDK construction without dangerouslyAllowBrowser would throw at runtime) | accept (build-time) | Centralized in `getClient` (`grep -c "dangerouslyAllowBrowser: true"` returns 1). No `new Anthropic(...)` anywhere else. |
| T-3-SDK-LK (SDK types leak into models/storage) | mitigate (lint) | Grep gate: only `anthropic-api.service.ts` (+ spec), `chat-block-serializer.ts` (+ spec), `chat.service.ts` (+ spec) import from `@anthropic-ai/sdk`. The chat.service.\* imports are TYPE-ONLY (`import type { MessageParam }`) — Task 4 plan explicitly directed this. No `models/`, no `storage.service.ts`, no UI components import from SDK. T-3-SDK-LK intent (no runtime coupling outside transport) holds. |

## User Setup Required

None — no external service configuration required. The Anthropic API key remains a per-user setting in `/settings/ai`; the SDK transport reads it through the existing `AISettingsService` chain.

## Next Phase Readiness

- **Plan 03-03 (memory + tool-registry services)** is unblocked: `ChatBlock` and `ToolUseBlock`/`ToolResultBlock` already in place from Plan 01; the wire-side bridge (`chat-block-serializer`) shipped in this plan; tool dispatcher's `Tool` type can be consumed from `@anthropic-ai/sdk/resources/messages` if needed (Plan 03-03 runs in parallel in another worktree — file-disjoint per the plans).
- **Plan 03-04 (settings sub-routes + dev-seed writer)** is unblocked: `CLAUDE_MODELS` updated; settings-ai page can render the new model list directly.
- **Plan 03-05 (chat-page block rendering)** is unblocked: no direct dependency on this plan.
- **Phase 4 agentic loop** drops onto already-typed surfaces with a small diff: just remove the `Omit<...>` from `sendMessage`, register tools[] via `ToolRegistryService`, dispatch tool_use blocks through the executor. The serializer's `status='pending'` placeholder replacement is the contract that prevents Phase 4 from wedging on unfinished proposals.
- **No blockers** for downstream waves.

## TDD Gate Compliance

Task 2 (`tdd="true"`) followed RED → GREEN gate sequence:
- RED: `faf9526` (test commit) — spec authored first, verified failing (Module not found).
- GREEN: `deab316` (feat commit) — implementation authored to satisfy the spec; 13/13 SUCCESS.
- No REFACTOR commit needed (implementation was minimal-and-correct on first pass).

Tasks 3 and 4 (`tdd="true"`) are contract-preserving rewrites of existing functionality — the existing spec passed against the existing impl, and the new spec assertions lock new contract surface (SC5 runtime audit, fromAnthropicMessage round-trip). Committed as `refactor(03-02)` and `feat(03-02)` respectively. The plan-level TDD gate is satisfied because the new contract surface (Omit signature, serializer integration) has accompanying spec coverage; the rewrite was not a new feature being introduced cold.

## Self-Check: PASSED

Verifications run after writing this SUMMARY:

**Created files exist:**
- `src/app/services/chat-block-serializer.ts` ✓
- `src/app/services/chat-block-serializer.spec.ts` ✓

**Commits exist on worktree branch:**
- `bf03546` (Task 1) ✓
- `faf9526` (Task 2 RED) ✓
- `deab316` (Task 2 GREEN) ✓
- `6ac505d` (Task 3) ✓
- `0049fe4` (Task 4) ✓

**Verifications:**
- `npx ng test --no-watch --browsers=ChromeHeadless`: **308 SUCCESS** (Plan 01 baseline 282 + 26 net new specs)
- `npx ng build --configuration=production`: **exit 0** (warn-only on bundle size, +4.0 kB over 512 kB soft budget)
- `node -e "require('./node_modules/@anthropic-ai/sdk/package.json').version"`: **0.92.0**
- `grep "^export interface (AnthropicMessage|AnthropicRequest|AnthropicContentBlock|AnthropicResponse)" src/app/services/anthropic-api.service.ts`: **none** (gate held)
- `grep "Omit<MessageCreateParams" src/app/services/anthropic-api.service.ts`: **2 occurrences** (type-level SC5)
- `grep "dangerouslyAllowBrowser: true" src/app/services/anthropic-api.service.ts`: **1 occurrence**
- `grep "toAnthropicContent\|fromAnthropicMessage" src/app/services/chat.service.ts`: **4 occurrences** (buildApiMessages outbound + assistant blocks parse + maybeSummarize text extraction)
- `grep "blocksToText" src/app/services/chat.service.ts`: **none** (interim helper removed)
- `chat-page.component.ts:286` (`err instanceof AnthropicApiError && err.statusCode === 401`) compiles cleanly against new `AnthropicApiError` surface ✓

---
*Phase: 03-ai-memory-tool-plumbing*
*Completed: 2026-05-03*
