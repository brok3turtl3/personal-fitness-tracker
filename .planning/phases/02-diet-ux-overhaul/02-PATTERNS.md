# Phase 2: Diet UX Overhaul - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 12 (3 new, 9 modified/extended)
**Analogs found:** 12 / 12

> **This is an OVERHAUL of an existing Angular 18 app.** Almost every "new" file is an *extension* of an existing file. The closest analog is usually the SAME file's current implementation, plus one cross-file template (a pure-module sibling, a prior migration hop, etc.). The planner should treat "copy the existing in-file pattern and widen it" as the default action — see RESEARCH §"Treating this as greenfield" pitfall.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/services/units.ts` **(NEW)** | utility (pure) | transform | `src/app/services/web-citation-parser.ts` (pure-module template) + existing `toBaseUnits` (diet.service.ts:479-500) | role-match + exact-logic-ancestor |
| `src/app/services/units.spec.ts` **(NEW)** | test | transform | `diet.service.spec.ts` (pure-fn assertions) + migration-fixtures spec (table-driven) | role-match |
| `src/app/services/food-ranking.ts` **(NEW)** | utility (pure) | transform | `src/app/services/web-citation-parser.ts` (pure-module, `now` injected for determinism) | role-match |
| `src/app/services/food-ranking.spec.ts` **(NEW)** | test | transform | `diet.service.spec.ts` | role-match |
| `src/app/models/diet.model.ts` | model | — | self (existing `FoodUnit`/`SavedFood`/`MealItem` interfaces — widen in place) | exact |
| `src/app/models/app-data.model.ts` | model/config | — | self (existing `AppData` + `CURRENT_SCHEMA_VERSION` doc-comment) | exact |
| `src/app/models/index.ts` | config (barrel) | — | self (existing barrel `export *`) | exact |
| `src/app/services/legacy-schemas.ts` (add `LegacyAppDataV6`) | model (type-only) | — | `LegacyAppDataV5` (legacy-schemas.ts:188-201) | exact |
| `src/app/services/storage.service.ts` (add `migrateV6ToV7`) | service (migration) | transform/persistence | `migrateV5ToV6` (storage.service.ts:777-793) + chain hop (migrateData:599-627) | exact |
| `src/app/services/diet.service.ts` (extend) | service | CRUD | self (delegate `toBaseUnits`→`units.ts`; add copy-meal/targets pass-through) | exact |
| `src/app/features/diet/diet-page.component.ts` (overhaul) | component | request-response (UI) | self (`pendingItems`/`mealItemForm`/`startEditMeal` patterns) + Phase 5 inline-edit | exact |
| `src/app/features/charts/charts-page.component.ts` (extend) | component | request-response (UI) | self (`buildCardioChart` calories series, charts-page.component.ts:430-515) | exact |
| `src/app/shared/chart-grouping.ts` (add `sumByDay`) | utility (pure) | transform | sibling `groupByDay` (chart-grouping.ts:24-55) — **reuse `toDateKey`, do NOT reuse averaging** | role-match (deliberate fork of grouping, shared keying) |
| `migrations/fixtures/v6.json` + `v7-expected.json` + `malformed/v6-*.json` **(NEW)** | test fixture | — | existing `v5-expected.json` + `malformed/v4-*.json` set | exact |

---

## Pattern Assignments

### `src/app/services/units.ts` (NEW — pure utility, transform)

**Analog:** `src/app/services/web-citation-parser.ts` (module shape) + the existing `toBaseUnits`/`defaultServingsFor` in `diet.service.ts:460-500` (the conversion logic being replaced).

**Module-shape pattern to copy** (web-citation-parser.ts:1-50) — NO `@Injectable`, no class, no DI, top doc-comment, named `export function`s, typed error class:
```typescript
// PURE MODULE — no dependency injection, no persistence-service coupling, no class.
// Mirrors validators.ts / web-citation-parser.ts / confidence-attribution-parser.ts.
export class UnitConversionError extends Error {}
export function convertMeasured(amount: number, from: MeasuredUnit, to: MeasuredUnit, densityGramsPerMl?: number): number { ... }
```

