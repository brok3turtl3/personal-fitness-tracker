/**
 * pending-pill.component spec (Plan 03-05 Task 1).
 *
 * Single component handling 4 statuses (pending / approved / discarded /
 * edited) × 2 pill kinds (memory / update_profile) per UI-SPEC.md copy +
 * D-10..D-13. Color is never the only indicator (glyph + label + timestamp).
 * Focal-point: primary action receives focus on entering pending state.
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { PendingPillComponent } from './pending-pill.component';
import { ToolUseBlock } from '../../models/ai-chat.model';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

// ---------------------------------------------------------------------------
// Per-spec factory helpers (D-07: per-spec construction, no shared canonical).
// ---------------------------------------------------------------------------

function memoryPendingBlock(overrides: Partial<ToolUseBlock> = {}): ToolUseBlock {
  return {
    type: 'tool_use',
    id: 'tu-mem-1',
    name: 'memory',
    input: {
      command: 'create',
      path: '/memories/note.md',
      file_text: 'User prefers running outdoors on Saturday mornings.',
    },
    status: 'pending',
    ...overrides,
  };
}

function profilePendingBlock(
  section: string,
  value = 'lose 15 lbs by July',
  overrides: Partial<ToolUseBlock> = {},
): ToolUseBlock {
  return {
    type: 'tool_use',
    id: 'tu-pf-1',
    name: 'update_profile',
    input: { section, value },
    status: 'pending',
    ...overrides,
  };
}

async function createFixture(block: ToolUseBlock): Promise<ComponentFixture<PendingPillComponent>> {
  await TestBed.configureTestingModule({
    imports: [PendingPillComponent],
  }).compileComponents();
  const fixture = TestBed.createComponent(PendingPillComponent);
  fixture.componentInstance.block = block;
  fixture.detectChanges();
  return fixture;
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('PendingPillComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  // ---------- 1. Memory pill — pending state copy ----------
  it('memory pill in pending state renders verbatim header "AI wants to remember this:"', async () => {
    const fixture = await createFixture(memoryPendingBlock());

    const header = fixture.nativeElement.querySelector('.pill-header') as HTMLElement | null;
    expect(header?.textContent?.trim()).toBe('AI wants to remember this:');
  });

  // ---------- 2. Memory pill — primary action label ----------
  it('memory pill primary action button text is "Save to memory"', async () => {
    const fixture = await createFixture(memoryPendingBlock());

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const primary = Array.from(buttons).find((b) => (b as HTMLElement).classList.contains('btn-primary')) as HTMLElement | undefined;
    expect(primary?.textContent?.trim()).toBe('Save to memory');
  });

  // ---------- 3. Memory pill — secondary actions ----------
  it('memory pill secondary actions are "Edit proposal" and "Discard proposal"', async () => {
    const fixture = await createFixture(memoryPendingBlock());

    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map(
      (b) => (b as HTMLElement).textContent?.trim() ?? '',
    );
    expect(labels).toContain('Edit proposal');
    expect(labels).toContain('Discard proposal');
  });

  // ---------- 4. Profile pill — pending header copy ----------
  it('update_profile pill in pending state renders verbatim header "AI proposes a profile update to "Goals":"', async () => {
    const fixture = await createFixture(profilePendingBlock('goals'));

    const header = fixture.nativeElement.querySelector('.pill-header') as HTMLElement | null;
    expect(header?.textContent?.trim()).toBe('AI proposes a profile update to "Goals":');
  });

  // ---------- 5. Profile pill — primary action ----------
  it('update_profile pill primary action is "Apply update"', async () => {
    const fixture = await createFixture(profilePendingBlock('preferences'));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const primary = Array.from(buttons).find((b) => (b as HTMLElement).classList.contains('btn-primary')) as HTMLElement | undefined;
    expect(primary?.textContent?.trim()).toBe('Apply update');
  });

  // ---------- 6. Profile section label mapping ----------
  it('profile section label maps goals→Goals, preferences→Preferences, dietaryConstraints→Dietary constraints, trainingHistory→Training history', async () => {
    const cases: Array<[string, string]> = [
      ['goals', 'Goals'],
      ['preferences', 'Preferences'],
      ['dietaryConstraints', 'Dietary constraints'],
      ['trainingHistory', 'Training history'],
    ];
    for (const [raw, label] of cases) {
      const fixture = await createFixture(profilePendingBlock(raw));
      const header = fixture.nativeElement.querySelector('.pill-header') as HTMLElement | null;
      expect(header?.textContent?.trim()).toBe(`AI proposes a profile update to "${label}":`);
      TestBed.resetTestingModule();
    }
  });

  // ---------- 7. (approve) emit ----------
  it('click on primary action emits (approve)', async () => {
    const fixture = await createFixture(memoryPendingBlock());
    let approved = 0;
    fixture.componentInstance.approve.subscribe(() => approved++);

    const primary = fixture.nativeElement.querySelector('.btn-primary') as HTMLButtonElement;
    primary.click();
    expect(approved).toBe(1);
  });

  // ---------- 8. (discard) emit ----------
  it('click on Discard proposal emits (discard)', async () => {
    const fixture = await createFixture(memoryPendingBlock());
    let discarded = 0;
    fixture.componentInstance.discard.subscribe(() => discarded++);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const discardBtn = Array.from(buttons).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Discard proposal',
    ) as HTMLButtonElement | undefined;
    discardBtn?.click();
    expect(discarded).toBe(1);
  });

  // ---------- 9. Edit-mode entry ----------
  it('click on Edit proposal swaps body for textarea + Save edits / Keep original buttons', async () => {
    const fixture = await createFixture(memoryPendingBlock());

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const editBtn = Array.from(buttons).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Edit proposal',
    ) as HTMLButtonElement | undefined;
    editBtn?.click();
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(textarea).toBeTruthy();
    expect(textarea?.getAttribute('aria-label')).toBe('Edit AI proposal');

    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map(
      (b) => (b as HTMLElement).textContent?.trim() ?? '',
    );
    expect(labels).toContain('Save edits');
    expect(labels).toContain('Keep original');
    // No longer "Save to memory" — the action surface swapped fully.
    expect(labels).not.toContain('Save to memory');
  });

  // ---------- 10. Save edits emit ----------
  it('Save edits emits (edit) with current textarea text', async () => {
    const fixture = await createFixture(memoryPendingBlock());
    let edited: string | undefined;
    fixture.componentInstance.edit.subscribe((text) => (edited = text));

    // Enter edit mode
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const editBtn = Array.from(buttons).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Edit proposal',
    ) as HTMLButtonElement;
    editBtn.click();
    fixture.detectChanges();

    // Type in the textarea
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'My amended proposal text';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // Click Save edits
    const saveBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Save edits',
    ) as HTMLButtonElement;
    saveBtn.click();

    expect(edited).toBe('My amended proposal text');
  });

  // ---------- 11. Keep original ----------
  it('Keep original returns to pending state without emitting (edit)', async () => {
    const fixture = await createFixture(memoryPendingBlock());
    let editEmitted = 0;
    fixture.componentInstance.edit.subscribe(() => editEmitted++);

    // Enter edit mode
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const editBtn = Array.from(buttons).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Edit proposal',
    ) as HTMLButtonElement;
    editBtn.click();
    fixture.detectChanges();

    // Click Keep original
    const cancelBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Keep original',
    ) as HTMLButtonElement;
    cancelBtn.click();
    fixture.detectChanges();

    expect(editEmitted).toBe(0);
    // Pending action buttons are back.
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map(
      (b) => (b as HTMLElement).textContent?.trim() ?? '',
    );
    expect(labels).toContain('Save to memory');
    expect(labels).toContain('Edit proposal');
  });

  // ---------- 12. approved badge ----------
  it('approved status renders "✓ Saved {time}" badge with role=status aria-live=polite', async () => {
    const fixture = await createFixture(memoryPendingBlock({ status: 'approved' }));

    const badge = fixture.nativeElement.querySelector('.pill-resolved') as HTMLElement | null;
    expect(badge).toBeTruthy();
    expect(badge?.getAttribute('role')).toBe('status');
    expect(badge?.getAttribute('aria-live')).toBe('polite');
    expect(badge?.textContent).toContain('✓');
    expect(badge?.textContent).toContain('Saved');
  });

  // ---------- 13. edited badge ----------
  it('edited status renders "✎ Edited and saved {time}"', async () => {
    const fixture = await createFixture(memoryPendingBlock({ status: 'edited', editedFromText: 'orig' }));

    const badge = fixture.nativeElement.querySelector('.pill-resolved') as HTMLElement | null;
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('✎');
    expect(badge?.textContent).toContain('Edited and saved');
  });

  // ---------- 14. discarded badge ----------
  it('discarded status renders "✗ Discarded {time}"', async () => {
    const fixture = await createFixture(memoryPendingBlock({ status: 'discarded' }));

    const badge = fixture.nativeElement.querySelector('.pill-resolved') as HTMLElement | null;
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('✗');
    expect(badge?.textContent).toContain('Discarded');
  });

  // ---------- 15. Focal point — primary action receives focus on entering pending state ----------
  it('primary action receives focus on entering pending state', async () => {
    const fixture = await createFixture(memoryPendingBlock());

    // The component schedules focus via setTimeout(0) — flush microtasks/timers.
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    const primary = fixture.nativeElement.querySelector('.btn-primary') as HTMLButtonElement;
    expect(document.activeElement).toBe(primary);
  });

  // ---------- 16. role + aria-label on the article wrapper ----------
  it('pill has role="region" with aria-label "AI proposal: memory" or "AI proposal: update_profile"', async () => {
    const fixture = await createFixture(memoryPendingBlock());
    const article = fixture.nativeElement.querySelector('.pending-pill') as HTMLElement;
    expect(article.getAttribute('role')).toBe('region');
    expect(article.getAttribute('aria-label')).toBe('AI proposal: memory');

    const fixture2 = await createFixture(profilePendingBlock('goals'));
    const article2 = fixture2.nativeElement.querySelector('.pending-pill') as HTMLElement;
    expect(article2.getAttribute('aria-label')).toBe('AI proposal: update_profile');
  });

  // ---------- 17. axe-core a11y for all 4 statuses ----------
  it('expectNoSeriousA11yViolations on representative render with all 4 statuses', async () => {
    const statuses: Array<ToolUseBlock['status']> = ['pending', 'approved', 'edited', 'discarded'];
    for (const s of statuses) {
      const fixture = await createFixture(memoryPendingBlock({ status: s }));
      await expectNoSeriousA11yViolations(fixture.nativeElement, {
        disableRules: ['color-contrast'],
      });
      TestBed.resetTestingModule();
    }
  });
});
