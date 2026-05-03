/**
 * Settings Memory sub-page spec — Plan 03-04 Task 4.
 *
 * Verifies:
 *   - h1 "AI memory" + subhead.
 *   - <app-empty-state> when memoryFiles is empty.
 *   - Path-tree row per file with full-path label + aria-label "{path}, {n} bytes".
 *   - Click on leaf toggles expanded/aria-expanded state.
 *   - Click on Edit swaps preview for textarea + Save changes / Discard edits.
 *   - Save changes calls memoryStore.writeFile and exits edit mode.
 *   - Discard edits returns to preview without writing.
 *   - Delete shows window.confirm; confirm-true → deleteFile called.
 *   - Delete confirm-cancel → deleteFile NOT called.
 *   - Load failure renders <app-error-state>.
 *   - Severity-gated axe-core a11y (color-contrast deferred).
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SettingsMemoryComponent } from './settings-memory.component';
import { MemoryStoreService, MemoryFileEntry } from '../../services/memory-store.service';
import { StorageService } from '../../services/storage.service';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

interface Spies {
  memoryStore: jasmine.SpyObj<MemoryStoreService>;
  storage: jasmine.SpyObj<StorageService>;
}

function makeSpies(opts: {
  files?: MemoryFileEntry[];
  fileContents?: Record<string, string>;
  hasInitError?: boolean;
  deleteResult?: boolean;
} = {}): Spies {
  const files = opts.files ?? [];
  const memoryStore = jasmine.createSpyObj<MemoryStoreService>('MemoryStoreService', [
    'listFiles',
    'readFile',
    'writeFile',
    'deleteFile',
    'renameFile',
  ]);
  memoryStore.listFiles.and.returnValue(of(files));
  memoryStore.readFile.and.callFake((path: string) =>
    of(opts.fileContents?.[path] ?? null),
  );
  memoryStore.writeFile.and.returnValue(of(undefined));
  memoryStore.deleteFile.and.returnValue(of(opts.deleteResult ?? true));

  const storage = jasmine.createSpyObj<StorageService>('StorageService', ['initialize']);
  storage.initialize.and.returnValue(
    opts.hasInitError ? throwError(() => new Error('init failed')) : of(undefined),
  );

  return { memoryStore, storage };
}

async function configureBed(spies: Spies): Promise<ComponentFixture<SettingsMemoryComponent>> {
  await TestBed.configureTestingModule({
    imports: [SettingsMemoryComponent],
    providers: [
      { provide: MemoryStoreService, useValue: spies.memoryStore },
      { provide: StorageService, useValue: spies.storage },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SettingsMemoryComponent);
  fixture.detectChanges();
  return fixture;
}

describe('SettingsMemoryComponent', () => {
  it('renders h1 "AI memory" + subhead', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);

    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('AI memory');

    const subhead = fixture.nativeElement.querySelector('.page-subhead');
    expect(subhead?.textContent?.trim()).toContain('Files the AI has saved');
  });

  it('renders <app-empty-state> with verbatim copy when memoryFiles is empty', async () => {
    const spies = makeSpies({ files: [] });
    const fixture = await configureBed(spies);

    const empty = fixture.nativeElement.querySelector('app-empty-state');
    expect(empty).toBeTruthy();
    // EmptyStateComponent renders title + message via inputs; assert on rendered content.
    expect(empty.textContent).toContain('No memory files yet');
    expect(empty.textContent).toContain('When the AI saves something to remember');
  });

  it('renders one path-tree leaf per file with full-path label', async () => {
    const spies = makeSpies({
      files: [
        { path: '/memories/alpha.md', size: 12 },
        { path: '/memories/beta.md', size: 34 },
      ],
    });
    const fixture = await configureBed(spies);

    const leaves = fixture.nativeElement.querySelectorAll('.memory-tree-leaf');
    expect(leaves.length).toBe(2);
    expect((leaves[0] as HTMLButtonElement).textContent?.trim()).toBe('/memories/alpha.md');
    expect((leaves[1] as HTMLButtonElement).textContent?.trim()).toBe('/memories/beta.md');
  });

  it('leaf button has aria-label "{path}, {n} bytes"', async () => {
    const spies = makeSpies({
      files: [{ path: '/memories/test.md', size: 42 }],
    });
    const fixture = await configureBed(spies);

    const leaf = fixture.nativeElement.querySelector('.memory-tree-leaf') as HTMLButtonElement;
    expect(leaf.getAttribute('aria-label')).toBe('/memories/test.md, 42 bytes');
  });

  it('click on leaf toggles expanded state and aria-expanded attribute', async () => {
    const spies = makeSpies({
      files: [{ path: '/memories/x.md', size: 5 }],
      fileContents: { '/memories/x.md': 'hello' },
    });
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    const leaf = fixture.nativeElement.querySelector('.memory-tree-leaf') as HTMLButtonElement;
    expect(leaf.getAttribute('aria-expanded')).toBe('false');

    c.onToggleExpand('/memories/x.md');
    fixture.detectChanges();

    expect(c.expandedPath).toBe('/memories/x.md');
    expect((fixture.nativeElement.querySelector('.memory-tree-leaf') as HTMLButtonElement).getAttribute('aria-expanded')).toBe('true');

    c.onToggleExpand('/memories/x.md');
    fixture.detectChanges();
    expect(c.expandedPath).toBeNull();
  });

  it('click on Edit swaps preview for textarea + Save changes / Discard edits', async () => {
    const spies = makeSpies({
      files: [{ path: '/memories/x.md', size: 5 }],
      fileContents: { '/memories/x.md': 'hello' },
    });
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onToggleExpand('/memories/x.md');
    fixture.detectChanges();

    c.onStartEdit('/memories/x.md');
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('.memory-preview textarea');
    expect(textarea).toBeTruthy();

    const buttonLabels = Array.from(
      fixture.nativeElement.querySelectorAll('.memory-preview button'),
    ).map((b) => (b as HTMLButtonElement).textContent?.trim());
    expect(buttonLabels).toContain('Save changes');
    expect(buttonLabels).toContain('Discard edits');
  });

  it('Save changes calls memoryStore.writeFile and exits edit mode', async () => {
    const spies = makeSpies({
      files: [{ path: '/memories/x.md', size: 5 }],
      fileContents: { '/memories/x.md': 'hello' },
    });
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onToggleExpand('/memories/x.md');
    c.onStartEdit('/memories/x.md');
    c.editingDraft = 'updated content';
    c.onSaveEdit();

    expect(spies.memoryStore.writeFile).toHaveBeenCalledWith('/memories/x.md', 'updated content');
    expect(c.editingPath).toBeNull();
    expect(c.statusMessage).toBe('Memory file saved.');
  });

  it('Discard edits returns to preview without writing', async () => {
    const spies = makeSpies({
      files: [{ path: '/memories/x.md', size: 5 }],
      fileContents: { '/memories/x.md': 'hello' },
    });
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onToggleExpand('/memories/x.md');
    c.onStartEdit('/memories/x.md');
    c.editingDraft = 'will be discarded';

    c.onCancelEdit();

    expect(c.editingPath).toBeNull();
    expect(c.editingDraft).toBe('');
    expect(spies.memoryStore.writeFile).not.toHaveBeenCalled();
  });

  it('Delete shows window.confirm; on confirm calls memoryStore.deleteFile', async () => {
    const spies = makeSpies({
      files: [{ path: '/memories/x.md', size: 5 }],
    });
    spyOn(window, 'confirm').and.returnValue(true);

    const fixture = await configureBed(spies);
    fixture.componentInstance.onDelete('/memories/x.md');

    expect(window.confirm).toHaveBeenCalledWith(
      'Delete memory file "/memories/x.md"? This can\'t be undone.',
    );
    expect(spies.memoryStore.deleteFile).toHaveBeenCalledWith('/memories/x.md');
    expect(fixture.componentInstance.statusMessage).toBe('Memory file deleted.');
  });

  it('Delete on cancel does NOT call deleteFile', async () => {
    const spies = makeSpies({
      files: [{ path: '/memories/x.md', size: 5 }],
    });
    spyOn(window, 'confirm').and.returnValue(false);

    const fixture = await configureBed(spies);
    fixture.componentInstance.onDelete('/memories/x.md');

    expect(window.confirm).toHaveBeenCalled();
    expect(spies.memoryStore.deleteFile).not.toHaveBeenCalled();
  });

  it('Delete failure sets error status starting with "Couldn\'t delete memory file."', async () => {
    const spies = makeSpies({
      files: [{ path: '/memories/x.md', size: 5 }],
    });
    spies.memoryStore.deleteFile.and.returnValue(throwError(() => new Error('disk error')));
    spyOn(window, 'confirm').and.returnValue(true);

    const fixture = await configureBed(spies);
    fixture.componentInstance.onDelete('/memories/x.md');

    expect(fixture.componentInstance.statusMessage.startsWith("Couldn't delete memory file."))
      .toBeTrue();
    expect(fixture.componentInstance.statusIsError).toBeTrue();
  });

  it('renders <app-error-state> when storage.initialize() fails', async () => {
    const spies = makeSpies({ hasInitError: true });
    const fixture = await configureBed(spies);

    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
  });

  it('passes axe-core severe a11y check (color-contrast deferred per Plan 01-08 D-13)', async () => {
    const spies = makeSpies({
      files: [{ path: '/memories/x.md', size: 5 }],
    });
    const fixture = await configureBed(spies);
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});
