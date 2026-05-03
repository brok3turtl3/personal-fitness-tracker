/**
 * Settings AI sub-page spec — Plan 03-04 Task 2.
 *
 * Verifies:
 *   - Existing API key / model / max-tokens form preserved (renamed from
 *     settings-page.component.ts).
 *   - "What the AI sees" subsection (3 redaction toggles, defaults OFF — D-09).
 *   - "AI tool capabilities" subsection (3 tool toggles + 2 number caps).
 *   - "Developer tools" subsection gated by `isLocalhost` (D-12, T-3-DEV).
 *   - Save persists BOTH aiSettings AND aiToolSettings (single status message).
 *   - Dev seed buttons call `StorageService.setDevSeed(kind)` (T-3-DEV-LK
 *     chokepoint compliance).
 *   - Load failure renders <app-error-state>.
 *   - Severity-gated axe-core a11y.
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SettingsAiComponent } from './settings-ai.component';
import { AISettingsService } from '../../services/ai-settings.service';
import { StorageService } from '../../services/storage.service';
import { DEFAULT_AI_SETTINGS, DEFAULT_AI_TOOL_SETTINGS } from '../../models/ai-chat.model';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

interface Spies {
  aiSettings: jasmine.SpyObj<AISettingsService>;
  storage: jasmine.SpyObj<StorageService>;
}

function makeSpies(opts: {
  hasInitError?: boolean;
  hasGetSettingsError?: boolean;
} = {}): Spies {
  const aiSettings = jasmine.createSpyObj<AISettingsService>('AISettingsService', [
    'getSettings',
    'saveSettings',
    'clearApiKey',
    'getToolSettings',
    'saveToolSettings',
  ]);
  aiSettings.getSettings.and.returnValue(of({ ...DEFAULT_AI_SETTINGS }));
  aiSettings.saveSettings.and.returnValue(of(undefined));
  aiSettings.clearApiKey.and.returnValue(of(undefined));
  aiSettings.getToolSettings.and.returnValue(of({ ...DEFAULT_AI_TOOL_SETTINGS }));
  aiSettings.saveToolSettings.and.returnValue(of(undefined));

  const storage = jasmine.createSpyObj<StorageService>('StorageService', [
    'initialize',
    'getData',
    'saveData',
    'setDevSeed',
    'consumeDevSeed',
  ]);
  if (opts.hasInitError) {
    storage.initialize.and.returnValue(throwError(() => new Error('init failed')));
  } else {
    storage.initialize.and.returnValue(of(undefined));
  }

  if (opts.hasGetSettingsError) {
    aiSettings.getSettings.and.returnValue(throwError(() => new Error('load settings failed')));
  }

  return { aiSettings, storage };
}

async function configureBed(spies: Spies, opts: { localhost?: boolean } = {}): Promise<ComponentFixture<SettingsAiComponent>> {
  await TestBed.configureTestingModule({
    imports: [SettingsAiComponent],
    providers: [
      { provide: AISettingsService, useValue: spies.aiSettings },
      { provide: StorageService, useValue: spies.storage },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SettingsAiComponent);
  if (opts.localhost !== undefined) {
    // Override the readonly localhost gate before ngOnInit runs.
    Object.defineProperty(fixture.componentInstance, 'isLocalhost', {
      value: opts.localhost,
      configurable: true,
    });
  }
  fixture.detectChanges();
  return fixture;
}

describe('SettingsAiComponent', () => {
  it('creates the component', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders existing API key + model + max-tokens form fields (preserved verbatim)', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);

    expect(fixture.nativeElement.querySelector('#apiKey')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#selectedModel')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#maxResponseTokens')).toBeTruthy();
  });

  it('renders "What the AI sees" subsection with 3 redaction toggles', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);

    const heading = fixture.nativeElement.querySelector('#ai-sees-heading');
    expect(heading?.textContent?.trim()).toBe('What the AI sees');

    expect(fixture.nativeElement.querySelector('input[formControlName="redactHealthReadings"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[formControlName="redactWeightEntries"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[formControlName="redactMealNotes"]')).toBeTruthy();
  });

  it('redaction toggles default to false (D-09)', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    expect(c.toolSettingsForm.get('redactHealthReadings')?.value).toBeFalse();
    expect(c.toolSettingsForm.get('redactWeightEntries')?.value).toBeFalse();
    expect(c.toolSettingsForm.get('redactMealNotes')?.value).toBeFalse();
  });

  it('renders "AI tool capabilities" subsection with 3 toggles + 2 number inputs', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);

    const heading = fixture.nativeElement.querySelector('#ai-tools-heading');
    expect(heading?.textContent?.trim()).toBe('AI tool capabilities');

    expect(fixture.nativeElement.querySelector('input[formControlName="enableDataQueryTools"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[formControlName="enableMemoryTool"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[formControlName="enableWebSearch"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#maxAgentTurns')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#webSearchMaxUses')).toBeTruthy();
  });

  it('enableMemoryTool defaults true; enableWebSearch defaults false', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    expect(c.toolSettingsForm.get('enableMemoryTool')?.value).toBeTrue();
    expect(c.toolSettingsForm.get('enableDataQueryTools')?.value).toBeTrue();
    expect(c.toolSettingsForm.get('enableWebSearch')?.value).toBeFalse();
  });

  it('maxAgentTurns enforces min=1 and max=20', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.toolSettingsForm.get('maxAgentTurns')?.setValue(0);
    expect(c.toolSettingsForm.get('maxAgentTurns')?.errors?.['min']).toBeTruthy();

    c.toolSettingsForm.get('maxAgentTurns')?.setValue(21);
    expect(c.toolSettingsForm.get('maxAgentTurns')?.errors?.['max']).toBeTruthy();

    c.toolSettingsForm.get('maxAgentTurns')?.setValue(10);
    expect(c.toolSettingsForm.get('maxAgentTurns')?.valid).toBeTrue();
  });

  it('isLocalhost=true renders the Developer tools section + 2 seed buttons', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies, { localhost: true });

    const heading = fixture.nativeElement.querySelector('#dev-tools-heading');
    expect(heading?.textContent?.trim()).toBe('Developer tools');

    const buttons = fixture.nativeElement.querySelectorAll('.dev-tools-actions button');
    expect(buttons.length).toBe(2);
    expect((buttons[0] as HTMLButtonElement).textContent?.trim()).toBe('Seed pending memory proposal');
    expect((buttons[1] as HTMLButtonElement).textContent?.trim()).toBe('Seed pending profile proposal');
  });

  it('isLocalhost=false hides the Developer tools section (T-3-DEV)', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies, { localhost: false });

    expect(fixture.nativeElement.querySelector('#dev-tools-heading')).toBeNull();
    expect(fixture.nativeElement.querySelector('.dev-tools-container')).toBeNull();
  });

  it('Seed pending memory proposal button calls storageService.setDevSeed("memory")', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies, { localhost: true });
    fixture.componentInstance.onSeedMemoryProposal();

    expect(spies.storage.setDevSeed).toHaveBeenCalledWith('memory');
    expect(fixture.componentInstance.statusMessage).toContain('Seeded pending memory proposal');
    expect(fixture.componentInstance.statusIsError).toBeFalse();
  });

  it('Seed pending profile proposal button calls storageService.setDevSeed("profile")', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies, { localhost: true });
    fixture.componentInstance.onSeedProfileProposal();

    expect(spies.storage.setDevSeed).toHaveBeenCalledWith('profile');
    expect(fixture.componentInstance.statusMessage).toContain('Seeded pending profile proposal');
  });

  it('onSave persists both aiSettings AND aiToolSettings', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);
    fixture.componentInstance.onSave();

    expect(spies.aiSettings.saveSettings).toHaveBeenCalled();
    expect(spies.aiSettings.saveToolSettings).toHaveBeenCalled();
    expect(fixture.componentInstance.statusIsError).toBeFalse();
  });

  it('reloadData calls getToolSettings and patches the form', async () => {
    const spies = makeSpies();
    spies.aiSettings.getToolSettings.and.returnValue(of({
      ...DEFAULT_AI_TOOL_SETTINGS,
      redactHealthReadings: true,
      maxAgentTurns: 7,
    }));

    const fixture = await configureBed(spies);

    expect(spies.aiSettings.getToolSettings).toHaveBeenCalled();
    expect(fixture.componentInstance.toolSettingsForm.get('redactHealthReadings')?.value).toBeTrue();
    expect(fixture.componentInstance.toolSettingsForm.get('maxAgentTurns')?.value).toBe(7);
  });

  it('renders <app-error-state> when storage.initialize() fails', async () => {
    const spies = makeSpies({ hasInitError: true });
    const fixture = await configureBed(spies);

    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
  });

  it('passes axe-core severe a11y check (color-contrast deferred per Plan 01-08 D-13)', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies, { localhost: true });
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});
