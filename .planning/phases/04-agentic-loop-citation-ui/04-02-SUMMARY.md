---
phase: 04-agentic-loop-citation-ui
plan: 02
subsystem: ai-tools
tags: [tool-use, read-only, bounded-output, registry, agentic-loop]
requires:
  - "ToolRegistryService + ToolExecutor/ToolDefinition contract (Phase 3, 03-03)"
  - "WeightService / CardioService / ReadingsService / DietService getters (Phase 1)"
provides:
  - "DataQueryToolExecutor — six bounded read-only query_* tools (CHAT-02)"
  - "ToolRegistryService.isWriteProposal(name) — D-02/D-03 auto-execute-vs-defer split"
  - "ToolDefinition.strict flag (SDK-agnostic) for Anthropic strict tool use"
affects:
  - "chat.service.ts agentic loop (04-04 — calls dispatch + isWriteProposal)"
  - "anthropic-api.service.ts (maps ToolDefinition incl. strict → SDK Tool[])"
tech-stack:
  added: []
  patterns:
    - "Six thin per-name ToolExecutor adapters held by one @Injectable service"
    - "firstValueFrom domain getter → in-memory range filter → cap + summarize (D-14)"
    - "Explicit write-proposal allow-list (ReadonlySet) over a deny-list"
key-files:
  created:
    - "src/app/services/data-query-tool-executor.ts"
    - "src/app/services/data-query-tool-executor.spec.ts"
  modified:
    - "src/app/services/tool-registry.service.ts"
    - "src/app/services/tool-registry.service.spec.ts"
decisions:
  - "Six thin per-name adapters (not six classes, not a registry multi-name extension) — simplest fit against the existing register(executor) keyed on definition.name"
  - "query_daily_totals sums m.totals directly via a local helper instead of DietService.computeDailyTotals — keeps the handler a self-contained pure aggregation and avoids coupling to a spied method"
  - "isWriteProposal is an explicit allow-list ('memory') so any future read tool defaults to non-write and cannot bypass the pending-pill gate"
metrics:
  duration: "~14m"
  completed: "2026-05-31"
  tasks: "2/2"
  files: 4
  commits: 4
requirements: [CHAT-02]
---

# Phase 4 Plan 02: Six Bounded Read-Only query_* Data Tools Summary

Built `DataQueryToolExecutor` — six read-only `query_*` tools (`query_cardio_sessions`, `query_weight_entries`, `query_readings`, `query_meals_in_range`, `query_daily_totals`, `query_saved_foods`) wrapping the existing domain services with bounded/summarized string output (D-14), registered into `ToolRegistryService` alongside the memory write tool, with an `isWriteProposal(name)` predicate the agentic loop uses to auto-execute reads (D-02) while deferring writes to the pending pill (D-03).

## What Was Built

### Task 1 — DataQueryToolExecutor (TDD: RED b785acb → GREEN 52ce57e)
- `@Injectable({ providedIn: 'root' })` service that injects only the four domain services (`WeightService`, `CardioService`, `ReadingsService`, `DietService`) — never `StorageService`, never browser storage APIs (CLAUDE.md chokepoint), no Anthropic SDK import (D-17).
- Exposes `readonly executors: ToolExecutor[]` — **six thin per-name adapters**, each with one `ToolDefinition` (`type: 'custom'`, `strict: true`, a bounded-output `description`, and a `from`/`to` `input_schema` — plus a `type` enum for `query_readings`) and an `execute` bound to the right private handler. This is the chosen registration shape (the open question the plan flagged): it fits the existing `register(executor)` API that keys a single `definition.name` without extending the registry.
- Each handler `firstValueFrom`s the full domain getter, **filters by the model-supplied ISO `from`/`to` in memory** (the getters take no range — D-14 / 04-RESEARCH), then **caps + summarizes**: ranges over a 60-row threshold return an aggregate header (count, min/max/avg or totals, date span) + the most-recent 20 rows; smaller ranges return rows directly.
- `query_meals_in_range` / `query_daily_totals` iterate local days across the range calling `getMealsForDay` per day (with a 1000-day DoS guard), then aggregate `MealEntry.totals`.
- Invalid/out-of-range input (non-object, `from > to`, unparseable date, bad reading type, missing required range) returns an `Error: …` string and **never throws through to storage**.

### Task 2 — ToolRegistry wiring + isWriteProposal (f5398f0)
- Constructor now injects `DataQueryToolExecutor` and registers its six adapters after the memory executor.
- `isWriteProposal(name)` backed by `WRITE_PROPOSAL_TOOLS: ReadonlySet<string> = new Set(['memory'])` — an explicit allow-list. `query_*` and any unknown/future tool return `false`.
- `dispatch()` / `definitions()` unchanged (CHAT-11 object re-validation + `String()` coercion preserved); `definitions()` now returns memory + six query defs.

