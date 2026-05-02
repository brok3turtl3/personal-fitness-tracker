# Phase 1: Foundations - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor safety net for v2 work. Phase 1 ships:

1. **Coverage instrumentation** — `karma.conf.js` extracted, per-pattern thresholds enforced via `coverageReporter.check`, fired only on `--code-coverage` runs.
2. **Shared utilities** — single `id.ts` (`generateId()` over `crypto.randomUUID()`) replacing the 6 duplicated `generateUUID` copies; `groupByDay` / `toDateKey` / `round2` extracted from `charts-page.component.ts:594-646` into `src/app/shared/` so charts and reports stop drifting.
3. **Subscription hygiene** — `takeUntilDestroyed(this.destroyRef)` retrofitted to every component that subscribes (every page in `src/app/features/**`).
4. **Characterization tests** — Karma TestBed DOM specs covering the dominant user flows on `diet-page`, `chat-page`, `charts-page`, `reports-page`, with axe-core a11y assertions bundled in.
5. **Empty/error state pattern** — `<app-empty-state>` and `<app-error-state>` standalone components in `src/app/shared/`, retrofitted to all 8 feature pages.
6. **Schema-migration discipline** — typed `LegacyAppDataVN` interfaces (no `as any`), backup-before-migrate to a timestamped recovery key, fixture-driven characterization tests for V0→V4, malformed-input matrix, and a recovery banner that blocks the app on migration failure.
7. **Puppeteer + axe-core scaffolds** — wired so Phase 2–5 e2e and a11y work extends rather than invents.

**Hard scope rule:** No feature work. No new tracking domains. No diet UX changes. No AI behavior changes. The point is to make Phases 2–5 safe, not to do any of their work.

</domain>

<decisions>
## Implementation Decisions

### Coverage thresholds & enforcement (FOUND-01)

- **D-01:** Use **per-pattern coverage thresholds** via Karma's `coverageReporter.check`, not a single global floor or a no-decrease ratchet.
- **D-02:** Pattern floors:
  - `src/app/services/**` and `src/app/shared/**`: **90% statements, 90% lines, 80% branches** (already strong; codifies the bar).
  - `src/app/features/**`: **40% statements, 40% lines** (lifts as Phases 2–5 add component specs).
  - Migration code (`storage.service.ts` migrate functions + `legacy-schemas.ts`): **100% statements** (data-loss risk).
- **D-03:** **Extract `karma.conf.js`** at the repo root; point `angular.json`'s `architect.test.options.karmaConfig` at it; coverage check lives in the new file. FOUND-01 wording is honored verbatim.
- **D-04:** Coverage check fires **only when `--code-coverage` is passed**. CI command becomes `ng test --no-watch --code-coverage`. Plain `ng test` stays fast for development.

### Characterization test style (FOUND-04)

- **D-05:** Primary mechanism is **Karma TestBed DOM specs** — in-process, mounted-component tests that exercise the dominant user flows. Puppeteer is only for the e2e smoke harness in FOUND-05; characterization regression detection lives in Karma.
- **D-06:** Granularity is **key user-flow specs** (~3–6 per page), not full DOM snapshots and not method-output-only. Examples for `diet-page`: "renders day's meals from store", "add-meal flow updates daily totals", "empty state shows when no meals exist".
- **D-07:** Mock data is built **per-spec via factory helpers** (`createValidMeal`, `createValidCardio`, etc.) extending the existing `cardio.service.spec.ts:14-30` pattern. No shared canonical fixture file — locality > deduplication for tests.
- **D-08:** **axe-core a11y assertions are bundled inside characterization specs**. After each render, run `axe.run(fixture.nativeElement)` and fail on any `serious` or `critical` violation. Lands the harness once, used everywhere. FOUND-05's "axe-core per-route a11y scaffolds" is satisfied by this pattern.

### Empty/error state pattern (FOUND-06)

- **D-09:** Two **standalone components**: `<app-empty-state>` and `<app-error-state>`. No mode-switched single component, no structural directive — explicit and readable in templates.
- **D-10:** Inputs/outputs:
  - Both: `[title]: string`, `[message]: string`, action via `<ng-content>`.
  - `<app-error-state>`: also `[error?: Error | string]`, `(retry) = EventEmitter<void>`.
- **D-11:** Error rendering uses **friendly message + collapsed `<details>` with raw error text**. `StorageError.code` (when present) maps to specific copy (e.g., `PARSE_ERROR` → "Stored data couldn't be read"). Power-user inspection still available without leaking ugly default copy.
- **D-12:** Lives in **`src/app/shared/`** (alongside `nav.component.ts`, `date-range.ts`). No new `shared/ui/` sub-tree this phase.
- **D-13:** **Phase 1 retrofits visible empty and error states across all 8 feature pages** (cardio, weight, readings, diet, charts, reports, chat, settings). The cross-app polish for consistency (typography, spacing, action labels) is QUAL-09 in Phase 5 — not Phase 1's concern. Phase 1's job is "the pattern is reachable from every page".

### Schema-migration recovery UX (FOUND-07)

