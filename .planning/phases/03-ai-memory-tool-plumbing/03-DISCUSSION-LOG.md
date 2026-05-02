# Phase 3 — Discussion Log

**Date:** 2026-05-02
**Mode:** discuss (default, interactive — 4 single-question turns per area, then continue/next)
**Workflow:** `/gsd-discuss-phase 3`

This file is for human reference (audits, retrospectives). It is NOT consumed by downstream agents — they read `03-CONTEXT.md`.

---

## Gray-area selection

User selected: **all 4 areas** (UserProfile shape, Settings page expansion, Confirm-before-write UX, ChatBlock model breadth).

---

## Area 1: UserProfile shape & content

**Q1.1 — Profile shape**
- Options: Sectioned free-form text (Recommended) / Structured items per category / Single free-form markdown blob
- **Selected:** Sectioned free-form text
- **Note:** UserProfile = { goals, preferences, dietaryConstraints, trainingHistory, updatedAt }. 4 textareas. AI reads verbatim.

**Q1.2 — Profile init**
- Options: Empty strings, no placeholders (Recommended) / Empty + onboarding prompt / Seeded with template prompts
- **Selected:** Empty strings, no placeholders
- **Note:** All four fields default to ''. Subtle inline placeholder hints. System-prompt section omitted entirely when all empty.

**Q1.3 — AI view**
- Options: Wrapped section, before fitness data (Recommended) / Inlined into existing prompt preamble / Separate `system` prompt segment
- **Selected:** Wrapped section, before fitness data
- **Note:** `## User Profile` block prepended; sections wrapped in `<user_profile_*>` delimiters. Empty sections omitted.

**Q1.4 — Profile location**
- Options: New files: user-profile.model.ts + user-profile.service.ts (Recommended) / Extend ai-chat.model.ts + ai-settings.service.ts / Inline into FitnessContextService
- **Selected:** New files
- **Note:** Mirrors one-domain-per-service pattern. Barrel-exported from models/index.ts.

**Q1.5 — Field caps**
- Options: 4 KB per field, 16 KB profile total (Recommended) / 1 KB per field, 4 KB total / No cap
- **Selected:** 4 KB per field, 16 KB total

**Continue check:** "Next area"

---

## Area 2: Settings page expansion strategy

**Q2.1 — Layout**
- Options: Sub-routes (/settings/profile, /settings/ai, /settings/memory) (Recommended) / Accordion / Flat sections / Tabs
- **Selected:** Sub-routes under /settings shell
- **Note:** New files: settings-shell.component.ts + settings-profile + settings-ai + settings-memory. Each ≤ ~200 lines.

**Q2.2 — Default tab**
- Options: Redirect to /settings/ai (Recommended) / Redirect to /settings/profile / Settings shell renders an index/landing
- **Selected:** Redirect to /settings/ai
- **Note:** Preserves existing daily muscle memory.

**Q2.3 — Memory inspector**
- Options: Tree view + inline preview (Recommended) / Flat list / Read-only viewer (Phase 3) + edit/delete deferred
- **Selected:** Tree view + inline preview
- **Note:** Click node → expand inline preview (read-only). Edit button → textarea + Save. Delete → window.confirm.

**Q2.4 — Privacy**
- Options: Yes — add now in Phase 3 (Recommended) / No — defer to Phase 5 / Just redactHealthReadings (single toggle)
- **Selected:** Yes — add now
- **Note:** redactHealthReadings, redactWeightEntries, redactMealNotes. FitnessContextService respects them. Defaults all OFF.

**Continue check:** "Next area"

---

## Area 3: Confirm-before-write UX scaffold

**Q3.1 — UX pattern**
- Options: Pending pill in the message stream (Recommended) / Inline banner above chat input / Modal blocking interaction / Toast notification
- **Selected:** Pending pill in the message stream
- **Note:** Card in chat scroll between AI's text response and next user input. Save / Discard / Edit actions.

