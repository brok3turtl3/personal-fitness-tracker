# Quickstart: Cardio Session Calories

**Feature**: 002-cardio-calories
**Date**: 2026-01-30

## Prerequisites

- Node.js + npm installed
- Install dependencies: `npm ci`

## Run

```bash
ng serve
```

Open http://localhost:4200 and navigate to `/cardio`.

## Verify (Manual)

1. Add a cardio session with calories (e.g., 450) and submit.
2. Confirm the history list shows calories for the new session.
3. Refresh the page; confirm calories are still shown.
4. Add a session without calories; confirm it saves and renders.
5. Try invalid calories (e.g., -1, 999999); confirm validation blocks save.

## Verify (Automated)

```bash
ng test --no-watch
ng build --configuration=production
```
