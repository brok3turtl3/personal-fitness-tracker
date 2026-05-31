# SECURITY.md — Phase 04: Agentic Loop + Citation UI

**Audited:** 2026-05-31
**ASVS Level:** 1
**Threats Closed:** 23/23
**Threats Open:** 0/23
**block_on:** high (no blockers found)

---

## Threat Verification

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-04-01-01 | Spoofing / false provenance | mitigate | `confidence-attribution-parser.ts:29–39` — `CONFIDENCE_VALUES` and `SOURCE_VALUES` are module-scope `ReadonlySet<string>` allow-lists; assignment to `confidence`/`source` occurs ONLY inside `.has(value)` guards (lines 69–74). Unknown/garbled token silently ignored → field stays `undefined`. No fabrication path exists. |
| T-04-01-02 | DoS / crash | mitigate | `confidence-attribution-parser.ts:58–80` — `parseClaimSpans` is a pure total function. `splitIntoClaimChunks` short-circuits empty input to `['']` (line 90–92); `TOKEN_RE.lastIndex` reset per chunk (line 65) prevents stateful carry-over. No throw path. |
| T-04-01-03 | Tampering / SDK coupling | accept | `ai-chat.model.ts` — confirmed zero `@anthropic-ai/sdk` imports (grep returns empty). `ChatTurnEvent` uses structural local types (`toolUseId: string`, `toolName: string`, `input: unknown`; `stopReason: string`). SDK-agnostic per D-17. Accepted risk: type-only file, no runtime coupling. |
| T-04-02-01 | Tampering / InfoDisc — read-only | mitigate | `data-query-tool-executor.ts:1–11` — imports only domain services (`WeightService`, `CardioService`, `ReadingsService`, `DietService`); no `StorageService`, no `localStorage`. grep for `saveData`/`localStorage` in the file returns empty. All six handlers use `firstValueFrom` on read-only domain getters. |
| T-04-02-02 | DoS / token exhaustion | mitigate | `data-query-tool-executor.ts:40–42` — `SUMMARIZE_THRESHOLD = 60`, `RECENT_N = 20`, `MAX_RANGE_DAYS = 1000` class constants cap every handler. Wide-range paths produce aggregate header + capped sample (e.g., `queryWeightEntries` lines 146–153; `mealsByDay` DoS guard line 314). `compose()` (line 333–344) attaches a "(output bounded)" note. |
| T-04-02-03 | Tampering / out-of-range input | mitigate | `data-query-tool-executor.ts:394–456` — `parseRange`/`requireRange`/`coerceDate` throw on invalid input; every handler body is wrapped in `try { … } catch (err) { return this.errString(err); }` (e.g., lines 154–156, 181–183), returning `"Error: …"` strings, never throwing through to storage. |
| T-04-02-04 | EoP / write-proposal bypass | mitigate | `tool-registry.service.ts:67–69` — `WRITE_PROPOSAL_TOOLS: ReadonlySet<string> = new Set(['memory'])`. `isWriteProposal(name)` (line 87–89) returns true only for set members; all other names (including all `query_*`) default to false. Explicit allow-list — new read tools cannot accidentally bypass the pending-pill gate. |
| T-04-03-01 | Tampering / EoP — prompt injection | mitigate | `fitness-context.service.ts:137–144` — `wrapUntrusted(tag, content)` applies WR-04 hardened regexes: `closeRe = /<\/tag[^>]*>/gi` and `openRe = /<tag(\s[^>]*)?>gi` (attribute/whitespace variant-tolerant). Called for all four profile fields (lines 155–158). Grep for `wrapUntrusted` in the file returns 5 matches (definition + 4 call sites). |
| T-04-03-02 | DoS / cache prefix churn | mitigate | `fitness-context.service.ts:84–98` — Block 1 is `{ type: 'text', text: prefixParts.join('\n\n'), cache_control: { type: 'ephemeral' } }` (line 84–88). Volatile `new Date().toISOString()` is isolated in a SEPARATE non-cached trailing block (line 91–94), not embedded in the prefix. Fixed field order (sections 1–5 at lines 59–86) + stable empty-profile omission (`hasAnyProfileContent` gate line 68) ensures byte-identical cacheable prefix across consecutive builds. |
| T-04-03-03 | InfoDisc / transport | accept | No change to transport key handling in Phase 4. Outbound traffic remains solely user-initiated to `api.anthropic.com` via `dangerouslyAllowBrowser: true` SDK client (accepted in Phase 3). `anthropic-api.service.ts:119` confirms `dangerouslyAllowBrowser: true` preserved. Accepted risk: single-user, own key, per Phase 3 decision. |
| T-04-04-01 | DoS / wedged loop | mitigate | `chat.service.ts:325–408` — every `StopReason` handled: `end_turn`/`stop_sequence`/`max_tokens`/`refusal` → emit done + complete (line 376–383); `pause_turn` → CR-01 fix: `pauseCount` counter (line 325), `MAX_CONSECUTIVE_PAUSES = 3` (line 326), ceiling terminates the loop (lines 389–394), `turn--` only when under ceiling (line 397); `tool_use` → break (line 399–403); `default` → complete (lines 404–408). `maxAgentTurns` cap checked each iteration (`turn < maxAgentTurns && !cancelled`, line 345). Teardown: `cancelled = true` (line 524–526). CR-01 fix verified in code — perpetual `pause_turn` cannot defeat the cap. |
| T-04-04-02 | Tampering / tool_result placement | mitigate | `chat.service.ts:485–489` — `messages.push({ role: 'user', content: toolResults … })` — tool_result blocks always appended in a `user` turn. Write-proposal synthetic result also pushed as `toolResults` before the `user` push (lines 441–447). |
| T-04-04-03 | EoP / unapproved write | mitigate | `chat.service.ts:436–449` — `if (this.toolRegistry.isWriteProposal(tu.name))` branch calls `surfacePendingProposal` (persists `status:'pending'` only) and pushes a synthetic "not yet persisted" `tool_result`; does NOT auto-execute the write. The `continue` (line 449) skips the dispatch block entirely. No write executes until `approveToolUseBlock` is called from the UI. |
| T-04-04-04 | Tampering / dispatch error | mitigate | `chat.service.ts:461–475` — dispatch is wrapped in `try { const result = await this.toolRegistry.dispatch(…) } catch (e) { … toolResults.push({ …, content: 'Error: …', is_error: true }); }`. Throw is caught, converted to `is_error: true` tool_result; loop does not crash. |
| T-04-05-01 | Spoofing / fabricated clickable citation | mitigate | `chat-message-list.component.ts:54` — the `'text'` `@case` renders `span.text` exclusively via `{{ span.text }}` Angular interpolation (auto-escaped). `isLinkableCitation` (lines 21–26) is the sole `<a>` gate; it requires `type === 'search_result_location'` or `'web_search_result_location'` — no tool in Phase 4 produces these → zero anchors from prose. Grep for `bypassSecurityTrust` and `innerHTML` in the file returns empty. |
| T-04-05-02 | Spoofing / XSS via model HTML | mitigate | Same interpolation-only enforcement as T-04-05-01. `bypassSecurityTrust*` confirmed absent (grep empty). Angular's auto-escape prevents model-authored markup from executing. |
| T-04-05-03 | InfoDisc / transparency theater | mitigate | `chat-message-list.component.ts:364–399` — `toolSummary()` derives `{n}` via `deriveCount(resultContent)` (line 383–386, regex on actual result string) and `{range}` via `deriveRange(input)` (line 388–398, from actual tool input object). Model prose is never used. Clause is omitted when `count === undefined && range === undefined` (line 378–379). |
| T-04-05-04 | Tampering / badge single-channel | mitigate | `chat-message-list.component.ts:279–316` — triple-encoding: (1) tier CSS class `tier-calm` / `tier-alert` (color, line 181–182); (2) glyph real text content `✓` / `≈` / `⚠` via `confidenceGlyph()` (lines 312–315); (3) text label `{{ span.confidence }}` (line 54); plus `aria-label="Confidence: {grade}"`. Color is never the sole channel. |
| T-04-06-01 | DoS / runaway loop on navigate-away | mitigate | `chat-page.component.ts:544–559` — `startAgenticLoop` pipes through `.pipe(takeUntilDestroyed(this.destroyRef))` (line 546). The loop teardown (`cancelled = true` at `chat.service.ts:524`) fires when the subscription is torn down. No further `sendMessage` calls occur after `cancelled` is true (loop checks `!cancelled` at line 345). |
| T-04-06-02 | EoP / unapproved write persisted | mitigate | `chat-page.component.ts:335–358` — `onBlockAction` approve path routes through `pendingApprovalService.executeApprovedToolUse(block)` → `chatService.approveToolUseBlock(…)`. Discard/edit paths call `updateMessageBlock` with a status-only patch (no write execution). No write persists without explicit user approval via the pill. |
| T-04-06-03 | Tampering / dev-seed synthetic pills | mitigate | `chat-page.component.ts` — `appendSeededPill`, `consumeDevSeedIfPresent`, `initializeActiveConversationAndConsumeSeed` are all absent (grep returns empty). The comment at line 295–300 confirms removal. `initializeActiveConversation()` (line 302) loads conversations and auto-selects only — no seed path exists. |
| T-04-06-04 | InfoDisc / silent failure | mitigate | `chat-page.component.ts:607–619` — `handleLoopError(err)` sets `this.loopError = true` for non-401 errors (line 613); template line 74–79 renders `<app-error-state>` with `title="The AI request didn't go through"`, `message` with LOCKED copy, and `(retry)="onRetryLoop()"`. 401 errors set `this.errorMessage` (line 610) displayed as inline banner. Neither path is console-only. Note: IN-01 (block-action `console.error` calls at lines 353/356/390) is a distinct, already-tracked deferred item — T-04-06-04 concerns the loop-error path specifically, which is fully mitigated. |

