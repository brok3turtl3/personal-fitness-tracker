import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import Anthropic from '@anthropic-ai/sdk';
import { Messages } from '@anthropic-ai/sdk/resources/messages';
import type {
  Message,
  MessageCreateParams,
  TextBlockParam,
  Tool,
  MessageCountTokensTool,
} from '@anthropic-ai/sdk/resources/messages';
import { AnthropicApiService, AnthropicApiError } from './anthropic-api.service';

/**
 * Spec for AnthropicApiService — SDK-spy-based replacement for the
 * pre-SDK fetch-spy spec.
 *
 * Pattern: spy on `Messages.prototype.create` and
 * `Messages.prototype.countTokens` so per-test resolved/rejected values
 * shape the observable. Each spec uses TestBed.inject for construction
 * (real SDK class instances; SDK constructor runs with
 * dangerouslyAllowBrowser: true in the service's getClient).
 *
 * Coverage:
 *   - 401, 403, 429, 400, 500, 529, default — friendly-message contract
 *   - Network error (no APIError) — statusCode 0, errorType 'NetworkError'
 *   - Successful sendMessage returns Message observable
 *   - Phase 4: sendMessage forwards `tools[]` + a `cache_control`'d system
 *     prefix to the SDK (the Phase 3 type-level `tools` guard is lifted)
 *   - countTokens returns input_tokens; forwards `TextBlockParam[]` system
 *     + `tools` to the SDK
 *   - APIError request_id propagates to AnthropicApiError.requestId
 */
