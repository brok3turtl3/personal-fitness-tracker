---
phase: 05-web-search-grounding-quality-sweep
plan: 07
subsystem: app-shell-safety
tags: [quota-banner, multi-tab, csp, accessibility, quality-sweep]
requires:
  - "StorageService.getStorageInfo().usagePct (05-04)"
  - "StorageService.getLastModified() (05-04)"
  - "StorageService.getBackup(key) (01-10)"
  - "recovery-banner app-level placement pattern (01-10)"
provides:
  - "app-level 70%/95% quota banners (QUAL-02, D-14)"
  - "multi-tab data-changed banner via storage event (QUAL-04)"
  - "CSP meta tag locking egress to api.anthropic.com (QUAL-06, A1)"
  - "e2e CSP console-error check"
affects:
  - "src/app/app.component.ts (banner host + storage listener)"
  - "src/index.html (CSP policy)"
  - "angular.json (production optimization)"
tech-stack:
  added: []
  patterns:
    - "component-scoped banner styles composing the recovery-banner placement pattern"
    - "window storage-event listener with lastModified comparison (Pitfall 6)"
    - "synthetic StorageEvent in Karma to test cross-tab behavior"
key-files:
  created:
    - src/app/shared/quota-banner.component.ts
    - src/app/shared/quota-banner.component.spec.ts
    - src/app/shared/multi-tab-banner.component.ts
    - src/app/shared/multi-tab-banner.component.spec.ts
    - e2e/csp.spec.mjs
  modified:
    - src/app/app.component.ts
    - src/app/app.component.html
    - src/app/app.component.spec.ts
    - src/index.html
    - e2e/run.mjs
    - angular.json
decisions:
  - "Banner stacking collapsed to single most-severe quota state (block > multi-tab > warn) per 05-UI-SPEC latitude"
  - "Manage storage routes to /settings/ai (the management hub; per-entry delete lives on data pages via nav)"
  - "Multi-tab Refresh = window.location.reload() (least-surprising for a local SPA — guarantees cache + all pages re-read)"
  - "Warn title nudged #b9770e → #8a5808 for WCAG AA (QUAL-08 'nudge hex if a row fails'); #b9770e kept as border"
  - "Banner buttons use component-scoped dark-neutral colors (global .btn-primary/.btn-secondary palette fails AA — that sweep is 05-09)"
  - "A1 resolved by disabling angular.json inlineCritical (its <link onload> inline handler violated script-src 'self') — keeps script-src tight, no connect-src loosening"
metrics:
  duration: ~35m
  tasks: 2
  files: 11
  completed: 2026-05-31
---

# Phase 5 Plan 07: App-Level Quota + Multi-Tab Banners + CSP Meta Summary

App-level safety UI for the quality sweep: honest 70%/95% storage-quota banners and a cross-tab "data changed elsewhere" banner, both driven through the StorageService chokepoint, plus a CSP meta tag that locks the app's only external egress to the Anthropic API — QUAL-02/04/06 complete.

## What Was Built

### Task 1 — Quota + multi-tab banners + app.component wiring (commit 9f021c1)

- **`quota-banner.component.ts`** — standalone component with two modes driven by the host's `usagePct` read:
  - `warn` (≥70%): amber `#fdf3e7` surface, `⚠`, `role="status"` `aria-live="polite"`, dismissible, LOCKED copy with `{pct}` token, `Dismiss` action.
  - `block` (≥95%): red `#fdeaea` surface, `⛔`, `role="alert"` `aria-live="assertive"`, persistent, LOCKED copy, `Manage storage` primary + `Copy all data as JSON` safety valve (D-14 — reuses the recovery-banner clipboard feature-detect + `<textarea>` fallback; NOT an export feature).
  - Triple-encoding: color + icon + text on every state. Component-scoped styles only (no new global CSS).