---

## Accepted Risks Log

| Threat ID | Risk | Rationale |
|-----------|------|-----------|
| T-04-01-03 | SDK-type coupling in `ai-chat.model.ts` | Type-only file; zero `@anthropic-ai/sdk` runtime import. `ChatTurnEvent` uses structural local types. D-17 chokepoint preserved at `anthropic-api.service.ts` + `chat-block-serializer.ts`. Risk is theoretical (type drift) not runtime. |
| T-04-03-03 | Outbound user data to `api.anthropic.com` | Accepted in Phase 3: single-user app, user supplies their own API key, `dangerouslyAllowBrowser: true` is intentional. No change this phase. |

---

## Unregistered Flags

All `## Threat Flags` / `## Threat Surface Scan` sections across the six SUMMARY files mapped to existing threat IDs:

- 04-01-SUMMARY: T-04-01-01, T-04-01-02 — mapped.
- 04-02-SUMMARY: T-04-02-01 through T-04-02-04 — mapped.
- 04-03-SUMMARY: T-04-03-01, T-04-03-02, T-04-03-03 — mapped.
- 04-04-SUMMARY: T-04-04-01 through T-04-04-04 — mapped. (No new surface noted.)
- 04-05-SUMMARY: T-04-05-01 through T-04-05-04 — mapped.
- 04-06-SUMMARY: T-04-06-01 through T-04-06-04 — mapped.

