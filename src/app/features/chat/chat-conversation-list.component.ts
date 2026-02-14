import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatConversation } from '../../models/ai-chat.model';

@Component({
  selector: 'app-chat-conversation-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="conversation-list">
      <button class="new-chat-btn" (click)="newChat.emit()" aria-label="Start new chat">
        + New Chat
      </button>

      <ul class="conversations" role="list">
        @for (conv of conversations; track conv.id) {
          <li
            class="conversation-item"
            [class.active]="conv.id === activeId"
            role="listitem"
          >
            <button
              class="conversation-btn"
              (click)="select.emit(conv.id)"
              [attr.aria-current]="conv.id === activeId ? 'true' : null"
              [title]="conv.title"
            >
              <span class="conv-title">{{ conv.title }}</span>
              <span class="conv-date">{{ conv.updatedAt | date:'short' }}</span>
            </button>
            <button
              class="delete-btn"
              (click)="delete.emit(conv.id); $event.stopPropagation()"
              aria-label="Delete conversation"
              title="Delete"
            >
              &times;
            </button>
          </li>
        } @empty {
          <li class="empty-state">No conversations yet</li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .conversation-list {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .new-chat-btn {
      padding: 0.75rem 1rem;
      margin: 0.75rem;
      background: #3498db;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .new-chat-btn:hover {
      background: #2980b9;
    }

    .conversations {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      flex: 1;
    }

    .conversation-item {
      display: flex;
      align-items: center;
      border-bottom: 1px solid #ecf0f1;
    }

    .conversation-item.active {
      background: #ebf5fb;
    }

    .conversation-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0.75rem 1rem;
      background: none;
      border: none;
      cursor: pointer;
      text-align: left;
      min-width: 0;
    }

    .conversation-btn:hover {
      background: #f5f6fa;
    }

    .conv-title {
      font-size: 0.9rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .conv-date {
      font-size: 0.75rem;
      color: #888;
      margin-top: 0.125rem;
    }

    .delete-btn {
      padding: 0.5rem;
      margin-right: 0.5rem;
      background: none;
      border: none;
      cursor: pointer;
      color: #999;
      font-size: 1.25rem;
      line-height: 1;
    }

    .delete-btn:hover {
      color: #e74c3c;
    }

    .empty-state {
      padding: 1.5rem 1rem;
      text-align: center;
      color: #999;
      font-size: 0.875rem;
    }
  `]
})
export class ChatConversationListComponent {
  @Input() conversations: ChatConversation[] = [];
  @Input() activeId: string | null = null;
  @Output() select = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() newChat = new EventEmitter<void>();
}
