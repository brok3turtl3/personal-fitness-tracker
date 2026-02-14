import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AnthropicApiService, AnthropicApiError, AnthropicRequest, AnthropicResponse } from './anthropic-api.service';

describe('AnthropicApiService', () => {
  let service: AnthropicApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnthropicApiService);
  });

  function mockFetch(response: Partial<Response>): jasmine.Spy {
    const mockResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      ...response
    } as Response;

    return spyOn(globalThis, 'fetch').and.returnValue(Promise.resolve(mockResponse));
  }

  const testRequest: AnthropicRequest = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello' }]
  };

  const testResponse: AnthropicResponse = {
    id: 'msg_test123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello! How can I help you?' }],
    model: 'claude-sonnet-4-5-20250929',
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 8 }
  };

  it('should send correct headers', async () => {
    const fetchSpy = mockFetch({
      ok: true,
      json: () => Promise.resolve(testResponse)
    });

    await firstValueFrom(service.sendMessage('sk-ant-test-key', testRequest));

    const [url, options] = fetchSpy.calls.mostRecent().args;
    expect(url).toBe('https://api.anthropic.com/v1/messages');

    const headers = options.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['content-type']).toBe('application/json');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('should parse successful response', async () => {
    mockFetch({
      ok: true,
      json: () => Promise.resolve(testResponse)
    });

    const result = await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
    expect(result.content[0].text).toBe('Hello! How can I help you?');
    expect(result.usage.input_tokens).toBe(10);
  });

  it('should throw AnthropicApiError on 401', async () => {
    mockFetch({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { type: 'authentication_error', message: 'Invalid API key' } })
    });

    try {
      await firstValueFrom(service.sendMessage('sk-ant-bad', testRequest));
      fail('Should have thrown');
    } catch (e) {
      expect(e instanceof AnthropicApiError).toBeTrue();
      expect((e as AnthropicApiError).statusCode).toBe(401);
      expect((e as AnthropicApiError).message).toContain('Invalid API key');
    }
  });

  it('should throw AnthropicApiError on 429', async () => {
    mockFetch({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: { type: 'rate_limit_error', message: 'Rate limited' } })
    });

    try {
      await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
      fail('Should have thrown');
    } catch (e) {
      expect(e instanceof AnthropicApiError).toBeTrue();
      expect((e as AnthropicApiError).statusCode).toBe(429);
      expect((e as AnthropicApiError).message).toContain('Rate limited');
    }
  });

  it('should handle non-JSON error responses', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not JSON'))
    });

    try {
      await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));
      fail('Should have thrown');
    } catch (e) {
      expect(e instanceof AnthropicApiError).toBeTrue();
      expect((e as AnthropicApiError).statusCode).toBe(500);
    }
  });

  it('should send request body as JSON', async () => {
    const fetchSpy = mockFetch({
      ok: true,
      json: () => Promise.resolve(testResponse)
    });

    await firstValueFrom(service.sendMessage('sk-ant-test', testRequest));

    const body = JSON.parse(fetchSpy.calls.mostRecent().args[1].body);
    expect(body.model).toBe('claude-sonnet-4-5-20250929');
    expect(body.max_tokens).toBe(1024);
    expect(body.messages[0].content).toBe('Hello');
  });
});
