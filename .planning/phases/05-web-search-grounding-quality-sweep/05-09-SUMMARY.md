---
phase: 05-web-search-grounding-quality-sweep
plan: 09
subsystem: quality-sweep-closeout
tags: [401-rotation, block-action-errors, type-tightening, d-17-boundary, mutation-testing, accessibility, color-contrast]
requires:
  - "chat-page handleLoopError + onBlockAction + <app-error-state> Retry surface (04-06)"
  - "AnthropicApiError.statusCode (anthropic-api.service, Phase 3/4)"
  - "stryker.config.json scaffold without thresholds (05-01)"
  - "color-contrast deferral lifted on Phase 1 characterization specs (05-01 Task 3)"
  - "all Phase 5 production code landed in 05-02..05-08 (QUAL-01 sweep + a11y gate cover the whole phase)"
provides:
  - "401 rotate-key <app-error-state> with a Go-to-settings path — QUAL-07"
  - "chat approve/discard/edit failures surfaced via <app-error-state> instead of console-only — QUAL-09 / folded IN-01"
  - "zero 'any' TYPE usage in Phase 5 production paths — QUAL-01"
  - "tree-wide D-17 @anthropic-ai/sdk import boundary verified (3 sanctioned importers)"
  - "pinned validators.ts mutation-score floor (Stryker break threshold) — QUAL-10"
  - "WCAG AA color-contrast across all 8 feature pages incl. diet/charts/reports (5 previously-RED specs now GREEN) + human-verified keyboard/contrast pass — QUAL-08 / QUAL-09"
affects:
  - "src/app/features/chat/chat-page.component.ts (401 + block-action surfacing)"
  - "src/app/features/chat/chat-message-list.component.ts (focusable transcript + contrast nudge)"
  - "src/app/features/chat/chat-conversation-list.component.ts (contrast nudge)"
  - "src/app/features/chat/pending-pill.component.ts (contrast nudge)"
  - "src/app/features/charts/charts-page.component.ts (contrast nudge)"
  - "src/app/features/diet/diet-page.component.ts (contrast nudge)"
  - "src/app/features/reports/report-page.component.ts (contrast nudge)"
  - "src/styles.css (global palette: muted #5f6c6d, accent #2471a3, danger #c0392b)"
  - "stryker.config.json (thresholds block)"
tech-stack:
  added: []
  patterns:
    - "401 handled as a distinct branch in handleLoopError (AnthropicApiError.statusCode === 401) → LOCKED rotate-key copy + Router nav to /settings/ai, generic transport errors keep the recoverable error-state"
    - "block-action failures route through the existing errorMessage/<app-error-state> banner with LOCKED per-action copy (save this to memory / discard this / apply this edit), console.error retained for dev diagnostics only"
    - "QUAL-01 verified by precise type-usage grep (: any | as any | <any> | any[]) — \\bany\\b alone false-positives on English prose in comments"
    - "D-17 boundary verified by import-statement grep, not occurrence grep — JSDoc comment references to @anthropic-ai/sdk are not violations"
    - "Stryker floor pinned at the MEASURED baseline (break = 9, baseline 9.92%) — ratchet-up policy, never an aspirational floor that breaks immediately"
    - "color-contrast fixed by nudging offending hex within LOCKED palette intent; chat transcript made keyboard-focusable (tabindex=0)"
key-files:
  created:
    - .planning/phases/05-web-search-grounding-quality-sweep/05-09-SUMMARY.md
  modified:
    - src/app/features/chat/chat-page.component.ts
    - src/app/features/chat/chat-page.component.spec.ts
    - src/app/features/chat/chat-message-list.component.ts
    - src/app/features/chat/chat-conversation-list.component.ts
    - src/app/features/chat/pending-pill.component.ts
    - src/app/features/charts/charts-page.component.ts
    - src/app/features/diet/diet-page.component.ts
    - src/app/features/reports/report-page.component.ts
    - src/styles.css
    - stryker.config.json
