import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ChatService } from './chat.service';
import { StorageService } from './storage.service';
import { AnthropicApiService, AnthropicResponse } from './anthropic-api.service';
import { AISettingsService } from './ai-settings.service';
import { FitnessContextService } from './fitness-context.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';
import { AISettings } from '../models/ai-chat.model';

describe('ChatService', () => {
  let service: ChatService;
  let mockAppData: AppData;
  let mockStorageService: jasmine.SpyObj<StorageService>;
  let mockAnthropicApi: jasmine.SpyObj<AnthropicApiService>;
  let mockAISettings: jasmine.SpyObj<AISettingsService>;
  let mockFitnessContext: jasmine.SpyObj<FitnessContextService>;

  const mockSettings: AISettings = {
    apiKey: 'sk-ant-test-key',
    selectedModel: 'claude-sonnet-4-5-20250929',
    maxResponseTokens: 4096
  };

  const mockApiResponse: AnthropicResponse = {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello! I can help with your fitness goals.' }],
    model: 'claude-sonnet-4-5-20250929',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 20 }
  };

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
      expect(assistantMsg.content).toBe('Hello! I can help with your fitness goals.');

      const updatedConv = mockAppData.chatConversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages.length).toBe(2);
      expect(updatedConv.messages[0].role).toBe('user');
      expect(updatedConv.messages[0].content).toBe('How is my weight trend?');
      expect(updatedConv.messages[1].role).toBe('assistant');
    });

    it('should call Anthropic API with system prompt and messages', async () => {
      const conv = await firstValueFrom(service.createConversation('Test'));
      await firstValueFrom(service.sendMessage(conv.id, 'Hello'));

      expect(mockAnthropicApi.sendMessage).toHaveBeenCalled();
      const [apiKey, request] = mockAnthropicApi.sendMessage.calls.mostRecent().args;
      expect(apiKey).toBe('sk-ant-test-key');
      expect(request.system).toBe('You are a fitness expert.');
      expect(request.model).toBe('claude-sonnet-4-5-20250929');
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
});
