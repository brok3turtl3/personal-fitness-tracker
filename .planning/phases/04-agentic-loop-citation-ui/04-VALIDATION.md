---
phase: 4
slug: agentic-loop-citation-ui
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-31
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jasmine + Karma (Angular 18 defaults) |
| **Config file** | `karma.conf.js` / `angular.json` test target (existing) |
| **Quick run command** | `ng test --no-watch` |
| **Full suite command** | `ng test --no-watch --code-coverage` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `ng test --no-watch`
- **After every plan wave:** Run `ng test --no-watch --code-coverage`
- **Before `/gsd-verify-work`:** Full suite must be green + `ng build --configuration=production` succeeds
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Populated by the planner from RESEARCH.md `## Validation Architecture`.
> Three load-bearing surfaces (all deterministic, unit-testable, zero new deps):
> - **E1 — Citation-link guard (SC #4):** adversarial "cite a study" prompt → zero `<a>` for free-text author-year strings; only API-structured citation blocks (`web_search_result_location`, `search_result`) become links.
> - **E2 — Agentic loop terminal stop-reason robustness:** every `StopReason` branch handled, `maxAgentTurns` cap enforced, no block on write-tool turns.
> - **E3 — Confidence/attribution parser safe degradation:** malformed token → unbadged (never crash, never fabricate a badge).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T2 | 04-01 | 1 | CHAT-07/08/09 | T-04-01-01 | Confidence parser safe degradation (E3) — malformed/absent token → unbadged, never fabricate | unit (pure) | `ng test --no-watch --include='**/confidence-attribution-parser.spec.ts'` | ✅ W1 (TDD) | ⬜ pending |
| 04-02-T1 | 04-02 | 1 | CHAT-02 | T-04-02-01/02/03 | Read-only safety (E5) + bounded output (E6) for query_* | unit | `ng test --no-watch --include='**/data-query-tool-executor.spec.ts'` | ✅ W1 (TDD) | ⬜ pending |
| 04-03-T2 | 04-03 | 1 | CHAT-10 | T-04-03-02 | Cache-prefix byte-stability + slim header (E7) | unit | `ng test --no-watch --include='**/fitness-context.service.spec.ts'` | ✅ W1 | ⬜ pending |
| 04-04-T1 | 04-04 | 2 | CHAT-02/05 | T-04-04-01/02 | Agentic loop terminal-stop-reason robustness + cap + write-no-block + user-turn tool_result (E2) | unit | `ng test --no-watch --include='**/chat.service.spec.ts'` | ✅ W2 (TDD) | ⬜ pending |
| 04-05-T1 | 04-05 | 2 | CHAT-07/08/09 | T-04-05-01/02 | Citation-link guard adversarial (E1) + triple-encoded badges (E4) | component | `ng test --no-watch --include='**/chat-message-list.component.spec.ts'` | ✅ W2 | ⬜ pending |
| 04-05-T2 | 04-05 | 2 | CHAT-06 | T-04-05-03 | Tool-call disclosures + renderer-derived summaries (E12) | component | `ng test --no-watch --include='**/chat-message-list.component.spec.ts'` | ✅ W2 | ⬜ pending |
| 04-06-T1 | 04-06 | 3 | CHAT-02/05/06 | T-04-06-01/04 | Loop orchestration: multi-emit events, turn-limit/terminal notices, takeUntilDestroyed cancel, 401 path | component | `ng test --no-watch --include='**/chat-page.component.spec.ts'` | ✅ W3 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `confidence-attribution-parser.spec.ts` — E3 safe-degradation (CHAT-07, CHAT-08) — TDD in Plan 04-01 Task 2 (RED first)
- [x] `chat.service.spec.ts` (loop) — E2 stop-reason/cap (CHAT-02, CHAT-05) — TDD in Plan 04-04 Task 1 (RED first)
- [x] citation-guard spec — E1 free-text-vs-structured-citation (CHAT-09) — RED-first in Plan 04-05 Task 1; also `data-query-tool-executor.spec.ts` E5/E6 TDD in Plan 04-02

*Existing Jasmine+Karma infrastructure covers framework needs — no install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-domain agentic answer quality ("how's my weight trending vs my goal?") | CHAT-02 | Requires live Anthropic API + subjective grounding judgment | Run dev server, ask the prompt, confirm AI fetches real data via tools and answers from actual logs |
| Tool-use disclosure expand/collapse UX | CHAT-06 | Visual/interaction | Expand an AI message, confirm `tool_use`/`tool_result` blocks visible and collapsed by default |
| Cache-read economics (system prefix cached at 10%) | CHAT-10 | Requires live API usage telemetry | Inspect API usage; confirm `cache_read_input_tokens` on second+ turn |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (folded into TDD plans 01/02/04/05 as RED-first specs)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner, 2026-05-31)
