import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolUseBlock } from '../../models/ai-chat.model';

/**
 * Pending pill — confirm-before-write UX scaffold (D-10..D-13).
 *
 * Single component handling 4 statuses (pending / approved / discarded /
 * edited) × 2 pill kinds (memory / update_profile) via inner discriminated
 * rendering on `block.name`. UI-SPEC.md copy is verbatim (no paraphrase).
 *
 * **Phase 3 dormant scaffold.** No agentic loop drives real proposals here;
 * the pill is exercised via the dev-only seed sentinel (D-12) and Karma
 * specs. Phase 4 wires the loop on top of this component without UI rewrites.
 *
 * **A11y rules (UI-SPEC.md):**
 * - Native `<button>` for all 3 actions
 * - `role="region"` + `aria-label="AI proposal: {kind}"` on the article wrapper
 * - Resolved badge has `role="status"` + `aria-live="polite"`
 * - Color is never the only indicator: glyph + label + timestamp on every badge
 * - Primary action receives focus on entering pending state (focal-point)
 */
@Component({
  selector: 'app-pending-pill',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <article class="pending-pill" role="region" [attr.aria-label]="'AI proposal: ' + pillKind()">
      @switch (block.status) {
        @case ('pending') {
          @if (editing) {
            <textarea
              [(ngModel)]="editingDraft"
              aria-label="Edit AI proposal"
              rows="6"
              class="pill-edit-textarea"
            ></textarea>
            <div class="pill-actions">
              <button #primaryAction type="button" class="btn btn-primary btn-sm" (click)="saveEdits()">Save edits</button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="cancelEdit()">Keep original</button>
            </div>
          } @else {
            <header class="pill-header">{{ pendingHeaderText() }}</header>
            <div class="pill-body"><pre>{{ proposalBodyText() }}</pre></div>
            <div class="pill-actions">
              <button #primaryAction type="button" class="btn btn-primary btn-sm" (click)="approve.emit()">{{ primaryActionLabel() }}</button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="startEdit()">Edit proposal</button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="discard.emit()">Discard proposal</button>
            </div>
          }
        }
        @case ('approved') {
          <div class="pill-resolved" role="status" aria-live="polite">
            <span class="badge-glyph">✓</span>
            <span class="badge-label">Saved</span>
            <span class="badge-time">{{ resolvedTime() }}</span>
          </div>
        }
        @case ('edited') {
          <div class="pill-resolved" role="status" aria-live="polite">
            <span class="badge-glyph">✎</span>
            <span class="badge-label">Edited and saved</span>
            <span class="badge-time">{{ resolvedTime() }}</span>
          </div>
        }
        @case ('discarded') {
          <div class="pill-resolved" role="status" aria-live="polite">
            <span class="badge-glyph">✗</span>
            <span class="badge-label">Discarded</span>
            <span class="badge-time">{{ resolvedTime() }}</span>
          </div>
        }
      }
    </article>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .pending-pill {
      max-width: 80%;
      margin: 0 auto;
      padding: 1rem;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-sizing: border-box;
    }

    .pill-header {
      font-size: 0.875rem; /* 14px */
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 0.5rem;
      line-height: 1.5;
    }

    .pill-body {
      font-size: 0.875rem; /* 14px */
      font-weight: 400;
      color: #333;
      line-height: 1.5;
    }

    .pill-body pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: inherit;
      font-size: inherit;
    }

    .pill-edit-textarea {
      width: 100%;
      padding: 0.5rem;
      font-family: inherit;
      font-size: 0.875rem;
      line-height: 1.5;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
      resize: vertical;
    }

    .pill-edit-textarea:focus {
      outline: none;
      border-color: #3498db;
      box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
    }

    .pill-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }

    .btn {
      padding: 0.375rem 0.75rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      font-family: inherit;
      border: 1px solid transparent;
    }

    .btn-primary {
      background: #3498db;
      color: white;
    }

    .btn-primary:hover {
      background: #2980b9;
    }

    .btn-secondary {
      background: #ecf0f1;
      color: #2c3e50;
      border-color: #ddd;
    }

    .btn-secondary:hover {
      background: #dfe6e9;
    }

    .btn-sm {
      font-size: 0.875rem;
    }

    .pill-resolved {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .badge-glyph {
      font-size: 1rem;
      font-weight: 600;
      color: #2c3e50;
    }

    .badge-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #2c3e50;
    }

    .badge-time {
      font-size: 0.875rem;
      font-weight: 400;
      color: #7f8c8d;
      margin-left: auto;
    }
  `],
})
export class PendingPillComponent implements OnChanges, AfterViewInit {
  @Input({ required: true }) block!: ToolUseBlock;
  @Output() approve = new EventEmitter<void>();
  @Output() discard = new EventEmitter<void>();
  /** Emits the new proposal text when the user clicks "Save edits". */
  @Output() edit = new EventEmitter<string>();

  /** Inline edit-mode toggle. Local UI state — does not mutate `block`. */
  editing = false;
  /** Draft buffer for the edit textarea. */
  editingDraft = '';

  @ViewChild('primaryAction') primaryAction?: ElementRef<HTMLButtonElement>;

  /**
   * Discriminated kind on tool_use.name. UI-SPEC.md locks two kinds for
   * Phase 3; unknown kinds fall back to a generic header. Phase 5 may add
   * more (server-tool kinds), but the pill UX is for client-write proposals.
   */
  pillKind(): 'memory' | 'update_profile' | 'unknown' {
    if (this.block?.name === 'memory') return 'memory';
    if (this.block?.name === 'update_profile') return 'update_profile';
    return 'unknown';
  }

  pendingHeaderText(): string {
    if (this.pillKind() === 'memory') return 'AI wants to remember this:';
    if (this.pillKind() === 'update_profile') {
      return `AI proposes a profile update to "${this.profileSectionLabel()}":`;
    }
    return 'AI proposal:';
  }

  /**
   * Extracts the human-readable proposal body from `block.input`. Memory:
   * prefer `file_text` then `new_str`/`insert_text`/`path`. Profile-update:
   * prefer `value` then `content`. Falls back to JSON-stringified input
   * truncated at 500 chars.
   */
  proposalBodyText(): string {
    const input = this.block?.input as Record<string, unknown> | null | undefined;
    if (!input || typeof input !== 'object') return '';

    if (this.pillKind() === 'memory') {
      const candidate = input['file_text'] ?? input['new_str'] ?? input['insert_text'] ?? input['path'] ?? '';
      const text = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
      return (text ?? '').slice(0, 500);
    }
    if (this.pillKind() === 'update_profile') {
      const candidate = input['value'] ?? input['content'] ?? '';
      const text = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
      return (text ?? '').slice(0, 500);
    }
    return JSON.stringify(input).slice(0, 500);
  }

  /**
   * Maps the raw section key to one of the 4 verbatim labels used in
   * /settings/profile. UI-SPEC.md locks these strings.
   */
  profileSectionLabel(): string {
    const input = this.block?.input as Record<string, unknown> | null | undefined;
    const raw = input && typeof input === 'object' ? (input['section'] ?? '') : '';
    const map: Record<string, string> = {
      goals: 'Goals',
      preferences: 'Preferences',
      dietaryConstraints: 'Dietary constraints',
      trainingHistory: 'Training history',
    };
    if (typeof raw !== 'string') return 'Profile';
    return map[raw] ?? 'Profile';
  }

  primaryActionLabel(): string {
    return this.pillKind() === 'memory' ? 'Save to memory' : 'Apply update';
  }

  /**
   * Format the resolved-state timestamp. Phase 3 uses `now` because the
   * pill resolution timestamp is not currently persisted on the block —
   * Phase 4 will add a `resolvedAt` field and this method will read it.
   */
  resolvedTime(): string {
    return new Date().toLocaleString();
  }

  startEdit(): void {
    this.editing = true;
    this.editingDraft = this.proposalBodyText();
  }

  saveEdits(): void {
    this.edit.emit(this.editingDraft);
    this.editing = false;
  }

  cancelEdit(): void {
    this.editing = false;
    this.editingDraft = '';
  }

  ngAfterViewInit(): void {
    if (this.block?.status === 'pending' && !this.editing) {
      setTimeout(() => this.primaryAction?.nativeElement.focus(), 0);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['block'] && this.block?.status === 'pending' && !this.editing) {
      setTimeout(() => this.primaryAction?.nativeElement.focus(), 0);
    }
  }
}
