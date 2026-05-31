---
phase: 05-web-search-grounding-quality-sweep
plan: 01
subsystem: dev-tooling + test-infra
tags: [stryker, mutation-testing, fixtures, web-search, csp, a11y, color-contrast, wave-0]
requires: []
provides:
  - "stryker.config.json + npm run mutation (validators.ts mutation testing, QUAL-10)"
  - "web-citation-parser.fixtures.ts F1–F14 (shared web-search reference dataset)"
  - "src/index.html.csp-assertion.spec.ts (QUAL-06 CSP contract)"
  - "color-contrast axe deferral lifted on 4 characterization specs (QUAL-08)"
affects:
  - "05-02 (web-citation-parser + serializer — consumes F1–F8, F13)"
  - "05-05 (runAgenticLoop — consumes F9–F12)"
  - "05-08 (renderer E1 adversarial — consumes F1–F8)"
  - "05-07 (CSP <meta> must match the 05-01 contract)"
  - "05-09 (mutation-score floor; contrast palette fix for the 5 red specs)"
tech-stack:
  added:
    - "@stryker-mutator/core@9.6.1 (devDependency)"
    - "@stryker-mutator/karma-runner@9.6.1 (devDependency)"
  patterns:
    - "Stryker angular-cli runner reuses the project's existing karma.conf.js (A2 path)"
    - "Test fixture module type-imports the SDK Message (test-only; zero production importers)"
    - "CSP encoded as a compile-time contract spec ahead of the runtime <meta> (05-07)"
key-files:
  created:
    - "stryker.config.json"
    - "src/app/services/web-citation-parser.fixtures.ts"
    - "src/index.html.csp-assertion.spec.ts"
  modified:
    - "package.json (mutation script + 2 devDeps)"
    - "package-lock.json"
    - ".gitignore (reports/mutation/, .stryker-tmp/)"
    - "src/app/features/diet/diet-page.component.spec.ts"
    - "src/app/features/chat/chat-page.component.spec.ts"
    - "src/app/features/charts/charts-page.component.spec.ts"
    - "src/app/features/reports/report-page.component.spec.ts"
decisions:
  - "A2 resolved by reusing the existing karma.conf.js (configFile) — no `ng generate config karma` needed"
  - "Stryker uses the ChromeHeadlessNoSandbox launcher (WSL2 needs --no-sandbox)"
  - "CSP contract encoded as a constant-asserting spec (no reliable index.html DOM read in Karma)"
  - "Contrast deferral lifted leaves 5 specs RED by design — handed to 05-09, not re-masked (D-15 / T-05-01-04)"
metrics:
  duration: "~13m wall (incl. an 8m30s Stryker baseline run)"
  tasks: "3/3"
  files: "11 (3 created, 8 modified)"
  completed: "2026-05-31"
---

# Phase 5 Plan 01: Wave-0 Test/Infra Scaffolding Summary

Stryker mutation testing wired to `validators.ts` (baseline 22.65%), the F1–F14 canned web-search `Message` reference dataset authored for every downstream web-search spec, the QUAL-06 CSP policy encoded as a contract spec, and the Phase 1 `color-contrast` axe deferral lifted across the four characterization specs (QUAL-08) — surfacing the real palette failures for 05-09 rather than masking them.

## What Shipped

