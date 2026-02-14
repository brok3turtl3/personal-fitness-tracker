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

export interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string;
  usage: AnthropicUsage;
}

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

const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

@Injectable({
  providedIn: 'root'
})
export class AnthropicApiService {
  sendMessage(apiKey: string, request: AnthropicRequest): Observable<AnthropicResponse> {
    const fetchPromise = fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(request)
    });

    return from(fetchPromise).pipe(
      switchMap(response => {
        if (!response.ok) {
          return from(response.json().catch(() => null)).pipe(
            map(body => {
              const message = this.getErrorMessage(response.status, body);
              throw new AnthropicApiError(message, response.status, body?.error?.type);
            })
          );
        }
        return from(response.json()) as Observable<AnthropicResponse>;
      })
    );
  }

  private getErrorMessage(status: number, body: Record<string, unknown> | null): string {
    const apiMessage = (body as Record<string, Record<string, string>> | null)?.['error']?.['message'];

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
}
