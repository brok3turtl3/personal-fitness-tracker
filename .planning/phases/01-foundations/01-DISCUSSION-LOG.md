# Phase 1: Foundations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 1-Foundations
**Areas discussed:** Coverage thresholds & enforcement, Characterization test style, Empty/error state pattern, Schema-migration recovery UX

---

## Coverage thresholds & enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Per-pattern thresholds (Recommended) | Different floors by file pattern: services/validators ~90% (already strong), shared utilities 100%, components looser (40–60%) to reflect reality. Karma's coverageReporter.check supports this via include/exclude globs. | ✓ |
| Single global floor | One number applied everywhere (e.g., 70% lines). Simple to configure but penalizes the strong service coverage and is unrealistic for the untested feature components. | |
| Ratchet (no-decrease) only | No fixed floor. Just compare against last commit's coverage and fail if it drops. Forces continual improvement but needs CI plumbing to track baseline (extra moving part). | |

**User's choice:** Per-pattern thresholds (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Strict on logic, lenient on UI (Recommended) | services/validators/shared 90% statements/lines, 80% branches; features/** 40% statements/lines (lifts as Phase 2–5 add component specs); migrations 100% statements (data-loss risk). | ✓ |
| Match current state, ratchet up later | Set thresholds to current measured numbers exactly, then bump in each phase as coverage improves. Safer for landing CI now; risks settling at "good enough." | |
| Aspirational (90% everywhere) | One ambitious bar. Realistic only if Phase 1 also writes specs for every feature page — turns FOUND-04 from characterization scaffolding into full test coverage. | |

**User's choice:** Strict on logic, lenient on UI (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Extract karma.conf.js (Recommended) | Generate a karma.conf.js, point angular.json's karmaConfig to it, then add coverageReporter.check there. Matches FOUND-01 wording, keeps angular.json clean, gives one obvious place for test infra. | ✓ |
| Keep config in angular.json | Stay with the declarative angular.json setup; add coverage thresholds via the karmaConfig override path inline. Minimal churn. FOUND-01 wording would need a tiny relaxation. | |

**User's choice:** Extract karma.conf.js (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Only with --code-coverage (Recommended) | Threshold check runs in CI command (ng test --no-watch --code-coverage) and any explicit local coverage run. Day-to-day ng test stays fast. Matches Karma's natural behavior. | ✓ |
| Every CI run, including non-coverage | Force coverage on by default in CI. Adds ~10–20% to test time but guarantees the check never gets bypassed. Probably overkill for a single-dev app with manual CI invocations. | |

**User's choice:** Only with --code-coverage (Recommended)

**Notes:** TESTING.md confirms current coverage config lives in angular.json:73-93, not a separate karma.conf.js — extraction is a positive net change.

---

## Characterization test style

| Option | Description | Selected |
|--------|-------------|----------|
| Karma TestBed DOM specs (Recommended) | In-process component specs that mount the page (TestBed.createComponent), seed mock services, exercise key flows, and assert on DOM (querySelector text/class). Fast, debuggable, lives next to source. Matches existing app.component.spec pattern. | ✓ |
| Puppeteer-driven flow tests | Real-browser tests that open the dev server and click through the page. Catches CSS/layout regressions (the chat-layout fixes from recent history). Slower, separate harness, but FOUND-05 is wiring Puppeteer anyway. | |
| Both — TestBed for behavior + Puppeteer smoke for layout | TestBed specs cover state/render logic; one Puppeteer smoke per page covers "renders without crashing + nav links work." Twice the surface but each layer catches a different failure mode. | |

**User's choice:** Karma TestBed DOM specs (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Key user-flow specs (Recommended) | Per page, ~3–6 specs covering the dominant flows: e.g., diet-page = "add meal renders new row", "daily totals update", "empty-state visible when no foods". Behavior-level, refactor-resilient. | ✓ |
| Full DOM snapshots | Render the page with seeded data and snapshot the full DOM. Catches any visual diff but creates churn on every legitimate template change — noisy. Generally an anti-pattern in component testing. | |
| Public method/output checks only | Test only component public methods + emitted outputs, skip DOM querying. Fast but won't catch template regressions — misses the failure mode FOUND-04 exists to prevent. | |

