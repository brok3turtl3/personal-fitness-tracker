---
phase: 5
slug: web-search-grounding-quality-sweep
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jasmine + Karma (Angular CLI defaults) + axe-core (a11y) + Stryker (mutation, installed Wave 0) |
| **Config file** | `angular.json` test target; `karma.conf.js` may be needed for Stryker (verify A2) |
| **Quick run command** | `ng test --no-watch` |
| **Full suite command** | `ng test --no-watch --code-coverage` |
| **Estimated runtime** | ~30–90 seconds (unit); Stryker mutation run is minutes (one critical service only) |

---

## Sampling Rate

- **After every task commit:** Run `ng test --no-watch`
- **After every plan wave:** Run `ng test --no-watch --code-coverage`
- **Before `/gsd-verify-work`:** Full suite green + `ng build --configuration=production` succeeds + axe-core zero serious/critical
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> Populated per-plan during planning. Each task carries an `<acceptance_criteria>` with a grep/test-verifiable signal. Key high-stakes signals:

| Requirement | Test Type | Automated Signal | Status |
|-------------|-----------|------------------|--------|
| RESCH-01 (grounded citations) | unit | web-citation-parser maps `web_search_tool_result` → linkable `web_search_result_location` citation blocks; fixtures F1–F14 | ⬜ pending |
| RESCH-02 (https-only clickable) | unit | non-`https:` citation URLs render non-clickable | ⬜ pending |
| RESCH-03 (anti-fabrication) | adversarial regression | "find a study about X" prompt cannot yield an un-grounded clickable citation link | ⬜ pending |
| RESCH (cap) | unit | `webSearchMaxUses` cap bounds server-tool uses | ⬜ pending |
| QUAL CRUD parity | unit | edit preserves original `id` + `createdAt` for cardio/weight/readings | ⬜ pending |
| QUAL quota | unit | 70% warn / 95% block via `navigator.storage.estimate()`; matches `QuotaExceededError` + `NS_ERROR_DOM_QUOTA_REACHED` | ⬜ pending |
| QUAL multi-tab | integration | `storage` event triggers "data changed elsewhere" banner | ⬜ pending |
| QUAL 401/key-rotation | unit | stale 401 surfaces rotate/re-enter prompt, not console error | ⬜ pending |
| QUAL CSP | build/runtime | only `https://api.anthropic.com` connect-src allowed; `style-src 'self' 'unsafe-inline'` present (A1) | ⬜ pending |
| QUAL a11y | axe-core | zero serious/critical violations across 8 feature pages | ⬜ pending |
| QUAL mutation | Stryker | mutation score ≥ pinned floor on ≥1 critical service | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web-citation-parser` test stubs + fixtures F1–F14 (web_search_tool_result / citation / error response shapes) — 05-01 Task 2
- [ ] Stryker install + config (`@stryker-mutator/core` + `karma-runner`, `projectType: angular-cli`; verify `karma.conf.js` need — A2) — 05-01 Task 1
- [ ] CSP assertion test (connect-src restricted to `https://api.anthropic.com`; `object-src 'none'`; `style-src 'self' 'unsafe-inline'` — A1) — 05-01 Task 3
- [ ] Verify Angular 18 inline-style CSP interaction (`style-src` value — A1) — committed + e2e-verified in 05-07 Task 2

> **NOTE (stale Wave-0 entry corrected):** "axe-core test harness wired into Karma for the 8 feature pages" was REMOVED — it is NOT a Wave-0 gap. The axe-core harness already exists from Phase 1 (`src/app/shared/a11y-test-helpers.ts` → `expectNoSeriousA11yViolations`) and the 8 feature pages already carry characterization a11y specs. The only remaining a11y work is **lifting the `color-contrast` deferral**, which is covered by **05-01 Task 3** (removes `disableRules: ['color-contrast']` from the diet/chat/charts/reports characterization specs) and finalized by **05-09 Task 3** (full pass + manual review). The CSP A1 `style-src` build/runtime check is covered by **05-07 Task 2** (committed meta tag + e2e console-error check).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live grounded web-search round-trip with real API key | RESCH-01 | Requires real Anthropic API call + network; not run in CI | Enable web search in `/settings`, ask a research question, confirm inline footnotes cite live `https:` sources |
| Keyboard-only navigation + visual color-contrast review across 8 pages | QUAL-08 | Keyboard traps / focus order / contrast distinguishability cannot be fully covered by axe-core | 05-09 Task 3 checkpoint — tab through all 8 pages + every interactive control; confirm no trap + state distinguishable without color |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (stale axe-core harness entry corrected — harness pre-exists from Phase 1)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-31
