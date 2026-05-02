# State: Personal Fitness Tracker — Refinement Milestone (v2)

**Last Updated:** 2026-05-02

---

## Project Reference

**Core Value:** A trustworthy personal health record paired with a knowledgeable AI coach that can see all of it — so the user can both log faithfully and get sharp, evidence-graded guidance, with nothing leaving the machine except the AI request itself.

**Milestone:** Refinement (v2) — diet UX overhaul + AI chat depth + full quality pass on the existing Angular 18 + Electron app at v1.2.3.

**Current Focus:** Phase 1 — Foundations. Test scaffolding, shared utilities, subscription hygiene, and schema-migration discipline must land before any feature refactor touches the 900-line `diet-page` or the chat surface.

---

## Current Position

**Phase:** 1 — Foundations
**Plan:** None yet (run `/gsd-plan-phase 1`)
**Status:** Roadmap approved; planning not started
**Progress:** [░░░░░░░░░░] 0/5 phases complete

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 5 |
| Phases completed | 0 |
| Requirements mapped | 42/42 |
| Plans drafted | 0 |
| Plans completed | 0 |
| Verifier passes | 0 |

---

## Accumulated Context

### Decisions Locked In (from PROJECT.md, REQUIREMENTS.md, research)

- **No clinical disclaimers on AI output.** Source attribution + per-claim confidence labels (`strong | moderate | weak | animal-only | anecdotal | speculative`) is the chosen mechanism. Low-confidence states must be visually distinct (color + icon, not just text).
- **Free-generated citations are never rendered as links.** Only API-structured citations (`web_search_result_location`, `search_result` blocks) become hyperlinks. This bounds the hallucinated-citation risk identified in Pitfall 1 (14–95% fabrication rates across LLMs).
- **Anthropic-native tool use, not RAG/embeddings.** Single user with bounded structured data; client tools over typed services beat a vector DB.
- **Memory uses the official `memory_20250818` tool**, backed by `AppData.memoryFiles: Record<string, string>` with `/memories` path-prefix validation.
- **`UserProfile` is separate from `memoryFiles`.** Profile is structured, user-edited, in `/settings`. Memory is the AI's free-form notebook.
- **LocalStorage stays.** No IndexedDB this milestone. Quota detection + chat archival in Phase 5 is the relief valve.
- **Karma + Jasmine stay.** No Vitest migration this milestone (cost not justified for 12 specs).
- **Schema migration ordering is non-negotiable: V4→V5 (AI fields, including `ChatMessage.blocks`) MUST land before V5→V6 (diet fields).** Both ride on FOUND-07's typed-legacy interfaces + backup-before-migrate discipline.
- **Phases 2 and 3 are file-disjoint and parallelizable.** If run in parallel, V4→V5 must merge to main before the V5→V6 work targets the V5 baseline.

### Active Decisions Pending

- **`memory_20250818` canonical return strings**: confirm against current Anthropic docs at Phase 3 implementation time.
- **Prompt-caching min-size at runtime**: Haiku 4.5 needs 4,096 tokens minimum — validate that `FitnessContextService`'s slim header reaches it under typical conditions.
- **`web_search_20250305` vs `web_search_20260209`**: Phase 5 planning decision based on which model the user runs.
- **Chat archival UX**: per-conversation keys vs lazy-loaded archive — Phase 5 design decision.
- **Confirm-before-write UX for memory writes**: inline banner vs toast vs pending indicator — Phase 3 or Phase 4 planning decision.

### Open Todos

- Run `/gsd-plan-phase 1` to start Phase 1 (Foundations) planning.

### Blockers

None.

### Notable Files Already Mapped

- `.planning/PROJECT.md` — milestone scope, key decisions
- `.planning/REQUIREMENTS.md` — 42 v2 requirements with traceability
- `.planning/research/SUMMARY.md` — synthesized research, 5-phase build order
- `.planning/research/ARCHITECTURE.md` — schema-migration plan, component boundaries
- `.planning/research/STACK.md` — net-additive deps (`@anthropic-ai/sdk`, `convert`, `axe-core`)
- `.planning/research/PITFALLS.md` — 14 critical risks with phase mapping
- `.planning/research/FEATURES.md` — feature categories, dependencies, MVP definition
- `.planning/codebase/ARCHITECTURE.md` — existing layered architecture (locked)
- `.planning/codebase/CONCERNS.md` — flagged tech debt, bugs, scaling risks

---

## Session Continuity

**Where to resume:** Phase 1 has not yet been planned. Next action is `/gsd-plan-phase 1` which will decompose the seven FOUND-* requirements into 3–5 executable plans.

**Critical context to remember next session:**
1. Roadmap is final and signed off — 5 phases, 42/42 requirements covered.
2. Phase 1 (Foundations) is gating: characterization tests for `diet-page` / `chat-page` / `charts-page` / `reports-page` MUST land before Phase 2 or Phase 3 touches those components.
3. Schema-migration ordering: V4→V5 (Phase 3) before V5→V6 (Phase 2) when both are merged. Both ride on FOUND-07.
4. Phases 2 and 3 are parallelizable. Mode is `yolo` and `parallelization=true`.
5. UI hints set on Phases 2, 3, 4, 5. AI hints set on Phases 3, 4, 5. Downstream `/gsd-ui-phase` and `/gsd-ai-integration-phase` should engage on those phases.

---

*State initialized: 2026-05-02*
