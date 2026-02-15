import { Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../models/ai-chat.model';

@Component({
  selector: 'app-chat-message-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="message-list" #scrollContainer>
      @for (msg of messages; track msg.id) {
        <div class="message" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
          <div class="message-role">{{ msg.role === 'user' ? 'You' : 'AI Assistant' }}</div>
          <div class="message-content">{{ msg.content }}</div>
          <div class="message-time">{{ msg.createdAt | date:'shortTime' }}</div>
        </div>
      } @empty {
        <div class="empty-state">
          <p>Start a conversation with your AI fitness assistant.</p>
          <p>Ask about your workout trends, nutrition advice, or health goals.</p>
        </div>
      }

      @if (loading) {
        <div class="message assistant">
          <div class="message-role">AI Assistant</div>
          <div class="message-content loading-dots">Thinking<span>...</span></div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .message-list {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .message {
      max-width: 80%;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      line-height: 1.5;
    }

    .message.user {
      align-self: flex-end;
      background: #3498db;
      color: white;
    }

    .message.assistant {
      align-self: flex-start;
      background: #f0f0f0;
      color: #2c3e50;
    }

    .message-role {
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
      opacity: 0.8;
    }

    .message-content {
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .message-time {
      font-size: 0.7rem;
      opacity: 0.6;
      margin-top: 0.375rem;
      text-align: right;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: #999;
      text-align: center;
      padding: 2rem;
    }

    .empty-state p {
      margin: 0.25rem 0;
    }

    .loading-dots span {
      animation: blink 1.4s infinite;
    }

    @keyframes blink {
      0%, 20% { opacity: 0; }
      50% { opacity: 1; }
      100% { opacity: 0; }
    }
  `]
})
export class ChatMessageListComponent implements OnChanges {
  @Input() messages: ChatMessage[] = [];
  @Input() loading = false;
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

  ngOnChanges(): void {
    setTimeout(() => this.scrollToBottom(), 0);
  }

  private scrollToBottom(): void {
    if (this.scrollContainer) {
      const el = this.scrollContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