### Task 1 — Stryker for validators.ts (QUAL-10 scaffold) — `172aa16`
- Installed `@stryker-mutator/core@9.6.1` + `@stryker-mutator/karma-runner@9.6.1` (both resolve to 9.6.1).
- `stryker.config.json`: `testRunner: karma`, `karma.projectType: angular-cli`, `mutate: ["src/app/services/validators.ts"]`, `coverageAnalysis: perTest`, `reporters: [html, clear-text, progress]`, `concurrency: 2`, `$schema` pointing at the installed schema.
- `.gitignore`: `reports/mutation/` + `.stryker-tmp/`. `package.json`: `"mutation": "stryker run"`.
- **A2 resolved (documented):** the project already has a checked-in `karma.conf.js` (landed in Phase 1, plan 01-01). Stryker's `angular-cli` runner was pointed at it via `karma.configFile: "karma.conf.js"`, so **no `ng generate config karma` was required**. To run headless under WSL2, the config selects the existing `ChromeHeadlessNoSandbox` custom launcher (`base: ChromeHeadless`, `flags: ['--no-sandbox']`) already defined in that karma.conf.
- **Baseline run:** `npx stryker run` completed (8m30s), emitted `reports/mutation/mutation.html`. **Mutation score 22.65%** (76 killed / 13 timeout / 259 survived / 45 no-cover). No floor pinned here — that is 05-09's job after this baseline.

### Task 2 — F1–F14 web-search fixtures — `64ea680`
- `src/app/services/web-citation-parser.fixtures.ts`: 14 logical fixtures (17 named exports) typed as the SDK `Message` via a small `msg()` envelope helper + typed builders (`serverToolUse`, `webResult`, `webResultBlock`, `webErrorBlock`, `citation`).
- Coverage of the AI-SPEC §5 matrix: F1 web-OFF adversarial prose (`Smith et al. 2021` + bare DOI, no citations); F2 grounded; F3 grounded + prose `Jones 2020`; F4 un-grounded; F5 mixed grounded/un-grounded; F6 non-https (`http:`/`ftp:`); F7 `title: null`; F8 duplicate url; F9 `F9_PAUSED`/`F9_RESUME`; F10 clean server-tool turn; F11 `max_uses_exceeded`; F12 `F12_TOO_MANY`/`F12_QUERY_LONG`; F13 `F13_TURN1`/`F13_TURN2` (byte-stable `encrypted_content`/`encrypted_index`); F14 `F14_PII_BAIT_PROMPT: string`.
- Type-compiles under `tsconfig.spec.json` (exit 0). JSDoc header documents the SDK type-import allowance and the test-only/no-production-importer invariant. **Acceptance grep confirms zero production importers.**

### Task 3 — CSP contract spec + color-contrast deferral lift — `fce067c`
- `src/index.html.csp-assertion.spec.ts`: encodes `EXPECTED_CSP` and asserts the load-bearing substrings — `connect-src 'self' https://api.anthropic.com`, `object-src 'none'`, `style-src 'self' 'unsafe-inline'` (A1), plus `default-src 'self'`, `script-src 'self'`, `img-src 'self' data:`. **6/6 pass.** A comment points at 05-07 (adds the matching `<meta>` + e2e console-error runtime check).
- Removed the `disableRules: ['color-contrast']` argument from all five `expectNoSeriousA11yViolations` call-sites across the four characterization specs (chat has two). Acceptance grep `! grep "color-contrast"` returns clean (comments reworded to avoid the literal token, same edge case the Phase 4 executor handled on literal grep gates).

## Verification

- Task 1 verify block: PASS (config present, projectType/validators.ts/stryker-tmp greps green, SDK package resolvable). All acceptance criteria green incl. the baseline `reports/mutation/` HTML.
- Task 2 verify block: `tsc --noEmit -p tsconfig.spec.json` exit 0; all 14 fixtures present; F6 non-https, F7 null-title, F8 dup-url, F11/F12 error codes confirmed; zero production importers.
- Task 3 verify block: CSP spec 6/6 SUCCESS under `ng test --no-watch`; no `color-contrast` literal remains in the four specs.
- `ng build --configuration=production`: **exit 0** (two pre-existing budget warnings — 4.96 kB initial + 69 B chat-message-list component CSS — not regressions; same warnings documented across Phase 4 sessions). No production code was touched by this plan.

## Deviations from Plan

### Auto-fixed / adjusted (no architectural change)