**User's choice:** Key user-flow specs (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-spec fixtures + factories (Recommended) | Each spec builds the AppData it needs via factory helpers (createValidCardio etc., extending the existing pattern from cardio.service.spec.ts). Locality — each test is readable on its own. | ✓ |
| Shared fixture file under src/testing/ | One canonical "realistic AppData" JSON loaded by every characterization spec. Less duplication; coupling — changing the fixture ripples to many specs and fixture drift becomes its own bug. | |
| Both: shared baseline + per-spec overrides | Shared minimal baseline (e.g., 1 cardio + 1 weight + 1 reading + 1 saved food + 1 meal) with per-spec deltas. Adds setup discipline but mirrors how many real-world test suites grow. | |

**User's choice:** Per-spec fixtures + factories (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled into characterization specs (Recommended) | Each component spec runs an axe scan after render and asserts no serious/critical violations. Single fail-fast loop. axe-core (FOUND-05 dep) lands once, used everywhere. Per-route a11y is FOUND-05's whole point. | ✓ |
| Separate axe-only spec files per page | axe-page.spec.ts files distinct from behavior specs. Cleaner separation but two files to maintain per page and easier to skip. | |
| Defer axe to Phase 5 quality sweep | FOUND-05 only ships the harness; QUAL-08 in Phase 5 does the actual a11y pass. Phase 1 just provides the scaffolding. | |

**User's choice:** Bundled into characterization specs (Recommended)

---

## Empty/error state pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Two standalone components (Recommended) | <app-empty-state [icon]=... [title]=... [message]=...><ng-content></ng-content></app-empty-state> and <app-error-state [error]=... (retry)=...>. Composable, projects an action via ng-content (e.g., "Add your first meal" button). Standard Angular standalone shape. | ✓ |
| Single component with mode input | <app-status-state [mode]="'empty' \| 'error' \| 'loading'" ...>. Fewer files but conflates concerns; loading is rarely styled the same as empty. | |
| Structural directive + plain templates | <ng-template *appEmpty="items">...</ng-template> as a guard. Powerful but indirect; harder to discover and document. Less obvious for someone reading the template. | |

**User's choice:** Two standalone components (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Title + message + optional action slot (Recommended) | Both: [title], [message]; action via <ng-content> (e.g., a button). <app-error-state> adds [error?: Error\|string] and (retry) emitter. Minimal API, projection handles variation. | ✓ |
| Full config object | [config]={title, message, icon, actionLabel, actionEvent}. Single input but constrains action UI to a single button — hostile to pages that want richer empty states ("Add your first meal" + "Open recent foods"). | |
| Title + message only | Plainest; pages render their own action below the component. Very simple but defeats the point of a shared pattern — inconsistent action placement. | |

**User's choice:** Title + message + optional action slot (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly message + collapsed details (Recommended) | Default human message (e.g., "Couldn't load your data—please retry"); raw error.message tucked in a <details> for power-user inspection. StorageError.code can map to copy when present (e.g., PARSE_ERROR → "Stored data couldn't be read"). | ✓ |
| Raw error.message only | Pass-through. Quick to implement; users see ugly stack-leak-ish text. | |
| Friendly message only — no raw view | Always a stock copy line. Hides info that helps debugging when you (the user) hit it yourself. | |

**User's choice:** Friendly message + collapsed details (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| src/app/shared/ (Recommended) | Co-locate with nav.component and date-range — matches the existing shared/ convention from CLAUDE.md (Project Structure section). | ✓ |
| src/app/shared/ui/ | Sub-folder for UI primitives so shared/ stays small as it grows. Clean but introduces a new convention earlier than needed. | |
| src/app/components/ | New top-level folder for all reusable UI. Fights the existing structure — shared/ is already established. | |

**User's choice:** src/app/shared/ (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Ship + retrofit visible empty states (Recommended) | FOUND-06 says the pattern is "available for reuse across feature pages." Ship the two components and replace the obvious empty/error rendering on cardio, weight, readings, diet, charts, reports, chat, settings. Phase 5 (QUAL-09) does the consistency polish. | ✓ |
| Ship components only; retrofit is Phase 5 | Phase 1 lands the pattern + a docs example. Cross-app retrofit happens in QUAL-09 — already on the docket. | |
| Ship + retrofit one page as exemplar | Ship + use it on diet-page (or one anchor page) so there's a working reference for Phase 5 to copy from. | |

**User's choice:** Ship + retrofit visible empty states (Recommended)

---

## Schema-migration recovery UX

