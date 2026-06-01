# Phase 2: Diet UX Overhaul - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Kill the daily diet-logging friction. The user can add a new food (with its macros) without leaving the meal-log flow, pick whatever unit is natural for that food, copy a previous day's meal in one action, and read accurate, scannable daily totals — and a food, once added, is permanently reusable so it is never re-entered. Diet history also lands in the charts page.

**In scope:** DIET-01..DIET-10 (quick-add food, per-food native units, cross-unit conversion via per-food density, search/recents/favorites, copy-a-meal, scannable daily totals + optional targets, charts integration, local-time day boundaries, snapshot immutability, V6→V7 migration).

**Out of scope (new capabilities → future phases / milestones):** external food-database / barcode lookup; AI-assisted macro estimation; new tracking domains (sleep/mood/steps/etc.); a standalone goals surface; data import/export. See Deferred Ideas.

</domain>

<decisions>
## Implementation Decisions

**Standing delegation:** The user deferred ALL gray-area decisions to Claude under the fixed north star **"prioritize UX; best practices; established codebase patterns"** (same as Phases 3/4/5). Verbatim vision given: *"The user should be able to easily find macro nutrient information for new foods and once [a] food [is added they] should not have to search for them again — they will be available to use again easily. The units need to be flexible and easy to use. Just make the whole thing easy to use and feature rich."* Bias every call toward feature-rich-but-easy.

### Quick-add food placement (DIET-01)
- **D-01:** Adding a new food happens **inline within the meal-log flow** — no modal, no jump to a separate panel. When the meal-item search yields no match, an inline "add this food" affordance lets the user define it on the spot; the new food is saved to the library AND immediately added to the meal being logged. This matches the Phase 5 no-modal inline-form pattern (D-11). The full food editor/manager stays in the Saved Foods panel for deliberate edits.
- **D-02:** First-time macro entry must be frictionless (clear per-baseUnit or per-serving fields, sensible defaults, inline validation) — but it is **manual entry**, not an external lookup (see D-13). Once entered, the food is permanent and reusable (the saved-foods library is the reuse mechanism the user emphasized).

### Units & density model (DIET-02/03)
- **D-03:** Widen the unit system from the current `'g' | 'tbsp'` to a flexible set: **mass** (g, oz, lb), **volume** (ml, tsp, tbsp, cup), plus **per-food named servings** (e.g. "1 slice", "1 medium banana", "1 scoop") with stored gram-equivalents. `baseUnit` and `FoodUnit` widen accordingly.
- **D-04:** Cross weight↔volume conversion uses a **per-food `densityGramsPerMl?`** — **optional**, required only when a food needs weight↔volume conversion. Absent density → conversions stay within-dimension (mass↔mass, volume↔volume) plus named servings and the base unit. **No global density assumption ever leaks in** (DIET-03 hard rule). Do not force the user to know density; the form should make it optional with graceful fallback.
- **D-05:** Conversion logic lives in a **new pure `src/app/services/units.ts`** module with its own `.spec.ts` (no global state, fully testable; mirrors the pure-module pattern of `web-citation-parser.ts` / `confidence-attribution-parser.ts`). **Research decides** whether to adopt the `convert` library or a small hand-rolled conversion table — pick the simpler, well-tested option; document the call.

### Search / recents / favorites (DIET-04)
- **D-06:** Food lookup is **case-insensitive substring match-as-you-type**. **Recents** surface on input focus (before the user types). **Favorites are auto-ranked** by a blend of frequency + recency — no manual starring required (keeps it "easy"). Manual pinning is deferred (auto-ranking ships first).

### Daily totals & targets (DIET-06)
- **D-07:** Daily totals (kcal, protein, fat, carbs, **net carbs**) are scannable and update **live while logging**. Net carbs always visible; `netCarbs = max(0, carbs - fiber)` (existing validator rule).
- **D-08:** Optional **per-day macro/calorie targets** stored as a new persisted shape (a `DailyTargets`-style field on `AppData`, landing in the V6→V7 migration). When set, totals render **%-of-target as compact bars**. Default to a **single persistent target set** (simplest/easiest); per-day overrides are deferred unless they fall out trivially.

### Copy-a-meal (DIET-05)
- **D-09:** One-action **copy from a previous day** — a quick "repeat" affordance (e.g. yesterday) plus a date source picker; copied items land as **editable pending items** in the current meal-log flow (not silently committed), so the user can tweak before saving.

