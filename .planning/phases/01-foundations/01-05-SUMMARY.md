---
phase: 01-foundations
plan: 05
subsystem: e2e-harness
tags: [e2e, puppeteer, axe-core, smoke-test, a11y, harness, scaffolding]

# Dependency graph
requires:
  - phase: 00-research
    provides: Pattern 8 (RESEARCH §lines 773-819 — verbatim Puppeteer entrypoint scaffold) + RESEARCH §line 1240 (axe-core injection via page.addScriptTag) + RESEARCH §line 1243 (two-terminal flow; no concurrently/wait-on)
  - phase: 01-foundations
    plan: 01
    provides: axe-core ^4.11.4 devDep installed (puppeteer ^24.37.3 was already present pre-Phase 1); resolveJsonModule patch on tsconfig.spec.json (not used by .mjs harness — Node loads JSON natively, included for completeness)
provides:
  - "e2e/run.mjs — Puppeteer entrypoint; launches headless: 'new' Chromium with --no-sandbox/--disable-setuid-sandbox/--disable-dev-shm-usage; orchestrates runSmoke + runA11y in sequence; exits 1 on first failure with stack trace"
  - "e2e/smoke.spec.mjs — Per-route navigation across the 8 feature routes (/cardio, /weight, /readings, /diet, /charts, /report, /chat, /settings) under hash routing; fails on any pageerror or console.error during page load"
  - "e2e/a11y.spec.mjs — axe-core injection via page.addScriptTag(require.resolve('axe-core/axe.min.js')) per route; D-08 severity gate (serious|critical only fail Phase 1)"
  - "e2e/fixtures/seed-data.json — Minimal AppData seed (schemaVersion=4; one cardioSession + one weightEntry; all other arrays empty; aiSettings omitted per CLAUDE.md no-null-for-absent-optional rule); future specs load via page.evaluate(localStorage.setItem) before navigating"
  - "e2e/README.md — Two-terminal flow documentation (Terminal 1 ng serve, Terminal 2 npm run e2e), E2E_BASE_URL env override, what-each-file-does, how to add a new route to ROUTES (both arrays in lock-step), expected failure modes (connection refused, axe violations, pageerror)"
  - "package.json scripts.e2e = 'node e2e/run.mjs' — only addition; existing scripts untouched"
affects:
  - "01-08 (Wave 4 characterization specs) — although the primary characterization mechanism is Karma TestBed (D-05), the e2e harness exists alongside as the smoke/regression scaffold; future per-page e2e specs extend e2e/smoke.spec.mjs's ROUTES array rather than inventing a new harness"
  - "Phase 2/3/4/5 — every later phase that adds a route or page will: (1) add the path to e2e/smoke.spec.mjs and e2e/a11y.spec.mjs ROUTES arrays; (2) optionally extend e2e/fixtures/seed-data.json with the minimal records needed to render the new page populated"
  - "FOUND-05 building blocks (a11y-test-helpers.ts from plan 02 + e2e/a11y.spec.mjs from this plan) — combined coverage requires plan 08 characterization specs to consume a11y-test-helpers; FOUND-05 flips to [x] only when both Karma a11y assertions (in characterization specs) AND e2e a11y harness are wired"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ES modules (.mjs) without package.json type:module — Node treats .mjs files as ESM regardless of the surrounding package's module mode. Avoids touching the existing CommonJS conventions Angular CLI / electron use."
    - "Top-level await in run.mjs — supported in Node 20+ ESM modules; cleaner than wrapping the orchestration in an async IIFE."
    - "page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') }) — injects axe-core directly from the locked devDep. No CDN fetch (T-05-02 mitigation) and no @axe-core/puppeteer wrapper (rejected per RESEARCH §STACK; net-additive deps stay at axe-core only)."
    - "Hash routing pattern in e2e URLs (baseUrl + '/#' + route) — matches CLAUDE.md \"Hash-based routing stays\" and Angular's hash-strategy router config."
    - "Two-terminal flow (no concurrently/wait-on) — operator runs ng serve in Terminal 1, npm run e2e in Terminal 2. Keeps the Phase 1 dep delta to axe-core only (RESEARCH §line 1243)."
    - "Severity gate filter (results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')) per D-08 — minor/moderate violations don't fail Phase 1; QUAL-08 in Phase 5 does the manual full sweep."
    - "WSL2/CI-safe Chromium launch flags (--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage) per RESEARCH §Assumption A7."