describe('AnthropicApiService', () => {
  let service: AnthropicApiService;

  // Hand-built minimal SDK Message fixture — `as unknown as Message` cast
  // is the spec-only escape hatch for fixture construction.
  const fakeMessage = {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hi', citations: null }],
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 1,
      output_tokens: 1,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    },
  } as unknown as Message;

  // Build a real Anthropic.APIError with a specific status, surfaced from
  // the SDK's actual constructor so `err instanceof Anthropic.APIError`
  // matches our service's runtime check.
  function apiError(status: number, message = 'API failure', errorType = 'AuthenticationError', requestId?: string) {
    const err = new Anthropic.APIError(
      status,
      { error: { type: errorType, message } } as object,
      message,
      new Headers(),
    );
    // Override .name and .requestID for this fixture (SDK builds them lazily).
    Object.defineProperty(err, 'name', { value: errorType });
    if (requestId !== undefined) {
      Object.defineProperty(err, 'requestID', { value: requestId, writable: true });
    }
    return err;
  }

  // Sample request — error-mapping specs only need the minimal shape.
  const testRequest: MessageCreateParams = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello' }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnthropicApiService);
  });

  describe('sendMessage — error mapping', () => {
    it('401 → "Invalid API key. Please check your key in Settings." with statusCode 401', async () => {
      spyOn(Messages.prototype, 'create').and.rejectWith(apiError(401, 'unauthorized', 'AuthenticationError'));
      try {
        await firstValueFrom(service.sendMessage('sk-ant-bad', testRequest));
        fail('expected throw');
      } catch (e) {
        expect(e instanceof AnthropicApiError).toBeTrue();
        const err = e as AnthropicApiError;
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid API key. Please check your key in Settings.');
        expect(err.errorType).toBe('AuthenticationError');
      }
    });

    it('403 → "Access forbidden. Your API key may not have permission for this model."', async () => {
      spyOn(Messages.prototype, 'create').and.rejectWith(apiError(403, 'forbidden', 'PermissionDeniedError'));
      try {
        await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
        fail('expected throw');
      } catch (e) {
        const err = e as AnthropicApiError;
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe('Access forbidden. Your API key may not have permission for this model.');
      }
    });

    it('429 → "Rate limited. Please wait a moment and try again."', async () => {
      spyOn(Messages.prototype, 'create').and.rejectWith(apiError(429, 'rate limit', 'RateLimitError'));
      try {
        await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
        fail('expected throw');
      } catch (e) {
        const err = e as AnthropicApiError;
        expect(err.statusCode).toBe(429);
        expect(err.message).toBe('Rate limited. Please wait a moment and try again.');
      }
    });

    it('400 → "Bad request..." (or apiMessage) with statusCode 400', async () => {
      spyOn(Messages.prototype, 'create').and.rejectWith(apiError(400, 'malformed payload', 'BadRequestError'));
      try {
        await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
        fail('expected throw');
      } catch (e) {
        const err = e as AnthropicApiError;
        expect(err.statusCode).toBe(400);
        // For 400, friendly returns the apiMessage if present, else the canned string.
        expect(err.message).toBe('malformed payload');
      }
    });

    it('500 → "Anthropic API is temporarily unavailable..."', async () => {
      spyOn(Messages.prototype, 'create').and.rejectWith(apiError(500, 'internal err', 'InternalServerError'));
      try {
        await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
        fail('expected throw');
      } catch (e) {
        const err = e as AnthropicApiError;
        expect(err.statusCode).toBe(500);
        expect(err.message).toBe('Anthropic API is temporarily unavailable. Please try again later.');
      }
    });

    it('529 → "Anthropic API is temporarily unavailable..."', async () => {
      spyOn(Messages.prototype, 'create').and.rejectWith(apiError(529, 'overloaded', 'OverloadedError'));
      try {
        await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
        fail('expected throw');
      } catch (e) {
        const err = e as AnthropicApiError;
        expect(err.statusCode).toBe(529);
        expect(err.message).toBe('Anthropic API is temporarily unavailable. Please try again later.');
      }
    });

    it('unknown status (e.g. 418) → fallback API error string', async () => {
      spyOn(Messages.prototype, 'create').and.rejectWith(apiError(418, 'teapot', 'UnknownError'));
      try {
        await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
        fail('expected throw');
      } catch (e) {
        const err = e as AnthropicApiError;
        expect(err.statusCode).toBe(418);
        // Falls back to the apiMessage if present.
        expect(err.message).toBe('teapot');
      }
    });

    it('unknown status with empty message → fallback API error string with code', async () => {
      spyOn(Messages.prototype, 'create').and.rejectWith(apiError(418, '', 'UnknownError'));
      try {
        await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
        fail('expected throw');
      } catch (e) {
        const err = e as AnthropicApiError;
        expect(err.message).toBe('API error (418)');
      }
    });

    it('network error (no APIError) → NetworkError with statusCode 0', async () => {
      spyOn(Messages.prototype, 'create').and.rejectWith(new Error('ECONNREFUSED'));
      try {
        await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
        fail('expected throw');
      } catch (e) {
        const err = e as AnthropicApiError;
        expect(err.statusCode).toBe(0);
        expect(err.errorType).toBe('NetworkError');
        expect(err.message).toBe('ECONNREFUSED');
      }
    });

    it('error preserves request_id in AnthropicApiError', async () => {
      spyOn(Messages.prototype, 'create').and.rejectWith(
        apiError(401, 'unauthorized', 'AuthenticationError', 'req_abc123'),
      );
      try {
        await firstValueFrom(service.sendMessage('sk-ant-bad', testRequest));
        fail('expected throw');
      } catch (e) {
        const err = e as AnthropicApiError;
        expect(err.requestId).toBe('req_abc123');
      }
    });
  });

  describe('sendMessage — success path + Phase 4 transport widening', () => {
    it('success returns Message observable with content', async () => {
      spyOn(Messages.prototype, 'create').and.resolveTo(fakeMessage);
      const result = await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
      expect(result.id).toBe('msg_test');
      expect(result.content[0].type).toBe('text');
    });

    it('Phase 4: forwards a `tools` array to the mocked client messages.create', async () => {
      const spy = spyOn(Messages.prototype, 'create').and.resolveTo(fakeMessage);
      const tools: Tool[] = [
        {
          name: 'query_weight_entries',
          description: 'Query weight entries in a date range.',
          input_schema: { type: 'object', properties: {} },
        },
      ];
      const requestWithTools: MessageCreateParams = {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Hello' }],
        tools,
      };

      await firstValueFrom(service.sendMessage('sk-ant-test', requestWithTools));

      const args = spy.calls.mostRecent().args[0] as unknown as Record<string, unknown>;
      expect(args['tools']).toBe(tools);
      expect(Array.isArray(args['tools'])).toBeTrue();
      expect((args['tools'] as Tool[])[0].name).toBe('query_weight_entries');
    });

    it('Phase 4: forwards a cache_control system prefix to messages.create', async () => {
      const spy = spyOn(Messages.prototype, 'create').and.resolveTo(fakeMessage);
      const system: TextBlockParam[] = [
        {
          type: 'text',
          text: 'Stable cacheable key-facts header.',
          cache_control: { type: 'ephemeral' },
        },
      ];
      const requestWithCache: MessageCreateParams = {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await firstValueFrom(service.sendMessage('sk-ant-test', requestWithCache));

      const args = spy.calls.mostRecent().args[0] as unknown as { system: TextBlockParam[] };
      expect(args.system[0].cache_control).toEqual({ type: 'ephemeral' });
    });
  });

  describe('buildWebSearchTool (Phase 5 — E6 cost cap + opt-in gate, D-01/D-06/D-07)', () => {
    it('returns null when enableWebSearch is false (OFF by default, D-10)', () => {
      const tool = service.buildWebSearchTool({ enableWebSearch: false, webSearchMaxUses: 3 });
      expect(tool).toBeNull();
    });

    it('returns the web_search_20250305 def with max_uses === webSearchMaxUses when enabled (E6)', () => {
      const tool = service.buildWebSearchTool({ enableWebSearch: true, webSearchMaxUses: 5 });
      expect(tool).not.toBeNull();
      expect(tool!.type).toBe('web_search_20250305');
      expect(tool!.name).toBe('web_search');
      expect(tool!.max_uses).toBe(5);
    });

    it('defaults max_uses to 3 when webSearchMaxUses is missing (D-06)', () => {
      // Exercise the `?? 3` fallback even though the typed setting is required.
      const tool = service.buildWebSearchTool({
        enableWebSearch: true,
        webSearchMaxUses: undefined as unknown as number,
      });
      expect(tool!.max_uses).toBe(3);
    });

    it('leaves allowed_domains / blocked_domains / user_location UNSET (D-07)', () => {
      const tool = service.buildWebSearchTool({ enableWebSearch: true, webSearchMaxUses: 3 })!;
      const t = tool as unknown as Record<string, unknown>;
      expect(t['allowed_domains']).toBeUndefined();
      expect(t['blocked_domains']).toBeUndefined();
      expect(t['user_location']).toBeUndefined();
    });
  });

  describe('countTokens', () => {
    it('success returns input_tokens count', async () => {
      spyOn(Messages.prototype, 'countTokens').and.resolveTo({ input_tokens: 42 } as never);
      const result = await firstValueFrom(
        service.countTokens('sk-ant-test', {
          model: 'claude-sonnet-4-6',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
      expect(result).toBe(42);
    });

    it('Phase 4: forwards a TextBlockParam[] system + tools to messages.countTokens', async () => {
      const spy = spyOn(Messages.prototype, 'countTokens').and.resolveTo({ input_tokens: 7 } as never);
      const system: TextBlockParam[] = [
        { type: 'text', text: 'Cacheable prefix', cache_control: { type: 'ephemeral' } },
      ];
      const tools: MessageCountTokensTool[] = [
        {
          name: 'query_cardio_sessions',
          description: 'Query cardio sessions.',
          input_schema: { type: 'object', properties: {} },
        },
      ];

      const result = await firstValueFrom(
        service.countTokens('sk-ant-test', {
          model: 'claude-sonnet-4-6',
          system,
          messages: [{ role: 'user', content: 'Hello' }],
          tools,
        }),
      );

      expect(result).toBe(7);
      const args = spy.calls.mostRecent().args[0] as unknown as {
        system: TextBlockParam[];
        tools: MessageCountTokensTool[];
      };
      expect(args.system[0].cache_control).toEqual({ type: 'ephemeral' });
      expect(args.tools[0].name).toBe('query_cardio_sessions');
    });

    it('error maps through mapError just like sendMessage', async () => {
      spyOn(Messages.prototype, 'countTokens').and.rejectWith(apiError(401, 'unauthorized', 'AuthenticationError'));
      try {
        await firstValueFrom(
          service.countTokens('sk-ant-bad', {
            model: 'claude-sonnet-4-6',
            messages: [{ role: 'user', content: 'Hello' }],
          }),
        );
        fail('expected throw');
      } catch (e) {
        expect(e instanceof AnthropicApiError).toBeTrue();
        expect((e as AnthropicApiError).statusCode).toBe(401);
      }
    });
  });
});
