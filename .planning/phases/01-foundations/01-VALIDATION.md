---
phase: 1
slug: foundations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `01-RESEARCH.md` §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Karma `~6.4.0` + Jasmine `~5.2.0` (existing) + axe-core `^4.11.4` (new dev dep) + Puppeteer `^24.37.3` (existing, e2e harness) |
| **Config file** | `karma.conf.js` (NEW — extracted at repo root in Wave 1, D-03) |
| **Quick run command** | `ng test --no-watch` |
| **Full suite command** | `ng test --no-watch --code-coverage` (triggers `coverageReporter.check` per D-04) |
| **E2E command** | `npm run e2e` (Puppeteer + axe-core, two-terminal — `ng serve` separately) |
| **Estimated runtime** | ~30s for `ng test --no-watch` after all Phase 1 specs land; +~10s with coverage; e2e ~60s |

---

## Sampling Rate

- **After every task commit:** Run `ng test --no-watch` (skips coverage threshold; ~< 30s)
- **After every plan wave:** Run `ng test --no-watch --code-coverage` and `ng build --configuration=production`
- **Phase gate (before `/gsd-verify-work`):** Both above PLUS `npm run e2e` (smoke + a11y) must be green
- **Max feedback latency:** ~30s per task, ~90s per wave

---

## Per-Task Verification Map

> Populated by `gsd-planner` during planning. Each task's `<acceptance_criteria>` must include either a `ng test --include='<spec>'` command, a grep gate, or a build assertion. Rows below are anchored to the **requirement-level** test surface from `01-RESEARCH.md`; tasks slot into them.

