import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AISettingsService } from '../../services/ai-settings.service';
import { StorageService } from '../../services/storage.service';
import { AISettings, CLAUDE_MODELS } from '../../models/ai-chat.model';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <h1>Settings</h1>

      <form [formGroup]="settingsForm" (ngSubmit)="onSave()" class="settings-form" aria-label="AI settings form">
        <section class="settings-section">
          <h2>AI Assistant</h2>
          <p class="info-note">Your API key is stored locally in your browser only. It is never sent to any server other than Anthropic's API.</p>

          <div class="form-group">
            <label for="apiKey">Anthropic API Key</label>
            <div class="password-input">
              <input
                [type]="showKey ? 'text' : 'password'"
                id="apiKey"
                formControlName="apiKey"
                placeholder="sk-ant-..."
                aria-label="Anthropic API key"
                autocomplete="off"
              >
              <button type="button" class="toggle-visibility" (click)="showKey = !showKey" aria-label="Toggle API key visibility">
                {{ showKey ? 'Hide' : 'Show' }}
              </button>
            </div>
            @if (settingsForm.get('apiKey')?.errors?.['pattern'] && settingsForm.get('apiKey')?.touched) {
              <span class="error-message">API key must start with "sk-ant-"</span>
            }
          </div>

          <div class="form-group">
            <label for="selectedModel">Model</label>
            <select id="selectedModel" formControlName="selectedModel" aria-label="Select Claude model">
              <option value="">-- Select a model --</option>
              @for (model of models; track model.value) {
                <option [value]="model.value">{{ model.label }}</option>
              }
            </select>
          </div>

          <div class="form-group">
            <label for="maxResponseTokens">Max Response Tokens</label>
            <input
              type="number"
              id="maxResponseTokens"
              formControlName="maxResponseTokens"
              min="1"
              max="32768"
              aria-label="Maximum response tokens"
            >
          </div>
        </section>

        <div class="form-actions">
          <button type="submit" class="btn-primary" [disabled]="settingsForm.invalid || saving">
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>
          <button type="button" class="btn-secondary" (click)="onClearKey()" [disabled]="saving">
            Clear API Key
          </button>
        </div>

        @if (statusMessage) {
          <p class="status-message" [class.error]="statusIsError" role="status">{{ statusMessage }}</p>
        }
      </form>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 2rem;
    }

    .settings-section {
      margin-bottom: 2rem;
    }

    .settings-section h2 {
      margin-bottom: 0.5rem;
      color: #2c3e50;
    }

    .info-note {
      color: #666;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
      padding: 0.75rem;
      background: #f0f8ff;
      border-radius: 4px;
      border-left: 3px solid #3498db;
    }

    .form-group {
      margin-bottom: 1.25rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.375rem;
      font-weight: 600;
      color: #2c3e50;
    }

    .form-group input,
    .form-group select {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
      box-sizing: border-box;
    }

    .password-input {
      display: flex;
      gap: 0.5rem;
    }

    .password-input input {
      flex: 1;
    }

    .toggle-visibility {
      padding: 0.5rem 1rem;
      background: #ecf0f1;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .toggle-visibility:hover {
      background: #dfe6e9;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .btn-primary {
      padding: 0.625rem 1.5rem;
      background-color: #3498db;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }

    .btn-primary:hover:not(:disabled) {
      background-color: #2980b9;
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary {
      padding: 0.625rem 1.5rem;
      background-color: #ecf0f1;
      color: #2c3e50;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }

    .btn-secondary:hover:not(:disabled) {
      background-color: #dfe6e9;
    }

    .status-message {
      margin-top: 1rem;
      padding: 0.75rem;
      border-radius: 4px;
      background: #d4edda;
      color: #155724;
    }

    .status-message.error {
      background: #f8d7da;
      color: #721c24;
    }

    .error-message {
      color: #e74c3c;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
  `]
})
export class SettingsPageComponent implements OnInit {
  settingsForm!: FormGroup;
  models = CLAUDE_MODELS;
  showKey = false;
  saving = false;
  statusMessage = '';
  statusIsError = false;

  constructor(
    private fb: FormBuilder,
    private aiSettingsService: AISettingsService,
    private storageService: StorageService
  ) {}

  ngOnInit(): void {
    this.settingsForm = this.fb.group({
      apiKey: ['', [Validators.pattern(/^(sk-ant-.*)?$/)]],
      selectedModel: [''],
      maxResponseTokens: [4096, [Validators.required, Validators.min(1), Validators.max(32768)]]
    });

    this.storageService.initialize().subscribe(() => {
      this.aiSettingsService.getSettings().subscribe(settings => {
        this.settingsForm.patchValue({
          apiKey: settings.apiKey ?? '',
          selectedModel: settings.selectedModel ?? '',
          maxResponseTokens: settings.maxResponseTokens
        });
      });
    });
  }

  onSave(): void {
    if (this.settingsForm.invalid || this.saving) return;

    this.saving = true;
    this.statusMessage = '';

    const formValue = this.settingsForm.value;
    const settings: AISettings = {
      apiKey: formValue.apiKey || undefined,
      selectedModel: formValue.selectedModel || undefined,
      maxResponseTokens: formValue.maxResponseTokens
    };

    this.aiSettingsService.saveSettings(settings).subscribe({
      next: () => {
        this.statusMessage = 'Settings saved successfully.';
        this.statusIsError = false;
        this.saving = false;
      },
      error: (err) => {
        this.statusMessage = err.message || 'Failed to save settings.';
        this.statusIsError = true;
        this.saving = false;
      }
    });
  }

  onClearKey(): void {
    this.aiSettingsService.clearApiKey().subscribe({
      next: () => {
        this.settingsForm.patchValue({ apiKey: '' });
        this.statusMessage = 'API key cleared.';
        this.statusIsError = false;
      },
      error: (err) => {
        this.statusMessage = err.message || 'Failed to clear API key.';
        this.statusIsError = true;
      }
    });
  }
}