**Density-guard pattern** — mirror the EXISTING throw-without-density guard in `toBaseUnits` (diet.service.ts:483-486), but generalized and NEVER substituting a default constant (DIET-03 hard rule, RESEARCH Pitfall 5):
```typescript
// Source: diet.service.ts:483-486 — the existing "no conversion without density" throw to generalize
const gpt = food.gramsPerTbsp;
if (!gpt || !Number.isFinite(gpt) || gpt <= 0) {
  throw new DietValidationError(['Cannot convert between g and tbsp without grams-per-tbsp for this food']);
}
```
Generalize to: cross-dimension (mass↔volume) requires `densityGramsPerMl > 0` & finite, else `throw new UnitConversionError(...)`. Within-dimension (g↔oz↔lb, ml↔tsp↔tbsp↔cup) uses a fixed `TO_CANONICAL` factor table (full sketch in RESEARCH §Open Q1, lines 363-401). Named servings carry an explicit gram/ml equivalent — never go through `convertMeasured`.

**`safeNumber` defensive idiom to reuse** (diet.service.ts:438-440): `Number.isFinite(n) ? n : 0` for all numeric inputs.

**Anti-pattern:** No literal density default (e.g. `1` g/ml). The component-side duplicate `toBaseUnitsForPreview` (diet-page.component.ts:988-1004) MUST be DELETED and both call sites delegate here.

---

### `src/app/services/food-ranking.ts` (NEW — pure utility, transform)

**Analog:** `src/app/services/web-citation-parser.ts` (pure module, total functions). Same module-shape rules as `units.ts`.

**Determinism pattern (locked):** pass `now: number` as a parameter — NO internal `Date.now()` (testability, RESEARCH §Pattern 3 / Open Q3):
```typescript
export function filterFoods(foods: SavedFood[], query: string): SavedFood[] // case-insensitive substring on name
export function rankFoods(foods: SavedFood[], mealEntries: MealEntry[], now: number): SavedFood[] // decayed-frequency, sorted desc
```
Decayed-frequency score per food = Σ `0.5 ^ (ageDays / HALF_LIFE_DAYS)` over its log events; `HALF_LIFE_DAYS = 14` (RESEARCH Open Q3 — a one-constant tweak). "Recent" = distinct `savedFoodId`s from `mealEntries` sorted by `dateTime` desc, top N≈8. Derive `ageDays` from `MealEntry.dateTime`.

---

### `src/app/models/diet.model.ts` (MODIFIED — widen in place)

**Analog:** self. Current shapes at diet.model.ts:3, 16-62. Widen, keep additive/backward-compatible:
- `FoodUnit`: `'g' | 'tbsp'` → mass (`'g'|'oz'|'lb'`) + volume (`'ml'|'tsp'|'tbsp'|'cup'`) union. Reuse `MeasuredUnit` from `units.ts` (import the type — model→service type-only import precedent: web-citation-parser re-exports a model type; here the unit union may live in `units.ts` and be re-exported, OR be defined in the model and imported by `units.ts` — planner picks; CLAUDE.md forbids circular deps, so prefer defining the union in the model and importing into `units.ts`).
- `SavedFood` (diet.model.ts:23-38): ADD optional `densityGramsPerMl?: number` and optional `preferredUnits?` — keep `gramsPerTbsp?` (legacy, still works). Use `?`, never store `null` (CLAUDE.md).
- `MealItemSnapshot` (diet.model.ts:48-51): widen to also store resolved unit/serving label so a historical render never re-resolves from the (possibly edited) food (DIET-09, RESEARCH Pitfall 4).
- ADD `DailyTargets` interface (or in a new `daily-targets.model.ts`): `{ caloriesKcal?: number; proteinG?: number; fatG?: number; carbsG?: number; netCarbsG?: number }` (RESEARCH Open Q4) — each metric optional.

---

### `src/app/models/app-data.model.ts` (MODIFIED)

