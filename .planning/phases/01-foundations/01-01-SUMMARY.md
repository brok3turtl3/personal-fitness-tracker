---
phase: 01-foundations
plan: 01
subsystem: testing
tags: [karma, coverage, axe-core, angular18, tsconfig, jasmine]

# Dependency graph
requires:
  - phase: 00-research
    provides: Locked decisions D-01..D-04 (per-pattern coverage thresholds; CI-only enforcement) and Pattern 1 verbatim Karma config
provides:
  - karma.conf.js at repo root with coverageReporter.check (per-pattern thresholds)
  - angular.json architect.test.options.karmaConfig wired to ./karma.conf.js
  - tsconfig.spec.json resolveJsonModule + esModuleInterop (unblocks JSON fixture imports for FOUND-07)
  - axe-core@^4 devDependency (the only Phase 1 net-additive dep)
  - Verified two-mode test workflow: plain ng test = fast, --code-coverage = threshold check
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, all Phase 2-5 plans that run ng test --code-coverage]

# Tech tracking
tech-stack:
  added: [axe-core@4.11.4]
  patterns:
    - "External karma.conf.js (extracted from angular.json inline form) with per-pattern coverageReporter.check"
    - "Coverage thresholds gated by --code-coverage argv (D-04): no enforcement on plain ng test"
    - "JSON fixture imports enabled in spec compilation via resolveJsonModule + esModuleInterop"

key-files:
  created:
    - "karma.conf.js (repo root) — Karma config + coverage thresholds (FOUND-01)"
  modified:
    - "angular.json — architect.test.options gains karmaConfig: ./karma.conf.js"
    - "tsconfig.spec.json — adds resolveJsonModule: true, esModuleInterop: true"
    - "package.json — adds axe-core@^4.11.4 to devDependencies"
    - "package-lock.json — regenerated for axe-core install"

key-decisions:
  - "Followed plan exactly: D-01..D-04 thresholds applied verbatim; emitWarning: false for hard CI fail"
  - "Located CHROME_BIN at puppeteer's bundled chromium (~/.cache/puppeteer/chrome/linux-145.0.7632.67/chrome-linux64/chrome) for ChromeHeadless smoke runs — environment-specific, not a code decision"
  - "legacy-schemas.ts override (100/100/100/100) listed proactively in karma.conf.js even though file lands in plan 04 — karma-coverage tolerates globs that match no files"

patterns-established:
  - "Pattern 1 (RESEARCH §187-285) — per-pattern coverageReporter.check with global, each, excludes, and overrides — applied verbatim"
  - "Pitfall 2 mitigation — check block placed strictly inside coverageReporter so plain ng test never trips thresholds"
  - "Pitfall 7 mitigation — resolveJsonModule + esModuleInterop in tsconfig.spec.json before any FOUND-07 fixture imports land"

requirements-completed: [FOUND-01]

# Metrics
duration: 3m 13s
completed: 2026-05-02
---

# Phase 1 Plan 01: Coverage config + axe-core install + tsconfig.spec patch Summary

**Repo-root karma.conf.js with per-pattern coverage thresholds (services/shared 90/80/90/90, migration code 100/100/100/100), axe-core@4.11.4 installed, and tsconfig.spec.json now imports JSON fixtures.**

## Performance

