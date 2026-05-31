import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage, ClaimSpan, Confidence } from '../../models/ai-chat.model';
import { parseClaimSpans } from '../../services/confidence-attribution-parser';
import { PendingPillComponent } from './pending-pill.component';

/**
 * Citation-link guard (D-13, E1). The SOLE path by which any citation may
 * become an `<a href>` is a structured Anthropic `TextCitation` block whose
 * `type` is one of the API-emitted location kinds. Model-authored prose
 * (author-year strings, bare DOIs, bare URLs) is NEVER a `TextCitation`, so
 * it can never satisfy this guard and never becomes a hyperlink.
 *
 * No tool in Phase 4 produces these citations, so in practice this returns
 * `false` for everything rendered this phase → zero anchors from prose. The
 * function ships and is adversarially tested NOW (one phase before web
 * citations exist) so the guard is proven, not added later under pressure.
 *
 * Copied from 04-RESEARCH "citation-link guard" Code Example.
 */
export function isLinkableCitation(citation: { type?: string } | undefined | null): boolean {
  return (
    citation?.type === 'search_result_location' ||
    citation?.type === 'web_search_result_location'
  );
}

/**
 * Block-aware chat message list (Plan 03-05 Task 3; D-15).
 *
 * Renders ChatMessage.blocks via @switch (block.type):
 * - 'text'        → existing markdown-style text render (preserves Phase 1
 *                   characterization-spec DOM shape)
 * - 'tool_use'    → <app-pending-pill> wired to (approve)/(discard)/(edit)
 *                   handlers that re-emit through (blockAction) so the parent
 *                   chat-page can dispatch chat.service.updateMessageBlock
 * - 'tool_result' → static rendering with the content text and a 'Tool result'
 *                   prefix (Phase 4 wires the collapsible viewer)
 *
 * The `<div class="message-content">` wrapper is preserved verbatim — this
 * is the DOM contract the Phase 1 plan 01-08 characterization spec asserts on.
 */
