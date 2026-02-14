import { Injectable } from '@angular/core';
import { Observable, map, switchMap, throwError } from 'rxjs';
import { StorageService } from './storage.service';
import { AISettings, CLAUDE_MODELS, DEFAULT_AI_SETTINGS } from '../models/ai-chat.model';

@Injectable({
  providedIn: 'root'
})
export class AISettingsService {
  constructor(private storageService: StorageService) {}

  getSettings(): Observable<AISettings> {
    return this.storageService.getData().pipe(
      map(data => data?.aiSettings ?? { ...DEFAULT_AI_SETTINGS })
    );
  }

  saveSettings(settings: AISettings): Observable<void> {
    const errors = this.validate(settings);
    if (errors.length > 0) {
      return throwError(() => new Error(errors.join('; ')));
    }

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }
        return this.storageService.saveData({
          ...data,
          aiSettings: settings
        });
      })
    );
  }

  hasValidApiKey(): Observable<boolean> {
    return this.getSettings().pipe(
      map(settings => !!settings.apiKey && settings.apiKey.startsWith('sk-ant-'))
    );
  }

  clearApiKey(): Observable<void> {
    return this.getSettings().pipe(
      switchMap(settings => this.saveSettings({ ...settings, apiKey: undefined }))
    );
  }

  private validate(settings: AISettings): string[] {
    const errors: string[] = [];

    if (settings.apiKey && !settings.apiKey.startsWith('sk-ant-')) {
      errors.push('API key must start with "sk-ant-"');
    }

    if (settings.selectedModel &&
        !CLAUDE_MODELS.some(m => m.value === settings.selectedModel)) {
      errors.push('Invalid model selected');
    }

    if (settings.maxResponseTokens < 1 || settings.maxResponseTokens > 32768) {
      errors.push('Max response tokens must be between 1 and 32768');
    }

    return errors;
  }
}
