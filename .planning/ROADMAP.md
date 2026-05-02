# Roadmap: Personal Fitness Tracker — Refinement Milestone (v2)

**Created:** 2026-05-02
**Granularity:** standard (5 phases)
**Coverage:** 42/42 v2 requirements mapped
**Parallelization:** enabled (Phases 2 & 3 are file-disjoint and may run in parallel)

---

## Phases

- [ ] **Phase 1: Foundations** — Test scaffolds, shared utilities, subscription hygiene, schema-migration discipline. No feature work; everything later phases stand on. (FOUND-01..07)
- [ ] **Phase 2: Diet UX Overhaul** — Multi-unit foods, frictionless meal logging, daily totals, charts integration, V5→V6 schema. (DIET-01..10) [parallel with Phase 3]
- [ ] **Phase 3: AI Memory + Tool Plumbing** — V4→V5 schema, memory tool, user profile, tool registry, settings UI. Plumbing only — no behavior change for the user yet. (CHAT-01, CHAT-03, CHAT-04, CHAT-11, CHAT-12) [parallel with Phase 2]
- [ ] **Phase 4: Agentic Loop + Citation UI** — Activate the `while(stop_reason=='tool_use')` loop, data-query tools, slim system prompt, block-aware chat rendering, confidence badges. (CHAT-02, CHAT-05, CHAT-06, CHAT-07, CHAT-08, CHAT-09, CHAT-10)
- [ ] **Phase 5: Web Search Grounding + Quality Sweep** — Web search server tool with grounded citations, then the final quality pass (CRUD parity, quota detection, multi-tab safety, CSP, archival, 401 rotation, a11y, mutation tests). (RESCH-01..03, QUAL-01..10)

---

## Phase Details

### Phase 1: Foundations
**Goal**: Refactor safety net is in place — characterization tests, shared utilities, subscription hygiene, and schema-migration discipline so that later phases cannot silently regress behavior or corrupt data.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07
**Success Criteria** (what must be TRUE):
  1. A user (developer) can run `ng test --no-watch --code-coverage` and see coverage thresholds enforced — a refactor that drops coverage fails CI rather than passing silently.
  2. A user can refactor `diet-page`, `chat-page`, `charts-page`, or `reports-page` and see characterization tests catch any regression in DOM output or key user flows.
  3. A user navigating between pages produces no leaked subscriptions (verifiable in Angular DevTools), and an empty- or error-state on any feature page renders consistently across the app.
  4. A user whose stored `AppData` shape is malformed sees an explicit migration-failure UI with a recovery key pointing at their pre-migration backup, instead of silently losing data.
  5. A user (or CI) can run a Puppeteer smoke test and an `axe-core` per-route a11y audit without inventing the harness — both extend the scaffolds shipped in this phase.
**Plans**: 10 plans across 4 waves

