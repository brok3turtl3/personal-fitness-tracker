# Personal Fitness Tracker

## What This Is

A single-user, local-first health & fitness tracker for cardio sessions, weight, vitals (blood pressure, glucose, ketones), and diet — with charts, printable reports, and an integrated AI coaching chat that can reason over the user's full data. Built as an Angular 18 SPA that also runs as an Electron desktop app; all data lives in browser LocalStorage with schema-versioned migrations.

## Core Value

A trustworthy personal health record paired with a knowledgeable AI coach that can see all of it — so the user can both log faithfully and get sharp, evidence-graded guidance, with nothing leaving the machine except the AI request itself.

## Requirements

### Validated

<!-- Inferred from existing codebase at v1.2.3. These are shipped and relied upon. -->

- ✓ Cardio session logging — entry form + history list (CRUD)
- ✓ Weight entry logging — entry form + history list (CRUD)
- ✓ Health readings — blood pressure, blood glucose, ketones (CRUD with discriminated union model)
- ✓ Diet logging — saved foods library, meal logging, daily totals (CRUD)
- ✓ Charts page — chart.js / ng2-charts visualizations with date range filter
- ✓ Printable report view (`/report`)
- ✓ AI chat — Anthropic Messages API integration with snapshot system-prompt context
- ✓ AI settings — API key + Claude model selection persisted locally
- ✓ Storage abstraction — single `StorageService` over LocalStorage with V0→V4 migrations
- ✓ Hash-based routing — Electron-friendly (`provideRouter(routes, withHashLocation())`)
- ✓ Electron desktop shell — Windows (NSIS) + macOS (DMG) builds via `electron-builder`
- ✓ Strict TypeScript + strict Angular templates across the codebase

<!-- Refinement milestone (v2.0.0) — shipped 2026-06-03. -->

- ✓ Diet UX overhaul — inline quick-add, per-food density units (no global default), named servings, search + Recent/Frequent, copy-a-meal, live %-of-target totals, diet series in charts, snapshot immutability, DST-safe local-day math — v2.0.0
- ✓ Agentic AI coach — read-only `query_*` tools + `while(stop_reason==='tool_use')` loop bounded by `maxAgentTurns`, real `messages.countTokens`, ephemeral system-prompt caching, slim ~500-token context header — v2.0.0
- ✓ Persistent AI memory — official `memory_20250818` tool over `AppData.memoryFiles` with `/memories` path validation; editable structured `UserProfile` with confirm-before-write — v2.0.0
- ✓ Evidence-graded output — per-claim confidence badges (color+icon), data-vs-research attribution, tool-use transparency, API-structured-only citation links — v2.0.0
- ✓ Research grounding — opt-in `web_search_20250305` server tool, inline https-only footnotes + Sources list, `webSearchMaxUses` cost cap, adversarial un-grounded-citation test — v2.0.0
- ✓ Quality/security/a11y bar — CRUD parity (edit cardio/weight/readings), quota detection, multi-tab safety, CSP egress lock, 401 rotation, axe-core + manual a11y pass, Stryker mutation floor, zero `any` in production paths — v2.0.0
- ✓ Refactor-safe foundation — characterization tests, shared utilities, subscription hygiene (Pattern 2 Form A), typed backup-before-migrate schema discipline (V0→V7) with recovery banner — v2.0.0

### Active

<!-- Next milestone not yet scoped. Candidates carried from the future-work backlog; refine via /gsd-new-milestone. -->

_v2.0.0 Refinement is complete. The next milestone is not yet defined — run `/gsd-new-milestone` to scope it. Leading candidates (from the tracked future-work backlog):_

- [ ] **Additional tracking domains** — sleep, mood, steps, hydration, supplements (TRACK-01..05)
- [ ] **First-class goals system** — goals model separate from chat memory, adherence/streak tracking, milestone notifications (GOALS-01..03)
- [ ] **Data import/export** — Apple Health import, CSV import/export, backup/restore round-trip (IO-01..03)
- [ ] **Deferred v2 polish** — Phase-4 visual UAT closure, 6 Phase-2 code-review items + diet edit-form density desync, chat-page block-action error surfacing, meal-note redaction granularity (see STATE.md → Deferred Items)

### Out of Scope

<!-- Explicit boundaries with reasoning to prevent re-adding. -->

- **Multi-user / authentication** — single-user is core to the design; no current need
- **Cloud backend or sync** — LocalStorage-only is a defining pillar; revisit only with a strong reason
- **Removing the Electron shell** — desktop distribution stays functional
- **Sleep / mood / steps / hydration / supplements tracking** — deferred to future milestones (in scope eventually)
- **Goals & progress as a standalone feature surface** — deferred to future milestone (note: AI chat memory may incidentally model user goals)
- **Data import / export (Apple Health, CSV, backup/restore)** — deferred to future milestones
- **Clinical guardrails / blanket medical disclaimers on AI output** — deliberately not added; source + confidence transparency is the chosen mechanism

## Context

