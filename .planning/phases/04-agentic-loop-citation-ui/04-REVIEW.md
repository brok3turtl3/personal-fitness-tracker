---
phase: 04-agentic-loop-citation-ui
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/app/models/ai-chat.model.ts
  - src/app/services/confidence-attribution-parser.ts
  - src/app/services/data-query-tool-executor.ts
  - src/app/services/tool-registry.service.ts
  - src/app/services/anthropic-api.service.ts
  - src/app/services/fitness-context.service.ts
  - src/app/services/chat.service.ts
  - src/app/features/chat/chat-message-list.component.ts
  - src/app/features/chat/chat-page.component.ts
  - src/app/features/chat/pending-pill.component.ts
  - src/app/features/settings/settings-ai.component.ts
findings:
  critical: 4
  warning: 4
  info: 1
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This phase activates the agentic loop, data-query tools, confidence/attribution badges, and the
citation-link guard. The citation guard itself is implemented correctly — model prose is never
passed through `innerHTML` or `bypassSecurityTrust`, and all text is rendered via Angular's
`{{ }}` interpolation. The `isLinkableCitation` guard ships with the right allow-list.

However, four blockers and four warnings were found:

1. **`pause_turn` bypass of `maxAgentTurns` cap** — the loop can run forever if the API keeps
   returning `pause_turn`, violating E2 and defeating the billing-stop guarantee.
2. **SDK chokepoint violation** — `chat.service.ts` imports type-only from `@anthropic-ai/sdk`,
   breaching the two-file boundary rule that the project's own architecture mandates.
3. **System prompt grading instruction mismatched to parser** — the prompt tells the model
   `[source: human|animal]`, but the parser only accepts `data` and `research`. Every source
   annotation the model emits will be silently dropped (unbadged), meaning the intended
   data-vs-research distinction is permanently broken in production.
4. **`redactMealNotes` setting is stored and surfaced in UI but never applied** — the meal facts
   are always included in the system prompt regardless of the user's toggle.

---

## Critical Issues

### CR-01: `pause_turn` bypass makes `maxAgentTurns` cap ineffective (unbounded billing risk)

**File:** `src/app/services/chat.service.ts:341-345`

**Issue:** When `stop_reason === 'pause_turn'` the loop does `turn--; continue`, undoing the
increment that the `for` loop already applied. If the Anthropic API returns `pause_turn`
continuously (e.g., due to a transient condition or a future API change), the loop counter never
advances and the loop runs indefinitely. The loop's only hard stop is `cancelled`, which requires
the user to navigate away. The `maxAgentTurns` cap — the core E2 billing-stop guarantee — is
bypassed entirely in this scenario.

A pause_turn response also does **not** persist `assistantBlocks` before re-sending, meaning
a mid-pause crash leaves the conversation with no record of what was returned.

**Fix:** Track pause_turn iterations with a separate counter and eject to the turn-limit path
once it exceeds a reasonable bound (e.g., 3 consecutive pauses). At minimum, do not let
`turn--` escape the `maxAgentTurns` guard:

```typescript
// Before the for loop:
let pauseCount = 0;
const MAX_CONSECUTIVE_PAUSES = 3;

// Inside the pause_turn case:
case 'pause_turn':
  if (++pauseCount >= MAX_CONSECUTIVE_PAUSES) {
    // Treat as a terminal condition — surface what was gathered.
    await this.persistAssistantBlocks(conversationId, assistantBlocks);
    subscriber.next({ kind: 'done', stopReason: 'pause_turn' });
    subscriber.complete();
    return;
  }
  // Do NOT decrement `turn`; the pause does not earn back a full turn.
  continue;
```

---

### CR-02: `chat.service.ts` violates the two-file SDK import chokepoint

**File:** `src/app/services/chat.service.ts:10`

**Issue:** `chat.service.ts` contains:
```typescript
import type { MessageParam, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages';
```
CLAUDE.md and the AI-SPEC.md D-17 constraint state that **only** `anthropic-api.service.ts` and
`chat-block-serializer.ts` may import from `@anthropic-ai/sdk` or its sub-paths. The `import type`
qualifier does not exempt a file from this architectural rule: the import still creates a compile-
time coupling to the SDK's type surface, meaning any SDK type rename or breaking change propagates
directly into `chat.service.ts`, and any grep/linting chokepoint guard that checks imports will
miss it if it pattern-matches on `import type` differently.

**Fix:** Define local structural aliases for the two types that are used (`MessageParam`,
`ContentBlockParam`) inside `chat.service.ts` (mirroring how `WireToolUse` / `WireToolResult` /
`WireMessage` are already defined as local structural shapes), then cast at the transport boundary
in `anthropic-api.service.ts`. The `chat-block-serializer.ts` import already handles
`toAnthropicContent` and `fromAnthropicMessage`, so these local types only need to be
`{ role: string; content: unknown[] }` structurally.

---

### CR-03: System prompt grading instruction contradicts parser allow-list — all source badges silently dropped

