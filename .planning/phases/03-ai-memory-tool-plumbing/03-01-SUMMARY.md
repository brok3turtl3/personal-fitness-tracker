---
phase: 03-ai-memory-tool-plumbing
plan: 01
subsystem: storage
tags: [angular, typescript-strict, schema-migration, localstorage, chat-blocks, ai-tool-settings, user-profile, dev-seed]

# Dependency graph
requires:
  - phase: 01-foundations
    provides: "FOUND-07 typed-legacy migration harness (legacy-schemas.ts), backup-before-migrate try/catch, MIGRATION_FAILED recovery banner, chat-page characterization spec, axe-core a11y helper"
provides:
  - "AppData V5 shape: memoryFiles, userProfile, aiToolSettings auto-defaulted"
  - "ChatMessage cut over from `content: string` to `blocks: ChatBlock[]` (D-15 — no transitional shim)"
  - "ChatBlock discriminated union (text | tool_use | tool_result) + AIToolSettings interface"
  - "UserProfile model + DEFAULT_USER_PROFILE constant (D-01..D-05)"
  - "migrateV4ToV5 step in storage.service.ts; LegacyAppDataV4 / LegacyChatConversationV4 / LegacyChatMessageV4 typed shapes"
  - "v4.json + v5-expected.json fixture pair + 4-case malformed-V4 matrix"
  - "StorageService.setDevSeed / consumeDevSeed (D-12 dev-seed sentinel) — Wave-1 baseline for Plans 04 + 05"
  - "Defensive coercion for malformed-V4 inputs: null/non-string content → empty/String() text block; missing tokenEstimate → 0"
affects:
  - 03-02 (chat-block-serializer): consumes ChatBlock union, AIToolSettings, V5 baseline
  - 03-03 (memory + tool-registry services): consumes AppData.memoryFiles, AppData.aiToolSettings, ToolUseBlock
  - 03-04 (settings sub-routes + dev-seed writer): consumes UserProfile, AIToolSettings, StorageService.setDevSeed
  - 03-05 (chat-page block rendering + dev-seed reader): consumes ChatBlock, StorageService.consumeDevSeed

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union persistence model bridged to SDK wire format via dedicated serializer (D-15, D-16) — Plan 02 ships the bridge module"
    - "Defensive coercion in migrate steps: explicit String()/typeof guards rather than silent corruption (T-3-CI mitigation)"
    - "Dev-only sentinel surface kept in StorageService (chokepoint compliance) under a SEPARATE LocalStorage key — never migrated, never backed up"

key-files:
  created:
    - "src/app/models/user-profile.model.ts (UserProfile interface + DEFAULT_USER_PROFILE)"
    - "src/app/services/migrations/fixtures/v4.json (happy-path V4 input)"
    - "src/app/services/migrations/fixtures/v5-expected.json (V5 output reference)"
    - "src/app/services/migrations/fixtures/malformed/v4-missing-chat-conversations.json"
    - "src/app/services/migrations/fixtures/malformed/v4-wrong-type-content.json"
    - "src/app/services/migrations/fixtures/malformed/v4-null-content.json"
    - "src/app/services/migrations/fixtures/malformed/v4-missing-token-estimate.json"
  modified:
    - "src/app/models/ai-chat.model.ts (ChatBlock union + AIToolSettings + ChatMessage.blocks cut-over)"
    - "src/app/models/app-data.model.ts (V5 shape: +memoryFiles +userProfile +aiToolSettings; CURRENT_SCHEMA_VERSION=5)"
    - "src/app/models/index.ts (barrel re-export user-profile.model)"
    - "src/app/services/legacy-schemas.ts (LegacyAppDataV4 + LegacyChatConversationV4 + LegacyChatMessageV4)"
    - "src/app/services/storage.service.ts (migrateV4ToV5 + setDevSeed + consumeDevSeed; migrateV3ToV4 return type tightened to LegacyAppDataV4)"
    - "src/app/services/storage.service.spec.ts (V5-shape AppData literals; V0/V1/V3 migration tests now assert V5 defaults; 7 new dev-seed specs)"
    - "src/app/services/storage.service.migration-fixtures.spec.ts (5 new V4→V5 specs; V0..V3 specs assert V5 defaults)"
    - "src/app/services/chat.service.ts (blocksToText helper; user/assistant ChatMessage builds use blocks; buildApiMessages and maybeSummarize derive text via reduce)"
    - "src/app/services/chat.service.spec.ts (textOf helper; assertions on .blocks instead of .content)"
    - "src/app/features/chat/chat-message-list.component.ts (template renders @for over msg.blocks with @if (block.type === 'text'))"
    - "src/app/features/chat/chat-page.component.spec.ts (createValidMessage helper accepts content shorthand and lifts to blocks)"

