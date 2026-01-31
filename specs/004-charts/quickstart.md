# Quickstart: Charts Dashboard

**Feature**: 004-charts
**Date**: 2026-01-30

## Run

```bash
npm install
ng serve
```

## Verify (Manual)

1. Navigate to `/charts` from the nav.
2. Toggle between preset ranges (30/90 days, 6 months, 1 year, all time) and ensure charts update.
3. Select Custom and set a start/end range; verify charts filter.
4. Set invalid custom range (start after end) and verify an error appears.

## Verify (Automated)

```bash
ng test --no-watch
ng build --configuration=production
```
