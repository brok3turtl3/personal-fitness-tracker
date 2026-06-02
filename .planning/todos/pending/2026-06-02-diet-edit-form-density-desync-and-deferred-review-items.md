---
created: 2026-06-02T00:30:00.000Z
title: Diet edit-form density desync + deferred Phase 2 review items
area: ui
source: 02-REVIEW.md WR-05, WR-06, IN-01/03/05/06
severity: warning
files:
  - src/app/features/diet/diet-page.component.ts:1130
  - src/app/services/diet.service.ts:172
  - src/app/services/storage.service.ts:601
---

## Problem

Findings from the Phase 2 code review (`02-REVIEW.md`) that were intentionally deferred
from the in-scope fix pass (CR-01 + WR-01/02/04/07 were fixed and shipped). These remain
open:

- **WR-05 (warning) — edit-form density desync.** When the user clears the `gramsPerTbsp`
  input on an existing food, `updateSavedFood` overwrites `gramsPerTbsp` to `undefined` but
  **preserves** the previously-derived `densityGramsPerMl` (and the auto-added tbsp serving).
  The edit UI never exposes `densityGramsPerMl`, so the food keeps a conversion density the
  user can no longer see or control — form no longer matches behavior. Needs a UX decision:
  either drop the derived density (and tbsp serving) when `gramsPerTbsp` is cleared, or
  surface `densityGramsPerMl` directly in the edit form.
- **WR-06 (warning) — migration comment overstates safety.** `migrateV4ToV5`'s `.map` walks
  (pre-existing Phase 3 code) assume `chatConversations`/`messages` are arrays, while the
  V5→V6 / V6→V7 hops `?? []`-coerce. Comments claim the transforms "coerce rather than
  throwing." Either add `Array.isArray(...)` guards before the V4→V5 `.map`s, or correct the
  comments to state malformed intermediate shapes intentionally throw → `MIGRATION_FAILED`
  (which the malformed-matrix tests already accept). Low risk; touches Phase-3 code so left
  untouched here.
- **Quick-add default serving (optional enhancement, follow-on to WR-01).** The WR-01 fix
  now blocks meal save when any pending item lacks a serving (no more silent drop). A nicer
  UX: stage quick-added items with the food's first serving so they are never serving-less.
  Small change in `onQuickAdd`.
- **IN-01** dead `dailyTotals` state (computed, unused — the live target bars use `liveTotals`
  by design; either wire `dailyTotals` into a "logged today" display or remove the field).
- **IN-03** `safeNumber` duplicated across `units.ts` / `diet.service.ts` / `storage.service.ts`.
- **IN-05** redundant `loadFoods()` calls on add/quick-add paths (readability).
- **IN-06** charts→`/report` query-param hand-off omits the diet toggles (incomplete contract
  if `/report` is meant to mirror diet selections).

## Solution

Good candidate for a future quality/polish pass. WR-05 is the only one carrying real
user-facing risk and should be decided first (drop-derived-density vs. expose-density-in-form).
The rest are low-severity maintainability/cleanup. CR-01's consolidation already closed IN-02
(duplicated `ML_PER_TBSP`) and IN-04 (duplicated dimension logic) by single-sourcing them in
`units.ts`.