key-decisions:
  - "Defensive coercion for malformed-V4 wrong-type content (T-3-CI hardening): non-string content coerces via String() rather than producing a malformed TextBlock — outcomes are explicit, never silent. Plan granted flexibility (throw OR coerce); chose coerce for graceful continuity."
  - "createValidMessage spec helper accepts a `content: string` shorthand and lifts it into blocks — keeps existing call sites readable while production type stays strict (D-15 cut-over preserved)."
  - "blocksToText() lives as a file-local helper in chat.service.ts (NOT exported) — Plan 02 swaps the call sites for the proper chat-block-serializer.ts module."
  - "migrateV3ToV4 return type tightened from AppData to LegacyAppDataV4 so the chain types compile cleanly without `as unknown as` casts."

patterns-established:
  - "V5 defaults applied at end of full migrate chain (V0..V4 → V5) — every prior-version happy-path spec now asserts on memoryFiles/userProfile/aiToolSettings defaults to lock the FOUND-07 regression net."
  - "Type-narrowed dev-seed kind union ('memory' | 'profile') — TS strict catches caller mistakes at compile time."
  - "Sentinel keys live under separate LocalStorage keys (dev_seed_pending), NOT under STORAGE_KEY — they are not user data and do not participate in migrations or backups."

requirements-completed: [CHAT-01]

# Metrics
duration: 13m
completed: 2026-05-03
---

# Phase 3 Plan 01: V4→V5 Schema Cut-Over + ChatBlock + Dev-Seed Sentinel Summary

**AppData V5 shape with memoryFiles/userProfile/aiToolSettings defaults; ChatMessage.content fully cut over to blocks: ChatBlock[] (D-15 no shim); migrateV4ToV5 with defensive coercion + 6-fixture matrix; StorageService.setDevSeed/consumeDevSeed for D-12 cross-wave coupling break.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-05-03T10:14:03Z
- **Completed:** 2026-05-03T10:27:19Z
- **Tasks:** 5/5
- **Files created:** 7
- **Files modified:** 8
- **Spec count delta:** Phase 1 baseline 269 → 282 SUCCESS (+13)
  - +6 V4→V5 migration specs (round-trip, idempotent, null-content defensive, missing-chatConversations throws, wrong-type coerce, missing-tokenEstimate coerce)
  - +7 dev-seed sentinel specs (write memory/profile, idempotent consume, null-on-empty, malformed JSON cleanup, quota-error swallow, unexpected-kind reject)

## Accomplishments

- **V4→V5 schema cut-over** lands cleanly: every legacy `ChatMessage.content: string` lifts into `blocks: [{ type: 'text', text: <content> }]`; the `content` field is removed from the V5 shape entirely (no transitional shim per D-15).
- **AppData V5 shape** introduces three new auto-defaulted fields (`memoryFiles: Record<string, string>`, `userProfile: UserProfile`, `aiToolSettings: AIToolSettings`); `CURRENT_SCHEMA_VERSION = 5`; `createEmptyAppData()` initializes all three.
- **ChatBlock discriminated union** + **AIToolSettings interface** ship in `models/ai-chat.model.ts`; persistence-only fields (`status`, `editedFromText`) documented as serializer-stripped.
- **UserProfile model** + `DEFAULT_USER_PROFILE` constant ship as a new file with 4 free-form text sections + updatedAt (D-01..D-05).
- **migrateV4ToV5** appended to the typed-legacy chain; `LegacyAppDataV4` + 2 supporting interfaces extend `legacy-schemas.ts`.
- **6 fixture files** ship with the migration: `v4.json` (happy-path) + `v5-expected.json` + 4 malformed-V4 cases — all parse as valid JSON; all exercised in the spec.
- **Defensive coercion** for malformed inputs (T-3-CI mitigation): non-string content coerces to its string form rather than producing a malformed TextBlock; missing tokenEstimate coerces to 0.
- **StorageService.setDevSeed / consumeDevSeed** ship in Wave 1 — resolves the implicit Plan 04 → Plan 05 cross-wave coupling per D-12.
- **Compile-saving cut-over**: `chat.service.ts` + `chat-message-list.component.ts` + 2 specs converted from `msg.content` to `msg.blocks`; full Karma suite green; production build green.
- **FOUND-07 regression-locked**: every existing V0..V3 happy-path migration spec now also asserts the V5 defaults (memoryFiles/userProfile/aiToolSettings).

