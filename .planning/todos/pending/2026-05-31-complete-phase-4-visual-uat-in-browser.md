---
created: 2026-05-31T19:18:46.222Z
title: Complete Phase 4 visual UAT in browser
area: testing
source: 04-VERIFICATION.md (human_needed)
severity: warning
files:
  - .planning/phases/04-agentic-loop-citation-ui/04-HUMAN-UAT.md
---

## Problem

Phase 4 verification passed all 5 automated must-haves but returned `human_needed`: 3 behaviors
can only be confirmed in a running browser. The canonical tracker is
`04-HUMAN-UAT.md` (status: partial) — this todo is a pointer so the items are also discoverable
from the todos surface. Do NOT duplicate the test detail here; edit the UAT file when testing.

Pending items:
1. Confidence badge visual rendering (tier colors + glyphs + labels; color never sole signal)
2. Tool-use disclosure collapse/expand (`<details>` default-collapsed; click reveals query/result)
3. `maxAgentTurns` cap behavior (loop stops at cap, makes final no-tools call, shows turn-limit notice)

## Solution

`ng serve`, then run `/gsd-verify-work 4` and walk the three items against the live app,
recording results in `04-HUMAN-UAT.md`. When all three pass, that file flips to resolved and
this todo can be moved to `.planning/todos/completed/`.
