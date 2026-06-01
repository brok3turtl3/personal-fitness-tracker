# Phase 2: Diet UX Overhaul - Research

**Researched:** 2026-06-01
**Domain:** Angular 18 standalone diet-logging UX overhaul + per-food unit conversion + V6→V7 LocalStorage schema migration
**Confidence:** HIGH (all recommendations grounded in the live codebase; the one external-library question — D-05 `convert` vs hand-rolled — verified against npm registry)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim — D-01..D-14)

**Standing delegation:** The user deferred ALL gray-area decisions to Claude under the fixed north star **"prioritize UX; best practices; established codebase patterns"** with a feature-rich-but-easy bias. Verbatim vision: *"The user should be able to easily find macro nutrient information for new foods and once [a] food [is added they] should not have to search for them again — they will be available to use again easily. The units need to be flexible and easy to use. Just make the whole thing easy to use and feature rich."*

- **D-01 (DIET-01):** Adding a new food happens **inline within the meal-log flow** — no modal, no jump to a separate panel. When the meal-item search yields no match, an inline "add this food" affordance defines it on the spot; the new food is saved to the library AND immediately added to the meal being logged. Matches the Phase 5 no-modal inline-form pattern. The full food editor/manager stays in the Saved Foods panel for deliberate edits.
- **D-02 (DIET-01):** First-time macro entry must be frictionless (clear per-baseUnit or per-serving fields, sensible defaults, inline validation) — **manual entry**, not an external lookup. Once entered, the food is permanent and reusable.
- **D-03 (DIET-02/03):** Widen the unit system from `'g' | 'tbsp'` to: **mass** (g, oz, lb), **volume** (ml, tsp, tbsp, cup), plus **per-food named servings** (e.g. "1 slice", "1 medium banana", "1 scoop") with stored gram-equivalents. `baseUnit` and `FoodUnit` widen accordingly.
- **D-04 (DIET-02/03):** Cross weight↔volume conversion uses a **per-food `densityGramsPerMl?`** — optional, required only when a food needs weight↔volume conversion. Absent density → conversions stay within-dimension (mass↔mass, volume↔volume) plus named servings and the base unit. **No global density assumption ever leaks in** (DIET-03 hard rule). Form makes density optional with graceful fallback.
- **D-05 (DIET-02/03):** Conversion logic lives in a **new pure `src/app/services/units.ts`** module with its own `.spec.ts` (no global state, fully testable; mirrors `web-citation-parser.ts` / `confidence-attribution-parser.ts`). **Research decides** `convert` library vs hand-rolled table — pick the simpler, well-tested option; document the call.
- **D-06 (DIET-04):** Food lookup is **case-insensitive substring match-as-you-type**. **Recents** surface on input focus (before typing). **Favorites auto-ranked** by frequency + recency — no manual starring. Manual pinning deferred.
- **D-07 (DIET-06):** Daily totals (kcal, protein, fat, carbs, **net carbs**) are scannable and update **live while logging**. Net carbs always visible; `netCarbsG = max(0, carbs - fiber)`.
- **D-08 (DIET-06):** Optional **per-day macro/calorie targets** stored as a new persisted shape (`DailyTargets`-style field on `AppData`, in V6→V7). When set, totals render **%-of-target as compact bars**. Default to a **single persistent target set**; per-day overrides deferred unless trivial.
- **D-09 (DIET-05):** One-action **copy from a previous day** — a "repeat" affordance (yesterday) plus a date source picker; copied items land as **editable pending items** in the current meal-log flow (not silently committed).
- **D-10 (DIET-07):** Add **diet series (calories + macros over time)** into the **existing charts page**, reusing its date-range filter and control/checkbox pattern. Macros separately toggleable. Reuse shared `groupByDay`/`toDateKey` — do not fork day-bucketing.
- **D-11 (DIET-08):** Day boundaries use **local time consistently** across diet, charts, reports via `toDateKey`/`groupByDay` — no UTC drift; test across a DST transition.
- **D-12 (DIET-09):** Editing a `SavedFood` must **never retroactively change historical `MealEntry`/`MealItem` data** — nutrition, serving, and unit are snapshotted at log time (`MealItem.snapshot` already exists and is partially honored; preserve + add explicit test coverage). Food edits preserve `id`/`createdAt`, refresh `updatedAt`, re-validate.
- **D-13 (DIET-10):** Migration target is **V6→V7, NOT V5→V6**. V7 adds `SavedFood.densityGramsPerMl?`, widened `baseUnit`/`FoodUnit`, optional `preferredUnits?`, and the `DailyTargets` field. Ride FOUND-07: backup-before-migrate, typed `LegacyAppDataV6`, fixture tests + malformed-input coverage. **Backward compat:** existing foods carrying `gramsPerTbsp?` must migrate cleanly; the legacy **`fdcId` runtime passthrough** in `storage.service.ts` must remain intact.
- **D-14 (constraint-locked):** The "easily find macro info" vision is satisfied by **frictionless manual entry + permanent library reuse**, NOT an external food database (would violate Phase 5 CSP egress lock, QUAL-06). AI-assisted macro estimation through the Anthropic chat path is allowed by egress policy but is a **new capability → deferred**.

### Claude's Discretion
All decisions above are Claude's calls under the standing delegation. Research + planning may refine HOW (e.g. `convert` lib vs hand-rolled, exact favorite-ranking formula, chart series styling, target-editor placement) — the WHAT is locked. Surface any decision that would contradict a locked constraint before acting.

