/**
 * Weight page edit-mode spec — Plan 05-06 Task 1 (QUAL-03, D-11/D-12).
 *
 * Mirrors the cardio edit-mode contract on the weight page:
 *   - Per-row Edit button (accessible name "Edit this weight entry").
 *   - Edit pre-fills the form + shows the "Editing entry" header + announces.
 *   - Save in edit mode calls WeightService.updateEntry(id, formValue), NOT addEntry.
 *   - Edit success clears edit mode + announces "Entry updated.".
 *   - Discard restores add mode without ANY service write (T-05-06-02).
 *   - Severe a11y clean after edit-mode render (color-contrast deferred to QUAL-08/09).
 */
import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { WeightPageComponent } from './weight-page.component';
import { WeightService } from '../../services/weight.service';
import { StorageService } from '../../services/storage.service';
import { WeightEntry } from '../../models/weight-entry.model';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

function makeEntry(overrides: Partial<WeightEntry> = {}): WeightEntry {
  return {
    id: 'entry-1',
    date: '2026-05-20T07:30:00.000Z',
    weightLbs: 185.5,
    notes: 'after breakfast',
    createdAt: '2026-05-20T07:30:00.000Z',
    updatedAt: '2026-05-20T07:30:00.000Z',
    ...overrides,
  };
}

interface Spies {
  weight: jasmine.SpyObj<WeightService>;
  storage: jasmine.SpyObj<StorageService>;
}

function makeSpies(entries: WeightEntry[] = [makeEntry()]): Spies {
  const weight = jasmine.createSpyObj<WeightService>('WeightService', [
    'getEntries',
    'addEntry',
    'updateEntry',
    'deleteEntry',
  ]);
  weight.getEntries.and.returnValue(of(entries));
  weight.addEntry.and.returnValue(of(entries[0]));
  weight.updateEntry.and.returnValue(of(entries[0]));
  weight.deleteEntry.and.returnValue(of(true));

  const storage = jasmine.createSpyObj<StorageService>('StorageService', ['initialize']);
  storage.initialize.and.returnValue(of(undefined));

  return { weight, storage };
}

async function configureBed(spies: Spies): Promise<ComponentFixture<WeightPageComponent>> {
  await TestBed.configureTestingModule({
    imports: [WeightPageComponent],
    providers: [
      { provide: WeightService, useValue: spies.weight },
      { provide: StorageService, useValue: spies.storage },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(WeightPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('WeightPageComponent edit mode', () => {
  it('renders a per-row Edit button with the locked accessible name', async () => {
    const fixture = await configureBed(makeSpies());
    const editBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Edit this weight entry"]',
    ) as HTMLButtonElement;
    expect(editBtn).toBeTruthy();
    expect(editBtn.textContent?.trim()).toBe('Edit');
  });

  it('clicking Edit pre-fills the form + shows the header + announces', fakeAsync(async () => {
    const entry = makeEntry();
    const fixture = await configureBed(makeSpies([entry]));
    const c = fixture.componentInstance;

    c.onEdit(entry);
    fixture.detectChanges();
    tick(0);

    expect(c.editingId).toBe('entry-1');
    expect(c.entryForm.get('weightLbs')?.value).toBe(185.5);
    expect(c.entryForm.get('notes')?.value).toBe('after breakfast');

    const header = fixture.nativeElement.querySelector('.edit-mode-header');
    expect(header?.textContent?.trim()).toBe('Editing entry');
    expect(c.editStatus).toBe('Editing entry — make your changes and save.');
  }));

  it('Save in edit mode calls updateEntry with the row id + form value (NOT addEntry)', async () => {
    const entry = makeEntry();
    const spies = makeSpies([entry]);
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onEdit(entry);
    c.entryForm.patchValue({ weightLbs: 183 });
    c.onSubmit();

    expect(spies.weight.updateEntry).toHaveBeenCalledTimes(1);
    expect(spies.weight.addEntry).not.toHaveBeenCalled();
    const [id, input] = spies.weight.updateEntry.calls.mostRecent().args;
    expect(id).toBe('entry-1');
    expect(input.weightLbs).toBe(183);
  });

  it('edit success clears edit mode + announces "Entry updated."', async () => {
    const entry = makeEntry();
    const fixture = await configureBed(makeSpies([entry]));
    const c = fixture.componentInstance;

    c.onEdit(entry);
    c.onSubmit();

    expect(c.editingId).toBeNull();
    expect(c.editStatus).toBe('Entry updated.');
  });

  it('Discard changes restores add mode without ANY service write (T-05-06-02)', async () => {
    const entry = makeEntry();
    const spies = makeSpies([entry]);
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onEdit(entry);
    expect(c.editingId).toBe('entry-1');

    c.onCancelEdit();

    expect(c.editingId).toBeNull();
    expect(c.editStatus).toBe('Edit discarded — back to adding a new entry.');
    expect(spies.weight.updateEntry).not.toHaveBeenCalled();
    expect(spies.weight.addEntry).not.toHaveBeenCalled();
  });

  // Only the app-global `.btn-*`/muted palette fails color-contrast (cross-page
  // QUAL-08/09 sweep owns it — see deferred-items.md); the edit-mode surface is clean.
  it('passes severe axe-core a11y after edit-mode render (color-contrast deferred to QUAL-08/09 global palette sweep)', async () => {
    const entry = makeEntry();
    const fixture = await configureBed(makeSpies([entry]));
    fixture.componentInstance.onEdit(entry);
    fixture.detectChanges();
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});
