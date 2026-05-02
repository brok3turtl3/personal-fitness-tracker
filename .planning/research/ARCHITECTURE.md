# Architecture Research

**Domain:** Brownfield Angular 18 personal fitness tracker — additive integration of (1) deep AI chat with full-data access + persistent memory + research grounding, (2) diet UX overhaul with multi-unit support, (3) quality-pass infrastructure.
**Researched:** 2026-05-02
**Confidence:** HIGH for AI integration shape (verified against official Anthropic docs); HIGH for diet-unit shape (extends documented `SavedFood` model); HIGH for the existing layered constraints (read directly from source).

This document does **not** redesign the existing architecture. It defines how new pieces slot into the locked layered shape:

```
UI (standalone components) → Domain services → StorageService → LocalStorage
                                            ↘ AnthropicApiService → api.anthropic.com
```

Every recommendation respects the locked constraints from `PROJECT.md`: LocalStorage-only, single-user, Electron-compatible (hash routing, no Node integration), Angular 18 standalone, RxJS Observables, single `StorageService` boundary.

---

## 1. AI Chat Depth — Memory + Full-Data Access + Grounding

The current chat is a single-turn snapshot: `ChatService.sendMessage()` builds the full system prompt from `FitnessContextService.buildFitnessDataSnapshot()` and POSTs once. To deliver "AI knows everything + remembers across sessions + grounds claims," three new capabilities are needed: **tool use loop**, **persistent memory**, and **web grounding**. They are not three separate features — they are one architecture.

### 1.1 Component Overview (new pieces shown in `[brackets]`)

```
┌──────────────────────────────────────────────────────────────────────┐
│  UI: ChatPageComponent (existing) + new attribution rendering         │
│       chat-message-list reads new ChatMessage.contentBlocks[]         │
│       (text + tool_use + tool_result + citations)                     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ sendMessage(...)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ChatService (existing, refactored to drive an agentic loop)          │
│   - drives while(stop_reason === "tool_use") loop                     │
│   - dispatches client tools via [ToolRegistry]                        │
│   - stops on end_turn / max_tokens / refusal                          │
│   - persists every assistant turn (text + tool_use + tool_result)     │
└──────┬─────────────────┬──────────────────────────┬──────────────────┘
       │                 │                          │
       ▼                 ▼                          ▼
┌──────────────┐  ┌────────────────────┐  ┌──────────────────────────┐
│ [ToolRegistry│  │ FitnessContext     │  │ AnthropicApiService      │
│  Service]    │  │ Service (slimmed)  │  │ (extended request shape) │
│              │  │ - buildSystemPrompt│  │ - tools[] in body        │
│ dispatches   │  │ now returns ONLY a │  │ - parses tool_use blocks │
│ tool_use     │  │ thin "key facts"   │  │ - server tools (memory   │
│ blocks to    │  │ snapshot, not the  │  │   client-side, web_search│
│ correct      │  │ whole dataset      │  │   server-side)           │
│ executor     │  │                    │  │                          │
└──┬──┬──┬──┬──┘  └────────────────────┘  └──────────────────────────┘
   │  │  │  │
   │  │  │  └──► [WebSearchTool] ─── server-side; no executor; pass through
   │  │  │
   │  │  └─────► [MemoryToolExecutor] ─► [MemoryStoreService]
   │  │                                    └─► StorageService (memoryFiles map)
   │  │
   │  └────────► [DataQueryToolExecutor] ─► CardioService / WeightService
   │                                         ReadingsService / DietService
   └───────────► [ProfileToolExecutor] ────► [UserProfileService]
                                              └─► StorageService (userProfile)
```

### 1.2 Component Responsibilities

