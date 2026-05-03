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
import { ChatConversation, ChatMessage, ToolUseBlock } from '../../models/ai-chat.model';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

// ---------------------------------------------------------------------------
// Per-spec factory helpers (D-07: NO shared canonical fixture file).
// ---------------------------------------------------------------------------

function createValidMessage(
  overrides: Partial<ChatMessage> & { content?: string } = {},
): ChatMessage {
  // Spec ergonomics: callers may pass a `content: 'X'` shorthand to keep
  // existing call sites readable; the helper lifts it into the V5 `blocks`
  // shape (D-15) so the production type contract is preserved.
  const { content, ...rest } = overrides;
  const base: ChatMessage = {
    id: 'msg-1',
    role: 'user',
    blocks: [{ type: 'text', text: 'Hello' }],
    tokenEstimate: 1,
    createdAt: '2026-04-15T10:00:00.000Z',
  };
  if (content !== undefined) {
    return { ...base, ...rest, blocks: [{ type: 'text', text: content }] };
  }
  return { ...base, ...rest };
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
  devSeed?: { kind: 'memory' | 'profile'; at: string } | null;
} = {}): ChatSpies {
  const chatService = jasmine.createSpyObj<ChatService>('ChatService', [
    'getConversations',
    'getConversation',
    'createConversation',
    'deleteConversation',
    'sendMessage',
    'updateMessageBlock',
    'appendAssistantBlocks',
  ]);
  chatService.getConversations.and.returnValue(of(opts.conversations ?? []));
  chatService.getConversation.and.returnValue(of(opts.activeConversation ?? null));
  chatService.updateMessageBlock.and.returnValue(of(undefined));
  chatService.appendAssistantBlocks.and.returnValue(of({
    id: 'appended-msg',
    role: 'assistant',
    blocks: [],
    tokenEstimate: 0,
    createdAt: '2026-04-15T10:00:00.000Z',
  } as ChatMessage));

  const aiSettingsService = jasmine.createSpyObj<AISettingsService>(
    'AISettingsService',
    ['hasValidApiKey', 'getSettings', 'saveSettings', 'clearApiKey'],
  );
  aiSettingsService.hasValidApiKey.and.returnValue(of(opts.hasApiKey ?? true));

  const storageService = jasmine.createSpyObj<StorageService>('StorageService', [
    'initialize', 'getData', 'saveData', 'getBackup',
    'setDevSeed', 'consumeDevSeed',
  ]);
  storageService.initialize.and.returnValue(of(undefined));
  storageService.consumeDevSeed.and.returnValue(opts.devSeed ?? null);

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

  // ---------------------------------------------------------------------------
  // Plan 03-05 Task 3 — block @switch + (blockAction) handlers + dev-seed
  // ---------------------------------------------------------------------------

  function makeMemoryToolUse(): ToolUseBlock {
    return {
      type: 'tool_use',
      id: 'tu-1',
      name: 'memory',
      input: { command: 'create', path: '/memories/x.md', file_text: 'X' },
      status: 'pending',
    };
  }

  it('block @switch renders text block as plain text and tool_use block as <app-pending-pill>', async () => {
    const conv = createValidConversation({
      id: 'c-active',
      messages: [
        {
          id: 'm-1',
          role: 'assistant',
          blocks: [
            { type: 'text', text: 'Here is a proposal' },
            makeMemoryToolUse(),
          ],
          tokenEstimate: 5,
          createdAt: '2026-04-15T10:00:00.000Z',
        },
      ],
    });
    const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectConversation('c-active');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // Text block rendered as plain text
    expect(compiled.querySelector('.message-content')?.textContent).toContain('Here is a proposal');
    // Tool_use block rendered as pending-pill
    expect(compiled.querySelector('app-pending-pill')).toBeTruthy();
    expect(compiled.querySelector('.pending-pill')).toBeTruthy();
  });

  it('(blockAction) approve dispatches chat.service.updateMessageBlock with status="approved"', async () => {
    const message: ChatMessage = {
      id: 'm-1',
      role: 'assistant',
      blocks: [makeMemoryToolUse()],
      tokenEstimate: 5,
      createdAt: '2026-04-15T10:00:00.000Z',
    };
    const conv = createValidConversation({ id: 'c-1', messages: [message] });
    const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectConversation('c-1');
    fixture.detectChanges();

    fixture.componentInstance.onBlockAction({
      messageId: 'm-1',
      blockIndex: 0,
      action: 'approve',
    });

    expect(spies.chatService.updateMessageBlock).toHaveBeenCalledWith(
      'c-1',
      'm-1',
      0,
      jasmine.objectContaining({ status: 'approved' }),
    );
  });

  it('(blockAction) edit dispatches updateMessageBlock with status="edited" + editedFromText', async () => {
    const block = makeMemoryToolUse();
    const message: ChatMessage = {
      id: 'm-1',
      role: 'assistant',
      blocks: [block],
      tokenEstimate: 5,
      createdAt: '2026-04-15T10:00:00.000Z',
    };
    const conv = createValidConversation({ id: 'c-1', messages: [message] });
    const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectConversation('c-1');
    fixture.detectChanges();

    fixture.componentInstance.onBlockAction({
      messageId: 'm-1',
      blockIndex: 0,
      action: 'edit',
      editedText: 'amended proposal',
    });

    expect(spies.chatService.updateMessageBlock).toHaveBeenCalled();
    const args = spies.chatService.updateMessageBlock.calls.mostRecent().args;
    expect(args[0]).toBe('c-1');
    expect(args[1]).toBe('m-1');
    expect(args[2]).toBe(0);
    expect(args[3].status).toBe('edited');
    expect(args[3].editedFromText).toBe('X'); // original file_text
    // input has the new text applied to file_text (memory kind)
    expect((args[3].input as Record<string, unknown>)['file_text']).toBe('amended proposal');
  });

  it('(blockAction) discard dispatches updateMessageBlock with status="discarded"', async () => {
    const message: ChatMessage = {
      id: 'm-1',
      role: 'assistant',
      blocks: [makeMemoryToolUse()],
      tokenEstimate: 5,
      createdAt: '2026-04-15T10:00:00.000Z',
    };
    const conv = createValidConversation({ id: 'c-1', messages: [message] });
    const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectConversation('c-1');
    fixture.detectChanges();

    fixture.componentInstance.onBlockAction({
      messageId: 'm-1',
      blockIndex: 0,
      action: 'discard',
    });

    expect(spies.chatService.updateMessageBlock).toHaveBeenCalledWith(
      'c-1',
      'm-1',
      0,
      jasmine.objectContaining({ status: 'discarded' }),
    );
  });

  it('consumeDevSeed("memory") on init appends an assistant message with a pending memory tool_use block', async () => {
    const conv = createValidConversation({ id: 'c-active' });
    const spies = makeSpies({
      hasApiKey: true,
      conversations: [conv],
      activeConversation: conv,
      devSeed: { kind: 'memory', at: '2026-05-03T00:00:00.000Z' },
    });
    // Make activeConversation auto-set after loadConversations
    spies.chatService.getConversation.and.returnValue(of(conv));
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
    // Manually set active conversation since the Phase 1 spec doesn't auto-select
    fixture.componentInstance.activeConversationId = 'c-active';
    fixture.componentInstance.activeConversation = conv;
    fixture.componentInstance.consumeDevSeedIfPresent();

    expect(spies.storageService.consumeDevSeed).toHaveBeenCalled();
    expect(spies.chatService.appendAssistantBlocks).toHaveBeenCalled();
    const [convId, blocks] = spies.chatService.appendAssistantBlocks.calls.mostRecent().args;
    expect(convId).toBe('c-active');
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('tool_use');
    expect((blocks[0] as ToolUseBlock).name).toBe('memory');
    expect((blocks[0] as ToolUseBlock).status).toBe('pending');
  });

  it('consumeDevSeed("profile") on init appends an assistant message with a pending update_profile tool_use block', async () => {
    const conv = createValidConversation({ id: 'c-active' });
    const spies = makeSpies({
      hasApiKey: true,
      conversations: [conv],
      activeConversation: conv,
      devSeed: { kind: 'profile', at: '2026-05-03T00:00:00.000Z' },
    });
    spies.chatService.getConversation.and.returnValue(of(conv));
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.activeConversationId = 'c-active';
    fixture.componentInstance.activeConversation = conv;
    fixture.componentInstance.consumeDevSeedIfPresent();

    expect(spies.chatService.appendAssistantBlocks).toHaveBeenCalled();
    const blocks = spies.chatService.appendAssistantBlocks.calls.mostRecent().args[1];
    expect(blocks.length).toBe(1);
    expect((blocks[0] as ToolUseBlock).name).toBe('update_profile');
    expect((blocks[0] as ToolUseBlock).status).toBe('pending');
  });

  it('no consumeDevSeed sentinel does NOT append a message', async () => {
    const conv = createValidConversation({ id: 'c-active' });
    const spies = makeSpies({
      hasApiKey: true,
      conversations: [conv],
      activeConversation: conv,
      devSeed: null,
    });
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.activeConversationId = 'c-active';
    fixture.componentInstance.activeConversation = conv;
    fixture.componentInstance.consumeDevSeedIfPresent();

    expect(spies.chatService.appendAssistantBlocks).not.toHaveBeenCalled();
  });

  it('expectNoSeriousA11yViolations when a pending pill is in the chat stream', async () => {
    const conv = createValidConversation({
      id: 'c-active',
      messages: [
        {
          id: 'm-1',
          role: 'assistant',
          blocks: [makeMemoryToolUse()],
          tokenEstimate: 5,
          createdAt: '2026-04-15T10:00:00.000Z',
        },
      ],
    });
    const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSelectConversation('c-active');
    fixture.detectChanges();

    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});
