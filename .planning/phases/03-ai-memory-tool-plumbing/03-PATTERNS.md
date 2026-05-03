# Phase 3: AI Memory + Tool Plumbing — Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 23 (15 new, 8 modified)
**Analogs found:** 22 / 23 (one pure-module bridge has a partial-match analog only)

> Phase 3 is plumbing-only and file-disjoint with Phase 2. Every new service has a closely-matching in-tree analog (Cardio/Weight/AI-settings service shape). The V4→V5 migration extends the FOUND-07 typed-legacy harness already in `legacy-schemas.ts` + `storage.service.ts`. All UI surfaces compose existing shared primitives (`<app-empty-state>`, `<app-error-state>`, `<app-recovery-banner>`) and reuse the standalone-component + Reactive-Forms pattern from `settings-page.component.ts` + `cardio-page.component.ts`. Pattern excerpts below are verbatim — planner cites them with file:line refs in PLAN.md actions.

## File Classification

### New files (15)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/app/services/anthropic-api.service.ts` (rewrite) | service (transport) | request-response | `src/app/services/anthropic-api.service.ts` (current hand-rolled) | exact (replaces same surface) |
| `src/app/services/chat-block-serializer.ts` | pure-module (bridge) | transform | `src/app/services/validators.ts` (pure module pattern) + `src/app/services/legacy-schemas.ts` (type-only convention) | role-match (no exact "wire bridge" analog yet) |
| `src/app/services/user-profile.service.ts` | service (domain) | CRUD | `src/app/services/ai-settings.service.ts` (single-record CRUD over `data.aiSettings`) | exact |
| `src/app/services/memory-store.service.ts` | service (domain) | CRUD | `src/app/services/cardio.service.ts` + `src/app/services/weight.service.ts` (Observable wrapper over an `AppData.<collection>`) | exact |
| `src/app/services/memory-tool-executor.service.ts` | service (dispatcher) | request-response (in-process) | `src/app/services/cardio.service.ts` (validate → mutate → return typed result) + `src/app/services/validators.ts` (range validators) | role-match |
| `src/app/services/tool-registry.service.ts` | service (registry) | dispatch | `src/app/services/ai-settings.service.ts` (small `@Injectable({providedIn:'root'})` with a Map field) | role-match |
| `src/app/services/fitness-context.service.ts` (modify) | service (prompt builder) | transform | `src/app/services/fitness-context.service.ts` (same file, extended) | exact (in-place extension) |
| `src/app/models/user-profile.model.ts` | model | n/a | `src/app/models/weight-entry.model.ts` (interface + helper export) + `src/app/models/ai-chat.model.ts` (DEFAULT_X constant pattern) | exact |
| `src/app/models/ai-chat.model.ts` (modify) | model | n/a | `src/app/models/health-reading.model.ts` (discriminated union on `type` field — model pattern for `ChatBlock`) | exact |
| `src/app/models/app-data.model.ts` (modify) | model | n/a | `src/app/models/app-data.model.ts` (same file, add fields + bump version) | exact (in-place extension) |
| `src/app/services/storage.service.ts` (modify) | service (storage) | CRUD | `src/app/services/storage.service.ts` `migrateV3ToV4` (lines 440-451) | exact (next link in same chain) |
| `src/app/services/legacy-schemas.ts` (modify) | type-only | n/a | `src/app/services/legacy-schemas.ts` `LegacyAppDataV3` (lines 87-95) | exact (next type in same file) |
| `src/app/features/settings/settings-shell.component.ts` | component (route shell) | event-driven (router) | `src/app/features/chat/chat-page.component.ts` (sidebar + main layout) + `src/app/shared/nav.component.ts` (RouterLink + RouterLinkActive) | role-match |
| `src/app/features/settings/settings-profile.component.ts` | component (form page) | request-response | `src/app/features/settings/settings-page.component.ts` (current AI settings form — Reactive-Forms + status message) | exact |
| `src/app/features/settings/settings-ai.component.ts` (rename) | component (form page) | request-response | `src/app/features/settings/settings-page.component.ts` (renamed in place + extended) | exact |
| `src/app/features/settings/settings-memory.component.ts` | component (inspector) | CRUD | `src/app/features/cardio/cardio-page.component.ts` (list + delete pattern over a domain collection) | role-match |
| `src/app/features/chat/pending-pill.component.ts` | component (presentation) | event-driven | `src/app/features/chat/chat-message-list.component.ts` (block-rendering + status switch) + `src/app/features/chat/chat-conversation-list.component.ts` (Output emitters) | role-match |

### Modified files (8)

| Modified File | Role | Data Flow | Existing Pattern To Preserve |
|---------------|------|-----------|------------------------------|
| `src/app/features/chat/chat-message-list.component.ts` | component | event-driven | Existing `@for ... track msg.id` + scroll-on-changes pattern (lines 11-22, 118-127) — preserve, swap inner content for `@switch (block.type)` |
| `src/app/features/chat/chat-page.component.spec.ts` | test | n/a | Existing characterization spec at `chat-page.component.spec.ts:25-46` — adapt fixture helpers from `content: string` to `blocks: [{type:'text', text:'Hello'}]` |
| `src/app/services/chat.service.ts` | service (orchestrator) | request-response | `chat.service.ts:178-212` (`buildApiMessages`), `chat.service.ts:214-283` (`maybeSummarize`) — derive text from blocks via serializer; sliding-window math unchanged |
| `src/app/app.routes.ts` | config | n/a | Existing `loadComponent` pattern (lines 5-37) — `/settings` route migrates from single `loadComponent` to parent shell + 3 children |
| `src/app/shared/nav.component.ts` | component | n/a | No structural change — single `Settings` link continues to `/settings`, redirect in routes handles the rest |
| Test fixtures `src/app/services/migrations/fixtures/v4.json` (new) | fixture | n/a | `fixtures/v3.json` (lines 1-19) — same JSON shape conventions |
| Test fixtures `src/app/services/migrations/fixtures/v5-expected.json` (new) | fixture | n/a | `fixtures/v4-expected.json` (lines 1-20) — same expected-shape pattern |
| Test fixtures `src/app/services/migrations/fixtures/malformed/v4-malformed-*.json` (new) | fixture | n/a | `fixtures/malformed/wrong-types.json` (lines 1-9) + 3 sibling files — same 4-fixture matrix shape |

## Pattern Assignments

### `src/app/services/anthropic-api.service.ts` (rewrite — service, transport)

**Analog:** `src/app/services/anthropic-api.service.ts` (current hand-rolled fetch wrapper, replaced surface)

**Imports pattern to delete and replace** (`anthropic-api.service.ts:1-14`):
```typescript
import { Injectable } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
}
```
Replace with SDK-typed surface — see AI-SPEC.md §3 "Entry Point Pattern" for the canonical shape (default `import Anthropic from '@anthropic-ai/sdk'` + `import type { Message, MessageCreateParams, MessageParam }` from `@anthropic-ai/sdk/resources/messages`).

**Error-class pattern to preserve** (`anthropic-api.service.ts:36-45`):
```typescript
export class AnthropicApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorType?: string
  ) {
    super(message);
    this.name = 'AnthropicApiError';
  }
}
```
Keep the public surface identical (statusCode + errorType); add an optional `requestId` field per AI-SPEC.md §3 to preserve SDK request_id for correlation. Existing callers (`chat-page.component.ts:286-290`) use `err instanceof AnthropicApiError && err.statusCode === 401` — that contract MUST keep working.

