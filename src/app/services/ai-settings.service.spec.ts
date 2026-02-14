import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AISettingsService } from './ai-settings.service';
import { StorageService } from './storage.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';
import { AISettings, DEFAULT_AI_SETTINGS } from '../models/ai-chat.model';

describe('AISettingsService', () => {
  let service: AISettingsService;
  let mockAppData: AppData;
  let mockStorageService: jasmine.SpyObj<StorageService>;

  beforeEach(() => {
    mockAppData = createEmptyAppData();

    mockStorageService = jasmine.createSpyObj('StorageService', ['getData', 'saveData']);
    mockStorageService.getData.and.callFake(() => of(mockAppData));
    mockStorageService.saveData.and.callFake((data: AppData) => {
      mockAppData = data;
      return of(undefined);
    });

    TestBed.configureTestingModule({
      providers: [
        AISettingsService,
        { provide: StorageService, useValue: mockStorageService }
      ]
    });

    service = TestBed.inject(AISettingsService);
  });

  describe('getSettings', () => {
    it('should return default settings when none are saved', async () => {
      const settings = await firstValueFrom(service.getSettings());
      expect(settings.maxResponseTokens).toBe(DEFAULT_AI_SETTINGS.maxResponseTokens);
      expect(settings.apiKey).toBeUndefined();
      expect(settings.selectedModel).toBeUndefined();
    });

    it('should return saved settings', async () => {
      mockAppData.aiSettings = {
        apiKey: 'sk-ant-test123',
        selectedModel: 'claude-sonnet-4-5-20250929',
        maxResponseTokens: 2048
      };

      const settings = await firstValueFrom(service.getSettings());
      expect(settings.apiKey).toBe('sk-ant-test123');
      expect(settings.selectedModel).toBe('claude-sonnet-4-5-20250929');
      expect(settings.maxResponseTokens).toBe(2048);
    });
  });

  describe('saveSettings', () => {
    it('should persist valid settings', async () => {
      const settings: AISettings = {
        apiKey: 'sk-ant-valid-key',
        selectedModel: 'claude-sonnet-4-5-20250929',
        maxResponseTokens: 4096
      };

      await firstValueFrom(service.saveSettings(settings));
      expect(mockStorageService.saveData).toHaveBeenCalled();
      expect(mockAppData.aiSettings?.apiKey).toBe('sk-ant-valid-key');
    });

    it('should reject invalid API key format', async () => {
      const settings: AISettings = {
        apiKey: 'invalid-key',
        maxResponseTokens: 4096
      };

      try {
        await firstValueFrom(service.saveSettings(settings));
        fail('Should have thrown an error');
      } catch (e) {
        expect((e as Error).message).toContain('sk-ant-');
      }
    });

    it('should reject invalid model', async () => {
      const settings: AISettings = {
        selectedModel: 'nonexistent-model',
        maxResponseTokens: 4096
      };

      try {
        await firstValueFrom(service.saveSettings(settings));
        fail('Should have thrown an error');
      } catch (e) {
        expect((e as Error).message).toContain('Invalid model');
      }
    });

    it('should allow saving without API key', async () => {
      const settings: AISettings = {
        selectedModel: 'claude-sonnet-4-5-20250929',
        maxResponseTokens: 4096
      };

      await firstValueFrom(service.saveSettings(settings));
      expect(mockAppData.aiSettings?.apiKey).toBeUndefined();
    });
  });

  describe('hasValidApiKey', () => {
    it('should return false when no key is set', async () => {
      const result = await firstValueFrom(service.hasValidApiKey());
      expect(result).toBeFalse();
    });

    it('should return true when valid key is set', async () => {
      mockAppData.aiSettings = {
        apiKey: 'sk-ant-valid-key',
        maxResponseTokens: 4096
      };

      const result = await firstValueFrom(service.hasValidApiKey());
      expect(result).toBeTrue();
    });
  });

  describe('clearApiKey', () => {
    it('should remove the API key', async () => {
      mockAppData.aiSettings = {
        apiKey: 'sk-ant-valid-key',
        selectedModel: 'claude-sonnet-4-5-20250929',
        maxResponseTokens: 4096
      };

      await firstValueFrom(service.clearApiKey());
      expect(mockAppData.aiSettings?.apiKey).toBeUndefined();
      expect(mockAppData.aiSettings?.selectedModel).toBe('claude-sonnet-4-5-20250929');
    });
  });
});
