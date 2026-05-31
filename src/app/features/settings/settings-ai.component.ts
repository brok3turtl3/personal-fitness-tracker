import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { switchMap } from 'rxjs';
import { AISettingsService } from '../../services/ai-settings.service';
import { StorageService } from '../../services/storage.service';
import {
  AISettings,
  AIToolSettings,
  CLAUDE_MODELS,
  DEFAULT_AI_TOOL_SETTINGS,
} from '../../models/ai-chat.model';
import { ErrorStateComponent } from '../../shared/error-state.component';

/**
 * `/settings/ai` — AI settings sub-page (Plan 03-04 Task 2).
 *
 * RENAMED from `settings-page.component.ts` (selector and class names
 * updated; existing API key / model / max-tokens form preserved verbatim).
 * Three new subsections appended:
 *   1. "What the AI sees" — 3 redaction toggles (D-09, default OFF).
 *   2. "AI tool capabilities" — 3 tool toggles + 2 number caps (RESEARCH.md
 *      Open Q 2 recommendation A — full surface in Phase 3, dormant effect).
 *   3. "Developer tools" — 2 seed buttons gated by `location.hostname ===
 *      'localhost'` (D-12). Buttons delegate to
 *      `StorageService.setDevSeed(kind)` — chokepoint-compliant path landed
 *      in Plan 03-01 Wave 1.
 */
