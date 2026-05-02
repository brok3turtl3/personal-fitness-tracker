# Feature Research

**Domain:** Single-user, local-first personal fitness tracker with embedded AI coach (Angular 18 SPA + Electron). Refinement milestone scope: diet UX overhaul, AI chat depth upgrade, full quality pass.
**Researched:** 2026-05-02
**Confidence:** HIGH on diet UX patterns and AI memory/citation patterns (cross-verified across product docs, peer-reviewed studies, and ecosystem references). MEDIUM on specific complexity estimates (anchored to existing codebase shape, not measured).

## Scope Note

The "user" here is a single sophisticated developer running a daily-driver app, not a market segment. "Table stakes" therefore means *"the developer-as-user will hit daily friction without it"*, not *"competitive parity with MyFitnessPal"*. Differentiators are framed against the chosen product identity from PROJECT.md ("trustworthy personal health record paired with a knowledgeable AI coach"), not commercial competitors.

Each feature is tagged with the refinement target it serves: **[DIET]**, **[CHAT]**, **[QUALITY]**, or combinations.

## Feature Landscape

### Table Stakes (Friction Without These)

Features the developer-as-user will hit friction on within the first week of use.

| Feature | Target | Why Expected | Complexity | Notes |
|---------|--------|--------------|------------|-------|
| Recent foods list (last N foods logged, ranked by recency) | DIET | Same foods repeat daily; typing the same name into a search every morning is friction the user is already feeling | LOW | Pure read over existing `mealEntries`; no schema change. Cap N at ~20. |
| Frequent / favorite foods (pinned or auto-ranked by use frequency) | DIET | Complements recents; recents alone churn when a one-off food is logged | LOW | Either auto-rank by 30-day count or add a `pinned: boolean` to `SavedFood`. Auto-rank avoids schema bump. |
| Search-as-you-type over saved foods library | DIET | The saved-foods library will grow past the point a flat dropdown is usable | LOW | Client-side filter on `SavedFood[]`. Case-insensitive substring match is enough; no fuzzy search needed at this scale. |
| Per-food native unit definition (food declares its own units; user logs in one of them) | DIET | Eggs in "each", chicken in "g" or "oz", milk in "ml" or "cups" — coercing everything to grams is the source of current friction | MEDIUM | Each `SavedFood` declares `units: { name, gramsEquivalent }[]`; meal item stores `{ unitName, amount, snapshot }`. Migration V5 needed. |
| Quick-add a new food from inside the meal-logging flow (no context switch) | DIET | Discovering mid-meal that a food isn't in the library and bouncing to a separate page kills momentum | MEDIUM | Modal/inline panel from meal logger; minimum fields only (name, calories, P/F/C, fiber, native unit). |
| Copy meal from a previous day / "log same as yesterday" | DIET | Daily eating patterns repeat; re-entering an identical breakfast is the second-biggest friction after unit handling | LOW | Read existing `MealEntry`, deep-clone with new id/date/timestamps. Both Cronometer and MyFitnessPal validate this as expected behavior. |
| Edit / delete a logged meal item without re-logging the whole meal | DIET | Mistakes happen daily (wrong portion, wrong food); without granular edit, users delete-and-re-add | LOW | Already partially supported via `DietService` CRUD; verify UX exposes per-item edit cleanly. |
| Daily totals summary visible while logging (calories, P/F/C, net carbs, % of optional target) | DIET | Logging without seeing running totals is logging blind; user has to mentally add | LOW | Existing `NutritionTotals` aggregator. UX work is "make it scannable and present on the page during logging", not new computation. |
| Net carbs displayed prominently (carbs - fiber, never below zero) | DIET | User cares about net carbs (existing `validators.ts` rule confirms); current display priority unknown | LOW | Already a calculated value; this is a presentation table-stake. |
| Empty states with a clear "add your first X" call-to-action | DIET, QUALITY | A new install or a never-used domain shows a blank screen — current state of UX consistency review per PROJECT.md | LOW | Pure template/copy work; should be standardized across all feature pages during quality pass. |
| Form validation surfaced inline (per-field, before submit) | QUALITY | Already partially present (Angular `Validators.*`) but UX consistency is called out in PROJECT.md as Active | LOW | Audit existing forms; standardize error-display component or pattern. |
| Keyboard navigation works end-to-end on every form | QUALITY | The user will use this app on Electron desktop daily; keyboard friction compounds | LOW–MEDIUM | Audit `tabindex`, focus management on modals, Enter-to-submit. Tooling: axe + Lighthouse. |
| All inputs have programmatic labels (`<label for>` or `aria-label`) | QUALITY | CLAUDE.md already mandates this; audit verifies it | LOW | Audit pass; fix gaps. |
| AI chat: full-data tool access (read cardio / weight / readings / diet / history by date range) | CHAT | This is the explicit Active requirement: "AI has access to the user's full data and history (not just a snapshot)". Without it, AI advice is shallow and the user loses trust. | HIGH | Implement Anthropic tool use (function calling) — define tools like `query_cardio_sessions`, `query_weight_entries`, `query_readings`, `query_meals_in_range`, `query_daily_totals`. Replace/augment current snapshot system prompt. Tool handlers run client-side against `StorageService`. |
| AI chat: persistent memory across sessions (goals, preferences, prior context) | CHAT | Active requirement: "Persistent memory across sessions". Without it, every session restarts from zero and the user re-explains context daily. | MEDIUM–HIGH | Add `userMemory: { goals: string[]; preferences: string[]; profile: Record<string,string>; notes: { id, content, createdAt }[] }` to `AppData` (V5 migration). Inject into system prompt every conversation. AI updates memory via a `update_user_memory` tool. |
| AI chat: source attribution on substantive claims (URL or "from your data: <fact>") | CHAT | Active requirement: "Source attribution and explicit confidence labelling on claims". Without it, claims are unverifiable. | MEDIUM | Two source kinds: (1) "from your data" — claims grounded in tool-call results, cited as "(your weight log, last 30 days)"; (2) "from research" — URL/citation in AI response, rendered as a clickable footnote in the chat UI. System-prompt instructs the model to cite. |
| AI chat: explicit confidence label per substantive claim | CHAT | Active requirement: flag low-evidence claims (e.g. animal-only, few clinical trials). Core to the "epistemic honesty" decision in PROJECT.md. | MEDIUM | System-prompt instructs model to label claims as `[HIGH]` / `[MEDIUM]` / `[LOW]` evidence with one-line rationale. Render as inline badges in chat UI. |
| Conversation history persisted (already exists) and searchable / filterable | CHAT | Already shipped (`chat-conversation-list.component.ts`); audit during quality pass for missing search if conversations accumulate | LOW | Existing infrastructure; possibly add filter-by-date/title. |

