/**
 * Chat-page characterization spec.
 *
 * Per FOUND-04 + D-05/D-06/D-07/D-08: Karma TestBed DOM specs that capture the
 * dominant user flows on chat-page so a Phase 2-5 refactor that regresses them
 * fails this suite. Per-spec factory helpers (D-07). DOM-shape assertions
 * (Pitfall 6 — not full textContent). axe-core inline (D-08, FOUND-05),
 * gated to serious|critical only.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ChatPageComponent } from './chat-page.component';
import { ChatService } from '../../services/chat.service';
import { AISettingsService } from '../../services/ai-settings.service';
import { StorageService } from '../../services/storage.service';
import { ChatConversation, ChatMessage } from '../../models/ai-chat.model';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

// ---------------------------------------------------------------------------
// Per-spec factory helpers (D-07: NO shared canonical fixture file).
// ---------------------------------------------------------------------------

function createValidMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    tokenEstimate: 1,
    createdAt: '2026-04-15T10:00:00.000Z',
    ...overrides,
  };
}

function createValidConversation(overrides: Partial<ChatConversation> = {}): ChatConversation {
  return {
    id: 'conv-1',
    title: 'Workout planning',
    messages: [],
    summarizedMessageCount: 0,
    createdAt: '2026-04-15T10:00:00.000Z',
    updatedAt: '2026-04-15T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Spies + TestBed configuration. Rebuilt per-spec so each scenario can
// override return values cleanly without leaking state.
// ---------------------------------------------------------------------------

interface ChatSpies {
  chatService: jasmine.SpyObj<ChatService>;
  aiSettingsService: jasmine.SpyObj<AISettingsService>;
  storageService: jasmine.SpyObj<StorageService>;
}

function makeSpies(opts: {
  hasApiKey?: boolean;
  conversations?: ChatConversation[];
  activeConversation?: ChatConversation | null;
} = {}): ChatSpies {
  const chatService = jasmine.createSpyObj<ChatService>('ChatService', [
    'getConversations',
    'getConversation',
    'createConversation',
    'deleteConversation',
    'sendMessage',
  ]);
  chatService.getConversations.and.returnValue(of(opts.conversations ?? []));
  chatService.getConversation.and.returnValue(of(opts.activeConversation ?? null));

  const aiSettingsService = jasmine.createSpyObj<AISettingsService>(
    'AISettingsService',
    ['hasValidApiKey', 'getSettings', 'saveSettings', 'clearApiKey'],
  );
  aiSettingsService.hasValidApiKey.and.returnValue(of(opts.hasApiKey ?? true));

  const storageService = jasmine.createSpyObj<StorageService>('StorageService', [
    'initialize', 'getData', 'saveData', 'getBackup',
  ]);
  storageService.initialize.and.returnValue(of(undefined));

  return { chatService, aiSettingsService, storageService };
}

async function configureBed(spies: ChatSpies): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [ChatPageComponent],
    providers: [
      provideRouter([]),
      { provide: ChatService, useValue: spies.chatService },
      { provide: AISettingsService, useValue: spies.aiSettingsService },
      { provide: StorageService, useValue: spies.storageService },
    ],
  }).compileComponents();
}

describe('ChatPageComponent (characterization)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render the conversation list from the store', async () => {
    // Arrange: 2 conversations.
    const conversations = [
      createValidConversation({ id: 'c-a', title: 'Cardio plan' }),
      createValidConversation({ id: 'c-b', title: 'Diet review' }),
    ];
    const spies = makeSpies({ hasApiKey: true, conversations });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();

    // Assert: 2 conversation list items render (DOM shape).
    expect(fixture.componentInstance.conversations.length).toBe(2);
    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.conversation-item');
    expect(items.length).toBe(2);
  });

  it('should switch active conversation when one is selected', async () => {
    // Arrange: 2 conversations exist; the second has 3 messages.
    const conv1 = createValidConversation({ id: 'c-1', title: 'Plan A' });
    const conv2 = createValidConversation({
      id: 'c-2',
      title: 'Plan B',
      messages: [
        createValidMessage({ id: 'm-1', role: 'user', content: 'Hi' }),
        createValidMessage({ id: 'm-2', role: 'assistant', content: 'Hello back' }),
        createValidMessage({ id: 'm-3', role: 'user', content: 'Continue' }),
      ],
    });
    const spies = makeSpies({ hasApiKey: true, conversations: [conv1, conv2] });
    spies.chatService.getConversation.and.returnValue(of(conv2));
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectConversation('c-2');
    fixture.detectChanges();

    // Assert: active conversation matches.
    expect(spies.chatService.getConversation).toHaveBeenCalledWith('c-2');
    expect(fixture.componentInstance.activeConversationId).toBe('c-2');
    expect(fixture.componentInstance.activeConversation?.id).toBe('c-2');
  });

  it('should render the message list for the active conversation', async () => {
    // Arrange: active conversation with 3 messages.
    const active = createValidConversation({
      id: 'c-active',
      title: 'Active',
      messages: [
        createValidMessage({ id: 'm-1', role: 'user', content: 'A' }),
        createValidMessage({ id: 'm-2', role: 'assistant', content: 'B' }),
        createValidMessage({ id: 'm-3', role: 'user', content: 'C' }),
      ],
    });
    const spies = makeSpies({
      hasApiKey: true,
      conversations: [active],
      activeConversation: active,
    });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectConversation('c-active');
    fixture.detectChanges();

    // Assert: 3 message DOM nodes (DOM shape; Pitfall 6).
    const compiled = fixture.nativeElement as HTMLElement;
    const messages = compiled.querySelectorAll('app-chat-message-list .message');
    expect(messages.length).toBe(3);
  });

  it('should render <app-empty-state> when no conversations exist', async () => {
    // Arrange: api key valid, conversations empty.
    const spies = makeSpies({ hasApiKey: true, conversations: [] });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();

    // Assert: empty state surface visible.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-empty-state')).toBeTruthy();
  });

  it('should render <app-error-state> when API key is missing', async () => {
    // Arrange: no API key configured.
    const spies = makeSpies({ hasApiKey: false });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();

    // Assert: API-key gate renders the error-state surface.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-error-state')).toBeTruthy();
  });

  it('should have no serious or critical axe-core violations on initial load', async () => {
    // Arrange: a representative happy-path render with one conversation.
    const conv = createValidConversation({
      messages: [createValidMessage({ role: 'user', content: 'Hello' })],
    });
    const spies = makeSpies({
      hasApiKey: true,
      conversations: [conv],
      activeConversation: conv,
    });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();

    // Assert: structural a11y only. `color-contrast` is deferred to Phase 5
    // QUAL-08 per CONTEXT.md D-13 — current global palette is below WCAG AA
    // contrast across all 8 pages. See a11y-test-helpers.ts header.
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});
