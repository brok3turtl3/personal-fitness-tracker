/**
 * Readings page edit-mode spec — Plan 05-06 Task 2 (QUAL-03, D-11/D-12, T-05-06-04).
 *
 * The readings form is type-aware, so Save in edit mode must dispatch to the
 * matching 05-03 update method by the row's discriminant:
 *   - BP edit   → updateBloodPressure(id, input)
 *   - glucose   → updateBloodGlucose(id, input)
 *   - ketone    → updateKetone(id, input)
 * A BP edit must never call the glucose/ketone update (and vice-versa).
 *
 * Also verifies: Edit pre-fills the right-typed form + "Editing entry" header +
 * announce; Discard restores add mode with NO service write; severe a11y clean.
 */
import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { ReadingsPageComponent } from './readings-page.component';
import { ReadingsService } from '../../services/readings.service';
import { StorageService } from '../../services/storage.service';
import {
  BloodPressureReading,
  BloodGlucoseReading,
  KetoneReading,
  HealthReading,
} from '../../models/health-reading.model';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

const BP: BloodPressureReading = {
  id: 'bp-1',
  type: 'blood_pressure',
  date: '2026-05-20T07:30:00.000Z',
  systolic: 120,
  diastolic: 80,
  notes: 'resting',
  createdAt: '2026-05-20T07:30:00.000Z',
  updatedAt: '2026-05-20T07:30:00.000Z',
};
const GLU: BloodGlucoseReading = {
  id: 'glu-1',
  type: 'blood_glucose',
  date: '2026-05-20T08:00:00.000Z',
  glucoseMmol: 5.4,
  createdAt: '2026-05-20T08:00:00.000Z',
  updatedAt: '2026-05-20T08:00:00.000Z',
};
const KET: KetoneReading = {
  id: 'ket-1',
  type: 'ketone',
  date: '2026-05-20T08:30:00.000Z',
  ketoneMmol: 1.2,
  createdAt: '2026-05-20T08:30:00.000Z',
  updatedAt: '2026-05-20T08:30:00.000Z',
};

interface Spies {
  readings: jasmine.SpyObj<ReadingsService>;
  storage: jasmine.SpyObj<StorageService>;
}

function makeSpies(readings: HealthReading[] = [BP, GLU, KET]): Spies {
  const r = jasmine.createSpyObj<ReadingsService>('ReadingsService', [
    'getReadings',
    'addBloodPressure',
    'addBloodGlucose',
    'addKetone',
    'updateBloodPressure',
    'updateBloodGlucose',
    'updateKetone',
    'deleteReading',
  ]);
  r.getReadings.and.returnValue(of(readings));
  r.addBloodPressure.and.returnValue(of(BP));
  r.addBloodGlucose.and.returnValue(of(GLU));
  r.addKetone.and.returnValue(of(KET));
  r.updateBloodPressure.and.returnValue(of(BP));
  r.updateBloodGlucose.and.returnValue(of(GLU));
  r.updateKetone.and.returnValue(of(KET));
  r.deleteReading.and.returnValue(of(true));

  const storage = jasmine.createSpyObj<StorageService>('StorageService', ['initialize']);
  storage.initialize.and.returnValue(of(undefined));

  return { readings: r, storage };
}

