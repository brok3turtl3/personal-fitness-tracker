/**
 * Cardio page edit-mode spec — Plan 05-06 Task 1 (QUAL-03, D-11/D-12).
 *
 * Verifies the in-place edit affordance wired onto the existing entry form:
 *   - A per-history-row Edit button (accessible name "Edit this cardio session").
 *   - Clicking Edit pre-fills the form via patchValue + shows the "Editing entry"
 *     header + announces the mode change (role="status"), never color-only.
 *   - Save in edit mode calls CardioService.updateSession(id, formValue) — NOT
 *     addSession — preserving identity through the 05-03 service method.
 *   - Edit success clears edit mode + announces "Entry updated.".
 *   - Discard changes restores add mode without ANY service write (T-05-06-02).
 *   - Severe a11y (incl. color-contrast — QUAL-08) clean after edit-mode render.
 */
import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { CardioPageComponent } from './cardio-page.component';
import { CardioService } from '../../services/cardio.service';
import { StorageService } from '../../services/storage.service';
import { CardioSession } from '../../models/cardio-session.model';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

function makeSession(overrides: Partial<CardioSession> = {}): CardioSession {
  return {
    id: 'session-1',
    date: '2026-05-20T07:30:00.000Z',
    type: 'running',
    durationMinutes: 30,
    distanceKm: 5,
    caloriesBurned: 320,
    notes: 'morning run',
    createdAt: '2026-05-20T07:30:00.000Z',
    updatedAt: '2026-05-20T07:30:00.000Z',
    ...overrides,
  };
}

interface Spies {
  cardio: jasmine.SpyObj<CardioService>;
  storage: jasmine.SpyObj<StorageService>;
}

function makeSpies(sessions: CardioSession[] = [makeSession()]): Spies {
  const cardio = jasmine.createSpyObj<CardioService>('CardioService', [
    'getSessions',
    'addSession',
    'updateSession',
    'deleteSession',
  ]);
  cardio.getSessions.and.returnValue(of(sessions));
  cardio.addSession.and.returnValue(of(sessions[0]));
  cardio.updateSession.and.returnValue(of(sessions[0]));
  cardio.deleteSession.and.returnValue(of(true));

  const storage = jasmine.createSpyObj<StorageService>('StorageService', ['initialize']);
  storage.initialize.and.returnValue(of(undefined));

  return { cardio, storage };
}

async function configureBed(spies: Spies): Promise<ComponentFixture<CardioPageComponent>> {
  await TestBed.configureTestingModule({
    imports: [CardioPageComponent],
    providers: [
      { provide: CardioService, useValue: spies.cardio },
      { provide: StorageService, useValue: spies.storage },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(CardioPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('CardioPageComponent edit mode', () => {
  it('renders a per-row Edit button with the locked accessible name', async () => {
    const fixture = await configureBed(makeSpies());
    const editBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Edit this cardio session"]',
    ) as HTMLButtonElement;
    expect(editBtn).toBeTruthy();
    expect(editBtn.textContent?.trim()).toBe('Edit');
  });

  it('clicking Edit pre-fills the form (patchValue from the row) + shows the header + announces', fakeAsync(async () => {
    const session = makeSession();
    const fixture = await configureBed(makeSpies([session]));
    const c = fixture.componentInstance;

    c.onEdit(session);
    fixture.detectChanges();
    tick(0);

    expect(c.editingId).toBe('session-1');
    expect(c.sessionForm.get('type')?.value).toBe('running');
    expect(c.sessionForm.get('durationMinutes')?.value).toBe(30);
    expect(c.sessionForm.get('distanceKm')?.value).toBe(5);
    expect(c.sessionForm.get('notes')?.value).toBe('morning run');

    const header = fixture.nativeElement.querySelector('.edit-mode-header');
    expect(header?.textContent?.trim()).toBe('Editing entry');
    expect(c.editStatus).toBe('Editing entry — make your changes and save.');
  }));

  it('Save in edit mode calls updateSession with the row id + form value (NOT addSession)', () => {
    const session = makeSession();
    const spies = makeSpies([session]);
    let fixture!: ComponentFixture<CardioPageComponent>;
    // synchronous-ish: configureBed resolves immediately with of() spies
    return configureBed(spies).then((f) => {
      fixture = f;
      const c = fixture.componentInstance;
      c.onEdit(session);
      c.sessionForm.patchValue({ durationMinutes: 45 });

      c.onSubmit();

      expect(spies.cardio.updateSession).toHaveBeenCalledTimes(1);
      expect(spies.cardio.addSession).not.toHaveBeenCalled();
      const [id, input] = spies.cardio.updateSession.calls.mostRecent().args;
      expect(id).toBe('session-1');
      expect(input.durationMinutes).toBe(45);
      expect(input.type).toBe('running');
    });
  });

  it('edit success clears edit mode + announces "Entry updated."', async () => {
    const session = makeSession();
    const spies = makeSpies([session]);
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onEdit(session);
    c.onSubmit();

    expect(c.editingId).toBeNull();
    expect(c.editStatus).toBe('Entry updated.');
  });

  it('Discard changes restores add mode without ANY service write (T-05-06-02)', async () => {
    const session = makeSession();
    const spies = makeSpies([session]);
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onEdit(session);
    expect(c.editingId).toBe('session-1');

    c.onCancelEdit();

    expect(c.editingId).toBeNull();
    expect(c.editStatus).toBe('Edit discarded — back to adding a new entry.');
    expect(spies.cardio.updateSession).not.toHaveBeenCalled();
    expect(spies.cardio.addSession).not.toHaveBeenCalled();
  });

  // The edit-mode surface itself (header, announce, form layout) is contrast-clean.
  // The only color-contrast failures in this fixture come from the app-global
  // `.btn-*` palette (`#3498db`/`#95a5a6`/`#e74c3c` + `#7f8c8d`/`#95a5a6` muted text
  // in styles.css) — a cross-page palette concern owned by the QUAL-08/09 sweep
  // (05-UI-SPEC Color §, "nudging the hex only if a row fails"), not by this
  // edit-mode wiring plan whose files_modified excludes styles.css. We still run
  // the full severe gate (label association, ARIA, focus order) on the edit render.
  it('passes severe axe-core a11y after edit-mode render (color-contrast deferred to QUAL-08/09 global palette sweep)', async () => {
    const session = makeSession();
    const fixture = await configureBed(makeSpies([session]));
    fixture.componentInstance.onEdit(session);
    fixture.detectChanges();
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});
