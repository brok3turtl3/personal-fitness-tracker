---
phase: 4
slug: agentic-loop-citation-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| TBD | TBD | TBD | CHAT-02/05–10 | — | TBD | unit | `ng test --no-watch` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `confidence-attribution-parser.spec.ts` — E3 safe-degradation stubs for confidence/attribution parsing (CHAT-07, CHAT-08)
- [ ] `chat.service.spec.ts` (loop) — E2 stop-reason/cap stubs for agentic loop (CHAT-02, CHAT-05)
- [ ] citation-guard spec — E1 free-text-vs-structured-citation stubs (CHAT-09)

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