### Deferred Ideas (OUT OF SCOPE)
- **AI-assisted macro estimation** for new foods — allowed by egress policy but a new capability; future AI-depth phase.
- **External food database / barcode lookup** (USDA FDC, etc.) — violates Phase 5 CSP + LocalStorage-only. A dormant `fdcId` legacy field exists but is not an active feature.
- **Manual favorite pinning** — auto-ranked favorites ship first.
- **Per-day target overrides** — single persistent target set ships first; per-day only if trivial.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIET-01 | Add a new food without leaving the meal-log flow (quick-add) | §Pattern 1 (inline quick-add reusing the existing `mealItemForm`/`addFoodForm`/`pendingItems` pattern); D-01 inline-form (no modal) |
| DIET-02 | Each saved food defines native units with stored gram-equivalents | §Pattern 2 (widened unit/dimension model in `units.ts`); D-03 — named servings already exist on `SavedFoodServing` |
| DIET-03 | Unit conversion correct across g/oz/cups/ml/tbsp via per-food density, no global density | §Open Q1 decision (hand-rolled `units.ts`); §Pattern 2 (within-dimension table + per-food density bridge); D-04 |
| DIET-04 | Search-as-you-type, recents, auto-ranked favorites | §Pattern 3 (pure `rankFoods` frequency+recency, `filterFoods` substring); D-06 |
| DIET-05 | Copy a meal from a previous day with one action | §Pattern 6 (reuse `getMealsForDay` + map into `pendingItems`); D-09 |
| DIET-06 | Scannable live daily totals + optional %-of-target | §Pattern 4 (live recompute reusing `computeDailyTotals`/`sumTotals`); `DailyTargets` shape; D-07/D-08 |
| DIET-07 | Diet history in charts page (calories + macros over time, date-range filter) | §Pattern 5 (sum-by-day helper + ng2-charts datasets reusing `controlsForm`/`filterByRange`); D-10 |
| DIET-08 | Day boundaries use local time consistently | §Pattern 5/§Pitfall 2 (reuse `toDateKey`; DST test); D-11 |
| DIET-09 | Editing a saved food does NOT retroactively change historical meals | §Pattern 7 (snapshot immutability — already structurally true; widen `MealItemSnapshot`, add explicit tests); D-12 |
| DIET-10 | V6→V7 migration (density, widened baseUnit, preferredUnits, DailyTargets) + backup + fixtures + malformed | §Open Q2 (concrete `migrateV6ToV7` + `LegacyAppDataV6`); D-13 |
</phase_requirements>

## Summary

This phase overhauls an already-substantial diet feature, not a greenfield build. The data model (`SavedFood`, `SavedFoodServing`, `MealItem.snapshot`, `MealEntry`, `NutritionTotals`), CRUD service (`DietService` with `addSavedFood`/`updateSavedFood`/`addCustomServing`/`addMeal`/`updateMeal`/`deleteMeal`/`computeDailyTotals`), the pure scaling helpers (`scaleFoodTotals`, `sumTotals`), and a working snapshot-at-log-time mechanism all already exist. The migration chain (`migrateV0ToV1` … `migrateV5ToV6`), the typed `LegacyAppDataVN` discipline, backup-before-migrate, and fixture-driven tests are all in place from Phase 1's FOUND-07 work. **Almost every Phase 2 task is an extension of existing code, not new construction.** The single biggest pitfall is treating it as greenfield and rebuilding what's there.

The one genuinely new pure module is `src/app/services/units.ts` (D-05). The key research finding: a general-purpose unit-conversion library (`convert@7`, ~1 MB unpacked) does **not** solve the actual hard problem here. Within-dimension conversion (g↔oz↔lb, ml↔tsp↔tbsp↔cup) is trivially a small fixed factor table; the *hard* part — weight↔volume — is intrinsically **per-food** (`densityGramsPerMl`) and no general library models food density. Adopting a 1 MB dependency to handle the easy half while hand-rolling the hard half is the wrong trade for a LocalStorage-only Electron app. **Recommendation: hand-rolled `units.ts` with a dimension model + factor table + per-food density bridge** (full API sketch in §Open Q1).

Schema work targets **V6→V7** (Phase 5 already shipped V6). The migration is additive and backward-compatible: widen `FoodUnit`, add optional `SavedFood.densityGramsPerMl?` + `preferredUnits?`, add an optional `dailyTargets?` on `AppData`, and derive `densityGramsPerMl` from any legacy `gramsPerTbsp?` while keeping the tbsp path working. The `fdcId` passthrough at `storage.service.ts:834-847` must survive untouched.

**Primary recommendation:** Extend, don't rebuild. Hand-roll `units.ts` (dimension table + per-food density bridge); make `migrateV6ToV7` a deterministic, additive, backward-compatible transform with a `LegacyAppDataV6` interface and fixture + malformed tests; keep all conversion/ranking/totals logic in pure functions with dedicated specs; reuse `toDateKey`, `filterByRange`, the `pendingItems` pattern, and the ng2-charts `controlsForm` checkbox pattern verbatim.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Unit/density conversion (DIET-02/03) | Pure logic module (`units.ts`) | — | Stateless math; must be DI-free + 100%-testable per D-05 / `web-citation-parser` template |
| Food/meal CRUD + validation (DIET-01/05/09) | Domain service (`DietService`) | StorageService | One-domain-service rule; persistence delegated to the storage chokepoint |
| Daily totals computation (DIET-06) | Domain service (`computeDailyTotals`/`sumTotals` pure) | Component (live recompute on pending change) | Pure aggregation reused by both the live preview and persisted meal totals |
| Favorite ranking + search filtering (DIET-04) | Pure logic module | Component (debounced input) | Deterministic, order-agnostic, testable; component only wires input → pure call |
| Persistence + migration (DIET-10) | StorageService | `LegacyAppDataV6` (type-only) | All LocalStorage access is the chokepoint; migration rides the typed chain |
| Diet charts series (DIET-07) | Charts component | sum-by-day helper (shared/pure) | Rendering is component tier; day-bucketing is shared pure logic (no fork) |
| Inline quick-add / copy-meal / target editor UI (DIET-01/05/06/08) | `DietPageComponent` | DietService | Components are UI-only; business logic delegates to the service per CLAUDE.md |
| Day-boundary keying (DIET-08) | Shared pure (`toDateKey`) | all consumers | Single source of local-time day math; reused, never duplicated |

## Standard Stack

No new runtime dependencies are introduced by this phase. Everything needed is already installed.

### Core (already present — verified in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @angular/core, /forms, /common | ^18.2.0 | Standalone components, ReactiveForms | Project framework (CLAUDE.md) `[VERIFIED: package.json]` |
| chart.js | ^4.5.1 | Chart rendering engine | Locked chart lib (CLAUDE.md) `[VERIFIED: package.json]` |
| ng2-charts | ^7.0.0 | Angular `BaseChartDirective` wrapper over chart.js | Charts-page already consumes `BaseChartDirective` + `ChartData<'line'>` `[VERIFIED: charts-page.component.ts:7]` |
| rxjs | ~7.8.0 | Observable CRUD return types | Storage abstraction returns Observables (CLAUDE.md) `[VERIFIED: package.json]` |

