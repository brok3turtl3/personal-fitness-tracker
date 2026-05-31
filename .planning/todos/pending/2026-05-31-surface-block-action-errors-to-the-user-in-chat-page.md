---
created: 2026-05-31T19:18:46.222Z
title: Surface block-action errors to the user in chat-page
area: ui
source: 04-REVIEW.md IN-01
severity: info
files:
  - src/app/features/chat/chat-page.component.ts:353
  - src/app/features/chat/chat-page.component.ts:356
  - src/app/features/chat/chat-page.component.ts:390
---

## Problem

Phase 4 code review finding IN-01 (INFO, intentionally deferred from the fix pass).
When a write-proposal action fails — approve / discard / edit — `chat-page.component.ts`
calls `console.error(...)` but never sets `errorMessage`, so the failure is invisible to
the user. They get no feedback that the action did not take effect.

## Solution

Surface these failures via the existing inline error banner: set `errorMessage` (and/or the
`<app-error-state>` path already used for transport failures) in the three catch/error
branches at lines 353, 356, 390. Low severity, low risk. Good candidate for the Phase 5
quality sweep (QUAL-* requirements). See [[run-security-verification-for-phase-4-agentic-loop]]
for the other deferred Phase 4 item.
