# Requirements: Personal Fitness Tracker — Refinement Milestone (v2)

**Defined:** 2026-05-02
**Core Value:** A trustworthy personal health record paired with a knowledgeable AI coach that can see all of it — so the user can both log faithfully and get sharp, evidence-graded guidance, with nothing leaving the machine except the AI request itself.

---

## v2 Requirements

Requirements for the refinement milestone. Each maps to roadmap phases (filled in during roadmap creation).

### FOUND — Foundations (test scaffolding, shared utilities, refactor safety)

- [x] **FOUND-01**: Test coverage baseline is measured and thresholds are enforced via `karma.conf.js` (so refactors can't silently regress coverage) — completed in plan 01-01 (2026-05-02)
- [x] **FOUND-02**: Shared utilities extracted to `src/app/shared/` — single `id` helper replacing 5× duplicated UUID generators; single `groupByDay` / `toDateKey` helper (fixes the existing chart-vs-report day-grouping drift) — completed in plans 01-02 (utility creation) + 01-06 (consumer retrofit, 2026-05-02)
- [x] **FOUND-03**: Subscription hygiene — `takeUntilDestroyed(this.destroyRef)` applied to every component that subscribes to RxJS streams
- [x] **FOUND-04**: Characterization tests (DOM snapshots + key user flows) in place for `diet-page`, `chat-page`, `charts-page`, `reports-page` BEFORE any refactor touches them — completed in plan 01-08 (2026-05-02)
- [x] **FOUND-05**: Puppeteer e2e and `axe-core` per-route a11y scaffolds wired so later phases extend rather than invent — completed in plans 01-05 (e2e harness) + 01-08 (axe-core in characterization specs, 2026-05-02)
- [x] **FOUND-06**: Shared empty-state + error-state component pattern available for reuse across feature pages
- [x] **FOUND-07**: Schema-migration discipline established — typed `LegacyAppDataVN` interfaces (no `as any` reads), backup-before-migrate recovery key, fixture-driven characterization tests, recovery banner UX — completed in plans 01-04 (typed schemas + fixtures) + 01-09 (typed migrate chain + backup-before-migrate) + 01-10 (recovery banner + AppComponent integration, 2026-05-02)

### DIET — Diet UX overhaul

- [ ] **DIET-01**: User can add a new food without leaving the meal-log flow (quick-add modal; no context switch)
- [ ] **DIET-02**: Each saved food can define its own native units (e.g. "1 cup", "1 slice", "1 medium banana") with stored gram-equivalents
- [ ] **DIET-03**: Unit conversion is correct across g / oz / cups / ml / tbsp using per-food density when needed (no global density assumption)
- [ ] **DIET-04**: Meal-log surfaces search-as-you-type, recent foods, and auto-ranked favorites
- [ ] **DIET-05**: User can copy a meal from a previous day with one action
- [ ] **DIET-06**: Daily totals (kcal, protein, fat, carbs, net carbs) are scannable while logging; optional per-day macro/calorie targets show as %-of-target
- [ ] **DIET-07**: Diet history is integrated into the charts page (calories + macros over time, with date-range filter)
- [ ] **DIET-08**: Day boundaries use the user's local time consistently (no UTC drift across diet, charts, reports)
- [ ] **DIET-09**: Editing a saved food does NOT retroactively change historical meal entries (nutrition + serving + unit are snapshotted at log time)
- [ ] **DIET-10**: V5→V6 schema migration ships cleanly (`SavedFood.densityGramsPerMl?`, `preferredUnits?`, widened `baseUnit`) with backup, fixture tests, and malformed-input coverage

### CHAT — AI chat depth upgrade

- [x] **CHAT-01**: V4→V5 schema migration ships cleanly — adds `memoryFiles`, `userProfile`, `aiToolSettings`; lifts `ChatMessage.content: string` to `ChatMessage.blocks: ChatBlock[]` while preserving existing conversations
- [x] **CHAT-02**: AI has read access to the full data set via Anthropic tool use — `query_cardio_sessions`, `query_weight_entries`, `query_readings`, `query_meals_in_range`, `query_daily_totals`, `query_saved_foods`
- [x] **CHAT-03**: AI has persistent memory across sessions via the official `memory_20250818` tool, backed by `AppData.memoryFiles`, with path validation (`/memories` prefix required, `..` rejected)
- [x] **CHAT-04**: Structured `UserProfile` (goals, preferences, dietary constraints, training history) is editable in `/settings` and visible to the AI; AI can propose updates via `update_profile` with confirm-before-write
- [x] **CHAT-05**: `ChatService` runs an agentic `while (stop_reason === 'tool_use')` loop with a configurable `maxAgentTurns` guard, dispatching through a single `ToolRegistryService`
- [x] **CHAT-06**: Tool-call transparency — `tool_use` and `tool_result` blocks render as collapsed sections inside the message stream, expandable on demand
- [x] **CHAT-07**: Per-claim confidence labels are parsed and rendered as inline badges with the taxonomy `strong | moderate | weak | animal-only | anecdotal | speculative`; low-confidence states are visually distinct (color + icon)
- [x] **CHAT-08**: Source attribution clearly distinguishes "from your data" vs "from research" in the rendered output
- [x] **CHAT-09**: AI never renders free-generated citations as links — only API-structured citations (`web_search_result_location`, `search_result` blocks) become hyperlinks
- [x] **CHAT-10**: Token usage is real (not heuristic): `messages.countTokens` replaces `text.length / 4`; `cache_control: { type: 'ephemeral' }` is applied to the system prompt; `FitnessContextService` produces a thin (~500 token) header instead of stuffing full data
- [x] **CHAT-11**: Prompt-injection defense — system prompt uses delimiter pattern around user-entered content; tool-call arguments are re-validated through existing domain validators before execution
- [x] **CHAT-12**: `/settings` exposes AI tool toggles (data-query, memory, web-search), memory inspector (read/delete files), agent-turn cap, and web-search usage cap

### RESCH — AI research grounding (web search)

- [x] **RESCH-01**: Anthropic `web_search_20250305` server tool is wired into `tools[]` when `aiToolSettings.enableWebSearch === true` (default off)
- [x] **RESCH-02**: Web-search citations render as inline footnotes; only `https:` URLs are clickable; `web_search_tool_result` blocks display in the message stream
- [x] **RESCH-03**: Cost-aware controls — `webSearchMaxUses` cap configurable in settings; adversarial regression test verifies that "find a study about X" prompts cannot produce free-generated (un-grounded) citation links

### QUAL — Quality pass (final sweep across the app)

- [x] **QUAL-01**: Type tightening — no `any` remains in production paths; any documented exceptions carry a `// TODO: type when …` rationale
- [x] **QUAL-02**: LocalStorage quota detection + visible UI banner — warn at ≥70%, block writes at ≥95%; uses `navigator.storage.estimate()` instead of hardcoded 5 MB; cross-browser error name matching (`QuotaExceededError`, Firefox `NS_ERROR_DOM_QUOTA_REACHED`)
- [x] **QUAL-03**: CRUD parity — add `update*` operations for cardio, weight, and readings (gap flagged in CONCERNS.md)
- [x] **QUAL-04**: Multi-tab safety — `storage` event listener with "data changed elsewhere — refresh" banner
- [x] **QUAL-05**: Chat archival — pre-summary messages are moved to a lazy-loaded archive key so the active conversation slice stays small (cap-pressure relief)
- [x] **QUAL-06**: CSP header configured: `default-src 'self'; connect-src 'self' https://api.anthropic.com; script-src 'self'; object-src 'none'; img-src 'self' data:`
- [x] **QUAL-07**: API key error handling — 401 from Anthropic surfaces a "rotate / re-enter key" prompt instead of a console error
- [x] **QUAL-08**: Final accessibility pass — automated `axe-core` per route + manual keyboard navigation + manual color-contrast review across all 8 feature pages
- [x] **QUAL-09**: UX consistency review — forms, validation messages, empty states, error states are visually and behaviorally consistent across all 8 feature pages
- [x] **QUAL-10**: Mutation testing applied to at least one critical service (likely `StorageService` or `validators.ts`) to validate that coverage represents real confidence, not theater

---

## Future Milestones (out of this milestone, in scope eventually)

These were called out in PROJECT.md as future work — not in this roadmap, but tracked.

### TRACK — Additional tracking domains

- **TRACK-01**: Sleep tracking
- **TRACK-02**: Mood / subjective wellbeing
- **TRACK-03**: Steps / activity
- **TRACK-04**: Hydration
- **TRACK-05**: Supplements

### GOALS — Goals & progress system

- **GOALS-01**: First-class goals model (separate from chat memory)
- **GOALS-02**: Adherence / streak tracking
- **GOALS-03**: Milestone notifications

### IO — Data import / export

- **IO-01**: Apple Health import
- **IO-02**: CSV import / export
- **IO-03**: Backup / restore round-trip

---

## Out of Scope

Explicit exclusions. Documented to prevent scope creep and re-litigation.

| Feature | Reason |
|---------|--------|
| Multi-user / authentication | Single-user is core to the product identity (PROJECT.md) |
| Cloud backend / sync | LocalStorage-only is a defining pillar; revisit only with a strong reason |
| Removing the Electron desktop shell | Desktop distribution stays functional |
| Vector DB / embeddings for AI memory | Tool calls over typed services beat RAG for single user with bounded structured data (research) |
| External food databases (Open Food Facts, USDA FoodData) | CORS-blocked for browser-direct access (research-confirmed); requires a backend |
| Barcode scanning | Defers to food-DB resolution; requires non-trivial Electron media permissions |
| Clinical disclaimers / medical-advice guardrails | Replaced by per-claim confidence labels + source attribution per PROJECT.md Key Decision |
| AI-generated meal/workout plans auto-saved as future log entries | Corrupts the data record; would conflate user-logged truth with model speculation |
| Continuous background AI calls | Conflicts with "only outbound traffic is the user-initiated chat request" |
| Free-generated AI citations as clickable links | Hallucinated-citation risk too high; only API-structured citations link out |
| NgRx / external state management | `StorageService.cachedData` + `providedIn: 'root'` services is sufficient |
| Karma+Jasmine → Vitest migration | Migration cost not justified for 12 spec files; Karma still first-class in Angular 18 |

---

## Traceability

Mapped by the roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete (plan 01-01, 2026-05-02) |
| FOUND-02 | Phase 1 | Complete (plans 01-02 + 01-06, 2026-05-02) |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete (plan 01-08, 2026-05-02) |
| FOUND-05 | Phase 1 | Complete (plans 01-05 + 01-08, 2026-05-02) |
| FOUND-06 | Phase 1 | Complete |
| FOUND-07 | Phase 1 | Complete (plans 01-04 + 01-09 + 01-10, 2026-05-02) |
| DIET-01 | Phase 2 | Pending |
| DIET-02 | Phase 2 | Pending |
| DIET-03 | Phase 2 | Pending |
| DIET-04 | Phase 2 | Pending |
| DIET-05 | Phase 2 | Pending |
| DIET-06 | Phase 2 | Pending |
| DIET-07 | Phase 2 | Pending |
| DIET-08 | Phase 2 | Pending |
| DIET-09 | Phase 2 | Pending |
| DIET-10 | Phase 2 | Pending |
| CHAT-01 | Phase 3 | Complete |
| CHAT-02 | Phase 4 | Complete |
| CHAT-03 | Phase 3 | Complete |
| CHAT-04 | Phase 3 | Complete |
| CHAT-05 | Phase 4 | Complete |
| CHAT-06 | Phase 4 | Complete |
| CHAT-07 | Phase 4 | Complete |
| CHAT-08 | Phase 4 | Complete |
| CHAT-09 | Phase 4 | Complete |
| CHAT-10 | Phase 4 | Complete |
| CHAT-11 | Phase 3 | Complete |
| CHAT-12 | Phase 3 | Complete |
| RESCH-01 | Phase 5 | Complete |
| RESCH-02 | Phase 5 | Complete |
| RESCH-03 | Phase 5 | Complete |
| QUAL-01 | Phase 5 | Complete |
| QUAL-02 | Phase 5 | Complete |
| QUAL-03 | Phase 5 | Complete |
| QUAL-04 | Phase 5 | Complete |
| QUAL-05 | Phase 5 | Complete |
| QUAL-06 | Phase 5 | Complete |
| QUAL-07 | Phase 5 | Complete |
| QUAL-08 | Phase 5 | Complete |
| QUAL-09 | Phase 5 | Complete |
| QUAL-10 | Phase 5 | Complete |

**Coverage:**
- v2 requirements: 42 total
- Mapped to phases: 42 (100% — Phase 1: 7, Phase 2: 10, Phase 3: 5, Phase 4: 7, Phase 5: 13)
- Unmapped: 0

---
*Requirements defined: 2026-05-02*
*Last updated: 2026-05-02 — FOUND-07 marked complete after plan 01-10 (recovery banner + AppComponent integration; final FOUND-07 piece — typed legacy schemas + backup-before-migrate + recovery banner all landed; tree-wide storage chokepoint gate now in place)*
