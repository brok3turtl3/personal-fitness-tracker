# Phase 5: Web Search Grounding + Quality Sweep - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 22 (new + modified)
**Analogs found:** 22 / 22 (every file has a concrete in-repo analog; the phase is extension, not invention)

> Read alongside `05-RESEARCH.md` (Architectural Responsibility Map + Pitfalls) and `05-AI-SPEC.md` §3/§4b. This map names the EXACT file + line range each new/modified file copies from. Project invariants that bind every file: storage chokepoint (zero `localStorage.*` outside `storage.service.ts`), SDK boundary (only `anthropic-api.service.ts` + `chat-block-serializer.ts` import `@anthropic-ai/sdk`), strict TS no-`any`, standalone components, `takeUntilDestroyed(inject(DestroyRef))` on every `.subscribe`, services sort date-desc + delegate persistence to `StorageService`.

## File Classification

| New/Modified File | Status | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `services/web-citation-parser.ts` | NEW | utility (pure module) | transform | `services/confidence-attribution-parser.ts` | exact |
| `services/web-citation-parser.spec.ts` | NEW | test | transform | `services/confidence-attribution-parser.spec.ts` | exact |
| `services/chat-block-serializer.ts` | MOD | utility (pure bridge) | transform | itself (`fromAnthropicMessage`/`toAnthropicContent`) | exact |
| `models/ai-chat.model.ts` | MOD | model | — | itself (`ChatBlock` union, `ChatTurnEvent`, `ClaimSpan`) | exact |
| `models/app-data.model.ts` | MOD | model | — | itself (V5 fields + `CURRENT_SCHEMA_VERSION`) | exact |
| `services/legacy-schemas.ts` | MOD | model | — | `LegacyAppDataV4` (lines 128+) | exact |
| `services/anthropic-api.service.ts` | MOD | service (transport) | request-response | itself (`sendMessage`, `mapError`, `getClient`) | exact |
| `services/chat.service.ts` | MOD | service | event-driven (loop) | itself (`runAgenticLoop` 297–489) | exact |
| `services/tool-registry.service.ts` | MOD | service | — | itself (`WRITE_PROPOSAL_TOOLS`, `isWriteProposal`) | exact |
| `services/fitness-context.service.ts` | MOD | service | transform | itself (`buildSystemPrompt`, `INSTRUCTIONS`) | exact |
| `services/storage.service.ts` | MOD | service (chokepoint) | CRUD + file-I/O | itself (`getStorageInfo`, `saveData`, `migrateV4ToV5`, `getBackup`) | exact |
| `services/cardio.service.ts` | MOD | service | CRUD | `diet.service.ts updateSavedFood` (126–175) | exact |
| `services/weight.service.ts` | MOD | service | CRUD | `diet.service.ts updateSavedFood` (126–175) | exact |
| `services/readings.service.ts` | MOD | service | CRUD | `diet.service.ts updateMeal` + readings `addBloodPressure` (73–94) | exact |
| `features/chat/chat-message-list.component.ts` | MOD | component | request-response | itself (`isLinkableCitation`, `@switch`, `spansFor`) | exact |
| `features/chat/chat-page.component.ts` | MOD | component | request-response | itself (`handleLoopError` 607–619, `onBlockAction` 325–392) | exact |
| `features/settings/settings-ai.component.ts` | MOD | component | CRUD (form) | itself (`webSearchMaxUses`/`maxAgentTurns` inputs already present) | exact |
| `features/cardio/cardio-page.component.ts` | MOD | component | CRUD (form) | itself (form 21–178 + history list 196–231) | exact |
| `features/weight/weight-page.component.ts` | MOD | component | CRUD (form) | `cardio-page.component.ts` (edit-mode toggle) | exact |
| `features/readings/readings-page.component.ts` | MOD | component | CRUD (form) | `cardio-page.component.ts` (edit-mode toggle) | exact |
| `app.component.ts` | MOD | component (banner host) | event-driven | itself (recovery-banner host, `takeUntilDestroyed` init) | exact |
| `src/index.html` | MOD | config | — | itself (`<head>` 3–9) | role-match |

