import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { generateId } from '../shared/id';
import { StorageService } from './storage.service';
import { AnthropicApiService } from './anthropic-api.service';
import { AISettingsService } from './ai-settings.service';
import { FitnessContextService } from './fitness-context.service';
import { toAnthropicContent, fromAnthropicMessage } from './chat-block-serializer';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import {
  ChatBlock,
  ChatConversation,
  ChatMessage,
  CLAUDE_MODELS,
  DEFAULT_AI_SETTINGS,
  TextBlock,
  ToolUseBlock,
} from '../models/ai-chat.model';
import { AppData } from '../models/app-data.model';

const MESSAGE_WINDOW_SIZE = 20;
const TOKEN_WINDOW_SIZE = 8000;
const SUMMARIZATION_PROMPT = 'Summarize this conversation preserving key facts, goals, decisions, and specific numbers. Keep under 200 words.';

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
      id: generateId(),
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
      id: generateId(),
      role: 'user',
      blocks: [{ type: 'text', text: userMessageText }],
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
                const assistantBlocks = fromAnthropicMessage(response);

                const assistantMessage: ChatMessage = {
                  id: generateId(),
                  role: 'assistant',
                  blocks: assistantBlocks,
                  // Accurate token count from the SDK (replaces estimateTokens
                  // heuristic for assistant messages — CONCERNS.md drift item).
                  tokenEstimate: response.usage.output_tokens,
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

  /**
   * Patch a single tool_use ChatBlock inside a conversation/message. Used
   * by chat-page block-action handlers to flip pending → approved /
   * discarded / edited (Plan 03-05 Task 2; D-11). Type-narrows to
   * tool_use; throws if any node along the path is missing or the block
   * at the given index is not a tool_use block.
   */
  updateMessageBlock(
    conversationId: string,
    messageId: string,
    blockIndex: number,
    patch: Partial<ToolUseBlock>,
  ): Observable<void> {
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));

        const convIdx = data.chatConversations.findIndex(c => c.id === conversationId);
        if (convIdx === -1) return throwError(() => new Error(`Conversation not found: ${conversationId}`));

        const conv = data.chatConversations[convIdx];
        const msgIdx = conv.messages.findIndex(m => m.id === messageId);
        if (msgIdx === -1) return throwError(() => new Error(`Message not found: ${messageId}`));

        const msg = conv.messages[msgIdx];
        if (blockIndex < 0 || blockIndex >= msg.blocks.length) {
          return throwError(() => new Error(`Block index out of range: ${blockIndex}`));
        }

        const block = msg.blocks[blockIndex];
        if (block.type !== 'tool_use') {
          return throwError(() => new Error(`Block at index ${blockIndex} is not tool_use (got: ${block.type})`));
        }

        const updatedBlock: ToolUseBlock = { ...block, ...patch };
        const updatedBlocks = [
          ...msg.blocks.slice(0, blockIndex),
          updatedBlock,
          ...msg.blocks.slice(blockIndex + 1),
        ];
        const updatedMsg: ChatMessage = { ...msg, blocks: updatedBlocks };
        const updatedConv: ChatConversation = {
          ...conv,
          messages: [
            ...conv.messages.slice(0, msgIdx),
            updatedMsg,
            ...conv.messages.slice(msgIdx + 1),
          ],
          updatedAt: new Date().toISOString(),
        };
        const updatedData: AppData = {
          ...data,
          chatConversations: [
            ...data.chatConversations.slice(0, convIdx),
            updatedConv,
            ...data.chatConversations.slice(convIdx + 1),
          ],
        };
        return this.storageService.saveData(updatedData);
      }),
    );
  }

  /**
   * Append a synthetic assistant message containing the supplied blocks
   * to an existing conversation. Used by the chat-page dev-seed reader
   * (Plan 03-05 Task 3; D-12). Returns the new ChatMessage so callers can
   * reference its id (e.g., to dispatch follow-up block-action events).
   */
  appendAssistantBlocks(
    conversationId: string,
    blocks: ChatBlock[],
  ): Observable<ChatMessage> {
    const newMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      blocks,
      tokenEstimate: 0,
      createdAt: new Date().toISOString(),
    };
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));

        const idx = data.chatConversations.findIndex(c => c.id === conversationId);
        if (idx === -1) return throwError(() => new Error(`Conversation not found: ${conversationId}`));

        const conv = data.chatConversations[idx];
        const updatedConv: ChatConversation = {
          ...conv,
          messages: [...conv.messages, newMessage],
          updatedAt: new Date().toISOString(),
        };
        const updatedData: AppData = {
          ...data,
          chatConversations: [
            ...data.chatConversations.slice(0, idx),
            updatedConv,
            ...data.chatConversations.slice(idx + 1),
          ],
        };
        return this.storageService.saveData(updatedData).pipe(map(() => newMessage));
      }),
    );
  }

  private buildApiMessages(conversation: ChatConversation): MessageParam[] {
    const messages: MessageParam[] = [];

    // If there's a summary, prepend it as context
    if (conversation.summary) {
      messages.push({
        role: 'user',
        content: [{ type: 'text', text: `[Previous conversation summary: ${conversation.summary}]` }]
      });
      messages.push({
        role: 'assistant',
        content: [{ type: 'text', text: 'I understand the context from our previous conversation. How can I help you?' }]
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
      messages.push({ role: msg.role, content: toAnthropicContent(msg.blocks) });
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
      .map(m => `${m.role}: ${m.blocks.filter((b): b is TextBlock => b.type === 'text').map(b => b.text).join('')}`)
      .join('\n');

    const existingSummary = conversation.summary
      ? `Previous summary: ${conversation.summary}\n\nNew messages:\n`
      : '';

    return this.anthropicApi.sendMessage(apiKey, {
      model,
      max_tokens: Math.min(maxTokens, 1024),
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: `${SUMMARIZATION_PROMPT}\n\n${existingSummary}${conversationText}` }]
      }]
    }).pipe(
      switchMap(response => {
        const summaryText = fromAnthropicMessage(response)
          .filter((b): b is TextBlock => b.type === 'text')
          .map(b => b.text)
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