**1. [Rule 3 — Blocking infra] Stryker headless launcher for WSL2**
- **Found during:** Task 1, first `npx stryker run`.
- **Issue:** The plan's `<interfaces>` block specifies `karma.config.browsers: ["ChromeHeadless"]`. Plain `ChromeHeadless` fails to launch under this WSL2 harness (needs `--no-sandbox`, the reason Phase 1's karma.conf defined a `ChromeHeadlessNoSandbox` custom launcher).
- **Fix:** `stryker.config.json` selects `browsers: ["ChromeHeadlessNoSandbox"]` and sets `karma.configFile: "karma.conf.js"` so the custom launcher resolves. This is the A2 resolution path (reuse existing karma.conf), which the plan explicitly authorized documenting.
- **Files:** `stryker.config.json`. **Commit:** `172aa16`.

**2. [Rule 1 — Literal grep gate] Reworded comments to drop the `color-contrast` literal**
- **Found during:** Task 3 verification.
- **Issue:** My first comment edits kept the literal phrase `color-contrast` in prose, which tripped the acceptance gate `! grep -rn "color-contrast" …` (intended to detect a remaining `disableRules: ['color-contrast']`).
- **Fix:** Reworded the comments to "contrast" / "axe contrast checking" — meaning preserved, literal token gone. Documentation-only; no behavior change.
- **Files:** the four characterization specs. **Commit:** `fce067c`.

## Handoff to 05-09 — Real contrast failures surfaced (expected, not masked)

Per Task 3 action step 2 (and T-05-01-04 "no silent re-deferral"), lifting the deferral surfaced genuine WCAG-AA `color-contrast` violations. These specs are **intentionally left RED** for 05-09's palette pass. Offending palette (per `a11y-test-helpers.ts` header): muted text `#7f8c8d` (~3.15:1) and primary `#3498db` (~3.47:1), both below the 4.5:1 AA threshold.

| Spec (file) | Failing `it` | `color-contrast` nodes |
|-------------|--------------|------------------------|
| `diet-page.component.spec.ts` | no serious/critical axe violations on initial load | 14 |
| `report-page.component.spec.ts` | no serious/critical axe violations on initial load | 18 |
| `chat-page.component.spec.ts` | no serious/critical axe violations on initial load | 5 |
| `chat-page.component.spec.ts` | expectNoSeriousA11yViolations when a pending pill is in the chat stream | 4 |
| `charts-page.component.spec.ts` | no serious/critical axe violations on initial load | 1 |

**5 specs RED, all single `serious` `color-contrast` violation each.** 05-09's contrast pass (UI-SPEC §Color hex nudges) turns these green. No other spec regressed (the non-contrast assertions in these files still pass — 33/38 SUCCESS in the targeted run).

## Threat-Model Compliance

- **T-05-01-01 (Tampering / Stryker):** `mutate` glob pinned to `src/app/services/validators.ts` only; no production source mutated/shipped; `reports/mutation/` + `.stryker-tmp/` gitignored.
- **T-05-01-02 (Info Disclosure / fixtures):** fixtures carry only synthetic/canned data; acceptance grep proves zero production importers.
- **T-05-01-03 (Tampering / CSP):** the spec locks `connect-src` to `self` + `https://api.anthropic.com` only and `object-src 'none'` — the QUAL-06 egress allow-list, encoded before the meta tag lands.
- **T-05-01-04 (Repudiation / contrast deferral):** real contrast failures recorded for 05-09 (above) rather than re-deferred — no silent masking.

## No Stubs / No Threat Flags

No stub patterns introduced (the fixtures are intentional canned test data, fully wired into the downstream spec plans listed above). No new security surface beyond the CSP contract this plan exists to lock.

## Self-Check: PASSED

- Files: stryker.config.json, web-citation-parser.fixtures.ts, index.html.csp-assertion.spec.ts, 05-01-SUMMARY.md — all FOUND.
- Commits: 172aa16, 64ea680, fce067c — all FOUND in git log.