**Unregistered flags: none.**

---

## Notes on CR-01 / WR-04 Review Fixes

Both review-phase blockers are verified in the implementation:

- **CR-01** (`pause_turn` defeats `maxAgentTurns` cap): Fixed. `chat.service.ts:325–394` — `pauseCount` counter + `MAX_CONSECUTIVE_PAUSES = 3` ceiling bounds perpetual `pause_turn` streams. A pause_turn streak of 3 terminates the loop, emitting `done: { stopReason: 'pause_turn' }`. Turn credit is restored (`turn--`) only when under the ceiling, and reset to 0 on a real `tool_use` turn. The cap cannot be evaded.

- **WR-04** (`wrapUntrusted` variant-tag bypass): Fixed. `fitness-context.service.ts:138–143` — `closeRe` and `openRe` use `[^>]*` to match whitespace/attribute tag variants (e.g., `</tag >`, `<tag id="x">`), not just exact literal matches. Case-insensitive flag (`gi`) applied to both.

- **IN-01** (block-action `console.error` calls): Deferred per the review ledger. This affects `onBlockAction` error logging (lines 353/356/390 in `chat-page.component.ts`), which is a distinct path from T-04-06-04 (loop-error path). T-04-06-04 is CLOSED. IN-01 remains an open informational item tracked separately.

---

## Verification Gates Confirmed

- `@anthropic-ai/sdk` imported only in `anthropic-api.service.ts` and `chat-block-serializer.ts` (D-17 chokepoint) — confirmed absent in `ai-chat.model.ts`, `fitness-context.service.ts`, `chat.service.ts`, `data-query-tool-executor.ts`, `confidence-attribution-parser.ts`.
- `localStorage.*` direct access absent from `data-query-tool-executor.ts` — confirmed.
- `bypassSecurityTrust*` and `[innerHTML]` absent from `chat-message-list.component.ts` — confirmed.
- Dev-seed methods (`appendSeededPill`, `consumeDevSeedIfPresent`) absent from `chat-page.component.ts` — confirmed.