**Friendly-message switch to preserve verbatim** (`anthropic-api.service.ts:81-99`):
```typescript
private getErrorMessage(status: number, body: Record<string, unknown> | null): string {
  switch (status) {
    case 401:
      return 'Invalid API key. Please check your key in Settings.';
    case 429:
      return 'Rate limited. Please wait a moment and try again.';
    case 400:
      return apiMessage || 'Bad request. Please try a shorter message.';
    case 403:
      return 'Access forbidden. Your API key may not have permission for this model.';
    case 500:
    case 529:
      return 'Anthropic API is temporarily unavailable. Please try again later.';
    default:
      return apiMessage || `API error (${status})`;
  }
}
```
Move into the SDK rewrite verbatim (rename to `friendlyMessage(status, fallback)`), invoked from `mapError(err: unknown)` after `err instanceof Anthropic.APIError`.

**Spec pattern to preserve** (`anthropic-api.service.spec.ts:13-22`):
```typescript
function mockFetch(response: Partial<Response>): jasmine.Spy {
  const mockResponse = {
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    ...response
  } as Response;
  return spyOn(globalThis, 'fetch').and.returnValue(Promise.resolve(mockResponse));
}
```
This must be replaced. SDK rewrite test pattern: spy on `Anthropic.prototype.messages.create` (or inject a fake client through a constructor seam). Existing assertions (`statusCode === 401`, `statusCode === 429`, friendly-message coverage) port to the SDK surface 1:1 — keep one assertion per status code so callers' `err.statusCode` switch behavior is regression-locked.

---

### `src/app/services/chat-block-serializer.ts` (NEW — pure module, transform)

**Analog (form):** `src/app/services/validators.ts` (pure module, no `@Injectable`, exports functions)
**Analog (type-only convention):** `src/app/services/legacy-schemas.ts` (type-only module beside services/)

**Pure-module shape from validators.ts** (`validators.ts:1-12, 56-85`):
```typescript
import { CreateCardioSession, CardioType, CARDIO_TYPES } from '../models/cardio-session.model';
// ... no @Injectable, no class, just exported functions and constants

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export const VALIDATION_LIMITS = {
  DURATION_MIN: 1,
  DURATION_MAX: 1440,
  // ...
} as const;

export function validateCardio(data: CreateCardioSession): ValidationResult { ... }
```
Apply the same shape to `chat-block-serializer.ts`:
- No `@Injectable`, no class, no DI
- Exports two pure functions: `toAnthropicContent(blocks: ChatBlock[]): ContentBlockParam[]` and `fromAnthropicMessage(msg: Message): ChatBlock[]`
- Strip `status`/`editedFromText` (persistence-only fields per CONTEXT.md D-15/D-16)
- Drop `status='discarded'` blocks; replace `status='pending'` tool_use with text placeholder
- Lint chokepoint: only `services/anthropic-api.service.ts` and `services/chat-block-serializer.ts` may `from '@anthropic-ai/sdk'` (RESEARCH.md §"Architecture diagram" lint rule)

**Header-comment pattern from legacy-schemas.ts** (`legacy-schemas.ts:1-14`):
```typescript
/**
 * Typed legacy shapes for the AppData migration chain.
 *
 * One interface per from-version. ...
 *
 * No runtime code — type-only module. Mirrors validators.ts pure-module
 * pattern but with types only (no `@Injectable`, no class).
 */
```
Use the same documentation style at the top of `chat-block-serializer.ts`: explicit "PURE MODULE — no DI, no @Injectable" line so future readers don't add one.

---

### `src/app/services/user-profile.service.ts` (NEW — service, CRUD)

**Analog:** `src/app/services/ai-settings.service.ts` (single-record CRUD over a single optional field on `AppData`, not a collection)

**Imports + DI pattern** (`ai-settings.service.ts:1-10`):
```typescript
import { Injectable } from '@angular/core';
import { Observable, map, switchMap, throwError } from 'rxjs';
import { StorageService } from './storage.service';
import { AISettings, CLAUDE_MODELS, DEFAULT_AI_SETTINGS } from '../models/ai-chat.model';

@Injectable({
  providedIn: 'root'
})
export class AISettingsService {
  constructor(private storageService: StorageService) {}
```
Apply to `UserProfileService` swapping `AISettings` / `DEFAULT_AI_SETTINGS` → `UserProfile` / `DEFAULT_USER_PROFILE` from new `models/user-profile.model.ts`.

**Get pattern** (`ai-settings.service.ts:12-16`):
```typescript
getSettings(): Observable<AISettings> {
  return this.storageService.getData().pipe(
    map(data => data?.aiSettings ?? { ...DEFAULT_AI_SETTINGS })
  );
}
```
Apply: `getProfile(): Observable<UserProfile>` returning `data?.userProfile ?? { ...DEFAULT_USER_PROFILE }`.

**Save with validation pattern** (`ai-settings.service.ts:18-35`):
```typescript
saveSettings(settings: AISettings): Observable<void> {
  const errors = this.validate(settings);
  if (errors.length > 0) {
    return throwError(() => new Error(errors.join('; ')));
  }

  return this.storageService.getData().pipe(
    switchMap(data => {
      if (!data) {
        return throwError(() => new Error('Storage not initialized'));
      }
      return this.storageService.saveData({
        ...data,
        aiSettings: settings
      });
    })
  );
}
```
Apply: validate the 4 sections against the 4096-char cap (CONTEXT.md D-05), set `userProfile: { ...profile, updatedAt: new Date().toISOString() }` on save.

**Inline validation pattern** (`ai-settings.service.ts:49-66`):
```typescript
private validate(settings: AISettings): string[] {
  const errors: string[] = [];
  if (settings.apiKey && !settings.apiKey.startsWith('sk-ant-')) {
    errors.push('API key must start with "sk-ant-"');
  }
  // ...
  return errors;
}
```
Apply: per-section length check; same `string[]` errors return shape (not `ValidationError[]` — small, single-service-local validation matches `ai-settings.service.ts` precedent rather than `validators.ts` complexity).

---

### `src/app/services/memory-store.service.ts` (NEW — service, CRUD)

**Analog:** `src/app/services/cardio.service.ts` and `src/app/services/weight.service.ts` (Observable CRUD over an `AppData.<collection>`; near-identical shapes)

**Imports + DI** (`cardio.service.ts:1-7, 22-30`):
```typescript
import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { generateId } from '../shared/id';
import { StorageService } from './storage.service';
// ...

@Injectable({
  providedIn: 'root'
})
export class CardioService {
  constructor(private storageService: StorageService) {}
```
Apply: `MemoryStoreService` over `Record<string, string>` (paths → file content). No `generateId()` usage — the path IS the key.

**List/get pattern** (`cardio.service.ts:35-46`):
```typescript
getSessions(): Observable<CardioSession[]> {
  return this.storageService.getData().pipe(
    map(data => {
      if (!data) return [];
      return [...data.cardioSessions].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    })
  );
}
```
Apply: `listFiles(): Observable<Array<{ path: string; size: number }>>` over `Object.entries(data.memoryFiles)` — sort lexicographically by path (no date column on memory files). And `getFile(path: string): Observable<string | null>`.

