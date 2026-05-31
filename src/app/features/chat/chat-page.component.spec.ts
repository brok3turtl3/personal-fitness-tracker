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
import { Subject, of } from 'rxjs';

import { ChatPageComponent } from './chat-page.component';
import { ChatService } from '../../services/chat.service';
import { AISettingsService } from '../../services/ai-settings.service';
import { StorageService } from '../../services/storage.service';
import { AISettings, ChatConversation, ChatMessage, ChatTurnEvent, ToolUseBlock } from '../../models/ai-chat.model';
import { AnthropicApiError } from '../../services/anthropic-api.service';
import { PendingApprovalService } from '../../services/pending-approval.service';
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
  pendingApproval: jasmine.SpyObj<PendingApprovalService>;
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
    'runAgenticLoop',
    'appendUserMessage',
    'updateMessageBlock',
    'approveToolUseBlock',
    'appendAssistantBlocks',
  ]);
  chatService.getConversations.and.returnValue(of(opts.conversations ?? []));
  chatService.getConversation.and.returnValue(of(opts.activeConversation ?? null));
  chatService.updateMessageBlock.and.returnValue(of(undefined));
  chatService.approveToolUseBlock.and.returnValue(of(undefined));
  chatService.runAgenticLoop.and.returnValue(of());
  chatService.appendUserMessage.and.returnValue(of({
    id: 'user-msg',
    role: 'user',
    blocks: [{ type: 'text', text: 'Hello' }],
    tokenEstimate: 1,
    createdAt: '2026-04-15T10:00:00.000Z',
  } as ChatMessage));
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
  const settings: AISettings = {
    apiKey: 'sk-ant-test-key',
    selectedModel: 'claude-opus-4-8',
    maxResponseTokens: 4096,
  };
  aiSettingsService.getSettings.and.returnValue(of(settings));

  const storageService = jasmine.createSpyObj<StorageService>('StorageService', [
    'initialize', 'getData', 'saveData', 'getBackup',
    'setDevSeed', 'consumeDevSeed',
  ]);
  storageService.initialize.and.returnValue(of(undefined));
  storageService.consumeDevSeed.and.returnValue(opts.devSeed ?? null);

  const pendingApproval = jasmine.createSpyObj<PendingApprovalService>('PendingApprovalService', [
    'executeApprovedToolUse',
  ]);
  pendingApproval.executeApprovedToolUse.and.returnValue(
    Promise.resolve({ content: 'File created successfully at: /memories/seed-1.md', isError: false }),
  );

  return { chatService, aiSettingsService, storageService, pendingApproval };
}