> NEW spec files (e.g. `cardio.service.spec.ts` extensions, `storage.service.spec.ts`, `app.component.spec.ts`, server-tool fixtures F1–F14, `stryker.config.json`) inherit the analog of the production file they cover; see Shared Patterns.

## Pattern Assignments

### `services/web-citation-parser.ts` (NEW — pure utility, transform)

**Analog:** `services/confidence-attribution-parser.ts` (the canonical pure-module template).

**Pure-module header + import discipline** (`confidence-attribution-parser.ts:1-26`): no `@Injectable`, no DI, no `StorageService`. It is allowed to `import type { TextCitation } from '@anthropic-ai/sdk/resources/messages'` ONLY as a type — but note the D-17 lint chokepoint lists only `anthropic-api.service.ts` + `chat-block-serializer.ts` as SDK importers. **Planner decision:** either (a) narrow citations inside `anthropic-api.service.ts` and hand `web-citation-parser.ts` a local SDK-free shape, or (b) add `web-citation-parser.ts` to the lint allow-list for a `import type` only. RESEARCH §Code-Examples + AI-SPEC §4b(a) write the parser taking `TextCitation[]` directly; confirm the lint-gate stance at plan time.

**Allow-list + total-function pattern** to copy (`confidence-attribution-parser.ts:28-80`):
```typescript
const CONFIDENCE_VALUES: ReadonlySet<string> = new Set([...]);  // frozen module-scope allow-list
export function parseClaimSpans(assistantText: string): ClaimSpan[] {
  // Total function — any input returns a valid ClaimSpan[]; never throws.
  // Allow-list gate — unknown value left undefined (no fabrication).
  if (axis === 'evidence' && CONFIDENCE_VALUES.has(value)) confidence = value as Confidence;
}
```
The new parser mirrors this exactly: allow-list = only `type === 'web_search_result_location'`; gate = `new URL(c.url).protocol === 'https:'`; total function (try/catch around `new URL`, `continue` on failure, never throw). Exact body is in `05-RESEARCH.md` Code-Examples and `05-AI-SPEC.md §4b(a)` — copy `toGroundedCitations` + `toSourcesList` verbatim. Output is a local `GroundedCitation { url; title; citedText }` (NO SDK types past this point — D-17).

**Threat-model doc-comment pattern** (`confidence-attribution-parser.ts:18-25`): copy the `Threat-model:` block style (T-04-01-01 spoofing / false provenance → allow-list; T-04-01-02 DoS → total function) for the new module's RESCH-03 / Pitfall 2 guard.

---

### `services/chat-block-serializer.ts` (MOD — pure bridge, transform) — HIGHEST-STAKES (Pitfall 1)

**Analog:** itself. The gap is the `default:` arm at `chat-block-serializer.ts:127-135` that lifts unknown blocks to `[unsupported block type: …]` — this DESTROYS `server_tool_use` / `web_search_tool_result` + `encrypted_content` on persist.

**`fromAnthropicMessage` switch to extend** (`chat-block-serializer.ts:113-137`):
```typescript
export function fromAnthropicMessage(msg: Message): ChatBlock[] {
  return msg.content.map((b): ChatBlock => {
    switch (b.type) {
      case 'text': return { type: 'text', text: b.text };   // ADD: + citations? passthrough
      case 'tool_use': return { type: 'tool_use', id: b.id, name: b.name, input: b.input, status: 'pending' };
      // ADD: case 'server_tool_use' → pass through verbatim
      // ADD: case 'web_search_tool_result' → pass through verbatim (incl. encrypted_content)
      default: return { type: 'text', text: `[unsupported block type: ${(b as {type:string}).type}]` };
    }
  });
}
```