### Charts integration (DIET-07)
- **D-10:** Add **diet series (calories + macros over time)** into the **existing charts page**, reusing its date-range filter and control/checkbox pattern. Macros as separately toggleable series. Reuse the shared `groupByDay`/`toDateKey` grouping (`src/app/shared/chart-grouping.ts`) — do not fork day-bucketing logic.

### Day boundaries & immutability (DIET-08/09)
- **D-11:** Day boundaries use **local time consistently** across diet, charts, and reports via the shared `toDateKey`/`groupByDay` utilities — no UTC drift; test across a DST transition.
- **D-12:** Editing a `SavedFood` must **never retroactively change historical `MealEntry`/`MealItem` data** — nutrition, serving, and unit are snapshotted at log time (`MealItem.snapshot` already exists and is partially honored; preserve + add explicit test coverage). Food edits preserve `id`/`createdAt`, refresh `updatedAt`, re-validate (Phase 5 D-12 CRUD parity).

### Schema migration (DIET-10)
- **D-13:** Migration target is **V6→V7, NOT V5→V6** — Phase 5 already shipped `migrateV5ToV6` (`CURRENT_SCHEMA_VERSION` is V6). V7 adds `SavedFood.densityGramsPerMl?`, widened `baseUnit`/`FoodUnit`, optional `preferredUnits?`, and the `DailyTargets` field. Ride the FOUND-07 discipline: backup-before-migrate, typed-legacy `LegacyAppDataV6` interface, fixture tests + malformed-input coverage. **Backward compat:** existing foods carrying `gramsPerTbsp?` must migrate cleanly (derive `densityGramsPerMl` where sensible, or keep the tbsp path working); the legacy **`fdcId` runtime passthrough** in `storage.service.ts` must remain intact (it is preserved-if-present legacy data, not an active feature).

### No external nutrition lookup (constraint-locked)
- **D-14:** The "easily find macro information" vision is satisfied by **frictionless manual entry + permanent library reuse**, NOT an external food database. An external nutrition API would violate the Phase 5 CSP (egress locked to `https://api.anthropic.com`, QUAL-06) and the LocalStorage-only / "only the chat request leaves the device" constraints. AI-assisted macro estimation through the existing Anthropic chat path is allowed by the egress policy but is a **new capability → deferred** (see Deferred Ideas).

### Claude's Discretion
All decisions above are Claude's calls under the standing delegation. Research + planning may refine HOW (e.g. `convert` lib vs hand-rolled, exact favorite-ranking formula, chart series styling, target-editor placement) — the WHAT above is locked. Surface any decision that would contradict a locked constraint before acting.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 2: Diet UX Overhaul" — goal, 5 success criteria, wave note (and the cross-phase note that DIET-10's "V5→V6" label is superseded by V6→V7).
- `.planning/REQUIREMENTS.md` §DIET — DIET-01..DIET-10 with acceptance criteria.
- `.planning/PROJECT.md` — core value, constraints (LocalStorage-only, single-user, Electron, AI egress), Out of Scope boundaries.

### Current diet implementation (the surface being overhauled)
- `src/app/models/diet.model.ts` — current `SavedFood`/`MealItem`/`MealEntry`/`NutritionTotals` shapes (`FoodUnit = 'g' | 'tbsp'`, `gramsPerTbsp?`, `servings[]`, `MealItem.snapshot`).
- `src/app/services/diet.service.ts` — existing CRUD: `addSavedFood`, `updateSavedFood`, `addCustomServing`, `deleteSavedFood`, `getMealsForDay`, `addMeal`, `updateMeal`, `deleteMeal`, `computeDailyTotals`.
- `src/app/features/diet/diet-page.component.ts` — current UX (inline "Add / Manage Foods" toggle, mealForm + mealItemForm + pendingItems pattern).
- `src/app/services/validators.ts` — validation limits + net-carbs rule.

### Schema migration & storage discipline
- `src/app/services/storage.service.ts` — `CURRENT_SCHEMA_VERSION` (V6), the typed `migrateVxToVy` chain (V0→V6), backup-before-migrate flow, and the `fdcId` legacy passthrough (lines ~834–847) that must be preserved.
- `src/app/services/legacy-schemas.ts` — typed `LegacyAppData*` interfaces (pattern for the new `LegacyAppDataV6`).
- Phase 1 FOUND-07 artifacts: `src/app/services/migrations/fixtures/` (fixture + malformed-input test pattern).

