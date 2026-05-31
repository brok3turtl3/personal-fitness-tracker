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

### Active

<!-- Refinement milestone (v2). Hypotheses until shipped and validated. -->

**Diet tracking — full review and UX overhaul**

- [ ] Smooth flow for adding new foods to the saved-foods library
- [ ] Multiple unit types handled cleanly (g, oz, cups, servings, etc.) with sensible conversion or per-food unit definition
- [ ] Frictionless meal logging (search, portion, copy/repeat meals)
- [ ] Accurate daily totals (calories, macros, net carbs) with clear, scannable display
- [ ] Diet history integrated cleanly into charts and trends

**AI chat — depth upgrade**

- [x] AI has access to the user's full data and history via read-only `query_*` tools + agentic loop — Validated in Phase 4
- [ ] Persistent memory across sessions (goals, preferences, prior context)
- [ ] Research-grounded coaching that draws on both traditional and cutting-edge sources
- [x] Source attribution + per-claim confidence labelling (data vs research; strong…animal-only…speculative, low-confidence color+icon) + tool-use transparency + citation-link guard — Validated in Phase 4

**Full quality pass**

- [ ] Test coverage tightening (unit + integration where it pays off)
- [ ] Refactor smells, dead code removal, type tightening
- [ ] Accessibility audit (semantic HTML, labels, keyboard nav, contrast)
- [ ] Cross-app UX consistency review (forms, validation, empty states, error states)

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

- **Brownfield Angular 18 app, version 1.2.3.** Codebase already mapped — see `.planning/codebase/` (ARCHITECTURE, STACK, STRUCTURE, CONVENTIONS, INTEGRATIONS, TESTING, CONCERNS).
- **Single sophisticated user** (the developer), running daily-driver. Refinement is triggered by lived friction + a desire to lay a solid foundation before adding new tracking domains.
- **Diet tracking is the known weak spot** — adding new foods is rough, unit handling is awkward, daily display can be cleaner. This is the first thing users (i.e. the dev) hit friction on.
- **AI chat is wired up but shallow** — `fitness-context.service.ts` builds a single snapshot for the system prompt; `chat.service.ts` calls Anthropic via `anthropic-api.service.ts`. Goal is to evolve from "snapshot chatbot" to "coach that knows everything and grounds its advice."
- **Schema versioning is active** — any data-shape change for goals/memory/preferences needs a new migration step (V5+).
- **Existing test surface:** 12 `.spec.ts` files covering services, validators, app component, and shared utilities. Coverage depth unknown — quality pass will measure first.
- **API key + telemetry posture:** API key stored locally in `AppData.aiSettings`; no telemetry; only outbound traffic is the user-initiated chat request to `api.anthropic.com/v1/messages`.

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
| AI coach has no clinical guardrails; uses source attribution + confidence labels instead | User is sophisticated and values epistemic honesty over watered-down disclaimers; low-evidence claims (e.g. animal-only) must be flagged clearly | — Pending |
| Milestone scope = diet UX overhaul + AI chat depth + full quality pass | Diet is the daily friction point; chat is the leverage point; quality pass lays foundation for future tracking domains | — Pending |
| Future milestones (post-refinement): additional tracking domains, goals system, import/export | Don't sprawl this milestone; prove refinement first | — Pending |
| LocalStorage + single-user + Electron shell stay as defaults | These are the defining shape of the product; negotiable only on a strong, specific reason | ✓ Good |
| Schema migrations remain the mechanism for data shape changes | Already in place V0→V4; new memory/goals/preferences fields will land via V5+ | ✓ Good |

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
*Last updated: 2026-05-31 after Phase 4 (Agentic Loop + Citation UI) completion — agentic coach reads real data via `query_*` tools, bounded multi-turn loop, per-claim confidence + source attribution, tool-use disclosures, citation-link guard, slim cached context. 3 visual UAT items pending (04-HUMAN-UAT.md).*