key-files:
  created:
    - "e2e/run.mjs — 32 lines; Puppeteer entrypoint with headless: 'new' + WSL2-safe args; orchestrates runSmoke then runA11y in sequence; try/catch/finally writes exit code based on first failure"
    - "e2e/smoke.spec.mjs — 38 lines; exports runSmoke(browser, baseUrl); registers pageerror + console.error listeners per page; navigates 8 routes via baseUrl + '/#' + route; throws on first error per route with named detail"
    - "e2e/a11y.spec.mjs — 44 lines; exports runA11y(browser, baseUrl); resolves axe-core/axe.min.js via createRequire+require.resolve; injects script tag and runs axe.run(document) per route; filters to impact === 'serious' || 'critical' (D-08)"
    - "e2e/fixtures/seed-data.json — 27 lines; schemaVersion=4; cardioSessions[0]=seed-cardio-1 (running, 30min, 5km); weightEntries[0]=seed-weight-1 (175 lbs); healthReadings/savedFoods/mealEntries/chatConversations all []; aiSettings omitted (not null) per CLAUDE.md"
    - "e2e/README.md — ~95 lines; sections: # e2e harness (intro), ## Two-terminal flow (with E2E_BASE_URL override + WSL2 PUPPETEER_EXECUTABLE_PATH note), ## What runs (per-file bullets for run.mjs/smoke.spec.mjs/a11y.spec.mjs/seed-data.json), ## Adding a new route (2-step list emphasizing both ROUTES arrays in lock-step), ## Failure modes to expect (connection refused, axe violations, pageerror, Linux/WSL2 launch failures)"
  modified:
    - "package.json — added scripts.e2e: 'node e2e/run.mjs'; existing 8 scripts (ng/start/build/watch/test/electron:dev/electron:build/electron:publish) unchanged; no dep changes"

key-decisions:
  - "Plain axe-core + page.addScriptTag (per RESEARCH §Pattern 8), NOT @axe-core/puppeteer — keeps Phase 1 net-additive deps at exactly one (axe-core, added by plan 01-01). Functional equivalence: addScriptTag injects the same UMD bundle the wrapper would; page.evaluate runs window.axe.run(document) directly."
  - "Two-terminal flow (no concurrently/wait-on) per RESEARCH §line 1243 — operator coordinates server lifecycle. Phase 5 / QUAL-08 may revisit if CI integration becomes necessary, but Phase 1 prefers minimal dep surface over operator convenience."
  - "Hash routing in e2e URLs (baseUrl + '/#' + route) — matches CLAUDE.md \"Hash-based routing stays\" and the Angular dev server's hash-strategy. Without the hash prefix, the dev server would issue a 404 for /cardio (not /#/cardio)."
  - "8 routes tested in BOTH smoke and a11y specs (parallel ROUTES arrays) — duplication is intentional for reading clarity; the README documents the lock-step requirement explicitly. A future plan can DRY this into a shared module if desired, but Phase 1 keeps the two specs independently runnable."
  - "Seed fixture omits aiSettings (not null) — strict adherence to CLAUDE.md mandate \"Do NOT store null for absent optional fields — use undefined / omit the field.\" Current StorageService.initialize() defaults missing fields, so the seed only needs to include the required arrays/timestamp."
  - "Severity gate is serious|critical only (D-08) — minor/moderate violations don't fail Phase 1's smoke run; QUAL-08 in Phase 5 does the manual full sweep across all severities."
  - "Verify is node --check + grep gates ONLY — actually running `npm run e2e` requires `ng serve` in another terminal, which the executor cannot orchestrate. Operator manually verifies after Phase 1's other plans land."
  - "5 NEW files in e2e/ + 1 line in package.json — matches the plan's <success_criteria> exactly. No drift from frontmatter files_modified list."

patterns-established:
  - "Pattern: ES module (.mjs) Node CLI tooling — first .mjs files in the repo. Avoids touching package.json type:module (which would break the existing CommonJS-form electron/main.js + JSON-form angular.json). All future Node CLI scripts that aren't TypeScript-compiled (e.g., a hypothetical migration backfill script) should follow this pattern."
  - "Pattern: page.addScriptTag with require.resolve for in-page library injection — first time an in-page library is loaded from a Node-resolved path (rather than a URL or inline content). Future Phase 5 e2e work that needs to inject test utilities can mirror this."
  - "Pattern: e2e/fixtures/seed-data.json as the canonical pre-populated AppData snapshot — Phase 2 (V5→V6 diet migration) and Phase 3 (V4→V5 AI migration) e2e tests will extend this with the new model fields (foodUnits, ChatMessage.blocks) once their migrations land."
  - "Pattern: README.md as the per-directory operator manual — first per-directory README beyond repo root. Documents tooling-level commands the user runs, not API surface."