@Component({
  selector: 'app-settings-ai',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ErrorStateComponent],
  template: `
    <div class="page-container">
      <h1>Settings</h1>

      @if (loadError) {
        <app-error-state
          title="Couldn't load settings"
          [error]="loadError"
          (retry)="reloadData()"
        ></app-error-state>
      }

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

        <section class="settings-section" [formGroup]="toolSettingsForm" aria-labelledby="ai-sees-heading">
          <h2 id="ai-sees-heading">What the AI sees</h2>
          <p class="form-helper">By default the AI sees everything you've logged so it can give grounded coaching. Toggle these off if you'd rather keep specific data out of the request.</p>

          <div class="toggle-row">
            <label>
              <input type="checkbox" formControlName="redactHealthReadings" aria-describedby="redact-readings-helper">
              <span class="toggle-label">Send health readings (BP, glucose, ketones)</span>
            </label>
            <p id="redact-readings-helper" class="form-helper toggle-helper">Off hides BP, blood glucose, and ketone readings from the system prompt.</p>
          </div>

          <div class="toggle-row">
            <label>
              <input type="checkbox" formControlName="redactWeightEntries" aria-describedby="redact-weight-helper">
              <span class="toggle-label">Send weight entries</span>
            </label>
            <p id="redact-weight-helper" class="form-helper toggle-helper">Off hides logged weight from the system prompt. Trends and goals can still be discussed if mentioned in your profile.</p>
          </div>

          <div class="toggle-row">
            <label>
              <input type="checkbox" formControlName="redactMealNotes" aria-describedby="redact-meals-helper">
              <span class="toggle-label">Send meal notes</span>
            </label>
            <p id="redact-meals-helper" class="form-helper toggle-helper">Off keeps macro totals in the prompt but strips free-text meal notes (recipe names, paste-ins, etc.).</p>
          </div>
        </section>

        <section class="settings-section" [formGroup]="toolSettingsForm" aria-labelledby="ai-tools-heading">
          <h2 id="ai-tools-heading">AI tool capabilities</h2>
          <p class="form-helper">These controls take effect when the agentic chat loop activates. They have no effect on the current single-shot chat behavior.</p>

          <div class="toggle-row">
            <label>
              <input type="checkbox" formControlName="enableDataQueryTools" aria-describedby="enable-data-helper">
              <span class="toggle-label">Enable data-query tools</span>
            </label>
            <p id="enable-data-helper" class="form-helper toggle-helper">Lets the AI fetch your cardio, weight, readings, and meals to answer questions.</p>
          </div>

          <div class="toggle-row">
            <label>
              <input type="checkbox" formControlName="enableMemoryTool" aria-describedby="enable-memory-helper">
              <span class="toggle-label">Enable memory tool</span>
            </label>
            <p id="enable-memory-helper" class="form-helper toggle-helper">Lets the AI save and recall facts between conversations.</p>
          </div>

          <div class="toggle-row">
            <label>
              <input type="checkbox" formControlName="enableWebSearch" aria-describedby="enable-search-helper">
              <span class="toggle-label">Enable web search</span>
            </label>
            <p id="enable-search-helper" class="form-helper toggle-helper">Lets the AI ground research questions in live web sources. Off by default.</p>
          </div>

          <div class="form-group">
            <label for="maxAgentTurns">Maximum agent turns per request</label>
            <input
              type="number"
              id="maxAgentTurns"
              formControlName="maxAgentTurns"
              min="1"
              max="20"
              aria-label="Maximum agent turns per request"
            >
          </div>

          <div class="form-group">
            <label for="webSearchMaxUses">Maximum web searches per request</label>
            <input
              type="number"
              id="webSearchMaxUses"
              formControlName="webSearchMaxUses"
              min="0"
              max="10"
              aria-label="Maximum web searches per request"
              aria-describedby="websearch-max-helper"
            >
            <p id="websearch-max-helper" class="form-helper toggle-helper websearch-cost-helper">Each web search adds to the cost of a message. This caps how many the AI can run per request.</p>
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

    .form-helper {
      color: #7f8c8d;
      font-size: 0.875rem;
      margin: 0 0 1rem;
    }

    .toggle-row {
      margin-bottom: 1rem;
    }

    .toggle-row label {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      font-weight: 600;
      color: #2c3e50;
    }

    .toggle-row .toggle-label {
      font-weight: 600;
    }

    .toggle-helper {
      margin: 0.25rem 0 0 1.5rem;
    }

    /* Field-level cost helper sits under the input, not indented like a toggle. */
    .websearch-cost-helper {
      margin: 0.375rem 0 0;
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

    .dev-tools-container {
      border-left: 3px solid #e74c3c;
      padding-left: 1rem;
    }

    .dev-tools-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
  `]
})
export class SettingsAiComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  settingsForm!: FormGroup;
  toolSettingsForm!: FormGroup;
  models = CLAUDE_MODELS;
  showKey = false;
  saving = false;
  statusMessage = '';
  statusIsError = false;
  loadError: Error | null = null;

  /**
   * Dev-only seed-button gate (D-12). Evaluated at component construction
   * time so the template `@if` branch never even renders the buttons in a
   * packaged Electron build (which serves from `file://` or a different
   * host). The threat-model entry T-3-DEV depends on this gate.
   */
  readonly isLocalhost: boolean =
    typeof location !== 'undefined' && location.hostname === 'localhost';

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

    this.toolSettingsForm = this.fb.group({
      redactHealthReadings: [false],
      redactWeightEntries: [false],
      redactMealNotes: [false],
      enableDataQueryTools: [true],
      enableMemoryTool: [true],
      enableWebSearch: [false],
      maxAgentTurns: [10, [Validators.required, Validators.min(1), Validators.max(20)]],
      webSearchMaxUses: [3, [Validators.required, Validators.min(0), Validators.max(10)]],
    });

    this.reloadData();
  }

  reloadData(): void {
    this.loadError = null;
    this.storageService.initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.aiSettingsService.getSettings()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (settings) => {
                this.settingsForm.patchValue({
                  apiKey: settings.apiKey ?? '',
                  selectedModel: settings.selectedModel ?? '',
                  maxResponseTokens: settings.maxResponseTokens
                });
              },
              error: (err) => {
                this.loadError = err instanceof Error ? err : new Error(String(err));
              }
            });

          this.aiSettingsService.getToolSettings()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (toolSettings) => {
                this.toolSettingsForm.patchValue(toolSettings);
              },
              error: (err) => {
                this.loadError = err instanceof Error ? err : new Error(String(err));
              }
            });
        },
        error: (err) => {
          this.loadError = err instanceof Error ? err : new Error(String(err));
        }
      });
  }

  onSave(): void {
    if (this.settingsForm.invalid || this.toolSettingsForm.invalid || this.saving) return;

    this.saving = true;
    this.statusMessage = '';

    const formValue = this.settingsForm.value;
    const settings: AISettings = {
      apiKey: formValue.apiKey || undefined,
      selectedModel: formValue.selectedModel || undefined,
      maxResponseTokens: formValue.maxResponseTokens
    };

    const toolSettings: AIToolSettings = {
      ...DEFAULT_AI_TOOL_SETTINGS,
      ...this.toolSettingsForm.value,
    };

    this.aiSettingsService.saveSettings(settings)
      .pipe(
        switchMap(() => this.aiSettingsService.saveToolSettings(toolSettings)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
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
    this.aiSettingsService.clearApiKey()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
// NOTE (plan 04-06): the Phase 3 dev-only "Seed pending proposal" buttons and
// their `StorageService.setDevSeed` handlers were REMOVED. Real write proposals
// now surface through the live agentic loop (D-03); the synthetic-pill seeding
// path is gone end-to-end so it can never fire alongside a real proposal
// (T-04-06-03). `isLocalhost` is retained for any future localhost-only tools.
