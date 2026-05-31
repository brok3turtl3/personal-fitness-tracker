export type ChatRole = 'user' | 'assistant';

/**
 * A grounded web-search citation, narrowed + `https:`-gated from the SDK
 * `TextCitation` union by `web-citation-parser.ts` at the D-17 transport
 * chokepoint (Phase 5, D-03/D-09).
 *
 * Persistence + render shape — SDK-agnostic per AI-SPEC.md §3 Pitfall #2. This
 * is the ONLY object the renderer is allowed to turn into an `<a href>`; the
 * `url` is GUARANTEED `https:`. Lives here (NOT in the service) so the model
 * stays the single source of truth and avoids a model→service import (D-17).
 * `web-citation-parser.ts` imports this type from the model.
 */
export interface GroundedCitation {
  /** GUARANTEED https: (gated by web-citation-parser). */
  readonly url: string;
  /** Falls back to the host when the API title is null/blank. Never blank. */
  readonly title: string;
  /** The cited_text excerpt, for the footnote tooltip. Coerced from null. */
  readonly citedText: string;
}

/**
 * Plain text content in a chat message.
 *
 * Persistence shape — SDK-agnostic per AI-SPEC.md §3 Pitfall #2. Bridges to
 * the Anthropic wire format via `chat-block-serializer.ts` (D-16).
 *
 * Phase 5 (D-03): `citations` carries the grounded web-search citations that
 * back THIS text block. Already narrowed + https-gated to the local
 * `GroundedCitation` shape — the renderer needs no SDK type to emit footnotes.
 * Absent/empty ⇒ an un-grounded claim (plain inert text, no link).
 */
export interface TextBlock {
  type: 'text';
  text: string;
  /** Phase 5: grounded web-search citations backing this block (D-03/D-09). */
  citations?: GroundedCitation[];
}

/**
 * A single web-search result, persisted SDK-agnostically from the wire
 * `WebSearchResultBlock`. `encryptedContent` MUST round-trip byte-stable so
 * multi-turn citation resolution keeps working (Pitfall 1, F13).
 *
 * Persistence shape — SDK-agnostic per AI-SPEC.md §3 Pitfall #2.
 */
export interface WebSearchResultPersisted {
  type: 'web_search_result';
  url: string;
  title: string;
  /** Opaque server token — passed through verbatim, never decoded (Pitfall 1). */
  encryptedContent: string;
  pageAge?: string;
}

/**
 * Anthropic-executed `web_search` server tool invocation, persisted verbatim
 * (Phase 5, D-02). The client NEVER dispatches this — Anthropic runs the
 * search server-side and returns the paired `web_search_tool_result`.
 *
 * Persistence shape — SDK-agnostic per AI-SPEC.md §3 Pitfall #2.
 */
export interface ServerToolUsePersistedBlock {
  type: 'server_tool_use';
  id: string;
  name: string;
  input: unknown;
}

/**
 * The server-side web-search result block, persisted verbatim (Phase 5, D-02).
 * `content` is either the array of results OR an honest error union (HTTP 200 +
 * `web_search_tool_result_error`, D-05/E4). Preserved so `encrypted_content`
 * survives reload for multi-turn resolution (Pitfall 1, F13).
 *
 * Persistence shape — SDK-agnostic per AI-SPEC.md §3 Pitfall #2.
 */
export interface WebSearchToolResultPersistedBlock {
  type: 'web_search_tool_result';
  toolUseId: string;
  content:
    | WebSearchResultPersisted[]
    | { type: 'web_search_tool_result_error'; errorCode: string };
}

/**
 * AI-proposed tool invocation (Phase 3 dormant scaffold; Phase 4 activates).
 *
 * Persistence shape — SDK-agnostic per AI-SPEC.md §3 Pitfall #2.
 *
 * `status` and `editedFromText` are persistence-only fields — stripped by
 * `chat-block-serializer.toAnthropicContent` before going on the wire
 * (D-15, D-16). They distinguish our model from Anthropic's tool_use block,
 * carrying the user's confirm-before-write decision through to the audit
 * trail (D-11).
 */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
  /** Persistence-only: confirm-before-write disposition. Stripped before API call. */
  status: 'pending' | 'approved' | 'discarded' | 'edited';
  /** Persistence-only: original AI text when status='edited'. Stripped before API call. */
  editedFromText?: string;
  /**
   * Persistence-only: ISO-8601 timestamp recorded when the proposal was
   * resolved (approved / discarded / edited). Stripped before the API call.
   * The pending pill renders this real timestamp on its resolved badge
   * (Plan 04-06). Absent on legacy blocks → the pill omits the timestamp
   * rather than fabricate one.
   */
  resolvedAt?: string;
}

/**
 * Result of executing a tool — fed back to the AI on the next turn.
 *
 * Persistence shape — SDK-agnostic per AI-SPEC.md §3 Pitfall #2.
 */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  isError?: boolean;
}

/**
 * Discriminated union of all chat message block kinds.
 *
 * Persistence shape — SDK-agnostic per AI-SPEC.md §3 Pitfall #2. The
 * `chat-block-serializer.ts` module bridges this to the Anthropic wire
 * format (drops persistence-only fields, normalizes tool_use blocks with
 * `status='pending'` to plain text per D-16).
 */
