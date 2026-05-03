/**
 * chat-message-list spec (Plan 03-05 Task 3).
 *
 * Verifies the block-aware @switch render: text → plain text, tool_use →
 * <app-pending-pill>, tool_result → static placeholder. Also covers the
 * (blockAction) Output emit via the inner pending-pill.
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ChatMessageListComponent } from './chat-message-list.component';
import { PendingPillComponent } from './pending-pill.component';
import { ChatBlock, ChatMessage, ToolUseBlock } from '../../models/ai-chat.model';
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