**File:** `src/app/services/fitness-context.service.ts:125` /
`src/app/services/confidence-attribution-parser.ts:39`

**Issue:** The `GRADING_INSTRUCTIONS` constant (sent to the model on every turn) says:
```
Use [source: human|animal] when citing study evidence.
```
But `SOURCE_VALUES` in `confidence-attribution-parser.ts` is:
```typescript
const SOURCE_VALUES: ReadonlySet<string> = new Set(['data', 'research']);
```
`'human'` and `'animal'` are not in the allow-list. The parser's allow-list is the canonical
`D-10` definition from `ai-chat.model.ts`:
```typescript
export type Attribution = 'data' | 'research';
```
Any `[source: human]` or `[source: animal]` token the model emits (following the prompt's
instruction) will silently be dropped as an unknown token, and the span will render unbadged.
The `data`/`research` distinction — the whole point of the source axis — will never appear
in practice because the model is never told to emit those values.

This is a functional breakage, not a corner case: every production conversation will have
broken source attribution.

**Fix:** Align the system prompt with the model and parser:
```typescript
private readonly GRADING_INSTRUCTIONS =
`## Evidence Grading
When you make a health or fitness claim, append a confidence grade as an
inline token: [evidence: strong|moderate|weak|animal-only|anecdotal|speculative].
Append a source token [source: data] when the claim is grounded in the user's
own logged data, or [source: research] when citing general scientific evidence.
Do NOT fabricate citations or links — only structured search results may be linked.`;
```

---

### CR-04: `redactMealNotes` setting is never applied — meal facts always sent to API

**File:** `src/app/services/fitness-context.service.ts:162-168`

**Issue:** `buildKeyFactsHeader` checks `toolSettings.redactWeightEntries` and
`toolSettings.redactHealthReadings`, but never checks `toolSettings.redactMealNotes`.
`nutritionFacts()` is called unconditionally on line 167:
```typescript
lines.push(this.nutritionFacts(data.mealEntries));
```
The setting is present in `AIToolSettings`, exposed in the settings UI with a description
("Off keeps macro totals in the prompt but strips free-text meal notes"), stored to
LocalStorage, and read back — but its value is never evaluated when building the prompt.
Users who enable this toggle believing it hides meal data are given false privacy assurance.

**Fix:**
```typescript
private buildKeyFactsHeader(data: AppData, toolSettings: AIToolSettings): string {
  const lines: string[] = [];
  if (!toolSettings.redactWeightEntries)  lines.push(this.weightFacts(data.weightEntries));
  if (!toolSettings.redactHealthReadings) lines.push(this.readingFacts(data.healthReadings));
  lines.push(this.cardioFacts(data.cardioSessions));
  if (!toolSettings.redactMealNotes)      lines.push(this.nutritionFacts(data.mealEntries));
  return lines.filter(Boolean).join('\n');
}
```
Note: the description in the UI says "strips free-text meal notes (recipe names, paste-ins)" but
`nutritionFacts()` only emits a single total-kcal line with no meal-note text. Once the flag is
wired, consider whether the intent is to suppress the entire line (current `nutritionFacts`
output) or only free-text notes inside individual meal entries (which would require changes to
the meal facts format).

---

## Warnings

### WR-01: `mealsByDay` cursor day is derived from `toISOString()` — wrong in UTC+ timezones

**File:** `src/app/services/data-query-tool-executor.ts:319`

**Issue:** Inside `mealsByDay`, the loop cursor is created as a local-time Date:
```typescript
const cursor = new Date(`${range.from}T00:00:00`);   // local midnight
```
But the day string that gets stored into `result` and passed to `getMealsForDay` is:
```typescript
const day = cursor.toISOString().slice(0, 10);         // UTC date portion
```
`toISOString()` always returns UTC. In any UTC+ timezone (e.g., IST UTC+5:30, JST UTC+9,
AEST UTC+10), local midnight is before the corresponding UTC midnight, so
`toISOString().slice(0, 10)` returns the **previous calendar day**. For example in IST:
```
new Date('2026-03-28T00:00:00').toISOString() === '2026-03-27T18:30:00.000Z'
cursor.toISOString().slice(0, 10) === '2026-03-27'  // wrong — should be '2026-03-28'
```
This means `getMealsForDay('2026-03-27')` is called instead of `getMealsForDay('2026-03-28')`,
the loop iterates day-shifted by one, the final day in the range is never queried, and
caloric totals / meal counts are off for any user in a UTC+ timezone.

**Fix:** Build the day string from the range inputs directly, not from `toISOString()`:
```typescript
while (cursor.getTime() <= end.getTime()) {
  if (++guard > DataQueryToolExecutor.MAX_RANGE_DAYS) { ... }
  // Derive day from the padded local date components, not toISOString():
  const y = cursor.getFullYear();
  const m = String(cursor.getMonth() + 1).padStart(2, '0');
  const d = String(cursor.getDate()).padStart(2, '0');
  const day = `${y}-${m}-${d}`;
  const meals = await firstValueFrom(this.diet.getMealsForDay(day));
  result.push({ day, meals });
  cursor.setDate(cursor.getDate() + 1);
}
```