**Add/update pattern (preserve switchMap shape for "read fresh, mutate, save")** (`cardio.service.ts:79-96`):
```typescript
return this.storageService.getData().pipe(
  switchMap(data => {
    if (!data) {
      return throwError(() => new Error('Storage not initialized'));
    }

    const updatedData = {
      ...data,
      cardioSessions: [...data.cardioSessions, newSession]
    };

    return this.storageService.saveData(updatedData).pipe(
      map(() => newSession)
    );
  })
);
```
Apply: `writeFile(path, content)` becomes `{ ...data, memoryFiles: { ...data.memoryFiles, [path]: content } }`.

**Delete pattern** (`cardio.service.ts:117-137`):
```typescript
deleteSession(id: string): Observable<boolean> {
  return this.storageService.getData().pipe(
    switchMap(data => {
      if (!data) {
        return throwError(() => new Error('Storage not initialized'));
      }

      const exists = data.cardioSessions.some(session => session.id === id);
      if (!exists) {
        return of(false);
      }

      const updatedData = {
        ...data,
        cardioSessions: data.cardioSessions.filter(session => session.id !== id)
      };

      return this.storageService.saveData(updatedData).pipe(map(() => true));
    })
  );
}
```
Apply: `deleteFile(path): Observable<boolean>` checks `path in data.memoryFiles`, builds `const { [path]: _, ...rest } = data.memoryFiles;` and saves `{ ...data, memoryFiles: rest }`.

**Spec scaffold from `cardio.service.spec.ts:1-48`:**
```typescript
import { TestBed } from '@angular/core/testing';
import { CardioService, CardioValidationError } from './cardio.service';
import { StorageService } from './storage.service';
// ...
import { of } from 'rxjs';

describe('CardioService', () => {
  let service: CardioService;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;
  let mockAppData: AppData;

  beforeEach(() => {
    mockAppData = createEmptyAppData();
    storageServiceSpy = jasmine.createSpyObj('StorageService', ['initialize', 'getData', 'saveData']);
    storageServiceSpy.initialize.and.returnValue(of(undefined));
    storageServiceSpy.getData.and.returnValue(of(mockAppData));
    storageServiceSpy.saveData.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        CardioService,
        { provide: StorageService, useValue: storageServiceSpy }
      ]
    });
    service = TestBed.inject(CardioService);
  });
```
Apply this scaffold verbatim for `MemoryStoreService`, `UserProfileService`, `MemoryToolExecutor`, `ToolRegistryService`, and `chat-block-serializer.spec.ts` (TestBed without spies — pure module).

---

### `src/app/services/memory-tool-executor.service.ts` (NEW — service, dispatcher)

**Analog (form):** `src/app/services/cardio.service.ts` (validate → mutate → return typed result)
**Analog (validation style):** `src/app/services/validators.ts` (range checks producing typed errors)

**Custom error class pattern** (`cardio.service.ts:11-20`):
```typescript
export class CardioValidationError extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    const message = errors.map(e => `${e.field}: ${e.message}`).join('; ');
    super(message);
    this.name = 'CardioValidationError';
    this.errors = errors;
  }
}
```
Apply: `MemoryPathError extends Error` with `name = 'MemoryPathError'` for path-validator failures. Throw before any `MemoryStoreService` call. Single source of truth for path validation per CONTEXT.md "Specific Ideas" + AI-SPEC.md critical-failure-mode #4.

**Validate-then-mutate ordering** (`cardio.service.ts:56-77`):
```typescript
addSession(sessionData: CreateCardioSession): Observable<CardioSession> {
  const validationResult = validateCardio(sessionData);

  if (!validationResult.valid) {
    return throwError(() => new CardioValidationError(validationResult.errors));
  }

  const now = new Date().toISOString();
  const newSession: CardioSession = {
    id: generateId(),
    // ...
  };
  // then storage mutation
}
```
Apply per memory-tool command: validate path first (parsed-segment check per RESEARCH.md "Claude's Discretion"), then dispatch to `MemoryStoreService.{readFile,writeFile,deleteFile,...}`. Return canonical `memory_20250818` string per Anthropic docs (researcher to confirm at planning time).

---

### `src/app/services/tool-registry.service.ts` (NEW — service, registry)

**Analog:** `src/app/services/ai-settings.service.ts` (small `@Injectable({providedIn:'root'})` with private state field, no collection CRUD)