@Component({
  selector: 'app-chat-message-list',
  standalone: true,
  imports: [CommonModule, PendingPillComponent],
  template: `
    <div class="message-list" #scrollContainer>
      @for (msg of messages; track msg.id) {
        <div class="message" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
          <div class="message-role">{{ msg.role === 'user' ? 'You' : 'AI Assistant' }}</div>
          <div class="message-content">@for (block of msg.blocks; track $index) {
            @switch (block.type) {
              @case ('text') {<span class="block-text">@for (span of spansFor(msg.id, $index, block.text); track $spanIdx; let $spanIdx = $index) {<span class="claim-span">{{ span.text }}@if (span.confidence) {<span class="confidence-chip" [class.tier-calm]="isCalm(span.confidence)" [class.tier-alert]="!isCalm(span.confidence)" [attr.aria-label]="'Confidence: ' + span.confidence"><span class="chip-glyph" aria-hidden="true">{{ confidenceGlyph(span.confidence) }}</span><span class="chip-label">{{ span.confidence }}</span></span>}@if (span.source === 'data') {<span class="source-chip" aria-label="Source: from your data"><span class="chip-glyph" aria-hidden="true">📈</span><span class="chip-label">your data</span></span>}@if (span.source === 'research') {<span class="source-chip" aria-label="Source: from research — general knowledge, not a live source"><span class="chip-glyph" aria-hidden="true">📚</span><span class="chip-label">research</span></span><span class="research-qualifier">general knowledge — not a live source</span>}</span>{{ ' ' }}}</span>}
              @case ('tool_use') {
                <app-pending-pill
                  [block]="block"
                  (approve)="emitAction(msg.id, $index, 'approve')"
                  (discard)="emitAction(msg.id, $index, 'discard')"
                  (edit)="emitAction(msg.id, $index, 'edit', $event)"
                ></app-pending-pill>
              }
              @case ('tool_result') {
                <div class="tool-result-placeholder" aria-label="Tool result"><strong>Tool result:</strong> {{ block.content }}</div>
              }
            }
          }</div>
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

    .tool-result-placeholder {
      background: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 0.5rem 0.75rem;
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: #2c3e50;
      white-space: pre-wrap;
    }

    /* Confidence + source badges (04-UI-SPEC LOCKED palette). Inline chips
       after the claim they qualify. Color is one of three channels (color +
       icon glyph + text label) so a skimming user distinguishes calm vs alert. */
    .confidence-chip,
    .source-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.2;
      margin: 0 2px;
      vertical-align: baseline;
    }

    /* Badge row wraps on narrow viewports; chips never overflow the bubble. */
    .claim-span {
      display: inline;
      flex-wrap: wrap;
    }

    .confidence-chip.tier-calm {
      background: #eef6ec;
      color: #2e7d32;
    }

    .confidence-chip.tier-alert {
      background: #fdf3e7;
      color: #b9770e;
    }

    .source-chip {
      background: #f0f0f0;
      color: #2c3e50;
      font-weight: 600;
    }

    .research-qualifier {
      font-size: 0.8125rem;
      font-style: italic;
      color: #7f8c8d;
      margin-left: 4px;
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
  /**
   * Re-emitted from inner pending-pill (approve|discard|edit) outputs. The
   * parent chat-page dispatches this to chat.service.updateMessageBlock with
   * the appropriate patch (Plan 03-05 Task 3; D-11).
   */
  @Output() blockAction = new EventEmitter<{
    messageId: string;
    blockIndex: number;
    action: 'approve' | 'discard' | 'edit';
    editedText?: string;
  }>();
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

  /**
   * Memoized `parseClaimSpans` results, keyed by `${messageId}#${blockIndex}#${text}`.
   * Parsing runs ONCE per (block, text) when the input changes — never on every
   * change-detection pass (which a template-bound `parseClaimSpans(...)` would
   * trigger). The text is part of the key so a streamed/edited block re-parses.
   */
  private spanCache = new Map<string, ClaimSpan[]>();

  /** Confidence grades that read as "calm / higher-confidence" (04-UI-SPEC). */
  private static readonly CALM_GRADES: ReadonlySet<Confidence> = new Set<Confidence>([
    'strong',
    'moderate',
  ]);

  ngOnChanges(): void {
    // Inputs replaced ⇒ drop stale memoized spans (the key includes text, so
    // collisions are impossible, but this bounds the cache to live blocks).
    this.spanCache.clear();
    setTimeout(() => this.scrollToBottom(), 0);
  }

  /**
   * Parse a text block into ClaimSpan[], memoized. The render binds to this so
   * each span's text is interpolated via `{{ }}` (auto-escaped) — model prose
   * can never become markup or an `<a>` (citation guard, D-13).
   */
  spansFor(messageId: string, blockIndex: number, text: string): ClaimSpan[] {
    const key = `${messageId}#${blockIndex}#${text}`;
    let spans = this.spanCache.get(key);
    if (!spans) {
      spans = parseClaimSpans(text);
      this.spanCache.set(key, spans);
    }
    return spans;
  }

  /** True when a confidence grade is in the calm tier (pale-green badge). */
  isCalm(confidence: Confidence): boolean {
    return ChatMessageListComponent.CALM_GRADES.has(confidence);
  }

  /** LOCKED glyph per grade: ✓ strong, ≈ moderate, ⚠ all alert grades. */
  confidenceGlyph(confidence: Confidence): string {
    if (confidence === 'strong') return '✓';
    if (confidence === 'moderate') return '≈';
    return '⚠';
  }

  emitAction(
    messageId: string,
    blockIndex: number,
    action: 'approve' | 'discard' | 'edit',
    editedText?: string,
  ): void {
    this.blockAction.emit({ messageId, blockIndex, action, editedText });
  }

  private scrollToBottom(): void {
    if (this.scrollContainer) {
      const el = this.scrollContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