### Supporting (already present, dev)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jasmine-core / karma | 5.2 / 6.4 | Unit test framework | Every new service/module needs a `.spec.ts` `[VERIFIED: package.json]` |
| @stryker-mutator/core | ^9.6.1 | Mutation testing | Available if a critical-module mutation floor is wanted on `units.ts` `[VERIFIED: package.json]` |
| axe-core | ^4.11.4 | a11y assertions in specs | New diet UI specs assert serious/critical-clean `[VERIFIED: package.json]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `units.ts` | `convert@7.0.0` (~1 MB unpacked) | Library handles within-dimension only; the hard per-food weight↔volume bridge is hand-rolled either way. 1 MB dep + a transitive surface for the easy half is a poor trade for a LocalStorage-only Electron app. `[VERIFIED: npm view convert version=7.0.0, dist.unpackedSize=1025979]` |
| Hand-rolled `units.ts` | `js-quantities@1.8.0` / `convert-units@2.3.4` | Same objection; neither models food-specific density. `convert-units` is effectively unmaintained. `[VERIFIED: npm registry]` |
| ng2-charts `BaseChartDirective` | Raw chart.js `new Chart()` | Would diverge from the established charts-page pattern; no benefit. `[VERIFIED: charts-page.component.ts]` |

**Installation:** None. (No `npm install` for this phase — `convert` is NOT being adopted, per §Open Q1.)

## Architecture Patterns

### System Architecture Diagram

```
USER INPUT (diet-page.component.ts — UI only)
   │
   ├── search "chicken" ──► filterFoods(savedFoods, query)   [units.ts? no → new pure search/ranking module or units.ts sibling]
   │                          │  case-insensitive substring
   │                          ▼
   │                       rankFoods(savedFoods, mealHistory) ──► Recent + Frequent groups
   │
   ├── no match → inline quick-add ──► DietService.addSavedFood(CreateSavedFood)
   │                                      │  validates, generateId, writes via StorageService
   │                                      ▼  then immediately stage as pendingItem (D-01)
   │
   ├── pick food + unit + qty ──► toBaseUnits(food, unit, amount)   [units.ts — NEW pure]
   │                                │  within-dimension table OR per-food density bridge OR named serving
   │                                ▼
   │                             scaleFoodTotals(food, baseUnits)   [diet.service.ts — EXISTING pure]
   │                                ▼
   │                             pendingItems[]  (UI state)
   │                                ▼
   │                             sumTotals(pending.preview)  ──► LIVE daily totals + %-of-target bars (D-07/08)
   │
   ├── "Repeat yesterday" ──► DietService.getMealsForDay(yesterdayLocalKey)
   │                            │  map MealItem → pendingItem (editable)   (D-09)
   │                            ▼
   │                          pendingItems[]
   │
   └── Save meal ──► DietService.addMeal/updateMeal(CreateMealEntry)
                       │  re-resolves food+serving, snapshots totals at log time (D-12)
                       ▼
                    StorageService.saveData(AppData)  ── chokepoint ──► LocalStorage (key fitness_tracker_data)
                                                                            │ schemaVersion: 7
   ───────────────────────────────────────────────────────────────────────┘
   APP LOAD ──► StorageService.initialize()
                 │  fromVersion < 7 → pruneOldBackups → writeBackup → migrateData
                 ▼
              migrateV6ToV7(LegacyAppDataV6)  [storage.service.ts — NEW hop]
                 │  widen units, derive densityGramsPerMl from gramsPerTbsp, add dailyTargets, preserve fdcId
                 ▼
              AppData (v7)

   CHARTS (charts-page.component.ts) ──► DietService.getMeals (range) → sumByDay(meals) [shared/pure]
                                          → ng2-charts ChartData<'line'> datasets (D-10, toggleable macros)
