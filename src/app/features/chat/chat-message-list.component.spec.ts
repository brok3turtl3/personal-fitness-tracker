/**
 * chat-message-list spec (Plan 03-05 Task 3).
 *
 * Verifies the block-aware @switch render: text → plain text, tool_use →
 * <app-pending-pill>, tool_result → static placeholder. Also covers the
 * (blockAction) Output emit via the inner pending-pill.
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ChatMessageListComponent, isLinkableCitation } from './chat-message-list.component';
import { PendingPillComponent } from './pending-pill.component';
import {
  ChatBlock,
  ChatMessage,
  GroundedCitation,
  ServerToolUsePersistedBlock,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
  WebSearchToolResultPersistedBlock,
} from '../../models/ai-chat.model';
import { toGroundedCitations } from '../../services/web-citation-parser';
import { fromAnthropicMessage } from '../../services/chat-block-serializer';
import { F1, F3, F6 } from '../../services/web-citation-parser.fixtures';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';
import type { Message } from '@anthropic-ai/sdk/resources/messages';

function makeMsg(role: 'user' | 'assistant', blocks: ChatBlock[]): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role,
    blocks,
    tokenEstimate: 1,
    createdAt: '2026-04-15T10:00:00.000Z',
  };
}

async function createFixture(messages: ChatMessage[]): Promise<ComponentFixture<ChatMessageListComponent>> {
  await TestBed.configureTestingModule({
    imports: [ChatMessageListComponent],
  }).compileComponents();
  const fixture = TestBed.createComponent(ChatMessageListComponent);
  fixture.componentInstance.messages = messages;
  fixture.detectChanges();
  return fixture;
}

describe('ChatMessageListComponent (block-aware render)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders text block as plain text inside .message-content', async () => {
    const msg = makeMsg('user', [{ type: 'text', text: 'Hello world' }]);
    const fixture = await createFixture([msg]);

    const content = fixture.nativeElement.querySelector('.message-content') as HTMLElement;
    expect(content.textContent).toContain('Hello world');
  });

  it('renders tool_use block as <app-pending-pill>', async () => {
    const toolUse: ToolUseBlock = {
      type: 'tool_use',
      id: 'tu-1',
      name: 'memory',
      input: { command: 'create', path: '/memories/x.md', file_text: 'remember' },
      status: 'pending',
    };
    const msg = makeMsg('assistant', [toolUse]);
    const fixture = await createFixture([msg]);

    const pill = fixture.debugElement.query(By.directive(PendingPillComponent));
    expect(pill).toBeTruthy();
    // The pill DOM is rendered (presence of role=region article wrapper).
    expect(fixture.nativeElement.querySelector('.pending-pill')).toBeTruthy();
  });

  it('renders tool_result block with "Tool result:" prefix', async () => {
    const toolResult: ChatBlock = {
      type: 'tool_result',
      tool_use_id: 'tu-1',
      content: 'File saved successfully',
    };
    const msg = makeMsg('assistant', [toolResult]);
    const fixture = await createFixture([msg]);

    const placeholder = fixture.nativeElement.querySelector('.tool-result-placeholder') as HTMLElement | null;
    expect(placeholder).toBeTruthy();
    expect(placeholder?.textContent).toContain('Tool result');
    expect(placeholder?.textContent).toContain('File saved successfully');
  });

  it('(blockAction) emits when pending-pill emits approve', async () => {
    const toolUse: ToolUseBlock = {
      type: 'tool_use',
      id: 'tu-1',
      name: 'memory',
      input: { command: 'create', path: '/memories/x.md', file_text: 'X' },
      status: 'pending',
    };
    const msg = makeMsg('assistant', [toolUse]);
    const fixture = await createFixture([msg]);

    let emitted: { messageId: string; blockIndex: number; action: string } | undefined;
    fixture.componentInstance.blockAction.subscribe((event) => (emitted = event));

    const pill = fixture.debugElement.query(By.directive(PendingPillComponent));
    pill.componentInstance.approve.emit();

    expect(emitted).toBeTruthy();
    expect(emitted?.messageId).toBe(msg.id);
    expect(emitted?.blockIndex).toBe(0);
    expect(emitted?.action).toBe('approve');
  });

  it('(blockAction) emits with editedText when pending-pill emits edit', async () => {
    const toolUse: ToolUseBlock = {
      type: 'tool_use',
      id: 'tu-1',
      name: 'update_profile',
      input: { section: 'goals', value: 'X' },
      status: 'pending',
    };
    const msg = makeMsg('assistant', [toolUse]);
    const fixture = await createFixture([msg]);

    let emitted: { messageId: string; blockIndex: number; action: string; editedText?: string } | undefined;
    fixture.componentInstance.blockAction.subscribe((event) => (emitted = event));

    const pill = fixture.debugElement.query(By.directive(PendingPillComponent));
    pill.componentInstance.edit.emit('new edited text');

    expect(emitted?.action).toBe('edit');
    expect(emitted?.editedText).toBe('new edited text');
  });

  it('preserves <div class="message-content"> wrapper for every message (DOM contract)', async () => {
    const messages = [
      makeMsg('user', [{ type: 'text', text: 'A' }]),
      makeMsg('assistant', [{ type: 'text', text: 'B' }]),
    ];
    const fixture = await createFixture(messages);
    const wrappers = fixture.nativeElement.querySelectorAll('.message-content');
    // 2 message wrappers (loading state not active).
    expect(wrappers.length).toBe(2);
  });

  it('expectNoSeriousA11yViolations on representative render', async () => {
    const toolUse: ToolUseBlock = {
      type: 'tool_use',
      id: 'tu-1',
      name: 'memory',
      input: { command: 'create', path: '/memories/x.md', file_text: 'remember' },
      status: 'pending',
    };
    const messages = [
      makeMsg('user', [{ type: 'text', text: 'Should we save this?' }]),
      makeMsg('assistant', [toolUse]),
    ];
    const fixture = await createFixture(messages);
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});

describe('ChatMessageListComponent — citation-link guard (E1, D-13)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders ZERO <a> anchors for author-year / bare DOI / bare URL prose', async () => {
    // Adversarial: prose that LOOKS like citations but is model-authored free text.
    const prose =
      'A meta-analysis by Smith et al. 2019 found this. ' +
      'See doi 10.1000/xyz for details. ' +
      'Full text at https://pubmed.ncbi.nlm.nih.gov/12345 today.';
    const msg = makeMsg('assistant', [{ type: 'text', text: prose }]);
    const fixture = await createFixture([msg]);

    // THE headline assertion — no model prose can ever become a hyperlink.
    expect(fixture.nativeElement.querySelectorAll('a').length).toBe(0);
    // The prose text still renders (inert, plain).
    expect(fixture.nativeElement.querySelector('.message-content')?.textContent).toContain(
      'Smith et al. 2019',
    );
    expect(fixture.nativeElement.querySelector('.message-content')?.textContent).toContain(
      'https://pubmed.ncbi.nlm.nih.gov/12345',
    );
  });

  it('the guard DISTINGISHES structured citations (forward-compat for Phase 5)', () => {
    // Guard PERMITS only API-structured citation block types.
    expect(isLinkableCitation({ type: 'search_result_location' })).toBe(true);
    expect(isLinkableCitation({ type: 'web_search_result_location' })).toBe(true);
    // Guard REJECTS anything else (author-year/DOI/URL prose has no such type).
    expect(isLinkableCitation({ type: 'text' })).toBe(false);
    expect(isLinkableCitation({ type: 'page_location' })).toBe(false);
    expect(isLinkableCitation(undefined)).toBe(false);
  });

  it('uses NO bypassSecurityTrust* in the render path (interpolation-only)', () => {
    const src = ChatMessageListComponent.toString();
    expect(src.includes('bypassSecurityTrust')).toBe(false);
    expect(src.includes('innerHTML')).toBe(false);
  });
});

describe('ChatMessageListComponent — confidence + source badges (E4, D-08/D-10)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('triple-encodes a calm (strong·data) and an alert (speculative·research) badge', async () => {
    const text =
      'Your weight is trending down. [evidence: strong][source: data] ' +
      'Ketone supplements might help. [evidence: speculative][source: research]';
    const msg = makeMsg('assistant', [{ type: 'text', text }]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    const confChips = Array.from(el.querySelectorAll('.confidence-chip')) as HTMLElement[];
    expect(confChips.length).toBe(2);

    const strongChip = confChips.find((c) => c.getAttribute('aria-label') === 'Confidence: strong')!;
    const specChip = confChips.find(
      (c) => c.getAttribute('aria-label') === 'Confidence: speculative',
    )!;
    expect(strongChip).toBeTruthy();
    expect(specChip).toBeTruthy();

    // (1) icon glyph as real text content; (2) text label; (3) tier class — triple-encoding.
    expect(strongChip.textContent).toContain('✓');
    expect(strongChip.textContent).toContain('strong');
    expect(strongChip.classList).toContain('tier-calm');

    expect(specChip.textContent).toContain('⚠');
    expect(specChip.textContent).toContain('speculative');
    expect(specChip.classList).toContain('tier-alert');

    // Calm and alert render with DISTINCT tier classes (color never alone).
    expect(strongChip.classList.contains('tier-alert')).toBe(false);
    expect(specChip.classList.contains('tier-calm')).toBe(false);
  });

  it('source chip carries icon + aria-label for your-data and research', async () => {
    const text =
      'Down trend. [evidence: strong][source: data] ' +
      'General point. [evidence: moderate][source: research]';
    const msg = makeMsg('assistant', [{ type: 'text', text }]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    const sources = Array.from(el.querySelectorAll('.source-chip')) as HTMLElement[];
    const dataChip = sources.find((s) => s.getAttribute('aria-label') === 'Source: from your data')!;
    const researchChip = sources.find(
      (s) =>
        s.getAttribute('aria-label') ===
        'Source: from research — general knowledge, not a live source',
    )!;
    expect(dataChip).toBeTruthy();
    expect(dataChip.textContent).toContain('📈');
    expect(dataChip.textContent).toContain('your data');

    expect(researchChip).toBeTruthy();
    expect(researchChip.textContent).toContain('📚');
    expect(researchChip.textContent).toContain('research');
  });

  it('a from-research claim renders the literal qualifier and zero links', async () => {
    const text = 'Caffeine may aid endurance. [evidence: moderate][source: research]';
    const msg = makeMsg('assistant', [{ type: 'text', text }]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.message-content')?.textContent).toContain(
      'general knowledge — not a live source',
    );
    expect(el.querySelectorAll('a').length).toBe(0);
  });

  it('an unbadged claim renders plain prose with no chip', async () => {
    const text = 'Just a plain sentence with no grading token.';
    const msg = makeMsg('assistant', [{ type: 'text', text }]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('.confidence-chip').length).toBe(0);
    expect(el.querySelectorAll('.source-chip').length).toBe(0);
    expect(el.querySelector('.message-content')?.textContent).toContain('Just a plain sentence');
  });

  it('D-11 view-source link is ABSENT this phase (deferred to Phase 5)', async () => {
    const text = 'Down trend. [evidence: strong][source: data]';
    const msg = makeMsg('assistant', [{ type: 'text', text }]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('[data-view-source]').length).toBe(0);
    expect(el.querySelectorAll('a').length).toBe(0);
  });

  it('expectNoSeriousA11yViolations on a badged render', async () => {
    const text =
      'Weight is down. [evidence: strong][source: data] ' +
      'Maybe try cold exposure. [evidence: speculative][source: research]';
    const msg = makeMsg('assistant', [{ type: 'text', text }]);
    const fixture = await createFixture([msg]);
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});

describe('ChatMessageListComponent — tool disclosures (E12, D-05/D-06)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function queryToolUse(id: string, name: string, input: unknown): ToolUseBlock {
    return { type: 'tool_use', id, name, input, status: 'approved' };
  }

  it('renders a query_* tool_use as a collapsed <details> (not open by default)', async () => {
    const tu = queryToolUse('tu-w', 'query_weight_entries', { from: '2026-01-01', to: '2026-05-31' });
    const tr: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'tu-w',
      content: 'Weight entries: 38 total, span 2026-01-01..2026-05-31. min 180 / max 195.',
    };
    const msg = makeMsg('assistant', [tu, tr]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    const details = el.querySelector('details');
    expect(details).toBeTruthy();
    expect((details as HTMLDetailsElement).open).toBe(false);
    expect(el.querySelector('summary')).toBeTruthy();
  });

  it('resolved summary uses the LOCKED verb with renderer-derived count + range', async () => {
    const tu = queryToolUse('tu-w', 'query_weight_entries', { from: '2026-01-01', to: '2026-05-31' });
    const tr: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'tu-w',
      content: 'Weight entries: 38 total, span 2026-01-01..2026-05-31.',
    };
    const msg = makeMsg('assistant', [tu, tr]);
    const fixture = await createFixture([msg]);
    const summary = fixture.nativeElement.querySelector('summary') as HTMLElement;

    expect(summary.textContent).toContain('Read');
    expect(summary.textContent).toContain('weight entries');
    expect(summary.textContent).toContain('38');
    // Range derived from the tool_use input, NOT model prose.
    expect(summary.textContent).toContain('2026-01-01');
    // Accessible name prefix.
    expect(summary.getAttribute('aria-label')).toContain('Show what the AI looked at:');
  });

  it('OMITS the · range/count clause when the count is unavailable', async () => {
    // Result with no parseable "N total" and a tool_use with no from/to range.
    const tu = queryToolUse('tu-s', 'query_saved_foods', {});
    const tr: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'tu-s',
      content: 'No saved foods in the library.',
    };
    const msg = makeMsg('assistant', [tu, tr]);
    const fixture = await createFixture([msg]);
    const summary = fixture.nativeElement.querySelector('summary') as HTMLElement;

    expect(summary.textContent).toContain('saved foods');
    // No dangling "·" middot when nothing to qualify.
    expect(summary.textContent).not.toContain('·');
  });

  it('tool_result expanded body shows Tool / Query / Result in a <pre>', async () => {
    const tu = queryToolUse('tu-c', 'query_cardio_sessions', { from: '2026-01-01' });
    const tr: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'tu-c',
      content: 'Cardio sessions: 5 total, span 2026-01-01..2026-02-01. 120 min, 30.0 km combined.',
    };
    const msg = makeMsg('assistant', [tu, tr]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;
    const details = el.querySelector('details') as HTMLElement;

    expect(details.textContent).toContain('Tool: query_cardio_sessions');
    expect(details.textContent).toContain('Query:');
    expect(details.textContent).toContain('Result:');
    const pres = Array.from(details.querySelectorAll('pre')) as HTMLElement[];
    // Two <pre> blocks: Query params + Result. The result content lives in one of them.
    expect(pres.length).toBe(2);
    expect(pres.some((p) => p.textContent?.includes('Cardio sessions: 5 total'))).toBe(true);
  });

  it('an in-flight query_* row (no paired result) is role=status, aria-live, non-expandable', async () => {
    const tu = queryToolUse('tu-w', 'query_weight_entries', { from: '2026-01-01' });
    const msg = makeMsg('assistant', [tu]); // NO tool_result yet
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    // No <details> for in-flight (non-expandable).
    expect(el.querySelector('details')).toBeFalsy();
    const live = el.querySelector('[role="status"]') as HTMLElement;
    expect(live).toBeTruthy();
    expect(live.getAttribute('aria-live')).toBe('polite');
    // Present-tense LOCKED verb.
    expect(live.textContent).toContain('Reading your weight entries');
  });

  it('a memory write-proposal tool_use STILL renders <app-pending-pill> (not a disclosure)', async () => {
    const memory: ToolUseBlock = {
      type: 'tool_use',
      id: 'tu-m',
      name: 'memory',
      input: { command: 'create', path: '/memories/x.md', file_text: 'remember' },
      status: 'pending',
    };
    const msg = makeMsg('assistant', [memory]);
    const fixture = await createFixture([msg]);

    expect(fixture.debugElement.query(By.directive(PendingPillComponent))).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.pending-pill')).toBeTruthy();
    // Memory does NOT get a query disclosure.
    expect(fixture.nativeElement.querySelector('details')).toBeFalsy();
  });

  it('expectNoSeriousA11yViolations on a tool-disclosure render', async () => {
    const tu = queryToolUse('tu-w', 'query_weight_entries', { from: '2026-01-01', to: '2026-05-31' });
    const tr: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'tu-w',
      content: 'Weight entries: 38 total, span 2026-01-01..2026-05-31.',
    };
    const inflight = queryToolUse('tu-r', 'query_readings', { from: '2026-01-01' });
    const messages = [makeMsg('assistant', [tu, tr]), makeMsg('assistant', [inflight])];
    const fixture = await createFixture(messages);
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});

// ── Web-search live/persisted rows (D-05, Task 1a) ───────────────────────────

function serverToolUse(id: string, query: string): ServerToolUsePersistedBlock {
  return { type: 'server_tool_use', id, name: 'web_search', input: { query } };
}

function webResultBlock(toolUseId: string, count: number): WebSearchToolResultPersistedBlock {
  return {
    type: 'web_search_tool_result',
    toolUseId,
    content: Array.from({ length: count }, (_, i) => ({
      type: 'web_search_result' as const,
      url: `https://example.org/r${i}`,
      title: `Result ${i}`,
      encryptedContent: `enc_${i}`,
    })),
  };
}

function webErrorBlock(toolUseId: string, errorCode: string): WebSearchToolResultPersistedBlock {
  return {
    type: 'web_search_tool_result',
    toolUseId,
    content: { type: 'web_search_tool_result_error', errorCode },
  };
}

describe('ChatMessageListComponent — web-search rows (D-05)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('an in-flight server_tool_use (no paired result) renders the role=status searching row', async () => {
    const msg = makeMsg('assistant', [serverToolUse('srv-1', 'creatine evidence')]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    // No <details> while in-flight (non-expandable).
    expect(el.querySelector('details')).toBeFalsy();
    const live = el.querySelector('[role="status"]') as HTMLElement;
    expect(live).toBeTruthy();
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toContain('Searching the web');
    expect(live.textContent).toContain('creatine evidence');
  });

  it('a resolved web_search_tool_result renders the collapsed "Found {n} sources" disclosure', async () => {
    const msg = makeMsg('assistant', [
      serverToolUse('srv-1', 'resistance training frequency'),
      webResultBlock('srv-1', 3),
    ]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    const details = el.querySelector('details') as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
    const summary = el.querySelector('summary') as HTMLElement;
    expect(summary.textContent).toContain('🔎 Found 3 sources');
    expect(summary.getAttribute('aria-label')).toContain('Show what the AI searched for:');
    // Renderer-derived query in the body, never model prose.
    expect(details.textContent).toContain('Web search');
    expect(details.textContent).toContain('resistance training frequency');
  });

  it('a web_search error result renders an honest row with NO anchor', async () => {
    const msg = makeMsg('assistant', [
      serverToolUse('srv-1', 'over the cap'),
      webErrorBlock('srv-1', 'max_uses_exceeded'),
    ]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('details')).toBeFalsy();
    expect(el.textContent).toContain("Couldn't reach the web");
    expect(el.querySelectorAll('a').length).toBe(0);
  });

  it('expectNoSeriousA11yViolations on a web-search row render (color-contrast enforced)', async () => {
    const messages = [
      makeMsg('assistant', [serverToolUse('srv-a', 'q')]),
      makeMsg('assistant', [serverToolUse('srv-b', 'q2'), webResultBlock('srv-b', 2)]),
    ];
    const fixture = await createFixture(messages);
    // Scope contrast enforcement to the search-row surfaces themselves. The
    // surrounding assistant-bubble chrome (.message-time opacity 0.6,
    // .message-role opacity 0.8) is the Phase-4 palette the cross-chat
    // color-contrast sweep owns in 05-09 — out of scope for this row. The
    // search row's own #2c3e50-on-#f8f9fa text is contrast-clean and enforced.
    const live = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    const details = fixture.nativeElement.querySelector('details') as HTMLElement;
    await expectNoSeriousA11yViolations(live);
    await expectNoSeriousA11yViolations(details);
  });
});

// ── Grounded footnotes + Sources list + grounded badge (D-03/D-04/D-09, Task 1b)

function groundedCite(url: string, title: string, citedText = 'excerpt'): GroundedCitation {
  return { url, title, citedText };
}

function textWithCitations(text: string, citations: GroundedCitation[]): TextBlock {
  return { type: 'text', text, citations };
}

describe('ChatMessageListComponent — grounded footnotes + Sources (D-03/D-04)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('F2: a grounded claim renders a footnote [1] anchor + a Sources https link', async () => {
    const msg = makeMsg('assistant', [
      textWithCitations(
        'Train each muscle group at least twice per week. [evidence: strong][source: research]',
        [groundedCite('https://example.org/rt-guidelines', 'Resistance Training — 2024 Guidelines')],
      ),
    ]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    const marker = el.querySelector('a.footnote-marker') as HTMLAnchorElement;
    expect(marker).toBeTruthy();
    expect(marker.textContent).toContain('[1]');
    expect(marker.getAttribute('href')).toBe(`#source-${msg.id}-1`);
    expect(marker.getAttribute('aria-label')).toBe('Source 1: Resistance Training — 2024 Guidelines');

    const sources = el.querySelector('section.sources') as HTMLElement;
    expect(sources).toBeTruthy();
    expect(sources.getAttribute('aria-label')).toBe('Sources');
    const url = el.querySelector('a.sources-url') as HTMLAnchorElement;
    expect(url.getAttribute('href')).toBe('https://example.org/rt-guidelines');
    expect(url.getAttribute('href')!.startsWith('https:')).toBe(true);
    // The Sources item carries the matching anchor target id.
    expect(el.querySelector(`#source-${msg.id}-1`)).toBeTruthy();
  });

  it('F2: a grounded research claim shows the · grounded badge (not the un-grounded one)', async () => {
    const msg = makeMsg('assistant', [
      textWithCitations(
        'Twice per week is supported. [evidence: strong][source: research]',
        [groundedCite('https://example.org/g', 'Guideline')],
      ),
    ]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    const grounded = el.querySelector('.source-chip--grounded') as HTMLElement;
    expect(grounded).toBeTruthy();
    expect(grounded.textContent).toContain('research · grounded');
    expect(grounded.textContent).toContain('📚🔗');
    expect(grounded.getAttribute('aria-label')).toBe(
      'Source: from research, grounded in 1 live web source(s)',
    );
    // The un-grounded qualifier text is NOT present on a grounded claim.
    expect(el.querySelector('.message-content')?.textContent).not.toContain(
      'general knowledge — not a live source',
    );
  });

  it('F4: an un-grounded research claim has NO link, NO grounded badge, keeps the qualifier', async () => {
    const text =
      'Progressive overload drives strength gains. [evidence: moderate][source: research]';
    const msg = makeMsg('assistant', [{ type: 'text', text }]); // no citations
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('a').length).toBe(0);
    expect(el.querySelector('.source-chip--grounded')).toBeFalsy();
    expect(el.querySelector('.footnote-marker')).toBeFalsy();
    expect(el.querySelector('section.sources')).toBeFalsy();
    expect(el.querySelector('.message-content')?.textContent).toContain(
      'general knowledge — not a live source',
    );
  });

  it('F5: a mixed turn renders the grounded and un-grounded claims distinguishably', async () => {
    const msg = makeMsg('assistant', [
      textWithCitations(
        'Load 20 g/day for 5–7 days. [evidence: strong][source: research]',
        [groundedCite('https://example.org/creatine', 'Creatine Loading')],
      ),
      { type: 'text', text: 'Consistency matters most. [evidence: moderate][source: research]' },
    ]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    // Exactly one grounded badge + one un-grounded research chip.
    expect(el.querySelectorAll('.source-chip--grounded').length).toBe(1);
    expect(el.querySelectorAll('.footnote-marker').length).toBe(1);
    // The un-grounded chip keeps the qualifier; one Sources list (grounded block only).
    expect(el.querySelector('.message-content')?.textContent).toContain(
      'general knowledge — not a live source',
    );
    expect(el.querySelectorAll('section.sources').length).toBe(1);
  });

  it('F6: a non-https citation renders plain text — never a link (https gate)', async () => {
    // A persisted non-https citation should never have survived the serializer,
    // but the renderer re-narrows defensively: toGroundedCitations drops it.
    const msg = makeMsg('assistant', [
      textWithCitations('Insecure ref. [evidence: weak][source: research]', [
        { url: 'http://insecure.example.com/a', title: 'Insecure', citedText: 'x' },
      ]),
    ]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('a').length).toBe(0);
    expect(el.querySelector('.source-chip--grounded')).toBeFalsy();
    expect(el.querySelector('section.sources')).toBeFalsy();
  });

  it('F7: a null/blank-title citation falls back to the URL host in the Sources link', async () => {
    const msg = makeMsg('assistant', [
      textWithCitations('Null-title source. [evidence: moderate][source: research]', [
        { url: 'https://no-title.example.net/page', title: 'no-title.example.net', citedText: 'x' },
      ]),
    ]);
    const fixture = await createFixture([msg]);
    const el: HTMLElement = fixture.nativeElement;

    const title = el.querySelector('.sources-title') as HTMLElement;
    expect(title.textContent).toContain('no-title.example.net');
    const url = el.querySelector('a.sources-url') as HTMLAnchorElement;
    expect(url.getAttribute('href')!.startsWith('https:')).toBe(true);
  });

  it('expectNoSeriousA11yViolations on a grounded footnote + Sources render (color-contrast enforced)', async () => {
    const msg = makeMsg('assistant', [
      textWithCitations(
        'Twice per week. [evidence: strong][source: research]',
        [groundedCite('https://example.org/rt', 'RT Guidelines')],
      ),
    ]);
    const fixture = await createFixture([msg]);
    // Scope contrast to the grounded surfaces (footnote marker, Sources section,
    // grounded chip). Bubble chrome (.message-time/.message-role opacity) is
    // 05-09's cross-chat sweep. The accent #21618c link / #2c3e50 chip text
    // is contrast-clean against the #f0f0f0 bubble and enforced here.
    const sources = fixture.nativeElement.querySelector('section.sources') as HTMLElement;
    const chip = fixture.nativeElement.querySelector('.source-chip--grounded') as HTMLElement;
    const marker = fixture.nativeElement.querySelector('a.footnote-marker') as HTMLElement;
    await expectNoSeriousA11yViolations(sources);
    await expectNoSeriousA11yViolations(chip);
    await expectNoSeriousA11yViolations(marker);
  });
});

/**
 * E1 — RESCH-03 adversarial citation-link integrity, ZERO TOLERANCE: any
 * fabricated / non-https link is a build-failing red, not a warning
 * (AI-SPEC §5 E1 rubric + §6 online guardrail). This is THE single most
 * important eval artifact for Phase 5: it proves, across the web-OFF (F1)
 * and web-ON (F3) matrix, that the ONLY DOM `<a href>` traces to a
 * structured `web_search_result_location` block (https-gated) — model-authored
 * prose (author-year strings, bare DOIs, bare URLs) NEVER becomes a link.
 *
 * The fixtures are real SDK `Message` shapes (web-citation-parser.fixtures);
 * they are routed through the production `fromAnthropicMessage` serializer (the
 * SOLE chokepoint that narrows SDK `TextCitation` → local GroundedCitation),
 * exactly as the live loop renders them — no test-only block construction.
 */
