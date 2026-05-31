---
status: partial
phase: 04-agentic-loop-citation-ui
source: [04-VERIFICATION.md]
started: 2026-05-31T19:03:46Z
updated: 2026-05-31T19:03:46Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Confidence badge visual rendering
expected: In a running browser, an AI answer with graded claims renders per-claim chips — high-confidence claims show a green (tier-calm) chip with a ✓/≈ glyph and the taxonomy label; low-confidence claims (weak | animal-only | anecdotal | speculative) show an amber (tier-alert) chip with a ⚠ glyph. Color is never the only signal (icon + text label + aria-label present). Source chips render 📈 "from your data" vs 📚 "from research".
result: [pending]

### 2. Tool-use disclosure collapse/expand
expected: An AI message that ran query_* tools shows collapsed-by-default `<details>` disclosures (one per tool call) with a humanized summary. Clicking expands to reveal the underlying query input and tool_result body. In-flight tool calls show a non-expandable live status row.
result: [pending]

### 3. maxAgentTurns cap behavior
expected: With a prompt that keeps triggering tool calls, the agentic loop stops at the configured maxAgentTurns cap and makes a final no-tools call, surfacing the LOCKED turn-limit notice copy — the loop never runs unbounded.

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