**Wave 1** *(no dependencies — runs first)*
- [x] 01-foundations/01-01-PLAN.md — Coverage config + axe-core install + tsconfig.spec patch (FOUND-01) — completed 2026-05-02 (3 commits: a638189, e56e818, aef83cb; SUMMARY: 01-01-SUMMARY.md)
- [x] 01-foundations/01-02-PLAN.md — Shared utilities create: id.ts, chart-grouping.ts, a11y-test-helpers.ts (FOUND-02, FOUND-04, FOUND-05) — completed 2026-05-02 (3 commits: fd0a850, 9bc9680, 7190fba; SUMMARY: 01-02-SUMMARY.md). Building blocks only; FOUND-02/04/05 not yet marked complete in REQUIREMENTS.md (gate on consumer retrofit in plan 06 and characterization specs in plan 08).
- [x] 01-foundations/01-03-PLAN.md — Empty-state + error-state standalone components (FOUND-06) — completed 2026-05-02 (4 commits: c9c12b2, 2227b9f, 99f3d8b, b28b39f; SUMMARY: 01-03-SUMMARY.md). Both components live in `src/app/shared/`; FOUND-06 NOT yet marked complete in REQUIREMENTS.md (gate on Wave 2 plan 07 page retrofit — pattern exists but no feature page imports it yet).
- [x] 01-foundations/01-04-PLAN.md — Typed legacy schemas + V0..V3 fixtures + malformed-input fixtures (FOUND-07 — building blocks) — completed 2026-05-02 (3 commits: 694b914, afa9eee, cb2e002; SUMMARY: 01-04-SUMMARY.md). 13 new files: legacy-schemas.ts (5 type-only interfaces) + 12 JSON fixtures (4 input v0..v3, 4 expected v1..v4, 4 malformed). FOUND-07 NOT yet marked complete in REQUIREMENTS.md (gate on Wave 2 plan 09 storage.service.ts refactor + Wave 3 plan 10 recovery banner). Wave 1 of Phase 1 now complete.

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-foundations/01-05-PLAN.md — Puppeteer + axe-core e2e harness scaffold (FOUND-05) — completed 2026-05-02 (3 commits: 2dcd7d6, e1edd59, 2ea790a; SUMMARY: 01-05-SUMMARY.md). 5 new files in `e2e/` (run.mjs, smoke.spec.mjs, a11y.spec.mjs, fixtures/seed-data.json, README.md) + 1 line in `package.json` (`scripts.e2e: "node e2e/run.mjs"`). Two-terminal flow (no concurrently/wait-on). 8 routes covered in BOTH spec files; D-08 severity gate (serious|critical) wired. FOUND-05 NOT yet marked complete in REQUIREMENTS.md — gate on plan 08 characterization specs consuming a11y-test-helpers. Wave 2 now 1/3 complete.
- [x] 01-foundations/01-06-PLAN.md — id.ts + chart-grouping consumer retrofit across services + chart pages (FOUND-02) — completed 2026-05-02 (3 commits: a8b752a, 6801180, cc64149; SUMMARY: 01-06-SUMMARY.md). 8 files modified: 5 services (cardio/weight/readings/diet/chat) + 3 feature pages (diet-page, charts-page, report-page). 6 generateUUID copies deleted (~70 lines) and 6 chart-grouping copies deleted (~96 lines). Full suite regression: 219/219 SUCCESS. **FOUND-02 marked complete in REQUIREMENTS.md** — both shared utilities (`id.ts`, `chart-grouping.ts`) now have all consumers retrofitted. Wave 2 now 2/3 complete.
- [ ] 01-foundations/01-09-PLAN.md — Storage migration refactor: typed chain + backup-before-migrate + fixture-driven spec (FOUND-07) — depends on Plan 04

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 01-foundations/01-07-PLAN.md — Empty/error retrofit + subscription hygiene across 8 feature pages (FOUND-03, FOUND-06) — depends on Plans 03, 06
- [ ] 01-foundations/01-10-PLAN.md — Recovery banner + AppComponent integration (FOUND-07) — depends on Plans 03, 09

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 01-foundations/01-08-PLAN.md — Characterization specs for diet/chat/charts/reports (FOUND-04, FOUND-05) — depends on Plans 02, 03, 07

**Cross-cutting constraints** *(must_haves shared across plans):*
- Storage chokepoint: `StorageService` is the sole LocalStorage access path (Plans 09, 10 add tree-wide grep gate)
- Standalone components only — no NgModules introduced (Plans 03, 10)
- No `any` in production paths — typed legacy interfaces replace existing `as any` casts (Plans 04, 09)
- axe-core severity threshold: serious/critical only fail Phase 1 specs (Plans 02, 05, 08)

### Phase 2: Diet UX Overhaul
**Goal**: The user's daily diet-logging friction is gone — adding new foods, picking the right unit, copying yesterday's meal, and seeing accurate daily totals all happen without leaving the meal-log flow.
**Depends on**: Phase 1 (characterization tests for `diet-page`, schema-migration discipline, shared `groupByDay`/`toDateKey`)
**Requirements**: DIET-01, DIET-02, DIET-03, DIET-04, DIET-05, DIET-06, DIET-07, DIET-08, DIET-09, DIET-10
**Success Criteria** (what must be TRUE):
  1. A user mid-meal-log can quick-add a new food (name, calories, macros, native unit) without leaving the meal-log flow, and the new food is immediately available to log.
  2. A user can log a food in any of its declared native units (g, oz, cup, tbsp, etc.) with conversions that are correct across weight↔volume using each food's own density — no global density assumption ever leaks in.
  3. A user can log a meal with search-as-you-type, recent foods, and auto-ranked favorites — and can copy a previous day's meal with one action.
  4. A user logging a meal sees scannable daily totals (kcal, protein, fat, carbs, net carbs) update live, with optional macro/calorie targets shown as %-of-target when set, and a charts-page surface showing diet history alongside cardio/weight/readings.
  5. A user editing a saved food sees zero retroactive change to historical meal entries (nutrition, serving, and unit are snapshotted at log time), and day-boundary math uses local time consistently across diet, charts, and reports — including across DST transitions.
