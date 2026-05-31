---
phase: 05-web-search-grounding-quality-sweep
plan: 02
subsystem: ai-chat / web-search-grounding + storage-migration
tags: [web-search, citations, serializer, schema-migration, D-17, FOUND-07, TDD]
requires:
  - "Phase 4 confidence-attribution-parser.ts (pure-module template)"
  - "05-01 web-citation-parser.fixtures.ts (F2/F6/F7/F8/F10/F11/F13)"
  - "Phase 1/3 storage.service.ts typed migrate chain + backup-before-migrate (FOUND-07)"
provides:
  - "web-citation-parser.ts — pure toGroundedCitations + toSourcesList (allow-list + https gate + dedupe)"
  - "GroundedCitation local SDK-free shape (defined in ai-chat.model.ts)"
  - "Extended ChatBlock union: ServerToolUsePersistedBlock + WebSearchToolResultPersistedBlock + TextBlock.citations"
  - "chat-block-serializer verbatim server-tool passthrough (byte-stable encrypted_content)"
  - "V6 schema migration (migrateV5ToV6 + LegacyAppDataV5 + CURRENT_SCHEMA_VERSION=6)"
affects:
  - "05-05 (loop wiring — consumes the persisted server-tool blocks + GroundedCitation)"
  - "05-08 (renderer — consumes GroundedCitation[] for footnotes + Sources list)"
  - "Phase 2 diet schema work must retarget V6→V7"
tech-stack:
  added: []
  patterns:
    - "Pure DI-free runtime-validation module (allow-list ReadonlySet/discriminant + total function + Threat-model doc-comment)"
    - "D-17 SDK transport chokepoint extended to a THIRD sanctioned import-type-only importer"
    - "Typed legacy-schema migrate-chain hop + backup-before-migrate (FOUND-07)"
key-files:
  created:
    - "src/app/services/web-citation-parser.ts"
    - "src/app/services/web-citation-parser.spec.ts"
  modified:
    - "src/app/models/ai-chat.model.ts"
    - "src/app/models/app-data.model.ts"
    - "src/app/services/chat-block-serializer.ts"
    - "src/app/services/chat-block-serializer.spec.ts"
    - "src/app/services/legacy-schemas.ts"
    - "src/app/services/storage.service.ts"
    - "src/app/services/storage.service.migration-fixtures.spec.ts"
decisions:
  - "GroundedCitation DEFINED in ai-chat.model.ts (single source of truth); web-citation-parser.ts imports + re-exports it (avoids a model→service import while keeping the model SDK-free)"
  - "web-citation-parser.ts is the THIRD sanctioned @anthropic-ai/sdk import-type-only importer (D-17 allow-list extended); no committed grep-gate script exists — the D-17 gate is enforced ad-hoc in specs/acceptance"
  - "TextBlock.citations (narrowed GroundedCitation[]) is render-only and is NOT re-emitted on the wire; the verbatim web_search_tool_result block's encrypted_content is the multi-turn citation-resolution carrier"
  - "V5→V6 is a no-op data transform (additive ChatBlock union); version bumped + backward-compat fixture written anyway per FOUND-07 discipline (RESEARCH A3)"
metrics:
  duration: ~30m
  completed: 2026-05-31
---

# Phase 5 Plan 02: Web-Citation Parser + Server-Tool Serializer + V6 Migration Summary

The foundational web-search persistence/serialization layer: a pure `https:`-gated `web-citation-parser` narrowing SDK citations into a local SDK-free `GroundedCitation`; verbatim `server_tool_use`/`web_search_tool_result` passthrough in the serializer (byte-stable `encrypted_content`, eliminating the Pitfall-1 placeholder flattening); and a backward-compatible V6 schema migration for the extended `ChatBlock` union.

## What Was Built

### Task 1 — Pure `web-citation-parser.ts` (TDD RED→GREEN)
- `toGroundedCitations(citations)`: total function — allow-lists `type === 'web_search_result_location'` only (D-09), `https:`-gates via `new URL().protocol` in try/catch (D-03), null/blank title → URL host fallback, `cited_text ?? ''`. Body copied verbatim from AI-SPEC §4b(a). Never throws, never fabricates a link.
- `toSourcesList(citations)`: dedupe by url (Set), preserving first occurrence + order.
- Pure module — no DI, no `@Injectable`, no persistence coupling. D-17: imports ONLY `import type { TextCitation }` and emits the local SDK-free shape.
- 15 specs covering undefined/empty, allow-list drop (`char_location`), http/ftp/unparseable drop, host fallback, cited-text coercion, and the F6/F7/F8 shared fixtures.

### Task 2 — Model + serializer verbatim passthrough (Pitfall 1)
- `ai-chat.model.ts`: defined `GroundedCitation` (SDK-free, the single source of truth); added `citations?: GroundedCitation[]` to `TextBlock`; added `ServerToolUsePersistedBlock`, `WebSearchToolResultPersistedBlock` (+ `WebSearchResultPersisted`) to the `ChatBlock` union — all SDK-agnostic (D-17, model stays SDK-free).
- `chat-block-serializer.ts`: `fromAnthropicMessage` narrows text-block citations via `toGroundedCitations`, persists `server_tool_use` + `web_search_tool_result` verbatim (`encrypted_content` preserved, error union 1:1); `toAnthropicContent` replays both byte-stable. D-17 chokepoint comment extended to 3 sanctioned importers.
- The Pitfall-1 `[unsupported block type: web_search…]` flattening is eliminated (verified absent).
- 11 new serializer specs (F2/F10 typed survival, F11 error union, F13 from→to round-trip byte-stable `encrypted_content`).

