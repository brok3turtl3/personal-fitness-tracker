---
phase: 04-agentic-loop-citation-ui
plan: 03
subsystem: ai-transport-context
tags: [transport, prompt-caching, cache_control, countTokens, fitness-context, CHAT-10, D-15, E7]
requires:
  - "anthropic-api.service.ts (Phase 3 SDK transport)"
  - "fitness-context.service.ts (Phase 3 full-snapshot prompt)"
  - "query_* tools (Plan 04-02 — full per-domain detail now arrives here)"
provides:
  - "AnthropicApiService.sendMessage accepting full MessageCreateParams (tools[] + cache_control)"
  - "AnthropicApiService.countTokens accepting system: string | TextBlockParam[] + tools[]"
  - "FitnessContextService.buildSystemPrompt(): Observable<SystemTextBlock[]> — byte-stable cacheable prefix + non-cached today block"
  - "SystemTextBlock structural type (SDK-agnostic, outside D-17 chokepoint)"
affects:
  - "chat.service.ts (Wave 2 Plan 04 — consumes buildSystemPrompt() + sends tools[] through the widened transport)"
tech-stack:
  added: []
  patterns:
    - "Slim byte-stable cacheable system prefix with cache_control: ephemeral (Pattern 4 / Pitfall 4)"
    - "Local structural type to stay inside the D-17 SDK chokepoint"
key-files:
  created: []
  modified:
    - src/app/services/anthropic-api.service.ts
    - src/app/services/anthropic-api.service.spec.ts
    - src/app/services/fitness-context.service.ts
    - src/app/services/fitness-context.service.spec.ts
    - src/app/services/chat.service.spec.ts
decisions:
  - "buildSystemPrompt returns a two-block SystemTextBlock[]: [0] cacheable prefix (cache_control: ephemeral), [1] non-cached volatile 'today' block — the timestamp moved out of the cached prefix into a deterministic trailing slot (E7)."
  - "FitnessContextService uses a LOCAL structural SystemTextBlock type instead of importing the SDK TextBlockParam — keeps fitness-context outside the D-17 chokepoint (only anthropic-api.service.ts + chat-block-serializer.ts import the SDK). No ESLint config exists in this repo; the chokepoint is enforced by grep gates, so the local type avoids tripping them."
  - "The slim key-facts header reports COUNTS + the single most-recent value per domain (derived purely from stored data) — no wall-clock 'now', no per-entry dump — so the cacheable prefix is byte-identical across builds with identical data."
metrics:
  duration: ~12m
  completed: 2026-05-31
---

# Phase 4 Plan 03: Transport widening + slim cacheable system prefix Summary

Widened the SDK transport to carry `tools[]` + a `cache_control`'d system prefix on send and `system: TextBlockParam[]` + `tools[]` on `countTokens`, and slimmed `FitnessContextService.buildSystemPrompt` from a full-dataset string into a byte-stable ~500-token cacheable `SystemTextBlock[]` (cache_control: ephemeral) — turning repeat-turn system cost from 1× to 0.1× (CHAT-10 / D-15 / E7).

## What Was Built

### Task 1 — Widen `anthropic-api.service.ts` transport (commit `6e31c88`)
- `sendMessage`: removed the Phase 3 `Omit<MessageCreateParams, 'tools' | 'tool_choice'>` — now accepts full `MessageCreateParams`, so the Wave 2 agentic loop can pass `tools[]` and a `cache_control`'d system prefix. Body (the `from(promise.catch(mapError))` bridge) unchanged.
- `countTokens`: widened `system` to `string | TextBlockParam[]` and added a `tools?: MessageCountTokensTool[]` param, both forwarded to `messages.countTokens`.
- Imported `TextBlockParam` + `MessageCountTokensTool` from `@anthropic-ai/sdk/resources/messages` (this file stays the sole SDK importer — D-17).
- Preserved verbatim: `getClient` cache + `dangerouslyAllowBrowser: true`, `mapError`, `friendlyMessage`, `AnthropicApiError.statusCode` (chat-page depends on `=== 401`).
- Spec: replaced the obsolete "tools is absent" SC5 audits with Phase 4 assertions — `tools[]` reaches `messages.create`, a `cache_control` system prefix is forwarded, and a `TextBlockParam[]` system + `tools[]` reach `messages.countTokens`. All 401/error-mapping specs kept green.