**Analog:** self (app-data.model.ts:17-65).
- ADD optional `dailyTargets?: DailyTargets` to `AppData` (interface, line ~52).
- Bump `CURRENT_SCHEMA_VERSION = 6` → `7` (line 65) and update its doc-comment (lines 55-64) following the existing version-bump narration style.
- `createEmptyAppData` (lines 73-87): leave `dailyTargets` omitted (undefined default, never `null`).

---

### `src/app/models/index.ts` (MODIFIED)

**Analog:** self. Add `export * from './diet.model';` if not already present and the new `daily-targets.model.ts` barrel line if a separate file is used. (Note: `diet.model` is currently NOT in the barrel — verify and add if the new `DailyTargets`/widened types should be barrel-exported.)

---

### `src/app/services/legacy-schemas.ts` (MODIFIED — add `LegacyAppDataV6`)

**Analog:** `LegacyAppDataV5` (legacy-schemas.ts:188-201) — copy this interface verbatim, rename to `LegacyAppDataV6`, set `schemaVersion: 6`. Type `savedFoods` as a `LegacySavedFoodV6` carrying the NARROW pre-V7 shape (`gramsPerTbsp?`, no `densityGramsPerMl`, no `preferredUnits`); `AppData`-level has NO `dailyTargets`.
```typescript
// Source: legacy-schemas.ts:188-201 (LegacyAppDataV5) — the interface template to clone
export interface LegacyAppDataV5 {
  schemaVersion: 5;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  savedFoods: SavedFood[];
  mealEntries: MealEntry[];
  aiSettings?: AISettings;
  chatConversations: LegacyChatConversationV5[];
  memoryFiles: Record<string, string>;
  userProfile: UserProfile;
  aiToolSettings: AIToolSettings;
  lastModified: string;
}
```

---

### `src/app/services/storage.service.ts` (MODIFIED — add `migrateV6ToV7` + chain hop)