## Task Commits

Each task was committed atomically (all on `worktree-agent-a7a6593f8a2291ee0`):

1. **Task 1: Models V5 — UserProfile + ChatBlock + AIToolSettings + AppData V5 + barrel** — `1fb4de1` (feat)
2. **Task 2: legacy-schemas LegacyAppDataV4 + storage.service migrateV4ToV5 + 6 fixtures** — `fc786b5` (feat)
3. **Task 3: storage migration spec — V4→V5 round-trip + idempotency + malformed matrix** — `85c12df` (test)
4. **Task 4: Compile-saving cut-over — chat.service.ts + chat-message-list + spec adaptations** — `d05c488` (refactor)
5. **Task 5: StorageService.setDevSeed + consumeDevSeed (D-12 dev-seed sentinel)** — `33a1443` (feat)

_Note: Task 1 was originally cherry-picked from `b27de11` (mistakenly committed to main during initial setup; reverted on main via `f521f0a` and re-applied as `1fb4de1` on the worktree branch). See "Issues Encountered" below._

## Files Created/Modified

### Created (7)
- `src/app/models/user-profile.model.ts` — UserProfile interface + DEFAULT_USER_PROFILE constant (D-01..D-05).
- `src/app/services/migrations/fixtures/v4.json` — V4 happy-path input (1 cardio + 1 weight + 1 conversation with 2 text-content messages).
- `src/app/services/migrations/fixtures/v5-expected.json` — V5 output reference (same data with messages.blocks instead of content + memoryFiles/userProfile/aiToolSettings defaults).
- `src/app/services/migrations/fixtures/malformed/v4-missing-chat-conversations.json` — V4 missing chatConversations entirely; expected to throw MIGRATION_FAILED.
- `src/app/services/migrations/fixtures/malformed/v4-wrong-type-content.json` — V4 with `content: 123`; expected to coerce defensively to `text: '123'`.
- `src/app/services/migrations/fixtures/malformed/v4-null-content.json` — V4 with `content: null`; expected to lift to empty text block (defensive guard).
- `src/app/services/migrations/fixtures/malformed/v4-missing-token-estimate.json` — V4 missing tokenEstimate; expected to coerce to 0.

### Modified (8)
- `src/app/models/ai-chat.model.ts` — ChatBlock discriminated union (text | tool_use | tool_result), AIToolSettings interface + DEFAULT_AI_TOOL_SETTINGS, ChatMessage.content → blocks (D-15 cut-over).
- `src/app/models/app-data.model.ts` — V5 shape: +memoryFiles +userProfile +aiToolSettings; CURRENT_SCHEMA_VERSION=5; createEmptyAppData() initializes all three.
- `src/app/models/index.ts` — Barrel re-export user-profile.model.
- `src/app/services/legacy-schemas.ts` — LegacyAppDataV4 + LegacyChatConversationV4 + LegacyChatMessageV4 (note `content: string` on legacy V4 ChatMessage).
- `src/app/services/storage.service.ts` — migrateV4ToV5 (defensive content coerce + tokenEstimate coerce); migrateV3ToV4 return type tightened to LegacyAppDataV4; setDevSeed + consumeDevSeed methods (D-12); DEV_SEED_KEY constant.
- `src/app/services/storage.service.spec.ts` — V5-shape AppData literals; V0/V1/V3 migration tests assert V5 defaults; 7 new dev-seed specs.
- `src/app/services/storage.service.migration-fixtures.spec.ts` — 5 new V4→V5 specs (happy-path, idempotent, null-content defensive, malformed-missing-chatConversations throws, wrong-type-content coerce, missing-tokenEstimate coerce); V0..V3 specs assert V5 defaults.
- `src/app/services/chat.service.ts` — blocksToText() helper; user/assistant ChatMessage builds use blocks; buildApiMessages and maybeSummarize derive text via reduce.
- `src/app/services/chat.service.spec.ts` — textOf() helper; assertions on .blocks instead of .content.
- `src/app/features/chat/chat-message-list.component.ts` — Template renders @for over msg.blocks with @if (block.type === 'text').
- `src/app/features/chat/chat-page.component.spec.ts` — createValidMessage helper accepts content shorthand and lifts to blocks.

