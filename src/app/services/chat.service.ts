import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { StorageService } from './storage.service';
import { AnthropicApiService, AnthropicMessage } from './anthropic-api.service';
import { AISettingsService } from './ai-settings.service';
import { FitnessContextService } from './fitness-context.service';
import { ChatConversation, ChatMessage, CLAUDE_MODELS, DEFAULT_AI_SETTINGS } from '../models/ai-chat.model';

const MESSAGE_WINDOW_SIZE = 20;
const TOKEN_WINDOW_SIZE = 8000;
const SUMMARIZATION_PROMPT = 'Summarize this conversation preserving key facts, goals, decisions, and specific numbers. Keep under 200 words.';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  constructor(
    private storageService: StorageService,
    private anthropicApi: AnthropicApiService,
    private aiSettingsService: AISettingsService,
    private fitnessContext: FitnessContextService
  ) {}

  getConversations(): Observable<ChatConversation[]> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return [];
        return [...data.chatConversations].sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      })
    );
  }

  getConversation(id: string): Observable<ChatConversation | null> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return null;
        return data.chatConversations.find(c => c.id === id) ?? null;
      })
    );
  }

  createConversation(title?: string): Observable<ChatConversation> {
    const now = new Date();
    const defaultTitle = `Chat — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const conversation: ChatConversation = {
      id: generateUUID(),
      title: title ?? defaultTitle,
      messages: [],
      summarizedMessageCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));
        return this.storageService.saveData({
          ...data,
          chatConversations: [...data.chatConversations, conversation]
        }).pipe(map(() => conversation));
      })
    );
  }

  deleteConversation(id: string): Observable<boolean> {
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));
        const exists = data.chatConversations.some(c => c.id === id);
        if (!exists) return of(false);
        return this.storageService.saveData({
          ...data,
          chatConversations: data.chatConversations.filter(c => c.id !== id)
        }).pipe(map(() => true));
      })
    );
  }

  sendMessage(conversationId: string, userMessageText: string): Observable<ChatMessage> {
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: generateUUID(),
      role: 'user',
      content: userMessageText,
      tokenEstimate: estimateTokens(userMessageText),
      createdAt: now
    };

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));

        const convIndex = data.chatConversations.findIndex(c => c.id === conversationId);
        if (convIndex === -1) return throwError(() => new Error('Conversation not found'));

        const conversation = { ...data.chatConversations[convIndex] };
        conversation.messages = [...conversation.messages, userMessage];
        conversation.updatedAt = now;

        // Persist user message
        const updatedConversations = [...data.chatConversations];
        updatedConversations[convIndex] = conversation;
        const updatedData = { ...data, chatConversations: updatedConversations };

        return this.storageService.saveData(updatedData).pipe(
          switchMap(() => this.aiSettingsService.getSettings()),
          switchMap(settings => {
            const apiKey = settings.apiKey;
            if (!apiKey) return throwError(() => new Error('No API key configured. Please add your key in Settings.'));

            const model = settings.selectedModel ?? CLAUDE_MODELS[0].value;
            const maxTokens = settings.maxResponseTokens ?? DEFAULT_AI_SETTINGS.maxResponseTokens;

            return this.fitnessContext.buildSystemPrompt().pipe(
              switchMap(systemPrompt => {
                const apiMessages = this.buildApiMessages(conversation);

                return this.anthropicApi.sendMessage(apiKey, {
                  model,
                  max_tokens: maxTokens,
                  system: systemPrompt,
                  messages: apiMessages
                });
              }),
              switchMap(response => {
                const assistantText = response.content
                  .filter(block => block.type === 'text')
                  .map(block => block.text)
                  .join('');

                const assistantMessage: ChatMessage = {
                  id: generateUUID(),
                  role: 'assistant',
                  content: assistantText,
                  tokenEstimate: estimateTokens(assistantText),
                  createdAt: new Date().toISOString()
                };

                // Re-read data to avoid stale writes
                return this.storageService.getData().pipe(
                  switchMap(freshData => {
                    if (!freshData) return throwError(() => new Error('Storage not initialized'));

                    const freshConvIndex = freshData.chatConversations.findIndex(c => c.id === conversationId);
                    if (freshConvIndex === -1) return throwError(() => new Error('Conversation not found'));

                    const freshConv = { ...freshData.chatConversations[freshConvIndex] };
                    freshConv.messages = [...freshConv.messages, assistantMessage];
                    freshConv.updatedAt = assistantMessage.createdAt;

                    const freshConversations = [...freshData.chatConversations];
                    freshConversations[freshConvIndex] = freshConv;

                    return this.storageService.saveData({
                      ...freshData,
                      chatConversations: freshConversations
                    }).pipe(
                      switchMap(() => this.maybeSummarize(conversationId, freshConv, settings.apiKey!, model, maxTokens)),
                      map(() => assistantMessage)
                    );
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  private buildApiMessages(conversation: ChatConversation): AnthropicMessage[] {
    const messages: AnthropicMessage[] = [];

    // If there's a summary, prepend it as context
    if (conversation.summary) {
      messages.push({
        role: 'user',
        content: `[Previous conversation summary: ${conversation.summary}]`
      });
      messages.push({
        role: 'assistant',
        content: 'I understand the context from our previous conversation. How can I help you?'
      });
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
      messages.push({ role: msg.role, content: msg.content });
    }

    return messages;
  }

  private maybeSummarize(
    conversationId: string,
    conversation: ChatConversation,
    apiKey: string,
    model: string,
    maxTokens: number
  ): Observable<void> {
    const totalMessages = conversation.messages.length;
    const unsummarized = totalMessages - conversation.summarizedMessageCount;

    // Only summarize if we have significantly more messages than the window
    if (unsummarized <= MESSAGE_WINDOW_SIZE + 5) {
      return of(undefined);
    }

    // Messages to summarize (everything outside the current window)
    const messagesToSummarize = conversation.messages.slice(
      conversation.summarizedMessageCount,
      totalMessages - MESSAGE_WINDOW_SIZE
    );

    if (messagesToSummarize.length === 0) {
      return of(undefined);
    }

    const conversationText = messagesToSummarize
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const existingSummary = conversation.summary
      ? `Previous summary: ${conversation.summary}\n\nNew messages:\n`
      : '';

    return this.anthropicApi.sendMessage(apiKey, {
      model,
      max_tokens: Math.min(maxTokens, 1024),
      messages: [{
        role: 'user',
        content: `${SUMMARIZATION_PROMPT}\n\n${existingSummary}${conversationText}`
      }]
    }).pipe(
      switchMap(response => {
        const summaryText = response.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('');

        return this.storageService.getData().pipe(
          switchMap(data => {
            if (!data) return of(undefined);

            const convIndex = data.chatConversations.findIndex(c => c.id === conversationId);
            if (convIndex === -1) return of(undefined);

            const updatedConv = { ...data.chatConversations[convIndex] };
            updatedConv.summary = summaryText;
            updatedConv.summarizedMessageCount = totalMessages - MESSAGE_WINDOW_SIZE;

            const updatedConversations = [...data.chatConversations];
            updatedConversations[convIndex] = updatedConv;

            return this.storageService.saveData({
              ...data,
              chatConversations: updatedConversations
            });
          })
        );
      })
    );
  }
}
