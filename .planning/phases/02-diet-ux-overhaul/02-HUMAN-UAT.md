---
status: passed
phase: 02-diet-ux-overhaul
source: [02-VERIFICATION.md]
started: 2026-06-02T00:40:00.000Z
updated: 2026-06-03T11:18:44.000Z
---

## Current Test

[complete — user ran the dev server and approved 2026-06-03]

## Tests

### 1. DIET-02 — end-to-end named-serving path
expected: Add a new food with base unit `g`. After saving, use the custom-serving form to add a serving labeled "1 cup" (unit=`cup`, amount=`236`). In the meal-log, search the food, select it, choose the "1 cup" serving, log quantity 2. Macros shown should equal the food's per-gram nutrition × 472 (2 × 236 g), and the "1 cup" serving must be selectable without error.
result: passed (user approved 2026-06-03)

### 2. (smoke) SC-1 — inline quick-add
expected: While logging a meal, type a food name that does not exist. An inline quick-add form appears (no modal / no navigation). Enter name + calories + macros + native unit, "Add food & log it" → the food is saved to the library AND immediately staged as a pending item.
result: passed (user approved 2026-06-03)

### 3. (smoke) SC-3 — search / Recent / Frequent + copy-a-meal
expected: Search-as-you-type filters the library; on focus, a "Recent" group and an auto-ranked "Frequent" group appear (labels are "Recent"/"Frequent", not "Favorites"). "Repeat yesterday" / "Copy from another day…" stage that day's items as editable pending items in one action.
result: passed (user approved 2026-06-03)

### 4. (smoke) SC-4 — live totals + %-of-target bars + charts
expected: Daily totals (kcal, protein, fat, carbs, net carbs) update live as items are added. When per-day targets are set, %-of-target bars render with a text label (and an over-target state). The charts page shows a diet calories series plus separately-toggleable protein/fat/carbs/net-carbs series alongside cardio/weight/readings, driven by the date-range filter.
result: passed (user approved 2026-06-03)

### 5. (smoke) SC-5 — snapshot immutability
expected: Log a meal, then edit the saved food's macros. The already-logged history entry's nutrition / serving / unit is unchanged (snapshotted at log time).
result: passed (user approved 2026-06-03)

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none recorded yet — fill in if any test reports an issue)
