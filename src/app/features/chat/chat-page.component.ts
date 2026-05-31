import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { from } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AISettingsService } from '../../services/ai-settings.service';
import { StorageService } from '../../services/storage.service';
import { PendingApprovalService } from '../../services/pending-approval.service';
import { ChatBlock, ChatConversation, ChatMessage, ChatTurnEvent, ToolUseBlock } from '../../models/ai-chat.model';
import { AnthropicApiError } from '../../services/anthropic-api.service';
import { ChatConversationListComponent } from './chat-conversation-list.component';
import { ChatMessageListComponent } from './chat-message-list.component';
import { ChatInputComponent } from './chat-input.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ChatConversationListComponent,
    ChatMessageListComponent,
    ChatInputComponent,
    EmptyStateComponent,
    ErrorStateComponent
  ],
  template: `
    <div class="chat-layout">
      @if (!hasApiKey) {
        <app-error-state
          title="Anthropic API key required"
          [message]="'Configure your API key in Settings to use the AI chat.'"
        >
          <a routerLink="/settings" class="btn-primary">Go to Settings</a>
        </app-error-state>
      } @else {
        <aside class="sidebar">
          <app-chat-conversation-list
            [conversations]="conversations"
            [activeId]="activeConversationId"
            (select)="onSelectConversation($event)"
            (delete)="onDeleteConversation($event)"
            (newChat)="onNewChat()"
          />
        </aside>

        <main class="chat-main">
          @if (activeConversation) {
            <header class="chat-header">
              <h2>{{ activeConversation.title }}</h2>
            </header>

            <app-chat-message-list
              [messages]="activeConversation.messages"
              [conversationId]="activeConversation.id"
              [loading]="sending"
              (blockAction)="onBlockAction($event)"
            />

            @if (turnLimitNotice) {
              <div class="loop-notice" role="status" aria-live="polite">
                {{ turnLimitNotice }}
              </div>
            }

            @if (terminalNotice) {
              <div class="loop-notice loop-notice--terminal" role="status" aria-live="polite">
                {{ terminalNotice }}
              </div>
            }

            @if (apiKeyRejected) {
              <!--
                QUAL-07: a 401 from Anthropic surfaces a specific "rotate /
                re-enter key" prompt (LOCKED 05-UI-SPEC copy) with a focal
                "Go to settings" path to /settings/ai — never a console-only
                error. Secondary Retry re-runs the loop once the key is fixed.
                <app-error-state> provides role="alert" aria-live="assertive".
              -->
              <app-error-state
                title="Your API key was rejected"
                [message]="'Anthropic returned a 401. Your key may be expired, revoked, or mistyped. Re-enter it in settings, then try again.'"
                (retry)="onRetryLoop()"
              >
                <a routerLink="/settings/ai" class="btn-primary">Go to settings</a>
              </app-error-state>
            } @else if (loopError) {
              <app-error-state
                title="The AI request didn't go through"
                [message]="'Something interrupted the request. Check your connection and API key, then try again.'"
                (retry)="onRetryLoop()"
              />
            }

            @if (blockActionError) {
              <!--
                QUAL-09 (folded IN-01): an approve/discard/edit failure is now
                user-visible via <app-error-state> (LOCKED copy) instead of a
                console.error-only swallow. {action} ∈ save this to memory /
                discard this / apply this edit.
              -->
              <app-error-state
                title="That action didn't go through"
                [message]="blockActionError"
              >
                <button type="button" class="btn-secondary" (click)="blockActionError = ''">Dismiss</button>
              </app-error-state>
            }

            @if (errorMessage) {
              <div class="error-banner" role="alert">
                {{ errorMessage }}
                <button (click)="errorMessage = ''" aria-label="Dismiss error">&times;</button>
              </div>
            }

            <app-chat-input
              [disabled]="sending"
              (send)="onSendMessage($event)"
            />
          } @else {
            @if (conversations.length === 0) {
              <app-empty-state
                title="No conversations yet"
                message="Start a new chat to begin."
              >
                <button type="button" class="btn-primary" (click)="onNewChat()">Start a conversation</button>
              </app-empty-state>
            } @else {
              <div class="no-conversation">
                <p>Select a conversation or start a new chat.</p>
              </div>
            }
          }
        </main>
      }
    </div>
  `,
  styles: [`
    .chat-layout {
      display: flex;
      height: calc(100vh - 120px);
    }

    .sidebar {
      width: 280px;
      min-width: 280px;
      border-right: 1px solid #e0e0e0;
      background: #fafafa;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .chat-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    .chat-header {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e0e0e0;
      background: white;
    }

    .chat-header h2 {
      margin: 0;
      font-size: 1.1rem;
      color: #2c3e50;
    }

    .no-key-prompt {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      text-align: center;
      padding: 2rem;
      color: #555;
    }

    .no-key-prompt h2 {
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }

    .btn-primary {
      display: inline-block;
      padding: 0.625rem 1.5rem;
      margin-top: 1rem;
      /* QUAL-08: #2471a3 → white text 5.30:1 (was #3498db 3.15:1). */
      background: #2471a3;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
    }

    .btn-primary:hover {
      background: #1d5a82;
    }

    .no-conversation {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      /* QUAL-08: #5f6c6d → 5.45:1 on white (was #999 2.85:1). */
      color: #5f6c6d;
    }

    .error-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 1rem;
      margin: 0 1rem;
      background: #f8d7da;
      color: #721c24;
      border-radius: 4px;
      font-size: 0.875rem;
    }

    .error-banner button {
      background: none;
      border: none;
      cursor: pointer;
      color: #721c24;
      font-size: 1.25rem;
      padding: 0 0.25rem;
    }

    .loop-notice {
      padding: 0.625rem 1rem;
      margin: 0 1rem;
      background: #eef2f7;
      color: #2c3e50;
      border-radius: 4px;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .loop-notice--terminal {
      background: #f4f1ea;
      color: #5a4a2c;
    }
  `]
})
export class ChatPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  conversations: ChatConversation[] = [];
  activeConversationId: string | null = null;
  activeConversation: ChatConversation | null = null;
  hasApiKey = false;
  sending = false;
  errorMessage = '';

  /**
   * LOCKED turn-limit notice copy (04-UI-SPEC D-04). Set when the loop emits a
   * `turn_limit` event; rendered role="status" aria-live="polite". Empty when
   * the loop did not hit the cap.
   */
  turnLimitNotice = '';

  /**
   * LOCKED terminal-state notice copy (04-UI-SPEC D-16). Set on a `done` event
   * with `stopReason` 'max_tokens' (truncation) or 'refusal'. Empty for normal
   * 'end_turn' / 'stop_sequence' completion.
   */
  terminalNotice = '';

  /**
   * True when the in-flight loop failed with a transport/SDK error (network,
   * generic API error). Drives the recoverable <app-error-state> with Retry.
   * The 401 path stays on the inline `errorMessage` banner (Phase 5 owns the
   * rotate-key UX — 04-UI-SPEC).
   */
  loopError = false;

  /**
   * QUAL-07: true when the in-flight loop failed with a 401 (rejected API key).
   * Drives the LOCKED rotate-key <app-error-state> with a `Go to settings`
   * focal action — distinct from the generic `loopError` transport surface.
   */
  apiKeyRejected = false;

  /**
   * QUAL-09 (folded IN-01): LOCKED block-action failure body, set when an
   * approve/discard/edit persistence call errors. Renders the
   * "That action didn't go through" <app-error-state> instead of a
   * console.error-only swallow. Empty when no block action has failed.
   */
  blockActionError = '';

  /** Last user message text — re-sent when the user clicks Retry on a loop error. */
  private lastUserMessage = '';

  /**
   * Set once the component is torn down. takeUntilDestroyed completes the loop
   * subscription on destroy, which fires its `complete` handler — that handler
   * must NOT re-subscribe through `takeUntilDestroyed(this.destroyRef)` on an
   * already-destroyed ref (NG0911). This flag short-circuits the post-loop
   * refresh in that race.
   */
  private destroyed = false;

  constructor(
    private chatService: ChatService,
    private aiSettingsService: AISettingsService,
    private storageService: StorageService,
    private pendingApprovalService: PendingApprovalService
  ) {
    this.destroyRef.onDestroy(() => { this.destroyed = true; });
  }

  ngOnInit(): void {
    this.storageService.initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.aiSettingsService.hasValidApiKey()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(valid => {
            this.hasApiKey = valid;
            if (valid) {
              this.initializeActiveConversation();
            }
          });
      });
  }

  /**
   * Init-time orchestration: load conversations and auto-select the
   * most-recent (plan 03-06). The Phase 3 dev-only seed machinery (the
   * synthetic pending-pill injection on init) was REMOVED in plan 04-06:
   * real write proposals (D-03) now surface through the live agentic loop,
   * so a synthetic pill injected on init could collide with / be mistaken
   * for a real proposal (T-04-06-03). Auto-create on an empty list is
   * likewise dropped — the empty-state surface is the correct view when no
   * conversation exists (Phase 1 characterization spec preserved).
   */
  private initializeActiveConversation(): void {
    this.chatService.getConversations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(convs => {
        this.conversations = convs;

        if (convs.length > 0) {
          // Auto-select most-recent (getConversations sorts by updatedAt DESC).
          const first = convs[0];
          this.activeConversationId = first.id;
          this.activeConversation = first;
        }
        // Empty list → leave activeConversation null; the empty-state surface
        // renders (Phase 1 spec preserved).
      });
  }

  /**
   * Handle (blockAction) Output emitted by chat-message-list. Dispatches to
   * chat.service.updateMessageBlock with a per-action patch. On success,
   * re-reads the active conversation so the UI reflects the new status.
   * (Plan 03-05 Task 3; D-11.)
   */
  onBlockAction(event: {
    messageId: string;
    blockIndex: number;
    action: 'approve' | 'discard' | 'edit';
    editedText?: string;
  }): void {
    if (!this.activeConversationId) return;
    const conversationId = this.activeConversationId;
    const { messageId, blockIndex, action, editedText } = event;

    if (action === 'approve') {
      const block = this.findToolUseBlock(messageId, blockIndex);
      if (!block) return;
      // Execute the approved tool (via the SC5-clean PendingApprovalService
      // seam) → then persist status + paired tool_result atomically.
      from(this.pendingApprovalService.executeApprovedToolUse(block))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (result: { content: string; isError: boolean }) => {
            this.chatService.approveToolUseBlock(conversationId, messageId, blockIndex, result)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: () => {
                  // Refresh active conversation to surface approved pill + result.
                  this.chatService.getConversation(conversationId)
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe(conv => { this.activeConversation = conv; });
                },
                error: (err: unknown) => this.surfaceBlockActionError('save this to memory', err),
              });
          },
          error: (err: unknown) => this.surfaceBlockActionError('save this to memory', err),
        });
      return;
    }

    // discard / edit — status-only patch via updateMessageBlock, now stamping
    // a real resolvedAt so the pending pill renders an honest resolved time.
    const resolvedAt = new Date().toISOString();
    let patch: Partial<ToolUseBlock> | null = null;
    if (action === 'discard') {
      patch = { status: 'discarded', resolvedAt };
    } else if (action === 'edit') {
      const block = this.findToolUseBlock(messageId, blockIndex);
      if (block) {
        patch = {
          status: 'edited',
          editedFromText: this.extractEditableText(block),
          input: this.applyEditedText(block, editedText ?? ''),
          resolvedAt,
        };
      }
    }

    if (!patch) return;

    this.chatService.updateMessageBlock(conversationId, messageId, blockIndex, patch)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Refresh active conversation to render the new resolved-state badge.
          this.chatService.getConversation(conversationId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(conv => { this.activeConversation = conv; });
        },
        error: (err: unknown) =>
          this.surfaceBlockActionError(action === 'edit' ? 'apply this edit' : 'discard this', err),
      });
  }

  /**
   * QUAL-09 (folded IN-01): surface an approve/discard/edit failure to the user
   * via the "That action didn't go through" <app-error-state> with the LOCKED
   * body `We couldn't {action} just now. Try again.` — replacing the prior
   * console.error-only swallow that left the user with no feedback (T-05-09-02).
   * A dev-diagnostic console.error is kept for the developer console.
   */
  private surfaceBlockActionError(
    action: 'save this to memory' | 'discard this' | 'apply this edit',
    err: unknown,
  ): void {
    this.blockActionError = `We couldn't ${action} just now. Try again.`;
    console.error('[chat-page] block-action failed', action, err);
  }

  private findToolUseBlock(messageId: string, blockIndex: number): ToolUseBlock | null {
    const msg = this.activeConversation?.messages.find(m => m.id === messageId);
    if (!msg) return null;
    const block = msg.blocks[blockIndex] as ChatBlock | undefined;
    if (!block || block.type !== 'tool_use') return null;
    return block;
  }

  private extractEditableText(block: ToolUseBlock): string {
    const input = block.input as Record<string, unknown> | null | undefined;
    if (!input || typeof input !== 'object') return '';
    const candidate = input['file_text'] ?? input['value'] ?? input['new_str'] ?? '';
    return typeof candidate === 'string' ? candidate : '';
  }

  private applyEditedText(block: ToolUseBlock, newText: string): unknown {
    const input = (block.input as Record<string, unknown> | null | undefined) ?? {};
    if (block.name === 'memory') return { ...input, file_text: newText };
    if (block.name === 'update_profile') return { ...input, value: newText };
    return { ...input, value: newText };
  }

  loadConversations(): void {
    this.chatService.getConversations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(convs => {
        this.conversations = convs;
        if (this.activeConversationId) {
          this.activeConversation = convs.find(c => c.id === this.activeConversationId) ?? null;
        }
      });
  }

  onSelectConversation(id: string): void {
    this.activeConversationId = id;
    this.chatService.getConversation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(conv => {
        this.activeConversation = conv;
      });
    this.errorMessage = '';
  }

  onNewChat(): void {
    this.chatService.createConversation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(conv => {
        this.activeConversationId = conv.id;
        this.activeConversation = conv;
        this.loadConversations();
      });
    this.errorMessage = '';
  }

  onDeleteConversation(id: string): void {
    this.chatService.deleteConversation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(deleted => {
        if (deleted) {
          if (this.activeConversationId === id) {
            this.activeConversationId = null;
            this.activeConversation = null;
          }
          this.loadConversations();
        }
      });
  }

  /**
   * Drive the Wave 2 agentic loop (`ChatService.runAgenticLoop`) from a user
   * message (Plan 04-06; CHAT-05/CHAT-06). Persists the user turn to disk,
   * then subscribes to the MULTI-EMIT loop Observable: each `ChatTurnEvent`
   * refreshes the rendered transcript (in-flight tool rows → resolved
   * summaries → final prose, D-01) and the terminal/turn-limit notices.
   *
   * The subscription is piped through `takeUntilDestroyed(this.destroyRef)` —
   * navigating away mid-loop tears it down, which flips the loop's `cancelled`
   * flag and stops it calling the API (stops billing — T-04-06-01).
   */
  onSendMessage(text: string): void {
    if (!this.activeConversationId || this.sending) return;

    const conversationId = this.activeConversationId;
    this.lastUserMessage = text;
    this.beginLoopUiState();

    // Persist the user turn FIRST (the loop reads the transcript from disk),
    // then start the loop with the user's API key.
    this.aiSettingsService.getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: settings => {
          const apiKey = settings.apiKey;
          if (!apiKey) {
            this.sending = false;
            this.errorMessage = 'No API key configured. Please add your key in Settings.';
            return;
          }
          this.chatService.appendUserMessage(conversationId, text)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.refreshActiveConversation(conversationId);
                this.startAgenticLoop(conversationId, apiKey);
              },
              error: err => this.handleLoopError(err),
            });
        },
        error: err => this.handleLoopError(err),
      });
  }

  /**
   * Re-run the loop for the last user message after a transport failure
   * (the Retry button on the loop <app-error-state>). The user message is
   * already on disk from the failed attempt, so this only re-invokes the loop.
   */
  onRetryLoop(): void {
    if (!this.activeConversationId || this.sending || !this.lastUserMessage) return;
    const conversationId = this.activeConversationId;
    this.aiSettingsService.getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: settings => {
          const apiKey = settings.apiKey;
          if (!apiKey) {
            this.errorMessage = 'No API key configured. Please add your key in Settings.';
            return;
          }
          this.beginLoopUiState();
          this.startAgenticLoop(conversationId, apiKey);
        },
        error: err => this.handleLoopError(err),
      });
  }

  /** Reset the per-send loop UI state (notices, errors, spinner). */
  private beginLoopUiState(): void {
    this.sending = true;
    this.errorMessage = '';
    this.turnLimitNotice = '';
    this.terminalNotice = '';
    this.loopError = false;
    this.apiKeyRejected = false;
  }

  /**
   * Subscribe to the multi-emit loop. `next` renders each incremental event;
   * `error` maps transport/401 failures; `complete` clears the spinner.
   * `takeUntilDestroyed` is the cancellation seam (T-04-06-01).
   */
  private startAgenticLoop(conversationId: string, apiKey: string): void {
    this.chatService.runAgenticLoop(conversationId, apiKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: event => this.handleTurnEvent(event, conversationId),
        error: err => this.handleLoopError(err),
        complete: () => {
          // takeUntilDestroyed completes this stream on teardown too — guard
          // the re-subscriptions so they never hit a destroyed DestroyRef.
          if (this.destroyed) return;
          this.sending = false;
          this.loadConversations();
          this.refreshActiveConversation(conversationId);
        },
      });
  }

  /**
   * Render one incremental loop event (D-01). The loop persists each block to
   * storage as it emits, so `tool_use_started` / `tool_result` /
   * `assistant_text` just refresh the active conversation so the extended
   * message-list (Plan 05) re-renders the new in-flight / resolved / prose
   * blocks. Focus is NOT moved per event (04-UI-SPEC Focus management — focus
   * stays on the chat input; only a surfaced pending-pill moves focus, which
   * is the pill's own existing behavior).
   */
  private handleTurnEvent(event: ChatTurnEvent, conversationId: string): void {
    switch (event.kind) {
      case 'tool_use_started':
      case 'tool_result':
      case 'assistant_text':
        this.refreshActiveConversation(conversationId);
        return;
      case 'turn_limit':
        // LOCKED copy (04-UI-SPEC D-04).
        this.turnLimitNotice =
          `Reached the tool-use limit (${event.turnsUsed} turns) — answering with the data gathered so far.`;
        return;
      case 'done':
        this.applyTerminalNotice(event.stopReason);
        return;
    }
  }

  /**
   * Map a terminal `stopReason` to the LOCKED terminal-state notice (D-16).
   * 'max_tokens' → truncation notice; 'refusal' → honest refusal message;
   * 'end_turn' / 'stop_sequence' / 'pause_turn' → no notice.
   */
  private applyTerminalNotice(stopReason: string): void {
    if (stopReason === 'max_tokens') {
      this.terminalNotice =
        'This answer was cut off at the length limit. Ask me to continue if you\'d like the rest.';
    } else if (stopReason === 'refusal') {
      this.terminalNotice = "I'm not able to answer that one.";
    }
  }

  /**
   * Map a loop transport failure (QUAL-07). A 401 (rejected API key) surfaces a
   * specific rotate-key <app-error-state> with a `Go to settings` focal action
   * (the user's path out — 05-UI-SPEC), NOT the old inline "Invalid API key"
   * banner and never a console-only error. Any other error surfaces the generic
   * recoverable <app-error-state> with Retry (T-04-06-04).
   */
  private handleLoopError(err: unknown): void {
    this.sending = false;
    if (err instanceof AnthropicApiError && err.statusCode === 401) {
      this.apiKeyRejected = true;
      this.loopError = false;
      this.errorMessage = '';
    } else {
      this.apiKeyRejected = false;
      this.loopError = true;
    }
    // Refresh so any persisted partial transcript (user turn, tool rows) shows.
    if (this.activeConversationId) {
      this.refreshActiveConversation(this.activeConversationId);
    }
  }

  /** Re-read the active conversation from storage so the view reflects disk. */
  private refreshActiveConversation(conversationId: string): void {
    if (this.destroyed) return;
    this.chatService.getConversation(conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(conv => {
        if (conv) this.activeConversation = conv;
      });
  }
}