| Component | Responsibility | Why this boundary |
|-----------|----------------|-------------------|
| `ChatService` (refactored) | Drives the agentic loop. Sends request → if `stop_reason === "tool_use"`, dispatches each `tool_use` block to `ToolRegistryService`, appends `tool_result` blocks, sends again. Persists each turn. | Keeps the loop in one place, mirrors the canonical Anthropic agentic loop. |
| **`ToolRegistryService` (new)** | Map of `tool name → executor`. `dispatch(toolUseBlock): Observable<toolResultBlock>`. Knows which tools are server-side (pass through) vs client-side (execute). | Single dispatch point. Adding a new tool = register one executor. Mirrors `validators.ts` cataloging style. |
| **`MemoryToolExecutor` (new)** | Implements the 6 memory tool commands (`view`, `create`, `str_replace`, `insert`, `delete`, `rename`) per Anthropic spec. Validates paths start with `/memories`. Returns the canonical strings the docs prescribe. | Spec compliance is mechanical; isolating it makes it testable as a pure function over `MemoryStoreService`. |
| **`MemoryStoreService` (new)** | Thin domain service over `AppData.memoryFiles: Record<string, string>`. CRUD for path → content. Same shape as other domain services. | Treats memory as "just another collection." Honors single-`StorageService` rule. |
| **`DataQueryToolExecutor` (new)** | Implements custom client tools that let Claude pull *real* data on demand: `query_cardio`, `query_weight`, `query_readings`, `query_meals`, `query_saved_foods`, `query_summary` (date-ranged aggregates). | Lets the model fetch precisely what it needs (e.g., "all weight entries since Jan 1") without dumping the entire dataset into the system prompt. |
| **`UserProfileService` (new)** | Manages `AppData.userProfile`: goals, preferences, demographics, dietary constraints. Used by both the system prompt and the `update_profile` tool. | Goals/preferences are first-class persisted state, separate from chat memory (which is conversational scratch). Different shapes, different lifecycles. |
| `FitnessContextService` (slimmed) | Builds a *short* system-prompt header — persona + goals + ultra-thin "current state" summary (latest weight, last 3 days of activity). No more full-dataset dump. | Push bulk data fetching to tool calls. Keep system prompt < ~500 tokens so it caches well. |
| `AnthropicApiService` (extended) | Add `tools?: AnthropicTool[]` to `AnthropicRequest`. Add `ToolUseBlock` and `ToolResultBlock` to the content union. Handle `pause_turn` stop reason for server-tool continuation. | Same fetch wrapper, just richer types. No new HTTP path. |

### 1.3 Data Flow — A Full Turn With Memory + Data Query + Web Search

User: *"How's my weight trending vs my goal, and what's the latest evidence on creatine for women over 40?"*

```
1. ChatPageComponent.sendMessage("...")
       ↓
2. ChatService.sendMessage(convId, text)
       │  - Persist user message to AppData.chatConversations[].messages
       │  - Build agentic loop input:
       │      system  = thin persona + goals (from UserProfileService)
       │                + "you may call: query_*, update_profile, memory tool, web_search"
       │      messages = sliding window of prior turns (existing logic)
       │      tools   = [ memory_20260818, web_search_20260209,
       │                  query_weight, query_cardio, ..., update_profile ]
       ↓
3. Anthropic returns content = [
       text   "I'll check your weight history and recent research."
       tool_use   memory.view /memories                     (client tool)
   ], stop_reason = "tool_use"
       ↓
4. ChatService dispatches via ToolRegistryService:
       memory.view  →  MemoryToolExecutor  →  MemoryStoreService.list("/memories")
       Returns tool_result with directory listing of "user_goals.md", "preferences.md", ...
       ↓
5. Persist this assistant turn (with all blocks) + tool_result to conversation.
   Loop: send messages so far back to Anthropic.
       ↓
6. Anthropic returns [
       memory.view /memories/user_goals.md
       memory.view /memories/preferences.md
   ] tool_use, stop_reason = "tool_use"
       ↓
7. Dispatch both, append tool_result. Loop.
       ↓
8. Anthropic returns [
       text "Goal: 175 lbs by Sep. Let me pull your weight data."
       tool_use   query_weight  { from: "2026-01-01", to: "2026-05-02" }
       tool_use   query_summary { kind: "weight_30d_change" }
   ] tool_use
       ↓
9. Dispatch:
       query_weight     → DataQueryToolExecutor → WeightService.getEntries() + filter
       query_summary    → DataQueryToolExecutor → computed aggregate
   Append tool_results. Loop.
       ↓
10. Anthropic returns [
       text "On track — down 6 lbs since Jan. Now searching the literature."
       tool_use   web_search { query: "creatine supplementation women 40+ resistance training" }
   ] tool_use, stop_reason = "tool_use"
       ↓
11. web_search is a SERVER tool → no client executor.
       AnthropicApiService passes the request through; the API runs the search,
       returns server_tool_use + web_search_tool_result blocks inline.
       ChatService just persists them and continues the loop until end_turn.
       (Server tools may emit pause_turn which the loop must also handle.)
       ↓
12. Anthropic returns final assistant text with citations[] referencing
    the web_search_result_locations, stop_reason = "end_turn".
       ↓
13. Persist final assistant turn. Render in chat-message-list.
```

**Key invariant:** `ChatService` does not know what each tool does — it only knows how to dispatch. Every tool's behavior is local to its executor. This is critical for testability.

### 1.4 Where Each Capability Lives — Explicit Decisions

#### "Full data access without blowing context" → **client tools, not RAG, not bigger snapshots**

