# Deferred Items — Phase 05

Out-of-scope discoveries logged during execution. NOT fixed in the discovering plan.

## From 05-06 (edit-mode UI wiring)

- **Global `.btn-*` + muted-text palette fails axe `color-contrast` (WCAG AA).**
  - Discovered: 05-06 Task 1 (cardio edit-mode a11y spec).
  - Failing nodes in any feature-page fixture: `.btn-primary` (`#3498db`, ~3.15:1),
    `.btn-secondary` (`#95a5a6`, ~2.56:1), `.btn-danger` (`#e74c3c`, ~3.82:1),
    `.history-item-date`/`.history-item-notes` (`#7f8c8d`, ~3.48:1),
    `.char-count`/`.empty-state` (`#95a5a6`).
  - Root cause: `src/styles.css` global palette (white text on light accent/grey/red;
    muted greys on white). Pre-dates this plan; `styles.css` is NOT in 05-06's
    `files_modified`.
  - Owner: **QUAL-08/QUAL-09 cross-page color-contrast sweep** (05-UI-SPEC Color §,
    "the executor confirms ... clear WCAG AA, nudging the hex only if a row fails").
    Suggested compliant nudges (white-on-X ≥ 4.5:1): `.btn-primary` → `#2471a3`,
    `.btn-secondary` → `#5d6d6e`, `.btn-danger` → `#c0392b`, muted text → `#5f6c6d`.
  - 05-06 specs run the full severe a11y gate (label association, ARIA, focus order,
    landmarks) on the edit render and disable ONLY `color-contrast` with a documented
    pointer here — matching the landed Phase 5 specs (settings-memory, chat).