- **Duration:** 3 min 13 sec (193 seconds wall clock; longer with `ng test` runs included in smoke verification)
- **Started:** 2026-05-02T19:05:01Z
- **Completed:** 2026-05-02T19:08:14Z
- **Tasks:** 3 / 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `karma.conf.js` extracted to repo root (D-03) with verbatim Pattern 1 coverage configuration: global floor 60/50/60/60, per-file default 40/30/40/40, services/** + shared/** at 90/80/90/90, storage.service.ts + legacy-schemas.ts at 100/100/100/100.
- `coverageReporter.check.emitWarning: false` so threshold failures fail the run (D-01 area).
- `angular.json` architect.test.options gains `"karmaConfig": "./karma.conf.js"`; all existing fields (polyfills, tsConfig, assets, styles, scripts) preserved intact.
- `tsconfig.spec.json` gains `resolveJsonModule: true` and `esModuleInterop: true` — unblocks `import v0Fixture from './migrations/fixtures/v0.json'` in FOUND-07 specs.
- `axe-core@4.11.4` installed as the only net-additive Phase 1 devDependency (D-05) — no concurrently / wait-on / @axe-core/* added.
- Both-mode smoke verification proves Pitfall 2 is correctly handled.

## Task Commits

Each task was committed atomically (all on `gsd/phase-1-foundations`):

1. **Task 1: Install axe-core@^4 devDependency** — `a638189` (chore)
2. **Task 2: Create karma.conf.js with per-pattern coverage thresholds** — `e56e818` (chore)
3. **Task 3: Wire angular.json + tsconfig.spec.json + smoke-verify both modes** — `aef83cb` (chore)

**Plan metadata commit:** pending (will be made after this SUMMARY + STATE/ROADMAP updates land).

## Files Created/Modified

- `karma.conf.js` (NEW) — Karma config + per-pattern coverage thresholds. Extracted from `angular.json:73-93` inline form (D-03). Adds `coverageReporter.check` with `global`, `each` (with excludes), and 4 override globs.
- `angular.json` (MOD) — `architect.test.options.karmaConfig` field added pointing at `./karma.conf.js`. Existing fields untouched.
- `tsconfig.spec.json` (MOD) — `compilerOptions` gains `resolveJsonModule: true` and `esModuleInterop: true`.
- `package.json` (MOD) — devDependencies gains `"axe-core": "^4.11.4"`.
- `package-lock.json` (MOD) — regenerated to include axe-core dependency tree.

## Verification Results

### Task 1 verify (axe-core install)
- `grep -q '"axe-core"' package.json` — PASS
- `test -d node_modules/axe-core` — PASS
- `node -e "console.log(require('axe-core/package.json').version)"` — `4.11.4`
- `git diff` shows no concurrently/wait-on/@axe-core/* additions — PASS

### Task 2 verify (karma.conf.js)
- `test -f karma.conf.js` — PASS
- `node -e "..."` loaded the config and printed override keys: `["src/app/services/**/*.ts","src/app/shared/**/*.ts","src/app/services/storage.service.ts","src/app/services/legacy-schemas.ts"]` — PASS (all 4 overrides present)
- `grep -c 'coverageReporter' karma.conf.js` = 2 — PASS (>= 1)
- `grep -c "'src/app/services/\\*\\*/\\*\\.ts'"` = 1 — PASS
- `grep -c "'src/app/services/storage\\.service\\.ts'"` = 1 — PASS
- `grep -c "'src/app/services/legacy-schemas\\.ts'"` = 1 — PASS
- `grep -c 'emitWarning: false'` = 1 — PASS
- No top-level `check:` (Pitfall 2): line 33 `check:` is at 6-space indent inside `coverageReporter` (line 29) — PASS

### Task 3 verify (wiring + smoke)
- `grep -c '"karmaConfig"' angular.json` = 1 — PASS
- `grep -c 'karma.conf.js' angular.json` = 1 — PASS (>= 1)
- `grep -c '"resolveJsonModule"' tsconfig.spec.json` = 1 — PASS
- `grep -c '"esModuleInterop"' tsconfig.spec.json` = 1 — PASS
- All existing `architect.test.options` fields (polyfills, tsConfig, assets, styles, scripts) still present — PASS
- **`ng test --no-watch --browsers=ChromeHeadless`**: 190 specs SUCCESS, exit 0, no threshold messages — Pitfall 2 PASS (D-04 honored)
- **`ng test --no-watch --code-coverage --browsers=ChromeHeadless`**: 190 specs SUCCESS; 27 "Coverage for ... does not meet ... threshold" messages; exit 1; `coverage/personal-fitness-tracker/` directory written (HTML report + lcov.info). Threshold failures expected — full Phase 1 specs (chart-grouping, characterization specs, etc.) haven't landed yet. What matters is that the new `karma.conf.js` is being loaded and the check is firing — confirmed.
- **`ng build --configuration=production`**: exit 0, bundle generation complete — no production-path regression.