**Plans**: TBD
**UI hint**: yes

### Phase 3: AI Memory + Tool Plumbing
**Goal**: All the AI infrastructure the agentic loop will need is in place — schema migrated for memory + profile + structured chat blocks, memory tool wired to a typed store, user profile editable, tool registry ready to dispatch — but the user still sees today's chat behavior. No regressions.
**Depends on**: Phase 1 (schema-migration discipline, characterization tests for `chat-page`, shared utilities). File-disjoint with Phase 2 — both can run in parallel.
**Requirements**: CHAT-01, CHAT-03, CHAT-04, CHAT-11, CHAT-12
**Success Criteria** (what must be TRUE):
  1. A user upgrading from V4 sees existing chat conversations preserved as `ChatMessage.blocks: [{ type: 'text', text: ... }]`, with `memoryFiles`, `userProfile`, and `aiToolSettings` defaulted — and a backup of their pre-migration data sits behind a recovery key.
  2. A user can edit their structured `UserProfile` (goals, preferences, dietary constraints, training history) on `/settings` and see the AI's view of it reflect the change immediately on the next message.
  3. A user can toggle AI tool capabilities (data-query, memory, web-search), set the agent-turn cap and web-search usage cap, and inspect/delete memory files from `/settings`.
  4. A user-entered meal note containing prompt-injection text (e.g. `</system>`) cannot escape its delimiter wrapper in the system prompt, and any AI tool-call argument is re-validated through the same domain validators that guard direct user input.
  5. A user sending a chat message at the end of this phase sees the same single-shot behavior as today — no agentic loop yet — confirming plumbing landed without breaking shipped behavior.
**Plans**: TBD
**UI hint**: yes
**AI hint**: yes

### Phase 4: Agentic Loop + Citation UI
**Goal**: The chat is now an agentic coach — Claude reads the user's actual data through tools, runs a multi-turn loop, and emits answers with confidence labels, source attribution, and tool-use transparency. The user can see what the AI looked at and how confident it is.
**Depends on**: Phase 3 (tool registry, extended API types, memory executor, profile service, schema V5)
**Requirements**: CHAT-02, CHAT-05, CHAT-06, CHAT-07, CHAT-08, CHAT-09, CHAT-10
**Success Criteria** (what must be TRUE):
  1. A user asking "how's my weight trending vs my goal?" sees the AI fetch real data via `query_*` tools (cardio, weight, readings, meals, daily totals, saved foods), run an agentic loop bounded by `maxAgentTurns`, and answer with cross-domain insight grounded in their actual logs.
  2. A user can expand any AI message to see the underlying `tool_use` and `tool_result` blocks (collapsed by default), so they can verify what data the AI looked at.
  3. A user reading an AI response sees per-claim confidence badges (`strong | moderate | weak | animal-only | anecdotal | speculative`) where low-confidence states are visually distinct (color + icon — not just text), and source attribution clearly distinguishes "from your data" vs "from research."
  4. A user never sees a free-generated citation rendered as a clickable link — only API-structured citations (`web_search_result_location`, `search_result` blocks) become hyperlinks; free-text author-year strings render as plain text.
  5. A user with a typical conversation sees real token counts (via `messages.countTokens`) drive the rolling-window decision, system-prompt cache reads cost 10% of input tokens (via `cache_control: ephemeral`), and `FitnessContextService` produces a thin ~500-token header instead of stuffing the full dataset.
**Plans**: TBD
**UI hint**: yes
**AI hint**: yes

