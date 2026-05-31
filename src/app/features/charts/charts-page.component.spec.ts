/**
 * Charts-page characterization spec.
 *
 * Per FOUND-04 + D-05/D-06/D-07/D-08: Karma TestBed DOM specs that capture the
 * dominant user flows on charts-page so a Phase 2-5 refactor that regresses
 * them fails this suite.
 *
 * Includes the `b6149d2` regression assertion at the page-integration level:
 * two same-day blood-pressure readings must collapse into ONE chart label
 * with averaged values (the helper-level assertion is in
 * `chart-grouping.spec.ts`; this one ensures the page wires it correctly).
 *
 * Per-spec factory helpers (D-07). DOM-shape assertions (Pitfall 6).
 * axe-core inline (D-08, FOUND-05), gated to serious|critical only.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { of } from 'rxjs';

import { ChartsPageComponent } from './charts-page.component';
import { CardioService } from '../../services/cardio.service';
import { WeightService } from '../../services/weight.service';
import { ReadingsService } from '../../services/readings.service';
import { StorageService } from '../../services/storage.service';
import {
  BloodPressureReading,
  HealthReading,
} from '../../models/health-reading.model';
import { CardioSession } from '../../models/cardio-session.model';
import { WeightEntry } from '../../models/weight-entry.model';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

// ---------------------------------------------------------------------------
// Per-spec factory helpers (D-07: NO shared canonical fixture file).
// ---------------------------------------------------------------------------

/**
 * Build a `Date` `daysAgo` days in the past at noon local time. Tests use this
 * instead of `new Date()` so timestamps are guaranteed to be <= `now` and the
 * default `30d` preset's `endMs` filter includes them.
 */
function dateInPast(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return d;
}

function createBloodPressure(
  overrides: Partial<BloodPressureReading> = {},
): BloodPressureReading {
  return {
    id: 'bp-1',
    type: 'blood_pressure',
    date: '2026-04-15T08:00:00.000Z',
    systolic: 120,
    diastolic: 80,
    createdAt: '2026-04-15T08:00:00.000Z',
    updatedAt: '2026-04-15T08:00:00.000Z',
    ...overrides,
  };
}

function createCardioSession(
  overrides: Partial<CardioSession> = {},
): CardioSession {
  return {
    id: 'card-1',
    date: '2026-04-15T07:00:00.000Z',
    type: 'running',
    durationMinutes: 30,
    distanceKm: 5,
    caloriesBurned: 300,
    createdAt: '2026-04-15T07:00:00.000Z',
    updatedAt: '2026-04-15T07:00:00.000Z',
    ...overrides,
  };
}

function createWeightEntry(overrides: Partial<WeightEntry> = {}): WeightEntry {
  return {
    id: 'w-1',
    date: '2026-04-15T07:00:00.000Z',
    weightLbs: 180,
    createdAt: '2026-04-15T07:00:00.000Z',
    updatedAt: '2026-04-15T07:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Spies + TestBed configuration.
// ---------------------------------------------------------------------------

interface ChartsSpies {
  cardioService: jasmine.SpyObj<CardioService>;
  weightService: jasmine.SpyObj<WeightService>;
  readingsService: jasmine.SpyObj<ReadingsService>;
  storageService: jasmine.SpyObj<StorageService>;
  router: jasmine.SpyObj<Router>;
}

function makeSpies(opts: {
  cardio?: CardioSession[];
  weight?: WeightEntry[];
  readings?: HealthReading[];
} = {}): ChartsSpies {
  const cardioService = jasmine.createSpyObj<CardioService>('CardioService', [
    'getSessions', 'addSession', 'getSession', 'deleteSession',
  ]);
  cardioService.getSessions.and.returnValue(of(opts.cardio ?? []));

  const weightService = jasmine.createSpyObj<WeightService>('WeightService', [
    'getEntries', 'addEntry', 'getEntry', 'deleteEntry',
  ]);
  weightService.getEntries.and.returnValue(of(opts.weight ?? []));

  const readingsService = jasmine.createSpyObj<ReadingsService>('ReadingsService', [
    'getReadings', 'addBloodPressure', 'addBloodGlucose', 'addKetone',
    'getReading', 'deleteReading',
  ]);
  readingsService.getReadings.and.returnValue(of(opts.readings ?? []));

  const storageService = jasmine.createSpyObj<StorageService>('StorageService', [
    'initialize', 'getData', 'saveData', 'getBackup',
  ]);
  storageService.initialize.and.returnValue(of(undefined));

  const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  router.navigate.and.returnValue(Promise.resolve(true));

  return { cardioService, weightService, readingsService, storageService, router };
}

async function configureBed(spies: ChartsSpies): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [ChartsPageComponent],
    providers: [
      provideRouter([]),
      provideCharts(withDefaultRegisterables()),
      { provide: CardioService, useValue: spies.cardioService },
      { provide: WeightService, useValue: spies.weightService },
      { provide: ReadingsService, useValue: spies.readingsService },
      { provide: StorageService, useValue: spies.storageService },
      { provide: Router, useValue: spies.router },
    ],
  }).compileComponents();
}