```

### Recommended Project Structure (deltas only — overhaul)
```
src/app/
├── models/
│   ├── diet.model.ts          # WIDEN: FoodUnit union; SavedFood.densityGramsPerMl?, preferredUnits?
│   ├── daily-targets.model.ts # NEW: DailyTargets interface (or inline in app-data.model.ts)
│   ├── app-data.model.ts      # ADD: dailyTargets?; bump CURRENT_SCHEMA_VERSION → 7
│   └── index.ts               # barrel: export new types
├── services/
│   ├── units.ts               # NEW pure module (D-05) + units.spec.ts
│   ├── food-ranking.ts        # NEW pure module (D-06) + food-ranking.spec.ts  (or fold into units.ts? keep separate — different concern)
│   ├── diet.service.ts        # EXTEND: widen toBaseUnits to call units.ts; add copy-meal helper; targets pass-through
│   ├── legacy-schemas.ts      # ADD: LegacyAppDataV6 (+ LegacySavedFoodV6 if needed)
│   ├── storage.service.ts     # ADD: migrateV6ToV7; chain hop
│   └── migrations/fixtures/   # ADD: v6.json, v7-expected.json, malformed/v6-*.json
├── features/
│   ├── diet/diet-page.component.ts    # OVERHAUL: inline quick-add, search/recents/favorites, copy-meal, target editor, live bars
│   └── charts/charts-page.component.ts # ADD: diet series + checkbox controls
```

### Pattern 1: Inline quick-add within the meal-log flow (DIET-01 / D-01)
**What:** When match-as-you-type yields no result, surface an inline "Add \"{query}\" as a new food" affordance that expands the existing `addFoodForm` shape *inline in the meal panel* (not the Saved Foods panel, no modal). On confirm: `addSavedFood(...)` then immediately stage the new food as a `pendingItem`.
**When to use:** Always — this is the headline friction-killer.
**Example (existing pattern to mirror — staging a pending item):**
```typescript
// Source: diet-page.component.ts:794-805 (existing onAddMealItem) — reuse this exact staging shape
this.pendingItems = [
  ...this.pendingItems,
  { savedFoodId, servingId, quantity, label, preview }  // preview = scaleFoodTotals(food, baseUnits)
];
```
The confirm handler chains `addSavedFood(...).pipe(switchMap(food => /* pick default serving */ ), ...)` then pushes to `pendingItems`. No new persistence path — reuse `DietService.addSavedFood`.

**Anti-pattern:** Do NOT introduce a modal or a `window.confirm()` (the existing `onDeleteFood`/`onDeleteMeal` use `window.confirm` — the UI-SPEC replaces those with inline button-swap confirms; new code must not add more `confirm()` calls).

### Pattern 2: Per-food unit conversion via dimension table + density bridge (DIET-02/03 / D-04/D-05)
**What:** A pure `units.ts` with (a) a unit→dimension map, (b) within-dimension factor table to a canonical unit per dimension (grams for mass, ml for volume), (c) a per-food density bridge for cross-dimension, (d) named-serving gram-equivalents, (e) graceful fallback when density is absent. Full API sketch in §Open Q1.
**When to use:** Every meal-item quantity resolution and every preview.
**Composition order (locked):**
1. If `unit` is a **named serving** → use its stored gram/ml-equivalent directly.
2. Else if `unit` dimension === `baseUnit` dimension → within-dimension factor conversion.
3. Else (cross weight↔volume) → require `food.densityGramsPerMl`; if absent, **throw a typed conversion error** (graceful fallback = the UI never offers a cross-dimension unit when density is unset; see §Open Q1).
**Why this replaces the current `toBaseUnits`:** The existing `toBaseUnits` (diet.service.ts:479-500) and its duplicate `toBaseUnitsForPreview` (diet-page.component.ts:988-1004) only know g↔tbsp via `gramsPerTbsp`. Both should delegate to `units.ts` after the overhaul — and the duplicate in the component should be DELETED (it violates the "components are UI-only" rule).

### Pattern 3: Auto-ranked favorites + match-as-you-type (DIET-04 / D-06)
**What:** Pure functions. `filterFoods(foods, query)` = case-insensitive substring on name. `rankFoods(foods, mealEntries)` = decayed-frequency score (formula in §Open Q3) producing a "Frequent" group; "Recent" = most-recently-logged distinct foods derived from `mealEntries` sorted by `dateTime` desc. Recents surface on focus (empty query).
**When to use:** The food picker in the meal-log flow.
**Where it lives:** A pure module (`food-ranking.ts`) with its own spec — deterministic, no DI, no `Date.now()` inside the scorer (pass `now` in as a param for testability).

### Pattern 4: Live daily totals + %-of-target bars (DIET-06 / D-07/D-08)
**What:** Live totals = `sumTotals([...savedMeals.totals, ...pendingItems.preview])` recomputed on every pending-item change (pure, already exists). Targets = an optional `DailyTargets` persisted shape; `%-of-target = value / target * 100`, clamp the bar fill at 100% visually but show true % in the label; over-target uses the destructive red fill (UI-SPEC §target progress bar). Net carbs always shown: `max(0, carbs - fiber)`.
**Example (existing aggregation — reuse verbatim):**
```typescript
// Source: diet.service.ts:502-525 (sumTotals) — already computes netCarbsG = max(0, carbs - fiber)
computeDailyTotals(meals: MealEntry[]): NutritionTotals { return sumTotals(meals.map(m => m.totals)); }
```
For the LIVE preview during logging, sum `meal.totals` for saved meals plus each `pendingItem.preview` (a `NutritionTotals`).

### Pattern 5: Diet series in charts page (DIET-07/08 / D-10/D-11)
**What:** Add diet datasets to `charts-page.component.ts`, reusing `controlsForm` checkbox controls (mirror `cardioShowDistance`/`cardioShowCalories`), `filterByRange` + `resolveDateRange`, and the `ChartData<'line'>` dataset shape. Calories on primary `y`, macros (g) on a shared secondary `y1` with `grid.drawOnChartArea: false` (exactly the existing multi-axis treatment).
**CRITICAL day-bucketing note:** `groupByDay` (chart-grouping.ts:24) **averages** numeric fields and keys on a `{ date: string }` field. Diet needs **summing** per day and keys on `dateTime` (not `date`). Do **not** call `groupByDay` directly for diet — it would average daily macros (wrong) and look for a `.date` field that `MealEntry` lacks. Reuse `toDateKey` (the local-time day-keying primitive, which IS the shared contract per D-11) inside a **new small pure `sumByDay` helper** (sibling to `groupByDay` in `chart-grouping.ts`). This honors D-10's "reuse `toDateKey`, do not fork day-bucketing" while not misusing the averaging helper.
**Example (existing dataset shape + diet hues from UI-SPEC):**
```typescript
// Source: charts-page.component.ts:476-487 (cardio calories dataset) + UI-SPEC chart palette
{ data: caloriesByDay, label: 'Calories (kcal)', borderColor: '#e67e22',
  backgroundColor: 'rgba(230,126,34,0.12)', pointRadius: 2, tension: 0.25, yAxisID: 'y' }
// Net carbs differentiated by dash, not just hue (UI-SPEC a11y):
{ data: netCarbsByDay, label: 'Net carbs (g)', borderColor: '#c0392b', borderDash: [4,4],
  backgroundColor: 'rgba(192,57,43,0.12)', pointRadius: 2, tension: 0.25, yAxisID: 'y1' }
