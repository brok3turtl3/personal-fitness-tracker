---
phase: 04-agentic-loop-citation-ui
verified: 2026-05-31T12:00:00Z
status: passed
score: 5/5
overrides_applied: 0
re_verification: false
---

# Phase 04: Agentic Loop + Citation UI — Verification Report

**Phase Goal:** The chat is now an agentic coach — Claude reads the user's actual data through tools, runs a multi-turn loop bounded by maxAgentTurns, and emits answers with confidence labels, source attribution, and tool-use transparency. The user can see what the AI looked at and how confident it is.
**Verified:** 2026-05-31T12:00:00Z
**Status:** passed
**Re-verification:** No — initial verification (after post-review fix commits 6d84574, d77b37c, 001c9ee, e26cc56, WR-01..04)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | query_* tools fetch real data via domain services and the agentic loop runs bounded by maxAgentTurns | VERIFIED | `runAgenticLoop` in `chat.service.ts:297` — `for (let turn = 0; turn < maxAgentTurns && !cancelled; turn++)`. Six tools in `data-query-tool-executor.ts:54-85` call `firstValueFrom(this.weight.getEntries())` etc. No saveData anywhere in the executor. |
| 2 | tool_use/tool_result blocks render as collapsed-by-default disclosures | VERIFIED | `chat-message-list.component.ts:59` — `<details class="tool-disclosure">` with `<summary>` child. HTML `<details>` is collapsed by default without an `open` attribute. In-flight queries render as non-expandable `div.tool-inflight`. |
| 3 | Per-claim confidence badges with 6-value taxonomy; low-confidence visually distinct (color + icon); source attribution distinguishes data vs research; system-prompt grading instructions match parser allow-list | VERIFIED | Parser allow-list `CONFIDENCE_VALUES` = `{strong,moderate,weak,animal-only,anecdotal,speculative}` and `SOURCE_VALUES` = `{data,research}` in `confidence-attribution-parser.ts:29-39`. GRADING_INSTRUCTIONS in `fitness-context.service.ts:121-127` emits exactly `[evidence: strong|moderate|weak|animal-only|anecdotal|speculative]` and `[source: data]` / `[source: research]` — matching the parser allow-list (CR-03 fix confirmed). CSS: `tier-calm` = pale-green (#eef6ec), `tier-alert` = amber (#fdf3e7); glyphs ✓/≈/⚠ accompany every badge (not text-only). `your data` uses 📈 glyph; `research` uses 📚 glyph plus `general knowledge — not a live source` qualifier. |
| 4 | Citation-link guard: free-text prose never becomes hyperlinks; only structured citation block types become links; no bypassSecurityTrust/innerHTML | VERIFIED | All prose rendered via `{{ span.text }}` Angular interpolation (auto-escaped). `isLinkableCitation` allow-list in `chat-message-list.component.ts:21-26` accepts only `search_result_location` and `web_search_result_location`. grep confirms zero `bypassSecurityTrust`/`innerHTML` in the chat feature directory. Confirmed by the existing spec assertion at `chat-message-list.component.spec.ts:186-189`. |
| 5 | Real token counts via countTokens drive rolling-window decision; system-prompt cache via cache_control: ephemeral; FitnessContextService produces a thin ~500-token header (no full dataset dump, no embedded timestamp in cacheable block) | VERIFIED | `maybeSummarizeByTokenCount` at `chat.service.ts:541` calls `this.anthropicApi.countTokens(...)` with model+system+messages+tools. `buildSystemPrompt` returns `[cacheablePrefix, todayBlock]` where `cacheablePrefix.cache_control = { type: 'ephemeral' }` (`fitness-context.service.ts:84-88`). The volatile `new Date().toISOString()` is in the separate non-cached `todayBlock` only (line 93), not in the cacheable prefix. Key-facts header emits counts + latest-value per domain only — no per-entry dump. len/4 heuristic is explicitly retired; `approxMessageTokens` now uses `words * 0.75` (WR-03 fix). |

**Score:** 5/5 truths verified

---

## Code Review Fix Verification (Post-Review Commits)

All four BLOCKERS and four WARNINGS found in 04-REVIEW.md are confirmed fixed:

| Finding | Severity | Status | Evidence |
|---------|----------|--------|----------|
| CR-01: pause_turn bypass of maxAgentTurns cap | BLOCKER | FIXED | `pauseCount` + `MAX_CONSECUTIVE_PAUSES = 3` at `chat.service.ts:325-326`; `if (++pauseCount >= MAX_CONSECUTIVE_PAUSES)` exits loop at line 389 |
| CR-02: chat.service.ts importing from @anthropic-ai/sdk | BLOCKER | FIXED | Zero SDK imports in `chat.service.ts` (grep confirmed). Local structural aliases `WireToolUse`, `WireToolResult`, `WireMessage`, `ContentBlockParam`, `MessageParam` defined at lines 30-79 |
| CR-03: GRADING_INSTRUCTIONS mismatched to parser allow-list | BLOCKER | FIXED | Prompt now says `[source: data]`/`[source: research]`; parser SOURCE_VALUES = `{data, research}` — aligned |
| CR-04: redactMealNotes never applied | BLOCKER | FIXED | `buildKeyFactsHeader` at line 176: `if (!toolSettings.redactMealNotes) lines.push(this.nutritionFacts(...))` |
| WR-01: mealsByDay UTC timezone offset | WARNING | FIXED | `mealsByDay` at `data-query-tool-executor.ts:319-325` derives day from `cursor.getFullYear()` / `getMonth()` / `getDate()` (local components) — not `toISOString()` |
| WR-02: enableDataQueryTools/enableMemoryTool never applied | WARNING | FIXED | `runAgenticLoop` at `chat.service.ts:312-316` filters tools by `toolSettings.enableMemoryTool` and `toolSettings.enableDataQueryTools` |
| WR-03: approxMessageTokens formula inverted | WARNING | FIXED | `chat.service.ts:100`: `Math.ceil(words * 0.75)` — multiplies, not divides |
| WR-04: wrapUntrusted only escaped exact tag literals | WARNING | FIXED | `fitness-context.service.ts:138-142`: `closeRe = new RegExp('</${tag}[^>]*>', 'gi')` and `openRe` catch variant forms |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/services/data-query-tool-executor.ts` | Six read-only query_* tools with bounded output | VERIFIED | 462 lines; all 6 tools registered; wraps WeightService, CardioService, ReadingsService, DietService via firstValueFrom only; no StorageService injection |
| `src/app/services/tool-registry.service.ts` | Registers query_* + memory; isWriteProposal | VERIFIED | `isWriteProposal` at line 87; DataQueryToolExecutor injected in constructor; iterates `dataQueryExecutor.executors` to register all 6 |
| `src/app/services/chat.service.ts` | runAgenticLoop bounded by maxAgentTurns | VERIFIED | `runAgenticLoop` at line 297; all StopReason branches handled; CR-01/CR-02/WR-02/WR-03 fixes present |
| `src/app/services/fitness-context.service.ts` | Slim cacheable header + cache_control ephemeral | VERIFIED | Slim key-facts (counts + latest only); `cache_control: { type: 'ephemeral' }` on prefix block; CR-03/CR-04/WR-04 fixes present |
| `src/app/services/anthropic-api.service.ts` | sendMessage accepts full MessageCreateParams; countTokens with system+tools | VERIFIED | `sendMessage(apiKey, params: MessageCreateParams)` at line 69; `countTokens` at line 90 accepts `system?: string | TextBlockParam[]` and `tools?: MessageCountTokensTool[]` |
| `src/app/services/confidence-attribution-parser.ts` | Pure parseClaimSpans with allow-list safe degradation | VERIFIED | `parseClaimSpans` exported at line 58; CONFIDENCE_VALUES and SOURCE_VALUES are frozen ReadonlySets; TOKEN_RE with gi flags; never throws |
| `src/app/features/chat/chat-message-list.component.ts` | Collapsed disclosures + confidence badges + citation guard | VERIFIED | `<details>` disclosures at line 59; confidence chips with tier-calm/tier-alert at line 54; `isLinkableCitation` at line 21; zero innerHTML/bypassSecurityTrust |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `data-query-tool-executor.ts` | `weight.service.ts` | `firstValueFrom(this.weight.getEntries())` | WIRED | Line 134 |
| `data-query-tool-executor.ts` | `cardio.service.ts` | `firstValueFrom(this.cardio.getSessions())` | WIRED | Line 162 |
| `data-query-tool-executor.ts` | `readings.service.ts` | `firstValueFrom(this.readings.getReadings(type))` | WIRED | Line 190 |
| `data-query-tool-executor.ts` | `diet.service.ts` | `firstValueFrom(this.diet.getSavedFoods())` | WIRED | Lines 214, 326 |
| `tool-registry.service.ts` | `data-query-tool-executor.ts` | Constructor iterates `dataQueryExecutor.executors` | WIRED | Lines 73-79 |
| `chat.service.ts` | `tool-registry.service.ts` | `toolRegistry.dispatch` + `toolRegistry.isWriteProposal` + `toolRegistry.definitions()` | WIRED | Lines 312, 436, 453 |
| `chat-message-list.component.ts` | `confidence-attribution-parser.ts` | `parseClaimSpans` via `spansFor()` | WIRED | Lines 4, 300 |
| `fitness-context.service.ts` | `cache_control: ephemeral` | `cacheablePrefix.cache_control = { type: 'ephemeral' }` | WIRED | Line 87 |
| `chat.service.ts` | `anthropic-api.service.ts` | `countTokens(apiKey, { model, system, messages, tools })` | WIRED | Line 551 |
| `chat-page.component.ts` | `chat.service.ts` | `runAgenticLoop(conversationId, apiKey)` | WIRED | Line 545 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `data-query-tool-executor.ts` | `all` (weight entries) | `WeightService.getEntries()` → StorageService | Yes — reads persisted AppData | FLOWING |
| `data-query-tool-executor.ts` | `all` (cardio) | `CardioService.getSessions()` → StorageService | Yes | FLOWING |
| `data-query-tool-executor.ts` | `all` (readings) | `ReadingsService.getReadings()` → StorageService | Yes | FLOWING |
| `data-query-tool-executor.ts` | `foods` (saved foods) | `DietService.getSavedFoods()` → StorageService | Yes | FLOWING |
| `data-query-tool-executor.ts` | `meals` (daily meals) | `DietService.getMealsForDay()` → StorageService | Yes | FLOWING |
| `chat-message-list.component.ts` | `spansFor()` | `parseClaimSpans(block.text)` from persisted ChatMessage | Yes — memoized parse of real message text | FLOWING |
| `fitness-context.service.ts` | `buildKeyFactsHeader()` | `StorageService.getData()` | Yes — reads real AppData | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — verifying without a running server. The agentic loop, tool dispatch, parser, and citation guard are all tested via the 584/584 Karma suite (all green per context).

---

## Requirements Coverage

| Requirement | Phase | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| CHAT-02 | 4 | AI read access via 6 query_* tools | SATISFIED | `data-query-tool-executor.ts` + `tool-registry.service.ts` wired; all 6 tools verified |
| CHAT-05 | 4 | Agentic while(tool_use) loop bounded by maxAgentTurns | SATISFIED | `runAgenticLoop` in `chat.service.ts:297` |
| CHAT-06 | 4 | tool_use/tool_result render as collapsed sections | SATISFIED | `<details class="tool-disclosure">` at `chat-message-list.component.ts:59` |
| CHAT-07 | 4 | Per-claim confidence labels with 6-value taxonomy; low-confidence visually distinct | SATISFIED | tier-calm / tier-alert CSS; glyph + label on every badge |
| CHAT-08 | 4 | Source attribution distinguishes data vs research | SATISFIED | `span.source === 'data'` → "your data" chip; `span.source === 'research'` → "research" chip + qualifier |
| CHAT-09 | 4 | AI never renders free-generated citations as links | SATISFIED | All prose via `{{ }}` interpolation; `isLinkableCitation` allows only API-structured citation types; confirmed by spec |
| CHAT-10 | 4 | Real token counts via countTokens; cache_control ephemeral; slim ~500-token header | SATISFIED | `maybeSummarizeByTokenCount` calls `countTokens`; `cacheablePrefix.cache_control = { type: 'ephemeral' }`; no full dataset dump |

All 7 required phase requirements (CHAT-02, CHAT-05 through CHAT-10) are SATISFIED.

---

## Anti-Patterns Found

No blockers or warnings found.

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `chat-message-list.component.ts:89` | `tool-result-placeholder` CSS class name contains "placeholder" | INFO | This is a legitimate fallback render for orphaned tool_results (unpaired in current message). Not a stub — renders real `block.content` via `{{ }}`. |

---

## Human Verification Required

The following items require human testing and cannot be verified programmatically:

### 1. Confidence badge visual rendering

**Test:** Send a message to the AI that produces graded responses (ask a health question). Observe the rendered message.
**Expected:** Inline confidence chips appear after sentences; `strong`/`moderate` show green chips with ✓/≈ glyphs; `weak`/`animal-only`/`anecdotal`/`speculative` show amber chips with ⚠ glyph. Source chips show 📈 "your data" or 📚 "research" after the confidence chip.
**Why human:** Visual rendering and CSS color contrast cannot be verified by grep.

### 2. Tool-use disclosure collapse/expand behavior

**Test:** Ask the AI a question about your fitness data. Observe the tool-call section in the rendered message.
**Expected:** A collapsed disclosure element appears labeled with the tool verb (e.g., "⚖️ Read 38 weight entries · 2026-01-01..2026-05-31"). Clicking it expands to show Query/Result sections. The disclosure is collapsed by default.
**Why human:** The `<details>` element default-collapsed behavior and click interaction require a running browser to verify.

### 3. maxAgentTurns cap behavior

**Test:** In Settings, set the agent turn cap to 2. Ask a complex question requiring multiple tool calls.
**Expected:** The loop runs at most 2 tool-use turns, then emits a turn_limit indicator, and makes one final best-effort answer call without tools.
**Why human:** Requires a live API call and observing the chat-page turn-limit notification.

---

## Gaps Summary

No gaps. All 5 roadmap success criteria are verified against the actual codebase. All 4 REVIEW.md blockers (CR-01 through CR-04) and all 4 warnings (WR-01 through WR-04) are confirmed fixed in the current source. The phase goal is achieved.

---

_Verified: 2026-05-31T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