| Option | Description | Selected |
|--------|-------------|----------|
| LocalStorage with timestamped recovery key (Recommended) | fitness_tracker_data.backup.v{N}.{ISO-timestamp} — e.g. fitness_tracker_data.backup.v4.2026-05-02T14-30-12Z. One key per pre-migration snapshot. Same storage as live data (no extra surface). Older backups can be pruned (keep last 3) to stay under quota. | ✓ |
| Single rolling backup key | fitness_tracker_data.backup overwritten each migration. Simplest; loses any chain of backups (V3→V4 backup gone the moment V4→V5 runs). Fine if you only need to recover the most recent attempt. | |
| Per-version key, no timestamp | fitness_tracker_data.backup.v4 — collisions if a migration runs twice. Avoidable with the timestamp approach. | |

**User's choice:** LocalStorage with timestamped recovery key (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Block the app + recovery banner (Recommended) | Full-page banner: "Your data couldn't be migrated to the new format. A backup is preserved at key {recovery_key}." Buttons: "Retry migration", "Copy backup JSON to clipboard", "Continue with empty data (your backup stays safe)." App refuses to load malformed live data. Matches Phase 1 success criterion #4. | ✓ |
| Inline warning + load empty state | Migration fails silently, app loads with empty AppData, persistent banner across pages says "Backup preserved — click to recover." Less alarming but easy to dismiss and lose track of. | |
| Fail open with current data | Migration throws but service swallows and returns whatever shape was on disk. Worst behavior — silently corrupts forward. Explicitly NOT this. | |

**User's choice:** Block the app + recovery banner (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| One LegacyAppDataVN interface per from-version (Recommended) | src/app/services/legacy-schemas.ts exports LegacyAppDataV0, LegacyAppDataV1, ... LegacyAppDataV4. Each migrateVxToVy() takes the concrete from-shape and returns the to-shape. Replaces every existing as any cast in storage.service.ts (lines 296, 298, 306, 324, 350). | ✓ |
| One union LegacyAppData type | type LegacyAppData = AppDataV0 \| AppDataV1 \| ... discriminated by schemaVersion. Migrations narrow via switch. Cleaner if there's truly shared code, but legacy shapes diverge — forced narrowing usually adds noise. | |
| Inline legacy types per migration function | Each migrateVxToVy() declares its own input interface inline. Locality but encourages drift; legacy-schemas.ts is the obvious home. | |

**User's choice:** One LegacyAppDataVN interface per from-version (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Fixture-driven for V0→V4 + malformed-input matrix (Recommended) | src/app/services/migrations/fixtures/v{N}.json → v{N+1}-expected.json round-trip tests for every existing migration (V0→V1, V1→V2, V2→V3, V3→V4). Plus malformed-input cases per CONCERNS.md "Migration error path not tested": null, {}, wrong types, missing required fields. V5→V6 fixture is built when Phase 2 ships, V4→V5 when Phase 3 ships — but Phase 1 lays the harness. | ✓ |
| Just the malformed-input matrix | Don't backfill V0→V4 fixtures; only add the missing malformed-input coverage so V5→V6 / V4→V5 land cleanly later. Minimal scope; existing migrations stay untyped legacy and don't get the typed-interface refactor in Phase 1. | |
| Just the harness, no migration tests yet | Phase 1 ships the helper utilities (loadFixture, applyMigration, expectShape) but no real test cases. Phase 2/3 add tests with their migrations. Cleanest scope but loses the chance to retroactively catch a V2→V3 bug. | |

**User's choice:** Fixture-driven for V0→V4 + malformed-input matrix (Recommended)

---

## Claude's Discretion

- Specific copy strings (recovery banner body, friendly error messages, default empty-state titles).
- Internal naming (fixture sub-folder layout, axe helper utility name, exact module split between `id.ts` / `group-by-day.ts` / extending `date-range.ts`).
- Angular template syntax choice (`@if`/`@for` vs `*ngIf`/`*ngFor`) — match surrounding component to minimize diff noise.
- Order of operations within Phase 1 plan execution; only constraint is the recovery banner depending on `<app-error-state>` landing first.

## Deferred Ideas

- Loading-state component (rejected from FOUND-06 scope; revisit in QUAL-09 if the consistency review wants one).
- Coverage no-decrease ratchet (rejected for Phase 1; revisit in Phase 5 if per-pattern floors prove too lenient).
- Backup pruning UI in `/settings` (Phase 1 prunes silently; user-facing surface belongs in a future IO milestone).
- Recovery-key surface for non-failure cases ("export current state as backup before X"); future IO milestone.
- Loading skeletons for charts/diet (perpetual nice-to-have, surfaces in QUAL-09 at earliest).
