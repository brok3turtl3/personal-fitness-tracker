import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AISettingsService } from '../../services/ai-settings.service';
import { StorageService } from '../../services/storage.service';
import { ChatBlock, ChatConversation, ChatMessage, ToolUseBlock } from '../../models/ai-chat.model';
import { AnthropicApiError } from '../../services/anthropic-api.service';
import { generateId } from '../../shared/id';
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
              [loading]="sending"
              (blockAction)="onBlockAction($event)"
            />

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
      background: #3498db;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
    }

    .btn-primary:hover {
      background: #2980b9;
    }

    .no-conversation {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: #999;
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

  constructor(
    private chatService: ChatService,
    private aiSettingsService: AISettingsService,
    private storageService: StorageService
  ) {}

  ngOnInit(): void {
    this.storageService.initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.aiSettingsService.hasValidApiKey()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(valid => {
            this.hasApiKey = valid;
            if (valid) {
              this.initializeActiveConversationAndConsumeSeed();
            }
          });
      });
  }

  /**
   * Init-time orchestration: load conversations, auto-select the most-recent
   * (or auto-create one if a dev seed is present and no conversations exist),
   * then consume the dev-seed sentinel. Fixes UAT Test 2 (plan 03-06 gap
   * closure): the previous `loadConversations(); consumeDevSeedIfPresent();`
   * pair ran the seed consumer before any activeConversationId was assigned,
   * silently destroying the sentinel.
   *
   * Auto-create is GATED on a non-null dev seed — without that gate, the
   * Phase 1 empty-state characterization spec ("renders <app-empty-state>
   * when no conversations exist") would break.
   */
  private initializeActiveConversationAndConsumeSeed(): void {
    this.chatService.getConversations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(convs => {
        this.conversations = convs;

        // Capture the seed first so we can decide whether to auto-create.
        // consumeDevSeed() is read-and-remove — once we call it we MUST act
        // on the value (or accept it's destroyed). The capture-then-branch
        // sequence below ensures we never destroy a seed we can't honor.
        const seed = this.storageService.consumeDevSeed();

        if (convs.length > 0) {
          // Auto-select most-recent (getConversations sorts by updatedAt DESC).
          const first = convs[0];
          this.activeConversationId = first.id;
          this.activeConversation = first;
          if (seed) {
            this.appendSeededPill(first.id, seed);
          }
        } else if (seed) {
          // Empty list + non-null seed → auto-create so the pill has a home.
          this.chatService.createConversation()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: conv => {
                this.conversations = [conv];
                this.activeConversationId = conv.id;
                this.activeConversation = conv;
                this.appendSeededPill(conv.id, seed);
              },
              error: err => console.error('[chat-page] auto-create conversation failed', err),
            });
        }
        // Empty list + no seed → leave activeConversation null; empty-state
        // surface renders (Phase 1 spec preserved).
      });
  }

  /**
   * Build the synthetic pending ToolUseBlock for the supplied dev-seed kind
   * and append it to the active conversation via chat.service. Extracted from
   * the previous body of consumeDevSeedIfPresent() so both the init path AND
   * the legacy direct-call path (kept for backwards compat with existing
   * specs) share a single block builder.
   */
  private appendSeededPill(
    conversationId: string,
    seed: { kind: 'memory' | 'profile'; at: string },
  ): void {
    const block: ToolUseBlock = seed.kind === 'memory'
      ? {
          type: 'tool_use',
          id: generateId(),
          name: 'memory',
          input: {
            command: 'create',
            path: `/memories/seed-${Date.now()}.md`,
            file_text: 'This is a seeded memory proposal for development testing.',
          },
          status: 'pending',
        }
      : {
          type: 'tool_use',
          id: generateId(),
          name: 'update_profile',
          input: {
            section: 'goals',
            value: 'This is a seeded profile-update proposal for development testing.',
          },
          status: 'pending',
        };

    this.chatService.appendAssistantBlocks(conversationId, [block])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Refresh active conversation to surface the new pill in the stream.
          this.chatService.getConversation(conversationId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(conv => { this.activeConversation = conv; });
        },
        error: (err) => console.error('[chat-page] dev-seed append failed', err),
      });
  }

  /**
   * Read-and-remove the dev-seed sentinel and append a synthetic pending
   * pill to the active conversation (D-12). PUBLIC because existing specs
   * drive it directly. In production, the init path now invokes the
   * equivalent flow (via initializeActiveConversationAndConsumeSeed) BEFORE
   * the user clicks anything — see plan 03-06 for the UAT Test 2 gap fix.
   *
   * Kept on the component surface (a) for spec ergonomics and (b) as a
   * defensive re-entry point if init ever fails to consume the seed.
   */
  consumeDevSeedIfPresent(): void {
    const seed = this.storageService.consumeDevSeed();
    if (!seed) return;
    if (!this.activeConversationId) return;
    this.appendSeededPill(this.activeConversationId, seed);
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
          next: result => {
            this.chatService.approveToolUseBlock(conversationId, messageId, blockIndex, result)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: () => this.refreshActiveConversation(),
                error: err => console.error('[chat-page] approve persist failed', err),
              });
          },
          error: err => console.error('[chat-page] approve execute failed', err),
        });
      return;
    }

    // discard / edit — unchanged: status-only patch via updateMessageBlock.
    let patch: Partial<ToolUseBlock> | null = null;
    if (action === 'discard') {
      patch = { status: 'discarded' };
    } else if (action === 'edit') {
      const block = this.findToolUseBlock(messageId, blockIndex);
      if (block) {
        patch = {
          status: 'edited',
          editedFromText: this.extractEditableText(block),
          input: this.applyEditedText(block, editedText ?? ''),
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
        error: (err) => console.error('[chat-page] block-action update failed', err),
      });
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

  onSendMessage(text: string): void {
    if (!this.activeConversationId || this.sending) return;

    this.sending = true;
    this.errorMessage = '';

    this.chatService.sendMessage(this.activeConversationId, text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sending = false;
          this.loadConversations();
          // Refresh active conversation to show new messages
          if (this.activeConversationId) {
            this.chatService.getConversation(this.activeConversationId)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe(conv => {
                this.activeConversation = conv;
              });
          }
        },
        error: (err) => {
          this.sending = false;
          if (err instanceof AnthropicApiError && err.statusCode === 401) {
            this.errorMessage = 'Invalid API key. Please update it in Settings.';
          } else {
            this.errorMessage = err.message || 'Failed to send message. Please try again.';
          }
          // Still refresh to show the user message that was saved
          this.loadConversations();
          if (this.activeConversationId) {
            this.chatService.getConversation(this.activeConversationId)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe(conv => {
                this.activeConversation = conv;
              });
          }
        }
      });
  }
}
