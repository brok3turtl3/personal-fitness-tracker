---
phase: 05-web-search-grounding-quality-sweep
plan: 08
subsystem: chat-grounding-renderer
tags: [web-search, grounding, footnotes, citation-guard, archival, settings, accessibility]
requires:
  - "GroundedCitation + TextBlock.citations + server-tool persisted blocks (05-02)"
  - "toGroundedCitations / toSourcesList (05-02)"
  - "fromAnthropicMessage serializer narrowing SDK citations (05-02)"
  - "web-citation-parser.fixtures F1/F3/F6 (05-01)"
  - "StorageService.loadArchivedMessages / hasArchivedMessages (05-04)"
  - "live web_search_started/results/error events persisted as blocks (05-05)"
  - "isLinkableCitation allow-list + Phase 4 @switch renderer + spanCache memo (04)"
provides:
  - "live/persisted web-search row (in-flight / resolved disclosure / honest error) — D-05"
  - "grounded inline footnote markers [n] + per-message Sources list (https-only) — D-03"
  - "research · grounded source-badge variant — D-04"
  - "E1 adversarial zero-tolerance citation-link gate over the OFF/ON matrix — RESCH-03"
  - "Load earlier messages lazy archival affordance — QUAL-05/D-13"
  - "webSearchMaxUses cost-context helper in /settings/ai — D-06"
affects:
  - "src/app/features/chat/chat-message-list.component.ts (renderer + archival)"
  - "src/app/features/chat/chat-page.component.ts (conversationId input wiring)"
  - "src/app/features/settings/settings-ai.component.ts (D-06 helper)"
tech-stack:
  added: []
  patterns:
    - "citation narrowing memoized via citationCache Map keyed msgId#idx#text (mirrors spanCache)"
    - "web-search row driven off persisted blocks: server_tool_use (in-flight) vs paired web_search_tool_result (resolved/error)"
    - "renderer drives off persisted GroundedCitation; defensive https re-gate before any <a href>"
    - "SDK Message fixtures routed through production fromAnthropicMessage in the E1 spec (no test-only block construction)"
    - "lazy archival prepend with scroll-anchor preservation (no jump-to-top)"
key-files:
  created:
    - .planning/phases/05-web-search-grounding-quality-sweep/05-08-SUMMARY.md
  modified:
    - src/app/features/chat/chat-message-list.component.ts
    - src/app/features/chat/chat-message-list.component.spec.ts
    - src/app/features/chat/chat-page.component.ts
    - src/app/features/settings/settings-ai.component.ts
    - src/app/features/settings/settings-ai.component.spec.ts
decisions:
  - "Web-search row is driven entirely off PERSISTED blocks (server_tool_use without a paired web_search_tool_result = in-flight), not transient ChatTurnEvents — the loop persists each block then refreshes, so the renderer stays event-source-agnostic and mirrors the existing query in-flight pattern"
  - "Grounded badge + footnotes/Sources are block-level (TextBlock.citations is block-scoped), distinct from the span-level [source: research] confidence chips; a grounded block upgrades the span's research chip to · grounded and foots the block with a Sources list"
  - "Renderer re-asserts the https gate defensively (isHttps) rather than re-running toGroundedCitations on already-narrowed persisted GroundedCitation[] (which lack the SDK type field and would be wrongly dropped); dedupe via toSourcesList"
  - "Footnote/Sources link accent darkened #3498db→#21618c (5.8:1 on the #f0f0f0 bubble) per the UI-SPEC 'nudge the hex if a row fails' QUAL-08 latitude; same blue family"
  - "Search-row + grounded a11y assertions are SCOPED to the new surfaces (search row, Sources section, grounded chip, footnote marker), not the whole bubble — the bubble chrome (.message-time/.message-role opacity) color-contrast is the cross-chat sweep owned by 05-09"
  - "Archival uses the explicit 'Load earlier messages' button (UI-SPEC primary affordance); scroll anchor preserved on prepend; archive reset on conversation change; button hidden after a load so the (one-shot) archive is not re-fetched"
metrics:
  duration: ~40m
  tasks: 4
  completed: 2026-05-31
---

# Phase 05 Plan 08: Web-Search Grounding Renderer + E1 Gate + Archival + Cost Helper Summary

The chat renderer where web-search grounding becomes visible and the no-fabricated-link guarantee is enforced: live `🔎` web-search rows, grounded inline footnotes + a per-message https-only Sources list + the `research · grounded` badge, the E1 zero-tolerance adversarial citation-link gate over the web-OFF/ON matrix, the lazy "Load earlier messages" archival affordance, and the `webSearchMaxUses` cost helper in settings.

## What Was Built

**Task 1a — Live/persisted web-search row (D-05).** Extended the Phase 4 `@switch (block.type)` with two new branches (preserving the `message-content` wrapper):
- `server_tool_use` with no paired `web_search_tool_result` → in-flight `🔎 Searching the web…` (or `…for "{query}"…`), `role="status"` `aria-live="polite"`, existing `@keyframes blink`, non-expandable.
- `web_search_tool_result` with a results array → collapsed `<details>` `🔎 Found {n} sources` (renderer-derived count), summary accessible name `Show what the AI searched for: {summary}`, body `Web search` heading + `Searched:` query + `Sources found:` list.
- `web_search_tool_result` error union → honest `🔎 Couldn't reach the web` row, **no anchor**.