### Differentiators (Move From "Nice Tracker" To "Personal Coach")

Features that genuinely advance the experience beyond standard trackers, aligned with PROJECT.md Core Value.

| Feature | Target | Value Proposition | Complexity | Notes |
|---------|--------|-------------------|------------|-------|
| AI tool-use for arbitrary data queries (not just predefined views) | CHAT | "What did my fasting glucose look like the week after I started X?" — the coach can answer correlational questions across domains, which a static snapshot cannot. This is the core leverage point of the milestone. | HIGH | Builds on the table-stake tool access. Define enough query tools (date-range, type-filter, aggregate) that the model can compose answers. JSON Schema'd tools per Anthropic Messages API spec. |
| Cross-domain AI insights (diet ↔ weight ↔ glucose ↔ cardio correlations) | CHAT | Single-source apps can't say "your glucose spikes after high-carb dinners on rest days"; this app can, because the AI sees all of it. Aligns directly with "trustworthy personal health record paired with knowledgeable AI coach". | MEDIUM (given tool access) | Mostly a system-prompt + instruction concern once tool access exists. Optional: pre-compute common correlations as tool outputs to keep token costs sane. |
| Confidence + source UX as a chat-message first-class element (not buried in prose) | CHAT | The decision in PROJECT.md ("source attribution + confidence transparency instead of clinical disclaimers") only pays off if the UX makes those signals scannable. A footnote-style citation list at the bottom of each AI message + inline confidence badges is the differentiator. | MEDIUM | Render AI message as structured (parse citations from a known marker like `[^1]` or a JSON tail block). Footnote list expands inline. Confidence badge beside claims. |
| AI memory inspector (user can view + edit what the AI "knows" about them) | CHAT | Persistent memory is opaque and feels creepy if invisible; making it inspectable + editable turns it from a black box into a tool the user controls. | MEDIUM | New `/chat/memory` panel or section in `/settings`. Lists goals, preferences, notes; allow add/edit/delete. AI's `update_user_memory` tool calls visible in audit log. |
| Per-meal nutrition snapshot (immutable history) | DIET | Already an architectural pattern (`MealItem.snapshot` in `diet.model.ts`); editing a saved food does not retroactively rewrite history. This is rare among trackers and the right call for a longitudinal record. | LOW (preserve, don't add) | Already done — call it out so it isn't accidentally regressed during the diet UX overhaul. |
| Diet integrated into the existing charts page (calories trend, macros stacked area, net carbs trend) | DIET | Charts page already exists for cardio/weight/readings; adding diet closes the loop on "see your data". PROJECT.md Active item: "Diet history integrated cleanly into charts and trends". | LOW–MEDIUM | Reuse `BaseChartDirective` + `date-range.ts`. New chart configs; same date-range filter contract. |
| Optional macro/calorie targets (user sets a goal; daily totals show % of target) | DIET | Logging totals is more meaningful with a target; without one the user is staring at numbers with no anchor. Caveat: PROJECT.md defers "Goals & progress as a standalone feature" — keep this scoped to diet-only daily targets, not a general goals system. | LOW | Add `dietTargets?: { calories?, protein?, fat?, carbs?, netCarbs? }` to `AppData` (V5 along with units & memory). Render % beside totals. Defer if it creeps toward a goals surface. |
| Reasoning transparency: when AI calls tools, show the call + result in the chat UI (collapsed by default) | CHAT | Lets the user verify the AI is reading the right data. Builds trust; debuggable when answers are off. Aligns with "epistemic honesty" decision. | MEDIUM | Render tool_use / tool_result blocks as collapsible UI elements in the message stream. Existing chat components need a new message-block renderer. |
| Test coverage report integrated into dev workflow (Karma `--code-coverage` thresholds) | QUALITY | PROJECT.md Active: "Test coverage tightening (unit + integration where it pays off)". Without thresholds, coverage drifts. | LOW | Configure Karma coverage thresholds in `karma.conf.js`; surface report on `ng test --no-watch --code-coverage`. Document in CLAUDE.md. |
| Type tightening: remove inline `generateUUID()` duplication across 5 services, switch to `crypto.randomUUID()` | QUALITY | ARCHITECTURE.md already calls this out as a smell — duplicated `Math.random()`-based UUID v4 across cardio/weight/readings/diet/chat services. | LOW | Single shared `id.ts` helper in `shared/`; replace 5 call sites. Pure refactor. |
| Accessibility audit pass with axe + Lighthouse | QUALITY | Active requirement; concrete tooling makes this measurable not vibes-based. | LOW | Run axe-core in spec or as a manual pass; record violations; fix. |
| Empty-state + error-state component / pattern (consistent across all features) | QUALITY | UX consistency review is in scope. Standardizing empty states + error states is the single highest-leverage consistency win. | LOW | Either a `<app-empty-state>` shared component or a documented copy/layout pattern. Roll out across all 8 feature pages. |

### Anti-Features (Deliberately NOT Built)

Features that look reasonable but conflict with PROJECT.md constraints or the product identity.

| Feature | Why It Looks Tempting | Why Not | Alternative |
|---------|----------------------|---------|-------------|
| Barcode scanning for food entry | Standard in modern diet trackers; reduces typing | Requires camera access + a remote food database; this is a desktop Electron app with no upstream nutrition DB and the user enters foods they actually eat repeatedly. ROI is near zero for a single user with a personal library. | Recent + favorite foods + search-as-you-type. Already covers >95% of daily logging. |
| Remote / cloud food database (USDA, OFF, Nutritionix) | Pre-populated foods; less data entry | Direct conflict with PROJECT.md Out of Scope: "Cloud backend or sync — LocalStorage-only is a defining pillar". Adds external host beyond `api.anthropic.com` (the only sanctioned egress). | User builds personal library once, reuses forever. Quick-add flow keeps the cost of adding new foods low. |
| Photo-based food recognition / AI food estimation | Trendy in 2025+ apps | Inaccurate, requires either local ML (heavy) or another remote service (out of scope). Single-user app does not need this. | Quick-add + saved foods. |
| Community / social / sharing features | "Engagement" patterns from commercial apps | Direct conflict with PROJECT.md Out of Scope: "Multi-user / authentication — single-user is core". | None. Out of scope by design. |
| Achievements / streaks / gamification | Drives habit in commercial apps | The user is the developer, intrinsically motivated; gamification adds noise to the data display and clutters the UI. Not a behavioral problem this app needs to solve. | Trustworthy data + sharp AI feedback is the motivator. |
| Paid plans / premium tiers / monetization scaffolding | Standard product structure | Single-user personal app. Zero applicable. | None. |
| Real-time sync across devices | "Use it anywhere" appeal | Conflicts with LocalStorage-only constraint and single-user model. Re-introduces a backend the project explicitly does not have. | Run the same Electron build on each machine the user wants. Defer multi-device to a future explicit milestone. |
| Apple Health / Google Fit / Samsung Health / Garmin sync | Reduces manual entry | PROJECT.md Out of Scope: "Data import / export ... deferred to future milestones". Touching it now bloats the milestone. | Defer. Manual entry is acceptable for a sophisticated daily user. |
| CSV / JSON export, backup/restore | Data portability is a virtue | Same as above — explicitly deferred. Quality pass should ensure schema migrations remain safe enough that an export feature can be added later without rework. | Defer; ensure schema versioning stays clean (already enforced). |
| Multiple user profiles / "family sharing" | Looks like a small extension | Conflicts with single-user core. | Defer / never. |
| Clinical disclaimers / "not medical advice" banners on AI output | Standard CYA in health apps | Explicit Key Decision in PROJECT.md: "AI coach has no clinical guardrails; uses source attribution + confidence labels instead". The user is sophisticated and values epistemic honesty. | Source attribution + confidence labels (already in scope as table-stakes). |
| Sleep / mood / steps / hydration / supplements tracking | Common in health trackers; arguably "obvious next steps" | PROJECT.md Out of Scope: deferred to future milestones. Adding any of them now derails the refinement goal. | Future milestones. Keep schema migrations clean to make later addition cheap. |
| Standalone "Goals & Progress" feature page | Natural complement to tracking | PROJECT.md Out of Scope: "deferred to future milestone". | Diet-only optional targets stay in scope; AI memory may incidentally model goals (per PROJECT.md note). Don't surface a goals page in this milestone. |
| Server-side AI / proxy API layer | Hides API key, enables usage limits | Conflicts with "API key stays local" constraint and the local-first identity. Adds infra. | API key in `AppData.aiSettings` (already implemented); user-controlled. |
| RAG over a vector DB for AI coaching context | Trendy AI architecture | Overkill for a single user with bounded data (~5 MB cap). Tool calls into structured `AppData` are simpler, more debuggable, and produce verifiable citations ("from your weight log"). | Anthropic tool use against typed query functions. Structured > unstructured here. |
| AI-generated meal plans / workout plans automatically created and saved as future log entries | Natural extension of "AI coach" | Crosses the line from coaching (advice the user evaluates) to autonomous data writes. The user logs what they actually did; the AI advises. Mixing those corrupts the data record. | AI can suggest in chat; user logs manually if they act on it. Source-of-truth integrity > convenience. |
| Continuous background AI calls (e.g. nightly summaries) | "Insights without asking" | Costs API tokens silently, runs without user intent, and conflicts with "only outbound traffic is the user-initiated chat request". | User initiates conversations. AI memory captures durable state between sessions. |
| Notifications / reminders ("did you log breakfast?") | Habit-formation feature | Out of character for a daily-driver power-user app; requires Electron notification plumbing and OS permissions; user is the developer. | Skip. |

## Feature Dependencies

```
[V5 schema migration]
    ├── [Per-food native units (SavedFood.units)]
    │      └── [Quick-add food (modal)]
    │              └── [Daily totals % of target] (depends on units AND targets)
    ├── [User memory (goals/preferences/notes)]
    │      ├── [AI memory injection into system prompt]
    │      │      └── [AI memory inspector UI]
    │      └── [AI update_user_memory tool]
    └── [Optional diet targets]
           └── [Daily totals % of target]

[Anthropic tool use infrastructure]
    ├── [query_* data tools]
    │      ├── [AI full-data access (table stake)]
    │      ├── [Cross-domain AI insights]
    │      └── [Reasoning transparency (collapsed tool calls in UI)]
    └── [update_user_memory tool] ──depends on──> [V5 user memory]

[Source attribution UX]
    ├── [Confidence label badges]
    ├── [Footnote-style citation list per AI message]
    └── [Structured AI message renderer in chat-message-list]
              └── [Reasoning transparency (collapsed tool calls)]

[Recent / favorite foods] ──independent──> [no schema change required]
[Search-as-you-type]      ──independent──> [no schema change required]
[Copy meal from prior day]──independent──> [no schema change required]
[Diet charts integration] ──depends on──> [existing charts + date-range; no schema change]

[Quality pass — refactors]
    ├── [Shared id.ts helper] ──replaces──> [5x duplicated generateUUID]
    ├── [Empty-state pattern] ──applies to──> [all 8 feature pages]
    ├── [a11y audit + fixes]  ──applies to──> [all forms]
    └── [Coverage thresholds] ──independent──> [karma config]
```

### Dependency Notes

- **V5 migration is the lynchpin for diet+chat depth:** native units, user memory, and (optional) diet targets all want a schema bump. Best to ship them as a single coordinated `migrateV4ToV5` so existing data hits the new shape once. Mirror the precedent of `migrateV2ToV3` (saved-foods restructure) which is a comparable scope of change.
- **Tool use is the lynchpin for the chat depth upgrade:** full-data access, cross-domain insights, and reasoning transparency all derive from defining a clean tool-call surface. The existing `fitness-context.service.ts` snapshot pattern can stay as a small "background context" while heavy data is fetched on demand via tools.
- **Source attribution UX depends on a structured message renderer:** today the chat renders message text directly. Once the AI is instructed to emit citation markers and confidence tags, the renderer needs to parse them. Plan this UI work in tandem with the prompting work.
- **Quick-add food depends on per-food native units:** otherwise the new food has to declare its unit anyway, so building quick-add first means revisiting it after the units redesign. Sequence: units first, then quick-add.
- **Diet charts integration is independent:** can land any time after the units refactor stabilizes (chart needs to know how to summarize per-day totals; totals aggregator needs to be stable).
- **Quality-pass items are mostly independent of each other and of feature work:** they can be parallelized or interleaved. Recommend doing them *after* diet and chat refactors land so the quality pass sees the new code shape too.
- **Conflicts:**
  - **Optional diet targets ↔ "no goals system" out-of-scope:** keep targets diet-local, do not surface a general goals page. Mention only on the diet page.
  - **Tool-use AI ↔ token cost:** allowing AI to query unbounded ranges can blow up token usage on long histories. Build pagination / aggregation into tool outputs (e.g. `query_meals_in_range` returns daily summaries, not raw items, by default).

## MVP Definition

This is a refinement milestone, so "MVP" maps to "what must ship in v2.0 for the milestone to be considered done", per PROJECT.md Active list.

### Ship With (v2.0)

The minimum that fulfills the three Active requirements.

**Diet UX overhaul:**
- [ ] V5 schema migration (units + memory + optional diet targets, all in one migration)
- [ ] Per-food native unit definition + meal logging in native units
- [ ] Recent foods + favorite foods (auto-ranked) in meal logging
- [ ] Search-as-you-type over saved foods
- [ ] Quick-add new food from inside the meal logger
- [ ] Copy meal from previous day
- [ ] Daily totals (cal, P/F/C, net carbs) prominent and scannable while logging
- [ ] Diet integrated into the charts page
- [ ] Optional diet targets (calories + macros) with % display

**AI chat depth upgrade:**
- [ ] Anthropic tool-use infrastructure (`query_cardio_sessions`, `query_weight_entries`, `query_readings`, `query_meals_in_range`, `query_daily_totals`)
- [ ] Persistent user memory (goals, preferences, notes) injected into system prompt every session
- [ ] `update_user_memory` tool with audit visibility
- [ ] Source attribution rendered in chat UI (footnote list per message; "from your data" vs "from research" distinction)
- [ ] Per-claim confidence labels rendered as inline badges
- [ ] Reasoning transparency (collapsed tool-call blocks in the message stream)

**Quality pass:**
- [ ] Coverage measured + threshold set (start at current baseline, ratchet up over time)
- [ ] Shared `id.ts` helper replacing 5x duplicated `generateUUID`
- [ ] Empty-state + error-state pattern applied across all 8 feature pages
- [ ] a11y audit (axe + Lighthouse) + fixes for all forms
- [ ] Type tightening pass (any remaining `any`, missing return types)

### Add After Validation (v2.x)

Smaller iterations after the milestone proves out.

- [ ] AI memory inspector UI (`/settings` or `/chat/memory`) — only after memory is in production and the user notices opacity friction
- [ ] Conversation search/filter — only if conversations accumulate enough to need it
- [ ] Per-meal time-of-day patterns surfaced in diet charts (morning vs evening calories)
- [ ] Pre-computed correlation tools for AI (e.g. `correlate(metric_a, metric_b, range)`) to keep token costs down

### Future Consideration (Future Milestones, NOT this one)

Already in PROJECT.md Out of Scope; reiterated here for clarity.

- [ ] Sleep / mood / steps / hydration / supplements tracking
- [ ] Standalone goals & progress feature
- [ ] Data import/export (Apple Health, CSV, backup/restore)

## Feature Prioritization Matrix

P1 = milestone-critical (must ship in v2.0). P2 = high-leverage but not strictly required. P3 = follow-up.

| Feature | Target | User Value | Implementation Cost | Priority |
|---------|--------|------------|---------------------|----------|
| AI tool-use full data access | CHAT | HIGH | HIGH | P1 |
| AI persistent user memory | CHAT | HIGH | MEDIUM | P1 |
| AI source attribution UX | CHAT | HIGH | MEDIUM | P1 |
| AI confidence labels UX | CHAT | HIGH | MEDIUM | P1 |
| Per-food native units | DIET | HIGH | MEDIUM | P1 |
| Recent + favorite foods | DIET | HIGH | LOW | P1 |
| Search-as-you-type foods | DIET | HIGH | LOW | P1 |
| Quick-add food in-flow | DIET | HIGH | MEDIUM | P1 |
| Copy meal from prior day | DIET | HIGH | LOW | P1 |
| Daily totals scannable | DIET | HIGH | LOW | P1 |
| Diet in charts | DIET | MEDIUM | LOW–MEDIUM | P1 |
| Optional diet targets | DIET | MEDIUM | LOW | P1 |
| V5 migration | DIET, CHAT | (foundational) | MEDIUM | P1 (foundation) |
| Reasoning transparency (tool-call UI) | CHAT | MEDIUM | MEDIUM | P1 |
| AI memory inspector | CHAT | MEDIUM | MEDIUM | P2 |
| Cross-domain AI insights | CHAT | HIGH | LOW (post tool-use) | P1 (emerges from tool use; system-prompt work) |
| a11y audit + fixes | QUALITY | MEDIUM | LOW | P1 |
| Empty/error state pattern | QUALITY | MEDIUM | LOW | P1 |
| Shared `id.ts` helper | QUALITY | LOW | LOW | P1 |
| Coverage thresholds | QUALITY | MEDIUM | LOW | P1 |
| Type tightening sweep | QUALITY | MEDIUM | LOW–MEDIUM | P1 |

## Reference Apps Briefly Considered

| Pattern | Reference | Take |
|---------|-----------|------|
| Recents / favorites / custom foods on the entry screen | Cronometer | Adopt — directly applicable, low cost, high friction reduction |
| "Copy and paste" any prior day's food/meal | Cronometer | Adopt — clean primitive, fits existing `MealEntry` model |
| Per-serving + custom-serving units | MyFitnessPal | Inform — their per-food serving definitions are the right shape; we want simpler (no "container" sizes, no remote DB) |
| Tool use / function calling for structured data access | Anthropic Claude | Adopt — matches the constraint that AI must read full data; structured tool returns make citations verifiable |
| Long-term memory for personalized agents (goals, preferences, profile) | Mem0 / ReMe research | Inform — adopt the *concept* (separated short-term context, long-term user memory, user profile facts) as in-AppData fields; do not adopt the infrastructure (vector DB / RAG is overkill here) |
| Confidence scoring + reasoning cards | Level (levelfit.ai) | Inform — validates that "confidence + reasoning visible in UI" is a real, shipped pattern, not theoretical |

## Sources

- [UI/UX Case Study: Nutrition Tracking App — Muzli](https://medium.muz.li/ui-ux-case-study-nutrition-tracking-app-5908c8df02c2) — friction reduction patterns (recents, favorites, auto-complete)
- [Focused Review of Smartphone Diet-Tracking Apps — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6543803/) — peer-reviewed survey of diet-tracker UX patterns and validity
- [Cronometer vs MyFitnessPal — VegFAQs](https://vegfaqs.com/cronometer-vs-myfitnesspal/) — comparative feature analysis
- [Cronometer copy-and-paste day feature](https://forums.cronometer.com/) — referenced in Cronometer / VegFAQs writeups; validates "copy meal from prior day" as expected behavior
- [MyFitnessPal: copy meals across days — official help](https://support.myfitnesspal.com/hc/en-us/articles/39985611667341-Introducing-the-brand-new-Today-tab) — validates same pattern from a second source
- [The serving size I need to log is not available — MyFitnessPal Help](https://support.myfitnesspal.com/hc/en-us/articles/360032272852-The-serving-size-I-need-to-log-is-not-available) — confirms per-food serving definitions as the standard model
- [Tool use with Claude — Anthropic API docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) — authoritative reference for the AI tool-use design
- [How tool use works — Anthropic API docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works) — JSON Schema'd tool definitions, structured calls, contract model
- [Enabling Personalized Long-term Interactions in LLM-based Agents through Persistent Memory and User Profiles (arXiv 2510.07925)](https://arxiv.org/html/2510.07925) — peer-reviewed memory architecture; informs the goals/preferences/profile split
- [ReMe — Memory Management Kit for Agents](https://github.com/agentscope-ai/ReMe) — STM/LTM/profile separation pattern
- [Mem0 — AI Memory Management for LLMs and Agents](https://mem0.ai/blog/ai-memory-management-for-llms-and-agents) — concrete personalized-coach memory examples (preferred workout times, training goals, persistent context)
- [GPT-4 as a virtual fitness coach (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12261634/) — efficacy + limitations evidence; supports source-attribution + confidence as a trust mechanism
- [Level — AI Fitness Coach](https://levelfit.ai/) — production reference for confidence-scored reasoning cards
- [Angular Accessibility — official docs](https://angular.dev/best-practices/a11y) — authoritative reference for the a11y audit step
- [Building Accessible Forms with Angular — ANGULARarchitects](https://www.angulararchitects.io/blog/accessible-angular-forms/) — form-specific patterns (label/for, keyboard nav, semantic HTML)

---
*Feature research for: refinement milestone (diet UX + AI chat depth + quality pass)*
*Researched: 2026-05-02*
