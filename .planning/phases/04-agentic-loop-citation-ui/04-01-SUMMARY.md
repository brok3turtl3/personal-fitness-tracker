---
phase: 04-agentic-loop-citation-ui
plan: 01
subsystem: ai
tags: [angular, typescript, confidence-grading, attribution, pure-module, sdk-agnostic, tdd]

# Dependency graph
requires:
  - phase: 03-ai-chat-depth
    provides: "ChatBlock union + chat-block-serializer.ts pure-module pattern; ai-chat.model.ts persistence shapes"
provides:
  - "Confidence / Attribution / ClaimSpan span types (SDK-agnostic) in ai-chat.model.ts"
  - "ChatTurnEvent loop-event union (tool_use_started / tool_result / assistant_text / turn_limit / done)"
  - "parseClaimSpans(text): ClaimSpan[] — pure, total, never-throws confidence/attribution parser"
  - "Corrected CLAUDE_MODELS entry: claude-opus-4-8"
affects: [agentic-loop, citation-ui, chat-message-list-badge-render, confirm-before-write]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure runtime-narrowing module (no DI, no SDK import) mirroring validators.ts / chat-block-serializer.ts"
    - "Allow-list-as-frozen-ReadonlySet gating every typed-value assignment (no fabrication)"

key-files:
  created:
    - src/app/services/confidence-attribution-parser.ts
    - src/app/services/confidence-attribution-parser.spec.ts
  modified:
    - src/app/models/ai-chat.model.ts

key-decisions:
  - "ChatTurnEvent and ClaimSpan stay SDK-agnostic: done.stopReason is string, tool_use_started payload is structural — narrowing happens at the loop chokepoint (D-17)"
  - "No LLM retry on garbled/absent grading token — degrade to unbadged span (D-09); re-call would double cost without guaranteeing a token"
  - "stripTokens uses a fresh RegExp instance to avoid mutating the shared TOKEN_RE lastIndex state"
  - "Sentence-boundary split keeps trailing grading tokens attached to the preceding sentence (04-RESEARCH Open Q #2)"

patterns-established:
  - "Pattern: pure SDK-agnostic narrowing module for model-authored text — total function, allow-list gated, never throws"

requirements-completed: [CHAT-07, CHAT-08, CHAT-09]

# Metrics
duration: 6min
completed: 2026-05-31
---

# Phase 4 Plan 01: Type Foundation + Confidence/Attribution Parser Summary

**SDK-agnostic Confidence/Attribution/ClaimSpan + ChatTurnEvent types, corrected opus-4-8 model ID, and a pure total `parseClaimSpans` that narrows graded assistant text into typed spans with E3 safe degradation (never throws, never fabricates a grade).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-31T17:37:32Z
- **Completed:** 2026-05-31T17:43Z
- **Tasks:** 2
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- Extended `ai-chat.model.ts` with the SDK-agnostic span types (`Confidence` 6-value union, `Attribution`, `ClaimSpan`) and the `ChatTurnEvent` loop-event union — the type foundation every downstream Phase 4 unit consumes.
- Fixed the stale `CLAUDE_MODELS` entry: `claude-opus-4-7` → `claude-opus-4-8` (label updated to match).
- Built `confidence-attribution-parser.ts` as a pure, DI-free, SDK-agnostic total function (`parseClaimSpans`) that strips inline `[evidence: …]`/`[source: …]` tokens and sets `confidence`/`source` only against the canonical allow-lists.
- Proved the E3 safe-degradation contract (D-09) via TDD: garbled `[evidence: ???]`, unknown grade `[evidence: superstrong]`, nested brackets, and empty string all degrade to a valid unbadged `ClaimSpan[]` — no throw, no fabricated grade. 19/19 parser specs green; full Karma suite 530 SUCCESS (no regression from the 511 Phase 3 baseline + 19 new).

## Task Commits

1. **Task 1: Add span/event types + fix opus model ID** - `bac46da` (feat)
2. **Task 2 (RED): failing E3 safe-degradation spec** - `397f9a7` (test)
3. **Task 2 (GREEN): implement pure parser** - `3c67bf0` (feat)

**Plan metadata:** _(this SUMMARY + STATE/ROADMAP/REQUIREMENTS commit — see final docs commit)_

_TDD gate sequence satisfied: `test(...)` RED commit (397f9a7, 15 FAILED / 4 SUCCESS) → `feat(...)` GREEN commit (3c67bf0, 19 SUCCESS). No REFACTOR commit needed (implementation clean on first GREEN)._

## Files Created/Modified

- `src/app/models/ai-chat.model.ts` (modified) — Added `Confidence`, `Attribution`, `ClaimSpan`, `ChatTurnEvent`; corrected `CLAUDE_MODELS` to opus-4-8.
- `src/app/services/confidence-attribution-parser.ts` (created) — Pure `parseClaimSpans` + helpers `splitIntoClaimChunks` / `stripTokens`; allow-list `ReadonlySet`s; case-insensitive spacing-tolerant `TOKEN_RE`.
- `src/app/services/confidence-attribution-parser.spec.ts` (created) — 19 specs: 6 grades, 2 sources, paired tokens, spacing/case tolerance, 4 adversarial degradation cases, multi-claim, idempotency.