- **D-14:** Backup is written to **LocalStorage under timestamped recovery keys**: `fitness_tracker_data.backup.v{N}.{ISO-timestamp}` (e.g., `fitness_tracker_data.backup.v4.2026-05-02T14-30-12Z`). One key per pre-migration snapshot. Keep last 3 backups; prune older to stay under quota.
- **D-15:** **Migration failure blocks the app with a recovery banner**, not silent fail-open or inline-warning-load-empty. Banner shows the recovery key, the `from→to` versions, and three actions: "Retry migration", "Copy backup JSON to clipboard", "Continue with empty data (your backup stays safe)". Uses `<app-error-state>` from D-09 once that lands. Matches Phase 1 success criterion #4.
- **D-16:** Typed-legacy pattern is **one `LegacyAppDataVN` interface per from-version**, exported from a new `src/app/services/legacy-schemas.ts`. Each `migrateVxToVy()` accepts the concrete `LegacyAppDataVN` shape and returns `LegacyAppDataV{N+1}` (or the current `AppData` for the latest hop). Replaces every `as any` cast at `storage.service.ts:296, 298, 306, 324, 350`.
- **D-17:** Phase 1 ships **fixture-driven tests for every existing migration (V0→V4) plus a malformed-input matrix** per CONCERNS.md "Migration error path not tested". Fixtures live at `src/app/services/migrations/fixtures/v{N}.json` → `v{N+1}-expected.json`. Malformed cases: `null`, `{}`, wrong types, missing required fields. V4→V5 (Phase 3) and V5→V6 (Phase 2) reuse this harness when their migrations land.

### Claude's Discretion
- Specific copy strings for the recovery banner, friendly error messages, and empty-state defaults. Aim for the existing voice (functional, factual, no marketing fluff).
- Internal file/folder names not explicitly chosen above (e.g., test fixture sub-folder layout, axe helper utility name).
- Whether to use Angular's new control-flow blocks (`@if`, `@for`) when retrofitting templates, or stay with `*ngIf`/`*ngFor` — match whatever the surrounding component already uses to minimize diff noise.
- Order of operations within Phase 1 plans (researcher/planner can parallelize freely; only the migration recovery banner depends on the empty/error state pattern landing first).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — milestone scope, key decisions, constraints
- `.planning/REQUIREMENTS.md` — 42 v2 requirements; FOUND-01..07 are this phase's full mandate
- `.planning/ROADMAP.md` §"Phase 1: Foundations" — goal, success criteria, dependencies
- `.planning/STATE.md` §"Decisions Locked In" — schema-migration ordering and other non-negotiables

### Research outputs
- `.planning/research/SUMMARY.md` §"Phase 1: Quality Pass Foundations" — agreed deliverables; §"Critical Pitfalls" #5 (refactoring without tests) and #3 (schema corruption)
- `.planning/research/PITFALLS.md` — the 14 ranked risks; Pitfall 3 (schema corruption) and Pitfall 5 (snapshot enforcement) are most relevant
- `.planning/research/ARCHITECTURE.md` — schema-migration plan, component boundaries, layered shape
- `.planning/research/STACK.md` — net-additive deps (`axe-core` is the only Phase 1 add)

### Codebase analysis
- `.planning/codebase/TESTING.md` — current Karma+Jasmine patterns; coverage currently lives in `angular.json:73-93`; standard service-spec scaffold to extend
- `.planning/codebase/CONCERNS.md` — explicit problem inventory: 6 duplicated `generateUUID` (lines 17–28), `as any` migration casts (lines 9–14), `groupByDay`/`toDateKey` private to charts (lines 76–78), zero feature-component specs (lines 219–227), missing subscription cleanup (lines 44–49), 5 MB storage hardcode (lines 51–55)
- `.planning/codebase/ARCHITECTURE.md` — locked layered shape: UI → Domain services → StorageService → LocalStorage
- `.planning/codebase/CONVENTIONS.md` — strict TS, standalone components, commit format, `crypto.randomUUID()` rule
- `.planning/codebase/STRUCTURE.md` — module/folder layout
- `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md` — existing dependencies and integrations
- `CLAUDE.md` — project instructions; "Storage Layer", "Service Pattern", "Validation Pattern", "Component Pattern" sections constrain new code; "What NOT To Do" section is binding