**Analog:** `migrateV5ToV6` (storage.service.ts:777-793) — the additive no-op template. ALL backup/prune/throw machinery is reused unchanged (RESEARCH §Don't Hand-Roll).

**Chain-hop pattern** (migrateData:599-627) — add the V7 hop after V6:
```typescript
// Source: storage.service.ts:622-626 — add a v7 step in the same shape
const v6: LegacyAppDataV6 = (fromVersion < 6) ? this.migrateV5ToV6(v5) : (data as LegacyAppDataV6);
const v7: AppData = (fromVersion < 7) ? this.migrateV6ToV7(v6) : (data as AppData);
return v7;
```
(Note: `migrateV5ToV6` currently returns `AppData`; its return type narrows to `LegacyAppDataV6` once V7 becomes the terminal version. Mechanical.)

**Migration body** — copy the additive `?? []` defensive style verbatim (storage.service.ts:777-793), then for each saved food derive density additively (RESEARCH Open Q2, Pitfall 3):
```typescript
// Source: storage.service.ts:777-793 (migrateV5ToV6) — additive, defensive `?? []` template
private migrateV6ToV7(data: LegacyAppDataV6): AppData {
  return {
    schemaVersion: 7,
    cardioSessions: data.cardioSessions ?? [],
    weightEntries: data.weightEntries ?? [],
    healthReadings: data.healthReadings ?? [],
    savedFoods: (data.savedFoods ?? []).map(migrateSavedFoodV6ToV7), // widen units, derive density
    mealEntries: data.mealEntries ?? [],   // BYTE-STABLE — snapshots immutable (D-12)
    aiSettings: data.aiSettings,
    chatConversations: data.chatConversations ?? [],
    memoryFiles: data.memoryFiles ?? {},
    userProfile: data.userProfile,
    aiToolSettings: data.aiToolSettings,
    // dailyTargets: leave UNDEFINED — never store null
    lastModified: data.lastModified,
  };
}
```
Per-food rule: if `gramsPerTbsp` is positive+finite and `densityGramsPerMl` absent → `densityGramsPerMl = gramsPerTbsp / 14.78676478125`; KEEP `gramsPerTbsp` and the tbsp serving working.

**`fdcId` passthrough — MUST survive untouched** (storage.service.ts:846-848). Reuse this exact spread-preserve idiom in the per-food V6→V7 mapper:
```typescript
// Source: storage.service.ts:846-848 — preserve a legacy runtime extra without an unsafe cast
return food.fdcId !== undefined ? { ...base, fdcId: food.fdcId } as SavedFood : base;
```

**Error path:** the surrounding `initialize()` already writes a backup and throws typed `StorageError('MIGRATION_FAILED')` on a thrown migration (storage.service.ts:159-181) — reuse, never add a new backup path.

---

### `src/app/services/diet.service.ts` (MODIFIED — extend, don't rebuild)

**Analog:** self. Concrete edits:
- `toBaseUnits` (diet.service.ts:479-500): DELETE the g↔tbsp body; delegate to `units.ts`. Both `addMeal` (line 239) and `buildMealItems` (line 392) call sites stay; only the helper body changes.
- Snapshot capture (diet.service.ts:242-254 in `addMeal`, 395-407 in `buildMealItems`): PRESERVE — this is the DIET-09 immutability mechanism. Widen the `snapshot` object to carry the resolved unit/serving context (matches widened `MealItemSnapshot`).
- `addSavedFood`/`updateSavedFood`/`addCustomServing` validation (lines 45, 55, 98, 134): widen the `unit !== 'g' && unit !== 'tbsp'` checks to the new union; add `densityGramsPerMl > 0` validation. Keep `DietValidationError` (diet.service.ts:17-25) as the error type.
- ADD copy-meal helper: reuse `getMealsForDay` (diet.service.ts:197) then map items → pending shape (the component already does this in `startEditMeal`).
- `sumTotals`/`scaleFoodTotals`/`computeDailyTotals` (lines 442-525): REUSE verbatim for live totals — already compute `netCarbsG = max(0, carbs - fiber)`.
- `updateSavedFood` identity preservation (diet.service.ts:160-167): already preserves `id`/`createdAt`, refreshes `updatedAt` — the D-12 CRUD-parity pattern; keep.

---

### `src/app/features/diet/diet-page.component.ts` (OVERHAUL — UI only)

**Analog:** self + Phase 5 no-modal inline-edit. Concrete reuse points:

**Pending-item staging** (diet-page.component.ts:794-803) — the exact shape inline quick-add and copy-meal both target:
```typescript
// Source: diet-page.component.ts:794-803 (onAddMealItem) — reuse this staging shape
this.pendingItems = [
  ...this.pendingItems,
  { savedFoodId, servingId, quantity, label, preview }  // preview = scaleFoodTotals(food, baseUnits)
];
```

**Copy-meal** = `startEditMeal`'s item→pending map (diet-page.component.ts:869-875) MINUS setting `editingMealId`:
```typescript
// Source: diet-page.component.ts:869-875 (startEditMeal) — copy-meal is the same map, without editingMealId
this.pendingItems = meal.items.map(it => ({
  savedFoodId: it.savedFoodId, servingId: it.servingId, quantity: it.quantity,
  label: `${it.savedFoodName} - ${it.servingLabel} x${it.quantity}`, preview: it.snapshot.totals
}));
```
(RESEARCH Open Q4/A5 flags: copy-meal should RE-DERIVE preview from the CURRENT food, not the old snapshot — "what I'm eating now".)

**Save flow** (diet-page.component.ts:812-863) — reuse `onAddMeal`'s add/update branch + `takeUntilDestroyed(this.destroyRef)` + error→`DietValidationError` mapping verbatim.

**Live totals** — recompute `sumTotals([...savedMeals.totals, ...pendingItems.preview])` on every pending change; render in the existing `.totals`/`.totals-grid`/`.k`/`.v` markup (already present in the component template).

**Delegate conversion:** DELETE `toBaseUnitsForPreview` (diet-page.component.ts:988-1004); call `units.ts` from `onAddMealItem` (line 786) instead.

**Anti-pattern — `window.confirm`:** `onDeleteFood` (diet-page.component.ts:655) and `onDeleteMeal` currently use `window.confirm`. Per UI-SPEC, REPLACE with inline button-swap confirms (Phase 5 D-11). New code must add NO new `confirm()`/modal calls.

**Reuse:** `<app-error-state>` / `<app-empty-state>` (already imported), `formatLocalDateTime`/`formatLocalDateTimeFromIso` helpers, `takeUntilDestroyed` hygiene.

---

### `src/app/features/charts/charts-page.component.ts` (MODIFIED — add diet series)

**Analog:** self — `buildCardioChart` (charts-page.component.ts:430-515) is the template for a new `buildDietChart`.

**Dataset shape** (charts-page.component.ts:476-486 — cardio calories) — copy hue/alpha/pointRadius/tension/yAxisID pattern; diet calories reuse the SAME `#e67e22` orange (UI-SPEC):
```typescript
// Source: charts-page.component.ts:476-486 (cardio calories dataset) — diet calories mirror this exactly
{ data: calories, label: 'Calories (kcal)', borderColor: '#e67e22',
  backgroundColor: 'rgba(230, 126, 34, 0.12)', spanGaps: true, pointRadius: 2, tension: 0.25, yAxisID: 'y2' }
```
Macro hues from UI-SPEC: protein `#16a085`, fat `#f1c40f`, carbs `#8e44ad`, net carbs `#c0392b` with `borderDash: [4,4]`. Calories on primary `y`; macros (g) share a secondary axis with `grid: { drawOnChartArea: false }` (charts-page.component.ts:500).

**Controls** — add `dietShowCalories`/`dietShowProtein`/… to `controlsForm` (charts-page.component.ts:315-320) mirroring `cardioShowDistance`/`cardioShowCalories`; checkbox markup mirrors lines 108-114; `(change)="onControlsChanged()"` wiring.

**Range filtering** — reuse `filterByRange` + `resolveDateRange` (charts-page.component.ts:406, 394) verbatim. Bucket via the NEW `sumByDay` (below), keyed on `MealEntry.dateTime`.

---

### `src/app/shared/chart-grouping.ts` (MODIFIED — add `sumByDay`)

**Analog:** sibling `groupByDay` (chart-grouping.ts:24-55) — copy the Map-build + sorted-keys structure, but **SUM instead of average** and **key on a caller-supplied date accessor** (not the hardcoded `.date` — `MealEntry` has `dateTime`):
```typescript
// Source: chart-grouping.ts:24-55 (groupByDay) — copy structure, change average→sum, key via toDateKey(accessor)
// REUSE toDateKey (chart-grouping.ts:11) — the shared local-time keying contract (D-11); do NOT fork it.
export function sumByDay<T>(items: T[], dateOf: (t: T) => string, extractor: (t: T) => number[]): { labels: string[]; values: number[][] } { ... }
```
**Critical (RESEARCH Pitfall 2):** do NOT call `groupByDay` for diet — it AVERAGES (halves multi-meal-day macros) and expects a `.date` field that `MealEntry` lacks. Reuse ONLY `toDateKey`.

---

### Test fixtures `migrations/fixtures/v6.json` + `v7-expected.json` + `malformed/v6-*.json` (NEW)

**Analog:** existing `v5-expected.json` + `malformed/v4-*.json` set (migrations/fixtures/). Wire into the existing `storage.service.migration-fixtures.spec.ts` (import-and-iterate pattern, spec lines 26-44):
```typescript
// Source: storage.service.migration-fixtures.spec.ts:27-44 — add v6/malformed-v6 imports in the same shape
import v6Fixture from './migrations/fixtures/v6.json';
import malformedV6WrongTypeDensity from './migrations/fixtures/malformed/v6-wrong-type-density.json';
```
Fixtures (RESEARCH Open Q2): `v6.json` = one food with `gramsPerTbsp`+dormant `fdcId`, one g-only food, one meal with a snapshot. Malformed matrix: `v6-missing-savedfoods.json`, `v6-wrong-type-density.json` (`gramsPerTbsp:"abc"` → density NOT derived, food still loads), `v6-null.json`. Each loads-with-defaults OR throws `StorageError('MIGRATION_FAILED')` — never corrupts (spec assertion pattern at lines 6-13).

---

## Shared Patterns

### Pure-module template (no DI, no class)
**Source:** `src/app/services/web-citation-parser.ts:1-50`
**Apply to:** `units.ts`, `food-ranking.ts`
- Top doc-comment stating "PURE MODULE — no dependency injection, no class". Named `export function`s. Typed error classes (`UnitConversionError extends Error`). Total functions where possible. Inject `now`/density as params — no internal clock, no global constants.

### Local-time day keying (single source)
**Source:** `src/app/shared/chart-grouping.ts:11` (`toDateKey`)
**Apply to:** `sumByDay`, all diet day-bucketing, charts diet series (DIET-07/08, D-11)
- Always key via `toDateKey`; never hand-roll a date bucket. Add a DST-transition test (23:30 local on spring-forward/fall-back).

### Additive, defensive migration
**Source:** `src/app/services/storage.service.ts:777-793` (`migrateV5ToV6`) + 846-848 (`fdcId` passthrough)
**Apply to:** `migrateV6ToV7`
- Carry every field through with `?? []` defaults; bump `schemaVersion`; preserve legacy fields (`gramsPerTbsp`, `fdcId`) untouched; `mealEntries` byte-stable; never store `null`.

### Snapshot immutability
**Source:** `src/app/services/diet.service.ts:242-254` (snapshot capture)
**Apply to:** all logged-meal render/copy paths (DIET-09, D-12)
- Logged items ALWAYS read `item.snapshot.totals`, NEVER re-resolve from the live `SavedFood`. Widen `MealItemSnapshot` to carry unit/serving label so no render path needs the food.

### Validation + typed errors
**Source:** `src/app/services/diet.service.ts:17-25` (`DietValidationError`) + `safeNumber` (438-440) + `validators.ts` ranges
**Apply to:** all new diet field validation (density > 0, target metrics ≥ 0, widened unit checks)
- Collect errors into a string[], throw `DietValidationError`. Calories 0-20000 range already defined.

### RxJS hygiene + shared helpers
**Source:** `diet-page.component.ts` (`takeUntilDestroyed(this.destroyRef)`), `shared/id.ts` (`generateId`), `StorageService` (only LocalStorage chokepoint)
**Apply to:** all new component subscriptions, all ID generation, all persistence
- Never inline `crypto.randomUUID()`; never touch `localStorage` directly.

### Empty/error UI
**Source:** `<app-empty-state>` / `<app-error-state>` (Phase 1 FOUND-06)
**Apply to:** new diet surfaces + charts diet-empty state (copy strings in UI-SPEC §Copywriting Contract)

---

## No Analog Found

None. Every file maps to an existing in-tree analog (this is an overhaul). The only genuinely-new LOGIC is: (1) `units.ts` cross-dimension/density math, (2) `food-ranking.ts` scoring, (3) `migrateV6ToV7` density-derivation, (4) `DailyTargets` shape + %-bar rendering — and each has a close structural template listed above.

---

## Metadata

**Analog search scope:** `src/app/services/`, `src/app/models/`, `src/app/features/diet/`, `src/app/features/charts/`, `src/app/shared/`, `src/app/services/migrations/fixtures/`
**Files scanned:** 12 read in full or targeted (diet.model.ts, app-data.model.ts, diet.service.ts, web-citation-parser.ts, chart-grouping.ts, storage.service.ts §599-848, legacy-schemas.ts §150-201, diet-page.component.ts targeted, charts-page.component.ts targeted, diet.service.spec.ts, storage.service.migration-fixtures.spec.ts, models/index.ts)
**Pattern extraction date:** 2026-06-01
