import { TestBed } from '@angular/core/testing';
import { Subscription, firstValueFrom, of } from 'rxjs';
import type { Message } from '@anthropic-ai/sdk/resources/messages';
import { ChatService } from './chat.service';
import { StorageService } from './storage.service';
import { AnthropicApiService } from './anthropic-api.service';
import { AISettingsService } from './ai-settings.service';
import { FitnessContextService } from './fitness-context.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';
import {
  AISettings,
  AIToolSettings,
  ChatBlock,
  ChatConversation,
  ChatMessage,
  ChatTurnEvent,
  DEFAULT_AI_TOOL_SETTINGS,
  TextBlock,
  ToolUseBlock,
} from '../models/ai-chat.model';
import { ToolRegistryService } from './tool-registry.service';
import { MemoryToolExecutor } from './memory-tool-executor.service';
import { MemoryStoreService } from './memory-store.service';
import { PendingApprovalService } from './pending-approval.service';
import { toAnthropicContent } from './chat-block-serializer';

/** Spec helper: extract joined text from a ChatMessage's blocks (D-15). */
function textOf(msg: ChatMessage): string {
  return msg.blocks
    .filter((b): b is TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
}

describe('ChatService', () => {
  let service: ChatService;
  let mockAppData: AppData;
  let mockStorageService: jasmine.SpyObj<StorageService>;
  let mockAnthropicApi: jasmine.SpyObj<AnthropicApiService>;
  let mockAISettings: jasmine.SpyObj<AISettingsService>;
  let mockFitnessContext: jasmine.SpyObj<FitnessContextService>;
  let mockToolRegistry: jasmine.SpyObj<ToolRegistryService>;

  const mockSettings: AISettings = {
    apiKey: 'sk-ant-test-key',
    selectedModel: 'claude-sonnet-4-6',
    maxResponseTokens: 4096
  };

  const mockToolSettings: AIToolSettings = { ...DEFAULT_AI_TOOL_SETTINGS };

  const mockApiResponse = {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello! I can help with your fitness goals.', citations: null }],
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 20,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    },
  } as unknown as Message;

  beforeEach(() => {
    mockAppData = createEmptyAppData();

    mockStorageService = jasmine.createSpyObj('StorageService', ['getData', 'saveData']);
    mockStorageService.getData.and.callFake(() => of(mockAppData));
    mockStorageService.saveData.and.callFake((data: AppData) => {
      mockAppData = data;
      return of(undefined);
    });

    mockAnthropicApi = jasmine.createSpyObj('AnthropicApiService', ['sendMessage', 'countTokens']);
    mockAnthropicApi.sendMessage.and.returnValue(of(mockApiResponse));
    // Under TOKEN_WINDOW_SIZE → the loop's countTokens-driven window check is a
    // no-op in these specs (window/summarize decision driven by countTokens, D-15).
    mockAnthropicApi.countTokens.and.returnValue(of(500));

    mockAISettings = jasmine.createSpyObj('AISettingsService', ['getSettings', 'getToolSettings']);
    mockAISettings.getSettings.and.returnValue(of(mockSettings));
    mockAISettings.getToolSettings.and.returnValue(of({ ...mockToolSettings }));

    mockToolRegistry = jasmine.createSpyObj('ToolRegistryService', [
      'definitions',
      'dispatch',
      'isWriteProposal',
    ]);
    mockToolRegistry.definitions.and.returnValue([
      { type: 'custom', name: 'query_weight_entries', description: 'q', input_schema: {}, strict: true },
      { type: 'memory_20250818', name: 'memory' },
    ]);
    mockToolRegistry.dispatch.and.returnValue(Promise.resolve('tool result text'));
    mockToolRegistry.isWriteProposal.and.callFake((name: string) => name === 'memory');

    mockFitnessContext = jasmine.createSpyObj('FitnessContextService', ['buildSystemPrompt']);
    // Phase 4 (04-03): buildSystemPrompt now returns a structured
    // SystemTextBlock[] (cacheable prefix + non-cached today block) rather
    // than a bare string. Plan 04 owns the loop consumer; here we just feed
    // the new shape so the transport receives a valid `system`.
    mockFitnessContext.buildSystemPrompt.and.returnValue(
      of([{ type: 'text', text: 'You are a fitness expert.', cache_control: { type: 'ephemeral' } }]),
    );

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: StorageService, useValue: mockStorageService },
        { provide: AnthropicApiService, useValue: mockAnthropicApi },
        { provide: AISettingsService, useValue: mockAISettings },
        { provide: FitnessContextService, useValue: mockFitnessContext },
        { provide: ToolRegistryService, useValue: mockToolRegistry }
      ]
    });

    service = TestBed.inject(ChatService);
  });

  describe('createConversation', () => {
    it('should create a new conversation with default title', async () => {
      const conversation = await firstValueFrom(service.createConversation());

      expect(conversation.id).toBeTruthy();
      expect(conversation.title).toContain('Chat');
      expect(conversation.messages).toEqual([]);
      expect(conversation.summarizedMessageCount).toBe(0);
      expect(mockAppData.chatConversations.length).toBe(1);
    });

    it('should create a conversation with custom title', async () => {
      const conversation = await firstValueFrom(service.createConversation('My Workout Plan'));

      expect(conversation.title).toBe('My Workout Plan');
    });
  });

  describe('getConversations', () => {
    it('should return empty array when no conversations exist', async () => {
      const conversations = await firstValueFrom(service.getConversations());
      expect(conversations).toEqual([]);
    });

    it('should return conversations sorted by updatedAt desc', async () => {
      await firstValueFrom(service.createConversation('First'));
      await firstValueFrom(service.createConversation('Second'));

      const conversations = await firstValueFrom(service.getConversations());
      expect(conversations.length).toBe(2);
      expect(new Date(conversations[0].updatedAt).getTime())
        .toBeGreaterThanOrEqual(new Date(conversations[1].updatedAt).getTime());
    });
  });

  describe('getConversation', () => {
    it('should return null for nonexistent id', async () => {
      const result = await firstValueFrom(service.getConversation('nonexistent'));
      expect(result).toBeNull();
    });

    it('should return conversation by id', async () => {
      const created = await firstValueFrom(service.createConversation('Test'));
      const found = await firstValueFrom(service.getConversation(created.id));
      expect(found?.title).toBe('Test');
    });
  });

  describe('deleteConversation', () => {
    it('should return false for nonexistent id', async () => {
      const result = await firstValueFrom(service.deleteConversation('nonexistent'));
      expect(result).toBeFalse();
    });

    it('should delete an existing conversation', async () => {
      const created = await firstValueFrom(service.createConversation('To Delete'));
      const result = await firstValueFrom(service.deleteConversation(created.id));
      expect(result).toBeTrue();
      expect(mockAppData.chatConversations.length).toBe(0);
    });
  });

  describe('sendMessage', () => {
    it('should add user and assistant messages to conversation', async () => {
      const conv = await firstValueFrom(service.createConversation('Test Chat'));
      const assistantMsg = await firstValueFrom(service.sendMessage(conv.id, 'How is my weight trend?'));

      expect(assistantMsg.role).toBe('assistant');
      expect(textOf(assistantMsg)).toBe('Hello! I can help with your fitness goals.');

      const updatedConv = mockAppData.chatConversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages.length).toBe(2);
      expect(updatedConv.messages[0].role).toBe('user');
      expect(textOf(updatedConv.messages[0])).toBe('How is my weight trend?');
      expect(updatedConv.messages[1].role).toBe('assistant');
    });

    it('should call Anthropic API with system prompt and messages', async () => {
      const conv = await firstValueFrom(service.createConversation('Test'));
      await firstValueFrom(service.sendMessage(conv.id, 'Hello'));

      expect(mockAnthropicApi.sendMessage).toHaveBeenCalled();
      const [apiKey, request] = mockAnthropicApi.sendMessage.calls.mostRecent().args;
      expect(apiKey).toBe('sk-ant-test-key');
      expect(request.system).toEqual([
        { type: 'text', text: 'You are a fitness expert.', cache_control: { type: 'ephemeral' } },
      ]);
      expect(request.model).toBe('claude-sonnet-4-6');
    });

    it('SC5: outbound request shape has no tools field', async () => {
      const conv = await firstValueFrom(service.createConversation('Test'));
      await firstValueFrom(service.sendMessage(conv.id, 'Hello'));

      const callArgs = mockAnthropicApi.sendMessage.calls.mostRecent().args[1] as unknown as Record<string, unknown>;
      expect('tools' in callArgs).toBeFalse();
      expect(callArgs['tools']).toBeUndefined();
      expect('tool_choice' in callArgs).toBeFalse();
    });

    it('outbound messages[].content is ContentBlockParam[] (serializer bridge)', async () => {
      const conv = await firstValueFrom(service.createConversation('Test'));
      await firstValueFrom(service.sendMessage(conv.id, 'Hello world'));

      const callArgs = mockAnthropicApi.sendMessage.calls.mostRecent().args[1];
      // The user message is the only message; content must be an array of
      // ContentBlockParam, NOT a plain string. This is the visible signature
      // of the chat-block-serializer integration.
      expect(Array.isArray(callArgs.messages[0].content)).toBeTrue();
      const userContent = callArgs.messages[0].content as Array<{ type: string; text?: string }>;
      expect(userContent[0].type).toBe('text');
      expect(userContent[0].text).toBe('Hello world');
    });

    it('assistant blocks length matches response text-block count via fromAnthropicMessage', async () => {
      const conv = await firstValueFrom(service.createConversation('Test'));
      const assistantMsg = await firstValueFrom(service.sendMessage(conv.id, 'Hello'));

      // Phase 3: response.content has 1 text block; assistantMsg.blocks
      // should mirror that exactly. fromAnthropicMessage round-trip lock.
      expect(assistantMsg.blocks.length).toBe(1);
      expect(assistantMsg.blocks[0].type).toBe('text');
    });

    it('assistant tokenEstimate uses response.usage.output_tokens (not heuristic)', async () => {
      const conv = await firstValueFrom(service.createConversation('Test'));
      const assistantMsg = await firstValueFrom(service.sendMessage(conv.id, 'Hello'));

      // mockApiResponse.usage.output_tokens === 20.
      expect(assistantMsg.tokenEstimate).toBe(20);
    });

    it('should error when no API key is set', async () => {
      mockAISettings.getSettings.and.returnValue(of({ maxResponseTokens: 4096 }));

      const conv = await firstValueFrom(service.createConversation('Test'));

      try {
        await firstValueFrom(service.sendMessage(conv.id, 'Hello'));
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('No API key');
      }
    });

    it('should error for nonexistent conversation', async () => {
      try {
        await firstValueFrom(service.sendMessage('nonexistent', 'Hello'));
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Conversation not found');
      }
    });

    it('should estimate tokens on messages', async () => {
      const conv = await firstValueFrom(service.createConversation('Test'));
      await firstValueFrom(service.sendMessage(conv.id, 'Hello world'));

      const updatedConv = mockAppData.chatConversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages[0].tokenEstimate).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // updateMessageBlock — Plan 03-05 Task 2
  //
  // Patches a tool_use ChatBlock in storage. Used by chat-page block-action
  // handlers to flip status='pending' → 'approved' / 'discarded' / 'edited'
  // (D-11). Type-narrows to tool_use; throws on missing nodes or wrong type.
  // ---------------------------------------------------------------------------

  describe('updateMessageBlock', () => {
    function seedConversationWithToolUse(
      overrides: Partial<ToolUseBlock> = {},
    ): { conversationId: string; messageId: string } {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 'tu-1',
        name: 'memory',
        input: { command: 'create', path: '/memories/note.md', file_text: 'X' },
        status: 'pending',
        ...overrides,
      };
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'assistant',
        blocks: [block],
        tokenEstimate: 5,
        createdAt: '2026-04-15T10:00:00.000Z',
      };
      const conv: ChatConversation = {
        id: 'conv-1',
        title: 'Test',
        messages: [message],
        summarizedMessageCount: 0,
        createdAt: '2026-04-15T10:00:00.000Z',
        updatedAt: '2026-04-15T10:00:00.000Z',
      };
      mockAppData = { ...mockAppData, chatConversations: [conv] };
      mockStorageService.getData.and.callFake(() => of(mockAppData));
      return { conversationId: conv.id, messageId: message.id };
    }

    it('patches status="approved" on the targeted tool_use block', async () => {
      const { conversationId, messageId } = seedConversationWithToolUse();

      await firstValueFrom(service.updateMessageBlock(conversationId, messageId, 0, { status: 'approved' }));

      const conv = mockAppData.chatConversations.find(c => c.id === conversationId)!;
      const block = conv.messages[0].blocks[0] as ToolUseBlock;
      expect(block.type).toBe('tool_use');
      expect(block.status).toBe('approved');
    });

    it('patches status="edited" with editedFromText', async () => {
      const { conversationId, messageId } = seedConversationWithToolUse();

      await firstValueFrom(service.updateMessageBlock(conversationId, messageId, 0, {
        status: 'edited',
        editedFromText: 'original AI text',
      }));

      const conv = mockAppData.chatConversations.find(c => c.id === conversationId)!;
      const block = conv.messages[0].blocks[0] as ToolUseBlock;
      expect(block.status).toBe('edited');
      expect(block.editedFromText).toBe('original AI text');
    });

    it('returns throwError when conversation not found', async () => {
      try {
        await firstValueFrom(service.updateMessageBlock('nope', 'msg-1', 0, { status: 'approved' }));
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Conversation not found');
      }
    });

    it('returns throwError when message not found', async () => {
      const { conversationId } = seedConversationWithToolUse();

      try {
        await firstValueFrom(service.updateMessageBlock(conversationId, 'nope', 0, { status: 'approved' }));
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Message not found');
      }
    });

    it('returns throwError when blockIndex out of range', async () => {
      const { conversationId, messageId } = seedConversationWithToolUse();

      try {
        await firstValueFrom(service.updateMessageBlock(conversationId, messageId, 7, { status: 'approved' }));
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Block index out of range');
      }
    });

    it('returns throwError when block at index is not tool_use', async () => {
      const message: ChatMessage = {
        id: 'msg-text',
        role: 'assistant',
        blocks: [{ type: 'text', text: 'Hi' } as ChatBlock],
        tokenEstimate: 1,
        createdAt: '2026-04-15T10:00:00.000Z',
      };
      const conv: ChatConversation = {
        id: 'conv-text',
        title: 'T',
        messages: [message],
        summarizedMessageCount: 0,
        createdAt: '2026-04-15T10:00:00.000Z',
        updatedAt: '2026-04-15T10:00:00.000Z',
      };
      mockAppData = { ...mockAppData, chatConversations: [conv] };
      mockStorageService.getData.and.callFake(() => of(mockAppData));

      try {
        await firstValueFrom(service.updateMessageBlock(conv.id, message.id, 0, { status: 'approved' }));
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('not tool_use');
      }
    });

    it('updates conversation.updatedAt to a fresh ISO string', async () => {
      const { conversationId, messageId } = seedConversationWithToolUse();
      const before = mockAppData.chatConversations[0].updatedAt;

      // Make sure clock advances at least 1ms
      await new Promise(r => setTimeout(r, 5));
      await firstValueFrom(service.updateMessageBlock(conversationId, messageId, 0, { status: 'approved' }));

      const conv = mockAppData.chatConversations.find(c => c.id === conversationId)!;
      expect(new Date(conv.updatedAt).getTime()).toBeGreaterThan(new Date(before).getTime());
    });
  });

  // ---------------------------------------------------------------------------
  // appendAssistantBlocks — Plan 03-05 Task 3 (used by dev-seed flow)
  //
  // Append a synthetic assistant message containing a list of ChatBlocks to
  // an existing conversation. Returns the new ChatMessage. Throws if the
  // conversation does not exist.
  // ---------------------------------------------------------------------------

  describe('appendAssistantBlocks', () => {
    async function seedConversation(): Promise<string> {
      const conv = await firstValueFrom(service.createConversation('Seeded'));
      return conv.id;
    }

    it('adds a new assistant message at the end of conversation.messages', async () => {
      const conversationId = await seedConversation();

      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 'tu-1',
        name: 'memory',
        input: { command: 'create', path: '/memories/seed.md', file_text: 'demo' },
        status: 'pending',
      };
      const newMsg = await firstValueFrom(service.appendAssistantBlocks(conversationId, [block]));

      const conv = mockAppData.chatConversations.find(c => c.id === conversationId)!;
      expect(conv.messages.length).toBe(1);
      expect(conv.messages[0].id).toBe(newMsg.id);
      expect(conv.messages[0].role).toBe('assistant');
      expect(conv.messages[0].blocks.length).toBe(1);
      expect(conv.messages[0].blocks[0].type).toBe('tool_use');
    });

    it('throws on missing conversation', async () => {
      try {
        await firstValueFrom(service.appendAssistantBlocks('nope', []));
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Conversation not found');
      }
    });

    it('updates conversation.updatedAt to a fresh ISO string', async () => {
      const conversationId = await seedConversation();
      const before = mockAppData.chatConversations[0].updatedAt;

      await new Promise(r => setTimeout(r, 5));
      const block: ToolUseBlock = {
        type: 'tool_use', id: 'tu-2', name: 'update_profile',
        input: { section: 'goals', value: 'X' }, status: 'pending',
      };
      await firstValueFrom(service.appendAssistantBlocks(conversationId, [block]));

      const conv = mockAppData.chatConversations.find(c => c.id === conversationId)!;
      expect(new Date(conv.updatedAt).getTime()).toBeGreaterThan(new Date(before).getTime());
    });
  });

  describe('approveToolUseBlock (gap-closure 03-07, SC3 — atomic approve + paired tool_result)', () => {
    function seedConv(): void {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 'tu1',
        name: 'memory',
        input: { command: 'create', path: '/memories/x.md', file_text: 'hi' },
        status: 'pending',
      };
      const message: ChatMessage = {
        id: 'm1',
        role: 'assistant',
        blocks: [block],
        tokenEstimate: 0,
        createdAt: '2026-05-31T10:00:00.000Z',
      };
      const conv: ChatConversation = {
        id: 'c1',
        title: 'Test',
        messages: [message],
        summarizedMessageCount: 0,
        createdAt: '2026-05-31T10:00:00.000Z',
        updatedAt: '2026-05-31T10:00:00.000Z',
      };
      mockAppData = { ...mockAppData, chatConversations: [conv] };
      mockStorageService.getData.and.callFake(() => of(mockAppData));
    }

    it('flips the tool_use block to approved AND appends a paired tool_result in a single saveData call', async () => {
      seedConv();
      mockStorageService.saveData.calls.reset();
      await firstValueFrom(service.approveToolUseBlock('c1', 'm1', 0, {
        content: 'File created successfully at: /memories/x.md',
        isError: false,
      }));

      expect(mockStorageService.saveData).toHaveBeenCalledTimes(1);
      const blocks = mockAppData.chatConversations[0].messages[0].blocks;
      expect((blocks[0] as ToolUseBlock).status).toBe('approved');
      const toolResult = blocks.find(b => b.type === 'tool_result') as {
        tool_use_id: string; content: string; isError?: boolean;
      };
      expect(toolResult).toBeTruthy();
      expect(toolResult.tool_use_id).toBe('tu1');
      expect(toolResult.content).toBe('File created successfully at: /memories/x.md');
      expect('isError' in toolResult).toBeFalse();
    });

    it('sets isError on the tool_result when result.isError is true', async () => {
      seedConv();
      await firstValueFrom(service.approveToolUseBlock('c1', 'm1', 0, {
        content: 'Error: File /memories/x.md already exists',
        isError: true,
      }));
      const blocks = mockAppData.chatConversations[0].messages[0].blocks;
      const toolResult = blocks.find(b => b.type === 'tool_result') as { isError?: boolean };
      expect(toolResult.isError).toBeTrue();
    });

    it('errors when the target block is not a tool_use block', async () => {
      const textMsg: ChatMessage = {
        id: 'm1', role: 'assistant',
        blocks: [{ type: 'text', text: 'not a tool' } as ChatBlock],
        tokenEstimate: 0, createdAt: '2026-05-31T10:00:00.000Z',
      };
      const conv: ChatConversation = {
        id: 'c1', title: 'T', messages: [textMsg], summarizedMessageCount: 0,
        createdAt: '2026-05-31T10:00:00.000Z', updatedAt: '2026-05-31T10:00:00.000Z',
      };
      mockAppData = { ...mockAppData, chatConversations: [conv] };
      mockStorageService.getData.and.callFake(() => of(mockAppData));
      try {
        await firstValueFrom(service.approveToolUseBlock('c1', 'm1', 0, { content: 'x', isError: false }));
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('is not tool_use');
      }
    });

    it('errors when the conversation is not found', async () => {
      seedConv();
      try {
        await firstValueFrom(service.approveToolUseBlock('nope', 'm1', 0, { content: 'x', isError: false }));
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Conversation not found');
      }
    });
  });

  describe('approve end-to-end (gap-closure 03-07) — persists to memoryFiles AND yields API-valid transcript', () => {
    let chatService: ChatService;
    let pendingApproval: PendingApprovalService;
    let endToEndData: AppData;
    const SEED_TEXT = 'seed body content';

    const seededToolBlock = (): ToolUseBlock => ({
      type: 'tool_use',
      id: 'tu1',
      name: 'memory',
      input: { command: 'create', path: '/memories/seed-1.md', file_text: SEED_TEXT },
      status: 'pending',
    });

    beforeEach(() => {
      const toolMsg: ChatMessage = {
        id: 'm1', role: 'assistant', blocks: [seededToolBlock()],
        tokenEstimate: 0, createdAt: '2026-05-31T10:00:00.000Z',
      };
      const conv: ChatConversation = {
        id: 'c1', title: 'T', messages: [toolMsg], summarizedMessageCount: 0,
        createdAt: '2026-05-31T10:00:00.000Z', updatedAt: '2026-05-31T10:00:00.000Z',
      };
      endToEndData = { ...createEmptyAppData(), chatConversations: [conv] };

      const storage = jasmine.createSpyObj<StorageService>('StorageService', ['getData', 'saveData']);
      storage.getData.and.callFake(() => of(endToEndData));
      storage.saveData.and.callFake((data: AppData) => {
        endToEndData = data;
        return of(undefined);
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ChatService,
          PendingApprovalService,
          ToolRegistryService,
          MemoryToolExecutor,
          MemoryStoreService,
          { provide: StorageService, useValue: storage },
        ],
      });
      chatService = TestBed.inject(ChatService);
      pendingApproval = TestBed.inject(PendingApprovalService);
    });

    it('approving a seeded memory pill writes the file to AppData.memoryFiles', async () => {
      const result = await pendingApproval.executeApprovedToolUse(seededToolBlock());
      expect(result.isError).toBeFalse();
      await firstValueFrom(chatService.approveToolUseBlock('c1', 'm1', 0, result));
      expect(endToEndData.memoryFiles['/memories/seed-1.md']).toBe(SEED_TEXT);
    });

    it('post-approve transcript serializes to API-valid content (every wire tool_use has a following paired tool_result)', async () => {
      const result = await pendingApproval.executeApprovedToolUse(seededToolBlock());
      await firstValueFrom(chatService.approveToolUseBlock('c1', 'm1', 0, result));

      const blocks = endToEndData.chatConversations[0].messages[0].blocks;
      const wire = toAnthropicContent(blocks);
      const toolResultIds = new Set(
        wire.filter(b => b.type === 'tool_result').map(b => (b as { tool_use_id: string }).tool_use_id),
      );
      const toolUses = wire.filter(b => b.type === 'tool_use');
      expect(toolUses.length).toBeGreaterThan(0);
      for (const tu of toolUses) {
        expect(toolResultIds.has((tu as { id: string }).id)).toBeTrue();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // buildApiMessages tool_result placement — SC3 follow-up.
  //
  // Plan 03-07 co-locates a tool_result block inside the SAME assistant
  // ChatMessage that holds its tool_use (so the serializer's same-message
  // pairing guard works). But Anthropic rejects tool_result blocks inside
  // assistant turns with: "messages.N: tool_result blocks can only be in user
  // messages". buildApiMessages must move tool_result blocks to a user turn on
  // the wire (and coalesce adjacent same-role turns) without touching storage.
  // ---------------------------------------------------------------------------

  describe('buildApiMessages tool_result placement (SC3 follow-up — Anthropic 400: tool_result only in user turns)', () => {
    function seedConvWithPairedToolResult(): string {
      const toolUse: ToolUseBlock = {
        type: 'tool_use',
        id: 'tu1',
        name: 'memory',
        input: { command: 'create', path: '/memories/x.md', file_text: 'hi' },
        status: 'approved',
      };
      const toolResult = {
        type: 'tool_result',
        tool_use_id: 'tu1',
        content: 'File created successfully at: /memories/x.md',
      } as ChatBlock;
      const assistantMsg: ChatMessage = {
        id: 'm1',
        role: 'assistant',
        blocks: [toolUse, toolResult],
        tokenEstimate: 5,
        createdAt: '2026-05-31T10:00:00.000Z',
      };
      const conv: ChatConversation = {
        id: 'c1',
        title: 'Test',
        messages: [assistantMsg],
        summarizedMessageCount: 0,
        createdAt: '2026-05-31T10:00:00.000Z',
        updatedAt: '2026-05-31T10:00:00.000Z',
      };
      mockAppData = { ...mockAppData, chatConversations: [conv] };
      mockStorageService.getData.and.callFake(() => of(mockAppData));
      return conv.id;
    }

    type WireMsg = { role: string; content: Array<{ type: string; id?: string; tool_use_id?: string }> };

    async function outboundMessages(): Promise<WireMsg[]> {
      const convId = seedConvWithPairedToolResult();
      await firstValueFrom(service.sendMessage(convId, 'next message'));
      return mockAnthropicApi.sendMessage.calls.mostRecent().args[1].messages as unknown as WireMsg[];
    }

    it('no assistant message contains a tool_result block', async () => {
      const messages = await outboundMessages();
      const assistantWithToolResult = messages.some(
        m => m.role === 'assistant' && m.content.some(b => b.type === 'tool_result'),
      );
      expect(assistantWithToolResult).toBeFalse();
    });

    it('the tool_result (tu1) appears in a user message', async () => {
      const messages = await outboundMessages();
      const userWithToolResult = messages.some(
        m => m.role === 'user' &&
          m.content.some(b => b.type === 'tool_result' && b.tool_use_id === 'tu1'),
      );
      expect(userWithToolResult).toBeTrue();
    });

    it('the matching tool_use (tu1) still appears in an assistant message', async () => {
      const messages = await outboundMessages();
      const assistantWithToolUse = messages.some(
        m => m.role === 'assistant' &&
          m.content.some(b => b.type === 'tool_use' && b.id === 'tu1'),
      );
      expect(assistantWithToolUse).toBeTrue();
    });

    it('no two adjacent outbound messages share the same role (alternation holds after coalescing)', async () => {
      const messages = await outboundMessages();
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].role).not.toBe(messages[i - 1].role);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // runAgenticLoop — Plan 04-04 Task 1 (E2: the bounded agentic loop)
  //
  // A multi-emit Observable<ChatTurnEvent> running while(stop_reason ===
  // 'tool_use'), bounded by maxAgentTurns. Drives a MOCKED AnthropicApiService
  // through every StopReason branch (D-16), the cap (D-04), a write proposal
  // (D-03 — never blocks), and teardown (cancelled seam). tool_result blocks
  // always serialize into a USER turn (commit 49e275b regression).
  // ---------------------------------------------------------------------------

  describe('runAgenticLoop (E2 — bounded agentic loop, every stop_reason)', () => {
    const CONV_ID = 'loop-conv';

    /** Seed an empty conversation with a single user message already persisted. */
    function seedLoopConversation(): void {
      const userMsg: ChatMessage = {
        id: 'u1',
        role: 'user',
        blocks: [{ type: 'text', text: 'How is my weight trend?' }],
        tokenEstimate: 6,
        createdAt: '2026-05-31T10:00:00.000Z',
      };
      const conv: ChatConversation = {
        id: CONV_ID,
        title: 'Loop',
        messages: [userMsg],
        summarizedMessageCount: 0,
        createdAt: '2026-05-31T10:00:00.000Z',
        updatedAt: '2026-05-31T10:00:00.000Z',
      };
      mockAppData = { ...mockAppData, chatConversations: [conv] };
      mockStorageService.getData.and.callFake(() => of(mockAppData));
    }

    /** Build a Message with the given stop_reason and content blocks. */
    function message(
      stopReason: string,
      content: Array<Record<string, unknown>>,
    ): Message {
      return {
        id: `msg_${stopReason}`,
        type: 'message',
        role: 'assistant',
        content,
        model: 'claude-sonnet-4-6',
        stop_reason: stopReason,
        stop_sequence: null,
        usage: {
          input_tokens: 50,
          output_tokens: 10,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
        },
      } as unknown as Message;
    }

    const textBlock = (text: string) => ({ type: 'text', text, citations: null });
    const toolUseBlock = (id: string, name: string, input: unknown) => ({
      type: 'tool_use', id, name, input,
    });

    /** Collect every emitted ChatTurnEvent to completion. */
    function collect(): Promise<ChatTurnEvent[]> {
      return new Promise<ChatTurnEvent[]>((resolve, reject) => {
        const events: ChatTurnEvent[] = [];
        service.runAgenticLoop(CONV_ID, 'sk-ant-test-key').subscribe({
          next: e => events.push(e),
          error: reject,
          complete: () => resolve(events),
        });
      });
    }

    beforeEach(() => seedLoopConversation());

    it('end_turn → emits assistant_text then done(end_turn) and completes', async () => {
      mockAnthropicApi.sendMessage.and.returnValue(
        of(message('end_turn', [textBlock('Your weight is trending down.')])),
      );

      const events = await collect();

      expect(events.some(e => e.kind === 'assistant_text')).toBeTrue();
      const done = events.find(e => e.kind === 'done') as { kind: 'done'; stopReason: string };
      expect(done.stopReason).toBe('end_turn');
      expect(mockAnthropicApi.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('stop_sequence → completes with done(stop_sequence)', async () => {
      mockAnthropicApi.sendMessage.and.returnValue(
        of(message('stop_sequence', [textBlock('Done.')])),
      );
      const events = await collect();
      const done = events.find(e => e.kind === 'done') as { kind: 'done'; stopReason: string };
      expect(done.stopReason).toBe('stop_sequence');
    });

    it('max_tokens → completes with done(max_tokens) (truncation surfaced)', async () => {
      mockAnthropicApi.sendMessage.and.returnValue(
        of(message('max_tokens', [textBlock('Truncated…')])),
      );
      const events = await collect();
      const done = events.find(e => e.kind === 'done') as { kind: 'done'; stopReason: string };
      expect(done.stopReason).toBe('max_tokens');
    });

    it('refusal → completes with done(refusal), no retry', async () => {
      mockAnthropicApi.sendMessage.and.returnValue(
        of(message('refusal', [textBlock("I can't help with that.")])),
      );
      const events = await collect();
      const done = events.find(e => e.kind === 'done') as { kind: 'done'; stopReason: string };
      expect(done.stopReason).toBe('refusal');
      expect(mockAnthropicApi.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('pause_turn → re-sends the SAME messages unmodified, does NOT net-decrement the cap', async () => {
      let call = 0;
      const sentMessages: unknown[] = [];
      mockAnthropicApi.sendMessage.and.callFake((_key, params) => {
        sentMessages.push(JSON.parse(JSON.stringify(params.messages)));
        call++;
        if (call === 1) return of(message('pause_turn', [textBlock('thinking…')]));
        return of(message('end_turn', [textBlock('Resolved.')]));
      });

      const events = await collect();

      // Two sends: the paused one + the resumed one.
      expect(mockAnthropicApi.sendMessage).toHaveBeenCalledTimes(2);
      // Resume re-sends the conversation INCLUDING the paused assistant turn,
      // unmodified — i.e. the prior messages plus exactly the one paused
      // assistant turn, with NO fabricated tool_result inserted between them.
      const first = sentMessages[0] as Array<{ role: string }>;
      const second = sentMessages[1] as Array<{ role: string; content: Array<{ type: string }> }>;
      expect(second.length).toBe(first.length + 1);
      // The only added turn is the paused assistant turn (no user tool_result).
      const added = second[second.length - 1];
      expect(added.role).toBe('assistant');
      const noToolResultInjected = second.every(
        m => !(m.role === 'user' && m.content.some(b => b.type === 'tool_result')),
      );
      expect(noToolResultInjected).toBeTrue();
      const done = events.find(e => e.kind === 'done') as { kind: 'done'; stopReason: string };
      expect(done.stopReason).toBe('end_turn');
    });

    it('tool_use (query_*) → dispatches, appends tool_result in a USER turn, re-calls', async () => {
      let call = 0;
      let secondTurnMessages: Array<{ role: string; content: Array<{ type: string; tool_use_id?: string }> }> = [];
      mockAnthropicApi.sendMessage.and.callFake((_key, params) => {
        call++;
        if (call === 1) {
          return of(message('tool_use', [toolUseBlock('tu-q1', 'query_weight_entries', { from: '2026-01-01' })]));
        }
        secondTurnMessages = JSON.parse(JSON.stringify(params.messages)) as typeof secondTurnMessages;
        return of(message('end_turn', [textBlock('Based on your data, trending down.')]));
      });

      const events = await collect();

      // dispatch was invoked for the read-only query tool
      expect(mockToolRegistry.dispatch).toHaveBeenCalledWith('query_weight_entries', { from: '2026-01-01' });
      // tool_use_started + tool_result events emitted
      expect(events.some(e => e.kind === 'tool_use_started')).toBeTrue();
      expect(events.some(e => e.kind === 'tool_result')).toBeTrue();
      // The tool_result block was sent back in a USER turn (49e275b regression)
      const userWithToolResult = secondTurnMessages.some(
        m => m.role === 'user' && m.content.some(b => b.type === 'tool_result' && b.tool_use_id === 'tu-q1'),
      );
      expect(userWithToolResult).toBeTrue();
      const noAssistantToolResult = secondTurnMessages.every(
        m => !(m.role === 'assistant' && m.content.some(b => b.type === 'tool_result')),
      );
      expect(noAssistantToolResult).toBeTrue();
      expect(mockAnthropicApi.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('auto-executed query tool_use persists as status="approved" paired with its tool_result (serializer replays a real wire tool_use)', async () => {
      let call = 0;
      mockAnthropicApi.sendMessage.and.callFake(() => {
        call++;
        if (call === 1) {
          return of(message('tool_use', [toolUseBlock('tu-q2', 'query_weight_entries', { from: '2026-01-01' })]));
        }
        return of(message('end_turn', [textBlock('answer')]));
      });

      await collect();

      // Find the persisted assistant message carrying the tool_use.
      const conv = mockAppData.chatConversations.find(c => c.id === CONV_ID)!;
      const toolMsg = conv.messages.find(m =>
        m.blocks.some(b => b.type === 'tool_use' && (b as ToolUseBlock).id === 'tu-q2'),
      )!;
      expect(toolMsg).toBeTruthy();
      const tu = toolMsg.blocks.find(b => b.type === 'tool_use') as ToolUseBlock;
      expect(tu.status).toBe('approved');
      // The paired tool_result is co-located so the serializer emits a real wire tool_use.
      const wire = toAnthropicContent(toolMsg.blocks);
      const wireToolUse = wire.find(b => b.type === 'tool_use') as { id: string } | undefined;
      const wireResultIds = new Set(
        wire.filter(b => b.type === 'tool_result').map(b => (b as { tool_use_id: string }).tool_use_id),
      );
      expect(wireToolUse).toBeTruthy();
      expect(wireResultIds.has('tu-q2')).toBeTrue();
    });

    it('dispatch throw → feeds an is_error tool_result and the loop recovers (CHAT-11)', async () => {
      mockToolRegistry.dispatch.and.returnValue(Promise.reject(new Error('range too wide')));
      let call = 0;
      let secondTurnMessages: Array<{ role: string; content: Array<{ type: string; is_error?: boolean }> }> = [];
      mockAnthropicApi.sendMessage.and.callFake((_key, params) => {
        call++;
        if (call === 1) {
          return of(message('tool_use', [toolUseBlock('tu-e', 'query_weight_entries', { from: 'x' })]));
        }
        secondTurnMessages = JSON.parse(JSON.stringify(params.messages)) as typeof secondTurnMessages;
        return of(message('end_turn', [textBlock('recovered')]));
      });

      const events = await collect();

      const errResult = secondTurnMessages
        .flatMap(m => m.content)
        .find(b => b.type === 'tool_result' && b.is_error === true);
      expect(errResult).toBeTruthy();
      const done = events.find(e => e.kind === 'done') as { kind: 'done'; stopReason: string };
      expect(done.stopReason).toBe('end_turn');
    });

    it('write proposal (memory) mid-loop → surfaces a pending pill, feeds a synthetic tool_result, loop does NOT block', async () => {
      let call = 0;
      let secondTurnMessages: Array<{ role: string; content: Array<{ type: string; content?: string }> }> = [];
      mockAnthropicApi.sendMessage.and.callFake((_key, params) => {
        call++;
        if (call === 1) {
          return of(message('tool_use', [
            toolUseBlock('tu-w', 'memory', { command: 'create', path: '/memories/x.md', file_text: 'noted' }),
          ]));
        }
        secondTurnMessages = JSON.parse(JSON.stringify(params.messages)) as typeof secondTurnMessages;
        return of(message('end_turn', [textBlock('continued without persisting')]));
      });

      const events = await collect();

      // The write proposal was NOT auto-executed (no dispatch for 'memory').
      expect(mockToolRegistry.dispatch).not.toHaveBeenCalledWith('memory', jasmine.anything());
      // A synthetic 'not yet persisted' tool_result was fed for the proposal.
      const synthetic = secondTurnMessages
        .flatMap(m => m.content)
        .find(b => b.type === 'tool_result' && (b.content ?? '').includes('NOT yet persisted'));
      expect(synthetic).toBeTruthy();
      // The pending pill was persisted (status='pending') on the conversation.
      const conv = mockAppData.chatConversations.find(c => c.id === CONV_ID)!;
      const pending = conv.messages.flatMap(m => m.blocks).find(
        b => b.type === 'tool_use' && (b as ToolUseBlock).name === 'memory' && (b as ToolUseBlock).status === 'pending',
      );
      expect(pending).toBeTruthy();
      // The loop finished cleanly (did not block).
      const done = events.find(e => e.kind === 'done') as { kind: 'done'; stopReason: string };
      expect(done.stopReason).toBe('end_turn');
    });

    it('maxAgentTurns reached → emits turn_limit and makes ONE final create WITHOUT tools (D-04)', async () => {
      mockAISettings.getToolSettings.and.returnValue(of({ ...mockToolSettings, maxAgentTurns: 2 }));
      // Every turn returns tool_use → the cap is hit.
      mockAnthropicApi.sendMessage.and.callFake(() =>
        of(message('tool_use', [toolUseBlock(`tu-${Math.random()}`, 'query_weight_entries', { from: '2026' })])),
      );

      const events = await collect();

      expect(events.some(e => e.kind === 'turn_limit')).toBeTrue();
      // 2 in-loop turns + 1 final best-effort create.
      expect(mockAnthropicApi.sendMessage).toHaveBeenCalledTimes(3);
      const finalArgs = mockAnthropicApi.sendMessage.calls.mostRecent().args[1] as unknown as Record<string, unknown>;
      expect('tools' in finalArgs).toBeFalse();
      expect(finalArgs['tools']).toBeUndefined();
    });

    it('unsubscribe sets cancelled → the loop stops re-calling the mock', async () => {
      // Every turn returns tool_use, so an un-cancelled loop would call
      // sendMessage many times. We unsubscribe immediately and assert the
      // count stays bounded (the cancelled flag breaks the for-loop).
      mockAnthropicApi.sendMessage.and.callFake(() =>
        of(message('tool_use', [toolUseBlock(`tu-${Math.random()}`, 'query_weight_entries', { from: '2026' })])),
      );

      const sub: Subscription = service.runAgenticLoop(CONV_ID, 'sk-ant-test-key').subscribe();
      sub.unsubscribe();

      // Let pending microtasks/timers flush.
      await new Promise(r => setTimeout(r, 30));
      // A runaway loop (cap 10) would reach ~10 calls; cancellation keeps it tiny.
      expect(mockAnthropicApi.sendMessage.calls.count()).toBeLessThan(3);
    });

    it('SDK error → routes to the RxJS error channel', async () => {
      mockAnthropicApi.sendMessage.and.callFake(() => {
        throw new Error('boom');
      });

      await expectAsync(collect()).toBeRejectedWithError('boom');
    });
  });
});