**Class shape** (`ai-settings.service.ts:6-11`):
```typescript
@Injectable({
  providedIn: 'root'
})
export class AISettingsService {
  constructor(private storageService: StorageService) {}
```
Apply: `ToolRegistryService` with `private executors = new Map<string, MemoryToolExecutor /* | DataQueryToolExecutor — Phase 4 */>()`. Constructor-inject `MemoryToolExecutor` and call `this.executors.set('memory', memoryExec)` once. Phase 3 dispatcher: `dispatch(toolName: string, input: unknown): Observable<string>` — but **never invoked from `chat.service.ts` in Phase 3** (SC5; AI-SPEC.md §1 critical-failure-mode #5).

---

### `src/app/services/fitness-context.service.ts` (MODIFY — service, prompt builder)

**Analog:** Same file, in-place extension.

**Existing buildSystemPrompt pattern to extend** (`fitness-context.service.ts:16-33`):
```typescript
buildSystemPrompt(): Observable<string> {
  return this.storageService.getData().pipe(
    map(data => {
      const snapshot = data ? this.buildFitnessDataSnapshot(data) : 'No fitness data recorded yet.';
      return `You are a knowledgeable health and fitness expert and personal assistant.
You are working with the user as their dedicated fitness advisor. You have
access to their tracked fitness data below. Reference their actual data
when relevant. Be supportive, evidence-based, and concise.

Remember key details from our conversations — the user's goals, preferences,
injuries, and any context they share with you.

## Current Fitness Data (as of ${new Date().toISOString()})

${snapshot}`;
    })
  );
}
```
Extend per CONTEXT.md D-03:
1. Read `data.userProfile` and `data.aiToolSettings` from same `getData()` pipe
2. Build `## User Profile` section BEFORE `## Current Fitness Data`; omit entirely when all 4 sections are empty (CONTEXT.md "Specific Ideas")
3. Wrap each non-empty section in delimiters: `<user_profile_goals>...</user_profile_goals>` etc.
4. Same delimiter pattern (`<user_meal_note>`, `<user_cardio_note>`, `<user_weight_note>`, `<user_reading_note>`) wrapped around free-text fields inside `buildWeightSection`/`buildCardioSection`/`buildHealthSection`/`buildNutritionSection`
5. Strip the literal closing tag from user content before wrapping (escape via `.replace(/<\/user_/gi, '<\\/user_')` or similar — researcher-locked pattern)

**Existing data-snapshot pattern preserved** (`fitness-context.service.ts:46-77`, weight section):
```typescript
private buildWeightSection(entries: WeightEntry[]): string {
  if (entries.length === 0) {
    return '### Weight Trend\nNo weight entries recorded.';
  }
  // ... averaging, trend math
  return `### Weight Trend
- Latest: ${latest.weightLbs} lbs on ${latestDate}
- 7-day avg: ${avg7} lbs | 30-day change: ${changeStr}`;
}
```
Math unchanged. Add a redaction-toggle gate at section entry: `if (toolSettings.redactWeightEntries) return '';` (CONTEXT.md D-09). Same gate for `redactHealthReadings` in `buildHealthSection` and meal-notes-only stripping in `buildNutritionSection`.

---

### `src/app/models/user-profile.model.ts` (NEW — model)

**Analog (interface form):** `src/app/models/weight-entry.model.ts`
**Analog (DEFAULT_X export):** `src/app/models/ai-chat.model.ts:33`

**Interface pattern** (`weight-entry.model.ts:1-22`):
```typescript
/**
 * Represents a single weight measurement.
 */
export interface WeightEntry {
  /** Unique identifier (UUID v4) */
  id: string;
  /** Date and time of the measurement (ISO 8601) */
  date: string;
  /** Weight in pounds (50-1000) */
  weightLbs: number;
  /** Optional notes (max 500 chars) */
  notes?: string;
  /** When the record was created (ISO 8601) */
  createdAt: string;
  /** When the record was last updated (ISO 8601) */
  updatedAt: string;
}
```
Apply: `UserProfile` with `goals: string`, `preferences: string`, `dietaryConstraints: string`, `trainingHistory: string`, `updatedAt: string` (per CONTEXT.md D-01). All-empty-string defaults; no `id`/`createdAt` (singleton, not a collection entity).

**DEFAULT export pattern** (`ai-chat.model.ts:33`):
```typescript
export const DEFAULT_AI_SETTINGS: AISettings = { maxResponseTokens: 4096 };
```
Apply: `export const DEFAULT_USER_PROFILE: UserProfile = { goals: '', preferences: '', dietaryConstraints: '', trainingHistory: '', updatedAt: '' };`

**Barrel export pattern** (`models/index.ts:1-6`):
```typescript
// Barrel export for all models
export * from './app-data.model';
export * from './cardio-session.model';
// ...
export * from './ai-chat.model';
```
Add `export * from './user-profile.model';` to the same barrel.

---

### `src/app/models/ai-chat.model.ts` (MODIFY — model)

**Analog (discriminated-union pattern):** `src/app/models/health-reading.model.ts` (HealthReading uses `type: 'blood_pressure' | 'blood_glucose' | 'ketone'` discriminator)

**Existing ChatMessage to mutate** (`ai-chat.model.ts:1-9`):
```typescript
export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;       // ← REMOVE per CONTEXT.md D-15
  tokenEstimate: number;
  createdAt: string;
}
```
Per D-15: full cut-over. Replace `content: string` with `blocks: ChatBlock[]`. No transitional shim.

**Discriminated-union pattern (referenced from `health-reading.model.ts`)** to apply for `ChatBlock`:
- `TextBlock = { type: 'text'; text: string }`
- `ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown; status: 'pending' | 'approved' | 'discarded' | 'edited'; editedFromText?: string }` — `status` and `editedFromText` are persistence-only; serializer strips them (CONTEXT.md D-11/D-15/D-16)
- `ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string; isError?: boolean }`
- `export type ChatBlock = TextBlock | ToolUseBlock | ToolResultBlock`

**New AIToolSettings interface** beside `AISettings` (per CONTEXT.md D-09 + RESEARCH.md "Claude's Discretion"):
```typescript
export interface AIToolSettings {
  enableDataQueryTools: boolean;     // default true
  enableMemoryTool: boolean;         // default true
  enableWebSearch: boolean;          // default false
  webSearchMaxUses: number;          // default 3
  maxAgentTurns: number;             // default 10
  redactHealthReadings: boolean;     // default false (D-09)
  redactWeightEntries: boolean;      // default false
  redactMealNotes: boolean;          // default false
}

export const DEFAULT_AI_TOOL_SETTINGS: AIToolSettings = {
  enableDataQueryTools: true,
  enableMemoryTool: true,
  enableWebSearch: false,
  webSearchMaxUses: 3,
  maxAgentTurns: 10,
  redactHealthReadings: false,
  redactWeightEntries: false,
  redactMealNotes: false,
};
```

---

### `src/app/models/app-data.model.ts` (MODIFY — model)

**Analog:** Same file, in-place schema bump.

**Existing pattern to mutate** (`app-data.model.ts:11-44`):
```typescript
export interface AppData {
  /** Schema version for migration support. Current: 4 */
  schemaVersion: number;

  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  savedFoods: SavedFood[];
  mealEntries: MealEntry[];
  aiSettings?: AISettings;
  chatConversations: ChatConversation[];
  lastModified: string;
}

/** Current schema version */
export const CURRENT_SCHEMA_VERSION = 4;
```
Apply (V5):
- Add `memoryFiles: Record<string, string>` (paths under `/memories/` → file content)
- Add `userProfile: UserProfile`
- Add `aiToolSettings: AIToolSettings`
- Update doc comment "Current: 4" → "Current: 5"
- Bump `CURRENT_SCHEMA_VERSION = 5`
- Update `createEmptyAppData()` to include `memoryFiles: {}, userProfile: { ...DEFAULT_USER_PROFILE }, aiToolSettings: { ...DEFAULT_AI_TOOL_SETTINGS }`

**createEmptyAppData pattern** (`app-data.model.ts:49-60`):
```typescript
export function createEmptyAppData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    cardioSessions: [],
    weightEntries: [],
    healthReadings: [],
    savedFoods: [],
    mealEntries: [],
    chatConversations: [],
    lastModified: new Date().toISOString()
  };
}
```
Extend with the 3 new V5 fields above.

---

### `src/app/services/storage.service.ts` (MODIFY — service, storage)

**Analog:** Same file. New `migrateV4ToV5` is the next link in the existing typed-legacy chain.

**Migration chain pattern** (`storage.service.ts:358-378`):
```typescript
private migrateData(data: unknown): AppData {
  const fromVersion = (data as { schemaVersion?: number }).schemaVersion ?? 0;

  const v1: LegacyAppDataV1 = (fromVersion < 1)
    ? this.migrateV0ToV1(data as LegacyAppDataV0)
    : (data as LegacyAppDataV1);

  const v2: LegacyAppDataV2 = (fromVersion < 2)
    ? this.migrateV1ToV2(v1)
    : (data as LegacyAppDataV2);

  const v3: LegacyAppDataV3 = (fromVersion < 3)
    ? this.migrateV2ToV3(v2)
    : (data as LegacyAppDataV3);

  const v4: AppData = (fromVersion < 4)
    ? this.migrateV3ToV4(v3)
    : (data as AppData);

  return v4;
}
```
Extend: cast V4 to `LegacyAppDataV4` (new type), add `const v5: AppData = (fromVersion < 5) ? this.migrateV4ToV5(v4) : (data as AppData);`. Return `v5`.

**Closest sibling step (V3→V4) — exact template for V4→V5** (`storage.service.ts:436-451`):
```typescript
/**
 * Migration from version 3 to version 4.
 * Adds AI chat fields (chatConversations defaults to []; aiSettings stays
 * undefined per CLAUDE.md "no null for absent optional fields").
 */
private migrateV3ToV4(data: LegacyAppDataV3): AppData {
  return {
    schemaVersion: 4,
    cardioSessions: data.cardioSessions,
    weightEntries: data.weightEntries,
    healthReadings: data.healthReadings,
    savedFoods: data.savedFoods,
    mealEntries: data.mealEntries,
    chatConversations: [],
    lastModified: data.lastModified
  };
}
```
Apply for `migrateV4ToV5(data: LegacyAppDataV4): AppData` per RESEARCH.md §"Pattern 1" full code excerpt — critical detail: the lift `messages[].content` → `messages[].blocks` is the only field-level transform (everything else is "carry forward + default new fields"). Order matters per CONTEXT.md "Specific Ideas": build new `blocks` array → validate → swap into the new `ChatMessage` → omit `content` from V5 shape. Defensive null guard: `text: msg.content ?? ''` (don't drop the message; render an empty bubble instead).

**Backup-before-migrate harness preserved** (`storage.service.ts:127-148`):
```typescript
if (fromVersion < CURRENT_SCHEMA_VERSION) {
  // D-14: write a backup snapshot BEFORE the migration runs.
  // Pitfall 4: prune older backups first so the new write has room.
  this.pruneOldBackups();
  const backupKey = this.writeBackup(rawData, fromVersion);

  try {
    this.cachedData = this.migrateData(parsed);
    this.persistToStorage(this.cachedData);
  } catch (e) {
    return throwError(() => new StorageError(
      `Migration failed (v${fromVersion} → v${CURRENT_SCHEMA_VERSION}). Backup at ${backupKey}.`,
      'MIGRATION_FAILED',
      e instanceof Error ? e : undefined,
    ));
  }
}
```
**No change required** — `CURRENT_SCHEMA_VERSION` bump from 4→5 makes this fire automatically for every existing V4 user. Recovery banner already wired (RESEARCH.md "Phase 1 recovery banner"). No new error UX.

---

### `src/app/services/legacy-schemas.ts` (MODIFY — type-only)

**Analog:** Same file. Add `LegacyAppDataV4` after `LegacyAppDataV3`.

**Existing pattern to extend** (`legacy-schemas.ts:83-95`):
```typescript
/**
 * V3 shape: savedFoods migrated to current SavedFood shape (baseUnit/nutrientsPerUnit).
 * No chatConversations/aiSettings yet — those are V4+.
 */
export interface LegacyAppDataV3 {
  schemaVersion: 3;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  savedFoods: SavedFood[];
  mealEntries: MealEntry[];
  lastModified: string;
}
```
Apply: add `LegacyAppDataV4` per RESEARCH.md §"Pattern 1" — note `content: string` (not `blocks`) on `LegacyChatMessageV4`; chatConversations exist; no memoryFiles/userProfile/aiToolSettings:
```typescript
export interface LegacyAppDataV4 {
  schemaVersion: 4;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  savedFoods: SavedFood[];
  mealEntries: MealEntry[];
  aiSettings?: AISettings;
  chatConversations: LegacyChatConversationV4[];
  lastModified: string;
}

export interface LegacyChatConversationV4 {
  id: string;
  title: string;
  messages: LegacyChatMessageV4[];
  summary?: string;
  summarizedMessageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyChatMessageV4 {
  id: string;
  role: 'user' | 'assistant';
  content: string;        // V4 — pre-blocks shape
  tokenEstimate: number;
  createdAt: string;
}
```
Plus an import line: `import { ChatConversation, AISettings } from '../models/ai-chat.model';` — except `ChatConversation` is V5+ shape, so legacy types must be self-contained. Use only `AISettings` from the import (which is unchanged in V4).

---

### `src/app/features/settings/settings-shell.component.ts` (NEW — component, route shell)

**Analog (sidebar + main layout):** `src/app/features/chat/chat-page.component.ts`
**Analog (RouterLink + RouterLinkActive):** `src/app/shared/nav.component.ts`

**RouterLink + RouterLinkActive pattern** (`nav.component.ts:1-35`):
```typescript
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="main-nav">
      <ul class="nav-links">
        <li>
          <a routerLink="/cardio" routerLinkActive="active">Cardio</a>
        </li>
        <!-- ... -->
        <li>
          <a routerLink="/settings" routerLinkActive="active">Settings</a>
        </li>
      </ul>
    </nav>
  `
})
```
Apply for the side-rail nav inside `settings-shell`: replace `<ul class="nav-links">` → `<aside role="complementary"><ul>` with three `routerLink="/settings/{ai|profile|memory}"` items + `routerLinkActive="active"` per UI-SPEC.md "Component Inventory" + "Accessibility Contract".

**Sidebar + main layout pattern** (`chat-page.component.ts:88-111`):
```typescript
.chat-layout {
  display: flex;
  height: calc(100vh - 120px);
}