- **Why not "bigger snapshot in system prompt":** doesn't scale (chat history alone hits ~2,500 messages on a 5MB store; full meal history can be megabytes); wastes tokens on data the user didn't ask about; defeats prompt caching.
- **Why not classic RAG (embeddings + vector store):** embeddings need a vendor lock-in or an in-browser model (~25MB+ download); the dataset is small and *structured* (rows in services); SQL-style filters beat semantic similarity for "weight last 30 days."
- **Why client tools:** the model writes precise queries; the response carries only what was asked for; pairs perfectly with the existing service layer (each service already exposes `getX(): Observable<X[]>`); zero new infra.
- **Hybrid optionality:** `FitnessContextService` keeps a *thin* always-on snapshot ("user is 220 lbs, has logged 12 workouts in last 7d") so the model knows what *exists* and can decide which tools to call.

#### "Persistent memory across sessions" → **Anthropic memory tool, backed by `AppData.memoryFiles`**

- **Why the official memory tool, not custom:** spec'd, model-aware (Claude is trained to use it), comes with the right system-prompt nudge ("ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE"), and SDKs offer reference helpers we can mirror. Same JSON schema across sessions = portable.
- **Storage shape:** add `AppData.memoryFiles: Record<string, string>` (path → content). Single-record map, no separate per-file collection. JSON-serializes naturally.
- **Path validation:** `MemoryToolExecutor` MUST reject any path not starting with `/memories` and reject `..` traversal patterns. Even though we have one user, defense in depth matters: a malicious model output could otherwise wedge into other AppData fields.
- **Scope:** memory is **global to the user**, not per-conversation. That's the whole point — "what did the user tell me three weeks ago in chat #5 that matters now in chat #18?"

#### "Goals + preferences" → **`UserProfile`, separate from memory**

- Memory is *the model's notebook* — free-form, model-curated, may be messy. It's where Claude jots "user mentioned right knee bothers them on inclines."
- Profile is *first-class user data* — structured, user-edited, shown in `/settings`. Goals weight target / pace, dietary preferences, units, demographics.
- Separating them lets the user audit/edit the profile directly while letting Claude maintain its own working memory autonomously. The `update_profile` tool is the explicit bridge for the model to suggest profile updates that the user can confirm.

#### "Source attribution + confidence labelling" → **structured contract + UI rendering, not post-processing**

This is the user's chosen *epistemic mechanism* (per `PROJECT.md`: "deliberately not added blanket disclaimers; source + confidence transparency is the chosen mechanism"). Therefore make it **first-class structured data**, not free text.

Two layers:

1. **Web-search citations are already structured** (verified). Each `web_search_result_location` carries `url`, `title`, `cited_text`, `encrypted_index`. Render these as inline footnotes in `chat-message-list`. *No prompt engineering needed for source attribution on web claims.*
2. **Confidence labelling for non-web claims** is a system-prompt *contract*: instruct the model that any clinical/scientific claim must end with one of `[evidence: strong]`, `[evidence: moderate]`, `[evidence: weak]`, `[evidence: animal-only]`, `[evidence: anecdotal]`, `[evidence: speculative]`. UI scans rendered text for those tags and turns them into colored badges. If the tag is missing, render no badge (the user notices the absence and asks).

Why not a tool for this? Because confidence is per-sentence/per-claim, not per-turn. A tool call would coarsen it. A token-level convention preserves granularity.

### 1.5 Schema Migration — V4 → V5

Current `AppData` (V4):
```
schemaVersion, cardioSessions, weightEntries, healthReadings, savedFoods,
mealEntries, aiSettings?, chatConversations, lastModified
```

V5 adds three top-level fields. **One migration, not three.**

```typescript
interface AppData {
  // ... existing V4 fields unchanged ...

  /** Anthropic memory tool backing store — path → content. Default: {}. */
  memoryFiles: Record<string, string>;

  /** User profile, goals, preferences, dietary constraints. Default: {}. */
  userProfile: UserProfile;

  /** AI feature toggles + tool budgets. Default sensible values. */
  aiToolSettings: AIToolSettings;
}

interface UserProfile {
  displayName?: string;
  birthYear?: number;
  heightInches?: number;
  goals?: {
    weightLbs?: number;
    targetDate?: string;
    notes?: string;
  };
  preferences?: {
    dietaryStyle?: 'standard' | 'low-carb' | 'keto' | 'mediterranean' | 'other';
    dietaryNotes?: string;
    preferredUnits?: 'imperial' | 'mixed';   // mixed = current default
  };
  injuries?: string[];                       // free text list, model-friendly
  updatedAt: string;
}

interface AIToolSettings {
  /** Enable client tool: data queries. Default true. */
  enableDataQueryTools: boolean;
  /** Enable client tool: memory. Default true. */
  enableMemoryTool: boolean;
  /** Enable server tool: web search. Default false (costs $$ per use). */
  enableWebSearch: boolean;
  /** Cap web searches per turn (passes through as max_uses). Default 3. */
  webSearchMaxUses: number;
  /** Maximum agentic loop iterations to prevent runaway. Default 10. */
  maxAgentTurns: number;
}
```

