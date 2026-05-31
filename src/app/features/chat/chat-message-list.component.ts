import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage, ClaimSpan, Confidence, ToolResultBlock } from '../../models/ai-chat.model';
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
                @if (isQueryTool(block.name)) {
                  @if (resultFor(msg, block.id); as result) {
                    <!-- Resolved query: the real expandable disclosure. -->
                    <details class="tool-disclosure" [id]="'tooluse-' + block.id">
                      <summary class="tool-summary" [attr.aria-label]="'Show what the AI looked at: ' + toolSummary(block.name, block.input, result.content)">{{ toolSummary(block.name, block.input, result.content) }}</summary>
                      <div class="tool-body">
                        <div class="tool-name">Tool: {{ block.name }}</div>
                        <div class="tool-section-label">Query:</div>
                        <pre class="tool-pre">{{ formatInput(block.input) }}</pre>
                        <div class="tool-section-label">Result:</div>
                        <pre class="tool-pre">{{ result.content }}</pre>
                      </div>
                    </details>
                  } @else {
                    <!-- In-flight query (no paired result yet): non-expandable, announced. -->
                    <div class="tool-inflight" role="status" aria-live="polite">
                      <span class="tool-inflight-text">{{ inFlightSummary(block.name) }}</span><span class="inflight-dots" aria-hidden="true">…</span>
                    </div>
                  }
                } @else {
                  <app-pending-pill
                    [block]="block"
                    (approve)="emitAction(msg.id, $index, 'approve')"
                    (discard)="emitAction(msg.id, $index, 'discard')"
                    (edit)="emitAction(msg.id, $index, 'edit', $event)"
                  ></app-pending-pill>
                }
              }
              @case ('tool_result') {
                <!-- The disclosure is rendered from its paired query tool_use (above). A
                     tool_result with no matching tool_use in this message falls back to the
                     Phase 3 static placeholder so nothing is silently dropped. -->
                @if (!hasPairedQueryToolUse(msg, block.tool_use_id)) {
                  <div class="tool-result-placeholder" aria-label="Tool result"><strong>Tool result:</strong> {{ block.content }}</div>
                }
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

    .confidence-chip,
    .source-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      margin: 0 2px;
      border-radius: 4px;
      font: 600 14px/1.2 inherit;
    }
    .claim-span { display: inline; flex-wrap: wrap; }
    .confidence-chip.tier-calm { background: #eef6ec; color: #2e7d32; }
    .confidence-chip.tier-alert { background: #fdf3e7; color: #b9770e; }
    .source-chip { background: #f0f0f0; color: #2c3e50; }
    .research-qualifier {
      margin-left: 4px;
      font: italic 0.8125rem/1 inherit;
      color: #7f8c8d;
    }

    .tool-disclosure,
    .tool-inflight {
      margin: 0.5rem 0;
      background: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.875rem;
      color: #2c3e50;
    }
    .tool-summary,
    .tool-inflight {
      display: flex;
      align-items: center;
      min-height: 44px;
      padding: 0.25rem 0.75rem;
      font-weight: 600;
    }
    .tool-summary { cursor: pointer; }
    .tool-body { padding: 0.5rem 0.75rem 0.75rem; border-top: 1px solid #ddd; }
    .tool-name,
    .tool-section-label { font-weight: 600; }
    .tool-name { font-size: 14px; margin-bottom: 0.25rem; }
    .tool-section-label { margin-top: 0.5rem; }
    .tool-pre {
      margin: 0.25rem 0 0;
      font: 400 14px/1.4 inherit;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .inflight-dots { margin-left: 2px; animation: blink 1.4s infinite; }

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

  // ── Tool-call disclosures (E12, D-05/D-06) ──────────────────────────────────

  /**
   * LOCKED per-tool summary verbs (04-UI-SPEC Copywriting). `[inFlight, resolved]`
   * where resolved is a template using `{n}` (count) and `{range}` placeholders;
   * the renderer substitutes/omits them — NEVER the model. `query_*` only.
   */
  private static readonly TOOL_VERBS: Record<string, { inflight: string; resolved: string; noun: string }> = {
    query_cardio_sessions: { inflight: '🏃 Reading your cardio sessions', resolved: '🏃 Read', noun: 'cardio sessions' },
    query_weight_entries: { inflight: '⚖️ Reading your weight entries', resolved: '⚖️ Read', noun: 'weight entries' },
    query_readings: { inflight: '🩺 Reading your health readings', resolved: '🩺 Read', noun: 'readings' },
    query_meals_in_range: { inflight: '🍽️ Reading your meals', resolved: '🍽️ Read', noun: 'meals' },
    query_daily_totals: { inflight: '📊 Reading your daily totals', resolved: '📊 Read', noun: 'daily totals' },
    query_saved_foods: { inflight: '📚 Reading your saved foods', resolved: '📚 Read', noun: 'saved foods' },
  };

  /** True for the read-only data-query tool family — these get the disclosure UI. */
  isQueryTool(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(ChatMessageListComponent.TOOL_VERBS, name);
  }

  /** Find the tool_result paired to a tool_use id within the same message. */
  resultFor(msg: ChatMessage, toolUseId: string): ToolResultBlock | undefined {
    return msg.blocks.find(
      (b): b is ToolResultBlock => b.type === 'tool_result' && b.tool_use_id === toolUseId,
    );
  }

  /** True when a tool_result's pair is a query_* tool_use (so the disclosure owns it). */
  hasPairedQueryToolUse(msg: ChatMessage, toolUseId: string): boolean {
    return msg.blocks.some(
      (b) => b.type === 'tool_use' && b.id === toolUseId && this.isQueryTool(b.name),
    );
  }

  /** Present-tense in-flight line for a query tool (no result yet). */
  inFlightSummary(name: string): string {
    return ChatMessageListComponent.TOOL_VERBS[name]?.inflight ?? 'Reading your data';
  }

  /**
   * Resolved past-tense summary, e.g. `⚖️ Read 38 weight entries · 2026-01-01..2026-05-31`.
   * `{n}` is parsed from the tool_result content (`"N total"`); `{range}` from the
   * tool_use input (`from`/`to`). Both are RENDERER-derived (E12) — never model prose.
   * The `· {…}` clause is OMITTED when neither count nor range is available.
   */
  toolSummary(name: string, input: unknown, resultContent: string): string {
    const verb = ChatMessageListComponent.TOOL_VERBS[name];
    if (!verb) return resultContent;

    const count = this.deriveCount(resultContent);
    const range = this.deriveRange(input);
    // daily_totals has no count noun ("Read daily totals · {range}").
    const noun = verb.noun;
    const head = name === 'query_daily_totals'
      ? `${verb.resolved} ${noun}`
      : count !== undefined
        ? `${verb.resolved} ${count} ${noun}`
        : `${verb.resolved} ${noun}`;

    const clause = range ?? (count !== undefined && name === 'query_daily_totals' ? `${count}` : undefined);
    return clause ? `${head} · ${clause}` : head;
  }

  /** Parse the leading `"… N total"` count from a bounded query result. */
  private deriveCount(resultContent: string): number | undefined {
    const m = /(\d+)\s+total/.exec(resultContent);
    return m ? Number(m[1]) : undefined;
  }

  /** Derive a `from..to` range string from the tool input, if present. */
  private deriveRange(input: unknown): string | undefined {
    if (input && typeof input === 'object') {
      const o = input as Record<string, unknown>;
      const from = typeof o['from'] === 'string' ? o['from'] : undefined;
      const to = typeof o['to'] === 'string' ? o['to'] : undefined;
      if (from && to) return `${from}..${to}`;
      if (from) return `from ${from}`;
      if (to) return `until ${to}`;
    }
    return undefined;
  }

  /** Pretty-print the tool input params for the expanded disclosure body. */
  formatInput(input: unknown): string {
    try {
      return JSON.stringify(input ?? {}, null, 2);
    } catch {
      return String(input);
    }
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
