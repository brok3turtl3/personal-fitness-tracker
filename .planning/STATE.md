---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-02T20:17:58.779Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 10
  completed_plans: 8
  percent: 80
---

# State: Personal Fitness Tracker — Refinement Milestone (v2)

**Last Updated:** 2026-05-02 (Phase 1 plan 01-07 complete — empty/error retrofit + subscription hygiene across all 8 feature pages; 40 .subscribe sites now pipe through takeUntilDestroyed(this.destroyRef); 8/8 pages render <app-empty-state>/<app-error-state>; storage failures now visible in UI (CONCERNS.md "Console-only error reporting" closed); Wave 3 plan 07 done, plan 10 still pending; FOUND-03 + FOUND-06 marked complete)

---

## Project Reference

**Core Value:** A trustworthy personal health record paired with a knowledgeable AI coach that can see all of it — so the user can both log faithfully and get sharp, evidence-graded guidance, with nothing leaving the machine except the AI request itself.

**Milestone:** Refinement (v2) — diet UX overhaul + AI chat depth + full quality pass on the existing Angular 18 + Electron app at v1.2.3.

**Current Focus:** Phase 1 — Foundations. Test scaffolding, shared utilities, subscription hygiene, and schema-migration discipline must land before any feature refactor touches the 900-line `diet-page` or the chat surface.

---

## Current Position