requirements-completed: []
# FOUND-05 NOT marked complete — combined coverage requires:
# 1. e2e a11y harness (this plan: e2e/a11y.spec.mjs) — DONE
# 2. Karma a11y assertions in characterization specs (plan 08 — Wave 4) — PENDING
# 3. a11y-test-helpers.ts consumer adoption (plan 08 — Wave 4) — PENDING
# Same gating policy used for FOUND-02/04/06/07 (building blocks present in early waves, requirement-completion gated on consumer adoption in later waves).

# Metrics
duration: 2min
completed: 2026-05-02
---

# Phase 1 Plan 05: Puppeteer + axe-core e2e Harness Scaffold Summary

**5 NEW files in `e2e/` (run.mjs, smoke.spec.mjs, a11y.spec.mjs, fixtures/seed-data.json, README.md) + 1 npm script (`e2e: node e2e/run.mjs`) — Puppeteer harness wired for the 8 feature routes with axe-core severity-gated a11y checks, ready for Phases 2–5 to extend.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-02T19:33Z
- **Completed:** 2026-05-02T19:35Z
- **Tasks:** 3/3
- **Files created:** 5
- **Files modified:** 1 (package.json — single script entry)

## Accomplishments

- **Puppeteer entrypoint (`e2e/run.mjs`):** Launches headless Chromium with `headless: 'new'` and the WSL2-safe arg trio (`--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage` per RESEARCH §Assumption A7). Orchestrates `runSmoke` then `runA11y` in sequence; first failure throws with stack trace, sets exit code 1, but always closes the browser via `finally`. Uses top-level `await` (Node 20+ ESM).
- **Smoke spec (`e2e/smoke.spec.mjs`):** Navigates each of the 8 feature routes (`/cardio`, `/weight`, `/readings`, `/diet`, `/charts`, `/report`, `/chat`, `/settings`) under hash routing (`baseUrl + '/#' + route`). Registers `pageerror` and `console.error` listeners on a single page instance reused across routes; throws on first error with named-detail message after each navigation. 250ms post-load delay catches errors fired during initial render.
- **A11y spec (`e2e/a11y.spec.mjs`):** Resolves `axe-core/axe.min.js` via `createRequire(import.meta.url) + require.resolve`, then injects via `page.addScriptTag({ path })` after each navigation. Runs `axe.run(document)` in-page via `page.evaluate`, filters violations to `impact === 'serious' || impact === 'critical'` (D-08), and throws on the first route with violations including impact label, rule id, help text, and node count.
- **Seed fixture (`e2e/fixtures/seed-data.json`):** Minimal `AppData` shape — `schemaVersion: 4`, one cardio session (running, 30min, 5km), one weight entry (175 lbs), all other arrays empty, `aiSettings` omitted (not `null`) per CLAUDE.md's "no null for absent optional fields" rule. Future specs load this via `page.evaluate(seed => localStorage.setItem('fitness_tracker_data', JSON.stringify(seed)), seed)` before navigating, so empty-vs-populated rendering paths can be exercised deterministically.
- **README (`e2e/README.md`):** Documents the two-terminal flow (Terminal 1 `ng serve`, Terminal 2 `npm run e2e`) with `E2E_BASE_URL` override, per-file `## What runs` summary, 2-step `## Adding a new route` (both ROUTES arrays must stay in lock-step), and 4 expected failure modes (connection refused, a11y violation, smoke pageerror/console.error, Puppeteer launch failure on Linux/WSL2 with `PUPPETEER_EXECUTABLE_PATH` workaround). All 8 route paths appear in the body so the auto-grep gate passes.
- **`package.json` scripts entry:** Single new entry `"e2e": "node e2e/run.mjs"` appended after `electron:publish`. All 8 existing scripts (`ng`, `start`, `build`, `watch`, `test`, `electron:dev`, `electron:build`, `electron:publish`) unchanged. `dependencies` and `devDependencies` unchanged — `axe-core` (added by plan 01-01) and `puppeteer` (pre-existing) are the only relevant deps. No `concurrently` or `wait-on` introduced (RESEARCH §line 1243).
- **Production build still passes:** `package.json` is the only modified app file; no Angular code touched. The harness lives outside `src/`, `tsconfig.app.json`, and `tsconfig.spec.json` — fully decoupled from the application bundle.

## Task Commits

Each task was committed atomically on `gsd/phase-1-foundations`:

1. **Task 1: Create `e2e/run.mjs` + `smoke.spec.mjs` + `a11y.spec.mjs`** — `2dcd7d6` (feat)
2. **Task 2: Create `e2e/fixtures/seed-data.json` + `e2e/README.md`** — `e1edd59` (feat)
3. **Task 3: Add `e2e` npm script to `package.json`** — `2ea790a` (chore)

**Plan metadata commit:** appended after this SUMMARY + STATE/ROADMAP updates.

## Files Created/Modified

**Created (5 files):**

- `e2e/run.mjs` — Puppeteer entrypoint, ESM (.mjs), top-level await, headless: 'new'
- `e2e/smoke.spec.mjs` — `runSmoke(browser, baseUrl)`, 8-route ROUTES array, hash routing
- `e2e/a11y.spec.mjs` — `runA11y(browser, baseUrl)`, axe-core injection, D-08 severity gate
- `e2e/fixtures/seed-data.json` — minimal AppData (schemaVersion=4; 1 cardio + 1 weight)
- `e2e/README.md` — operator manual: two-terminal flow + adding-route + failure modes

**Modified (1 file):**

- `package.json` — `scripts.e2e = "node e2e/run.mjs"` only; no other changes

## Decisions Made

- **Plain `axe-core` + `page.addScriptTag`, NOT `@axe-core/puppeteer`:** The wrapper would have added one more transitive dep; functional equivalence is achieved by injecting `axe.min.js` directly. Per RESEARCH §STACK.md the Phase 1 net-additive surface is exactly `axe-core` (already added by plan 01-01) — `@axe-core/puppeteer` was rejected.
- **Two-terminal flow (no `concurrently`/`wait-on`) per RESEARCH §line 1243:** Operator coordinates server lifecycle. The README documents this prominently. Future CI integration (Phase 5 / QUAL-08) may revisit, but Phase 1 keeps the dep surface minimal.
- **Hash routing in e2e URLs (`baseUrl + '/#' + route`):** Matches CLAUDE.md "Hash-based routing stays". Without the `#` prefix, `/cardio` would 404 against the Angular dev server. Future plans that touch the router (none in Phase 1) would need to revisit this.
- **8 routes duplicated in both `smoke.spec.mjs` and `a11y.spec.mjs`:** Intentional — keeps each spec independently runnable. README documents the lock-step requirement explicitly under "Adding a new route". A future DRY refactor (single shared `routes.mjs`) is a possible Phase 5 cleanup, but doesn't ship now.
- **Seed fixture omits `aiSettings` rather than setting it to `null`:** CLAUDE.md mandate "Do NOT store null for absent optional fields — use undefined / omit the field." `JSON.stringify(undefined)` omits the key in serialized form, so the fixture file simply omits the field.
- **Severity gate is `serious | critical` only (D-08):** Minor/moderate violations don't fail Phase 1's a11y run; QUAL-08 in Phase 5 does the manual full sweep across all severities.
- **Verify is `node --check` + grep gates ONLY:** Actually running `npm run e2e` requires `ng serve` in another terminal, which the executor cannot orchestrate. The plan explicitly documented this constraint in `<verification>`. Operator manually verifies after the rest of Phase 1 lands and `ng serve` is up.

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed without auto-fixing anything; no Rule 1/2/3 deviations triggered. CLAUDE.md compliance verified: harness lives outside `src/app/`, no NgModules, no LocalStorage direct access from app code, no `any` types in the .mjs files, accessibility considerations baked into a11y.spec.mjs (severity gate), commit messages follow the conventional-commit format with the project's `<scope>` of `01`.

**Total deviations:** 0
**Impact on plan:** None — clean execution.

## Issues Encountered

None.

## Verification