async function configureBed(spies: ChatSpies): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [ChatPageComponent],
    providers: [
      provideRouter([]),
      { provide: ChatService, useValue: spies.chatService },
      { provide: AISettingsService, useValue: spies.aiSettingsService },
      { provide: StorageService, useValue: spies.storageService },
      { provide: PendingApprovalService, useValue: spies.pendingApproval },
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

  it('(blockAction) approve executes via PendingApprovalService then persists via approveToolUseBlock', async () => {
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
    // Flush the Promise → from(...) microtask before asserting persistence.
    await Promise.resolve();
    await Promise.resolve();

    expect(spies.pendingApproval.executeApprovedToolUse).toHaveBeenCalledTimes(1);
    expect(spies.pendingApproval.executeApprovedToolUse).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 'tu-1', name: 'memory' }),
    );
    expect(spies.chatService.approveToolUseBlock).toHaveBeenCalledWith(
      'c-1', 'm-1', 0,
      { content: 'File created successfully at: /memories/seed-1.md', isError: false },
    );
    expect(spies.chatService.updateMessageBlock).not.toHaveBeenCalled();
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
    expect(spies.pendingApproval.executeApprovedToolUse).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Plan 04-06 Task 2 — the Phase 3 dev-only seed machinery was REMOVED so a
  // synthetic pending pill can never fire alongside a real loop proposal
  // (T-04-06-03). The component no longer reads `consumeDevSeed` and no longer
  // exposes `consumeDevSeedIfPresent`. (Was: three consumeDevSeed specs.)
  // ---------------------------------------------------------------------------

  it('does NOT consume the dev-seed sentinel on init (dev-seed machinery removed — plan 04-06)', async () => {
    const convA = createValidConversation({ id: 'c-a' });
    const spies = makeSpies({
      hasApiKey: true,
      conversations: [convA],
      activeConversation: convA,
      devSeed: { kind: 'memory', at: '2026-05-31T12:00:00.000Z' },
    });
    spies.chatService.getConversation.and.returnValue(of(convA));
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();

    // The seed is never read, and no synthetic pill is appended.
    expect(spies.storageService.consumeDevSeed).not.toHaveBeenCalled();
    expect(spies.chatService.appendAssistantBlocks).not.toHaveBeenCalled();
    // The dev-only public re-entry point is gone.
    expect((fixture.componentInstance as unknown as Record<string, unknown>)['consumeDevSeedIfPresent'])
      .toBeUndefined();
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

  // ---------------------------------------------------------------------------
  // Plan 03-06 (gap closure) — UAT Test 2 regression: dev-seed pending pill
  // must render via the production ngOnInit lifecycle, with NO manual
  // activeConversationId assignment. Root cause:
  //   .planning/debug/dev-seed-pending-pill-not-rendering.md
  // ---------------------------------------------------------------------------
  describe('ngOnInit auto-select (plan 03-06 regression — dev-seed removed in 04-06)', () => {
    it('ngOnInit auto-selects the most-recent conversation with NO manual activeConversationId (plan 03-06 not regressed)', async () => {
      // Arrange: 1 conversation, no seed needed (machinery removed).
      const convA = createValidConversation({ id: 'c-a', title: 'Existing' });
      const spies = makeSpies({
        hasApiKey: true,
        conversations: [convA],
        activeConversation: convA,
      });
      spies.chatService.getConversation.and.returnValue(of(convA));
      await configureBed(spies);

      // Act — drive ngOnInit only; NO manual state assignment.
      const fixture = TestBed.createComponent(ChatPageComponent);
      fixture.detectChanges();

      // Assert: auto-select happened without a user click; no pill appended.
      expect(fixture.componentInstance.activeConversationId).toBe('c-a');
      expect(fixture.componentInstance.activeConversation?.id).toBe('c-a');
      expect(spies.chatService.appendAssistantBlocks).not.toHaveBeenCalled();
      expect(spies.chatService.createConversation).not.toHaveBeenCalled();
    });

    it('ngOnInit with NO conversations leaves activeConversation null (empty-state surface preserved — Phase 1 spec invariant)', async () => {
      // Arrange: empty list. This is the surface the Phase 1 empty-state
      // characterization spec depends on. No seed-gated auto-create anymore.
      const spies = makeSpies({
        hasApiKey: true,
        conversations: [],
        activeConversation: null,
      });
      await configureBed(spies);

      // Act
      const fixture = TestBed.createComponent(ChatPageComponent);
      fixture.detectChanges();

      // Assert: no auto-create; activeConversation stays null so the
      // empty-state surface renders.
      expect(spies.chatService.createConversation).not.toHaveBeenCalled();
      expect(spies.chatService.appendAssistantBlocks).not.toHaveBeenCalled();
      expect(fixture.componentInstance.activeConversationId).toBeNull();
      expect(fixture.componentInstance.activeConversation).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Plan 04-06 Task 1 — runAgenticLoop orchestration: multi-emit events drive
  // the view; turn-limit + terminal notices; takeUntilDestroyed cancellation;
  // 401 path preserved + generic transport error → <app-error-state>.
  // ---------------------------------------------------------------------------
  describe('runAgenticLoop orchestration (plan 04-06)', () => {
    function selectActive(fixture: ReturnType<typeof TestBed.createComponent<ChatPageComponent>>, id: string): void {
      fixture.componentInstance.onSelectConversation(id);
      fixture.detectChanges();
    }

    it('onSendMessage persists the user turn then subscribes to runAgenticLoop', async () => {
      const conv = createValidConversation({ id: 'c-1' });
      const events = new Subject<ChatTurnEvent>();
      const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
      spies.chatService.runAgenticLoop.and.returnValue(events.asObservable());
      await configureBed(spies);

      const fixture = TestBed.createComponent(ChatPageComponent);
      fixture.detectChanges();
      selectActive(fixture, 'c-1');

      fixture.componentInstance.onSendMessage('how is my weight trending?');

      expect(spies.chatService.appendUserMessage)
        .toHaveBeenCalledWith('c-1', 'how is my weight trending?');
      expect(spies.chatService.runAgenticLoop)
        .toHaveBeenCalledWith('c-1', 'sk-ant-test-key');
      // The single-shot path is NOT used anymore.
      expect(spies.chatService.sendMessage).not.toHaveBeenCalled();
    });

    it('successive loop events refresh the rendered conversation from storage (D-01)', async () => {
      const conv = createValidConversation({ id: 'c-1' });
      const events = new Subject<ChatTurnEvent>();
      const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
      spies.chatService.runAgenticLoop.and.returnValue(events.asObservable());
      await configureBed(spies);

      const fixture = TestBed.createComponent(ChatPageComponent);
      fixture.detectChanges();
      selectActive(fixture, 'c-1');

      spies.chatService.getConversation.calls.reset();
      fixture.componentInstance.onSendMessage('hi');

      // appendUserMessage refresh + each event refresh re-reads the conversation.
      events.next({ kind: 'tool_use_started', toolUseId: 't1', toolName: 'query_weight_entries', input: {} });
      events.next({ kind: 'tool_result', toolUseId: 't1', summary: '20 total' });
      events.next({ kind: 'assistant_text', blocks: [{ type: 'text', text: 'Your weight is trending down.' }] });

      // 1 (appendUserMessage refresh) + 3 (events) = 4 storage refreshes.
      expect(spies.chatService.getConversation).toHaveBeenCalledTimes(4);
    });

    it('a turn_limit event renders the LOCKED notice with role="status"', async () => {
      const conv = createValidConversation({ id: 'c-1' });
      const events = new Subject<ChatTurnEvent>();
      const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
      spies.chatService.runAgenticLoop.and.returnValue(events.asObservable());
      await configureBed(spies);

      const fixture = TestBed.createComponent(ChatPageComponent);
      fixture.detectChanges();
      selectActive(fixture, 'c-1');
      fixture.componentInstance.onSendMessage('hi');

      events.next({ kind: 'turn_limit', turnsUsed: 8 });
      fixture.detectChanges();

      expect(fixture.componentInstance.turnLimitNotice)
        .toBe('Reached the tool-use limit (8 turns) — answering with the data gathered so far.');
      const compiled = fixture.nativeElement as HTMLElement;
      const notice = compiled.querySelector('.loop-notice[role="status"]');
      expect(notice?.textContent).toContain('Reached the tool-use limit (8 turns)');
      expect(notice?.getAttribute('aria-live')).toBe('polite');
    });

    it('a done max_tokens event renders the LOCKED truncation notice', async () => {
      const conv = createValidConversation({ id: 'c-1' });
      const events = new Subject<ChatTurnEvent>();
      const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
      spies.chatService.runAgenticLoop.and.returnValue(events.asObservable());
      await configureBed(spies);

      const fixture = TestBed.createComponent(ChatPageComponent);
      fixture.detectChanges();
      selectActive(fixture, 'c-1');
      fixture.componentInstance.onSendMessage('hi');

      events.next({ kind: 'done', stopReason: 'max_tokens' });
      fixture.detectChanges();

      expect(fixture.componentInstance.terminalNotice)
        .toBe('This answer was cut off at the length limit. Ask me to continue if you\'d like the rest.');
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.loop-notice--terminal')?.textContent)
        .toContain('cut off at the length limit');
    });

    it('a done refusal event renders the LOCKED refusal message', async () => {
      const conv = createValidConversation({ id: 'c-1' });
      const events = new Subject<ChatTurnEvent>();
      const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
      spies.chatService.runAgenticLoop.and.returnValue(events.asObservable());
      await configureBed(spies);

      const fixture = TestBed.createComponent(ChatPageComponent);
      fixture.detectChanges();
      selectActive(fixture, 'c-1');
      fixture.componentInstance.onSendMessage('hi');

      events.next({ kind: 'done', stopReason: 'refusal' });
      fixture.detectChanges();

      expect(fixture.componentInstance.terminalNotice).toBe("I'm not able to answer that one.");
    });

    it('a done end_turn event renders NO terminal notice (normal completion)', async () => {
      const conv = createValidConversation({ id: 'c-1' });
      const events = new Subject<ChatTurnEvent>();
      const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
      spies.chatService.runAgenticLoop.and.returnValue(events.asObservable());
      await configureBed(spies);

      const fixture = TestBed.createComponent(ChatPageComponent);
      fixture.detectChanges();
      selectActive(fixture, 'c-1');
      fixture.componentInstance.onSendMessage('hi');

      events.next({ kind: 'done', stopReason: 'end_turn' });
      events.complete();
      fixture.detectChanges();

      expect(fixture.componentInstance.terminalNotice).toBe('');
      expect(fixture.componentInstance.sending).toBeFalse();
    });

    it('the loop subscription is piped through takeUntilDestroyed — teardown stops further event processing (T-04-06-01)', async () => {
      const conv = createValidConversation({ id: 'c-1' });
      const events = new Subject<ChatTurnEvent>();
      const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
      spies.chatService.runAgenticLoop.and.returnValue(events.asObservable());
      await configureBed(spies);

      const fixture = TestBed.createComponent(ChatPageComponent);
      fixture.detectChanges();
      selectActive(fixture, 'c-1');
      fixture.componentInstance.onSendMessage('hi');

      // The component subscribed to the loop.
      expect(events.observed).toBeTrue();

      // Tear down the component → takeUntilDestroyed unsubscribes.
      fixture.destroy();
      expect(events.observed).toBeFalse();

      // A post-teardown emission is NOT processed (no notice set).
      events.next({ kind: 'turn_limit', turnsUsed: 8 });
      expect(fixture.componentInstance.turnLimitNotice).toBe('');
    });

    it('a 401 AnthropicApiError still routes to the inline 401 banner (existing behavior preserved)', async () => {
      const conv = createValidConversation({ id: 'c-1' });
      const events = new Subject<ChatTurnEvent>();
      const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
      spies.chatService.runAgenticLoop.and.returnValue(events.asObservable());
      await configureBed(spies);

      const fixture = TestBed.createComponent(ChatPageComponent);
      fixture.detectChanges();
      selectActive(fixture, 'c-1');
      fixture.componentInstance.onSendMessage('hi');

      events.error(new AnthropicApiError('Unauthorized', 401));
      fixture.detectChanges();

      expect(fixture.componentInstance.errorMessage).toContain('Invalid API key');
      expect(fixture.componentInstance.loopError).toBeFalse();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.error-banner[role="alert"]')).toBeTruthy();
    });

    it('a generic transport error surfaces <app-error-state> with Retry (T-04-06-04)', async () => {
      const conv = createValidConversation({ id: 'c-1' });
      const events = new Subject<ChatTurnEvent>();
      const spies = makeSpies({ hasApiKey: true, conversations: [conv], activeConversation: conv });
      spies.chatService.runAgenticLoop.and.returnValue(events.asObservable());
      await configureBed(spies);

      const fixture = TestBed.createComponent(ChatPageComponent);
      fixture.detectChanges();
      selectActive(fixture, 'c-1');
      fixture.componentInstance.onSendMessage('hi');

      events.error(new Error('network down'));
      fixture.detectChanges();

      expect(fixture.componentInstance.loopError).toBeTrue();
      const compiled = fixture.nativeElement as HTMLElement;
      const errorState = compiled.querySelector('app-error-state');
      expect(errorState).toBeTruthy();
      expect(errorState?.textContent).toContain("The AI request didn't go through");
      // Retry re-invokes the loop for the last user message.
      spies.chatService.runAgenticLoop.calls.reset();
      const retryEvents = new Subject<ChatTurnEvent>();
      spies.chatService.runAgenticLoop.and.returnValue(retryEvents.asObservable());
      fixture.componentInstance.onRetryLoop();
      expect(spies.chatService.runAgenticLoop).toHaveBeenCalledWith('c-1', 'sk-ant-test-key');
    });
  });
});