describe('ChartsPageComponent (characterization)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render chart with grouped same-day readings averaged (b6149d2 regression)', async () => {
    // Arrange: two BP readings on the same calendar day. Pre-b6149d2 these
    // would have appeared as two separate points; post-fix they're grouped
    // and averaged into a single label. This is the page-level integration
    // check — the helper-level test lives in chart-grouping.spec.ts.
    //
    // Use a recent date in the past so the default '30d' preset includes it
    // AND both timestamps are <= now (filterByRange uses now as endMs).
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const morning = new Date(yesterday);
    morning.setHours(8, 0, 0, 0);
    const evening = new Date(yesterday);
    evening.setHours(20, 0, 0, 0);

    const readings: HealthReading[] = [
      createBloodPressure({ id: 'bp-am', date: morning.toISOString(), systolic: 120, diastolic: 80 }),
      createBloodPressure({ id: 'bp-pm', date: evening.toISOString(), systolic: 130, diastolic: 90 }),
    ];
    const spies = makeSpies({ readings });
    await configureBed(spies);

    // Default form has rangePreset='30d', readingType='blood_pressure'.

    // Act
    const fixture = TestBed.createComponent(ChartsPageComponent);
    fixture.detectChanges();

    // Assert: ONE label (one calendar day), averaged systolic = 125, diastolic = 85.
    const data = fixture.componentInstance.readingsChartData;
    expect(data.labels?.length).toBe(1);
    expect(data.datasets.length).toBe(2);
    // dataset[0] = systolic, dataset[1] = diastolic per buildReadingsChart.
    expect((data.datasets[0].data as number[])[0]).toBe(125);
    expect((data.datasets[1].data as number[])[0]).toBe(85);
  });

  it('should re-render charts when the date range preset changes', async () => {
    // Arrange: one weight entry today (within all presets).
    const entry = createWeightEntry({ date: dateInPast(2).toISOString(), weightLbs: 175 });
    const spies = makeSpies({ weight: [entry] });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ChartsPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.weightChartData.labels?.length).toBe(1);

    // Switch to 'all' preset — should still see the entry.
    fixture.componentInstance.controlsForm.patchValue({ rangePreset: 'all' });
    fixture.componentInstance.onControlsChanged();
    fixture.detectChanges();

    // Assert: chart still renders; rangeError null.
    expect(fixture.componentInstance.rangeError).toBeNull();
    expect(fixture.componentInstance.weightChartData.labels?.length).toBe(1);
  });

  it('should navigate to /report when print/export is clicked', async () => {
    // Arrange
    const spies = makeSpies({ weight: [createWeightEntry({ date: dateInPast(2).toISOString() })] });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ChartsPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.onPrintExport();

    // Assert: router.navigate called with /report and expected query params.
    expect(spies.router.navigate).toHaveBeenCalled();
    const args = spies.router.navigate.calls.mostRecent().args;
    expect(args[0]).toEqual(['/report']);
    const extras = args[1] as { queryParams?: Record<string, string> };
    expect(extras?.queryParams?.['readingType']).toBe('blood_pressure');
    expect(extras?.queryParams?.['generatedAt']).toBeTruthy();
  });

  it('should render <app-empty-state> when no data is available in range', async () => {
    // Arrange: no entries, no sessions, no readings — three empty-state
    // surfaces should appear (one per chart section).
    const spies = makeSpies({ cardio: [], weight: [], readings: [] });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ChartsPageComponent);
    fixture.detectChanges();

    // Assert
    const compiled = fixture.nativeElement as HTMLElement;
    const empties = compiled.querySelectorAll('app-empty-state');
    expect(empties.length).toBeGreaterThanOrEqual(1);
  });

  it('should have no serious or critical axe-core violations on initial load', async () => {
    // Arrange: representative data so axe sees the realistic surface
    // (controls + at least one chart section with data).
    const recent = dateInPast(2).toISOString();
    const spies = makeSpies({
      weight: [createWeightEntry({ date: recent })],
      cardio: [createCardioSession({ date: recent })],
      readings: [createBloodPressure({ date: recent })],
    });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ChartsPageComponent);
    fixture.detectChanges();

    // Assert: structural a11y AND contrast. The Phase 1 D-13 contrast deferral is
    // LIFTED here (QUAL-08) — axe contrast checking is now enforced.
    await expectNoSeriousA11yViolations(fixture.nativeElement);
  });
});