- **Shipped v2.0.0 "Refinement" on 2026-06-03** — 5 phases, 37 plans, 259 commits, +53,974 / −1,811 LOC over ~32 days. App version bumped 1.2.3 → 2.0.0. Full Karma suite 842/842 green; production build exit 0; every phase passed `gsd-verifier` (Phase 5 PASS 5/5).
- **Brownfield Angular 18 app.** Codebase mapped — see `.planning/codebase/` (ARCHITECTURE, STACK, STRUCTURE, CONVENTIONS, INTEGRATIONS, TESTING, CONCERNS). The pre-v2 map predates the AI build-out; treat source as authoritative.
- **Single sophisticated user** (the developer), running daily-driver. v2 was triggered by lived diet-logging friction + a desire to lay a solid foundation before adding new tracking domains.
- **Diet tracking — resolved in v2.** Was the known weak spot (rough new-food entry, awkward units, cramped daily display); now inline quick-add, per-food density units, search/Recent/Frequent, copy-a-meal, and live %-of-target totals.
- **AI chat — deepened in v2.** Evolved from a single-snapshot chatbot to an agentic coach: `chat.service.ts` runs a bounded tool-use loop over six read-only `query_*` tools, persistent `memory_20250818` store, and opt-in web search; `fitness-context.service.ts` now emits a slim cacheable header instead of stuffing full data. `anthropic-api.service.ts` is the sole SDK importer (D-17 chokepoint).
- **Schema at V7.** Migrations active and disciplined (typed legacy interfaces + backup-before-migrate + recovery banner); v2 added V4→V5→V6→V7. Any future data-shape change adds the next sequential step.
- **Test surface grew substantially.** From 12 `.spec.ts` files to a coverage-enforced suite (842 specs), plus Puppeteer + axe-core e2e scaffolds and a Stryker mutation floor on a critical service.
- **Known deferred debt:** 9 items carried out of v2 (see STATE.md → Deferred Items) — none affect shipped functionality.
- **API key + telemetry posture:** API key stored locally in `AppData.aiSettings`; no telemetry; CSP locks outbound `connect-src` to `https://api.anthropic.com` (plus opt-in web search routed through the same API).

## Constraints

- **Tech stack**: Angular 18 standalone components only, strict TypeScript, RxJS, chart.js / ng2-charts, LocalStorage via `StorageService` — established architectural pillars; do not break.
- **Storage**: LocalStorage-only (~5 MB cap) — sufficient for ~50 years of typical use; revisit only with a clear reason.
- **User model**: Single-user, no auth — negotiable only with a clear reason.
- **Distribution**: Electron desktop shell (Win/Mac) stays functional; routing must remain hash-based.
- **AI integration**: Stateless calls to Anthropic Messages API; API key stays local; only the chat request itself leaves the device.
- **Quality bar**: TypeScript strict + Angular strict templates; new services require `.spec.ts` coverage; commit format `<type>(<scope>): <description>`.
- **Timeline**: No deadline — quality over speed. Take the time the work needs.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| AI coach has no clinical guardrails; uses source attribution + confidence labels instead | User is sophisticated and values epistemic honesty over watered-down disclaimers; low-evidence claims (e.g. animal-only) must be flagged clearly | ✓ Good — shipped v2.0.0; confidence badges (color+icon) + data-vs-research attribution landed |
| Milestone scope = diet UX overhaul + AI chat depth + full quality pass | Diet is the daily friction point; chat is the leverage point; quality pass lays foundation for future tracking domains | ✓ Good — all 42 requirements delivered in v2.0.0 |
| Future milestones (post-refinement): additional tracking domains, goals system, import/export | Don't sprawl this milestone; prove refinement first | — Pending — carried to PROJECT Active as next-milestone candidates |
| LocalStorage + single-user + Electron shell stay as defaults | These are the defining shape of the product; negotiable only on a strong, specific reason | ✓ Good |
| Schema migrations remain the mechanism for data shape changes | Already in place V0→V4; new memory/goals/preferences fields will land via V5+ | ✓ Good — V4→V5→V6→V7 shipped on the typed backup-before-migrate harness with zero data-loss incidents |
| Anthropic-native tool use over RAG/embeddings; single SDK-boundary chokepoint (D-17) | Bounded structured data for one user beats a vector DB; confining `@anthropic-ai/sdk` to one service keeps models/parsers SDK-agnostic and testable | ✓ Good — carried the entire AI build-out (Phases 3–5) |
| Only API-structured citations render as links; free-generated citations never link | Bounds 14–95% LLM citation-fabrication risk | ✓ Good — allow-list guard + adversarial regression test |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-03 after **v2.0.0 "Refinement" milestone COMPLETE** (5/5 phases, 37 plans, 42/42 requirements). Shipped: diet UX overhaul, agentic AI coach with persistent memory + opt-in web-search grounding + evidence-graded output, and a full quality/security/a11y sweep — all on a refactor-safe Phase-1 foundation. Tagged v2.0.0; package.json bumped to 2.0.0. 9 known items deferred (see STATE.md → Deferred Items). Next: `/gsd-new-milestone` to scope the next cycle.*