### Phase 5: Web Search Grounding + Quality Sweep
**Goal**: The AI can ground research-grounded coaching in live web sources with first-class citations (when the user opts in), and the rest of the app reaches a coherent quality bar — full CRUD parity, quota safety, multi-tab safety, CSP, key-rotation flow, archival, and a verified accessibility/UX consistency pass.
**Depends on**: Phase 4 (the agentic loop must handle `end_turn`, `max_tokens`, refusal, and `pause_turn` reliably before adding server tools)
**Requirements**: RESCH-01, RESCH-02, RESCH-03, QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06, QUAL-07, QUAL-08, QUAL-09, QUAL-10
**Success Criteria** (what must be TRUE):
  1. A user who enables web search in `/settings` (off by default) and asks a research question sees the AI cite live sources as inline footnotes — only `https:` URLs are clickable, and the configured `webSearchMaxUses` cap visibly bounds cost; an adversarial regression test proves "find a study about X" prompts cannot fabricate un-grounded citation links.
  2. A user can edit (not just delete-and-re-add) any cardio session, weight entry, or health reading, and a typo correction preserves the original `id` and `createdAt`.
  3. A user whose LocalStorage usage crosses 70% sees a visible warning banner; at 95% writes are blocked with a clear archive/export prompt — quota detection uses `navigator.storage.estimate()` and matches `QuotaExceededError` plus Firefox `NS_ERROR_DOM_QUOTA_REACHED`.
  4. A user with two windows open who edits in one sees the other detect the change via the `storage` event and surface a "data changed elsewhere — refresh" banner; a stale 401 from Anthropic surfaces a "rotate / re-enter key" prompt rather than a console error.
  5. A user navigating any of the eight feature pages experiences consistent forms, validation, empty/error states, full keyboard navigability, and zero serious/critical `axe-core` violations; a chat-archival pass keeps the active conversation slice small; CSP blocks any external connection except `https://api.anthropic.com`; mutation testing on at least one critical service proves coverage represents real confidence.
**Plans**: TBD
**UI hint**: yes
**AI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations | 6/10 | In progress (Wave 1 complete; Wave 2 2/3 complete — plans 05 + 06 done, plan 09 remains) | - |
| 2. Diet UX Overhaul | 0/? | Not started | - |
| 3. AI Memory + Tool Plumbing | 0/? | Not started | - |
| 4. Agentic Loop + Citation UI | 0/? | Not started | - |
| 5. Web Search Grounding + Quality Sweep | 0/? | Not started | - |

---

## Phase Ordering Rationale

- **Phase 1 before everything**: Test scaffolding, subscription hygiene, shared utilities, and typed-legacy schema-migration discipline are reused by every later phase. Doing them first is cheaper than retrofitting.
- **V4→V5 (Phase 3) before V5→V6 (Phase 2)**: Strictly speaking, Phase 3 ships the V4→V5 migration which includes the most invasive data change (`ChatMessage.content: string` → `ChatMessage.blocks: ChatBlock[]`). Phase 2's V5→V6 migration must build on V5 as its baseline. Both ride on FOUND-07's typed-legacy + backup discipline. **If Phases 2 and 3 are truly run in parallel, the V4→V5 migration must land in main first**; the diet schema work then targets the V5 baseline.
- **Phases 2 and 3 are file-disjoint**: Phase 2 touches `features/diet/**`, `services/diet.service.ts`, `services/units.ts` (new), `models/diet.model.ts`, `migrateV5ToV6`. Phase 3 touches `features/chat/**`, `features/settings/**`, `services/chat.service.ts`, `services/anthropic-api.service.ts`, `services/fitness-context.service.ts`, new memory/profile/tool-registry services, `models/ai-chat.model.ts`, `models/app-data.model.ts`, `migrateV4ToV5`. Both can be developed in parallel branches.
- **Phase 3 before Phase 4**: The agentic loop in Phase 4 requires Phase 3's tool registry, memory executor, extended API types, profile service, and `ChatMessage.blocks` shape. Splitting plumbing (3) from activation (4) makes each independently reviewable and lets the loop be tested against stubbed API responses before serving real users.
- **Phase 4 before Phase 5**: Web search is one more tool kind once the agentic loop handles `end_turn`, `max_tokens`, refusal, and `pause_turn` reliably. The quality sweep applies Phase 1 instrumentation to all new code from Phases 2/3/4 and closes the cross-cutting concerns surfaced in CONCERNS.md (CRUD parity, quota, multi-tab, CSP, archival, 401, a11y).

---

*Roadmap created: 2026-05-02*