`migrateV4ToV5(data)`: spread existing fields, default the three new ones to `{}` / `{}` / `{ enableDataQueryTools: true, enableMemoryTool: true, enableWebSearch: false, webSearchMaxUses: 3, maxAgentTurns: 10 }`. Bump `CURRENT_SCHEMA_VERSION = 5`. Add a unit test mirroring `'should migrate v3 data to v4 by adding AI chat fields'` (per `CONVENTIONS.md` schema-migration protocol).

**Backward compatibility:** any V4 store loads fine because all three new fields are non-breaking additions. Old code reading V4 doesn't know about them; new code reads them with `data.memoryFiles ?? {}` defensively for a couple of releases.

### 1.6 Conversation Model Extensions

The current `ChatMessage` has `content: string`. With tool use, an assistant turn can be a sequence of `text | tool_use | tool_result` blocks; replaying conversation history requires preserving them. **This is the most invasive chat-data change**, so do it deliberately.

Two options:

**Option A — Extend `ChatMessage` with structured blocks** *(recommended)*
```typescript
type ChatBlock =
  | { type: 'text'; text: string; citations?: Citation[] }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  | { type: 'server_tool_use'; id: string; name: string; input: unknown }
  | { type: 'web_search_tool_result'; tool_use_id: string; content: WebSearchResult[] };

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: ChatBlock[];                  // NEW canonical field
  content?: string;                     // kept transitionally for V4 messages; never written by V5+ code
  tokenEstimate: number;
  createdAt: string;
}
```

`migrateV4ToV5` lifts each old `content: string` into `blocks: [{ type: 'text', text: content }]` and removes the legacy `content` field on rewrite. Existing renderers fall back to `blocks[0].text` if it's a single text block, so the migration is invisible to old UI code paths.

**Option B — Keep `content: string` and store rendered prose only**: simpler, but loses tool history, breaks multi-turn web-search citations (which require passing `encrypted_index` back), and breaks memory-tool replay (model needs to see its prior tool calls). **Not viable.**

Go with A.

### 1.7 Anti-Patterns Specific to This Integration

#### Anti-pattern: putting the agent loop in the page component
**What people do:** wire `while(tool_use) { dispatch; resend }` inside `chat-page.component.ts`.
**Why wrong:** loop logic + persistence + error recovery is business logic — `CONVENTIONS.md` is explicit: "Components handle UI rendering and user interaction only."
**Do instead:** loop lives in `ChatService.sendMessage()`, which returns an Observable that emits each `assistantMessage` as it lands so the UI can stream blocks.

#### Anti-pattern: dumping full `AppData` to the model on every turn
**What people do:** "since Claude has a 200k window, just send everything."
**Why wrong:** every kB of fitness data is paid for on every turn (input tokens scale linearly with history); chat history alone could exceed 100k after months; defeats prompt caching.
**Do instead:** thin always-on snapshot ≤ ~500 tokens; tools fetch the rest on demand. Pair with prompt caching on tool definitions (Anthropic supports this).

#### Anti-pattern: inventing a custom memory protocol
**What people do:** ship a custom `remember(text)` tool that just appends to a JSON array.
**Why wrong:** Claude is trained on the Anthropic memory tool spec; a custom shape gets worse adherence, no auto-injected protocol prompt, no SDK reuse path, no portability to other agents.
**Do instead:** use `memory_20250818` (or latest) as documented; back it with `AppData.memoryFiles`; obey the canonical return strings.

#### Anti-pattern: letting the model's free text *be* the source attribution
**What people do:** prompt "cite your sources" and hope.
**Why wrong:** unstructured citations can't be rendered as clickable links; web-search citations are *already* structured by the API — throwing that away is regressing.
**Do instead:** for web claims, use the API's `citations[]` directly. For non-web claims, enforce the `[evidence: <level>]` token convention and parse/badge it in the UI.

#### Anti-pattern: subscribing without `takeUntilDestroyed` in new agent code
Already a known concern (`CONCERNS.md`: "No subscription cleanup in feature components"). The agent loop produces *long-lived* observables (multiple round trips per send) — leaking these is much worse than today's `of(...)` pattern.
**Do instead:** in chat-page subscribe with `takeUntilDestroyed(this.destroyRef)` from day one. This also nudges the broader codebase fix.

---

## 2. Diet UX Overhaul — Multi-Unit Support

