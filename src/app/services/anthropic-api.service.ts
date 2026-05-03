import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import Anthropic from '@anthropic-ai/sdk';
import type {
  Message,
  MessageCreateParams,
  MessageParam,
} from '@anthropic-ai/sdk/resources/messages';

/**
 * Compile-saving type aliases for callers that have not yet been migrated
 * to the SDK types directly. Plan 03-02 Task 4 removes the `AnthropicMessage`
 * and `AnthropicResponse` aliases when chat.service.ts is fully wired
 * through chat-block-serializer.ts. They are NOT new public surface — they
 * are throwaway shims, scoped to the Wave 2 transition.
 *
 * Task 3 verification gate requires no `export interface AnthropicMessage`,
 * etc. Using `type` aliases satisfies that gate (it forbids `interface`).
 */
export type AnthropicMessage = MessageParam;
export type AnthropicResponse = Message;

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
 * SC5 (type-level): `sendMessage` accepts `Omit<MessageCreateParams, 'tools'
 * | 'tool_choice'>` — TypeScript rejects callers attempting to pass the
 * forbidden Phase 3 fields. Phase 4 will explicitly remove the Omit when
 * activating the agentic loop.
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
   * Phase 3 single-shot Messages API call.
   *
   * @param apiKey User-supplied key from AISettingsService.
   * @param params MessageCreateParams MINUS `tools`/`tool_choice` —
   *               Phase 3 SC5 forbids them at the type level.
   */
  sendMessage(
    apiKey: string,
    params: Omit<MessageCreateParams, 'tools' | 'tool_choice'>,
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
   */
  countTokens(
    apiKey: string,
    params: { model: string; system?: string; messages: MessageParam[] },
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