**`toAnthropicContent` switch** (`chat-block-serializer.ts:44-102`): add `case 'server_tool_use'` / `case 'web_search_tool_result'` arms that emit the wire block as-received (byte-stable `encrypted_content` / `encrypted_index`). Note the existing comment at line 129 (`Server tool blocks deferred to Phase 5 per CONTEXT.md D-14`) — that deferral resolves HERE. RESEARCH §F13 mandates a round-trip spec asserting encrypted fields are byte-stable.

**SDK import boundary** (`chat-block-serializer.ts:25-28`): this file is one of the two sanctioned `@anthropic-ai/sdk` importers — new server-tool wire types are imported here, never leaked to models/services.

---

### `models/ai-chat.model.ts` (MOD — model)

**Analog:** itself. The persisted `ChatBlock` union (line 64) + `TextBlock` (9–12) + `ChatTurnEvent` (127–132) are extended.

**`TextBlock` + `ChatBlock` union to extend** (`ai-chat.model.ts:9-64`): add a `citations?` field on the persisted text block and new persisted server-tool block variants to `ChatBlock`. Follow the existing SDK-agnostic doc-comment convention (`Persistence shape — SDK-agnostic per AI-SPEC.md §3 Pitfall #2`). The new `GroundedCitation { url; title; citedText }` local shape lands here too (mirrors `ClaimSpan` at 109–116).

**`ChatTurnEvent` union to extend** (`ai-chat.model.ts:118-132`): add `web_search_started` / `web_search_results` / `web_search_error` variants alongside `tool_use_started` / `tool_result`. Keep it SDK-agnostic (plain `string` fields, no `StopReason`/SDK types) per the line 120 comment.

**No change needed** for `AIToolSettings.enableWebSearch` (172) / `webSearchMaxUses` (174) / `DEFAULT_AI_TOOL_SETTINGS` (189–198) — flags already ship.

---

### `models/app-data.model.ts` + `services/legacy-schemas.ts` (MOD — model, V6 migration)

**Analog:** the V4→V5 migration: `storage.service.ts migrateV4ToV5` (527–566) + `app-data.model.ts:56` (`CURRENT_SCHEMA_VERSION = 5`) + `legacy-schemas.ts LegacyAppDataV4` (line 128).

**Bump + chain pattern** (`storage.service.ts migrateData` 411–435): each hop is a typed `LegacyAppDataVN → LegacyAppDataVN+1`. Add `LegacyAppDataV5` to `legacy-schemas.ts` (copy the `LegacyAppDataV4` shape at 128), add `migrateV5ToV6` to the chain (mirror 430–434), bump `CURRENT_SCHEMA_VERSION` to 6 in `app-data.model.ts:56`, update `createEmptyAppData` (64–78).

**Migration function template** (`storage.service.ts migrateV4ToV5` 527–566): backward-compat defensive coercion (`msg.content ?? ''` style), never mutate the legacy object, return the full new shape. The Schema-Migration Checklist (CLAUDE.md) requires a backward-compat fixture test — V5 chats with NO citations / NO archival index must load unchanged. The pre-migration backup machinery (`writeBackup` 172–181, `pruneOldBackups` 216–235) runs automatically — no change needed.

> RESEARCH §"Schema-migration note" + Assumptions A3: plan for V6 regardless of whether grounded citations are persisted on the text block or only the encrypted server-tool fields — either is a `ChatBlock` union change.

---

### `services/anthropic-api.service.ts` (MOD — transport service, request-response)

**Analog:** itself — the sole SDK importer.

**`buildWebSearchTool` + tools[] append** — new method here, exact body in `05-AI-SPEC.md §3 Entry Point Pattern` and RESEARCH §Pattern 1:
```typescript
buildWebSearchTool(settings: { enableWebSearch: boolean; webSearchMaxUses: number }): WebSearchTool20250305 | null {
  if (!settings.enableWebSearch) return null;          // OFF by default
  return { type: 'web_search_20250305', name: 'web_search', max_uses: settings.webSearchMaxUses ?? 3 };
}
```