decisions:
  - "401 is its own branch in handleLoopError keyed on AnthropicApiError.statusCode === 401, surfacing the LOCKED rotate-key copy with a primary Go-to-settings action (Router → /settings/ai) and the existing secondary Retry; non-401 transport errors keep the generic recoverable <app-error-state> (QUAL-07)"
  - "Block-action failures (approve/discard/edit) surface via the existing errorMessage/<app-error-state> banner with the LOCKED copy; console.error is kept ONLY as a dev-diagnostic side-channel — the user-visible surface is the error-state (closes IN-01, QUAL-09)"
  - "QUAL-01 'no any' is enforced against the any TYPE, not the English word: all 9 \\bany\\b grep hits are prose inside comments (any input / any browser context / any grounded / any future read tool). Precise type-usage grep returns zero — confirmed clean"
  - "D-17 tree-wide boundary holds: the only two extra files containing the literal @anthropic-ai/sdk (memory-tool-executor.service, tool-registry.service) carry it in JSDoc comments, not import statements — the 3 sanctioned importers (anthropic-api.service, chat-block-serializer, web-citation-parser) remain the sole real SDK consumers"
  - "Stryker floor pinned at the measured baseline: thresholds { high: 20, low: 9, break: 9 } against a measured 9.92% on validators.ts. break=9 passes today and is the ratchet point — an aspirational floor would have broken the suite immediately (RESEARCH guidance)"
  - "Color-contrast failures fixed by nudging the global palette within LOCKED intent: muted text #5f6c6d, accent #2471a3, danger #c0392b; the chat transcript was made keyboard-focusable (tabindex=0). All 5 previously-RED contrast specs flip GREEN; the icon+label state encoding (color is never the only indicator) is untouched"
metrics:
  duration: ~31m (automated) + human-verify checkpoint
  tasks: 3
  completed: 2026-06-01
---

# Phase 05 Plan 09: Quality-Sweep Closeout — 401 Rotation + Block-Action Errors + QUAL-01/D-17/QUAL-10 + Final a11y Pass Summary

The final plan of Phase 5 and of the web-search-grounding-quality-sweep: it closes the last cross-cutting quality items (QUAL-01/07/08/09/10). A stale 401 now leads the user to rotate their key instead of vanishing into the console; chat block-action failures are user-visible; Phase 5 production paths are `any`-free; the `@anthropic-ai/sdk` egress boundary is verified tree-wide; the `validators.ts` mutation-score floor is pinned at the measured baseline; and the full accessibility bar — automated axe-core contrast across all 8 pages plus a human keyboard/contrast pass — is met.

## What Was Built

**Task 1 — 401 rotate-key prompt + block-action error surfacing (QUAL-07 + folded IN-01/QUAL-09).** `commit 3ae88b4`
- `handleLoopError` now has a dedicated branch: `err instanceof AnthropicApiError && err.statusCode === 401` surfaces the LOCKED rotate-key `<app-error-state>` (title `Your API key was rejected`, body `Anthropic returned a 401. Your key may be expired, revoked, or mistyped. Re-enter it in settings, then try again.`) with a primary `Go to settings` action routing to `/settings/ai` and the existing secondary `Retry` (`role="alert"`/`aria-live="assertive"` from `<app-error-state>`). The 602-605 "Phase 5 owns rotate-key UX" placeholder is resolved. Non-401 transport errors keep the generic recoverable error-state.
- `onBlockAction` now surfaces each approve/discard/edit failure through the existing `errorMessage`/`<app-error-state>` banner with the LOCKED copy (title `That action didn't go through`, body `We couldn't {action} just now. Try again.` with `{action}` ∈ `save this to memory` / `discard this` / `apply this edit`). `console.error` is retained only as a dev-diagnostic side-channel — the user-visible surface is now the error-state (the gap IN-01 flagged).

**Task 2 — QUAL-01 type sweep + D-17 tree-wide boundary + QUAL-10 mutation floor.** `commit 1498e6d`
- **QUAL-01:** zero `any` TYPE usage across the Phase 5 core production files (web-citation-parser, chat-block-serializer, ai-chat.model, anthropic-api.service, chat.service, tool-registry.service, fitness-context.service). The web-search SDK casts at the transport boundary are narrowed with proper SDK types. The only `\bany\b` grep hits are the English word "any" inside prose comments — a precise `: any | as any | <any> | any[]` grep returns nothing.
- **D-17:** the tree-wide `@anthropic-ai/sdk` import boundary holds — the 3 sanctioned importers (`anthropic-api.service`, `chat-block-serializer`, `web-citation-parser`) are the sole real SDK consumers. Two other files (`memory-tool-executor.service`, `tool-registry.service`) contain the literal string only in JSDoc comments, not import statements.
- **QUAL-10:** Stryker baseline measured at **9.92%** on `validators.ts`; floor pinned in `stryker.config.json` as `"thresholds": { "high": 20, "low": 9, "break": 9 }`. `break: 9` passes today and is the ratchet point — an aspirational floor would have broken the suite immediately (per RESEARCH guidance: pin at measured, then ratchet).