**Task 1b — Grounded footnotes + Sources + badge + memoization (D-03/D-04/D-09).** On the `'text'` case: grounded `TextBlock.citations` yield inline `[n]` footnote markers (`<a href="#source-{msgId}-{n}">`, 14px/600 accent baseline, `Source {n}: {title}` accessible name) plus a per-message `<section aria-label="Sources">` with the `https:` URL as a native link. The research source chip upgrades to `research · grounded` (`📚🔗`) when grounded; un-grounded research keeps the exact Phase 4 plain-text qualifier — distinguished by suffix + marker + icon, never color. Narrowing is memoized in `citationCache` (keyed `msgId#idx#text`, mirroring `spanCache`), with a defensive https re-gate and `toSourcesList` dedupe.

**Task 3 — E1 adversarial gate (RESCH-03, zero tolerance).** Real SDK `Message` fixtures (F1/F3/F6) routed through the production `fromAnthropicMessage` serializer (the sole SDK→GroundedCitation chokepoint). F1 web-OFF prose (author-year + bare DOI) → `querySelectorAll('a').length === 0`; F3 web-ON (prose `Jones 2020` + one real grounded block) → anchor count === grounded-citation count, every href `https:`/`#source-`, prose author-year NOT an anchor; F6 non-https → dropped; plus a direct `toGroundedCitations` allow-list unit assertion. Describe block labeled the zero-tolerance gate.

**Task 4 — Archival affordance (QUAL-05/D-13) + cost helper (D-06).** A `Load earlier messages` button renders at the top of the stream when `StorageService.hasArchivedMessages(conversationId)`; click lazy-loads via `loadArchivedMessages` and prepends oldest-first through the storage chokepoint, announces `Loading earlier messages…` (`aria-live`), preserves the scroll anchor, and hides after the (one-shot) load. `conversationId` is wired from chat-page; archive resets on conversation change. The LOCKED D-06 cost helper (`aria-describedby`) sits near the `webSearchMaxUses` field (bound stays min=0/max=10).

## Verification

- `chat-message-list.component.spec.ts`: 43 passing (incl. E1 zero-tolerance gate).
- `settings-ai.component.spec.ts`: 14 passing.
- Combined targeted run: 57 SUCCESS.
- No `bypassSecurityTrust*` / `innerHTML` in the renderer (grep-clean + spec-asserted).
- `message-content` wrapper preserved (Phase 1 characterization contract).
- `ng build --configuration=production` exits 0 (only pre-existing bundle/CSS budget warnings).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `toGroundedCitations` would have dropped all persisted citations.**
- **Found during:** Task 1b.
- **Issue:** The plan suggested memoizing narrowing via `toGroundedCitations`, but persisted `TextBlock.citations` are already the narrowed SDK-free `GroundedCitation` shape (no `type` field). Re-running `toGroundedCitations` (which checks `c.type === 'web_search_result_location'`) dropped every one → no footnotes/Sources rendered at all.
- **Fix:** Memoize via a defensive `isHttps` re-gate + `toSourcesList` dedupe (still allow-listed at the upstream serializer chokepoint, where the SDK type still exists). The renderer's only linkable source remains the https-gated `GroundedCitation`.
- **Files modified:** src/app/features/chat/chat-message-list.component.ts
- **Commit:** e708b20

**2. [Rule 2 - Correctness/a11y] Link accent failed WCAG AA on the assistant bubble (QUAL-08).**
- **Found during:** Task 1b (color-contrast now enforced per QUAL-08).
- **Issue:** The UI-SPEC accent `#3498db` (and even hover `#2980b9` at 3.77:1) fails 4.5:1 against the `#f0f0f0` assistant bubble for the footnote/Sources links.
- **Fix:** Darkened the link accent to `#21618c` (5.84:1 on `#f0f0f0`) — the documented UI-SPEC "nudge the hex if a row fails" latitude. Same blue family.
- **Files modified:** src/app/features/chat/chat-message-list.component.ts
- **Commit:** e708b20

**3. [Rule 3 - Scope] a11y assertions scoped to the new surfaces.**
- **Found during:** Task 1a/1b.
- **Issue:** Whole-bubble `expectNoSeriousA11yViolations` fails on the pre-existing `.message-time` (opacity 0.6) / `.message-role` (opacity 0.8) chrome — the cross-chat color-contrast sweep owned by 05-09 (one of the 5 intentionally-RED specs).
- **Fix:** Scoped the contrast assertions to the new search-row / Sources / grounded-chip / footnote elements so the new surfaces are genuinely contrast-enforced without pulling in 05-09's chrome work.
- **Files modified:** src/app/features/chat/chat-message-list.component.spec.ts
- **Commits:** b9265f6, e708b20

## Known Stubs

None. All rendered tokens (`{n}`, `{title}`, `{query}`, URLs) are renderer-derived from structured persisted blocks; absent tokens are omitted, never fabricated.

## Threat Surface

No new surface beyond the plan's `<threat_model>`. The only path to an `<a href>` remains the `isLinkableCitation` allow-list + the renderer's defensive https re-gate (T-05-08-01/02 mitigated); archived messages render through the same guarded `@switch` (T-05-08-04); the E1 gate enforces the no-fabricated-link invariant at zero tolerance.

## Self-Check: PASSED

All 5 modified files exist; all 4 task commits (b9265f6, e708b20, cb49489, c638485) found in git log.
