# Feature Summary

> **Note**: The TypeScript source code is the authoritative source of truth. This document is a reference from initial design and may not reflect later changes.

## 001 — Fitness Tracker MVP

Single-page-per-data-type entry and history views for cardio sessions, weight entries, and health readings (blood pressure, blood glucose, ketones). Each page has a form at the top and a newest-first history list below. All data persisted to LocalStorage via `StorageService` with schema versioning. Validation enforces ranges on all numeric fields. Three routes: `/cardio`, `/weight`, `/readings`.

**Key acceptance criteria**: Data persists across browser sessions. Form validation prevents invalid submissions with clear error messages showing valid ranges. All views keyboard-navigable.

## 002 — Cardio Session Calories

Added an optional `caloriesBurned` field (0–20,000 kcal) to cardio sessions. Backward-compatible — existing sessions without calories load and display normally. Calories shown in history list when present.

**Key acceptance criteria**: Calories persist across reloads. Existing stored sessions without calories still load without errors.

## 003 — Delete Entries

Added delete capability to all three data entry pages (cardio, weight, readings). Each entry in the history list has a Delete button that prompts for confirmation before removing. Deletions persist to LocalStorage. No schema migration required.

**Key acceptance criteria**: Deleted items stay deleted after refresh. Confirmation dialog prevents accidental deletion. Delete buttons are keyboard accessible with descriptive `aria-label`s.

## 004 — Charts Dashboard

Dedicated `/charts` route with chart.js line charts for all data types. Weight: line chart over time. Cardio: duration over time with optional distance/calories toggles. Readings: line charts per type (BP shows systolic+diastolic). Date range filter with presets (30d, 90d, 6m, 1y, all time) and custom start/end date. Empty-state messages when no data in range.

**Key acceptance criteria**: All charts render correctly for each dataset. Preset and custom date ranges filter all charts. Range selector is keyboard accessible.

## 005 — Printable Reports

Print/Export action on `/charts` opens a dedicated `/report` view optimized for printing. Report includes title, date range, generated timestamp, summary statistics, and charts. Uses browser print dialog (user can "Save as PDF"). Nav and interactive controls hidden in print. Chart sections kept together to avoid mid-chart page breaks.

**Key acceptance criteria**: Report matches chart selections at export time. Nav/controls excluded from print output. Empty-state shown for sections with no data in range.

## 006 — Diet Logging

New `/diet` route for meal and nutrition tracking. Users create a local food library with nutrition per base unit (per 1g or per 1 tbsp) and custom serving presets. Meals are composed of food items with serving sizes; nutrition scales accordingly. Tracks calories, protein, fat, carbs, fiber, sugar, sodium, and computed net carbs (max(0, carbs - fiber)). Daily totals displayed. Meal items store nutrition snapshots at log time (immutable even if food definitions change later). Supports edit and delete for logged meals. Requires schema migration to add diet containers to AppData.

**Key acceptance criteria**: Daily totals and net carbs are correct and persist across refresh. Editing a saved food's presets does not alter previously logged meals. Schema migration preserves existing non-diet data.