### External specs (referenced in research, may need re-fetching at implementation time)
- Anthropic memory tool docs — relevant to Phase 3+, not Phase 1; listed for context only
- `axe-core` GitHub README — automatic-rule severity taxonomy used by D-08

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/services/cardio.service.spec.ts:14-30` — canonical service-spec scaffold. New characterization specs extend this pattern (factory helper + spy + TestBed + Arrange/Act/Assert).
- `src/app/services/storage.service.spec.ts:13-26` — in-memory `localStorage` mock pattern for migration fixture tests; reuse for V0→V4 fixture suite.
- `src/app/services/storage.service.spec.ts:213-350` — existing migration test patterns (V0→V1, V1→V3, V2→V3, V3→V4 chat fields). Phase 1's typed-legacy refactor must keep these passing.
- `src/app/shared/date-range.ts` + `date-range.spec.ts` — pure-utility module + spec convention; mirror this for `id.ts`, `group-by-day.ts` (or merged into `date-range.ts`).
- `src/app/services/validators.ts` — pure-validator module pattern; mirror for `legacy-schemas.ts` (type-only) and any new pure helpers.
- `src/app/app.component.spec.ts` — standalone-component bootstrap pattern (`imports: [Component]`, `provideRouter([])`); reuse for feature-page characterization specs.

### Established Patterns
- **Standalone components only**: every new component (`<app-empty-state>`, `<app-error-state>`) goes in `imports: [...]`, never `declarations`.
- **`Observable<T>` returns from services**: characterization specs use `firstValueFrom` or the `done` callback per `TESTING.md` Pattern A/B; either is acceptable.
- **`StorageService` is the single LocalStorage chokepoint** (`storage.service.ts:129-161`). Backup-write logic in D-14 lives here, not in `migrateV*` functions; migration functions stay pure shape transforms.
- **`crypto.randomUUID()` is the prescribed ID source** per `CLAUDE.md` "Data Model Conventions". The 6 `Math.random` copies must be replaced.
- **Hash-based routing** stays — no router changes in Phase 1.
- **Strict TS, no `any` in production paths** — applies to the new typed-legacy interfaces (one of CONCERNS.md's most-flagged issues).

### Integration Points
- **`StorageService.initialize()`** (`storage.service.ts`) is where backup-before-migrate (D-14) and the failure-blocking banner trigger (D-15) wire in. The migration loop currently runs in sequence inside this method; recovery key write happens before the first `migrateVxToVy()` call; failure throws a typed `StorageError` that the UI shell catches and renders the recovery banner from.
- **6 component files** (`cardio.service.ts:24`, `weight.service.ts:24`, `readings.service.ts:38`, `diet.service.ts:26`, `chat.service.ts:13`, `diet-page.component.ts:9-15`) each get one import-line change to consume the new `id.ts` (D-01-area). The component-level `generateUUID` in `diet-page.component.ts` deletes outright; `addMeal` is updated to either receive an externally-generated id or to delegate id assignment to `DietService` (per CONCERNS.md "ID generation leaked into a feature component").
- **`charts-page.component.ts:594-646`** — private `groupByDay`, `toDateKey`, `round2` are extracted to `src/app/shared/` (likely extending `date-range.ts` or a new `chart-grouping.ts`); `report-page.component.ts:472-565` updates to import from the same place. CONCERNS.md flags this as the failure mode that caused commit `b6149d2` and is most likely to regress.
- **All `src/app/features/**/*.component.ts` files** get a `DestroyRef` injection + `takeUntilDestroyed(this.destroyRef)` retrofit. CONCERNS.md confirms zero matches for `OnDestroy`/`ngOnDestroy` today.
- **`angular.json:73-93`** — `architect.test.options.karmaConfig` field is added pointing at the new `karma.conf.js`.
- **`tsconfig.spec.json:7-9`** — no change expected; spec types stay `["jasmine"]`.

</code_context>

<specifics>
## Specific Ideas

- The recovery key naming **must** be timestamped per D-14 (`fitness_tracker_data.backup.v{N}.{ISO}`); single-rolling-backup was explicitly rejected because chained migrations (V3→V4→V5) would lose intermediate snapshots.
- Empty/error state action is projected via `<ng-content>` (D-10), explicitly **not** a `[config]` object input — pages that want richer states ("Add your first meal" + "Open recent foods") need template flexibility.
- axe-core failure threshold is **`serious` or `critical` only** (D-08). Minor/moderate violations don't fail Phase 1 specs; QUAL-08 in Phase 5 does the manual full sweep.
- Fixture path convention is **`src/app/services/migrations/fixtures/v{N}.json`** (D-17). Stable path for Phase 2/3 to drop `v4.json` and `v5.json` next to `v0..v3` without restructuring.

</specifics>

<deferred>
## Deferred Ideas

- **Loading-state component** — discussed implicitly when designing the empty/error pattern but not added to FOUND-06's scope. If the cross-app UX consistency review (QUAL-09, Phase 5) wants one, surface it there.
- **Coverage ratchet (no-decrease) check** — rejected for Phase 1 in favor of fixed per-pattern thresholds. Could be revisited in Phase 5 if per-pattern floors prove too lenient.
- **Backup pruning UI** ("see/delete old recovery keys" in `/settings`) — Phase 1 prunes silently to keep last 3. A user-facing surface for backup management belongs in Phase 5 quality sweep at earliest, more naturally a future "data import/export" milestone.
- **Recovery-key surface for non-failure cases** ("export current state as a backup before I do something risky") — out of scope for Phase 1; belongs to the deferred IO milestone.
- **Loading skeletons for charts/diet** — not raised in this discussion, noted as a perpetual nice-to-have for the cross-app UX consistency review (QUAL-09).
- **Vitest migration** — already explicitly Out of Scope in REQUIREMENTS.md.

</deferred>

---

*Phase: 1-Foundations*
*Context gathered: 2026-05-02*