**SDK type-import block to extend** (`anthropic-api.service.ts:4-10`): add `WebSearchTool20250305`, `ServerToolUseBlock`, `WebSearchToolResultBlock`, `WebSearchResultBlock`, `WebSearchToolResultError`, `CitationsWebSearchResultLocation` to the existing `import type { ... } from '@anthropic-ai/sdk/resources/messages'`.

**Error-mapping pattern** (`anthropic-api.service.ts:127-165`): `mapError` + `friendlyMessage` is the template for honest web-search-error surfacing. Note web-search errors arrive in an HTTP 200 (RESEARCH Pitfall 4) — they are NOT mapped here (they're narrowed in the loop), but the `AnthropicApiError`/401 mapping at 149-165 is the analog QUAL-07's rotate-key prompt builds on (`statusCode === 401` is already preserved per the comment at 14-19).

**`countTokens` widening** (90–108): web-search results inflate the window across turns (AI-SPEC §4 Context Window Strategy); `countTokens` already accepts `tools` — no signature change, just ensure the web-search tool def is counted.

---

### `services/chat.service.ts` (MOD — agentic loop, event-driven)

**Analog:** itself — `runAgenticLoop` (297–489). The loop shape is UNCHANGED; three additions only (AI-SPEC §4 Core Pattern).

**Tool-filter assembly to extend** (`chat.service.ts:312-317`): append the web-search tool to the SAME filtered `tools` array, gated on `enableWebSearch`:
```typescript
const tools = this.toolRegistry.definitions().filter(t => {
  if (name === 'memory' && !toolSettings.enableMemoryTool) return false;
  if (name.startsWith('query_') && !toolSettings.enableDataQueryTools) return false;
  return true;
});  // ADD: web-search tool def (built at transport boundary) appended here when enableWebSearch
```

**`server_tool_use` is structurally NEVER dispatched** (`chat.service.ts:412-419`): the dispatch list is `response.content.filter(b => b.type === 'tool_use')`. A `server_tool_use` block has `type: 'server_tool_use'` → already excluded (RESEARCH Pattern 2). DO NOT widen this filter. Add a SEPARATE filter for `server_tool_use` / `web_search_tool_result` that emits `ChatTurnEvent`s only (render-only, no `dispatch`, no `tool_result` posted back) — exact emit loop in `05-AI-SPEC.md §3 Entry Point Pattern (B)`.

**`pause_turn` branch already live** (`chat.service.ts:384-398`): `case 'pause_turn': turn--; continue;` with the `MAX_CONSECUTIVE_PAUSES` cap (325–326, 389–394) was built defensively in Phase 4 — Phase 5 is the first thing that triggers it. NO change needed beyond ensuring the paused assistant turn is pushed back unmodified (it already is at 368–371).

**Terminal-stop switch** (`chat.service.ts:373-409`): a web-search turn ending `end_turn` exits cleanly via the existing arm — no new branch.

---

### `services/tool-registry.service.ts` (MOD — service)

**Analog:** itself — `WRITE_PROPOSAL_TOOLS` (67–69) + `isWriteProposal` (87–89).

**Negative pattern (what NOT to do):** `web_search` must NOT be added to `WRITE_PROPOSAL_TOOLS` (stays read-only, `isWriteProposal` returns false) and must NOT be registered as a dispatchable executor (D-02). The explicit allow-list comment at 57–66 already documents why a new read tool defaults to non-write — confirm web-search inherits that default (likely zero code change; possibly a clarifying comment + a spec asserting `isWriteProposal('web_search') === false` and that a server-tool turn produces zero `dispatch` calls — RESEARCH E3).

---

### `services/fitness-context.service.ts` (MOD — system-prompt builder, transform)

**Analog:** itself — `buildSystemPrompt` (52+) + the `INSTRUCTIONS` constant (101) which already emits the `[source: research]` grading instruction (line 126).

**Where D-08/D-10 wording lands** (`fitness-context.service.ts:101-126`): extend the cacheable `INSTRUCTIONS` prefix with (a) when-to-reach-for-web guidance (D-08) and (b) the query-string privacy rule discouraging PII/health-specifics in search queries (D-10). The exact wording is the AI-SPEC §4b deliverable. Keep the byte-stable-prefix discipline (52–70 doc-comment): the instruction is STABLE text in the cached prefix, NOT volatile per-turn data. The redaction-toggle gating (`redactMealNotes` at line 176) already exists — D-10 per-note granularity is the existing behavior, confirm not the aggregate macro line.

---

### `services/storage.service.ts` (MOD — chokepoint, CRUD + file-I/O) — QUAL-02/04/05

**Analog:** itself.

**Quota detection (QUAL-02)** — replace the hardcoded 5 MB in `getStorageInfo` (308–330, specifically `const estimatedTotal = 5 * 1024 * 1024` at 314) with `navigator.storage.estimate()`. Extend `saveData`'s catch (272–278, `e.name === 'QuotaExceededError'`) to also match Firefox `NS_ERROR_DOM_QUOTA_REACHED` + numeric codes 22/1014. Exact `readQuota` + `isQuotaError` bodies in `05-RESEARCH.md §Pattern 4`.

**Archival keys (QUAL-05, D-13)** — new `fitness_tracker_archive_{conversationId}` methods. Analog: the existing per-key helpers `writeBackup` (172–181), `getBackup` (200–206), `pruneOldBackups` (216–235), `setDevSeed`/`consumeDevSeed` (351–380) — all show the sanctioned pattern for additional LocalStorage keys behind the chokepoint (best-effort try/catch, `static readonly` key prefix constant, never throw on read). `getBackup` (200–206) is also the D-14 95%-quota clipboard safety-valve surface.

**Multi-tab (QUAL-04)** — `lastModified` is written in `saveData` (264–265) but never read. The `storage`-event listener lives in `app.component.ts` (window event belongs at app root, RESEARCH Responsibility Map); StorageService only exposes `lastModified` for comparison.

---

### `services/cardio.service.ts` + `services/weight.service.ts` (MOD — CRUD)

**Analog:** `diet.service.ts updateSavedFood` (126–175) — the proven in-place update template. Each service today has only `getX`/`addX`/`getX(id)`/`deleteX` (cardio: 35–137; weight: `addEntry` 56, `deleteEntry` 114).

**`updateSession` / `updateEntry` to add** — copy the `updateSavedFood` shape and the `addSession` validation guard (`cardio.service.ts:56-96`). Identity-preservation pattern (D-12) exact body in `05-RESEARCH.md §Pattern 3`:
```typescript
updateSession(id: string, input: CreateCardioSession): Observable<CardioSession> {
  const v = validateCardio(input);                    // SAME validators (cardio.service.ts:58)
  if (!v.valid) return throwError(() => new CardioValidationError(v.errors));
  return this.storageService.getData().pipe(switchMap(data => {
    if (!data) return throwError(() => new Error('Storage not initialized'));
    const idx = data.cardioSessions.findIndex(s => s.id === id);
    if (idx < 0) return throwError(() => new Error('Cardio session not found'));
    const existing = data.cardioSessions[idx];
    const updated = { ...existing, ...input, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
    const cardioSessions = [...data.cardioSessions]; cardioSessions[idx] = updated;
    return this.storageService.saveData({ ...data, cardioSessions }).pipe(map(() => updated));
  }));
}
```
`diet.service.ts updateSavedFood:160-172` shows the exact `...existing` spread → re-pin identity → refresh `updatedAt` → save sequence.

---

### `services/readings.service.ts` (MOD — CRUD, discriminated union)

**Analog:** the three add methods `addBloodPressure`/`addBloodGlucose`/`addKetone` (73–144) + the `saveReading<T>` helper (187–204) + `diet.service.ts updateMeal` (280–336) for the find-replace-save mechanics.

**Three-method split (RESEARCH-recommended, D-12)** — mirror each add method into `updateBloodPressure`/`updateBloodGlucose`/`updateKetone`. Each keeps its narrow input type (`CreateBloodPressure` etc.), runs its own validator (`validateBloodPressure` at 74), and re-pins `id`+`createdAt` then refreshes `updatedAt`. This avoids the runtime-`type`-dispatch + widened input + `as` cast a single `updateReading` would force (RESEARCH Pitfall 7). The find-and-replace-in-array mechanics come from `diet.service.ts updateMeal:300-333`.

---

### `features/cardio|weight|readings/*-page.component.ts` (MOD — edit-mode form toggle, D-11)

**Analog:** `cardio-page.component.ts` is the reference; weight + readings pages copy its edit-mode wiring.

**Form + history-list surface to extend** (`cardio-page.component.ts:21-178` form, `196-231` history list): add a per-row **Edit** button next to the existing Delete button (211–220), toggle the existing reactive form into edit mode (`patchValue` the row), Save calls the new `update*` service method, Cancel restores add mode. NO modal, NO new route (D-11). Reuse the existing `onSubmit` branch (479–525) — add an `editingId: string | null` field + `onEdit(session)` / `onCancelEdit()` methods.

**Subscription + error patterns to copy** (`cardio-page.component.ts`): `takeUntilDestroyed(this.destroyRef)` on every subscribe (440, 451, 466, 509); `CardioValidationError` mapping (518–522); `submitError`/`loadError` + `<app-error-state>`/`<app-empty-state>` (184–194). The validators run UNCHANGED (D-11) — the form's `Validators.min/max` (412–429) already match the service validators.

---

### `features/chat/chat-message-list.component.ts` (MOD — citation renderer, D-03/D-04/D-05)

**Analog:** itself.

**`isLinkableCitation` allow-list — already admits web search** (`chat-message-list.component.ts:21-26`):
```typescript
export function isLinkableCitation(citation) {
  return citation?.type === 'search_result_location' || citation?.type === 'web_search_result_location';
}
```
This is the ONLY path to an `<a href>` (D-09 guard). Phase 5 is the first thing that actually produces such a citation. Footnote `[n]` + per-message Sources list (`https:`-only, D-03) extend the `@switch` template.

**`@switch` block renderer + grading-chip pattern to extend** (`chat-message-list.component.ts:52-92`): the source-axis render at line 54 currently emits research as plain text with `general knowledge — not a live source` qualifier. D-04 upgrades this: a `web_search_result_location`-backed claim becomes `from research · grounded` + footnote link; an un-grounded research claim KEEPS the existing plain-text framing. The `confidence-chip`/`source-chip` glyph + non-color-channel pattern (54, `confidenceGlyph` 312–316, `isCalm` 307–309) is the template — color is never the only channel (CLAUDE.md, D-04). Live search row (D-05) reuses the `tool-inflight` / `tool-disclosure` `@switch` arms (55–91) verbatim.

**Memoized parser binding** (`spansFor` 296–304 + `spanCache`): the new grounded-citation narrowing must be memoized the SAME way (parse once per block/text key, never per change-detection pass). Auto-escaped `{{ }}` interpolation (294 comment) keeps prose inert.

> The adversarial E1 spec (RESCH-03, zero-tolerance) extends `chat-message-list.component.spec.ts`: `querySelectorAll('a').length === 0` for model-authored prose across the web-search OFF/ON matrix.

---

### `features/chat/chat-page.component.ts` (MOD — 401 rotate-key + block-action errors, QUAL-07 + folded IN-01)

**Analog:** itself.

**401 mapping to upgrade (QUAL-07)** (`chat-page.component.ts:607-619`): `handleLoopError` already maps `err instanceof AnthropicApiError && err.statusCode === 401` to an inline `errorMessage`. The comment at 602–605 says "Phase 5 owns the rotate-key UX" — upgrade this to a recoverable `<app-error-state>` prompt to rotate/re-enter the key (analog: the `<app-error-state>` Retry surface at 75–81 and the `loopError` flag pattern).

**Block-action error surfacing (folded IN-01 → QUAL-09)** (`chat-page.component.ts:353, 356, 390`): `onBlockAction` (325–392) currently swallows approve/discard/edit failures with `console.error` only. Replace each `error: (err) => console.error(...)` with surfacing via the existing `errorMessage` banner / `<app-error-state>` (the same surface used at 82–85). This is exactly the error-state consistency QUAL-09 mandates.

---

### `features/settings/settings-ai.component.ts` (MOD — webSearchMaxUses cost context, D-06)

**Analog:** itself — the `webSearchMaxUses` number input (167–170) + `maxAgentTurns` input (152–158) + form control (398–399) already exist with `min=0 max=10`.

**Minimal change (D-06):** surface the configured `webSearchMaxUses` value near the `enableWebSearch` toggle (145) as a cost-context helper line so the per-message search ceiling is visible (success-criterion 1). Copy the existing `aria-describedby="enable-search-helper"` helper pattern at 145. No new form plumbing — the field is wired.

---

### `app.component.ts` (MOD — quota + multi-tab banner host, QUAL-02/04)

**Analog:** itself — the recovery-banner host pattern.

**Banner-host pattern to copy** (`app.component.ts:32-99`): the `<app-recovery-banner>` is hosted here ahead of `<router-outlet>`, fed via `StorageService` (NEVER direct `localStorage` — see the `loadBackupJson` chokepoint comment 71–81). Add: (1) a `storage`-event `window` listener (QUAL-04) that compares incoming `lastModified` and raises a "data changed elsewhere — refresh" banner; (2) the 70%/95% quota banners (QUAL-02) driven by `StorageService` quota reads. Reuse `recovery-banner.component.ts` as the structural template for new banner components (thin `<app-error-state>` wrapper, 24–55; clipboard/feature-detect 76–88 for the D-14 safety-valve). Init subscribe uses `takeUntilDestroyed(this.destroyRef)` (37–38).

> RESEARCH Pitfall 6: the `storage` event fires only in OTHER tabs — test with a synthetic `StorageEvent` (unit) or two Puppeteer pages (e2e).

---

### `src/index.html` (MOD — CSP, QUAL-06)

**Analog:** itself — the `<head>` block (3–9). Add a `<meta http-equiv="Content-Security-Policy">` tag.

**Exact policy (D-15)** + the `style-src` caveat: `default-src 'self'; connect-src 'self' https://api.anthropic.com; script-src 'self'; object-src 'none'; img-src 'self' data:;`. RESEARCH Pitfall 5 / Assumption A1: Angular 18 injects component `styles:[...]` inline, so verify whether `style-src 'self' 'unsafe-inline'` must be added at build time and document the chosen value. The `connect-src` allow-list encodes the locked architecture (Anthropic API as sole egress).

## Shared Patterns

### Pure-module / runtime-validation (no zod, no Pydantic)
**Source:** `services/confidence-attribution-parser.ts:1-80` (also `validators.ts`, `chat-block-serializer.ts`)
**Apply to:** `web-citation-parser.ts`, any new narrowing logic
Frozen module-scope `ReadonlySet` allow-list + total function (never throws, any input → valid output) + `Threat-model:` doc-comment. This is THE project pattern for "schema-validated model output."

### Storage chokepoint
**Source:** `storage.service.ts` (all `localStorage.*` calls live here) + `app.component.ts:71-81` (consumer comment)
**Apply to:** archival keys (D-13), quota reads (QUAL-02), multi-tab (QUAL-04), 95% safety-valve (D-14)
Zero `localStorage.*` outside `storage.service.ts`. New keys = `static readonly` prefix constant + best-effort try/catch + never-throw read (`getBackup:200-206` template). Tree-wide grep gate stays green.

### SDK transport boundary (D-17)
**Source:** `anthropic-api.service.ts:49-51` + `chat-block-serializer.ts:22-23` (lint-chokepoint comments)
**Apply to:** all web-search SDK types
Only those two files import `@anthropic-ai/sdk`. Everything downstream consumes local SDK-free shapes (`GroundedCitation`, `ChatTurnEvent`, `SystemTextBlock` at `fitness-context.service.ts:22-26`). Confirm where `web-citation-parser.ts` sits relative to this gate (see its assignment above).

### Service CRUD shape
**Source:** `diet.service.ts updateSavedFood:126-175`, `cardio.service.ts addSession:56-96`
**Apply to:** `cardio/weight/readings` `update*` methods
Validate-first → `getData().pipe(switchMap(...))` → `findIndex` (404 if `< 0`) → `{...existing, ...input, id, createdAt, updatedAt: now}` → copy-array-replace → `saveData().pipe(map(() => updated))`. Each service owns its `*ValidationError` class (`cardio.service.ts:11-20`).

### Component subscription cleanup
**Source:** every feature component, e.g. `cardio-page.component.ts:396, 440, 451, 466, 509`; `app.component.ts:29, 37-38`
**Apply to:** all new edit-mode wiring, the multi-tab listener, banner hosts
`private destroyRef = inject(DestroyRef)` + `.pipe(takeUntilDestroyed(this.destroyRef))` on every `.subscribe`.

### Empty/error-state surfaces
**Source:** `shared/error-state.component.ts`, `shared/empty-state.component.ts`, `shared/recovery-banner.component.ts`; usage `cardio-page.component.ts:184-194`
**Apply to:** 401 rotate-key (QUAL-07), block-action errors (IN-01/QUAL-09), quota + multi-tab banners (QUAL-02/04), a11y/UX sweep (QUAL-08/09)
Reuse `<app-error-state>` / `<app-empty-state>` (FOUND-06) — never build new error UI. `recovery-banner.component.ts` is the template for a new `<app-error-state>`-wrapping banner.

### Schema migration discipline
**Source:** `storage.service.ts migrateData:411-435` + `migrateV4ToV5:527-566` + `legacy-schemas.ts`
**Apply to:** V6 migration (citations / server-tool blocks)
Typed `LegacyAppDataVN → VN+1` chain hop + bump `CURRENT_SCHEMA_VERSION` + backward-compat fixture test (CLAUDE.md checklist). Auto-backup runs via `writeBackup`/`pruneOldBackups`.

### Test pattern
**Source:** per-service `.spec.ts` (mock `StorageService`, order-agnostic), `shared/a11y-test-helpers.ts` (`expectNoSeriousA11yViolations`)
**Apply to:** every new/extended spec; QUAL-08 (remove `disableRules:['color-contrast']`); QUAL-10 Stryker on `validators.ts`
Mock storage/timers; tests independent + order-agnostic. axe per-route via the existing helper. Stryker config shape in `05-RESEARCH.md §Standard Stack`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `stryker.config.json` | dev config | — | No mutation-testing tooling exists yet; shape is fully specified in `05-RESEARCH.md §Standard Stack` (`projectType: angular-cli`, mutate `validators.ts`). Net-new dev dependency install. |

> Every PRODUCTION file has an exact in-repo analog. The only true greenfield artifact is the Stryker config (QUAL-10), and its content is dictated by the official Angular guide quoted in research — no codebase analog needed.

## Metadata

**Analog search scope:** `src/app/services`, `src/app/models`, `src/app/features/{chat,settings,cardio,weight,readings}`, `src/app/shared`, `src/app/app.component.ts`, `src/index.html`
**Files scanned:** 16 source files read in full or targeted-range; 56 source files enumerated
**Pattern extraction date:** 2026-05-31
**Skills checked:** no `.claude/skills` or `.agents/skills` directory present