export type ChatBlock =
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock
  | ServerToolUsePersistedBlock
  | WebSearchToolResultPersistedBlock;

/**
 * One message inside a ChatConversation.
 *
 * V5 shape per CONTEXT.md D-15: full cut-over from `content: string` to
 * `blocks: ChatBlock[]` (discriminated union per D-15). No transitional
 * shim. V4→V5 migration lifts each `content` string into a single text
 * block. Render via `chat-message-list.component.ts` @switch on
 * `block.type`.
 */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** Discriminated union per D-15. Replaces the V4 `content: string` field. */
  blocks: ChatBlock[];
  tokenEstimate: number;
  createdAt: string;
}

/**
 * Per-claim confidence grade emitted inline by the model on graded claims
 * (D-09). The 6-value allow-list is canonical — `confidence-attribution-parser.ts`
 * narrows raw model tokens against exactly these values; an unknown token
 * leaves confidence `undefined` (renders unbadged, never fabricated).
 */
export type Confidence =
  | 'strong'
  | 'moderate'
  | 'weak'
  | 'animal-only'
  | 'anecdotal'
  | 'speculative';

/**
 * Source axis for a graded claim (D-10): whether the claim is grounded in the
 * user's own logged `data` or in external `research`.
 */
export type Attribution = 'data' | 'research';

/**
 * A single claim span parsed out of assistant text. The inline grading tokens
 * (`[evidence: …]` / `[source: …]`) are stripped from `text`; `confidence` and
 * `source` are set only when a valid token was present (safe degradation, D-09).
 */
export interface ClaimSpan {
  /** The claim text with its inline grading tokens stripped. */
  readonly text: string;
  /** undefined ⇒ render unbadged (safe degradation, D-09). */
  readonly confidence?: Confidence;
  /** undefined ⇒ no source marker. */
  readonly source?: Attribution;
}

/**
 * Loop-event union emitted by the Phase 4 agentic loop, one event per
 * meaningful step of a single user turn.
 *
 * SDK-agnostic (D-17): no Anthropic SDK import here. The `tool_use_started`
 * payload carries the UI-needed fields structurally (NOT the SDK `ToolUseBlock`),
 * and `done.stopReason` is a plain `string` (NOT the SDK `StopReason`) — the
 * loop narrows the SDK types to these at the transport chokepoint.
 */
export type ChatTurnEvent =
  | { kind: 'tool_use_started'; toolUseId: string; toolName: string; input: unknown }
  | { kind: 'tool_result'; toolUseId: string; summary: string }
  | { kind: 'assistant_text'; blocks: ChatBlock[] }
  | { kind: 'turn_limit'; turnsUsed: number }
  // Phase 5 (D-02/D-05): live web-search feedback for the inline
  // server_tool_use / web_search_tool_result blocks. Render-only — these
  // events never trigger a client dispatch. Plain string/number fields ONLY
  // (NO SDK types — D-17): the loop narrows the SDK blocks into these.
  | { kind: 'web_search_started'; query: string }
  | { kind: 'web_search_results'; count: number }
  | { kind: 'web_search_error'; code: string }
  | { kind: 'done'; stopReason: string };

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  summary?: string;
  summarizedMessageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AISettings {
  apiKey?: string;
  selectedModel?: string;
  maxResponseTokens: number;
}

export const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (default)', contextWindow: 200000 },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (faster)', contextWindow: 200000 },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8 (best reasoning)', contextWindow: 200000 },
];

export const DEFAULT_AI_SETTINGS: AISettings = { maxResponseTokens: 4096 };

/**
 * Per-tool, per-redaction settings the user controls in /settings/ai.
 *
 * Per CONTEXT.md D-09: redaction defaults are all OFF (single sophisticated
 * user opted-in to seeing everything; toggles exist for screen-sharing and
 * future granularity). Tool flags default ON for memory/data-query and OFF
 * for web search (Phase 5 territory).
 */
export interface AIToolSettings {
  /** Master switch for the data-query tool family (Phase 4). Default: true. */
  enableDataQueryTools: boolean;
  /** Master switch for the memory tool (Phase 4). Default: true. */
  enableMemoryTool: boolean;
  /** Master switch for web search (Phase 5). Default: false. */
  enableWebSearch: boolean;
  /** Max web-search invocations per turn (Phase 5). Default: 3. */
  webSearchMaxUses: number;
  /** Max agentic-loop turns per user message (Phase 4). Default: 10. */
  maxAgentTurns: number;
  /** Omit BP/glucose/ketone readings from system prompt. Default: false. */
  redactHealthReadings: boolean;
  /** Omit weight entries from system prompt. Default: false. */
  redactWeightEntries: boolean;
  /** Omit free-text meal notes from system prompt (macros still sent). Default: false. */
  redactMealNotes: boolean;
}

/**
 * Default AIToolSettings — tools on, web search off, redaction off (D-09).
 * Used by `createEmptyAppData()` and the V4→V5 migration.
 */
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