The current model (`SavedFood` with `baseUnit: 'g' | 'tbsp'`, `gramsPerTbsp?` density, and a `servings: SavedFoodServing[]` collection) already does a *lot* of the work — it just doesn't expose enough units and doesn't have a clean UX for converting between them. The architectural change is small; the work is mostly UX.

### 2.1 Where Unit Conversion Logic Lives

**Decision:** new pure module `src/app/services/units.ts` (companion to `validators.ts`), not a service.

**Why pure functions, not an `@Injectable` service:**
- Conversion is stateless: `(quantity, fromUnit, toUnit, density?) → grams | error`.
- `validators.ts` precedent: pure exports + a constants block (`VALIDATION_LIMITS`).
- Tree-shakable; trivially unit-testable; no DI ceremony.

**Public surface:**
```typescript
export type FoodUnit =
  | 'g' | 'oz' | 'lb'                                     // weight
  | 'ml' | 'tsp' | 'tbsp' | 'cup' | 'fl_oz'               // volume
  | 'serving';                                            // food-defined unit (uses SavedFoodServing.amount)

export const UNIT_KIND: Record<FoodUnit, 'weight' | 'volume' | 'serving'> = { /* ... */ };

/** Convert a quantity between any two units of the same kind (no density needed). */
export function convertSameKind(qty: number, from: FoodUnit, to: FoodUnit): number;

/** Convert volume↔weight using a per-food density. Throws if density is missing. */
export function convertWithDensity(qty: number, from: FoodUnit, to: FoodUnit, gramsPerMl: number): number;

/** High-level: turn (qty, unit) into a count of the food's baseUnit. */
export function toBaseUnits(qty: number, unit: FoodUnit, food: SavedFood): number;
```

`DietService` calls `toBaseUnits` when computing meal-item snapshots (replacing the current ad-hoc handling). `MealItem.snapshot.baseUnits` already exists in the model — it just gets richer inputs.

### 2.2 Saved-Food Model Changes (V5 → V6, separate from AI migration)

Two reasons to *not* combine with the AI migration: independent change, easier to review, easier to revert if a unit edge case is found in production.

```typescript
interface SavedFood {
  // ... existing fields ...

  /** What kind of food this is: governs which unit class is canonical. */
  baseUnit: FoodUnit;                     // widened from 'g' | 'tbsp' to full FoodUnit

  /** OPTIONAL: density in g/ml. Required for any food whose servings span weight↔volume. */
  densityGramsPerMl?: number;             // replaces gramsPerTbsp (which is a ~14.787 ml × density)

  /** Pre-built unit options to surface in the UI for this food. Drives the unit dropdown. */
  preferredUnits?: FoodUnit[];            // e.g. ['g', 'oz'] for chicken, ['cup', 'tbsp', 'g'] for flour

  /** Servings remain the user-defined named portions. */
  servings: SavedFoodServing[];           // unchanged shape; SavedFoodServing.unit broadens to FoodUnit
}
```

**Migration `migrateV5ToV6`:**
- Default `densityGramsPerMl` for any food with `gramsPerTbsp`: `data.gramsPerTbsp / 14.787`.
- Default `preferredUnits`: `[baseUnit]`.
- Keep `gramsPerTbsp` populated for one release (deprecation window), then remove in V7.

**Why a separate field, not a free-form `unitDefinitions` map:** density is the *only* per-food piece of info you need to bridge volume↔weight. Adding more flexibility upfront (e.g., per-food custom unit factors) violates YAGNI; if a food has a weird unit, the user can encode it as a `SavedFoodServing`.

### 2.3 Diet Component Boundaries (UX Overhaul)

The single 900-line `diet-page.component.ts` is itself a smell (per `CONCERNS.md`: ID generation leaked into it). Take this milestone to split it:

```
features/diet/
  diet-page.component.ts           # Container; route entry; orchestrates child components
  food-library/
    food-library.component.ts      # Saved-foods list + add/edit modal trigger
    food-form.component.ts         # Add/edit a SavedFood; uses unit picker
  meal-log/
    meal-log.component.ts          # Today's meals + daily totals
    meal-form.component.ts         # Add/edit a meal; food search + portion picker
  shared/
    unit-picker.component.ts       # Reusable: pick (qty, unit) for a given food
    nutrition-display.component.ts # Reusable: render NutritionTotals consistently
```

This mirrors how `chat/` is already split (`chat-page` orchestrates `chat-conversation-list`, `chat-message-list`, `chat-input`). Same precedent, same standalone pattern.

**`ID generation leaked into component`** (CONCERNS.md item) gets fixed in passing: all `id` fields are assigned by `DietService` in this rewrite.

---

## 3. Quality Pass — Test Layering + A11y Surface

### 3.1 Test Layering Decision Matrix

