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
import { ChatBlock, ChatMessage, ToolResultBlock, ToolUseBlock } from '../../models/ai-chat.model';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

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