| Req ID | Behavior | Test Type | Automated Command | Wave 0 Gap | Status |
|--------|----------|-----------|-------------------|-----------|--------|
| FOUND-01 | `--code-coverage` fails when services drop below 90% statements | unit (config) | `ng test --no-watch --code-coverage` | ❌ `karma.conf.js` | ⬜ pending |
| FOUND-01 | `ng test --no-watch` (no coverage) does NOT fail on threshold | unit (config) | `ng test --no-watch` (exits 0 even with low coverage) | ❌ Wave 0 | ⬜ pending |
| FOUND-02 | `generateId()` returns UUID-shaped string in both `crypto.randomUUID` available + fallback paths | unit | `ng test --include='**/id.spec.ts'` | ❌ `src/app/shared/id.spec.ts` | ⬜ pending |
| FOUND-02 | All 6 services + diet-page produce IDs from `generateId()` (no remaining `Math.random` UUIDs) | static | `! grep -rnE 'Math\.random\(\)' src/app --include='*.ts'` | ❌ Wave 0 | ⬜ pending |
| FOUND-02 | `groupByDay`/`toDateKey`/`round2` produce stable keys + averaged values (regression for `b6149d2`) | unit | `ng test --include='**/chart-grouping.spec.ts'` | ❌ Wave 0 | ⬜ pending |
| FOUND-03 | Subscribing-then-destroying a feature page does not leak the subscription | unit (component) | `ng test --include='**/<page>.component.spec.ts'` for each of 8 pages | ❌ 8 page specs | ⬜ pending |
| FOUND-04 | `diet-page` renders day's meals from store (characterization) | unit (component) | `ng test --include='**/diet-page.component.spec.ts'` | ❌ Wave 0 | ⬜ pending |
| FOUND-04 | `chat-page` renders conversation list + active conversation | unit (component) | `ng test --include='**/chat-page.component.spec.ts'` | ❌ Wave 0 | ⬜ pending |
| FOUND-04 | `charts-page` renders chart with grouped data | unit (component) | `ng test --include='**/charts-page.component.spec.ts'` | ❌ Wave 0 | ⬜ pending |
| FOUND-04 | `report-page` renders printable view with date range | unit (component) | `ng test --include='**/report-page.component.spec.ts'` | ❌ Wave 0 | ⬜ pending |
| FOUND-04 / FOUND-05 | Each characterization spec runs `axe.run(fixture.nativeElement)` and asserts no `serious|critical` violations | unit (component) | Embedded in FOUND-04 specs via `expectNoSeriousA11yViolations(root)` | ❌ `a11y-test-helpers.ts` | ⬜ pending |
| FOUND-05 | Puppeteer smoke navigates 8 routes (`/cardio`, `/weight`, `/readings`, `/diet`, `/charts`, `/report`, `/chat`, `/settings`) without console errors | e2e | `npm run e2e` (with `ng serve` running) | ❌ `e2e/smoke.spec.mjs` | ⬜ pending |
| FOUND-05 | axe-core injected per route returns no `serious|critical` violations | e2e | `npm run e2e` (a11y spec part of harness) | ❌ `e2e/a11y.spec.mjs` | ⬜ pending |
| FOUND-06 | `<app-empty-state>` renders title + ng-content action | unit (component) | `ng test --include='**/empty-state.component.spec.ts'` | ❌ Wave 0 | ⬜ pending |
| FOUND-06 | `<app-error-state>` maps `StorageError.code === 'PARSE_ERROR'` to "Stored data couldn't be read" + emits `(retry)` | unit (component) | `ng test --include='**/error-state.component.spec.ts'` | ❌ Wave 0 | ⬜ pending |
| FOUND-06 | All 8 pages reference at least one of the new components | static + unit | `for f in src/app/features/**/*.component.ts; do grep -l 'app-empty-state\|app-error-state' $f; done \| wc -l` ≥ 8 | ❌ Wave 0 | ⬜ pending |
| FOUND-07 | Backup key written to `fitness_tracker_data.backup.v{N}.{ISO}` before every migration run | unit | `ng test --include='**/storage.service.spec.ts'` (new `describe('backup-before-migrate')`) | partial — extends existing spec | ⬜ pending |
| FOUND-07 | Migration `as any` casts replaced — TS strict catches typos | unit (compile) | `ng build --configuration=production` succeeds AND `! grep -nE '\bas any\b' src/app/services/storage.service.ts` | partial — verify after refactor | ⬜ pending |
| FOUND-07 | V0→V4 migrations produce expected fixture shapes | unit | `ng test --include='**/storage.service.migration-fixtures.spec.ts'` | ❌ Wave 0 | ⬜ pending |
| FOUND-07 | Migration failure throws `StorageError('MIGRATION_FAILED')` carrying recovery key | unit | Spec corrupts fixture in `localStorageMock`; asserts error `code` + recovery key string | ❌ Wave 0 | ⬜ pending |
| FOUND-07 | Malformed input matrix (`null`, `{}`, wrong types, missing fields) does not silently corrupt data | unit | `describe('malformed-input matrix', ...)` with 4+ fixture cases | ❌ Wave 0 | ⬜ pending |
| FOUND-07 | Backups beyond last 3 are pruned | unit | Spec pre-seeds 4 backup keys with sortable timestamps; asserts oldest is removed after migration | ❌ Wave 0 | ⬜ pending |
| FOUND-07 | Recovery banner renders on migration failure with key visible + 3 actions (Retry / Copy / Continue empty) | unit (component) | `ng test --include='**/recovery-banner.component.spec.ts'` and `app.component.spec.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Files/folders that must exist (or scaffolds installed) before Wave 1 implementation work begins. Sourced from `01-RESEARCH.md` §"Wave 0 Gaps". Total: 13 entries.

- [ ] `karma.conf.js` (repo root) — covers FOUND-01 (config-level)
- [ ] `src/app/shared/id.ts` + `id.spec.ts` — covers FOUND-02 (UUID consolidation)
- [ ] `src/app/shared/chart-grouping.ts` + `chart-grouping.spec.ts` — covers FOUND-02 (grouping extraction)
- [ ] `src/app/shared/a11y-test-helpers.ts` — covers FOUND-04 / FOUND-05 (axe-in-spec helper)
- [ ] `src/app/shared/empty-state.component.ts` + spec — covers FOUND-06
- [ ] `src/app/shared/error-state.component.ts` + spec — covers FOUND-06
- [ ] `src/app/shared/recovery-banner.component.ts` + spec — covers FOUND-07 (thin wrapper around `<app-error-state>`)
- [ ] `src/app/services/legacy-schemas.ts` — covers FOUND-07 (typed legacy interfaces, replaces `as any`)
- [ ] `src/app/services/migrations/fixtures/v0.json` … `v3.json` + `v1-expected.json` … `v4-expected.json` — covers FOUND-07 (fixture-driven migration tests)
- [ ] `src/app/services/migrations/fixtures/malformed/{null,empty-object,wrong-types,missing-fields}.json` — covers FOUND-07 (malformed-input matrix)
- [ ] `src/app/services/storage.service.migration-fixtures.spec.ts` — wires fixtures into Karma
- [ ] `src/app/features/{diet,chat,charts,reports}/<page>.component.spec.ts` — covers FOUND-04 (4 characterization specs)
- [ ] `e2e/run.mjs`, `e2e/smoke.spec.mjs`, `e2e/a11y.spec.mjs`, `e2e/README.md`, `e2e/fixtures/seed-data.json` — covers FOUND-05 (Puppeteer + axe-core scaffolds)
- [ ] `npm install -D axe-core@^4` — only net-additive dep (Karma + Jasmine + Puppeteer already installed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recovery banner copy actually fires the OS clipboard | FOUND-07 | `navigator.clipboard.writeText` requires user-gesture context that Karma cannot fully simulate; spec covers the call site, manual confirms OS-level paste works | Trigger migration failure (corrupt LocalStorage), click "Copy backup JSON", paste into a text editor, verify JSON matches the recovery key value |
| Subscription leak verified in Angular DevTools | FOUND-03 | `takeUntilDestroyed` retrofit is enforced in spec via fixture.destroy() but DevTools timeline gives the human-confirmable signal | Open DevTools → Profiler → record a navigation between two feature pages → confirm no retained subscriptions to `*Service` observables |
| `--code-coverage` produces a readable HTML report at `coverage/html/index.html` | FOUND-01 | The CI gate is the threshold; the HTML report is operator-facing only | Run `ng test --no-watch --code-coverage`, open `coverage/html/index.html`, sanity-check that `src/app/services/storage.service.ts` shows ≥ 90% lines |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references in the per-task map above
- [ ] No watch-mode flags (every command uses `--no-watch`)
- [ ] Feedback latency < 30s per task, < 90s per wave
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