| Layer | Tool | Use For | Avoid For |
|-------|------|---------|-----------|
| Unit (existing) | Jasmine + Karma, no `TestBed` | `validators.ts`, `units.ts`, every `*Service.ts`, `MemoryToolExecutor`, `DataQueryToolExecutor`, `ToolRegistryService`, all migrations including V4→V5 and V5→V6 | UI assertions |
| Component (new layer) | `TestBed` + standalone harness | Form wiring (cardio/weight/readings/diet), unit picker behavior, error rendering, chat block rendering, memory file display in settings | Heavy DOM choreography (use e2e instead) |
| Integration (selective) | `TestBed` + service spies | Agent loop happy path (tool_use → tool_result → end_turn) with `AnthropicApiService` spied; chat persistence across loop iterations | Hitting the real API |
| E2E (already a dep, unused) | Puppeteer | Print/export, navigation, chart rebuilding, full diet add-food→log-meal→see-totals flow, full chat send → tool use → response | Broad coverage (slow + flaky) |

**Why this is idiomatic for Angular 18 standalone:** `TestBed.configureTestingModule({ imports: [TheStandaloneComponent] })` is the documented pattern (no NgModule wrapping needed). `standalone: true` removes the "declarations vs imports" historical confusion. RxJS services already use either `done` callbacks or `firstValueFrom` (per existing specs) — keep that.

The `puppeteer` dependency is already in `package.json` with no scripts (`CONCERNS.md`). The quality-pass milestone is the right time to wire it.

### 3.2 A11y Testing Surface

The codebase already does a lot right (semantic HTML, `<label for>`, `aria-required`, `aria-invalid` per `CONVENTIONS.md`). What's missing:

- **No automated audit.** Add `@axe-core/puppeteer` (or run `axe-core` inside Karma component tests). Wire one e2e check per route to fail CI on serious/critical violations only.
- **No a11y unit tests for new components.** For `unit-picker.component.ts`, `nutrition-display.component.ts`, and the new chat block renderers, add component-level specs that assert: every interactive element is keyboard-reachable, all form controls have accessible names, color is never the only state indicator (assert presence of text/icon alongside color classes).
- **Manual checklist** lives in `.planning/research/` or `docs/` (out of scope for ARCHITECTURE.md, but the test layers above support it).

**No new architectural component required** — a11y is a discipline applied to the existing component layer.

---

## 4. Build Order — Respecting Dependencies

The roadmap should sequence phases so each phase's deliverables stand on already-shipped foundations. Recommended order:

```
Phase A — Quality Pass Foundations             (unblocks everything else)
  ├─ test-coverage measurement run
  ├─ extract groupByDay/toDateKey to shared (CONCERNS.md fragile area)
  ├─ consolidate generateUUID() into services/id.ts (CONCERNS.md)
  ├─ add takeUntilDestroyed pattern to existing components
  ├─ axe-core wiring + first set of e2e tests
  └─ no schema changes

Phase B — Diet Multi-Unit + UX Split           (independent of AI work; pure data + UX)
  ├─ src/app/services/units.ts + spec
  ├─ Schema V5→V6: SavedFood.densityGramsPerMl, preferredUnits
  ├─ migrateV5ToV6 + spec
  ├─ DietService updates use units.ts
  ├─ split diet-page.component.ts into food-library/, meal-log/, shared/
  ├─ unit-picker, food-form, meal-form components + specs
  └─ E2E: add-food → log-meal → see-totals flow

  (Why before AI: makes diet data cleaner; AI tools that query meals get nicer data.)

Phase C — AI Memory Layer + Tool Use Plumbing  (foundation for chat depth)
  ├─ Schema V4→V5: memoryFiles, userProfile, aiToolSettings, ChatMessage.blocks
  ├─ migrateV4ToV5 + spec (with ChatMessage block lift test)
  ├─ MemoryStoreService + spec
  ├─ MemoryToolExecutor + spec (path validation, all 6 commands)
  ├─ ToolRegistryService + spec
  ├─ UserProfileService + spec
  ├─ AnthropicApiService extended (tools[] + ToolUseBlock + ToolResultBlock + pause_turn)
  ├─ /settings additions: AI tool toggles, profile editor, memory file viewer
  └─ At end of phase: tools[] is wired but ChatService still single-shot

Phase D — Agentic Loop in ChatService          (turns it on)
  ├─ ChatService refactor: while(tool_use) loop with maxAgentTurns guard
  ├─ DataQueryToolExecutor + spec (per-domain query tools)
  ├─ FitnessContextService slimmed down (thin snapshot only)
  ├─ ChatMessage.blocks rendering in chat-message-list
  ├─ Confidence-tag parsing + badge rendering
  └─ Integration test: full tool-use round trip with spied AnthropicApiService

Phase E — Web Search Grounding + Citations     (final layer)
  ├─ web_search_<version> in tools[] when aiToolSettings.enableWebSearch
  ├─ web_search_tool_result + citations rendering
  ├─ Settings UI: enable toggle + max_uses cap (cost-aware)
  └─ E2E: "ask about creatine" smoke test (requires API key in test env, optional)
```