.sidebar {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid #e0e0e0;
  background: #fafafa;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
```
Apply for `<aside>` + `<main>` with `<router-outlet>` in `<main>` per UI-SPEC.md §"Layout & Routing". Aside width 200px; gap 2rem. UI-SPEC.md mobile rule (`@media (max-width: 768px)` → horizontal tab strip) is locked.

**Standalone-component decorator pattern (every Phase 3 new component)** (`settings-page.component.ts:10-13`):
```typescript
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ErrorStateComponent],
  // ...
})
```
Apply with `RouterOutlet` import for shell, with `ReactiveFormsModule + ErrorStateComponent + EmptyStateComponent` for the form sub-pages.

---

### `src/app/features/settings/settings-profile.component.ts` (NEW — component, form page)

**Analog:** `src/app/features/settings/settings-page.component.ts` (current AI settings form — closest exact match for a Reactive-Forms settings page with status messages)

**Form construction pattern** (`settings-page.component.ts:218-242`):
```typescript
export class SettingsPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  settingsForm!: FormGroup;
  saving = false;
  statusMessage = '';
  statusIsError = false;
  loadError: Error | null = null;

  constructor(
    private fb: FormBuilder,
    private aiSettingsService: AISettingsService,
    private storageService: StorageService
  ) {}

  ngOnInit(): void {
    this.settingsForm = this.fb.group({
      apiKey: ['', [Validators.pattern(/^(sk-ant-.*)?$/)]],
      selectedModel: [''],
      maxResponseTokens: [4096, [Validators.required, Validators.min(1), Validators.max(32768)]]
    });

    this.reloadData();
  }