## Decisions Made

- Kept `ChatTurnEvent`/`ClaimSpan` free of any Anthropic SDK type so `ai-chat.model.ts` stays SDK-agnostic (D-17). `done.stopReason: string` and the structural `tool_use_started` payload are narrowed from SDK types at the loop chokepoint in a later Plan-04 unit.
- `stripTokens` constructs a fresh `RegExp` from `TOKEN_RE.source/flags` rather than reusing the module-scope global regex, so stripping never collides with the `exec`-loop's `lastIndex` state — keeps the parser idempotent.

## Deviations from Plan

Two micro-adjustments, both documentation-only and required to pass the plan's own literal acceptance grep gates:

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded a JSDoc comment so the `@anthropic-ai/sdk` grep gate stays green**
- **Found during:** Task 1 (ai-chat.model.ts)
- **Issue:** A JSDoc line literally contained the string `` `@anthropic-ai/sdk` ``, which tripped the acceptance gate `grep -q "@anthropic-ai/sdk" <file>` must FAIL (the gate matches docstring text, not just imports — same edge case as Plan 01-10).
- **Fix:** Reworded the comment to "no Anthropic SDK import here". No code change; the file still has zero SDK imports.
- **Files modified:** src/app/models/ai-chat.model.ts
- **Verification:** `grep -q "@anthropic-ai/sdk" src/app/models/ai-chat.model.ts` returns non-zero (ABSENT).
- **Committed in:** bac46da (Task 1 commit)

**2. [Rule 1 - Bug] Reworded a JSDoc comment so the `@Injectable` grep gate stays green**
- **Found during:** Task 2 (confidence-attribution-parser.ts)
- **Issue:** The module header JSDoc literally contained `@Injectable`, tripping the acceptance gate `grep -q "@Injectable" <file>` must FAIL. The parser has no decorator — only the doc mentioned it.
- **Fix:** Reworded to "no DI (no Angular injectable decorator)". No code change.
- **Files modified:** src/app/services/confidence-attribution-parser.ts
- **Verification:** `grep -q "@Injectable" src/app/services/confidence-attribution-parser.ts` returns non-zero (ABSENT).
- **Committed in:** 3c67bf0 (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — docstring text breaking a literal grep gate).
**Impact on plan:** Documentation-only. No behavioral, structural, or scope change. Both fixes were necessary for the plan's acceptance criteria to pass.

## Issues Encountered

None beyond the two grep-gate docstring collisions above (a known, recurring edge case in this project's literal acceptance gates — see Plan 01-10 SUMMARY). RED→GREEN ran cleanly.

## TDD Gate Compliance

Plan type is `tdd`. Gate sequence verified in git log:
- RED: `397f9a7` `test(04-01): add failing E3 safe-degradation spec` — 15 FAILED / 4 SUCCESS (the 4 trivially-passing cases assert "no throw" / "undefined", which the empty stub satisfied).
- GREEN: `3c67bf0` `feat(04-01): implement pure confidence-attribution-parser` after RED — 19 SUCCESS.
- REFACTOR: not required (clean on first GREEN).

## Threat Surface Scan

No new security-relevant surface beyond the plan's `<threat_model>`. The two registered boundaries are both mitigated and asserted by spec:
- T-04-01-01 (false provenance): allow-list `ReadonlySet`s gate every assignment; unknown token ⇒ `undefined`. Adversarial spec (`superstrong`, `hearsay`) asserts no fabrication.
- T-04-01-02 (crash): total function; empty-string + nested-bracket specs assert valid `ClaimSpan[]`, no throw.

## Known Stubs

None. The parser is fully implemented and wired to its types; downstream consumers (badge render, agentic loop) land in later Phase 4 plans by design.

## Next Phase Readiness

- Type foundation is in place for the rest of Phase 4: the agentic loop emits `ChatTurnEvent`, the badge render consumes `ClaimSpan[]` from `parseClaimSpans`.
- `parseClaimSpans` is pure and DI-free — directly importable by `chat-message-list` (badge render) and by the loop's post-turn text pass with no test-harness setup.
- No blockers.

## Self-Check: PASSED

- FOUND: src/app/models/ai-chat.model.ts
- FOUND: src/app/services/confidence-attribution-parser.ts
- FOUND: src/app/services/confidence-attribution-parser.spec.ts
- FOUND commit: bac46da (Task 1)
- FOUND commit: 397f9a7 (Task 2 RED)
- FOUND commit: 3c67bf0 (Task 2 GREEN)

---
*Phase: 04-agentic-loop-citation-ui*
*Completed: 2026-05-31*
