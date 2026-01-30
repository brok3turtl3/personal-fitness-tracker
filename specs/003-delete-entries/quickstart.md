# Quickstart: Delete Entries

**Feature**: 003-delete-entries
**Date**: 2026-01-30

## Run

```bash
ng serve
```

## Verify (Manual)

1. Cardio: add a session, click Delete, confirm, verify it disappears; refresh and verify it stays gone.
2. Weight: add an entry, delete, verify; refresh and verify.
3. Readings: add a reading (any type), delete, verify; refresh and verify.
4. Cancel the confirmation prompt and verify no deletion occurs.

## Verify (Automated)

```bash
ng test --no-watch
ng build --configuration=production
```