```
Apply: 4 textareas (`goals`, `preferences`, `dietaryConstraints`, `trainingHistory`) each with `Validators.maxLength(4096)` per CONTEXT.md D-05. Inject `UserProfileService` instead of `AISettingsService`. Goals textarea is the focal point (UI-SPEC.md "Focal Point Declaration") — `@ViewChild('goalsField')` + `setTimeout(() => el.focus(), 0)` in `ngAfterViewInit`.

**Reload + subscribe pattern (with takeUntilDestroyed)** (`settings-page.component.ts:244-269`):
```typescript
reloadData(): void {
  this.loadError = null;
  this.storageService.initialize()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: () => {
        this.aiSettingsService.getSettings()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (settings) => {
              this.settingsForm.patchValue({ /* ... */ });
            },
            error: (err) => {
              this.loadError = err instanceof Error ? err : new Error(String(err));
            }
          });
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err : new Error(String(err));
      }
    });
}
```
Apply identically (swap `aiSettingsService.getSettings` for `userProfileService.getProfile`). Pattern 2 Form A subscription cleanup (RESEARCH.md Project Constraint #6) is locked — `private destroyRef = inject(DestroyRef)` field initializer + every `.subscribe` piped through `takeUntilDestroyed(this.destroyRef)`.

**Save + status-message pattern** (`settings-page.component.ts:271-298`):
```typescript
onSave(): void {
  if (this.settingsForm.invalid || this.saving) return;

  this.saving = true;
  this.statusMessage = '';

  this.aiSettingsService.saveSettings(settings)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: () => {
        this.statusMessage = 'Settings saved successfully.';
        this.statusIsError = false;
        this.saving = false;
      },
      error: (err) => {
        this.statusMessage = err.message || 'Failed to save settings.';
        this.statusIsError = true;
        this.saving = false;
      }
    });
}
```
Apply for `onSave()` calling `userProfileService.saveProfile(profile)` — exact same shape. Copy strings from UI-SPEC.md "Copywriting Contract" → `/settings/profile`: Save success = "Profile saved." / Save failure = "Couldn't save profile. {reason}".

**Error-state composition pattern** (`settings-page.component.ts:18-24`):
```html
@if (loadError) {
  <app-error-state
    title="Couldn't load settings"
    [error]="loadError"
    (retry)="reloadData()"
  ></app-error-state>
}
```
Apply identically with title from UI-SPEC.md.

---

### `src/app/features/settings/settings-ai.component.ts` (RENAME of `settings-page.component.ts` — component, form page)

**Analog:** `src/app/features/settings/settings-page.component.ts` (renamed in place, then extended)

**Existing AI settings surface to preserve verbatim** (`settings-page.component.ts:26-86`): the entire `<form [formGroup]="settingsForm">` block (API key, model select, max-tokens, save/clear actions, status-message) — UI-SPEC.md "/settings/ai" rule: existing copy preserved verbatim.

**Extension per CONTEXT.md D-09** — new `<section class="settings-section">` after the existing one with:
- h2 "What the AI sees" + helper paragraph (verbatim from UI-SPEC.md "/settings/ai" copywriting table)
- 3 native `<input type="checkbox">` paired with `<label>` (UI-SPEC.md a11y rule: NOT custom switches)
- Helper text under each toggle (UI-SPEC.md table)
- All defaults OFF (CONTEXT.md D-09)

**Extension per CONTEXT.md D-12** — dev-only "Developer tools" container at the bottom:
```typescript
isLocalhost = typeof location !== 'undefined' && location.hostname === 'localhost';
```
Render the seed-button section conditionally on `@if (isLocalhost)` per UI-SPEC.md. Container: `border-left: 3px solid #e74c3c` (warning red, NOT accent — UI-SPEC.md explicit).

---

### `src/app/features/settings/settings-memory.component.ts` (NEW — component, inspector)

**Analog (list + delete over a domain collection):** `src/app/features/cardio/cardio-page.component.ts`

**Standalone-component imports pattern** (`cardio-page.component.ts:12-15`):
```typescript
@Component({
  selector: 'app-cardio-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent],
  // ...
})
```
Apply: `imports: [CommonModule, FormsModule, EmptyStateComponent, ErrorStateComponent]`. ReactiveFormsModule swapped for FormsModule (edit-textarea uses ngModel — simpler than reactive form for this single-field inline edit). EmptyStateComponent for "No memory files yet" (UI-SPEC.md copy locked).

**Native window.confirm pattern** (CLAUDE.md + UI-SPEC.md "Destructive actions") — pull from in-tree precedent in `cardio-page.component.ts` (deletion handler) — same in-place idiom:
```typescript
onDelete(path: string): void {
  if (!window.confirm(`Delete memory file "${path}"? This can't be undone.`)) return;
  this.memoryStore.deleteFile(path)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({ /* ... */ });
}
```
UI-SPEC.md locked confirmation copy: `Delete memory file "{path}"? This can't be undone.`.

**Path-tree inline template** (no analog yet — first instance) per UI-SPEC.md "Path-tree visual treatment":
- One `<ul>` per directory level; nested `<li>` for sub-paths
- Each level indented `1rem` from its parent
- Leaf nodes: `<button type="button">` to toggle inline preview
- Directory nodes: plain `<span>` label
- `aria-expanded`, `aria-controls` per UI-SPEC.md a11y rules

---

### `src/app/features/chat/pending-pill.component.ts` (NEW — component, presentation)

**Analog (Output emitters + standalone-component decorators):** `src/app/features/chat/chat-conversation-list.component.ts`
**Analog (status-driven rendering):** `src/app/features/chat/chat-message-list.component.ts` (pattern below)

**@Input/@Output pattern** (presumed from `chat-conversation-list.component.ts:1-30` — file uses `@Input() conversations`, `@Output() select`, `@Output() delete`, `@Output() newChat`). Apply:
```typescript
@Input({ required: true }) block!: ToolUseBlock;
@Output() approve = new EventEmitter<void>();
@Output() discard = new EventEmitter<void>();
@Output() edit = new EventEmitter<string>();   // emits new text
```

**@switch pattern for status-driven rendering** (model from `chat-message-list.component.ts:11-22`):
```html
@for (msg of messages; track msg.id) {
  <div class="message" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
    <div class="message-role">{{ msg.role === 'user' ? 'You' : 'AI Assistant' }}</div>
    <div class="message-content">{{ msg.content }}</div>
    <div class="message-time">{{ msg.createdAt | date:'shortTime' }}</div>
  </div>
}
```
Apply for `pending-pill`: `@switch (block.status)` with cases `'pending'` (action buttons), `'approved'` (`✓ Saved {time}` badge), `'discarded'` (`✗ Discarded {time}`), `'edited'` (`✎ Edited and saved {time}`). Inner `@switch (block.name)` for the two pill kinds (`memory` vs. `update_profile`) — UI-SPEC.md copy locked.

**Focal-point pattern** (UI-SPEC.md "Focal Point Declaration"): `ViewChild('primaryAction')` + `setTimeout(() => el.focus(), 0)` after status enters `'pending'` — model is the existing scroll pattern in `chat-message-list.component.ts:118-127`:
```typescript
ngOnChanges(): void {
  setTimeout(() => this.scrollToBottom(), 0);
}
```

---

### `src/app/features/chat/chat-message-list.component.ts` (MODIFY — component)

**Existing render loop to mutate** (`chat-message-list.component.ts:11-22`):
```html
@for (msg of messages; track msg.id) {
  <div class="message" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
    <div class="message-role">{{ msg.role === 'user' ? 'You' : 'AI Assistant' }}</div>
    <div class="message-content">{{ msg.content }}</div>
    <div class="message-time">{{ msg.createdAt | date:'shortTime' }}</div>
  </div>
}
```
Per CONTEXT.md D-15: replace `{{ msg.content }}` with a nested `@for (block of msg.blocks; track $index) { @switch (block.type) { @case ('text') { ... } @case ('tool_use') { <app-pending-pill [block]="block" ... /> } @case ('tool_result') { <static-rendering-tbd-phase-4 /> } } }`. Scroll-on-changes (lines 118-127) preserved unchanged.

---

### `src/app/services/chat.service.ts` (MODIFY — service, orchestrator)

**buildApiMessages adaptation** (`chat.service.ts:178-212`):
```typescript
private buildApiMessages(conversation: ChatConversation): AnthropicMessage[] {
  const messages: AnthropicMessage[] = [];

  if (conversation.summary) {
    messages.push({ role: 'user', content: `[Previous conversation summary: ${conversation.summary}]` });
    messages.push({ role: 'assistant', content: 'I understand the context from our previous conversation. How can I help you?' });
  }

  // Apply sliding window: keep recent messages within token budget
  const allMessages = conversation.messages;
  let windowMessages: ChatMessage[] = [];
  let tokenCount = 0;

  for (let i = allMessages.length - 1; i >= 0; i--) {
    const msg = allMessages[i];
    if (windowMessages.length >= MESSAGE_WINDOW_SIZE || tokenCount + msg.tokenEstimate > TOKEN_WINDOW_SIZE) {
      break;
    }
    windowMessages.unshift(msg);
    tokenCount += msg.tokenEstimate;
  }

  for (const msg of windowMessages) {
    messages.push({ role: msg.role, content: msg.content });   // ← `msg.content` no longer exists post-D-15
  }

  return messages;
}
```
Adaptation: `messages.push({ role: msg.role, content: toAnthropicContent(msg.blocks) });` — sliding-window math, MESSAGE_WINDOW_SIZE=20, TOKEN_WINDOW_SIZE=8000 unchanged. Strict-TS compile error guarantees every `msg.content` access is found and updated.