## Verification

- `data-query-tool-executor.spec.ts`: **14/14** — six-adapter surface, `strict:true`/`custom`/description on every def, each tool returns a non-empty summary, E5 read-only (no write-shaped method exists on the domain spies), E6 bounded (1825-row / 5-year weight query stays ≤ 4000 chars + contains the `1825` aggregate + < 60 lines), `query_readings` `{type}` pass-through, and three invalid-input → `Error:` cases.
- `tool-registry.service.spec.ts`: **13/13** — memory + six query defs registered (≥ 7), `isWriteProposal('memory')===true` / `('query_weight_entries')===false` / unknown===false, `dispatch('query_weight_entries', {from,to})` returns a string.
- Full Karma suite: **547 SUCCESS** (was 530 after 04-01, +17). Production build: exit 0 (pre-existing 4.87 kB initial-bundle budget warning — not a regression, carried from 04-01).
- Grep gates green: zero `@anthropic-ai/sdk`, zero direct `localStorage.*`, zero `StorageService` in `data-query-tool-executor.ts`; `strict`, `isWriteProposal`, `DataQueryToolExecutor` present where required.

## Threat-Model Compliance

- **T-04-02-01 (read-only):** mitigated — injects domain services only; spec proves no write-shaped method is reachable (E5).
- **T-04-02-02 (token/cost DoS):** mitigated — every handler caps + summarizes; 5-year bounded-output spec (E6) + a 1000-day range guard; descriptions tell the model output is bounded.
- **T-04-02-03 (out-of-range input):** mitigated — invalid input returns an `Error:` string, never throws; no `validators.ts` write-gate needed (read-only, D-14).
- **T-04-02-04 (privilege escalation):** mitigated — `isWriteProposal` is an explicit allow-list; a future read tool cannot accidentally bypass the pending-pill gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded JSDoc to keep literal grep gates green**
- **Found during:** Task 1 acceptance-gate check.
- **Issue:** The plan's acceptance gates require `grep -q "@anthropic-ai/sdk"` and the `StorageService`/`localStorage` chokepoint greps to FAIL (zero matches) in `data-query-tool-executor.ts`, but the original doc comment mentioned those literal tokens to explain the chokepoint.
- **Fix:** Reworded the comment ("imports zero Anthropic SDK types", "never the storage layer / browser storage APIs") — documentation only, no behavior change. Same edge case handled in Plans 01-10 and 04-01.
- **Files modified:** src/app/services/data-query-tool-executor.ts
- **Commit:** 52ce57e

**2. [Rule 3 - Blocking] query_daily_totals decoupled from DietService.computeDailyTotals**
- **Found during:** Task 1 GREEN run (1 failing spec).
- **Issue:** The plan suggested aggregating via `getMealsForDay`; the first GREEN draft called `DietService.computeDailyTotals`, which under TestBed is a stub returning `undefined` → crash. More importantly it coupled the read tool to a spied method.
- **Fix:** Sum `m.totals` directly via a local `sumNutrition` helper (same semantics, self-contained pure aggregation). Removed the now-unused `computeDailyTotals` from the spec's spyObj.
- **Files modified:** src/app/services/data-query-tool-executor.ts, src/app/services/data-query-tool-executor.spec.ts
- **Commit:** 52ce57e

**3. [Rule 2 - Critical] Added ToolDefinition.strict flag**
- **Found during:** Task 1 (plan mandates `strict: true` on each definition; the existing `ToolDefinition` interface had no `strict` field).
- **Issue:** `strict: true` would not type-check against the existing interface.
- **Fix:** Added an optional SDK-agnostic `strict?: boolean` to `ToolDefinition` (mapped to the SDK `Tool.strict` at the api chokepoint in a later plan). Committed with the RED state.
- **Files modified:** src/app/services/tool-registry.service.ts
- **Commit:** b785acb

## TDD Gate Compliance

- Task 1 (`tdd="true"`): RED `b785acb` (13 FAILED / 1 SUCCESS) → GREEN `52ce57e` (14 SUCCESS). No REFACTOR needed.

## Known Stubs

None. All six tools are wired to live domain getters; output is real.

## Commits

- `b785acb` test(04-02): add failing spec for six bounded read-only query_* tools (RED)
- `52ce57e` feat(04-02): implement six bounded read-only query_* data tools (GREEN)
- `f5398f0` feat(04-02): register query_* in ToolRegistry + add isWriteProposal

## Self-Check: PASSED

All 5 key files exist on disk; all 3 per-task commits (b785acb, 52ce57e, f5398f0) present in git history.
