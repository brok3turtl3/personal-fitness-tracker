# Phase 5: Web Search Grounding + Quality Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 5-web-search-grounding-quality-sweep
**Areas discussed:** Todo fold selection, Web-search grounding UX, Web-search behavior & cost, Edit (CRUD) UX, Archival + quota-at-95%

---

## Matched Todos (fold selection)

| Option | Description | Selected |
|--------|-------------|----------|
| Surface block-action errors in chat (IN-01) | Approve/discard/edit failures console.error only — fits QUAL-09 error-state consistency | ✓ (folded by Claude per delegation) |
| Clarify meal-note redaction granularity (CR-04) | Per-entry free-text notes vs aggregate kcal line; affects fitness-context | ✓ (folded + resolved as D-10) |
| Complete Phase 4 visual UAT | 3 browser-only items (04-HUMAN-UAT.md) | (not folded — Phase 4 verification, → /gsd-verify-work 4) |

**User's choice:** Free-text "Other" response — *"I will defer these decisions to you. Make sure that we follow coding best practices, established codebase patterns and focus on User experience."*
**Notes:** A single blanket delegation covering BOTH questions (todo fold + gray-area selection). Same pattern as Phase 4. Claude made all fold + gray-area decisions against the stated north star.

---

## Web-search grounding UX (RESCH-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline numbered footnotes + per-message Sources list | Reuse Phase 4 `@switch` renderer + `isLinkableCitation` allow-list; only `https:` clickable | ✓ (D-03) |
| Source-axis upgrade: "from research · grounded · linked" | Un-grounded "from research" stays plain text (Phase 4 D-12); grounded upgrades to linked footnote | ✓ (D-04) |
| Live in-stream search-progress row | Mirrors Phase 4 D-01/D-05 tool rendering | ✓ (D-05) |

**User's choice:** Delegated to Claude.
**Notes:** This is the explicit upgrade path Phase 4 D-12/D-13 left room for — the renderer was built to absorb it without rework.

---

## Web-search behavior & cost (RESCH-01, RESCH-03)

| Option | Description | Selected |
|--------|-------------|----------|
| `web_search_20250305` (stable) | Matches RESCH-01; newer 20260209 needs code_execution + is for token optimization | ✓ (D-01) |
| `webSearchMaxUses` default 3, surfaced in /settings | Field already exists; expose as bounded cap | ✓ (D-06) |
| No domain allow/block list | Trust = citation guard + labels, not domain gating; over-restriction fights "cutting-edge sources" goal | ✓ (D-07) |
| Extend Phase 4 adversarial citation test across web-on/off matrix | RESCH-03 | ✓ (D-09) |
| Web-query privacy instruction (folded redaction todo) | Redact per-entry free-text notes; AI-SPEC discourages PII in search queries | ✓ (D-10) |

**User's choice:** Delegated to Claude.
**Notes:** `web_search_20260209` + curated-source domain list both captured as deferred ideas.

---

## Edit (CRUD) UX (QUAL-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse per-page entry form, pre-filled, edit-mode toggle | Established codebase pattern; DietService already does in-place update | ✓ (D-11) |
| Separate modal / route | More new surface, less consistent | |
| Preserve id+createdAt, refresh updatedAt, re-validate | Success-criterion 2 (typo correction keeps identity) | ✓ (D-12) |

**User's choice:** Delegated to Claude.
**Notes:** `updateReading` signature (single dispatch vs three methods) left to planner. `updateMeal` stale-name bug noted as adjacent hazard, out of CRUD-parity scope.

---

## Archival + quota-at-95% (QUAL-05, QUAL-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy-loaded per-conversation archive key | Keeps hot AppData slice small; per-conversation avoids one giant blob; through StorageService | ✓ (D-13) |
| Single combined archive blob | Larger reads, less granular | |
| 95% prompt offers archive/delete (NOT export) | Export out of scope; clipboard JSON safety valve from recovery banner | ✓ (D-14) |

**User's choice:** Delegated to Claude.
**Notes:** `navigator.storage.estimate()` + cross-browser error-name matching (QuotaExceededError + Firefox NS_ERROR_DOM_QUOTA_REACHED). 70% soft warning, 95% block.

---

## Claude's Discretion

- System-prompt engineering (when to web-search, grounded-vs-ungrounded framing, web-query privacy instruction) → `/gsd-ai-integration-phase` (AI-SPEC).
- Visual specifics (footnote/Sources styling, grounded badge, search-progress row, edit-mode affordance, quota/multi-tab banners) → `/gsd-ui-phase` (UI-SPEC).
- `updateReading` signature, archive key naming + lazy-load trigger, `webSearchMaxUses` UI range, mutation-test target → researcher/planner.
- Phase-internal sequencing (web-search track vs quality-sweep sub-tracks, wave parallelization) → planner.
- QUAL-01/04/06/07/08/10 executed per REQUIREMENTS.md acceptance criteria (D-15) — well-specified, no gray areas.

## Deferred Ideas

- `web_search_20260209` (dynamic domain filtering) — needs code_execution; revisit on token-spend pressure.
- Curated/reputable-source domain allow-list.
- Full data import/export (future milestone).
- IndexedDB migration.
- Electron-update artifact signing/notarization.
- `updateMeal` stale-`savedFoodName` fix.

### Reviewed Todos (not folded)
- Complete Phase 4 visual UAT — Phase 4 verification, routed to `/gsd-verify-work 4`.