### Task 2 — Slim `FitnessContextService` to a byte-stable cacheable prefix (commit `c323b6c`)
- `buildSystemPrompt()` return type changed `Observable<string>` → `Observable<SystemTextBlock[]>` (new exported local structural type `{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }` — no SDK import).
- Block `[0]` (cacheable, `cache_control: ephemeral`), fixed field order: persona + injection guard + memory directive → units → profile (stable empty-omission via `hasAnyProfileContent`) → slim `## Fitness Data Summary` (counts + latest value per domain) → grading/coaching instructions. No timestamp, no per-entry dump.
- Block `[1]` (NON-cached): `## Today` with `new Date().toISOString()` — the sole volatile slot, in a deterministic trailing position.
- Removed the full-dataset stuffing (`buildFitnessDataSnapshot` and its per-domain 7-day/30-day rollups) — that detail now arrives per-turn via the Plan 04-02 `query_*` tools.
- Kept the CHAT-11 `wrapUntrusted` delimiter guard (T-04-03-01) and the D-09 redaction toggles (weight + health facts lines gated).
- Spec rewritten for E7: two consecutive builds produce a **byte-identical** cacheable prefix (profile present AND absent), the prefix carries `cache_control: ephemeral`, the prefix stays ≤ 2500 chars (~500-token proxy) under a 200×4 dataset, and it is count-only (≤1 occurrence of the latest value, never a per-entry dump).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] chat.service.spec consumer ripple**
- **Found during:** Task 2
- **Issue:** Changing `buildSystemPrompt()`'s return type to `SystemTextBlock[]` made the strongly-typed `jasmine.SpyObj<FitnessContextService>` mock in `chat.service.spec.ts` (`returnValue(of('...string...'))`) a type error, and the assertion `expect(request.system).toBe('You are a fitness expert.')` stale — breaking the build/suite. The plan states Plan 04 owns the loop consumer, but the build cannot be left red.
- **Fix:** Updated the mock to return a `SystemTextBlock[]` and the assertion to `toEqual([...])`. Test-only; no production consumer logic changed (`chat.service.ts` line `system: systemPrompt` already typechecks because the SDK `system` accepts `string | TextBlockParam[]`). Plan 04 still owns wiring the tools[] / loop side.
- **Files modified:** src/app/services/chat.service.spec.ts
- **Commit:** c323b6c

**2. [Rule 1 - Doc] Reworded a JSDoc literal to keep the D-17 grep gate green**
- **Found during:** Task 2
- **Issue:** A JSDoc comment in `fitness-context.service.ts` contained the literal string `@anthropic-ai/sdk` (explaining why the file does NOT import it). The verifier's literal chokepoint grep (`grep @anthropic-ai/sdk fitness-context.service.ts` must return zero) would false-positive on the comment. Same edge case handled in Plans 04-01 and 04-02.
- **Fix:** Reworded the comment to "the SDK `TextBlockParam` type" — documentation-only, no behavior change. There is no real SDK import in the file.
- **Files modified:** src/app/services/fitness-context.service.ts
- **Commit:** c323b6c

## Verification

- `ng test --no-watch --browsers=ChromeHeadless` (full suite): **551 SUCCESS** (was 547, +4 net).
- Targeted: anthropic-api.service.spec **16 SUCCESS**; fitness-context.service.spec **25 SUCCESS** (incl. E7 byte-identical + cache_control + budget specs).
- `ng build --configuration=production`: exit 0 (pre-existing 4.87 kB initial-budget warning, not a regression).
- Grep gates (Task 1): `Omit<MessageCreateParams` absent; `tools` / `TextBlockParam` / `dangerouslyAllowBrowser` all present.
- Grep gates (Task 2): `ephemeral` present (3×); `wrapUntrusted` present (5×); `byte-identical`/`byte-stable` in spec (4×); volatile `new Date().toISOString()` only in the trailing non-cached block.
- D-17 chokepoint intact: zero `@anthropic-ai/sdk` references in `fitness-context.service.ts`.

## Threat-Model Compliance

- **T-04-03-01** (prompt injection) — mitigate: `wrapUntrusted` `<user_*>` delimiter wrapping preserved for all profile text remaining in the slim header; grep gate green.
- **T-04-03-02** (cache-prefix DoS/cost) — mitigate: byte-stable cacheable prefix (fixed field order, deterministic 'today' slot, stable empty-profile omission) → `cache_control: ephemeral`; E7 byte-identical spec proves stability.
- **T-04-03-03** (info disclosure on transport) — accept: no change to key handling; only outbound traffic remains the user-initiated request to api.anthropic.com.

## Notes for Wave 2 (Plan 04 — the agentic loop)

- `buildSystemPrompt()` now returns `SystemTextBlock[]`; `chat.service.ts` already passes it straight through as `system` (SDK accepts `string | TextBlockParam[]`), so no producer change is needed there — Plan 04 wires `tools[]` + the loop.
- The combined cached block (slim prefix + auto-generated tools system block + grading instructions) must clear the per-model cache floor at runtime (Sonnet 4.6 = 1,024 tok; Haiku 4.5 = 4,096 tok — flagged in STATE "Active Decisions Pending"). Validate under typical conditions when the loop sends real requests.

## Self-Check: PASSED

All 5 modified/created files present on disk; both task commits (6e31c88, c323b6c) found in git history.