```

### Pattern 6: Copy-a-meal as editable pending items (DIET-05 / D-09)
**What:** "Repeat yesterday" → `getMealsForDay(yesterdayKey)`; a date-source picker (`<input type="date">` or `.form-group select`) → `getMealsForDay(pickedKey)`. Map each historical `MealItem` into the `pendingItems` shape so the user can edit/remove before saving. Re-derive the preview from the CURRENT food (or from the snapshot — decision in §Open Q4).
**When to use:** The copy affordance in the meal panel.
**Reuse:** `getMealsForDay` (diet.service.ts:197) already exists and already keys on local-day bounds. The `startEditMeal` method (diet-page.component.ts:865-882) already demonstrates mapping `meal.items` → `pendingItems` — copy-meal is structurally the same map (minus setting `editingMealId`).

### Pattern 7: Snapshot immutability (DIET-09 / D-12)
**What:** `MealItem.snapshot: { baseUnits, totals }` is already captured at `addMeal`/`updateMeal` time (diet.service.ts:250-253, 403-407), and `MealEntry.totals` is summed from snapshots. Editing a `SavedFood` (`updateSavedFood`) never touches `mealEntries`. So **immutability is structurally already true** — the work is (a) widening `MealItemSnapshot` to carry the new unit/serving context so a future render never needs to re-resolve from the (possibly-edited) food, and (b) adding **explicit tests** that prove a food edit leaves historical `MealEntry`/`MealItem` totals byte-identical.
**Anti-pattern:** Any code path that reads `food.nutrientsPerUnit` when rendering a *historical* meal item instead of `item.snapshot.totals` would silently break immutability — the renderer must always read the snapshot for logged meals (the current diet-page history list already does: `meal.totals`, `it.savedFoodName`, snapshot-derived).

### Anti-Patterns to Avoid
- **Rebuilding existing CRUD/aggregation.** `DietService`, `scaleFoodTotals`, `sumTotals`, `getMealsForDay`, snapshotting all exist — extend them.
- **Misusing `groupByDay` for diet.** It averages and expects `.date`; diet needs summing on `dateTime`. Add `sumByDay`, reuse only `toDateKey`.
- **Duplicating conversion logic in the component.** Delete `toBaseUnitsForPreview` (diet-page.component.ts:988); delegate to `units.ts`.
- **Adopting a 1 MB unit library for the easy half.** See §Open Q1.
- **Adding `window.confirm()` / modals.** UI-SPEC mandates inline button-swap confirms.
- **Storing `null` for absent `densityGramsPerMl`/`preferredUnits`/`dailyTargets`.** Use `undefined`/omit (CLAUDE.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Local-time day key | A new date-bucketing fn | `toDateKey` (chart-grouping.ts:11) | D-11 single source; avoids the chart-vs-report drift FOUND-02 fixed |
| Date-range filtering for charts | New range math | `filterByRange` + `resolveDateRange` (date-range.ts) | Already powers all charts-page series |
| UUIDs | `crypto.randomUUID()` inline | `generateId` (shared/id.ts) | FOUND-02 dedup gate; tree-wide grep enforced |
| LocalStorage read/write | Direct `localStorage.*` | `StorageService` methods | Chokepoint rule (CLAUDE.md); grep-gated |
| Nutrition aggregation | New summing loop | `sumTotals` / `scaleFoodTotals` (diet.service.ts) | Already correct incl. `netCarbs = max(0, carbs-fiber)` |
| Migration backup/prune/throw | New backup logic | Existing `writeBackup`/`pruneOldBackups`/typed chain | FOUND-07 discipline; reuse exactly |
| Empty/error UI | New components | `<app-empty-state>` / `<app-error-state>` | FOUND-06 |

**Key insight:** The only genuinely new logic in this phase is (1) `units.ts` cross-dimension/density math, (2) `food-ranking.ts` scoring, (3) `migrateV6ToV7`, and (4) the `DailyTargets` shape + %-bar rendering. Everything else is wiring existing primitives into a smoother UX.

## Runtime State Inventory

This is an overhaul of stored data (a schema migration), so the inventory matters.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The single `AppData` JSON under `fitness_tracker_data` (key in app-data.model.ts:68). Contains `savedFoods[]` (with possible legacy `gramsPerTbsp?` and dormant `fdcId`) and `mealEntries[]` (with snapshots). | **Data migration (V6→V7):** widen units, derive `densityGramsPerMl` from `gramsPerTbsp` where sensible, add `dailyTargets?`. Existing meal snapshots must remain byte-stable (D-12). |
| Live service config | None — no external services. Single-user local app, no n8n/Datadog/etc. | None — verified: no external integration beyond the Anthropic chat path (unrelated to diet). |
| OS-registered state | None — browser/Electron LocalStorage only; no OS task registration tied to diet data. | None — verified by codebase inspection. |
| Secrets/env vars | None reference diet data. (Anthropic API key is unrelated.) | None — verified: no env var keyed on diet field names. |
| Build artifacts | Pre-migration backups under `fitness_tracker_data.backup.*` (written by `writeBackup`). A V7 migration will write a fresh `v6` backup before transforming. | None beyond the automatic backup — `pruneOldBackups` (MAX 3) handles cleanup. The Karma per-file coverage overrides for `diet.service.ts` / `diet-page.component.ts` are ratchet floors that should be **raised** as specs are added (karma.conf.js comment says so explicitly). |

**The canonical question — after every file is updated, what runtime state still holds the old shape?** Only the user's stored `AppData` (still at schemaVersion 6 until they next load the app). `migrateV6ToV7` handles it on next `initialize()`, with a backup written first. Nothing else persists diet shape.

## Common Pitfalls

### Pitfall 1: Treating this as greenfield
**What goes wrong:** Rebuilding `DietService` CRUD, re-implementing nutrition summing, or creating a parallel day-grouping helper.
**Why it happens:** The phase is large and feature-rich; it *reads* like new construction.
**How to avoid:** Anchor every task to an existing method/helper to extend (this doc's §Don't Hand-Roll + §Patterns map each requirement to existing code).
**Warning signs:** A task that creates a `computeTotals`/`groupBy`/`generateId` that already exists.

### Pitfall 2: `groupByDay` mis-fit + DST day-boundary drift
**What goes wrong:** Calling `groupByDay(meals, …)` averages macros (should sum) and looks for a `.date` field `MealEntry` lacks (it has `dateTime`). Separately, naive UTC date math drops a meal logged at 11pm into the wrong day across a DST transition.
**Why it happens:** `groupByDay` was built for readings (averaging on `.date`); `toDateKey` uses local `getFullYear/getMonth/getDate` (correct), but `filterByRange`'s `subtractDays` uses `setUTCDate` (range math only — acceptable since it bounds a window, not a day key).
**How to avoid:** Add `sumByDay` reusing `toDateKey` on `dateTime`. Add an explicit DST test: a meal at local 23:30 on a spring-forward / fall-back date keys to the correct local day.
**Warning signs:** Diet macro chart points that look halved on multi-meal days; a meal appearing under the wrong date label near a DST boundary.

### Pitfall 3: Migration that breaks the `fdcId` passthrough or the tbsp path
**What goes wrong:** Rewriting `migrateSavedFoodV2ToV3`-style logic in V6→V7 and dropping the `fdcId` spread, or removing `gramsPerTbsp` without preserving conversion behavior, silently corrupting reusable foods.
**Why it happens:** Eagerness to "clean up" legacy fields during the widen.
**How to avoid:** V6→V7 is **additive** — carry every existing field through unchanged (the `migrateV5ToV6` no-op template at storage.service.ts:777-793 is the model). Derive `densityGramsPerMl` from `gramsPerTbsp` *additively* (1 tbsp ≈ 14.7868 ml → `densityGramsPerMl = gramsPerTbsp / 14.7868`) while **keeping `gramsPerTbsp` and the tbsp serving working**. Preserve `fdcId` via spread-from-source exactly as lines 846-848 do.
**Warning signs:** A V6→V7 fixture test where a food's `fdcId` or a tbsp serving disappears; a malformed-V6 input that throws instead of defaulting.

### Pitfall 4: Snapshot immutability silently violated by re-resolution
**What goes wrong:** A new render path (e.g. copy-meal preview, or a "recalculate" affordance) reads the live `SavedFood` for a historical item, so editing the food retroactively changes a logged meal's displayed macros.
**Why it happens:** The widened unit model tempts re-deriving from the food.
**How to avoid:** For any LOGGED meal item, always read `item.snapshot.totals`. Widen `MealItemSnapshot` to also store the resolved unit/serving label so nothing needs the food. Add a test: log a meal → edit the food's macros → assert the logged `MealEntry.totals` and `MealItem.snapshot` are unchanged.
**Warning signs:** A spec that asserts a meal total *changes* after a food edit (that would be the bug, not the test).

### Pitfall 5: Cross-dimension conversion offered without density (DIET-03 hard rule)
**What goes wrong:** UI lets the user pick "cup" for a food with no `densityGramsPerMl`, then either crashes or silently uses a global density.
**Why it happens:** The unit picker lists all units regardless of the food's density.
**How to avoid:** The picker only offers units in the food's base dimension + named servings, UNLESS `densityGramsPerMl` is set (then offer both dimensions). `units.ts` throws a typed error on a cross-dimension attempt without density — never falls back to any assumed constant. Show the UI-SPEC fallback copy: *"No density set — you can log this food in weight or volume units, but not convert between them."*
**Warning signs:** Any literal density constant (e.g. `1` g/ml for water) in `units.ts` used as a default.

## Code Examples

### Existing snapshot capture (the immutability mechanism — preserve)
```typescript
// Source: diet.service.ts:242-254 (addMeal item build)
const usedUnits = serving.amount * it.quantity;
const baseUnits = toBaseUnits(food, serving.unit, usedUnits);   // → delegate to units.ts after overhaul
const totals = scaleFoodTotals(food, baseUnits);
items.push({ id: generateId(), savedFoodId: food.id, savedFoodName: food.name,
  servingId: serving.id, servingLabel: serving.label, unit: serving.unit,
  quantity: it.quantity, snapshot: { baseUnits, totals } });   // ← snapshot frozen here
