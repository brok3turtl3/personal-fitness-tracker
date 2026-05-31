---
created: 2026-05-31T19:18:46.222Z
title: Clarify meal-note redaction granularity for AI context
area: ui
source: 04-REVIEW.md OQ-1 (from CR-04 fix)
severity: product-question
files:
  - src/app/services/fitness-context.service.ts
  - src/app/features/settings/settings-ai.component.ts
---

## Problem

Open product question surfaced while fixing Phase 4 code-review blocker CR-04.
The "Send meal notes to AI" settings toggle's UI copy implies it strips *free-text
per-entry meal notes* from what the AI sees. But `FitnessContextService.nutritionFacts()`
only ever emitted a single aggregate total-kcal line — there was no per-entry free-text
note in the system-prompt context to begin with. The CR-04 fix now gates that kcal line on
the `redactMealNotes` toggle, which honors the toggle as currently built.

The mismatch: if the product intent is genuinely to redact free-text per-entry meal notes
(e.g. once `query_meals` results or richer context start carrying them), the toggle needs to
filter those too — not just the aggregate line.

## Solution

TBD — product decision. Confirm intended behavior:
1. Is "redact meal notes" meant to cover free-text per-entry notes specifically, or any
   meal-derived data the AI sees (totals included)?
2. Do `query_meals_in_range` tool results expose free-text notes? If so, the toggle should
   also constrain that tool's output, not only the system-prompt header.
Align the settings copy and the redaction surface once decided. Revisit before Phase 5 closes.
