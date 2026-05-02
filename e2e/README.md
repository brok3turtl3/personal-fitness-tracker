# e2e harness

Puppeteer-based end-to-end harness for the Personal Fitness Tracker. Phase 1 ships a
minimal smoke + a11y scaffold — Phases 2–5 extend the harness rather than invent it.

The harness runs **outside** `ng test` so unit-test runs stay fast (per RESEARCH §Pattern 8).

## Two-terminal flow

The harness assumes a developer-controlled dev server is already running. There is no
`concurrently` or `wait-on` dep by design (RESEARCH §line 1243).

**Terminal 1** — start the Angular dev server:

```bash
ng serve --port 4200
```

**Terminal 2** — once the dev server reports "compiled successfully", run the harness:

```bash
npm run e2e
```

You can override the base URL with the `E2E_BASE_URL` environment variable
(defaults to `http://localhost:4200`):

```bash
E2E_BASE_URL=http://localhost:4300 npm run e2e
```

On WSL2 / Linux CI, Puppeteer launches Chromium with `--no-sandbox
--disable-setuid-sandbox --disable-dev-shm-usage` (per RESEARCH §Assumption A7).
If you need a custom Chromium binary, set `PUPPETEER_EXECUTABLE_PATH` before invoking
`npm run e2e` (Puppeteer reads this directly).

## What runs

- **`e2e/run.mjs`** — Puppeteer entrypoint. Launches headless Chromium and orchestrates
  the smoke and a11y specs in sequence. Exits 0 on success, 1 on first failure.
- **`e2e/smoke.spec.mjs`** — Navigates each feature route under hash routing
  (`/#/cardio`, `/#/weight`, `/#/readings`, `/#/diet`, `/#/charts`, `/#/report`,
  `/#/chat`, `/#/settings`) and fails the run if any `pageerror` or `console.error`
  fires while loading.
- **`e2e/a11y.spec.mjs`** — Injects `axe-core/axe.min.js` via `page.addScriptTag` on
  every route and fails the run on any `serious` or `critical` violation (D-08
  severity gate). Minor / moderate violations do not fail Phase 1; the manual full
  sweep is QUAL-08 in Phase 5.
- **`e2e/fixtures/seed-data.json`** — Minimal `AppData` seed (one cardio session, one
  weight entry, otherwise empty) matching the current `schemaVersion: 4` shape. Used
  to exercise empty-vs-populated rendering paths in future plans; load it from a
  spec via `page.evaluate(seed => localStorage.setItem('fitness_tracker_data', JSON.stringify(seed)), seed)`
  before navigating.

## Adding a new route

1. Add the path string (e.g. `'/new-route'`) to the `ROUTES` array in **both**
   `e2e/smoke.spec.mjs` and `e2e/a11y.spec.mjs`. Keep the two arrays in sync —
   every route should be both smoke- and a11y-tested.
2. Re-run `npm run e2e` (with `ng serve` running) to verify the new route loads
   cleanly and passes the a11y gate.

If the new route requires seeded data to render (e.g. a populated chart), extend
`e2e/fixtures/seed-data.json` with the minimum records needed and load it from the
spec before `page.goto`.

## Failure modes to expect

- **Connection refused / `ERR_CONNECTION_REFUSED`** — `ng serve` is not running on
  the expected port. Start Terminal 1 (or set `E2E_BASE_URL`) and re-run.
- **`a11y route X has serious/critical violations`** — axe-core flagged at least one
  serious or critical accessibility violation on a route. The error message lists
  the rule id, help text, and node count. Inspect the route in a real browser and
  fix the violation (typically a missing label, role, or contrast).
- **`Smoke route X produced errors`** — a `pageerror` (uncaught exception) or
  `console.error` fired while loading. Check the browser console manually, then fix
  the underlying issue.
- **Puppeteer launch failure on Linux / WSL2** — usually a missing system Chromium
  shared library. Either install the deps Puppeteer's `install.mjs` script
  recommends, or set `PUPPETEER_EXECUTABLE_PATH` to a system Chrome/Chromium binary.