```

### Existing additive no-op migration (the V6→V7 template)
```typescript
// Source: storage.service.ts:777-793 (migrateV5ToV6) — the additive, defensive pattern to copy
private migrateV5ToV6(data: LegacyAppDataV5): AppData {
  return { schemaVersion: 6,
    cardioSessions: data.cardioSessions ?? [], /* …carry all fields, ?? [] defensive… */
    lastModified: data.lastModified };
}
```

### Existing fdcId passthrough (must survive untouched)
```typescript
// Source: storage.service.ts:846-848 — preserve a legacy runtime extra without an unsafe cast
return food.fdcId !== undefined ? { ...base, fdcId: food.fdcId } as SavedFood : base;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `FoodUnit = 'g' \| 'tbsp'` + `gramsPerTbsp?` | Widened mass/volume unions + per-food `densityGramsPerMl?` | This phase (V7) | More natural units; density is per-food, never global |
| g↔tbsp only, hard-coded in two places | Pure `units.ts` dimension+density model | This phase | Single tested conversion source; component dup deleted |
| Schema V6 (Phase 5) | Schema V7 | This phase | DIET-10 retargeted V6→V7 (ROADMAP cross-phase note) |
| `window.confirm()` for deletes | Inline button-swap confirms | This phase (UI-SPEC) | No-modal consistency |

**Deprecated/outdated:**
- DIET-10's "V5→V6" label in REQUIREMENTS.md is **superseded** — Phase 5 shipped V6; this phase is **V6→V7** (per ROADMAP cross-phase note and D-13). `[CITED: .planning/ROADMAP.md:155, app-data.model.ts:62]`
- `toBaseUnitsForPreview` in diet-page.component.ts:988 is a soon-to-be-deleted duplicate of the service-side `toBaseUnits`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hand-rolled `units.ts` beats `convert@7` for this use case | §Open Q1, Standard Stack | LOW — if a richer unit graph is later wanted, swapping in a lib is mechanical; the per-food density bridge stays hand-rolled regardless. |
| A2 | 1 tbsp = 14.7868 ml (US customary) is the right constant to derive `densityGramsPerMl` from legacy `gramsPerTbsp` | §Pitfall 3, §Open Q2 | LOW-MEDIUM — if the app historically meant metric tbsp (15 ml) the derived density is off by ~1.4%. Keeping `gramsPerTbsp` + tbsp serving working (not replacing it) makes this non-destructive either way. |
| A3 | Decayed-frequency favorite formula (half-life ~14d) matches user intent | §Open Q3 | LOW — pure + tunable; the constant is a 1-line change. User delegated the exact formula (D-06). |
| A4 | Single persistent `DailyTargets` (not per-day) is the right default | §Open Q4, D-08 | LOW — D-08 explicitly locks single-set-first; per-day deferred. |
| A5 | Copy-meal should re-derive preview from the CURRENT food (not the old snapshot) since the user is creating a NEW meal | §Open Q4 | MEDIUM — alternative: copy the snapshot verbatim. Recommend re-derive (the copied meal is "what I'm eating now", and the food may have been corrected). Flag for discuss-phase. |

## Open Questions (RESOLVED)

### Open Q1 — D-05: `convert` library vs hand-rolled `units.ts` → **RECOMMEND HAND-ROLLED**

**What we know:** `convert@7.0.0` is current (~1 MB unpacked, verified). It converts within a physical dimension (mass↔mass, volume↔volume) — which for our fixed unit set (g/oz/lb, ml/tsp/tbsp/cup) is a handful of exact factors. It does **not** model food-specific density, so the *hard* requirement (DIET-03 per-food weight↔volume) is hand-rolled either way.