**Task 3 — QUAL-08/QUAL-09 final accessibility pass (automated gate + human-verify checkpoint).** `commit 17fd5a2`
- **Automated:** the global palette was nudged within LOCKED intent — muted text `#5f6c6d`, accent `#2471a3`, danger `#c0392b` (`src/styles.css`) plus per-component hex nudges on chat-message-list, chat-conversation-list, pending-pill, charts-page, diet-page, report-page. The chat transcript was made keyboard-focusable (`tabindex=0`). All **5 previously-RED color-contrast specs flip GREEN**; the icon+label state encoding (color is never the only indicator) is untouched. Full Karma suite: **743 SUCCESS, 0 failures**, with zero serious/critical axe violations (incl. color-contrast) across all 8 feature pages. diet/charts/report meet the QUAL-09 bar through their Phase 1 characterization specs (now contrast-enforced).
- **Manual (human-verified 2026-06-01):** the operator ran `ng serve` and completed the QUAL-08 mandated keyboard + visual-contrast pass — Tab reachability + Enter/Space operability with no keyboard trap across all 8 pages, focus management (edit focuses first field, Discard returns focus, banners never steal focus), color-independent state distinguishability clearing AA, and the `🔎 Searching the web…` aria-live announcement. **Approved with no violations found.** This checkpoint was NOT auto-stamped — the "human-verified" claim is truthful.

## Verification

- LOCKED 401 copy present: `grep -c "Your API key was rejected\|Go to settings"` → 5 (≥2); block-action copy `grep -c "That action didn't go through"` → 3 (≥1).
- QUAL-01: precise type-usage grep (`: any | as any | <any> | any[]`) across the 7 core files → zero matches.
- D-17: import-statement grep → the 3 sanctioned importers only; the 2 comment-reference files carry no `import ... from '@anthropic-ai/sdk'`.
- QUAL-10: `stryker.config.json` carries `"thresholds"` with `"break": 9` at the measured baseline.
- Full Karma suite: **743 SUCCESS, 0 failures** (5 previously-RED color-contrast specs now GREEN).
- `ng build --configuration=production`: exit 0.
- Manual keyboard + contrast checkpoint: **approved** (2026-06-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Verification gate] D-17 / QUAL-01 grep gates as written false-positive on prose.**
- **Found during:** Task 2 closeout verification.
- **Issue:** The plan's literal gates (`grep -rl "@anthropic-ai/sdk"` and `grep -rnE "\bany\b"`) match JSDoc comment references and the English word "any", not real SDK imports or `any` TYPE usage. Run verbatim they report false violations.
- **Fix:** Verified the boundary with precise gates — an import-statement grep for D-17 and a type-usage grep (`: any | as any | <any> | any[]`) for QUAL-01. Both come back clean. The underlying invariants hold; only the gate precision was tightened for the verification record. No production change.
- **Files modified:** none (verification only).

## Known Stubs

None.

## Threat Surface

No new surface beyond the plan's `<threat_model>`. T-05-09-01 (401 → user) mitigated via the rotate-key error-state + Go-to-settings path; T-05-09-02 (block-action → user) mitigated via the user-visible error-state; T-05-09-03 (type-tightening) mitigated — zero `any` type usage; T-05-09-04 (SDK egress) mitigated — D-17 boundary verified tree-wide; T-05-09-05 (coverage confidence) mitigated — Stryker floor pinned; T-05-09-06 (a11y regressions) mitigated — axe contrast enforced across all 8 pages + human keyboard/contrast pass.

## Self-Check: PASSED

All 10 modified files exist; the 3 task commits (3ae88b4, 17fd5a2, 1498e6d) are in git log; the human-verify checkpoint was approved by the operator on 2026-06-01. Phase 5 quality sweep closed — QUAL-01/07/08/09/10 complete.