async function configureBed(spies: Spies): Promise<ComponentFixture<ReadingsPageComponent>> {
  await TestBed.configureTestingModule({
    imports: [ReadingsPageComponent],
    providers: [
      { provide: ReadingsService, useValue: spies.readings },
      { provide: StorageService, useValue: spies.storage },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ReadingsPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ReadingsPageComponent edit mode', () => {
  it('renders a per-row Edit button with a type-specific accessible name', async () => {
    const fixture = await configureBed(makeSpies([BP]));
    const editBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Edit this blood pressure reading"]',
    ) as HTMLButtonElement;
    expect(editBtn).toBeTruthy();
    expect(editBtn.textContent?.trim()).toBe('Edit');
  });

  it('clicking Edit pre-fills the BP-typed form + shows header + announces', fakeAsync(async () => {
    const fixture = await configureBed(makeSpies([BP]));
    const c = fixture.componentInstance;

    c.onEdit(BP);
    fixture.detectChanges();
    tick(0);

    expect(c.editingId).toBe('bp-1');
    expect(c.editingType).toBe('blood_pressure');
    expect(c.selectedType).toBe('blood_pressure');
    expect(c.readingForm.get('systolic')?.value).toBe(120);
    expect(c.readingForm.get('diastolic')?.value).toBe(80);
    expect(c.readingForm.get('notes')?.value).toBe('resting');

    const header = fixture.nativeElement.querySelector('.edit-mode-header');
    expect(header?.textContent?.trim()).toBe('Editing entry');
    expect(c.editStatus).toBe('Editing entry — make your changes and save.');
  }));

  it('Save dispatches to updateBloodPressure for a BP row (and nothing else)', async () => {
    const spies = makeSpies([BP]);
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onEdit(BP);
    c.readingForm.patchValue({ systolic: 125 });
    c.onSubmit();

    expect(spies.readings.updateBloodPressure).toHaveBeenCalledTimes(1);
    const [id, input] = spies.readings.updateBloodPressure.calls.mostRecent().args;
    expect(id).toBe('bp-1');
    expect(input.systolic).toBe(125);
    expect(input.diastolic).toBe(80);
    expect(spies.readings.updateBloodGlucose).not.toHaveBeenCalled();
    expect(spies.readings.updateKetone).not.toHaveBeenCalled();
    expect(spies.readings.addBloodPressure).not.toHaveBeenCalled();
  });

  it('Save dispatches to updateBloodGlucose for a glucose row (and nothing else)', async () => {
    const spies = makeSpies([GLU]);
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onEdit(GLU);
    c.readingForm.patchValue({ glucoseMmol: 6.1 });
    c.onSubmit();

    expect(spies.readings.updateBloodGlucose).toHaveBeenCalledTimes(1);
    const [id, input] = spies.readings.updateBloodGlucose.calls.mostRecent().args;
    expect(id).toBe('glu-1');
    expect(input.glucoseMmol).toBe(6.1);
    expect(spies.readings.updateBloodPressure).not.toHaveBeenCalled();
    expect(spies.readings.updateKetone).not.toHaveBeenCalled();
  });

  it('Save dispatches to updateKetone for a ketone row (and nothing else)', async () => {
    const spies = makeSpies([KET]);
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onEdit(KET);
    c.readingForm.patchValue({ ketoneMmol: 2.0 });
    c.onSubmit();

    expect(spies.readings.updateKetone).toHaveBeenCalledTimes(1);
    const [id, input] = spies.readings.updateKetone.calls.mostRecent().args;
    expect(id).toBe('ket-1');
    expect(input.ketoneMmol).toBe(2.0);
    expect(spies.readings.updateBloodPressure).not.toHaveBeenCalled();
    expect(spies.readings.updateBloodGlucose).not.toHaveBeenCalled();
  });

  it('edit success clears edit mode + announces "Entry updated."', async () => {
    const spies = makeSpies([BP]);
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onEdit(BP);
    c.onSubmit();

    expect(c.editingId).toBeNull();
    expect(c.editingType).toBeNull();
    expect(c.editStatus).toBe('Entry updated.');
  });

  it('Discard changes restores add mode without ANY service write (T-05-06-02)', async () => {
    const spies = makeSpies([BP]);
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.onEdit(BP);
    expect(c.editingId).toBe('bp-1');

    c.onCancelEdit();

    expect(c.editingId).toBeNull();
    expect(c.editingType).toBeNull();
    expect(c.selectedType).toBe('');
    expect(c.editStatus).toBe('Edit discarded — back to adding a new entry.');
    expect(spies.readings.updateBloodPressure).not.toHaveBeenCalled();
    expect(spies.readings.updateBloodGlucose).not.toHaveBeenCalled();
    expect(spies.readings.updateKetone).not.toHaveBeenCalled();
    expect(spies.readings.addBloodPressure).not.toHaveBeenCalled();
  });

  // Only the app-global `.btn-*`/muted palette fails color-contrast (cross-page
  // QUAL-08/09 sweep owns it — see deferred-items.md); the edit-mode surface is clean.
  it('passes severe axe-core a11y after edit-mode render (color-contrast deferred to QUAL-08/09 global palette sweep)', async () => {
    const fixture = await configureBed(makeSpies([BP]));
    fixture.componentInstance.onEdit(BP);
    fixture.detectChanges();
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});
