# Quickstart: Diet Logging (Manual Food Library)

**Feature**: 006-diet-usda
**Date**: 2026-01-31

## Run

```bash
ng serve
```

## Verify (Manual)

1. Navigate to `/diet`.
2. Add a food by entering nutrition per unit (per 1 g or per 1 tbsp).
3. Add a custom serving preset.
4. Create a meal with one or more items and verify per-meal and daily totals.
5. Refresh the page; confirm saved foods and meals persist.

## Verify (Automated)

```bash
ng test --no-watch
ng build --configuration=production
```