## Decisions Made

- **None — followed plan as specified.** All four override globs, threshold values, `emitWarning: false`, and excludes are taken verbatim from the plan's required code block (which itself is sourced from RESEARCH §Pattern 1 lines 187-285 and CONTEXT.md D-01..D-04). The only environment-specific value applied is `CHROME_BIN` pointing at puppeteer's bundled Chromium (~/.cache/puppeteer/chrome/linux-145.0.7632.67/chrome-linux64/chrome) — this is a smoke-run-only env var, not a committed change to repo config.

## Deviations from Plan

**None — plan executed exactly as written.**

No Rule 1, Rule 2, Rule 3, or Rule 4 deviations were triggered. All three tasks ran their `<action>` blocks verbatim against the cited acceptance criteria, every grep gate passed, and both smoke-test modes behaved exactly as predicted by the plan (`ng test` = exit 0 / no threshold output; `ng test --code-coverage` = exit 1 / threshold output with coverage directory written).

## Issues Encountered

- **Karma needed `CHROME_BIN`.** No system-wide `google-chrome` or `chromium` binary was installed. Resolved by exporting `CHROME_BIN=$HOME/.cache/puppeteer/chrome/linux-145.0.7632.67/chrome-linux64/chrome` before each `ng test` smoke run. This is a developer-environment concern (not a repo config change) and does not affect downstream plans — they'll need the same env var to run `ng test` locally. **Recommendation for next plan:** if CI is configured later, document `CHROME_BIN` (or use `ChromeHeadlessNoSandbox` custom launcher already defined in `karma.conf.js`) in CI env. Not blocking.

## User Setup Required

None — no external service configuration required. The only "setup" is local: developers running `ng test` in this WSL/Linux dev environment may need `CHROME_BIN` exported (puppeteer's bundled Chromium is automatically available since `puppeteer@^24` is already a devDependency). On Windows/macOS dev machines with system Chrome, no action needed.

## Next Phase Readiness

- **01-02 (id.ts utility)** — unblocked: spec scaffolding can proceed; coverage threshold check on `src/app/shared/**` (90/80/90/90) is in place.
- **01-03 (chart-grouping extraction)** — unblocked: same shared/** threshold applies.
- **01-04 (typed legacy-schemas.ts)** — unblocked: `src/app/services/legacy-schemas.ts` 100/100/100/100 override is already wired in karma.conf.js.
- **01-05 (Puppeteer e2e harness)** — unblocked: package.json is now safe for the `e2e` script addition (no overlap; this plan only added a devDependency).
- **01-07 (migration fixtures)** — unblocked: `resolveJsonModule + esModuleInterop` are in place, JSON imports will compile.
- **All Phase 1+ plans** — `axe-core@^4` is installed and `import 'axe-core'` will resolve.

**Note:** Existing coverage on `storage.service.ts` (85%/55%) and several services/** files is below the new 90/80 floors. This is expected and intentional — Phase 1's later plans (01-04, 01-08, 01-09) will lift coverage by writing the typed-legacy specs, characterization specs, and migration-fixture specs. The threshold check is meant to *fail loudly until those land*; it is not a regression.

---

## Self-Check: PASSED

Verified after writing this SUMMARY:

- File `karma.conf.js` (repo root) — FOUND
- File `angular.json` — FOUND (modified; karmaConfig present)
- File `tsconfig.spec.json` — FOUND (modified; resolveJsonModule + esModuleInterop present)
- File `package.json` — FOUND (modified; axe-core present)
- File `node_modules/axe-core/package.json` — FOUND (version 4.11.4)
- Commit `a638189` (Task 1: chore axe-core install) — FOUND in `git log --oneline --all`
- Commit `e56e818` (Task 2: chore karma.conf.js) — FOUND in `git log --oneline --all`
- Commit `aef83cb` (Task 3: chore wire angular.json + tsconfig.spec) — FOUND in `git log --oneline --all`

---
*Phase: 01-foundations*
*Completed: 2026-05-02*