---

### WR-02: `enableDataQueryTools` and `enableMemoryTool` settings are loaded but never applied to the tools array

**File:** `src/app/services/chat.service.ts:277-282`

**Issue:** `runAgenticLoop` fetches `toolSettings` from `AISettingsService` and uses only
`maxAgentTurns`:
```typescript
const toolSettings = await firstValueFrom(this.aiSettingsService.getToolSettings());
const maxAgentTurns = toolSettings.maxAgentTurns ?? DEFAULT_AI_TOOL_SETTINGS.maxAgentTurns;
const tools = this.toolRegistry.definitions();   // ALL tools, always
```
`toolSettings.enableDataQueryTools` and `toolSettings.enableMemoryTool` are never consulted.
The six `query_*` tools and the `memory` tool are always passed to the API regardless of
what the user has toggled in settings. This makes the "AI tool capabilities" settings section
cosmetic-only: users who turn off data-query tools still have the AI querying their data.

**Fix:** Filter `tools` based on the settings flags before passing them to `sendMessage`:
```typescript
const tools = this.toolRegistry.definitions().filter(t => {
  if (t.name === 'memory' && !toolSettings.enableMemoryTool) return false;
  if (t.name.startsWith('query_') && !toolSettings.enableDataQueryTools) return false;
  return true;
});
```

---

### WR-03: `approxMessageTokens` formula is inverted — overestimates by ~1.78x

**File:** `src/app/services/chat.service.ts:74-78`

**Issue:** The comment says "~0.75 tokens per whitespace-delimited word" but the formula is:
```typescript
return Math.max(1, Math.ceil(words / 0.75));
```
Dividing by 0.75 means the formula produces `~1.33 tokens per word`, not 0.75. For 100 words
the result is 134, not 75. This overestimates by ~78%. While the service comment correctly
notes this is only a seed estimate for the sliding-window fallback (not the authoritative
`countTokens` gate), the overestimate causes premature sliding-window truncation in
`buildApiMessages` — messages that fit the 8000-token budget may be dropped because their
`tokenEstimate` is nearly double the real count. This can degrade conversation context for
multi-turn sessions.

**Fix:**
```typescript
function approxMessageTokens(text: string): number {
  // ~0.75 tokens per whitespace-delimited word.
  const words = text.trim().length ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words * 0.75));
}
```

---

### WR-04: `wrapUntrusted` only escapes exact tag literals — variant forms bypass the guard

**File:** `src/app/services/fitness-context.service.ts:130-135`

**Issue:** `wrapUntrusted` replaces only the exact strings `<tag>` and `</tag>`:
```typescript
const safe = content
  .replaceAll(`</${tag}>`, `</_${tag}>`)
  .replaceAll(`<${tag}>`, `<_${tag}>`);
```
A user could craft a profile entry containing a tag variant with an attribute or a space —
for example `</user_profile_goals >` (trailing space), `</user_profile_goals\n>` (newline),
or `<user_profile_goals id="x">` — and the replacement would not match. The outer wrapper
becomes:
```
<user_profile_goals>
hello </user_profile_goals >attack payload
</user_profile_goals>
```
Whether this actually breaks out of the XML-style tag framing depends on how Claude's parser
handles malformed tags. Per the threat model (T-03 / Pitfall 3), the intent is that no
user-supplied content can close the outer tag. The current implementation does not reliably
satisfy that intent for non-exact tag variants.

This is a defence-in-depth issue in the LLM-trust boundary (the system prompt is not
rendered as HTML so there is no XSS risk, but prompt injection through tag escape is the
stated threat).

**Fix:** Use a regex that matches any variant of the closing tag, not just the exact form:
```typescript
private wrapUntrusted(tag: string, content: string): string {
  // Escape any closing variant, including those with whitespace or attributes before '>'.
  const closeRe = new RegExp(`</${tag}[^>]*>`, 'gi');
  const openRe  = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi');
  const safe = content
    .replace(closeRe, m => m.replace('</', '</_'))
    .replace(openRe,  m => m.replace('<', '<_'));
  return `<${tag}>\n${safe}\n</${tag}>`;
}
```

---

## Info

### IN-01: `console.error` calls remain in `chat-page.component.ts` — errors silently swallowed from the user's perspective

**File:** `src/app/features/chat/chat-page.component.ts:353, 356, 390`

**Issue:** Three error paths in `onBlockAction` log to `console.error` but do not update
`this.errorMessage` or `this.loopError`, so the user sees nothing when an approve-persist,
approve-execute, or block-action update fails. The operations are fire-and-forget from the
user's perspective.

**Fix:** Surface the error via `this.errorMessage` so the inline banner renders:
```typescript
error: (err: unknown) => {
  console.error('[chat-page] approve persist failed', err);
  this.errorMessage = 'Failed to save your approval. Please try again.';
},
```

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