**Phase:** 1 — Foundations
**Plan:** 10 plans across 4 waves; Plans 01-01, 01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-09 complete (Waves 1 + 2 done; Wave 3 partial — plan 10 remaining)
**Status:** Executing (Wave 3 — plan 10 recovery banner remaining; Wave 4 plan 08 characterization specs after)
**Resume file:** `.planning/phases/01-foundations/01-10-PLAN.md` (Wave 3's second plan — recovery banner + AppComponent integration; closes FOUND-07)
**Progress:** [████████░░] 80%

**Wave structure:**

- Wave 1: Plans 01, 02, 03, 04 (no dependencies — Karma config, shared utilities, empty/error components, typed schemas + fixtures)
- Wave 2: Plans 05, 06, 09 (e2e harness, utility consumers, storage refactor)
- Wave 3: Plans 07, 10 (page retrofit, recovery banner)
- Wave 4: Plan 08 (characterization specs — depends on retrofitted pages)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 5 |
| Phases completed | 0 |
| Requirements mapped | 42/42 |
| Requirements completed | 4/42 (FOUND-01, FOUND-02, FOUND-03, FOUND-06) |
| Plans drafted | 10 |
| Plans completed | 8 |
| Verifier passes | 0 |
| Plan-checker iterations | 3 (PASS on iteration 3) |

### Plan Execution Log

| Plan | Name | Duration | Tasks | Files | Commits | Completed |
|------|------|----------|-------|-------|---------|-----------|
| 01-01 | Coverage config + axe-core install + tsconfig.spec patch | 3m 13s | 3/3 | 4 | a638189, e56e818, aef83cb | 2026-05-02 |
| 01-02 | Shared utilities create: id.ts, chart-grouping.ts, a11y-test-helpers.ts | 3m 38s | 3/3 | 5 | fd0a850, 9bc9680, 7190fba | 2026-05-02 |
| 01-03 | Empty-state + error-state standalone components in src/app/shared/ | ~5m | 2/2 | 4 | c9c12b2, 2227b9f, 99f3d8b, b28b39f | 2026-05-02 |
| 01-04 | Typed legacy schemas + V0..V3 fixtures + malformed-input matrix | ~8m | 3/3 | 13 | 694b914, afa9eee, cb2e002 | 2026-05-02 |
| 01-05 | Puppeteer + axe-core e2e harness scaffold | ~2m | 3/3 | 5 (+1 mod) | 2dcd7d6, e1edd59, 2ea790a | 2026-05-02 |
| 01-06 | id.ts + chart-grouping consumer retrofit (5 services + 3 feature pages) | 6m 37s | 3/3 | 8 (modified) | a8b752a, 6801180, cc64149 | 2026-05-02 |
| 01-09 | Storage migration refactor: typed chain + backup-before-migrate + fixture-driven spec | ~14m | 3/3 | 3 (1 created, 2 modified) | c0fce5a, 512afb5, c11904c | 2026-05-02 |
| 01-07 | Empty/error retrofit + takeUntilDestroyed across all 8 feature pages | 9m 17s | 3/3 | 8 (modified) | 84c76c7, f1bda40 | 2026-05-02 |

---

## Accumulated Context

### Decisions Locked In (from PROJECT.md, REQUIREMENTS.md, research)

- **No clinical disclaimers on AI output.** Source attribution + per-claim confidence labels (`strong | moderate | weak | animal-only | anecdotal | speculative`) is the chosen mechanism. Low-confidence states must be visually distinct (color + icon, not just text).
- **Free-generated citations are never rendered as links.** Only API-structured citations (`web_search_result_location`, `search_result` blocks) become hyperlinks. This bounds the hallucinated-citation risk identified in Pitfall 1 (14–95% fabrication rates across LLMs).
- **Anthropic-native tool use, not RAG/embeddings.** Single user with bounded structured data; client tools over typed services beat a vector DB.
- **Memory uses the official `memory_20250818` tool**, backed by `AppData.memoryFiles: Record<string, string>` with `/memories` path-prefix validation.
- **`UserProfile` is separate from `memoryFiles`.** Profile is structured, user-edited, in `/settings`. Memory is the AI's free-form notebook.
- **LocalStorage stays.** No IndexedDB this milestone. Quota detection + chat archival in Phase 5 is the relief valve.
- **Karma + Jasmine stay.** No Vitest migration this milestone (cost not justified for 12 specs).
- **Schema migration ordering is non-negotiable: V4→V5 (AI fields, including `ChatMessage.blocks`) MUST land before V5→V6 (diet fields).** Both ride on FOUND-07's typed-legacy interfaces + backup-before-migrate discipline.
- **Phases 2 and 3 are file-disjoint and parallelizable.** If run in parallel, V4→V5 must merge to main before the V5→V6 work targets the V5 baseline.
- **Pattern 2 Form A is the codebase-wide subscription-cleanup pattern.** Every feature component declares `private destroyRef = inject(DestroyRef)` as a field initializer and pipes every `.subscribe(...)` through `takeUntilDestroyed(this.destroyRef)`. Bare `takeUntilDestroyed()` (no arg) inside method bodies is forbidden — it triggers NG0203 at runtime (Pitfall 1).
- **Settings page is error-state-only.** No `<app-empty-state>` — settings is a configuration form, not a data list (RESEARCH §Open Q 2).
- **Phase 1 chat-page nested subscribes are preserved with takeUntilDestroyed only.** No switchMap refactor in Phase 1 — that's deferred to Phase 3 per CONTEXT.md.

### Active Decisions Pending

- **`memory_20250818` canonical return strings**: confirm against current Anthropic docs at Phase 3 implementation time.
- **Prompt-caching min-size at runtime**: Haiku 4.5 needs 4,096 tokens minimum — validate that `FitnessContextService`'s slim header reaches it under typical conditions.
- **`web_search_20250305` vs `web_search_20260209`**: Phase 5 planning decision based on which model the user runs.
- **Chat archival UX**: per-conversation keys vs lazy-loaded archive — Phase 5 design decision.
- **Confirm-before-write UX for memory writes**: inline banner vs toast vs pending indicator — Phase 3 or Phase 4 planning decision.

### Open Todos

- Wave 1 of Phase 1 is **complete** (4/4 plans). Wave 2 of Phase 1 is **complete** (3/3 plans: 05 + 06 + 09). Wave 3 is **partial** — plan 07 done, plan 10 (recovery banner + AppComponent integration) remaining. Wave 4 (plan 08 characterization specs) follows after plan 10.
- Plan 01-07 landed empty/error retrofit + subscription hygiene across all 8 feature pages: every `.subscribe(...)` (40 sites total) now pipes through `takeUntilDestroyed(this.destroyRef)`; every page declares `private destroyRef = inject(DestroyRef)` as a field; 7 list/data pages render BOTH `<app-empty-state>` AND `<app-error-state>`; settings has `<app-error-state>` only (RESEARCH §Open Q 2). Storage failures are now visible to the user (CONCERNS.md "Console-only error reporting" CLOSED). 236/236 Karma SUCCESS; production build green. **FOUND-03 + FOUND-06 marked complete in REQUIREMENTS.md.** No deviations except chat-page subscribe count was 9, not the plan-estimated 7 — all 9 received takeUntilDestroyed.
- Plan 01-09 landed the storage.service.ts typed migrate chain (5 `as any` casts eliminated; zero `any` keyword in storage.service.ts), backup-before-migrate flow (`fitness_tracker_data.backup.v{N}.{ISO}`), pruneOldBackups (strict prefix filter, keeps newest 3), and `StorageError(MIGRATION_FAILED)` carrying the recovery key in its message. New fixture-driven spec at `storage.service.migration-fixtures.spec.ts` covers V0..V3 chain (5 specs) + 4-case malformed-input matrix (null, empty object, wrong-type savedFoods, missing required fields). storage.service.spec.ts extended with 3 new describe blocks (8 scenarios). Full Karma suite: **236 SUCCESS** (was 219; +17). Production build: exit 0. FOUND-07 NOT yet marked complete — recovery banner UX (plan 10) is the remaining gate.
- Plan 01-05 landed the Puppeteer + axe-core e2e harness scaffold: `e2e/run.mjs` (entrypoint with `headless: 'new'` + WSL2-safe args), `e2e/smoke.spec.mjs` (8-route navigation + pageerror/console.error gate), `e2e/a11y.spec.mjs` (axe-core injection via `page.addScriptTag` + D-08 severity gate `serious|critical`), `e2e/fixtures/seed-data.json` (minimal AppData seed schemaVersion=4), `e2e/README.md` (two-terminal flow operator manual), and one `package.json` script entry `"e2e": "node e2e/run.mjs"`. No new deps; no app code touched. `npm run e2e` is wired but not executed by the executor (requires `ng serve` in another terminal — operator verifies after the rest of Phase 1 lands).
- Plan 01-04 landed `src/app/services/legacy-schemas.ts` (5 type-only interfaces: `LegacyAppDataV0..V3` + `LegacySavedFoodV2`) and 12 JSON fixtures under `src/app/services/migrations/fixtures/` (4 input v0..v3, 4 expected v1..v4, 4 malformed: null, empty-object, wrong-types, missing-fields). `storage.service.ts` is unchanged — Wave 2 plan 09 will refactor it to consume the typed shapes and ship the fixture-driven spec.
- Plan 01-03 landed `<app-empty-state>` and `<app-error-state>` standalone components in `src/app/shared/` plus 16 specs (5 + 11). Both components export from `src/app/shared/`, are TDD-built (RED test commit + GREEN feat commit per task), and consume `StorageError` from `services/storage.service.ts` for the friendlyMessage switch on all 5 `StorageErrorCode` values. No feature page modified — Wave 2 plan 07 will retrofit all 8 pages.
- FOUND-06 is **complete** as of plan 01-07 — `<app-empty-state>` / `<app-error-state>` are now consumed across all 8 feature pages. Marked [x] in REQUIREMENTS.md.
- FOUND-03 is **complete** as of plan 01-07 — every feature component subscribing to RxJS observables now pipes through `takeUntilDestroyed(this.destroyRef)` per Pattern 2 Form A. Zero subscription leaks across 8 pages. Marked [x] in REQUIREMENTS.md.
- FOUND-07 is NOT yet marked complete in REQUIREMENTS.md — typed legacy schemas + fixtures landed (plan 01-04) AND `storage.service.ts` refactor with fixture-driven spec landed (plan 01-09). Only Wave 3 plan 10's recovery banner UX remains. FOUND-07 flips to [x] when plan 10 lands.
- FOUND-02 is **complete** as of plan 01-06 — id.ts + chart-grouping shared utilities now have all consumers retrofitted (5 services + 3 feature pages). 6 generateUUID copies + 6 chart-grouping copies deleted; both shared modules now have multiple in-tree importers. Marked [x] in REQUIREMENTS.md.
- FOUND-04, FOUND-05 are NOT yet marked complete in REQUIREMENTS.md — they require characterization specs (plan 08) to land first. FOUND-05 specifically: e2e a11y harness (plan 05 — done) + Karma a11y in characterization specs (plan 08 — pending).

### Recent Sessions

- **2026-05-02T19:05Z–19:08Z** — Executed plan 01-01. 3 commits on `gsd/phase-1-foundations`. Smoke-verified `ng test` (190 SUCCESS, exit 0) and `ng test --code-coverage` (190 SUCCESS + 27 threshold warnings, exit 1; expected). `ng build --configuration=production` exit 0. No deviations from plan.
- **2026-05-02T19:12Z–19:16Z** — Executed plan 01-02. 3 commits on `gsd/phase-1-foundations` (fd0a850, 9bc9680, 7190fba). Created 5 new files in `src/app/shared/`. `ng test --no-watch --browsers=ChromeHeadless` (full suite): **203 of 203 SUCCESS** (190 pre-existing + 13 new), exit 0. `ng build --configuration=production`: exit 0. No deviations. Threat-model compliance: T-02-01 accept disposition documented in JSDoc, T-02-02 b6149d2 regression spec present, T-02-03 zero production importers of a11y-test-helpers.
- **2026-05-02T19:18Z–19:23Z** — Executed plan 01-03 TDD. 4 commits on `gsd/phase-1-foundations` (c9c12b2 test, 2227b9f feat, 99f3d8b test, b28b39f feat). Created 4 new files in `src/app/shared/`: `empty-state.component.ts` + spec, `error-state.component.ts` + spec. Targeted spec runs: 5/5 (empty) + 11/11 (error) = **16/16 SUCCESS**. `ng build --configuration=production`: exit 0. No deviations. Threat-model compliance: T-03-01 (raw error rendered inside `<details open=false>` asserted), T-03-02 (all 5 `StorageErrorCode` cases tested + fail-soft fallback), T-03-03 (severity-tiered ARIA: empty=role=status+aria-live=polite, error=role=alert+aria-live=assertive, both asserted).
- **2026-05-02T19:24Z–19:30Z** — Executed plan 01-04. 3 commits on `gsd/phase-1-foundations` (694b914 feat, afa9eee test, cb2e002 test). Created 13 new files: `src/app/services/legacy-schemas.ts` (95 lines, 5 type-only interfaces) + 12 JSON fixtures under `src/app/services/migrations/fixtures/` (8 standard + 4 malformed). `ng build --configuration=production`: exit 0 (verified twice — after Task 1 and after Task 3). All 12 fixture JSON files smoke-validated via `node -e "JSON.parse(...)"`. `storage.service.ts` unchanged (Wave 2 plan 09's job). No deviations. Threat-model compliance: T-04-01 (zero `\bany\b` outside JSDoc), T-04-02 (all 4 malformed-input fixtures present + JSON-valid), T-04-03 (hand-built fixtures at canonical D-17 path, version-controlled). Wave 1 of Phase 1 now complete.
- **2026-05-02T19:40Z–19:47Z** — Executed plan 01-06. 3 commits on `gsd/phase-1-foundations` (a8b752a refactor, 6801180 refactor, cc64149 refactor). Modified 8 files: 5 services + 3 feature pages. Deleted 6 file-private `generateUUID` copies (~70 lines) and 6 file-private chart-grouping helpers (~96 lines). Service spec targeted run: 99/99 SUCCESS (Task 1). Diet service spec: 7/7 SUCCESS (Task 2). Full suite regression gate: **219/219 SUCCESS** (Task 3). `ng build --configuration=production`: exit 0 after each task. Defensive grep gates green: zero `Math.random()` in services + diet-page; zero private chart-grouping functions in charts/reports pages. One architectural decision in Task 2: diet-page UI tracking IDs were not entity IDs (transient `pendingItems` array, stripped before service call) — eliminated need for IDs entirely by switching `@for(...; track it.id)` → `track $index` and `removePendingItem(id: string)` → `removePendingItem(index: number)`. CONCERNS.md "ID generation leaked into a feature component" closed; CLAUDE.md "Component Pattern" violation closed. **FOUND-02 marked complete in REQUIREMENTS.md.** No deviations from plan. Threat-model compliance: T-06-01 (no `Math.random()` UUIDs anywhere), T-06-02 (single shared chart-grouping module — drift impossible), T-06-03 (zero `generateUUID|generateId` references in `diet-page.component.ts`).
- **2026-05-02T19:50Z–20:00Z** — Executed plan 01-09. 3 commits on `gsd/phase-1-foundations` (c0fce5a refactor, 512afb5 feat, c11904c test). Modified 2 files (storage.service.ts, storage.service.spec.ts) + created 1 file (storage.service.migration-fixtures.spec.ts). Task 1: typed migrate chain — imported LegacyAppDataV0..V3 + LegacySavedFoodV2; refactored migrateData() to stepwise typed locals; 4 typed migrateVxToVy signatures; migrateSavedFoodV2ToV3 returns SavedFood with conditional fdcId spread; **zero `any` keyword in storage.service.ts**. Task 2: BACKUP_KEY_PREFIX + MAX_BACKUPS_TO_KEEP=3 static class members; initialize() now writes pre-migration backup, runs prune-then-migrate inside try/catch, throws StorageError(MIGRATION_FAILED) with recovery key in message; writeBackup is best-effort (Pitfall 4); pruneOldBackups filters strictly on BACKUP_KEY_PREFIX (T-09-02 security gate); spec extended with 3 new describe blocks covering 8 scenarios. Task 3: new fixture-driven spec covers V0..V3 chain (5 specs incl. backup-key regex assertion) + 4-case malformed-input matrix (null, empty object, wrong-type, missing fields) — D-17 "either init clean OR throw MIGRATION_FAILED, never silently corrupt". Full Karma suite: **236/236 SUCCESS** (was 219, +17). `ng build --configuration=production`: exit 0 (verified after each task). No deviations from plan. Threat-model compliance: T-09-01 (typed legacy data — zero `any`), T-09-02 (prune never deletes STORAGE_KEY — spec verified), T-09-03 (failure throws MIGRATION_FAILED with recovery key on disk), T-09-04 (backup write best-effort accept), T-09-05 (Phase 2/3 future migrations land on this typed-legacy harness). FOUND-07 NOT yet marked complete — plan 10's recovery banner is the remaining gate. Wave 2 of Phase 1 now complete.
- **2026-05-02T20:06Z–20:15Z** — Executed plan 01-07. 2 commits on `gsd/phase-1-foundations` (84c76c7 refactor, f1bda40 refactor). Modified 8 feature page components: cardio (4 subscribes), weight (4), readings (6), diet (8), charts (2), reports (3), chat (9 — incl. 3 nested), settings (4) — total 40 `.subscribe(...)` sites all now piped through `takeUntilDestroyed(this.destroyRef)`. All 8 pages render `<app-empty-state>` and/or `<app-error-state>`; settings is error-only (RESEARCH §Open Q 2). 5 cross-page invariant gates PASS: (1) every component with `.subscribe(` has `inject(DestroyRef)` + `takeUntilDestroyed(this.destroyRef)`, (2) all 8 pages reference empty/error-state, (3) zero bare `takeUntilDestroyed()` in method bodies (Pitfall 1 absent), (4) zero `OnDestroy` interface introductions, (5) production build exits 0. Full Karma suite **236/236 SUCCESS** at every commit; `ng build --configuration=production` exit 0 after each task. **FOUND-03 + FOUND-06 marked complete.** One deviation [Rule 2]: chat-page subscribe count was 9 not plan-documented 7 — all 9 sites got takeUntilDestroyed. No business-logic change; no nested-subscribe refactor; no `OnDestroy` introduced. Threat-model compliance: T-07-01 (subscription leak — 40/40 paired), T-07-02 (silent storage failures — visible UI surface across all 8 pages), T-07-03 (NG0203 — Pattern 2 Form A enforced).
- **2026-05-02T19:33Z–19:35Z** — Executed plan 01-05. 3 commits on `gsd/phase-1-foundations` (2dcd7d6 feat, e1edd59 feat, 2ea790a chore). Created 5 new files in `e2e/` (run.mjs, smoke.spec.mjs, a11y.spec.mjs, fixtures/seed-data.json, README.md) + 1 modified file (package.json — single script entry). All 3 `.mjs` files pass `node --check`. Seed JSON valid (schemaVersion=4, 1 cardio + 1 weight). 8 routes covered in BOTH spec files; D-08 severity gate (serious|critical) wired in a11y spec. No `concurrently`/`wait-on` deps introduced (RESEARCH §line 1243 — two-terminal flow). No deviations. Threat-model compliance: T-05-01 (`page.goto` 15s timeout + try/catch in run.mjs), T-05-02 (`require.resolve('axe-core/axe.min.js')` against locked devDep — no remote URL), T-05-03 (two-terminal dev-only `ng serve` isolated to localhost:4200). `npm run e2e` not executed by the executor (requires `ng serve` in another terminal — operator manual verify after Phase 1 retrofit lands).

### Blockers

None.

### Notable Files Already Mapped

- `.planning/PROJECT.md` — milestone scope, key decisions
- `.planning/REQUIREMENTS.md` — 42 v2 requirements with traceability
- `.planning/research/SUMMARY.md` — synthesized research, 5-phase build order
- `.planning/research/ARCHITECTURE.md` — schema-migration plan, component boundaries
- `.planning/research/STACK.md` — net-additive deps (`@anthropic-ai/sdk`, `convert`, `axe-core`)
- `.planning/research/PITFALLS.md` — 14 critical risks with phase mapping
- `.planning/research/FEATURES.md` — feature categories, dependencies, MVP definition
- `.planning/codebase/ARCHITECTURE.md` — existing layered architecture (locked)
- `.planning/codebase/CONCERNS.md` — flagged tech debt, bugs, scaling risks

---

## Session Continuity

**Where to resume:** Phase 1 plan 01-10 (`.planning/phases/01-foundations/01-10-PLAN.md` — recovery banner + AppComponent integration; closes FOUND-07). After plan 10, Wave 4 plan 08 (characterization specs) closes FOUND-04 + FOUND-05.

**Critical context to remember next session:**

1. Roadmap is final and signed off — 5 phases, 42/42 requirements covered.
2. Phase 1 (Foundations) is gating: characterization tests for `diet-page` / `chat-page` / `charts-page` / `reports-page` MUST land before Phase 2 or Phase 3 touches those components.
3. Schema-migration ordering: V4→V5 (Phase 3) before V5→V6 (Phase 2) when both are merged. Both ride on FOUND-07.
4. Phases 2 and 3 are parallelizable. Mode is `yolo` and `parallelization=true`.
5. UI hints set on Phases 2, 3, 4, 5. AI hints set on Phases 3, 4, 5. Downstream `/gsd-ui-phase` and `/gsd-ai-integration-phase` should engage on those phases.

---

*State initialized: 2026-05-02*
