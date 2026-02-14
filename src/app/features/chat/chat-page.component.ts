import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AISettingsService } from '../../services/ai-settings.service';
import { StorageService } from '../../services/storage.service';
import { ChatConversation, ChatMessage } from '../../models/ai-chat.model';
import { AnthropicApiError } from '../../services/anthropic-api.service';
import { ChatConversationListComponent } from './chat-conversation-list.component';
import { ChatMessageListComponent } from './chat-message-list.component';
import { ChatInputComponent } from './chat-input.component';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ChatConversationListComponent,
    ChatMessageListComponent,
    ChatInputComponent
  ],
  template: `
    <div class="chat-layout">
      @if (!hasApiKey) {
        <div class="no-key-prompt">
          <h2>AI Chat Assistant</h2>
          <p>To use the AI chat, please configure your Anthropic API key.</p>
          <a routerLink="/settings" class="btn-primary">Go to Settings</a>
        </div>
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
            <div class="no-conversation">
              <p>Select a conversation or start a new chat.</p>
            </div>
          }
        </main>
      }
    </div>
  `,
  styles: [`
    .chat-layout {
      display: flex;
      height: calc(100vh - 60px);
      overflow: hidden;
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
    this.storageService.initialize().subscribe(() => {
      this.aiSettingsService.hasValidApiKey().subscribe(valid => {
        this.hasApiKey = valid;
        if (valid) {
          this.loadConversations();
        }
      });
    });
  }

  loadConversations(): void {
    this.chatService.getConversations().subscribe(convs => {
      this.conversations = convs;
      if (this.activeConversationId) {
        this.activeConversation = convs.find(c => c.id === this.activeConversationId) ?? null;
      }
    });
  }

  onSelectConversation(id: string): void {
    this.activeConversationId = id;
    this.chatService.getConversation(id).subscribe(conv => {
      this.activeConversation = conv;
    });
    this.errorMessage = '';
  }

  onNewChat(): void {
    this.chatService.createConversation().subscribe(conv => {
      this.activeConversationId = conv.id;
      this.activeConversation = conv;
      this.loadConversations();
    });
    this.errorMessage = '';
  }

  onDeleteConversation(id: string): void {
    this.chatService.deleteConversation(id).subscribe(deleted => {
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

    this.chatService.sendMessage(this.activeConversationId, text).subscribe({
      next: () => {
        this.sending = false;
        this.loadConversations();
        // Refresh active conversation to show new messages
        if (this.activeConversationId) {
          this.chatService.getConversation(this.activeConversationId).subscribe(conv => {
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
          this.chatService.getConversation(this.activeConversationId).subscribe(conv => {
            this.activeConversation = conv;
          });
        }
      }
    });
  }
}