**Recommendation:** Hand-roll. Rationale: bundle size (1 MB for the easy half is unjustified in a LocalStorage-only Electron app), the per-food density bridge is bespoke regardless, strict-TS typing of a small literal table is trivial, and a pure local module is the most testable (matches D-05's `web-citation-parser` template).

**Concrete API sketch (`src/app/services/units.ts`):**
```typescript
export type Dimension = 'mass' | 'volume';
export type MassUnit = 'g' | 'oz' | 'lb';
export type VolumeUnit = 'ml' | 'tsp' | 'tbsp' | 'cup';
export type MeasuredUnit = MassUnit | VolumeUnit;          // physical units only
// Named servings (e.g. "1 slice") are NOT MeasuredUnit — they carry an explicit gram/ml equivalent.

const DIMENSION: Record<MeasuredUnit, Dimension> = {
  g:'mass', oz:'mass', lb:'mass', ml:'volume', tsp:'volume', tbsp:'volume', cup:'volume',
};
// Canonical: grams for mass, millilitres for volume.
const TO_CANONICAL: Record<MeasuredUnit, number> = {
  g:1, oz:28.349523125, lb:453.59237,          // → grams
  ml:1, tsp:4.92892159375, tbsp:14.78676478125, cup:236.5882365,  // → millilitres (US customary)
};

export class UnitConversionError extends Error {}

/** Convert `amount` of `from` into `to`. Cross-dimension requires densityGramsPerMl; else throws. */
export function convertMeasured(
  amount: number, from: MeasuredUnit, to: MeasuredUnit, densityGramsPerMl?: number,
): number {
  const dFrom = DIMENSION[from], dTo = DIMENSION[to];
  const canonicalFrom = amount * TO_CANONICAL[from];                 // g or ml
  if (dFrom === dTo) return canonicalFrom / TO_CANONICAL[to];        // within-dimension
  if (!densityGramsPerMl || !Number.isFinite(densityGramsPerMl) || densityGramsPerMl <= 0)
    throw new UnitConversionError('density required for weight↔volume conversion');
  const grams = dFrom === 'mass' ? canonicalFrom : canonicalFrom * densityGramsPerMl;
  const ml    = dFrom === 'volume' ? canonicalFrom : canonicalFrom / densityGramsPerMl;
  return dTo === 'mass' ? grams / TO_CANONICAL[to] : ml / TO_CANONICAL[to];
}

/** Resolve a logged (food, unit, amount) into baseUnit count for scaleFoodTotals.
 *  Handles: named serving (explicit equiv) → within-dim → cross-dim via density. */
export function toBaseUnits(/* food, unit|servingEquivalent, amount */): number { /* compose per Pattern 2 */ }
```
- **Named serving gram-equivalents:** stored on `SavedFoodServing` (already `{unit, amount}`); a named serving is just a serving whose `unit` is the base measured unit with a stored `amount`. Widening keeps this — no new shape needed beyond the unit union.
- **Graceful fallback when density absent:** `convertMeasured` throws `UnitConversionError`; callers (and the UI unit picker) must only offer cross-dimension units when `densityGramsPerMl` is set. Never substitute a default density (DIET-03).
- **Testability:** 100% pure; recommend a Stryker mutation floor on `units.ts` (Stryker already installed) given conversion correctness is safety-critical for the data record.

### Open Q2 — D-13: concrete `migrateV6ToV7` + `LegacyAppDataV6`

**`LegacyAppDataV6`** (add to legacy-schemas.ts): structurally identical to `LegacyAppDataV5` for the non-diet slices, but `savedFoods` typed as a `LegacySavedFoodV6` that still carries the **narrow** `FoodUnit = 'g'|'tbsp'` and `gramsPerTbsp?` (no `densityGramsPerMl`, no `preferredUnits`), and `AppData`-level has **no** `dailyTargets`. Mirror the existing `LegacyAppDataV5` interface (legacy-schemas.ts:188-201).

**`migrateV6ToV7(data: LegacyAppDataV6): AppData`** — additive, deterministic:
1. Bump `schemaVersion: 7`.
2. Carry every existing field through (`?? []` defensive on top-level arrays — the V5→V6 template).
3. For each `savedFood`: keep `baseUnit`, `gramsPerTbsp`, `servings`, `fdcId` (spread-preserve) **unchanged**; if `gramsPerTbsp` is a positive finite number and `densityGramsPerMl` is absent, set `densityGramsPerMl = gramsPerTbsp / 14.78676478125` (A2). Leave `preferredUnits` undefined.
4. `dailyTargets`: leave **undefined** (no targets until the user sets them — never store `null`).
5. Preserve `mealEntries` byte-for-byte (snapshots are immutable; D-12).

**Fixtures:** add `migrations/fixtures/v6.json` (a V6 AppData incl. one food with `gramsPerTbsp` + dormant `fdcId`, one g-only food, one meal with a snapshot) and `v7-expected.json`. **Malformed matrix:** `malformed/v6-missing-savedfoods.json`, `v6-wrong-type-density.json` (e.g. `gramsPerTbsp: "abc"` → density NOT derived, food still loads), `v6-null.json`. Each malformed input must either load with defaults OR throw typed `StorageError('MIGRATION_FAILED')` — never silently corrupt (mirror storage.service.migration-fixtures.spec.ts).

### Open Q3 — D-06: favorite-ranking formula
**Recommendation:** decayed-frequency score per food = Σ over its log events of `0.5 ^ (ageDays / HALF_LIFE_DAYS)`, with `HALF_LIFE_DAYS = 14`. Pure `rankFoods(foods, mealEntries, now): SavedFood[]` (sorted desc by score). "Recent" = distinct `savedFoodId`s from `mealEntries` sorted by `dateTime` desc, top N (e.g. 8). `now` is a parameter (no internal clock) for deterministic tests.
- What's unclear: exact half-life / list lengths — delegated to Claude (D-06).
- Recommendation: ship the formula above; it's a one-constant tweak if tuning is wanted.

### Open Q4 — copy-meal preview source + targets shape
- **Copy-meal preview (A5):** Recommend re-deriving the preview from the **current** food at copy time (the copied meal is a new "eating now" event; the food may have been corrected since). Alternative is verbatim-snapshot copy. **Flag for discuss-phase** — both are defensible; re-derive aligns with "what I'm eating now."
- **`DailyTargets` shape (D-08):** Recommend a single optional `dailyTargets?: { caloriesKcal?: number; proteinG?: number; fatG?: number; carbsG?: number; netCarbsG?: number }` on `AppData` (each metric optional so a user can target only calories). Per-day overrides deferred (D-08).

## Environment Availability

No external tools/services beyond the already-installed toolchain. Skip-eligible, but for completeness:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Angular CLI (`ng`) | build/test | ✓ | 18.2.x | — `[VERIFIED: package.json]` |
| chart.js + ng2-charts | DIET-07 charts | ✓ | 4.5.1 / 7.0.0 | — `[VERIFIED: package.json]` |
| Karma + Jasmine | all specs | ✓ | 6.4 / 5.2 | — `[VERIFIED: package.json]` |
| Stryker | optional `units.ts` mutation floor | ✓ | 9.6.1 | skip if not wanted `[VERIFIED: package.json]` |
| `convert` npm lib | (NOT adopted) | ✗ | — | hand-rolled `units.ts` (the recommendation) `[VERIFIED: not in node_modules]` |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** `convert` is intentionally not installed — hand-rolled `units.ts` is the chosen path.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jasmine 5.2 + Karma 6.4 (Angular default) `[VERIFIED: package.json]` |
| Config file | `karma.conf.js` (per-file coverage thresholds; `diet.service.ts` and `diet-page.component.ts` floors should be RAISED as specs land) |
| Quick run command | `ng test --no-watch` |
| Full suite command | `ng test --no-watch --code-coverage` (enforces thresholds) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIET-03 | Within-dimension conversion correct (g↔oz↔lb, ml↔tsp↔tbsp↔cup) | unit (pure) | `ng test --no-watch` (units.spec.ts) | ❌ Wave 0 |
| DIET-03 | Weight↔volume correct WITH density; THROWS without (no global default) | unit (pure) | same | ❌ Wave 0 |
| DIET-02 | Named-serving gram-equivalents resolve correctly | unit (pure) | same | ❌ Wave 0 |
| DIET-04 | `filterFoods` case-insensitive substring; `rankFoods` deterministic given fixed `now` | unit (pure) | same (food-ranking.spec.ts) | ❌ Wave 0 |
| DIET-06 | `sumTotals` live preview = saved + pending; netCarbs = max(0,carbs-fiber) | unit | diet.service.spec.ts (exists; extend) | ✅ extend |
| DIET-06 | %-of-target + over-target bar state computed correctly | unit | diet-page spec | ✅ extend |
| DIET-05 | Copy-meal maps historical items → editable pending items | unit/DOM | diet-page spec | ✅ extend |
| DIET-07 | `sumByDay` sums (not averages) macros by local day on `dateTime` | unit (pure) | chart-grouping.spec.ts (extend) | ✅ extend |
| DIET-08 | Day key correct across a DST transition (23:30 local boundary) | unit (pure) | chart-grouping.spec.ts | ✅ extend |
| DIET-09 | Editing a food leaves historical `MealEntry.totals`/`snapshot` unchanged | unit | diet.service.spec.ts | ✅ extend |
| DIET-10 | V6→V7 fixture reaches schemaVersion 7; gramsPerTbsp→density derived; fdcId preserved | unit (fixture) | storage.service.migration-fixtures.spec.ts (extend) | ✅ extend |
| DIET-10 | Malformed V6 loads-with-defaults OR throws MIGRATION_FAILED (never corrupts) | unit (fixture) | same | ✅ extend |

### Sampling Rate
- **Per task commit:** `ng test --no-watch` (fast, threshold-free)
- **Per wave merge:** `ng test --no-watch --code-coverage`
- **Phase gate:** Full coverage suite green + production build (`ng build --configuration=production`) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/app/services/units.spec.ts` — covers DIET-02/03 (conversion correctness + density-absent throw)
- [ ] `src/app/services/units.ts` — the module under test (must exist first)
- [ ] `src/app/services/food-ranking.spec.ts` + `food-ranking.ts` — covers DIET-04
- [ ] `src/app/services/migrations/fixtures/v6.json` + `v7-expected.json` + `malformed/v6-*.json` — covers DIET-10
- [ ] Raise `karma.conf.js` per-file floors for `diet.service.ts` / `diet-page.component.ts` once specs land (the config comment mandates this ratchet)
- [ ] Existing framework covers everything else — no install needed.

## Security Domain

`security_enforcement: true` (config.json). This phase is local-only data handling — no network, no auth, no new egress.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single-user local app; no auth surface |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-user/roles |
| V5 Input Validation | yes | Existing `DietValidationError` + `validators.ts` ranges; extend for new unit/density/target fields (e.g. `densityGramsPerMl > 0`, target metrics ≥ 0). Calories 0-20000 range already defined. |
| V6 Cryptography | no | No secrets handled by diet code |
| V7 Error Handling / Logging | yes | Typed `StorageError`/`DietValidationError`; migration failures surface the recovery banner (FOUND-07) — never silent corruption |
| V8 Data Protection | yes | Backup-before-migrate (FOUND-07); D-12 snapshot immutability protects the historical record |

### Known Threat Patterns for {Angular 18 + LocalStorage}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Migration data loss (V6→V7 corrupts foods/meals) | Tampering / Repudiation | Backup-before-migrate + additive transform + fixture & malformed tests (Pitfall 3) |
| Snapshot mutation via food edit | Tampering | Read `item.snapshot` for logged meals; immutability test (Pitfall 4, D-12) |
| Global-density leak (silent wrong macros) | Tampering | `units.ts` throws on cross-dimension without per-food density — never a default constant (Pitfall 5, DIET-03) |
| XSS via user-entered food name | Tampering / Elevation | Angular template interpolation auto-escapes; **no `innerHTML` sinks** — confirmed none exist in diet/charts components (verified by inspection); chart labels are passed as data, not HTML |
| External food-DB egress introduced | Information disclosure | D-14 hard constraint + Phase 5 CSP (`connect-src 'self' https://api.anthropic.com`); this phase adds NO network call |
| LocalStorage quota overflow on growth | DoS | QUAL-02 quota banners already shipped; diet writes go through the same `saveData` quota-error path |

**XSS confirmation:** Grep + inspection of `diet-page.component.ts` and `charts-page.component.ts` shows all user-entered food names render via `{{ }}` interpolation (auto-escaped) and chart labels/data via the ng2-charts `[data]` binding — **no `[innerHTML]` / `bypassSecurityTrust*` sinks**. `[VERIFIED: grep + component read]`

## Sources

### Primary (HIGH confidence)
- Live codebase (read in full this session): `diet.model.ts`, `diet.service.ts`, `storage.service.ts`, `app-data.model.ts`, `legacy-schemas.ts`, `chart-grouping.ts`, `date-range.ts`, `validators.ts`, `diet-page.component.ts`, `charts-page.component.ts`, `web-citation-parser.ts`, `karma.conf.js`, `package.json`
- `.planning/` docs: `02-CONTEXT.md`, `02-UI-SPEC.md`, `REQUIREMENTS.md`, `ROADMAP.md`
- npm registry: `convert` 7.0.0 (unpacked 1,025,979 bytes), `js-quantities` 1.8.0, `convert-units` 2.3.4 `[VERIFIED: npm view]`

### Secondary (MEDIUM confidence)
- US-customary volume/mass conversion constants (tbsp=14.78676478125 ml, oz=28.349523125 g, etc.) — standard physical constants `[CITED: NIST/US customary unit definitions]`

### Tertiary (LOW confidence)
- None — every recommendation is grounded in inspected code or a verified registry fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against package.json; no new deps.
- Architecture / patterns: HIGH — every pattern maps to an existing method or shared helper read this session.
- Migration (V6→V7): HIGH — direct template (`migrateV5ToV6`) + typed-chain + fixture discipline already in tree.
- `units.ts` decision: HIGH on the recommendation (hand-rolled), the density-derivation constant (A2) is MEDIUM.
- Pitfalls: HIGH — derived from concrete code mismatches (groupByDay averaging, component dup, fdcId passthrough).

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stable — internal codebase + one stable npm fact; no fast-moving dependency)
