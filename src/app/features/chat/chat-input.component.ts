import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form class="chat-input-form" (ngSubmit)="onSend()" aria-label="Send message">
      <textarea
        [(ngModel)]="messageText"
        name="messageText"
        placeholder="Ask about your fitness data, goals, or health..."
        [disabled]="disabled"
        (keydown.enter)="onKeyDown($event)"
        rows="2"
        aria-label="Message input"
      ></textarea>
      <button
        type="submit"
        [disabled]="disabled || !messageText.trim()"
        aria-label="Send message"
      >
        Send
      </button>
    </form>
  `,
  styles: [`
    .chat-input-form {
      display: flex;
      gap: 0.5rem;
      padding: 1rem;
      border-top: 1px solid #e0e0e0;
      background: white;
    }

    textarea {
      flex: 1;
      padding: 0.625rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.9rem;
      font-family: inherit;
      resize: none;
      line-height: 1.4;
    }

    textarea:focus {
      outline: none;
      border-color: #3498db;
    }

    button {
      padding: 0.625rem 1.5rem;
      background: #3498db;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      align-self: flex-end;
    }

    button:hover:not(:disabled) {
      background: #2980b9;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class ChatInputComponent {
  @Input() disabled = false;
  @Output() send = new EventEmitter<string>();

  messageText = '';

  onSend(): void {
    const text = this.messageText.trim();
    if (text && !this.disabled) {
      this.send.emit(text);
      this.messageText = '';
    }
  }

  onKeyDown(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (!keyEvent.shiftKey) {
      keyEvent.preventDefault();
      this.onSend();
    }
  }
}