- **`multi-tab-banner.component.ts`** — neutral informational banner (`#f8f9fa`/`#2c3e50`/`#ddd`, `🔄`, `role="status"` `aria-live="polite"`, NOT error-colored), LOCKED copy, `Refresh` + `Dismiss`.
- **`app.component`** hosts both ahead of `<router-outlet>` beside the existing recovery banner, stacked by severity (collapsed to the single most-severe quota state: 95% block > multi-tab > 70% warn). On init + on the migration-clear path it reads `StorageService.getStorageInfo().usagePct` (falls back to `percentUsed` on older browsers) and sets the banner mode; the 95% block reads all-data JSON via `getBackup(STORAGE_KEY)` (chokepoint). A `window` `storage` listener (registered in `ngOnInit`, removed via `destroyRef.onDestroy`) compares the incoming event's parsed `lastModified` against `getLastModified()` (Pitfall 6 — the event only fires in other tabs) and raises the multi-tab banner on a difference, ignoring unrelated keys / malformed payloads. All subscribes pipe through `takeUntilDestroyed(this.destroyRef)`. No direct `localStorage.*` in app.component (chokepoint grep gate green). Banners never call `.focus()`.
- **Specs:** quota-banner (10 — warn/block LOCKED copy + roles + icons + clipboard path + a11y), multi-tab-banner (4 — LOCKED copy + neutral styling + Refresh/Dismiss + a11y), app.component (16 total — synthetic StorageEvent with differing/matching lastModified + unrelated-key + malformed; 70/95 usagePct thresholds; warn dismiss-and-stay; no focus steal).

### Task 2 — CSP meta tag + e2e console-error check (commit ae2abb2)

- **`src/index.html`** — `<meta http-equiv="Content-Security-Policy">` with the exact locked policy: `default-src 'self'; connect-src 'self' https://api.anthropic.com; script-src 'self'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline';`. `connect-src` is the egress allow-list (Anthropic API as the sole external path); matches the 05-01 contract spec.
- **`e2e/csp.spec.mjs`** — Puppeteer check: asserts the CSP meta is present with the locked `connect-src`/`object-src`/`style-src` directives and ZERO `Refused to ...` console violations on `/#/chat`; wired into `e2e/run.mjs` (operator-verified in the two-terminal flow, not run in CI by the executor).
- **A1 styled-load verification (resolved concretely):** built `ng build --configuration=production` (exit 0) and served the bundle in headless Chrome. Angular's inline component `<style>` tags load with NO "Refused to apply inline style" — `style-src 'self' 'unsafe-inline'` is exactly the right and sufficient directive. (See deviations for the one inline-handler finding and its fix.)

## Verification Results

- quota-banner.component.spec: **10 SUCCESS** (incl. color-contrast a11y)
- multi-tab-banner.component.spec: **4 SUCCESS** (incl. color-contrast a11y)
- app.component.spec: **16 SUCCESS** (synthetic StorageEvent + 70/95 thresholds + no focus steal)
- index.html.csp-assertion.spec (05-01 contract): **6 SUCCESS**
- All four targeted specs together: **36 SUCCESS**
- Chokepoint gate: `! grep localStorage.(getItem|setItem|removeItem) src/app/app.component.ts` → no matches
- `addEventListener('storage'` present (count 2); `getStorageInfo|usagePct` present (count 4)
- CSP grep gates: `Content-Security-Policy` count === 1; connect-src/object-src/style-src present; no wildcard/`http:` connect-src
- `node --check e2e/csp.spec.mjs` + `node --check e2e/run.mjs` OK
- `ng build --configuration=production`: **exit 0** (pre-existing budget warnings only — initial bundle, cardio/readings/chat-message-list component CSS; not regressions)
- A1: served prod build in headless Chrome → CSP meta present, inline styles applied (3 `<style>` tags), **zero CSP violations**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] WCAG AA contrast on the warn-banner title**
- **Found during:** Task 1 (color-contrast axe rule, now in-scope per QUAL-08).
- **Issue:** The 05-UI-SPEC locked warn text `#b9770e` on `#fdf3e7` is 3.36:1 — below the WCAG AA 4.5:1 threshold the QUAL-08 contrast enforcement now applies to new banner surfaces.
- **Fix:** Nudged the warn **title** color to `#8a5808` (5.50:1) per the UI-SPEC "nudge the hex only if a row fails" allowance; kept `#b9770e` as the warn border. Block title `#c0392b` on `#fdeaea` is 4.70:1 — clears AA, used as-is. Body/control text set to high-contrast `#2c3e50`.
- **Files:** src/app/shared/quota-banner.component.ts
- **Commit:** 9f021c1

