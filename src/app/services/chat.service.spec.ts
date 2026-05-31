import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import type { Message } from '@anthropic-ai/sdk/resources/messages';
import { ChatService } from './chat.service';
import { StorageService } from './storage.service';
import { AnthropicApiService } from './anthropic-api.service';
import { AISettingsService } from './ai-settings.service';
import { FitnessContextService } from './fitness-context.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';
import {
  AISettings,
  ChatBlock,
  ChatConversation,
  ChatMessage,
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

  const mockSettings: AISettings = {
    apiKey: 'sk-ant-test-key',
    selectedModel: 'claude-sonnet-4-6',
    maxResponseTokens: 4096
  };

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

    mockAnthropicApi = jasmine.createSpyObj('AnthropicApiService', ['sendMessage']);
    mockAnthropicApi.sendMessage.and.returnValue(of(mockApiResponse));

    mockAISettings = jasmine.createSpyObj('AISettingsService', ['getSettings']);
    mockAISettings.getSettings.and.returnValue(of(mockSettings));

    mockFitnessContext = jasmine.createSpyObj('FitnessContextService', ['buildSystemPrompt']);
    mockFitnessContext.buildSystemPrompt.and.returnValue(of('You are a fitness expert.'));

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: StorageService, useValue: mockStorageService },
        { provide: AnthropicApiService, useValue: mockAnthropicApi },
        { provide: AISettingsService, useValue: mockAISettings },
        { provide: FitnessContextService, useValue: mockFitnessContext }
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
      expect(request.system).toBe('You are a fitness expert.');
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
});