### Task 3 — V6 schema migration with backward compat (FOUND-07)
- `app-data.model.ts`: `CURRENT_SCHEMA_VERSION` 5 → 6.
- `legacy-schemas.ts`: `LegacyAppDataV5` (+ `LegacyChatMessageV5`/`LegacyChatConversationV5`) — the pre-web-search V5 baseline.
- `storage.service.ts`: typed `migrateV5ToV6` hop wired into `migrateData` (`case 5 → V6`); no-op passthrough on existing fields + defensive `?? []`/`?? {}` coercion; `migrateV4ToV5` return type narrowed to `LegacyAppDataV5`. Zero `as any` preserved.
- migration-fixtures spec: V5 text-only chat → V6 loads unchanged (no citations fabricated, blocks preserved, schemaVersion=6), v5-keyed pre-migration backup written, missing-array coercion, V6 idempotency (no backup on at-version load).

## Verification

| Check | Result |
|-------|--------|
| `web-citation-parser.spec.ts` | 15/15 GREEN |
| `chat-block-serializer.spec.ts` | 26/26 GREEN (15 pre-existing + 11 new) |
| `storage.service.migration-fixtures.spec.ts` | 19/19 GREEN |
| `ng build --configuration=production` | exit 0 (pre-existing budget warnings only) |
| Full Karma suite | 611 SUCCESS / 5 known-RED (05-09 color-contrast, expected per `<known_state>`) |
| Task 1 grep gates | `web_search_result_location`≥1 ✓, `'https:'`≥1 ✓, no DI ✓, only `import type` SDK ref ✓ |
| Task 2 grep gates | `server_tool_use`=5 ✓, `web_search_tool_result`=7 ✓, model SDK-free ✓, no web_search placeholder ✓ |
| Task 3 grep gates | `CURRENT_SCHEMA_VERSION = 6` ✓, `migrateV5ToV6`=2 ✓, `LegacyAppDataV5` ✓, no `as any` ✓ |

## TDD Gate Compliance

Task 1 (the `tdd="true"` task) honored the RED→GREEN gate sequence:
- RED: `test(05-02): add failing spec for web-citation-parser` (8c2d562) — module-not-found genuine RED.
- GREEN: `feat(05-02): implement pure web-citation-parser` (1dc3f8d) — 15/15 pass.
No REFACTOR commit needed. (Tasks 2 and 3 are `type="auto"`, not plan-level TDD; their specs were extended alongside the implementation.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Doc-comment edge case] Reworded JSDoc prose to keep literal grep gates green**
- **Found during:** Task 1 acceptance verification.
- **Issue:** The plan's literal grep gates (`! grep -nE "@Injectable|inject\(|StorageService"` and "only an `import type` line for `@anthropic-ai/sdk`") matched prose tokens in the module's doc-comment ("no StorageService", "sanctioned `@anthropic-ai/sdk` importer").
- **Fix:** Reworded the doc-comment ("no persistence-service coupling", "Anthropic-SDK importer") — documentation-only, no behavior change. Same edge case documented in plans 01-10 / 04-01.
- **Files:** `src/app/services/web-citation-parser.ts`. **Commit:** 1dc3f8d.

**2. [Rule 1 — Schema-bump fallout] Updated terminal-state schema assertions in the V4→V5 spec block from `toBe(5)` → `toBe(6)`**
- **Found during:** Task 3 (running the migration-fixtures spec).
- **Issue:** Five existing assertions hardcoded `schemaVersion).toBe(5)`; they describe the end state of `initialize()`, which now runs the chain through to V6.
- **Fix:** Updated the five assertions to `toBe(6)`. All data-preservation assertions (blocks, memoryFiles, settings) still hold because V5→V6 is a no-op passthrough.
- **Files:** `src/app/services/storage.service.migration-fixtures.spec.ts`. **Commit:** 0784509.

### Decision Notes (locked, not deviations)

- **Replay shape for `TextBlock.citations`:** The narrowed `GroundedCitation[]` is render-only and is deliberately NOT re-emitted onto the wire `TextBlockParam.citations`. Re-emitting our lossy local shape (which drops `encrypted_index`) would be useless to the model; the verbatim `web_search_tool_result` block's `encrypted_content` is what Anthropic resolves citations against on the next turn. Documented in the serializer header + the F13 spec.
- **D-17 lint allow-list:** No committed grep-gate *script* file exists in this repo — the D-17 boundary is enforced ad-hoc in specs/acceptance greps. So there was no literal allow-list to "extend to three"; instead the chokepoint is documented in the `chat-block-serializer.ts` header (now naming all three sanctioned importers) and `web-citation-parser.ts`'s own header.

## Known Stubs

None. All three modules are fully wired (the parser feeds the serializer's `fromAnthropicMessage`; the persisted blocks round-trip through `toAnthropicContent`; the migration runs in the live chain).

## Threat Flags

None. The new surface (web citations, server-tool blocks, V5→V6 migration) is all covered by the plan's `<threat_model>` (T-05-02-01..06), with mitigations implemented + spec-asserted (allow-list, https gate, byte-stable encrypted fields, SDK-free model, backup-before-migrate).

## Self-Check: PASSED

- `web-citation-parser.ts`, `web-citation-parser.spec.ts` — FOUND.
- All modified files exist; commits 8c2d562, 1dc3f8d, f5c71b0, 0784509 in git log.