### Shared assets to reuse (do not fork)
- `src/app/shared/chart-grouping.ts` — `toDateKey` + `groupByDay` (local-time day bucketing for DIET-08; reused by charts for DIET-07).
- `src/app/shared/id.ts` — UUID generation (no inline `crypto.randomUUID()` copies).
- `src/app/shared/` empty-state / error-state components (consistent empty/error UX).
- `src/app/features/charts/charts-page.component.ts` — integration target for DIET-07 (date-range filter + control checkbox pattern; currently plots only cardio `caloriesBurned`).

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `STACK.md`, `TESTING.md`, `CONCERNS.md` — locked layered architecture, conventions, test approach.

### Cross-phase constraints
- Phase 5 CSP lock (`QUAL-06`) — egress restricted to `https://api.anthropic.com` (rules out external food DB; see D-14).
- Phase 5 `D-11`/`D-12` — no-modal inline-edit pattern + identity-preserving updates (diet should match).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`diet.service.ts` CRUD is already substantial** — `addSavedFood`/`updateSavedFood`/`addCustomServing`/`addMeal`/`updateMeal`/`computeDailyTotals` exist. Phase 2 extends and refines these (widen units, add targets, copy-meal) rather than building CRUD from scratch.
- **`MealItem.snapshot`** already captures nutrition at log time — DIET-09 immutability is partly in place; the work is widening it for new units and proving it with tests.
- **`chart-grouping.ts` (`toDateKey`/`groupByDay`)** — the single source of local-time day bucketing; reuse for both totals (DIET-08) and charts (DIET-07).
- **Empty/error-state shared components + `takeUntilDestroyed` hygiene** (Phase 1) — apply to all new diet UI.

### Established Patterns
- **No-modal inline forms** (Phase 5 D-11): edit/add reuse the page's own form, pre-filled, identity-preserving. Quick-add (D-01) follows this.
- **Pure, DI-free, spec-covered service modules** (`web-citation-parser.ts`, `confidence-attribution-parser.ts`) — the template for the new `units.ts` (D-05).
- **Typed migration chain + backup + fixtures** (FOUND-07) — the template for V6→V7 (D-13).
- **All LocalStorage access through `StorageService`** — diet changes persist via `StorageService`, never direct.

### Integration Points
- `models/diet.model.ts` (+ `models/index.ts` barrel) — widened `FoodUnit`/`SavedFood`/new `DailyTargets`.
- `storage.service.ts` — `CURRENT_SCHEMA_VERSION` → V7 + `migrateV6ToV7`.
- `charts-page.component.ts` — new diet series wired into existing controls.
- `app-data.model.ts` — new `dailyTargets?` field (or similar).
- A new diet-page target editor + inline quick-add + search/recents/favorites UI.

</code_context>

<specifics>
## Specific Ideas

- **Permanent reuse is the headline feeling** the user wants: enter a food's macros once → it's in the library forever → re-logging it later is near-instant via recents/favorites + match-as-you-type. Optimize the second-and-later logging of any food to near-zero friction.
- **"Flexible and easy" units:** the user should reach for whatever unit is natural (a slice, a cup, 30 g) without doing mental math — the per-food named-serving + density model is what makes that work.
- **"Feature-rich but easy":** when a gray area pits a richer capability against a simpler one, prefer the richer one *if* it can stay low-friction; otherwise ship the easy version and defer the rest.

</specifics>

<deferred>
## Deferred Ideas

- **AI-assisted macro estimation for new foods** (ask the existing Anthropic chat to estimate a food's macros) — allowed by the egress policy but a new capability; revisit in a future AI-depth phase.
- **External food database / barcode lookup** (USDA FDC, etc.) — out: violates the Phase 5 CSP egress lock + LocalStorage-only constraint. Note: a dormant `fdcId` legacy field exists but is not an active feature.
- **Manual favorite pinning** — auto-ranked favorites ship first; manual pinning is a later enhancement.
- **Per-day target overrides** — single persistent target set ships first; per-day overrides only if trivial, else future.

### Reviewed Todos (not folded)
- **"Surface block-action errors to the user in chat-page"** (matched 0.9 on generic keywords) — already shipped in Phase 5 (QUAL-09, commit `3ae88b4`); a chat-page concern, not diet. Not folded.
- **"Complete Phase 4 visual UAT in browser"** — a Phase-4 testing obligation tracked in `04-HUMAN-UAT.md`; unrelated to diet. Not folded.
- **"Clarify meal-note redaction granularity for AI context"** — already decided in Phase 5 (D-10: per-entry free-text notes, not the kcal line). Not folded.

</deferred>

---

*Phase: 2-diet-ux-overhaul*
*Context gathered: 2026-06-01*