**2. [Rule 2 — Missing critical functionality] Banner buttons decoupled from the failing global palette**
- **Found during:** Task 1 (axe flagged `.btn-primary` `#3498db` = 3.15:1 and `.btn-secondary` `#95a5a6` = 2.55:1 — both below AA).
- **Issue:** The global `.btn-primary`/`.btn-secondary` palettes in `src/styles.css` fail AA contrast. Fixing them globally is 05-09's cross-app contrast sweep (and would prematurely flip the 5 intentionally-RED characterization specs owned by 05-09).
- **Fix:** Gave the banner action buttons component-scoped dark-neutral colors (white on `#2c3e50`, 10.98:1) in both banner components, leaving the shared `src/styles.css` palette untouched for 05-09.
- **Files:** src/app/shared/quota-banner.component.ts, src/app/shared/multi-tab-banner.component.ts
- **Commit:** 9f021c1

**3. [Rule 3 — Blocking issue] A1: CSP-violating inline event handler from the production build**
- **Found during:** Task 2 (A1 styled-load verification).
- **Issue:** Angular CLI's default production `inlineCritical` optimization injects `<link rel="stylesheet" media="print" onload="this.media='all'">` — an **inline event handler** that `script-src 'self'` blocks (a `Refused to` console violation). Inline component styles themselves loaded fine under `style-src 'unsafe-inline'`; this was a separate script-surface finding.
- **Fix:** Set `optimization.styles.inlineCritical: false` in the `angular.json` production config. This drops the inline handler WITHOUT loosening `script-src` (the threat-model `T-05-07-04` accept stays scoped to `style-src` only — `script-src` stays tight at `'self'`, no inline-script keyword added) and WITHOUT touching `connect-src`. Re-verified: zero CSP violations after rebuild.
- **Files:** angular.json
- **Commit:** ae2abb2

## Threat-Model Compliance

- **T-05-07-01 (Info Disclosure — CSP egress):** `connect-src 'self' https://api.anthropic.com` + `object-src 'none'` committed; e2e console-error check verifies enforcement.
- **T-05-07-02 (DoS — 95% block):** persistent block banner + archive/delete routing + copy-JSON safety valve (D-14).
- **T-05-07-03 (Tampering — multi-tab):** storage-event listener compares lastModified and prompts Refresh before stale overwrite (Pitfall 6).
- **T-05-07-04 (Tampering — style-src 'unsafe-inline'):** accepted, documented; A1 confirmed it is required for Angular inline styles. `script-src` stays `'self'` (the inlineCritical inline handler was removed rather than allowed).
- **T-05-07-05 (Tampering — banner storage access):** all quota/lastModified/backup access through StorageService; app.component chokepoint grep gate green.

## Known Stubs

None. All banner data is wired to live StorageService reads; no placeholder/empty-value flows.

## Self-Check: PASSED

- Files created — all FOUND: quota-banner.component.ts(+spec), multi-tab-banner.component.ts(+spec), e2e/csp.spec.mjs.
- Files modified — all present: app.component.ts/html/spec, src/index.html, e2e/run.mjs, angular.json.
- Commits — both FOUND in git log: 9f021c1 (Task 1), ae2abb2 (Task 2).