## Decisions Made

1. **T-3-CI defensive coerce hardening (Task 2 implementation refinement).** Initial migrateV4ToV5 used `text: msg.content ?? ''`. For wrong-type content (e.g., `content: 123`), this would produce `text: 123` (a number), violating the TextBlock interface at runtime. Per the plan's flexibility ("OR defensive coerce") and the T-3-CI threat model entry ("outcomes are explicit, never silent"), strengthened to `text: typeof msg.content === 'string' ? msg.content : (msg.content == null ? '' : String(msg.content))`. The spec locks the actual outcome (`String(123) === '123'`).
2. **createValidMessage spec helper accepts `content` shorthand.** Rather than rewriting every existing call site that passes `content: 'X'`, the helper accepts it as a shorthand and lifts to `blocks: [{ type: 'text', text: 'X' }]`. Production type stays strict (D-15 cut-over preserved); spec call sites stay readable.
3. **blocksToText is file-local.** It's an interim reduce — Plan 02's `chat-block-serializer.ts` will replace it. Keeping it private avoids creating an export that becomes dead code at the next plan.
4. **Cherry-picked Task 1 from main.** Initial Task 1 commit (`b27de11`) inadvertently landed on `main` (the cwd-reset behavior between Bash calls placed me in the main repo root rather than the worktree). The commit was cherry-picked into the worktree (`1fb4de1`) and reverted on main (`f521f0a`) — chose `git revert` over `git reset --hard` per the destructive-git prohibition. No work was lost; main returned to its `e174acf` state with a single revert commit on top.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hardened V4→V5 wrong-type content coercion (T-3-CI explicit-outcomes mitigation)**

- **Found during:** Task 3 (writing the malformed `v4-wrong-type-content.json` spec)
- **Issue:** Initial migrateV4ToV5 used `text: msg.content ?? ''`. With `content: 123`, the resulting block had `text: 123` (a number at runtime), violating the `TextBlock.text: string` contract. The plan's threat model (T-3-CI) requires outcomes to be "explicit (throw OR defensive coerce, never silent)". The initial code was silently producing malformed blocks.
- **Fix:** Tightened to `text: typeof msg.content === 'string' ? msg.content : (msg.content == null ? '' : String(msg.content))`. The spec now explicitly locks the coerce outcome as `text: '123'` (string).
- **Files modified:** `src/app/services/storage.service.ts` (migrateV4ToV5)
- **Verification:** `malformed/v4-wrong-type-content.json` migration spec passes; `block.text` is asserted to be a string with value `'123'`.
- **Committed in:** `85c12df` (Task 3 commit — the fix and the spec landed together)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** The fix kept the V4→V5 migration in compliance with the plan's threat model (T-3-CI). No scope creep — the fix is one short ternary in the existing migration step.

## Issues Encountered

**Initial Task 1 commit landed on `main` due to Bash cwd-reset behavior.**

The Bash tool in this environment resets the working directory between calls. My first Task 1 commit invocation prefixed `cd /home/sean_3/my-ai-projects/personal-fitness-tracker &&` which placed me in the main repo (not the worktree). The commit `b27de11` landed on `main`. Per the destructive-git prohibition, I did NOT use `git reset --hard` to unwind it. Recovery sequence:

1. `git cherry-pick b27de11` from inside the worktree → produced `1fb4de1` on `worktree-agent-a7a6593f8a2291ee0` (correct branch).
2. `git revert --no-edit b27de11` on main → produced `f521f0a` on main, restoring the V4 baseline cleanly.

After this, every subsequent Bash command was made without the `cd ...` prefix — the worktree cwd was honored automatically. The remaining 4 task commits landed correctly on the worktree branch.

**Net effect on main:** main has 1 extra commit (`f521f0a` revert) on top of `e174acf`. This is a documented byproduct, not lost work.

## Threat Model Compliance

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-3-DM (data loss in migrate) | mitigate | `migrateV4ToV5` builds new ChatMessage literal with `blocks` and never mutates legacy in place. Defensive `?? ''` guard on null content. Phase 1 backup-before-migrate try/catch wraps the call. The malformed-V4-null-content spec asserts no throw + empty text block. |
| T-3-CI (silent corruption from malformed input) | mitigate | 4 malformed-V4 fixtures exercised. Outcomes explicit: missing-chatConversations throws MIGRATION_FAILED; wrong-type-content coerces to String(); null-content lifts to empty text block; missing-tokenEstimate coerces to 0. None silently corrupt. |
| T-3-WB (V5 shape written without required fields) | mitigate (TS strict) + accept | `AppData` interface declares memoryFiles/userProfile/aiToolSettings as required (no `?`). TS strict catches missing fields at compile time (verified by spec literals failing tsc until the new fields were added). Runtime validator deferred per plan (premature for n=1 single user). |
| T-3-CV (API key in v4.json fixture) | accept | v4.json uses `sk-ant-test` — obvious placeholder, not a real key. |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 02 (chat-block-serializer)** is unblocked: `ChatBlock` union + `AIToolSettings` interface + V5 schema all in place. The interim `blocksToText` helper in chat.service.ts marks the call sites Plan 02 needs to swap.
- **Plan 03 (memory + tool-registry services)** is unblocked: `AppData.memoryFiles: Record<string, string>` + `AppData.aiToolSettings.enableMemoryTool` + `ToolUseBlock` are present.
- **Plan 04 (settings sub-routes + dev-seed writer)** has `StorageService.setDevSeed` available. The plan's writer side (in `/settings/ai`) can call `storageService.setDevSeed('memory' | 'profile')` directly.
- **Plan 05 (chat-page block rendering + dev-seed reader)** has `StorageService.consumeDevSeed` available. The plan's reader side (in `chat-page.ngOnInit`) can call `storageService.consumeDevSeed()` and receive the type-narrowed `{ kind: 'memory' | 'profile'; at: string } | null`.
- **No blockers** for Wave 2 entry.

## Self-Check: PASSED

Verifications run after writing this SUMMARY:

**Created files exist:**
- `src/app/models/user-profile.model.ts` ✓
- `src/app/services/migrations/fixtures/v4.json` ✓
- `src/app/services/migrations/fixtures/v5-expected.json` ✓
- 4 malformed fixtures ✓

**Commits exist on worktree branch:**
- `1fb4de1` ✓
- `fc786b5` ✓
- `85c12df` ✓
- `d05c488` ✓
- `33a1443` ✓

**Verifications:**
- `npx ng test --no-watch --browsers=ChromeHeadless`: **282 SUCCESS** (Phase 1 baseline 269 + 13 new specs)
- `npx ng build --configuration=production`: **exit 0** (warn-only on bundle size, +1.9–2.4 kB over 512 kB soft budget)
- `npx tsc --noEmit -p tsconfig.json`: **clean**
- `npx tsc --noEmit -p tsconfig.spec.json`: **clean**
- `grep msg.content / message.content / .content =` in cut-over surface: **none**
- `grep ChatMessage = { content: ... }` in cut-over surface: **none**
- `grep '\\bany\\b' src/app/services/storage.service.ts`: **none** (preserves plan 01-09 invariant)
- `grep 'localStorage.{get,set,remove}Item'` outside storage.service.{ts,spec.ts}: **none** (chokepoint preserved)
- All 6 V4 fixtures parse as valid JSON.

---
*Phase: 03-ai-memory-tool-plumbing*
*Completed: 2026-05-03*