### Why This Order

- **A before everything else:** quality scaffolding (test patterns, subscription hygiene, shared utilities) is reused by every later phase. Doing it first is cheaper than retrofitting tests.
- **B independent of C/D/E:** zero coupling. Diet improvements ship value immediately and don't block AI work.
- **C before D:** the agent loop in D *requires* the migration, the registry, the memory executor, the extended API types, and the profile service. Splitting them lets each be reviewed and tested in isolation.
- **D before E:** the agent loop must be solid (max-turn guard, error recovery, persistence) before adding server tools that emit `pause_turn` and longer-running flows. Web search is just one more tool *kind* once the loop works.
- **B and C can run in parallel** if you want — they touch disjoint files.

---

## 5. Source Attribution + Confidence Labelling — Where It Lives

Restating section 1.4's decision in one place because the downstream consumer asked specifically:

| Concern | Lives In | Why |
|---------|----------|-----|
| Web-source attribution | **API output → UI rendering**. `web_search_result_location` blocks are already structured. `chat-message-list` renders inline footnote markers and a "Sources" footer per assistant turn. | Don't re-invent what the API gives us. |
| Multi-turn citation continuity | **AnthropicApiService** persists the `encrypted_index` in `ChatMessage.blocks[i].citations[].encrypted_index` and replays it on subsequent turns (per Anthropic docs requirement). | Required by the API; not optional. |
| Confidence labelling | **System-prompt contract** (instructions for the model to emit `[evidence: <level>]` tokens) + **UI rendering** (regex-parse and turn into colored badges in `chat-message-list`). | Token-level granularity; not a tool call (too coarse) and not post-processing (too brittle). |
| Animal-only / few-trial flagging | Falls under the same `[evidence: animal-only]` and `[evidence: weak]` tokens. | Single mechanism, not separate. |
| Display in print/export | `report-page.component.ts` *currently* doesn't include chat. If chat-with-citations export is wanted, it gets a future phase — out of scope here. | Honor the milestone scope. |

---

## 6. Integration Points

### 6.1 External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic Messages API | Existing `AnthropicApiService.sendMessage()` extended to support `tools[]`, tool-use content blocks, `pause_turn`, and citations. Single fetch wrapper. | Browser-direct call retained (`anthropic-dangerous-direct-browser-access: true`); Electron risk noted in `CONCERNS.md` security section but not addressed in this milestone (locked constraint: minimal Electron integration). |
| Anthropic web_search server tool | Pass-through. Added to request `tools[]`; executed by Anthropic's infra; results inline in response content. | $0.01 per search — guard with `aiToolSettings.enableWebSearch` (default off) and `webSearchMaxUses` cap. |
| Anthropic memory tool | **Client-executed.** Despite the name, the docs are explicit: "The memory tool operates client-side." We provide the storage. | Backed by `AppData.memoryFiles` via `MemoryStoreService` + `MemoryToolExecutor`. |
| Anthropic count_tokens | Optional future use to replace the current `Math.ceil(text.length / 4)` heuristic (`CONCERNS.md` scaling-limits item). Costs nothing but uses rate budget. | Out of scope for this milestone unless tokenizer drift becomes a measured problem. |

### 6.2 Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `ChatService` ↔ `ToolRegistryService` | Direct DI, sync `dispatch(toolUseBlock)` returning Observable | Registry is the *only* place that knows about specific tool names. |
| `ToolRegistryService` ↔ executors | Map lookup; executors are `@Injectable({ providedIn: 'root' })` services injected at registry construction. | Adding a new tool = inject + register. |
| `MemoryToolExecutor` ↔ `MemoryStoreService` | Direct DI. Executor handles spec-shape; store handles persistence. | Two-step keeps spec compliance separable from storage choice (e.g., future swap to IndexedDB). |
| `MemoryStoreService`, `UserProfileService`, all DataQuery tools ↔ `StorageService` | Existing pattern: `getData() → map/spread → saveData()`. | **Honors the locked single-`StorageService` boundary.** |
| `DataQueryToolExecutor` ↔ existing domain services | Direct DI of `CardioService`, `WeightService`, `ReadingsService`, `DietService`. Reuses their existing observable methods. | Zero changes to the domain services themselves. |
| `chat-page` ↔ `ChatService` | Component subscribes to a single `Observable<ChatTurn>` that emits each assistant turn (one per loop iteration), enabling streaming-style UI. | New: ChatService returns a multi-emit observable, not a single `Observable<ChatMessage>`. Update affected component code. |

