---
phase: 04-agentic-loop-citation-ui
plan: 05
subsystem: ui
tags: [angular, chat, citation-guard, confidence-badges, tool-disclosure, a11y, security]

# Dependency graph
requires:
  - phase: 04-01
    provides: parseClaimSpans (pure) + Confidence/Attribution/ClaimSpan types + ToolResultBlock
provides:
  - "Extended chat-message-list @switch: 'text' branch renders memoized parseClaimSpans → inline triple-encoded confidence + source badges + the citation-link guard"
  - "Exported isLinkableCitation(c) guard — only search_result_location / web_search_result_location may ever become an <a> (none exist in Phase 4 → zero anchors from prose)"
  - "query_* tool_use/tool_result render as collapsed native <details> disclosures with renderer-derived LOCKED summaries; in-flight rows are role=status aria-live=polite, non-expandable"
  - "Memory write-proposal tool_use still routes to <app-pending-pill> (query_* vs write-proposal branch)"
affects: [04-06, 04-07, phase-05-web-search, phase-05-data-claim-traceability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Memoized parse: spansFor() caches parseClaimSpans per ${msgId}#${idx}#${text}; never parse in a change-detection-rebound template binding"
    - "Citation guard = interpolation-only ({{ }} auto-escape); the sole <a> path is a structured TextCitation via isLinkableCitation — no bypassSecurityTrust, no innerHTML, no markdown autolinking"
    - "Renderer-derived tool summary: {n} parsed from result 'N total', {range} from tool_use input from/to; omit the · clause when unavailable (E12 — never model prose)"

key-files:
  created: []
  modified:
    - src/app/features/chat/chat-message-list.component.ts
    - src/app/features/chat/chat-message-list.component.spec.ts

key-decisions:
  - "The query disclosure is OWNED by its paired query tool_use (it carries both name+input via the block and reaches the result via resultFor()). The tool_result @case renders the static Phase-3 placeholder ONLY for orphan results (no matching query_* tool_use), so nothing is silently dropped and no disclosure is double-rendered."
  - "In-flight detection = a query_* tool_use with no paired tool_result in the same message's blocks → non-expandable role=status row (no <details> emitted), satisfying the spec's `el.querySelector('details')` falsiness check."
  - "Adjacent claim-spans are joined with an interpolated `{{ ' ' }}` separator (survives Angular whitespace coalescing) because the shared parser splits sentences at '.' boundaries (incl. abbreviations like 'et al.'), which would otherwise concatenate spans without a space."
  - "D-11 view-source traceability link is intentionally ABSENT this phase (asserted via `querySelectorAll('[data-view-source]').length === 0`); the exact linkage UX is a Phase 5 / UI-SPEC deliverable per CONTEXT.md 'where feasible' delegation."

patterns-established:
  - "Triple-encoding badge: tier class (tier-calm/tier-alert) + real-text glyph (✓/≈/⚠, aria-hidden) + verbatim taxonomy label + aria-label='Confidence: {grade}'. Color is never the only channel (CLAUDE.md a11y)."
  - "from-research claim renders the literal 'general knowledge — not a live source' qualifier (D-12) and zero hyperlinks (D-13)."

requirements-completed: [CHAT-06]

# Metrics
metrics:
  duration: ~7m
  completed: 2026-05-31
  tasks: 2
  files: 2
---

# Phase 4 Plan 05: Citation UI — Badges + Tool Disclosures + Citation Guard Summary

JWT-grade epistemic-honesty surface: the `chat-message-list` `@switch` now renders parsed `ClaimSpan[]` as triple-encoded inline confidence/source badges, renders `query_*` tool calls as collapsed `<details>` disclosures with renderer-derived (never model-authored) summaries, and enforces the headline E1 citation-link guard — author-year/DOI/URL prose renders as plain inert text with zero `<a>` anchors.

## What Was Built

### Task 1 — Citation guard + confidence/source badges (E1/E4)
- Replaced `<span class="block-text">{{ block.text }}</span>` with a memoized render of `parseClaimSpans(block.text)`. Each `ClaimSpan.text` is interpolated via `{{ }}` (auto-escaped) — model prose can never become markup or a hyperlink.
- Exported `isLinkableCitation(c)`: returns `true` only for `search_result_location` / `web_search_result_location`. No Phase 4 tool emits these → zero anchors render from prose. Shipped and adversarially tested one phase before web citations exist (D-13).
- Confidence chip: `tier-calm` (strong/moderate, `#eef6ec`/`#2e7d32`) vs `tier-alert` (weak/animal-only/anecdotal/speculative, `#fdf3e7`/`#b9770e`) + real-text glyph `✓`/`≈`/`⚠` + verbatim taxonomy label + `aria-label="Confidence: {grade}"`.
- Source chip: `📈 your data` / `📚 research` with the LOCKED `aria-label`s; research also renders the literal `general knowledge — not a live source` qualifier and zero links.
- Unbadged claim degrades to plain prose (D-09). Component-scoped styles only.

### Task 2 — Tool disclosures + in-flight progress (E12)
- `query_*` `tool_use` with a paired `tool_result` → collapsed native `<details>` (not `open`), `<summary>` 44px touch target with accessible name `Show what the AI looked at: {summary}`, expanded body `Tool: {name}` / `Query:` params / `Result:` content in `<pre>` `white-space: pre-wrap`.
- Resolved summaries use the LOCKED per-tool verb table; `{n}` is parsed from the result (`"N total"`), `{range}` from the `tool_use` input (`from`/`to`) — both renderer-derived (E12), with the `· {…}` clause omitted when unavailable.
- In-flight query (no paired result) → present-tense verb row, `role="status"` `aria-live="polite"`, non-expandable, with the existing `@keyframes blink` pulse.
- Memory write-proposal `tool_use` still renders `<app-pending-pill>` (query_* vs write-proposal branch). One disclosure per call, execution order preserved by the existing `@for`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inter-span whitespace lost when the parser splits at abbreviation periods**
- **Found during:** Task 1 (E1 adversarial spec)
- **Issue:** The shared `parseClaimSpans` splits sentences at `.` boundaries — including abbreviations like `et al.` — so adjacent spans rendered back-to-back as `Smith et al.2019`, failing the `toContain('Smith et al. 2019')` assertion (the guard's zero-anchor assertion always passed).
- **Fix:** Join adjacent claim-spans with an interpolated `{{ ' ' }}` separator that survives Angular's whitespace coalescing (a plain text-node space is stripped). The shared parser (Plan 01, has its own locked spec) was left untouched.
- **Files modified:** chat-message-list.component.ts
- **Commit:** 237b87d

**2. [Rule 1 - Bug] Spec grabbed the first `<pre>` (Query) instead of the Result `<pre>`**
- **Found during:** Task 2
- **Issue:** The expanded disclosure body has two `<pre>` blocks (Query params + Result). The spec's `details.querySelector('pre')` matched the Query pre, so the result-content assertion failed even though the result renders correctly.
- **Fix:** Adjusted the spec to assert `querySelectorAll('pre').length === 2` and that one of them contains the result content. Implementation unchanged (both `<pre>` blocks are correct per the UI-SPEC contract).
- **Files modified:** chat-message-list.component.spec.ts
- **Commit:** 308c22f

### Accepted (documented, not fixed)

**Component-style budget warning (+69 bytes over 2.05 kB).** The new badge + disclosure visuals push `chat-message-list` component CSS to 2.12 kB (Angular's per-component 2.05 kB budget). This is a **warning, not an error** — `ng build --configuration=production` exits 0. The styles encode the LOCKED 04-UI-SPEC palette and layout (calm/alert tiers, neutral disclosure surface, 44px touch targets); CSS was already consolidated (shorthand `font:`, merged selectors) from +289 bytes down to +69. Shaving the final 69 bytes would require dropping LOCKED visual contract, so the overage is accepted. The pre-existing 4.87 kB initial-bundle budget warning is unrelated and unchanged.

## Verification Results

- `ng test --no-watch --browsers=ChromeHeadless` full suite: **579 SUCCESS** (was 563, +16 new specs).
- Targeted `chat-message-list.component.spec.ts`: **23 SUCCESS** (8 pre-existing + 15 new).
- `ng build --configuration=production`: **exit 0** (2 non-blocking budget warnings noted above).
- Grep gates: `bypassSecurityTrust` → 0 matches; `innerHTML` → 0 matches; `parseClaimSpans` present; `message-content` wrapper preserved; `<details` present; `app-pending-pill` retained.
- `expectNoSeriousA11yViolations(..., { disableRules: ['color-contrast'] })` passes on both the badged render and the tool-disclosure render.

## Threat-Model Compliance

- **T-04-05-01 / T-04-05-02 (fabricated clickable citation / XSS via model HTML):** interpolation-only render; `isLinkableCitation` is the sole `<a>` path and matches no Phase 4 content. E1 spec asserts `querySelectorAll('a').length === 0` on author-year/DOI/URL prose. Grep gates forbid `bypassSecurityTrust`/`innerHTML`.
- **T-04-05-03 (transparency theater):** the `{n}`/`{range}` summary is renderer-derived from the actual tool block; the clause is omitted rather than guessed when data is unavailable. Spec asserts the omission path.
- **T-04-05-04 (low-confidence read as strong):** triple-encoding (tier color + icon glyph + text label) so calm vs alert is distinguishable without color. Spec asserts all three channels for a calm and an alert badge.

## For the Next Plan

- The `tooluse-{id}` anchor `id` is already emitted on each resolved `<details>` — Phase 5's D-11 `view source` traceability link can target it directly (currently asserted ABSENT).
- The disclosure consumes block data only; once `chat-page` is rewired to `runAgenticLoop` (Plan 06), live `tool_use_started` → in-flight row → `tool_result` → resolved disclosure transitions render with no further message-list changes.

## Self-Check: PASSED

- All modified files exist on disk.
- All 4 task commits (b291f29, 237b87d, 5c54da9, 308c22f) present in git history.