**Response-parse adaptation** (`chat.service.ts:132-144`):
```typescript
switchMap(response => {
  const assistantText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  const assistantMessage: ChatMessage = {
    id: generateId(),
    role: 'assistant',
    content: assistantText,                                    // ← REPLACE with blocks: fromAnthropicMessage(response)
    tokenEstimate: estimateTokens(assistantText),
    createdAt: new Date().toISOString()
  };
  // ...
})
```
Adaptation: `blocks: fromAnthropicMessage(response)` from `chat-block-serializer.ts`. `tokenEstimate` becomes `estimateTokens(blocks.filter(b => b.type === 'text').map(b => b.text).join(''))` — preserve drift item from CONCERNS.md (replacement to `messages.countTokens` is deferred per RESEARCH.md "Common Pitfalls" #5).

**maybeSummarize text-extraction adaptation** (`chat.service.ts:239-241`):
```typescript
const conversationText = messagesToSummarize
  .map(m => `${m.role}: ${m.content}`)
  .join('\n');
```
Adaptation: `m.blocks.filter(b => b.type === 'text').map(b => (b as TextBlock).text).join('\n')`. Same shape; just one extra reduce per message.

---

### `src/app/app.routes.ts` (MODIFY — config)

**Existing pattern** (`app.routes.ts:33-36`):
```typescript
{
  path: 'settings',
  loadComponent: () => import('./features/settings/settings-page.component').then(m => m.SettingsPageComponent)
}
```
Replace with parent-shell + 3 children + redirect (CONTEXT.md D-06, D-07; UI-SPEC.md §"Layout & Routing"):
```typescript
{
  path: 'settings',
  loadComponent: () => import('./features/settings/settings-shell.component').then(m => m.SettingsShellComponent),
  children: [
    { path: '', redirectTo: 'ai', pathMatch: 'full' },
    { path: 'ai',      loadComponent: () => import('./features/settings/settings-ai.component').then(m => m.SettingsAiComponent) },
    { path: 'profile', loadComponent: () => import('./features/settings/settings-profile.component').then(m => m.SettingsProfileComponent) },
    { path: 'memory',  loadComponent: () => import('./features/settings/settings-memory.component').then(m => m.SettingsMemoryComponent) },
  ],
}
```
Existing `loadComponent` pattern unchanged (lines 5-37). Hash routing (`withHashLocation()`) in `app.config.ts` already handles `#/settings/profile` etc.

---

### `src/app/shared/nav.component.ts` (MODIFY — component)

**No structural change.** Existing `<a routerLink="/settings" routerLinkActive="active">Settings</a>` (line 32) continues to work — clicking it lands on `/settings`, which redirects to `/settings/ai` per UI-SPEC.md D-07. The side-rail nav for the 3 sub-pages lives in `settings-shell.component.ts`, not here (UI-SPEC.md "Code Insights" + "Layout & Routing").

---

### Test fixtures (NEW)

**Analog:** `src/app/services/migrations/fixtures/v3.json` (input) + `v4-expected.json` (expected) + `malformed/wrong-types.json` (matrix)

**v4.json input fixture pattern** (`fixtures/v3.json:1-19`):
```json
{
  "schemaVersion": 3,
  "cardioSessions": [],
  "weightEntries": [],
  "healthReadings": [
    {
      "id": "reading-1",
      "type": "blood_pressure",
      "date": "2025-04-01T08:00:00Z",
      "systolic": 120,
      "diastolic": 80,
      "createdAt": "2025-04-01T08:00:00Z",
      "updatedAt": "2025-04-01T08:00:00Z"
    }
  ],
  "savedFoods": [],
  "mealEntries": [],
  "lastModified": "2025-04-01T08:00:00Z"
}
```
Apply for new `migrations/fixtures/v4.json`: `schemaVersion: 4` + at minimum one `chatConversations[0].messages[0]` with `content: "Hello"` (V4 string shape) so the V4→V5 lift can be regression-asserted.

**v5-expected.json pattern** (`fixtures/v4-expected.json:1-20`):
```json
{
  "schemaVersion": 4,
  "cardioSessions": [],
  ...
  "chatConversations": [],
  "lastModified": "2025-04-01T08:00:00Z"
}
```
Apply for new `migrations/fixtures/v5-expected.json`: `schemaVersion: 5` + assert `chatConversations[0].messages[0].blocks: [{ "type": "text", "text": "Hello" }]` and **no `content` field** + new V5 fields with defaults (`memoryFiles: {}`, `userProfile: { goals: '', preferences: '', dietaryConstraints: '', trainingHistory: '', updatedAt: '' }`, `aiToolSettings: DEFAULT_AI_TOOL_SETTINGS`).

**Malformed-input matrix pattern** (`fixtures/malformed/wrong-types.json:1-9`):
```json
{
  "schemaVersion": 2,
  "cardioSessions": [],
  "weightEntries": [],
  "healthReadings": [],
  "savedFoods": "not-an-array",
  "mealEntries": [],
  "lastModified": "2025-05-01T08:00:00Z"
}
```
Apply for V4-malformed matrix per CONTEXT.md "Specific Ideas" + AI-SPEC.md critical-failure-mode #1 — at minimum:
1. `chatConversations[].messages[].content: null` (force the defensive `?? ''` guard)
2. `chatConversations[].messages[].content` missing entirely
3. `chatConversations[].messages[].content` containing control chars (` `, ``)
4. `chatConversations[].messages[]` containing a closing-tag `</user_profile_goals>`-shaped string in content (CHAT-11 boundary regression)

**Migration spec pattern** (`storage.service.migration-fixtures.spec.ts:165-196`):
```typescript
for (const [name, payload] of malformed) {
  it(`tolerates ${name} without silent corruption`, async () => {
    localStorageMock[STORAGE_KEY] = JSON.stringify(payload);

    let didThrow = false;
    let thrown: unknown;
    try {
      await firstValueFrom(service.initialize());
    } catch (e) {
      didThrow = true;
      thrown = e;
    }

    if (didThrow) {
      expect(thrown instanceof StorageError).toBe(true);
      expect((thrown as StorageError).code).toBe('MIGRATION_FAILED');
      const backups = Object.keys(localStorageMock).filter(
        k => k.startsWith(BACKUP_PREFIX)
      );
      expect(backups.length).toBeGreaterThan(0);
    } else {
      const data = await firstValueFrom(service.getData());
      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    }
  });
}
```
Apply verbatim — extend the existing `malformed` array with the 4 V4-malformed fixtures; assertions unchanged.

## Shared Patterns

### Subscription cleanup (Pattern 2 Form A)

**Source:** `src/app/features/settings/settings-page.component.ts:218-247`, `src/app/features/chat/chat-page.component.ts:186-214`
**Apply to:** EVERY new component (`settings-shell`, `settings-profile`, `settings-ai`, `settings-memory`, `pending-pill`)

```typescript
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export class SettingsPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);   // FIELD INITIALIZER — never inside a method (NG0203)

  ngOnInit(): void {
    this.someService.someObservable()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ /* ... */ });
  }
}
```
Locked tree-wide per RESEARCH.md Project Constraint #6.

### Standalone-component declaration

**Source:** `src/app/features/settings/settings-page.component.ts:10-13`
**Apply to:** EVERY new component

```typescript
@Component({
  selector: 'app-settings-page',
  standalone: true,                          // REQUIRED — no NgModules per CLAUDE.md
  imports: [CommonModule, ReactiveFormsModule, ErrorStateComponent],
  // ...
})
```

### Storage chokepoint discipline

**Source:** `src/app/services/cardio.service.ts:30, 80-94`
**Apply to:** EVERY new domain service (`UserProfileService`, `MemoryStoreService`)

```typescript
constructor(private storageService: StorageService) {}

// All reads / writes flow through getData() / saveData() — never direct localStorage access.
return this.storageService.getData().pipe(
  switchMap(data => {
    if (!data) return throwError(() => new Error('Storage not initialized'));
    return this.storageService.saveData({ ...data, /* mutated field */ });
  })
);
```
Locked tree-wide per RESEARCH.md Project Constraint #3 (chokepoint grep gate live).

### ID generation

**Source:** `src/app/shared/id.ts:18-27`
**Apply to:** Any new ID needed (tool_use IDs, conversation IDs, message IDs)

```typescript
import { generateId } from '../shared/id';

const newId = generateId();    // crypto.randomUUID with Math.random fallback
```
Never inline `Math.random()`. Never re-implement UUID generation. Locked per RESEARCH.md Project Constraint #7.

### Empty/error state composition

**Source:** `src/app/shared/empty-state.component.ts:23-37` + `src/app/shared/error-state.component.ts:38-62`
**Apply to:** Every new settings sub-page + memory inspector empty state

```html
@if (loadError) {
  <app-error-state
    title="Couldn't load {surface}"
    [error]="loadError"
    (retry)="reloadData()"
  ></app-error-state>
}

<app-empty-state title="No memory files yet" message="When the AI saves something to remember, it will show up here.">
  <!-- optional CTA -->
</app-empty-state>
```
UI-SPEC.md copy strings locked.

### A11y axe-core inline assertion

**Source:** `src/app/shared/a11y-test-helpers.ts:48-69`
**Apply to:** EVERY new component spec

```typescript
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

it('has no serious a11y violations on initial render', async () => {
  const fixture = TestBed.createComponent(MyComponent);
  fixture.detectChanges();
  await expectNoSeriousA11yViolations(fixture.nativeElement, {
    disableRules: ['color-contrast'],   // Phase 5 QUAL-08 deferral, locked
  });
});
```
Severity gate: `serious | critical` only (Phase 1 D-08).

### Custom-error-class for typed failures

**Source:** `src/app/services/cardio.service.ts:11-20` + `src/app/services/anthropic-api.service.ts:36-45` + `src/app/services/storage.service.ts:40-54`
**Apply to:** `MemoryPathError` (new), retained `AnthropicApiError` (rewritten with optional `requestId`)

```typescript
export class CardioValidationError extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    const message = errors.map(e => `${e.field}: ${e.message}`).join('; ');
    super(message);
    this.name = 'CardioValidationError';
    this.errors = errors;
  }
}
```
Applies tree-wide. Catch shape: `err instanceof XError` + structured field access (callers in components rely on this — don't break it for `AnthropicApiError`).

### Service spec scaffold

**Source:** `src/app/services/cardio.service.spec.ts:1-48`
**Apply to:** EVERY new service spec (`UserProfileService`, `MemoryStoreService`, `MemoryToolExecutor`, `ToolRegistryService`, `chat-block-serializer.spec.ts`)

```typescript
beforeEach(() => {
  mockAppData = createEmptyAppData();
  storageServiceSpy = jasmine.createSpyObj('StorageService', ['initialize', 'getData', 'saveData']);
  storageServiceSpy.initialize.and.returnValue(of(undefined));
  storageServiceSpy.getData.and.returnValue(of(mockAppData));
  storageServiceSpy.saveData.and.returnValue(of(undefined));

  TestBed.configureTestingModule({
    providers: [
      ServiceUnderTest,
      { provide: StorageService, useValue: storageServiceSpy }
    ]
  });
  service = TestBed.inject(ServiceUnderTest);
});
```
`chat-block-serializer.spec.ts` skips this (pure module — no TestBed needed; just import the function and assert).

## No Analog Found

Files with no close in-tree match (planner should reference RESEARCH.md / AI-SPEC.md sample code instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/services/chat-block-serializer.ts` | pure-module (bridge) | transform | No existing "wire format ↔ persistence" bridge module in tree. `validators.ts` is the closest pure-module shape but does not bridge to a third-party SDK. Use AI-SPEC.md §3 "Common Pitfalls" #2 + #3 + #4 + RESEARCH.md §"Pattern 3" excerpt as the canonical sample. Test-only assertions: (1) strips `status`/`editedFromText`, (2) drops `discarded` blocks, (3) replaces `pending` tool_use with text placeholder, (4) `tools` field always undefined on every `MessageCreateParams` produced. |
| Path-tree inline template inside `settings-memory.component.ts` | UI sub-template | n/a | First instance of a tree view in the codebase. UI-SPEC.md §"Path-tree visual treatment" is the locked spec (`<ul>`/`<li>` indented `1rem` per level; leaf = `<button type="button">`; `aria-expanded` + `aria-controls`). Per CONTEXT.md "Deferred Ideas", do NOT extract a `<app-path-tree>` component — inline the template; revisit if Phase 5 needs it elsewhere. |

## Metadata

**Analog search scope:**
- `src/app/services/**/*.ts` (all 14 service files + 7 spec files)
- `src/app/features/{cardio,chat,settings,weight}/**/*.ts` (closest analogs to new feature pages)
- `src/app/models/**/*.ts` (all 6 model files)
- `src/app/shared/**/*.ts` (all 12 shared files — empty/error/recovery components, id, a11y helper)
- `src/app/services/migrations/fixtures/**/*.json` (existing migration fixtures)

**Files scanned:** 47 in-tree TypeScript/JSON files

**Pattern extraction date:** 2026-05-03

**Cross-document anchors:**
- CONTEXT.md decisions D-01..D-17 → mapped to specific pattern excerpts above (D-15 → ChatMessage cut-over; D-17 → SDK transport rewrite; D-06/D-07 → routes restructure; D-09 → AIToolSettings + redaction; D-10..D-13 → pending-pill scaffold)
- AI-SPEC.md §3 "Entry Point Pattern" → canonical SDK rewrite for `anthropic-api.service.ts` (excerpt deliberately not duplicated here — planner cites AI-SPEC.md)
- UI-SPEC.md "Copywriting Contract" → all locked copy for new UI surfaces (planner cites verbatim)
- RESEARCH.md §"Pattern 1" → V4→V5 migration code (excerpt deliberately not duplicated here — planner cites RESEARCH.md)
- FOUND-07 typed-legacy harness → `legacy-schemas.ts` + `storage.service.migration-fixtures.spec.ts` are the existing-code anchors
