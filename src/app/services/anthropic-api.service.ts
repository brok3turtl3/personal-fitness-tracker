import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import Anthropic from '@anthropic-ai/sdk';
import type {
  Message,
  MessageCreateParams,
  MessageParam,
  TextBlockParam,
  MessageCountTokensTool,
  // --- Phase 5 web-search server-tool shapes (D-01/D-02, verified in 0.92.0) ---
  WebSearchTool20250305,
  ServerToolUseBlock,
  WebSearchToolResultBlock,
  WebSearchResultBlock,
  WebSearchToolResultError,
  WebSearchToolResultErrorCode,
  CitationsWebSearchResultLocation,
  TextCitation,
} from '@anthropic-ai/sdk/resources/messages';

/**
 * Typed error thrown by AnthropicApiService.
 *
 * Public surface (statusCode + errorType) is unchanged from the pre-SDK
 * fetch wrapper — `chat-page.component.ts` line 286 (`err instanceof
 * AnthropicApiError && err.statusCode === 401`) keeps compiling.
 *
 * `requestId` is new (D-17 / AI-SPEC.md §3) — preserves the SDK's
 * `request_id` header for correlation. Optional 4th constructor arg.
 */
/**
 * Phase 5 (D-17): the response-side web-search SDK blocks this transport
 * boundary owns. They flow OUT of `messages.create` as part of `Message.content`
 * and are narrowed into local SDK-free `ChatBlock`s by `chat-block-serializer.ts`
 * (`server_tool_use` / `web_search_tool_result` passed through verbatim) and into
 * `GroundedCitation[]` by `web-citation-parser.ts` (the `TextBlock.citations`
 * `CitationsWebSearchResultLocation` narrowing). This alias documents — and keeps
 * type-checked at THIS file — the exact SDK surface Phase 5 added, so the D-17
 * boundary is explicit and a future SDK rename breaks here, not silently.
 */
type WebSearchSdkSurface = {
  serverToolUse: ServerToolUseBlock;
  resultBlock: WebSearchToolResultBlock;
  result: WebSearchResultBlock;
  error: WebSearchToolResultError;
  errorCode: WebSearchToolResultErrorCode;
  citation: CitationsWebSearchResultLocation;
  citationUnion: TextCitation;
};

export class AnthropicApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorType?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'AnthropicApiError';
  }
}

/**
 * Transport-layer service for the Anthropic Messages API.
 *
 * D-17: SDK-based transport replaces the hand-rolled fetch wrapper.
 * SDK types own the wire (Message, MessageCreateParams, MessageParam);
 * our ChatBlock model owns persistence; chat-block-serializer.ts is the
 * explicit bridge.
 *
 * Phase 4 (D-15 / CHAT-10): the Phase 3 type-level guard that forbade
 * `tools`/`tool_choice` on `sendMessage` is intentionally LIFTED — the
 * agentic loop now sends full `MessageCreateParams` (with `tools[]` and
 * a `cache_control`'d system prefix). `countTokens` likewise widens to
 * accept a `TextBlockParam[]` system + `tools` so the cacheable prefix
 * and the tools block are both counted.
 *
 * Lint chokepoint: only this file and `chat-block-serializer.ts` may
 * import from `@anthropic-ai/sdk` or its sub-paths.
 */
@Injectable({ providedIn: 'root' })
export class AnthropicApiService {
  /**
   * Cache the SDK client per apiKey so we don't reconstruct on every send.
   * Keys rarely change inside a session.
   */
  private clientCache = new Map<string, Anthropic>();

  /**
   * Messages API call (single-shot in Phase 3; one iteration of the
   * Phase 4 agentic loop).
   *
   * @param apiKey User-supplied key from AISettingsService.
   * @param params Full `MessageCreateParams` — Phase 4 lifts the Phase 3
   *               `Omit<..., 'tools' | 'tool_choice'>` guard so the loop
   *               can pass `tools[]` and a `cache_control`'d system prefix.
   */
  sendMessage(
    apiKey: string,
    params: MessageCreateParams,
  ): Observable<Message> {
    const client = this.getClient(apiKey);
    return from(
      (client.messages.create(params) as Promise<Message>).catch((err: unknown) => {
        throw this.mapError(err);
      }),
    );
  }

