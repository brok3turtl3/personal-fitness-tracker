# Quickstart: Printable Reports

**Feature**: 005-printable-reports
**Date**: 2026-01-31

## Run

```bash
ng serve
```

## Verify (Manual)

1. Go to `/charts` and select a range.
2. Click Print/Export.
3. In the browser print dialog, choose "Save as PDF".
4. Verify title/range/timestamp + summaries + charts.

## Verify (Automated)

```bash
ng test --no-watch
ng build --configuration=production
```