---

## 7. Anti-Patterns Recap (Cross-Cutting)

### Anti-Pattern: Bypassing `StorageService` for "AI data"
**What people do:** stash memory files in their own `localStorage` key because "it's a different concern."
**Why wrong:** breaks the single-owner boundary, evades migrations, splits backup/clear semantics.
**Do instead:** all new persisted state (`memoryFiles`, `userProfile`, `aiToolSettings`) is in `AppData`; `StorageService.clearData()` clears it; one migration chain.

### Anti-Pattern: Tool-use loop without a turn cap
**What people do:** `while (stop_reason === "tool_use") { ... }` with no upper bound.
**Why wrong:** model can get stuck in a fetch-fetch-fetch pattern; with web search it can also burn money.
**Do instead:** `aiToolSettings.maxAgentTurns` (default 10) guards the loop; on cap, surface a "the model didn't finish; here's what it did so far" UI state.

### Anti-Pattern: Storing tool inputs/outputs as raw strings
**What people do:** flatten `ToolUseBlock.input` to JSON.stringify and lose typing.
**Why wrong:** breaks replay, breaks UI rendering of "what the model asked for," breaks debugging.
**Do instead:** persist `blocks[]` with native shapes; `JSON.stringify` is for the wire only.

### Anti-Pattern: Per-food custom unit conversion logic
**What people do:** "ButterFood has its own `cupToGrams: 227` constant."
**Why wrong:** every new food becomes code; non-extensible.
**Do instead:** density on the food (`densityGramsPerMl`); generic `units.ts` does the math.

---

## 8. Scaling Considerations

| Concern | At current single-user state | If chat history balloons | If diet log balloons |
|---------|------------------------------|--------------------------|----------------------|
| LocalStorage size | Fine (low MB) | Reaches 5MB cap (~2,500 messages) — already flagged in `CONCERNS.md`. Fix path: IndexedDB; abstraction already supports it. | Diet entries are ~250B each; reach 5MB at ~20K meals. |
| Agent loop latency | 1-2 s per turn at 10 turns max → ~10–20 s worst case | Same — max-turn cap doesn't change | n/a |
| Memory file growth | Fine | Bound by user usage; add the optional "size cap + paginated read" guard from Anthropic spec recommendations. | n/a |
| Web search cost | 0 if disabled (default) | $0.01 × `webSearchMaxUses` per turn — surface in settings | n/a |

**First bottleneck under growth:** LocalStorage cap, hit by chat history. Already on the radar (`CONCERNS.md`); migration path to IndexedDB stays valid because new memory + profile + tool blocks are all just more JSON in the same `AppData` object.

---

## Sources

Verified against current Anthropic documentation (HIGH confidence):

- [Memory tool — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Web search tool — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [Tool use overview — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [How tool use works — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works)
- [Implement tool use — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
- [Token counting — Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/token-counting)

Project-internal sources (HIGH confidence — read directly):

- `/home/sean_3/my-ai-projects/personal-fitness-tracker/.planning/PROJECT.md`
- `/home/sean_3/my-ai-projects/personal-fitness-tracker/.planning/codebase/ARCHITECTURE.md`
- `/home/sean_3/my-ai-projects/personal-fitness-tracker/.planning/codebase/STRUCTURE.md`
- `/home/sean_3/my-ai-projects/personal-fitness-tracker/.planning/codebase/INTEGRATIONS.md`
- `/home/sean_3/my-ai-projects/personal-fitness-tracker/.planning/codebase/CONVENTIONS.md`
- `/home/sean_3/my-ai-projects/personal-fitness-tracker/.planning/codebase/CONCERNS.md`
- `/home/sean_3/my-ai-projects/personal-fitness-tracker/CLAUDE.md`
- `src/app/services/chat.service.ts`, `fitness-context.service.ts`, `anthropic-api.service.ts`
- `src/app/models/ai-chat.model.ts`, `app-data.model.ts`, `diet.model.ts`

Supporting (MEDIUM confidence — current best-practice references):

- [Angular Signals vs BehaviorSubject — DEV Community](https://dev.to/mridudixit15/angular-signals-vs-behaviorsubject-which-should-you-use-3pfb)
- [Cooking Weights and Measures — Wikipedia](https://en.wikipedia.org/wiki/Cooking_weights_and_measures)

---
*Architecture research for: Brownfield Angular 18 Personal Fitness Tracker — additive AI/diet/quality pieces*
*Researched: 2026-05-02*
