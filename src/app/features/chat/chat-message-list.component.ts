import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService } from '../../services/storage.service';
import {
  ChatMessage,
  ClaimSpan,
  Confidence,
  GroundedCitation,
  ToolResultBlock,
  WebSearchResultPersisted,
  WebSearchToolResultPersistedBlock,
} from '../../models/ai-chat.model';
import { parseClaimSpans } from '../../services/confidence-attribution-parser';
import { toSourcesList } from '../../services/web-citation-parser';
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
    <!--
      QUAL-08: the scrollable transcript must be keyboard-focusable so a
      keyboard-only user can scroll it (axe scrollable-region-focusable, serious).
      tabindex="0" + a role/label makes the region reachable and announced.
    -->
    <div class="message-list" #scrollContainer tabindex="0" role="log" aria-label="Conversation messages">
      @if (canLoadEarlier()) {
        <div class="load-earlier-row">
          <button
            type="button"
            class="btn-secondary load-earlier-btn"
            aria-label="Load earlier archived messages in this conversation"
            [disabled]="loadingEarlier"
            (click)="onLoadEarlier()"
          >Load earlier messages</button>
        </div>
      }
      @if (loadingEarlier) {
        <div class="load-earlier-status" role="status" aria-live="polite">Loading earlier messages…</div>
      }
      @for (msg of renderedMessages(); track msg.id) {
        <div class="message" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
          <div class="message-role">{{ msg.role === 'user' ? 'You' : 'AI Assistant' }}</div>
          <div class="message-content">@for (block of msg.blocks; track $index; let $blockIdx = $index) {
            @switch (block.type) {
              @case ('text') {<span class="block-text">@for (span of spansFor(msg.id, $blockIdx, block.text); track $spanIdx; let $spanIdx = $index) {<span class="claim-span">{{ span.text }}@if (span.confidence) {<span class="confidence-chip" [class.tier-calm]="isCalm(span.confidence)" [class.tier-alert]="!isCalm(span.confidence)" [attr.aria-label]="'Confidence: ' + span.confidence"><span class="chip-glyph" aria-hidden="true">{{ confidenceGlyph(span.confidence) }}</span><span class="chip-label">{{ span.confidence }}</span></span>}@if (span.source === 'data') {<span class="source-chip" aria-label="Source: from your data"><span class="chip-glyph" aria-hidden="true">📈</span><span class="chip-label">your data</span></span>}@if (span.source === 'research' && isGrounded(msg.id, $blockIdx, block.text, block.citations)) {<span class="source-chip source-chip--grounded" [attr.aria-label]="'Source: from research, grounded in ' + groundedFor(msg.id, $blockIdx, block.text, block.citations).length + ' live web source(s)'"><span class="chip-glyph" aria-hidden="true">📚🔗</span><span class="chip-label">research · grounded</span></span>}@else if (span.source === 'research') {<span class="source-chip" aria-label="Source: from research — general knowledge, not a live source"><span class="chip-glyph" aria-hidden="true">📚</span><span class="chip-label">research</span></span><span class="research-qualifier">general knowledge — not a live source</span>}</span>{{ ' ' }}}@if (isGrounded(msg.id, $blockIdx, block.text, block.citations)) {<span class="footnote-markers">@for (cite of groundedFor(msg.id, $blockIdx, block.text, block.citations); track cite.url; let $n = $index) {<a class="footnote-marker" [href]="'#' + sourceId(msg.id, $n + 1)" [attr.aria-label]="'Source ' + ($n + 1) + ': ' + cite.title">[{{ $n + 1 }}]</a>}</span>}</span>@if (isGrounded(msg.id, $blockIdx, block.text, block.citations)) {<section class="sources" aria-label="Sources"><h4 class="sources-heading">Sources</h4><ol class="sources-list">@for (cite of groundedFor(msg.id, $blockIdx, block.text, block.citations); track cite.url; let $n = $index) {<li class="sources-item" [id]="sourceId(msg.id, $n + 1)"><span class="sources-title">[{{ $n + 1 }}] {{ cite.title }}</span> <a class="sources-url" [href]="cite.url" rel="noopener noreferrer" target="_blank">{{ cite.url }}</a></li>}</ol></section>}}
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
              @case ('server_tool_use') {
                <!-- D-05: an Anthropic-executed web search. In-flight when no paired
                     web_search_tool_result exists yet (non-expandable, announced);
                     resolved/error rendered from the result branch below. -->
                @if (!webResultFor(msg, block.id)) {
                  <div class="tool-inflight" role="status" aria-live="polite">
                    <span class="tool-inflight-text">{{ searchInFlightSummary(block.input) }}</span><span class="inflight-dots" aria-hidden="true">…</span>
                  </div>
                }
              }
              @case ('web_search_tool_result') {
                <!-- D-05: resolved web search. An array of results → collapsed
                     "🔎 Found {n} sources" disclosure (renderer-derived count,
                     never model prose). An error union → an honest, link-free row. -->
                @if (webResultCount(block) !== undefined) {
                  <details class="tool-disclosure" [id]="'websearch-' + block.toolUseId">
                    <summary class="tool-summary" [attr.aria-label]="'Show what the AI searched for: ' + webSearchSummary(block)">{{ webSearchSummary(block) }}</summary>
                    <div class="tool-body">
                      <div class="tool-name">Web search</div>
                      <div class="tool-section-label">Searched:</div>
                      <pre class="tool-pre">{{ webSearchQuery(msg, block.toolUseId) }}</pre>
                      <div class="tool-section-label">Sources found:</div>
                      <ul class="search-results-list">
                        @for (r of webSearchResults(block); track $index) {
                          <li class="search-result-item">{{ r.title }}</li>
                        }
                      </ul>
                    </div>
                  </details>
                } @else {
                  <div class="tool-error" role="status" aria-live="polite">
                    <span class="tool-error-text">🔎 Couldn't reach the web</span>
                  </div>
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
      /* QUAL-08: #2471a3 → white text 5.30:1 (was #3498db 3.15:1). */
      background: #2471a3;
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
      /* QUAL-08: opacity de-emphasis dropped contrast below AA on both bubble
         backgrounds; hierarchy is carried by size+weight instead. */
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
    .source-chip--grounded { background: #f0f0f0; color: #2c3e50; }
    .research-qualifier {
      margin-left: 4px;
      font: italic 0.8125rem/1 inherit;
      color: #7f8c8d;
    }

    .footnote-markers { white-space: normal; }
    .footnote-marker {
      margin-left: 4px;
      font: 600 14px/1.5 inherit;
      /* Darkened accent (#21618c) so the link clears WCAG AA (5.8:1) on the
         #f0f0f0 assistant bubble — the UI-SPEC color-nudge for a failing row
         (QUAL-08). Same blue family as the #3498db accent. */
      color: #21618c;
      text-decoration: none;
      vertical-align: baseline;
    }
    .footnote-marker:hover { text-decoration: underline; }

    .sources {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
    }
    .sources-heading {
      margin: 0 0 8px;
      font: 600 14px/1.2 inherit;
      color: #2c3e50;
    }
    .sources-list {
      margin: 0;
      padding-left: 1.25rem;
      list-style: none;
    }
    .sources-item {
      margin: 8px 0;
      font: 400 14px/1.5 inherit;
    }
    .sources-title { font-weight: 600; }
    .sources-url {
      color: #21618c;
      overflow-wrap: anywhere;
    }
    .sources-url:hover { text-decoration: underline; }

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

    .tool-error {
      display: flex;
      align-items: center;
      min-height: 44px;
      margin: 0.5rem 0;
      padding: 0.25rem 0.75rem;
      background: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 4px;
      font: 600 14px/1.5 inherit;
      color: #2c3e50;
    }
    .search-results-list {
      margin: 0.25rem 0 0;
      padding-left: 1.25rem;
      font: 400 14px/1.5 inherit;
    }
    .search-result-item { margin: 0.125rem 0; }

    .load-earlier-row {
      display: flex;
      justify-content: center;
      margin-bottom: 0.5rem;
    }
    .load-earlier-btn {
      min-height: 44px;
      padding: 0.5rem 1rem;
      background: #ecf0f1;
      color: #2c3e50;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }
    .load-earlier-btn:hover:not(:disabled) { background: #dfe6e9; }
    .load-earlier-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .load-earlier-status {
      text-align: center;
      font-size: 0.875rem;
      color: #555;
      margin-bottom: 0.5rem;
    }

    .message-time {
      font-size: 0.7rem;
      /* QUAL-08: was opacity 0.6 (2.05:1 on the user bubble, 3.29:1 on the
         assistant bubble); full opacity clears AA on both. */
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
   * The active conversation id — drives the lazy archival affordance (QUAL-05,
   * D-13). When the conversation changes, any already-loaded earlier messages
   * are dropped so we never show a different conversation's archive.
   */
  @Input() conversationId?: string;
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

  private storageService = inject(StorageService);

  /**
   * Archived (pre-summary) messages lazy-loaded on demand via StorageService
   * (QUAL-05, D-13). Prepended to the rendered list. Empty until the user
   * reaches for "Load earlier messages". Reset when the conversation changes.
   */
  private archivedMessages: ChatMessage[] = [];
  /** True only while a load is in flight (announced + disables the button). */
  loadingEarlier = false;
  /** Conversation id the current archive belongs to (guards a stale archive). */
  private archivedFor?: string;
  /** Set once a load has run so a now-empty archive hides the button. */
  private earlierLoaded = false;

  /**
   * Memoized `parseClaimSpans` results, keyed by `${messageId}#${blockIndex}#${text}`.
   * Parsing runs ONCE per (block, text) when the input changes — never on every
   * change-detection pass (which a template-bound `parseClaimSpans(...)` would
   * trigger). The text is part of the key so a streamed/edited block re-parses.
   */
  private spanCache = new Map<string, ClaimSpan[]>();

  /**
   * Memoized grounded-citation narrowing per text block, keyed by
   * `${messageId}#${blockIndex}#${text}` — the SAME memo discipline as
   * `spanCache`. Narrowing runs ONCE per (block, text), NEVER in a
   * change-detection-rebound binding. Cleared in ngOnChanges with spanCache.
   */
  private citationCache = new Map<string, GroundedCitation[]>();

  /** Confidence grades that read as "calm / higher-confidence" (04-UI-SPEC). */
  private static readonly CALM_GRADES: ReadonlySet<Confidence> = new Set<Confidence>([
    'strong',
    'moderate',
  ]);

  ngOnChanges(): void {
    // Inputs replaced ⇒ drop stale memoized spans (the key includes text, so
    // collisions are impossible, but this bounds the cache to live blocks).
    this.spanCache.clear();
    this.citationCache.clear();
    // Conversation changed ⇒ drop any earlier-loaded archive so we never show
    // a different conversation's messages (D-13 archival is per-conversation).
    if (this.conversationId !== this.archivedFor) {
      this.archivedMessages = [];
      this.archivedFor = this.conversationId;
      this.earlierLoaded = false;
    }
    setTimeout(() => this.scrollToBottom(), 0);
  }

  // ── Lazy chat archival affordance (QUAL-05, D-13) ───────────────────────────

  /** Messages to render: lazily-loaded archive (oldest-first) then the live slice. */
  renderedMessages(): ChatMessage[] {
    return this.archivedMessages.length
      ? [...this.archivedMessages, ...this.messages]
      : this.messages;
  }

  /**
   * Show the affordance only when an archive key exists for this conversation
   * and we have not yet exhausted it. A cheap, never-throwing presence check
   * through the StorageService chokepoint (D-13).
   */
  canLoadEarlier(): boolean {
    if (!this.conversationId || this.loadingEarlier || this.earlierLoaded) return false;
    return this.storageService.hasArchivedMessages(this.conversationId);
  }

  /**
   * Lazy-load this conversation's archived messages and prepend them. Preserves
   * the scroll anchor (the offset from the bottom) so the user is NOT jumped to
   * the top abruptly (UI-SPEC a11y). Loads through StorageService (the storage
   * chokepoint); never throws (loadArchivedMessages is fail-soft).
   */
  onLoadEarlier(): void {
    if (!this.conversationId || this.loadingEarlier) return;
    this.loadingEarlier = true;

    const el = this.scrollContainer?.nativeElement;
    const prevFromBottom = el ? el.scrollHeight - el.scrollTop : 0;

    const earlier = this.storageService.loadArchivedMessages(this.conversationId);
    this.archivedMessages = earlier;
    this.earlierLoaded = true;
    this.loadingEarlier = false;

    // Restore the scroll anchor on the next frame so prepended content does not
    // yank the viewport to the top.
    setTimeout(() => {
      if (el) el.scrollTop = el.scrollHeight - prevFromBottom;
    }, 0);
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

  /**
   * Grounded web-search citations backing a text block, memoized (D-03/D-09).
   * The persisted `TextBlock.citations` already arrive narrowed + https-gated
   * by `web-citation-parser.toGroundedCitations` at the serializer chokepoint
   * (the ONLY place that turns an SDK `TextCitation` into a `GroundedCitation`).
   * Here we re-assert the https gate defensively and dedupe by URL via
   * `toSourcesList` for the footnote/Sources render. Memoized the SAME way as
   * `spansFor`/`spanCache`: narrowed ONCE per (block, text), never in a
   * CD-rebound binding.
   */
  groundedFor(
    messageId: string,
    blockIndex: number,
    text: string,
    citations: GroundedCitation[] | undefined,
  ): GroundedCitation[] {
    const key = `${messageId}#${blockIndex}#${text}`;
    let grounded = this.citationCache.get(key);
    if (!grounded) {
      // Defensive https re-gate: a GroundedCitation is guaranteed https: by the
      // parser, but re-checking here means a hand-built/tampered block can never
      // slip a non-https url into an <a href> (T-05-08-02). Then dedupe by URL.
      const httpsOnly = (citations ?? []).filter((c) => this.isHttps(c.url));
      grounded = toSourcesList(httpsOnly);
      this.citationCache.set(key, grounded);
    }
    return grounded;
  }

  /** True iff a url parses and uses the https: protocol (defensive link gate). */
  private isHttps(url: string): boolean {
    try {
      return new URL(url).protocol === 'https:';
    } catch {
      return false;
    }
  }

  /** True when a text block is backed by ≥1 grounded citation (footnote/badge). */
  isGrounded(
    messageId: string,
    blockIndex: number,
    text: string,
    citations: GroundedCitation[] | undefined,
  ): boolean {
    return this.groundedFor(messageId, blockIndex, text, citations).length > 0;
  }

  /** Stable per-message footnote anchor id: `source-{msgId}-{n}` (1-based). */
  sourceId(messageId: string, n: number): string {
    return `source-${messageId}-${n}`;
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

  // ── Web-search rows (D-05) ──────────────────────────────────────────────────

  /**
   * Find the web_search_tool_result paired to a server_tool_use id within the
   * same message. Absence ⇒ the search is in-flight (non-expandable row).
   */
  webResultFor(msg: ChatMessage, serverToolUseId: string): WebSearchToolResultPersistedBlock | undefined {
    return msg.blocks.find(
      (b): b is WebSearchToolResultPersistedBlock =>
        b.type === 'web_search_tool_result' && b.toolUseId === serverToolUseId,
    );
  }

  /** In-flight present-tense line; includes the query (renderer-derived) when present. */
  searchInFlightSummary(input: unknown): string {
    const query = this.deriveQuery(input);
    return query
      ? `🔎 Searching the web for "${query}"…`
      : '🔎 Searching the web…';
  }

  /**
   * Count of results in a resolved web_search_tool_result, or `undefined` when
   * the content is the error union (so the template renders the honest error
   * row instead). Renderer-derived — never model prose (E12/D-05).
   */
  webResultCount(block: WebSearchToolResultPersistedBlock): number | undefined {
    return Array.isArray(block.content) ? block.content.length : undefined;
  }

  /** The result array of a resolved search (empty when the content is an error). */
  webSearchResults(block: WebSearchToolResultPersistedBlock): WebSearchResultPersisted[] {
    return Array.isArray(block.content) ? block.content : [];
  }

  /** LOCKED resolved summary `🔎 Found {n} sources` (renderer-derived count). */
  webSearchSummary(block: WebSearchToolResultPersistedBlock): string {
    const n = this.webResultCount(block) ?? 0;
    return `🔎 Found ${n} sources`;
  }

  /**
   * The query string for a resolved disclosure body, read from the paired
   * server_tool_use input (renderer-derived). Omitted (empty) if unavailable.
   */
  webSearchQuery(msg: ChatMessage, serverToolUseId: string): string {
    const st = msg.blocks.find(
      (b) => b.type === 'server_tool_use' && b.id === serverToolUseId,
    );
    return st && st.type === 'server_tool_use' ? this.deriveQuery(st.input) : '';
  }

  /** Pull a `query` string out of the server_tool_use input, if present. */
  private deriveQuery(input: unknown): string {
    if (input && typeof input === 'object') {
      const q = (input as Record<string, unknown>)['query'];
      if (typeof q === 'string') return q;
    }
    return '';
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
