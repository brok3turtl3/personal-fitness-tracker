# Milestones — Personal Fitness Tracker

A historical record of shipped versions. Most recent first.

---

## v2.0.0 — Refinement

**Shipped:** 2026-06-03
**Phases:** 5 (1–5) · **Plans:** 37 · **Tasks:** ~90
**Git range:** a638189 → f9ec34d — 259 commits, 252 files, +53,974 / −1,811 LOC
**Timeline:** 2026-05-02 → 2026-06-03 (~32 days)
**Requirements:** 42/42 complete (FOUND ×7, DIET ×10, CHAT ×12, RESCH ×3, QUAL ×10)

**Delivered:** Took the brownfield v1.2.3 tracker from snapshot-chatbot to an agentic, evidence-graded AI coach with persistent memory and opt-in web-search grounding, removed the diet-logging friction that motivated the milestone, and raised the whole app to a coherent quality/accessibility/security bar — all on a refactor-safe Phase 1 foundation.

**Key accomplishments:**

1. **Diet UX overhaul** — inline quick-add (no modal), multi-unit foods with per-food density (g/oz/lb/ml/tsp/tbsp/cup + named servings, no global default), search + Recent/Frequent, copy-a-meal, live totals with %-of-target bars, diet series in charts, snapshot immutability, DST-safe local-day math (DIET-01..10).
2. **Agentic AI coach** — a bounded `while(stop_reason==='tool_use')` loop with six read-only `query_*` tools, real `messages.countTokens`, `cache_control: ephemeral` system-prompt caching, and a slim ~500-token context header (CHAT-02/05/10).
3. **Persistent memory + structured profile** — official `memory_20250818` tool over `AppData.memoryFiles` with `/memories` path validation, an editable `UserProfile`, confirm-before-write, and full `/settings` AI controls (CHAT-03/04/12).
4. **Evidence-graded output** — per-claim confidence badges (strong…speculative, color+icon), data-vs-research attribution, tool-use disclosures, and a hard guard that only API-structured citations ever render as links (CHAT-06/07/08/09).
5. **Opt-in web-search grounding** — `web_search_20250305` server tool with inline https-only footnotes + Sources list, cost-capped by `webSearchMaxUses`, plus an adversarial test proving "find a study about X" can't fabricate un-grounded links (RESCH-01/02/03).
6. **Foundation + quality bar** — characterization tests, shared utilities, subscription hygiene, typed backup-before-migrate schema discipline (V0→V7), CRUD parity, quota/multi-tab safety, CSP lockdown, 401 rotation, full a11y pass, and mutation testing (FOUND-01..07, QUAL-01..10).

**Quality gates:** every phase passed `gsd-verifier` (Phase 5: PASS 5/5); full Karma suite 842/842 green; production build exit 0; human UAT approved for Phase 2; human keyboard/contrast a11y checkpoint approved for Phase 5.

**Known deferred items at close: 9** (see STATE.md → Deferred Items) — Phase-4 visual UAT (2 browser scenarios), 6 Phase-2 code-review polish items + diet edit-form density desync, meal-note redaction granularity (product question), chat-page block-action error surfacing, and 2 diagnosed-but-unclosed dev-seed debug sessions. None affect shipped functionality.

---
