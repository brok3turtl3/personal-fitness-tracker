# Phase 4: Agentic Loop + Citation UI - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 9 (3 new, 6 modified)
**Analogs found:** 9 / 9 (every new/modified file has a strong in-repo analog)

> Phase 4 is an **activation** phase: every new unit has a close existing analog already in the tree (Phase 3 services, Phase 1 domain services, the pure `validators.ts` / `chat-block-serializer.ts` modules, the Phase 3 `chat-message-list` `@switch`). Copy these patterns directly — do not invent new shapes. The SDK chokepoint, the `Observable<T>` service surface, the pure-module style, and the standalone-component render style are all already established and must be matched, not re-solved.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/services/data-query-tool-executor.ts` **(NEW)** | service / tool-executor | request-response (read-only query) | `src/app/services/memory-tool-executor.service.ts` | exact (same `ToolExecutor` interface) + `weight/cardio/readings/diet.service.ts` for the reads |
| `src/app/services/confidence-attribution-parser.ts` **(NEW)** | utility (pure module) | transform (string → typed spans) | `src/app/services/chat-block-serializer.ts` + `src/app/services/validators.ts` | exact (pure, DI-free, total function) |
| `src/app/models/ai-chat.model.ts` **(MODIFY)** | model | n/a (type defs) | itself (existing `ChatBlock` union, `AIToolSettings`) | exact (extend in place) |
| `src/app/services/chat.service.ts` **(MODIFY)** | service / orchestration | event-driven (multi-emit loop) | itself — `sendMessage` (98-187), `buildApiMessages` (370-436), `approveToolUseBlock` (265-325) | exact (reuse own machinery) |
| `src/app/services/anthropic-api.service.ts` **(MODIFY)** | service / transport | request-response | itself — `sendMessage` (63-73), `countTokens` (80-93) | exact (widen existing signatures) |
| `src/app/services/tool-registry.service.ts` **(MODIFY)** | service / dispatch | request-response | itself — `register` (58-60), `dispatch` (77-86) | exact (register the new executor + add `isWriteProposal`) |
| `src/app/services/fitness-context.service.ts` **(MODIFY)** | service / context-assembly | transform (data → prompt) | itself — `buildSystemPrompt` (18-49) | exact (slim + cache_control) |
| `src/app/features/chat/chat-message-list.component.ts` **(MODIFY)** | component | event-driven render | itself — the `@switch (block.type)` (30-44) | exact (extend the switch) |
| `src/app/features/chat/chat-page.component.ts` **(MODIFY)** | component / orchestration | event-driven | itself — `sendMessage` subscribe (483-515), dev-seed methods (234-334) | exact (drive loop events; remove/gate dev seed) |

---

## Pattern Assignments

### `src/app/services/data-query-tool-executor.ts` (NEW — service, read-only query)

**Primary analog:** `src/app/services/memory-tool-executor.service.ts` (the `ToolExecutor` contract + `firstValueFrom` + command-switch + error-as-string shape).
**Secondary analogs:** `src/app/services/weight.service.ts`, `cardio.service.ts`, `readings.service.ts`, `diet.service.ts` (the read getters this executor wraps).

**Implements the registry's `ToolExecutor` interface** (`tool-registry.service.ts:27-30`):
```typescript
export interface ToolExecutor<TInput = unknown, TOutput = string> {
  readonly definition: ToolDefinition;
  execute(input: TInput): Promise<TOutput> | TOutput;
}
```
> RESEARCH recommends ONE executor with a tool-name switch covering all six `query_*` tools (not six classes). Because one class must answer to six tool *names*, it likely needs to expose six `ToolDefinition`s and register six handlers — confirm the exact registration shape against `tool-registry.service.ts` (see that file's pattern below); the `register(executor)` API keys on a single `definition.name`, so the planner must decide whether to register six thin executors or extend the registry to accept a multi-name executor.

**SDK-agnostic + `@Injectable` + DI of domain services** (mirror `memory-tool-executor.service.ts:43-52`):
```typescript
@Injectable({ providedIn: 'root' })
export class MemoryToolExecutor implements ToolExecutor {
  readonly definition: ToolDefinition = { type: 'memory_20250818', name: 'memory' };
  constructor(private store: MemoryStoreService) {}
```
> This file does NOT import `@anthropic-ai/sdk` — the chokepoint (D-17) is preserved. The new executor injects `WeightService`/`CardioService`/`ReadingsService`/`DietService`, never `StorageService` directly, never `localStorage.*`.

**Read pattern — `firstValueFrom` an `Observable<T[]>` getter** (mirror `memory-tool-executor.service.ts:133` + the domain getters):
```typescript
// from memory-tool-executor.service.ts:
const files = await firstValueFrom(this.store.listFiles());
// the six getters to wrap (all return Observable<T[]>, all sort newest-first, NONE take a date range):
//   WeightService.getEntries()           -> weight.service.ts:35
//   CardioService.getSessions()          -> cardio.service.ts:35
//   ReadingsService.getReadings(type?)   -> readings.service.ts:50  (optional HealthReadingType filter)
//   DietService.getMealsForDay(dayLocal) -> diet.service.ts:197     (single local day)
//   DietService.getSavedFoods()          -> diet.service.ts:33
```
> **Bounding (D-14, RESEARCH Pattern 2 + Pitfall 6):** the getters return the FULL list; the executor must `firstValueFrom`, filter by the model-supplied `from`/`to`/`type`, then **cap + summarize** (aggregates + most-recent-N) before returning a string. `query_meals_in_range` / `query_daily_totals` aggregate over a range by calling `getMealsForDay` per day or filtering `mealEntries`. None of the getters accept a range, so range filtering happens in-executor.

**Error-as-string, never throw-through (CHAT-11)** (mirror `memory-tool-executor.service.ts:54-81`):
```typescript
async execute(input: unknown): Promise<string> {
  if (!isObject(input) || typeof input['command'] !== 'string') {
    return 'Error: invalid memory command — missing command';
  }
  try {
    switch (command) { /* ... */ }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
```
> Out-of-range / invalid input returns a readable `Error: …` string. The loop wraps that into a `tool_result` with `is_error: true` (see chat.service loop below). Read-only ⇒ NO `validators.ts` call needed here; that gate is only for the memory write executor.

**`isObject` type guard** (copy `memory-tool-executor.service.ts:16-18`):
```typescript
function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
```

**Spec:** `data-query-tool-executor.spec.ts` — mirror `memory-tool-executor.service.spec.ts:8-44` (TestBed, `jasmine.createSpyObj('StorageService', […])`, `getData.and.callFake(() => of(mockAppData))`). Add (RESEARCH E5/E6): a `saveData` spy that asserts **zero** writes (read-only safety), and a 5-year-dataset bounded-output assertion.

---

### `src/app/services/confidence-attribution-parser.ts` (NEW — pure utility, transform)

**Primary analog:** `src/app/services/chat-block-serializer.ts` (pure module, no `@Injectable`, exported free functions, SDK-agnostic input).
**Secondary analog:** `src/app/services/validators.ts` (allow-list constants + total functions; the spec-pattern model).

**Pure-module header + free-function exports** (mirror `chat-block-serializer.ts:1-44`):
```typescript
// chat-block-serializer.ts is a PURE MODULE — no DI, no @Injectable.
export function toAnthropicContent(blocks: ChatBlock[]): ContentBlockParam[] { … }
export function fromAnthropicMessage(msg: Message): ChatBlock[] { … }
```
> The parser takes a plain `string` (NOT SDK types) and returns `ClaimSpan[]`. No `@Injectable`, no constructor, no `StorageService`. Allow-list the six confidence + two source values in `Set`s; unknown/malformed token ⇒ leave field `undefined` (unbadged); never throw (D-09). RESEARCH "Code Examples" gives the canonical `parseClaimSpans` body verbatim — copy it. The `Confidence`/`Attribution`/`ClaimSpan` types belong in `models/ai-chat.model.ts` (see below), imported here.

**Allow-list-as-constant** (mirror `validators.ts:48-50, 56`):
```typescript
function isValidCardioType(type: string): type is CardioType {
  return CARDIO_TYPES.some(t => t.value === type);
}
export const VALIDATION_LIMITS = { /* frozen constants */ };
```
> Equivalent: `const CONFIDENCE = new Set([...])` / `const SOURCE = new Set([...])` as module constants.

**Spec:** `confidence-attribution-parser.spec.ts` — model on the pure-function specs (validators spec style; no TestBed needed for the pure module, just `import { parseClaimSpans }`). Required cases (RESEARCH E3): each of 6 evidence values + 2 source values → correct span; garbled `[evidence: ???]` → unbadged, no throw; missing token → unbadged, text preserved; empty input; nested brackets; idempotent (parse twice → identical).

---

### `src/app/models/ai-chat.model.ts` (MODIFY — model)

**Analog:** itself — the existing `ChatBlock` union (9-56) and `AIToolSettings` (108-125).

**Add** (alongside the existing block types, same SDK-agnostic style):
- `Confidence` / `Attribution` / `ClaimSpan` types (consumed by the parser + the message-list render).
- `ChatTurnEvent` union (drives the multi-emit loop; shape in RESEARCH Code Examples / AI-SPEC §3).

**Already present — do NOT re-add:** `AIToolSettings.maxAgentTurns` (118, default 10 via `DEFAULT_AI_TOOL_SETTINGS:136`), `enableDataQueryTools` (110). The loop reads these.

**Fix at plan time (RESEARCH State of the Art / A3):** `CLAUDE_MODELS[2]` is stale — `claude-opus-4-7` (95) should be `claude-opus-4-8`. `claude-sonnet-4-6` (the default, 93) is already correct.

---

### `src/app/services/chat.service.ts` (MODIFY — orchestration, the agentic loop)

**Analog:** itself. The loop is a NEW method `runAgenticLoop()` returning a multi-emit `Observable<ChatTurnEvent>`; it REUSES the file's own existing primitives verbatim.

**Reuse `buildApiMessages` UNCHANGED (lines 370-436)** — it already does the load-bearing wire rules the loop depends on:
```typescript
// chat.service.ts:406-417 — tool_result ALWAYS split into a USER turn (commit 49e275b fix).
for (const msg of windowMessages) {
  const content = toAnthropicContent(msg.blocks);
  const toolResults = content.filter(b => b.type === 'tool_result');
  const others = content.filter(b => b.type !== 'tool_result');
  if (others.length)     messages.push({ role: msg.role, content: others });
  if (toolResults.length) messages.push({ role: 'user', content: toolResults });
}
// :423-433 — coalesce consecutive same-role turns to guarantee wire alternation.
```
> Do NOT re-solve tool_result→user-turn placement. RESEARCH Anti-Pattern #1 + Pitfall 2 confirm: reuse this method.

**Loop shape — copy the canonical body** from AI-SPEC §3 / RESEARCH "Code Examples" (the `for (turn < maxAgentTurns)` + `switch (response.stop_reason)` with every terminal branch, `pause_turn` → `turn--; continue`, write-proposal synthetic `tool_result`, `tool_result` pushed in a `user` turn). That excerpt is authoritative and matches the installed SDK `StopReason` union.

**Settings/model resolution + system-prompt build** (mirror existing `sendMessage` `:125-142`):
```typescript
const model    = settings.selectedModel ?? CLAUDE_MODELS[0].value;
const maxTokens = settings.maxResponseTokens ?? DEFAULT_AI_SETTINGS.maxResponseTokens;
return this.fitnessContext.buildSystemPrompt().pipe(
  switchMap(systemPrompt => {
    const apiMessages = this.buildApiMessages(conversation);
    return this.anthropicApi.sendMessage(apiKey, { model, max_tokens: maxTokens, system: systemPrompt, messages: apiMessages });
  }),
```

**Approved-tool-use + paired-result persistence** — `approveToolUseBlock` (`:265-325`) is the existing primitive for persisting a tool_use together with its paired `tool_result` in one atomic write. RESEARCH Open Question #1: auto-executed `query_*` blocks should persist as `status:'approved'` paired with their result (this method's shape) — NOT `'pending'`. Reuse/extend this method; do not invent a new persistence path.

**Retire** `estimateTokens` (`:26-28`, `Math.ceil(text.length/4)`) from the window decision in favor of `anthropicApi.countTokens` (D-15 / CHAT-10).

**Dependencies already injected** (`:34-39`): `StorageService`, `AnthropicApiService`, `AISettingsService`, `FitnessContextService`. Phase 4 adds `ToolRegistryService` (the Phase 3 grep-gate forbidding this import is intentionally lifted).

**Spec:** extend `chat.service.spec.ts` — drive a mocked `AnthropicApiService` through each `stop_reason`, the cap, and a write-proposal (RESEARCH Validation §1). Assert the tool_result-carrying message role is `'user'` (regression for 49e275b); assert unsubscribe sets `cancelled` and the loop stops.

---

### `src/app/services/anthropic-api.service.ts` (MODIFY — transport)

**Analog:** itself — `sendMessage` (63-73) and `countTokens` (80-93). The sole `@anthropic-ai/sdk` importer (chokepoint).

**Widen `sendMessage` to accept `tools[]`** — the Phase 3 type-level guard explicitly anticipated this:
```typescript
// CURRENT (Phase 3, :63-66) — forbids tools at the type level:
sendMessage(apiKey: string, params: Omit<MessageCreateParams, 'tools' | 'tool_choice'>): Observable<Message> {
// PHASE 4: drop the Omit, accept full MessageCreateParams (with tools[] + cache_control).
```

**Widen `countTokens`** to accept `system: string | TextBlockParam[]` and `tools` (RESEARCH "Widen the transport surface" + verified `MessageCountTokensParams`):
```typescript
// CURRENT (:80-83):
countTokens(apiKey: string, params: { model: string; system?: string; messages: MessageParam[] }): Observable<number>
// PHASE 4: system?: string | TextBlockParam[]; tools?: MessageCountTokensTool[]
```

**Preserve verbatim:** the `getClient` cache (`:95-110`, `dangerouslyAllowBrowser: true`), `mapError` (`:112-128`), `friendlyMessage` (`:134-150`), and the `from(promise.catch(mapError))` Promise→Observable bridge (`:68-72`). `chat-page.component.ts` depends on `AnthropicApiError.statusCode === 401`.

---

### `src/app/services/tool-registry.service.ts` (MODIFY — dispatch)

**Analog:** itself. Register the new executor in the constructor; add `isWriteProposal(name)`.

**Constructor registration** (mirror `:49-51`):
```typescript
constructor(memoryExecutor: MemoryToolExecutor) {
  this.register(memoryExecutor);
}
// Phase 4: inject + register the DataQueryToolExecutor's six query_* definitions alongside memory.
```

**`dispatch` already does object-shape re-validation** (`:77-86`, CHAT-11 boundary) and `String()`-coerces output — the loop calls this unchanged.

**Add `isWriteProposal(name: string): boolean`** — the loop uses it to decide synthetic-result vs auto-execute (D-02/D-03). Memory ('memory') is a write proposal; the six `query_*` are not.

> `definitions()` (`:93-95`) already returns `ToolDefinition[]`; the loop passes these to `anthropic-api.service.ts`, which maps the SDK-agnostic `ToolDefinition` → SDK `Tool[]` at the chokepoint (per the comment at `tool-registry.service.ts:8-9`).

---

### `src/app/services/fitness-context.service.ts` (MODIFY — context assembly)

**Analog:** itself — `buildSystemPrompt` (18-49). Slim the volatile suffix to a ~500-token key-facts header; add `cache_control`.

**Keep the stable prefix + `wrapUntrusted` delimiter wrapping** (`:25-35, 53-58`) — the CHAT-11 prompt-injection guard and the redaction toggles (`:78-81`) stay.

**Slim the volatile suffix** — the current `buildFitnessDataSnapshot` (`:76-243`) stuffs the FULL dataset and embeds `new Date().toISOString()` mid-prompt (`:43`). RESEARCH Pitfall 4 / E7: move the full snapshot OUT (it's now fetched via `query_*`); emit only a thin counts/latest-values header; put "today" in a deterministic slot; keep the empty-profile omission stable (`hasAnyProfileContent`, `:60-65`).

**Return-type change:** `Observable<string>` → likely `Observable<TextBlockParam[]>` (or a structured shape carrying the `cache_control: { type:'ephemeral' }` breakpoint on the stable prefix block). This ripples to `chat.service` (`buildSystemPrompt().pipe(switchMap(systemPrompt => …))`) and the widened `anthropic-api` `system` param — coordinate all three.

**Spec:** extend `fitness-context.service.spec.ts` — two consecutive `buildSystemPrompt()` builds produce a byte-identical cacheable prefix; header token budget ≤ ~500.

---

### `src/app/features/chat/chat-message-list.component.ts` (MODIFY — render)

**Analog:** itself — the `@switch (block.type)` (30-44). EXTEND, do not rebuild.

**Extend the existing switch** (`:31-44`):
```typescript
@switch (block.type) {
  @case ('text') {<span class="block-text">{{ block.text }}</span>}   // Phase 4: render parsed ClaimSpan[] + badges + citation guard
  @case ('tool_use') { <app-pending-pill … /> }                       // keep for WRITE proposals; ADD query_* collapsed disclosure
  @case ('tool_result') { <div class="tool-result-placeholder" …> }   // Phase 4: replace with real <details> viewer (D-05/D-06)
}
```

**Preserve the `<div class="message-content">` wrapper** (`:30`) — the Phase 1 characterization spec (`chat-page.component.spec.ts`) asserts on it.

**New surface = inline templates + component-scoped `styles`** (no new global CSS — UI-SPEC). Reuse existing `.tool-result-placeholder` voice (`:111-120`) for the disclosure box, and the existing `@keyframes blink` (`:148-152`) for the in-flight pulse. Use native `<details>`/`<summary>` (44px touch target), inline `<span>` badges (color + icon-as-text-content + `aria-label`), and the citation guard (only structured `TextCitation` → `<a>`; prose never autolinked, no `bypassSecurityTrust*`).

**Spec:** extend `chat-message-list.component.spec.ts` (existing TestBed + `expectNoSeriousA11yViolations`, see Shared Patterns). Add the E1 adversarial citation test (`querySelectorAll('a').length === 0` on "cite a study" prose) and badge triple-encoding assertions (icon glyph present as text, `aria-label` present). Pass `{ disableRules: ['color-contrast'] }`.

---

### `src/app/features/chat/chat-page.component.ts` (MODIFY — loop orchestration)

**Analog:** itself — the `sendMessage` subscribe (483-515) and the dev-seed methods (234-334).

**Loop subscription pattern** (mirror `:483-515`) — `takeUntilDestroyed(this.destroyRef)` (already imported `:4`, `destroyRef` already `inject`ed `:191`) on the multi-emit loop; refresh the active conversation on events; map `AnthropicApiError.statusCode === 401` (`:500`) to the error message. The loop is multi-emit, so the `next` handler renders incremental `ChatTurnEvent`s (in-flight tool rows → resolved summaries → done), not a single completion.

**Remove/gate the dev-seed button** (CONTEXT D-12, RESEARCH "Reusable Assets"): `appendSeededPill` (`:280-318`), `consumeDevSeedIfPresent` (`:330-335`), and `initializeActiveConversationAndConsumeSeed`'s seed branch (`:234-272`) exist only to fire synthetic pending pills for Phase 3 testing. Real proposals now fire from the loop (D-03) — gate or remove the dev seed before they do.

**`onBlockAction` handler** (`:338`+) routing pill approve/discard/edit to `chat.service.updateMessageBlock` / `approveToolUseBlock` stays — it now receives REAL proposals surfaced mid-loop.

---

## Shared Patterns

### Pure-module pattern (no DI, total functions, SDK-agnostic)
**Source:** `src/app/services/chat-block-serializer.ts:1-44`, `src/app/services/validators.ts`
**Apply to:** `confidence-attribution-parser.ts`
Exported free functions, no `@Injectable`, no constructor, input is a plain primitive (string), never throws, allow-list constants at module scope.

### `ToolExecutor` contract + error-as-string
**Source:** `src/app/services/memory-tool-executor.service.ts:43-81`, `tool-registry.service.ts:27-30`
**Apply to:** `data-query-tool-executor.ts`
`@Injectable({ providedIn:'root' })`, `readonly definition: ToolDefinition`, `execute(input: unknown): Promise<string>`, `isObject` guard, all errors returned as `Error: …` strings (never thrown), SDK-agnostic (no `@anthropic-ai/sdk` import).

### `Observable<T[]>` domain-getter reads via `firstValueFrom`
**Source:** `memory-tool-executor.service.ts:133`; `weight.service.ts:35`, `cardio.service.ts:35`, `readings.service.ts:50`, `diet.service.ts:33,197`
**Apply to:** `data-query-tool-executor.ts`
`await firstValueFrom(this.xService.getX())`. All getters sort newest-first; none take a date range (filter in-executor). Data access flows domain-service → `StorageService` only — never `localStorage.*`.

### SDK chokepoint (D-17)
**Source:** `anthropic-api.service.ts:45-47`, `chat-block-serializer.ts:22-23`
**Apply to:** ALL new/modified files except `anthropic-api.service.ts` and `chat-block-serializer.ts`
Only those two files may `import … from '@anthropic-ai/sdk'`. The loop, the executor, and the parser stay SDK-agnostic (use `ToolDefinition`, `ChatBlock`, plain `string`).

### Standalone-component render (inline template + scoped styles)
**Source:** `chat-message-list.component.ts:21-153`
**Apply to:** `chat-message-list.component.ts` (extend), `chat-page.component.ts`
`standalone: true`, inline `template`, component-scoped `styles: [...]`, `@switch`/`@for`/`@if` control flow, no NgModules, no new global CSS, semantic HTML.

### `takeUntilDestroyed` on every subscription
**Source:** `chat-page.component.ts:4,191,484` (`import … '@angular/core/rxjs-interop'`, `destroyRef = inject(DestroyRef)`, `.pipe(takeUntilDestroyed(this.destroyRef))`)
**Apply to:** `chat-page.component.ts` (loop subscription)
Doubles as the loop-cancellation seam (unsubscribe → `cancelled = true` → loop stops billing).

### Spec pattern (TestBed + StorageService spy + a11y gate)
**Source:** `memory-tool-executor.service.spec.ts:8-44`; `chat-message-list.component.spec.ts:1-37`; `src/app/shared/a11y-test-helpers.ts`
**Apply to:** every new/extended spec
Service specs: `jasmine.createSpyObj('StorageService', ['initialize','getData','saveData'])`, `getData.and.callFake(() => of(mockAppData))`, `saveData.and.callFake` capturing writes. Component specs: `await expectNoSeriousA11yViolations(fixture.nativeElement, { disableRules: ['color-contrast'] })` (color-contrast deferred to Phase 5). Pure-module specs: direct `import` + call, no TestBed. Tests order-agnostic.

---

## No Analog Found

None. Every Phase 4 file maps to a concrete in-repo analog. The two genuinely new files (`data-query-tool-executor.ts`, `confidence-attribution-parser.ts`) each have an exact structural analog already in `services/` (`memory-tool-executor.service.ts` and `chat-block-serializer.ts` respectively). The only NEW external shape — the `ChatTurnEvent` multi-emit loop — has its body specified verbatim in 04-AI-SPEC §3 / 04-RESEARCH "Code Examples" (verified against the installed SDK), so the planner copies that excerpt rather than searching for an analog.

---

## Metadata

**Analog search scope:** `src/app/services/`, `src/app/features/chat/`, `src/app/models/`, `src/app/shared/`
**Files scanned:** chat.service.ts, tool-registry.service.ts, memory-tool-executor.service.ts, fitness-context.service.ts, anthropic-api.service.ts, chat-block-serializer.ts, validators.ts, weight/cardio/readings/diet.service.ts, ai-chat.model.ts, chat-message-list.component.ts (+ spec), chat-page.component.ts, memory-tool-executor.service.spec.ts, a11y-test-helpers.ts
**Pattern extraction date:** 2026-05-31