**Q3.2 — Persistence**
- Options: Tool_use block with status field (Recommended) / Separate pendingProposals[] on ChatConversation / In-memory only
- **Selected:** Tool_use block with status field
- **Note:** ChatBlock for tool_use is a superset of Anthropic's — status: 'pending'|'approved'|'discarded'|'edited' + editedFromText?. Strip extension fields when serializing back to API.

**Q3.3 — Phase 3 verification**
- Options: Component spec + dev-only seed button (Recommended) / Spec only / Storybook fixtures / E2E with seeded fixture
- **Selected:** Component spec + dev-only seed button
- **Note:** Karma spec on chat-message-list with synthetic tool_use block. PLUS dev-only seed button on localhost.

**Q3.4 — Edit flow**
- Options: Inline edit — swap content for a textarea, Save/Cancel (Recommended) / Edit opens the relevant /settings page / No edit
- **Selected:** Inline edit — swap to textarea
- **Note:** Save marks status='edited' with editedFromText preserving original. Cancel restores pending.

**Continue check:** "Next area"

---

## Area 4: ChatBlock model breadth + backward-compat shim

**Q4.1 — Block kinds**
- Options: Medium (text + tool_use w/ status + tool_result) (Recommended) / Maximal (full Anthropic taxonomy now) / Minimal (text only)
- **Selected:** Medium

**Q4.2 — Content shim**
- Options: Full cut-over: drop content (Recommended) / Keep content?: string transitionally / Keep content as a derived getter
- **Selected:** Full cut-over
- **Note:** Per CLAUDE.md "Avoid backwards-compatibility hacks." Diverges from research-recommended transitional shim — explicit decision.

**Q4.3 — API serialization**
- Options: Dedicated chat-block-serializer.ts in services/ (Recommended) / Inline in chat.service.ts buildApiMessages / Defer fully to Phase 4
- **Selected:** Dedicated chat-block-serializer.ts
- **Note:** Pure module mirroring validators.ts. Strips status + editedFromText. Drops discarded blocks. Renders pending as plain text so API never sees unfinished tool_use.

**Q4.4 — SDK swap**
- Options: Adopt now in Phase 3 (Recommended) / Wait for Phase 4 / Adopt at transport only — ChatBlock stays our type (compromise)
- **Selected:** Adopt now in Phase 3
- **Note (Claude's reading):** User's "adopt now" + the explicit boundary in our discussion = SDK at transport, ChatBlock at persistence, chat-block-serializer.ts as the bridge. Recorded as such in CONTEXT.md D-17.

**Continue check:** "I'm ready for context"

---

## Deferred Ideas (carried into CONTEXT.md `<deferred>`)

- Multiple-pending-proposal queue/parallelism behavior (Phase 4)
- Undo-after-approve window (Phase 4)
- AI-side prompt instructions for WHEN to propose updates (gsd-ai-integration-phase)
- Onboarding banner for empty UserProfile (rejected)
- Single redaction toggle vs. per-domain toggles (rejected)
- Sub-routes with index landing card (rejected)
- Pending pill as modal or toast (rejected)
- Onboarding tour for new settings layout (out of scope)
- Backup/export of memoryFiles (out of scope)
- Memory file versioning / git-style history (out of scope)
- Cross-conversation memory diff view (out of scope)
- settings-shell left-rail as globally-reusable nav-rail (premature abstraction)

---

## Claude's Discretion (carried into CONTEXT.md `<decisions>`)

- Memory tool implementation details (canonical return strings re-fetch at planning time, path validator implementation)
- Tree component implementation for memory inspector (new component vs. inline template)
- aiToolSettings vs. aiPrivacySettings split (researcher to recommend)
- Side-rail nav implementation in settings-shell (layout/styling)
- Specific copy strings (placeholder hints, toggle labels, pending pill text, dev seed-button label)
- Dev-flag mechanism for the seed button (`location.hostname === 'localhost'` vs. flag in aiToolSettings vs. Angular env file)

---

*Discussion log: Phase 3 — AI Memory + Tool Plumbing*
*Generated: 2026-05-02*
