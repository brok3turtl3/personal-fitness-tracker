# Phase 4: Agentic Loop + Citation UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 4-agentic-loop-citation-ui
**Areas discussed:** Live loop feedback, Tool-use transparency, Confidence badges, Source attribution (all delegated to Claude)

---

## Gray-area selection

Four phase-specific gray areas were presented for the user to select which to deep-dive:

| Area | Description presented | Selected |
|------|-----------------------|----------|
| Live loop feedback | What the user sees while the multi-turn loop fetches data; whether mid-loop memory/profile write proposals pause the loop or surface after | Delegated |
| Tool-use transparency | What expanding a collapsed tool disclosure reveals — raw JSON vs humanized summary; per-call vs combined panel | Delegated |
| Confidence badges | How the locked 6-level taxonomy renders and sits in prose; how loud low-confidence is | Delegated |
| Source attribution | How "from your data" vs "from research" is shown; how to present "from research" honestly before Phase 5 web grounding | Delegated |

**User's choice:** *(verbatim)* "These all look like good things. I will defer these decisions to you. Please maximize user experience which will include quality of advice as well as transparency."

**Notes:** The user delegated all four gray areas to Claude in a single response rather than selecting a subset to discuss interactively. The north star — **maximize UX (quality of advice + transparency)** — became the tie-breaking principle for every decision. Claude made the decisions grounded in: the Phase 3 AI-SPEC critical-failure-mode invariants (unfinished tool_use must never wedge the loop; tool-arg re-validation; confirm-before-write; memory hygiene), the research SUMMARY/PITFALLS (Pitfall 1 hallucinated citations, Pitfall 10 low-confidence must be visually distinct), and PROJECT.md's standing Key Decision ("source attribution + confidence labels instead of clinical guardrails").

---

## Decisions Claude made (full rationale in CONTEXT.md)

### Live loop feedback & write-approval interleaving
- **D-01** Real-time per-tool-call progress (never silent-until-done) — transparency is the stated priority.
- **D-02** `query_*` tools auto-execute, no confirm (read-only reads of the user's own data).
- **D-03** Loop NEVER blocks on a write approval — proposal surfaces as a pending pill, loop gets a synthetic "not yet persisted" tool_result and finishes; nothing writes until the user approves. Reconciles confirm-before-write with a non-freezing loop.
- **D-04** Hitting `maxAgentTurns` degrades gracefully with a visible honest notice, never a silent truncation or raw error.

### Tool-use transparency depth
- **D-05** Humanized summary as the collapsed label; raw structured detail (name/input/result) on expand.
- **D-06** One collapsible per tool call, inline in execution order — each query is a discrete auditable fact-fetch.

### Confidence badge presentation
- **D-07** Inline chip immediately after the claim it qualifies; not superscript-only, not color-only.
- **D-08** Triple-encoded (color + icon + text); low-confidence states warm/alert + caution icon, scannable at a glance.
- **D-09** Confidence/attribution parser is a pure, fully-tested module (mirrors `chat-block-serializer.ts`); malformed/absent token degrades safely.

### Source attribution & "from research" honesty
- **D-10** Source is a second axis paired with confidence — "from your data" vs "from research", distinct markers.
- **D-11** "From your data" claims trace back to the tool call that fetched them.
- **D-12** "From research" in Phase 4 = the model's own training knowledge, labeled as such, never as a cited source, zero hyperlinks.
- **D-13** Citation-link guard ships and is adversarially tested now (only structured citation blocks become links).

### Cross-cutting technical direction
- **D-14** `query_*` tools = thin read-only wrappers over domain services with bounded/summarized output.
- **D-15** Slim ~500-token `FitnessContextService` header + `cache_control: ephemeral` + `messages.countTokens`.
- **D-16** Loop handles all terminal stop reasons (`end_turn`, `max_tokens`, refusal, `pause_turn`) before Phase 5.

---

## Claude's Discretion (handed downstream)

- **System-prompt engineering** (when to grade a claim, when to propose a memory write, the inline confidence-token syntax, the synthetic "pending approval" tool_result wording) → `/gsd-ai-integration-phase` (AI-SPEC).
- **Visual specifics** (badge palette/iconography, collapsed-row styling, data-claim→tool-call linkage, loop progress animation) → `/gsd-ui-phase` (UI-SPEC).
- **`query_*` output shape, caps, summarization, single vs split executor** → researcher/planner.
- **Streaming vs discrete-iteration rendering** for the live-feedback feel → researcher.
- **Web-search version decision** (`web_search_20250305` vs `web_search_20260209`) → explicitly Phase 5, not Phase 4.

## Deferred Ideas

- Web-search server tool + grounded/linked citations → Phase 5 (RESCH-01..03).
- `web_search_*` version + `encrypted_index` replay → Phase 5 planning.
- Chat archival / quota hardening → Phase 5 (QUAL-02/03).
- Multi-tab clobber of just-saved memory → Phase 5 (QUAL-04).
- AI CRUD-edit (write) tools vs read-only `query_*` → out of scope; not on roadmap.
- Multiple-pending-proposal queue/ordering semantics → revisit if usage shows a need.
- Undo-after-approve window for memory writes → revisit once real proposals fire.
- Token-by-token streaming of the final answer prose → later polish if discrete-iteration feel is insufficient.