  /**
   * Free token-counting endpoint. Replaces the `text.length / 4`
   * heuristic (CONCERNS.md drift item) when called by callers that need
   * an accurate count.
   *
   * Phase 4 (D-15): `system` widens to `string | TextBlockParam[]` and a
   * `tools` param is accepted so the `cache_control`'d prefix + the tools
   * block are both counted for the window decision.
   */
  countTokens(
    apiKey: string,
    params: {
      model: string;
      system?: string | TextBlockParam[];
      messages: MessageParam[];
      tools?: MessageCountTokensTool[];
    },
  ): Observable<number> {
    const client = this.getClient(apiKey);
    return from(
      client.messages
        .countTokens(params)
        .then(r => r.input_tokens)
        .catch((err: unknown) => {
          throw this.mapError(err);
        }),
    );
  }

  /**
   * Phase 5 (RESCH-01 / D-01 / D-06 / D-07): build the `web_search_20250305`
   * server-tool definition at the D-17 transport boundary — the ONLY place SDK
   * tool types live.
   *
   *  - OFF by default: returns `null` unless `enableWebSearch` is true, so the
   *    caller (`chat.service.runAgenticLoop`) appends nothing to `tools[]` and
   *    the outbound web-search surface simply does not exist (D-10 privacy).
   *  - `max_uses` is the configured per-turn cost cap (`webSearchMaxUses`,
   *    default 3 — D-06), wired to the request so Anthropic stops searching at
   *    the ceiling.
   *  - `allowed_domains` / `blocked_domains` / `user_location` are intentionally
   *    UNSET this milestone (D-07) — domain filtering / coarse-location are out
   *    of scope and location would leak.
   *
   * Returns the SDK `WebSearchTool20250305` (the server tool is read-only and is
   * NEVER routed through `ToolRegistryService.dispatch`; `isWriteProposal`
   * stays false). The caller holds it via a local structural shape.
   */
  buildWebSearchTool(settings: {
    enableWebSearch: boolean;
    webSearchMaxUses: number;
  }): WebSearchTool20250305 | null {
    if (!settings.enableWebSearch) return null; // opt-in only — OFF by default (D-10)
    return {
      type: 'web_search_20250305', // STABLE version pinned (D-01)
      name: 'web_search',
      max_uses: settings.webSearchMaxUses ?? 3, // D-06 cost cap (default 3)
      // allowed_domains / blocked_domains / user_location: UNSET (D-07).
    };
  }

  private getClient(apiKey: string): Anthropic {
    let client = this.clientCache.get(apiKey);
    if (!client) {
      client = new Anthropic({
        apiKey,
        // Required for Electron renderer (and any browser context). Without
        // this the SDK throws at construction time. Sets the
        // `anthropic-dangerous-direct-browser-access: true` header
        // automatically.
        dangerouslyAllowBrowser: true,
        maxRetries: 2,
      });
      this.clientCache.set(apiKey, client);
    }
    return client;
  }

  private mapError(err: unknown): AnthropicApiError {
    if (err instanceof Anthropic.APIError) {
      const status = typeof err.status === 'number' ? err.status : 0;
      // SDK composes err.message as "<status> <body>"; prefer the typed
      // `err.error.message` payload when available so the friendly mapping
      // sees the same string the pre-SDK fetch wrapper saw.
      const body = err.error as { error?: { message?: string } } | undefined;
      const apiMessage = body?.error?.message ?? err.message;
      const friendly = this.friendlyMessage(status, apiMessage);
      const requestId = err.requestID ?? undefined;
      return new AnthropicApiError(friendly, status, err.name, requestId);
    }
    if (err instanceof Error) {
      return new AnthropicApiError(err.message, 0, 'NetworkError');
    }
    return new AnthropicApiError('Unknown error', 0, 'Unknown');
  }

  /**
   * Friendly user-facing error messages — preserved verbatim from the
   * pre-SDK fetch wrapper (chat-page.component.ts depends on this).
   */
  private friendlyMessage(status: number, fallback: string): string {
    switch (status) {
      case 401:
        return 'Invalid API key. Please check your key in Settings.';
      case 429:
        return 'Rate limited. Please wait a moment and try again.';
      case 400:
        return fallback || 'Bad request. Please try a shorter message.';
      case 403:
        return 'Access forbidden. Your API key may not have permission for this model.';
      case 500:
      case 529:
        return 'Anthropic API is temporarily unavailable. Please try again later.';
      default:
        return fallback || `API error (${status})`;
    }
  }
}