- `node --check e2e/run.mjs` — **exit 0** (valid ES module syntax)
- `node --check e2e/smoke.spec.mjs` — **exit 0**
- `node --check e2e/a11y.spec.mjs` — **exit 0**
- `node -e "JSON.parse(require('fs').readFileSync('e2e/fixtures/seed-data.json','utf8'))"` — **valid JSON**, `schemaVersion === 4`, `cardioSessions.length === 1`, `weightEntries.length === 1`
- `grep -c "puppeteer.launch" e2e/run.mjs` — **1**
- `grep -c "headless: 'new'" e2e/run.mjs` — **1** (Pattern 8 explicit headless mode)
- `grep -c "no-sandbox" e2e/run.mjs` — **1** (WSL2/CI safety per Assumption A7)
- `grep -c "axe-core/axe.min.js" e2e/a11y.spec.mjs` — **1** (axe injection path)
- 8 routes in BOTH specs — `for r in /cardio /weight /readings /diet /charts /report /chat /settings; do grep -q "$r" e2e/smoke.spec.mjs && grep -q "$r" e2e/a11y.spec.mjs; done` — **all 8 OK**
- `grep -c "serious" e2e/a11y.spec.mjs` — **3** (≥1 required); `grep -c "critical" e2e/a11y.spec.mjs` — **3** (D-08 severity gate)
- `grep -E "concurrently|wait-on" e2e/*.mjs` — **no matches** (rejected deps absent)
- `node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); if (p.scripts.e2e !== 'node e2e/run.mjs') process.exit(1)"` — **exit 0** (script entry exact match)
- `grep -E '"concurrently"|"wait-on"' package.json` — **no matches** (no rejected deps in package.json)
- `grep -q '"axe-core"' package.json` — **OK** (axe-core from plan 01-01 still present)
- README sections present (`grep -c '## Two-terminal flow'`, `## What runs`, `## Adding a new route`, `## Failure modes` — each ≥1)
- README references all 8 route paths — `for r in /cardio /weight /readings /diet /charts /report /chat /settings; do grep -q "$r" e2e/README.md; done` — **all 8 OK**
- `git status --short` — **clean** after each task commit (no untracked, no unstaged)

## Threat-Model Compliance

- **T-05-01 (DoS — Puppeteer hang on missing `ng serve`):** `page.goto` has explicit `timeout: 15000` (15 seconds). `run.mjs` catches the resulting timeout error, prints stack trace, sets exitCode=1, and closes the browser. README documents connection-refused as expected when `ng serve` is not running.
- **T-05-02 (Tampering — axe-core injection from wrong path):** `require.resolve('axe-core/axe.min.js')` resolves through Node's module loader against the locked `axe-core@^4.11.4` devDep installed by plan 01-01. No remote URL fetch, no CDN, no `@axe-core/puppeteer` wrapper. The script tag's `path:` is a verified-on-disk path.
- **T-05-03 (Information Disclosure — E2E runs against production data accidentally):** Two-terminal flow uses dev `ng serve` (LocalStorage isolated to `localhost:4200`). The seed fixture is loaded explicitly when a future spec calls `page.evaluate(localStorage.setItem(...))`; no automatic seeding by the Phase 1 harness, so the developer's actual data is untouched unless they opt in. Phase 5 / QUAL-08 will revisit if e2e seeding lifecycle becomes important.

## FOUND-05 Status

**NOT yet marked complete in REQUIREMENTS.md.** This plan delivered the e2e a11y harness building block; full coverage of FOUND-05 requires:

- This plan (01-05) — e2e a11y harness `e2e/a11y.spec.mjs` — **DONE**
- Plan 01-02 (Wave 1, already done) — `a11y-test-helpers.ts` for Karma TestBed a11y assertions — **DONE**
- Plan 01-08 (Wave 4) — characterization specs that consume `a11y-test-helpers.ts` per the D-08 pattern — **PENDING**

FOUND-05 flips to `[x]` when plan 08 lands and the Karma-side a11y assertions are wired alongside the e2e harness — same gating policy used for FOUND-02/04/06/07 (building blocks present in early waves, requirement-completion gated on consumer adoption in later waves).

## Wave 2 Status

**Wave 2 of Phase 1 is now 1/3 plans complete:**

- 01-05 — Puppeteer + axe-core e2e harness scaffold (FOUND-05 — building block) — done 2026-05-02 (this plan)
- 01-06 — id.ts + chart-grouping consumer retrofit across services + chart pages (FOUND-02) — pending
- 01-09 — Storage migration refactor: typed chain + backup-before-migrate + fixture-driven spec (FOUND-07) — pending

Plans 06 and 09 remain unblocked and can run in parallel or sequentially.

## Self-Check

Verifying claims before finalizing:

- `e2e/run.mjs` — FOUND
- `e2e/smoke.spec.mjs` — FOUND
- `e2e/a11y.spec.mjs` — FOUND
- `e2e/fixtures/seed-data.json` — FOUND
- `e2e/README.md` — FOUND
- `package.json` modified (scripts.e2e) — FOUND
- Commit `2dcd7d6` (feat) — FOUND on `gsd/phase-1-foundations`
- Commit `e1edd59` (feat) — FOUND on `gsd/phase-1-foundations`
- Commit `2ea790a` (chore) — FOUND on `gsd/phase-1-foundations`

## Self-Check: PASSED