describe('ChatMessageListComponent — E1 adversarial citation-link gate (RESCH-03, ZERO TOLERANCE)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function renderFixture(sdkMessage: Message): Promise<ComponentFixture<ChatMessageListComponent>> {
    const blocks = fromAnthropicMessage(sdkMessage);
    return createFixture([makeMsg('assistant', blocks)]);
  }

  it('WEB-OFF (F1): model-authored author-year + bare DOI prose yields ZERO <a>', async () => {
    const fixture = await renderFixture(F1);
    const el: HTMLElement = fixture.nativeElement;

    // THE zero-tolerance assertion for the OFF axis.
    expect(el.querySelectorAll('a').length).toBe(0);
    // The prose still renders, inert and plain.
    const content = el.querySelector('.message-content')?.textContent ?? '';
    expect(content).toContain('Smith et al. 2021');
    expect(content).toContain('10.1234/abcd');
  });

  it('WEB-ON (F3): only the structured grounded citation links; prose author-year is inert', async () => {
    const fixture = await renderFixture(F3);
    const el: HTMLElement = fixture.nativeElement;

    // F3 carries exactly ONE grounded web_search_result_location citation.
    const f3TextBlock = F3.content.find(
      (b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text' && !!b.citations,
    );
    const grounded = toGroundedCitations(f3TextBlock?.citations ?? undefined);
    expect(grounded.length).toBe(1);

    // Anchors that point at a Sources https URL == the grounded-citation count.
    const sourceUrlAnchors = Array.from(
      el.querySelectorAll('a.sources-url'),
    ) as HTMLAnchorElement[];
    expect(sourceUrlAnchors.length).toBe(grounded.length);
    for (const a of sourceUrlAnchors) {
      expect(a.getAttribute('href')!.startsWith('https:')).toBe(true);
    }

    // The model-authored "Jones 2020" prose string is NOT an anchor.
    const anchorTexts = Array.from(el.querySelectorAll('a')).map((a) => a.textContent ?? '');
    expect(anchorTexts.some((t) => t.includes('Jones 2020'))).toBe(false);
    // It still renders as inert plain text inside the prose.
    expect(el.querySelector('.message-content')?.textContent).toContain('Jones 2020');

    // Every anchor in the DOM is either a footnote marker or a Sources URL — both
    // trace to the structured grounded citation. None trace to free prose.
    const allAnchors = Array.from(el.querySelectorAll('a')) as HTMLAnchorElement[];
    for (const a of allAnchors) {
      const href = a.getAttribute('href') ?? '';
      const tracesToStructured = href.startsWith('https:') || href.startsWith('#source-');
      expect(tracesToStructured).toBe(true);
    }
  });

  it('NON-HTTPS structured block (F6): http:/ftp: citations are dropped — never an <a>', async () => {
    const fixture = await renderFixture(F6);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('a').length).toBe(0);
    expect(el.querySelector('section.sources')).toBeFalsy();
  });

  it('toGroundedCitations DROPS a non-web_search_result_location citation (allow-list)', () => {
    // Direct unit assertion alongside the DOM gate: the parser allow-list is the
    // sole path to a link, and it rejects any other citation type outright.
    const nonWebSearch = [
      { type: 'page_location', url: 'https://example.org/x', title: 'X', cited_text: 'x' },
      { type: 'char_location', url: 'https://example.org/y', title: 'Y', cited_text: 'y' },
    ] as never;
    expect(toGroundedCitations(nonWebSearch)).toEqual([]);
  });
});
