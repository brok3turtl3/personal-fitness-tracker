# Phase 2: Diet UX Overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 2-diet-ux-overhaul
**Areas discussed:** Quick-add placement, Units & density model, Search/recents/favorites, Daily totals & targets (all delegated to Claude)

---

## Gray-area selection

The user was presented four phase-specific gray areas (Quick-add placement, Units & density model, Search/recents/favorites, Daily totals & targets) as a multiSelect, with the option to pick any or none and delegate.

| Option | Description | Selected |
|--------|-------------|----------|
| Quick-add placement (DIET-01) | Inline quick-add in the meal-log flow vs modal vs separate panel | (delegated) |
| Units & density model (DIET-02/03) | Which units + how to capture density without friction; `convert` vs hand-rolled | (delegated) |
| Search / recents / favorites (DIET-04) | Match style; auto vs manual favorites | (delegated) |
| Daily totals & targets (DIET-06) | Where targets live; %-of-target display; global vs per-day | (delegated) |

**User's choice (verbatim):** *"I defer all decisions to you. You should prioritize user experience. The user should be able to easily find macro nutrient information for new foods and once food should not have to search for them again. they will be available to use again easily. The units need to be flexible and easy to use. Just make the whole thing easy to use and feature rich."*

**Notes:** Consistent with the standing delegation pattern from Phases 3/4/5 (north star: best practices + codebase patterns + UX). Three vision signals extracted and locked into CONTEXT.md decisions: (1) effortless first-time macro entry + permanent library reuse (no re-entering a food); (2) flexible, easy units; (3) feature-rich but easy throughout. The "easily find macro information" signal was pinned to *manual entry + reuse* (not an external food DB) because an external nutrition API would violate the Phase 5 CSP egress lock + LocalStorage-only constraint (CONTEXT D-14).

---

## Todos

| Option | Description | Selected |
|--------|-------------|----------|
| None — all resolved/out-of-scope | Block-action errors shipped (Phase 5); Phase-4 UAT is a Phase-4 item; meal-note redaction decided (Phase 5 D-10) | ✓ |
| Meal-note redaction | Fold anyway | |
| Block-action errors | Fold anyway | |

**User's choice:** None — all resolved/out-of-scope.
**Notes:** All three keyword-matched todos were assessed as already-resolved or belonging to other phases; recorded as Reviewed-not-folded in CONTEXT.md.

---

## Claude's Discretion

The entire phase's HOW decisions were delegated to Claude. Locked calls: D-01..D-14 in CONTEXT.md. Research/planning may still refine the conversion-library choice, favorite-ranking formula, chart series styling, and target-editor placement — the WHAT is locked.

## Deferred Ideas

- AI-assisted macro estimation for new foods (via the existing Anthropic path) — future AI-depth phase.
- External food database / barcode lookup — out (CSP + LocalStorage-only constraints).
- Manual favorite pinning — after auto-ranking.
- Per-day target overrides — after the single persistent target set.
