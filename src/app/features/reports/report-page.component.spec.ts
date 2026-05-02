/**
 * Report-page characterization spec.
 *
 * Per FOUND-04 + D-05/D-06/D-07/D-08: Karma TestBed DOM specs that capture the
 * dominant user flows on report-page so a Phase 2-5 refactor that regresses
 * them fails this suite. Per-spec factory helpers (D-07). DOM-shape assertions
 * (Pitfall 6 — not full textContent). axe-core inline (D-08, FOUND-05),
 * gated to serious|critical only.
 */
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { of, throwError } from 'rxjs';

import { ReportPageComponent } from './report-page.component';
import { CardioService } from '../../services/cardio.service';
import { WeightService } from '../../services/weight.service';
import { ReadingsService } from '../../services/readings.service';
import { StorageService, StorageError } from '../../services/storage.service';
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
    date: dateInPast(2).toISOString(),
    systolic: 120,
    diastolic: 80,
    createdAt: dateInPast(2).toISOString(),
    updatedAt: dateInPast(2).toISOString(),
    ...overrides,
  };
}

function createCardioSession(
  overrides: Partial<CardioSession> = {},
): CardioSession {
  return {
    id: 'card-1',
    date: dateInPast(2).toISOString(),
    type: 'running',
    durationMinutes: 30,
    distanceKm: 5,
    caloriesBurned: 300,
    createdAt: dateInPast(2).toISOString(),
    updatedAt: dateInPast(2).toISOString(),
    ...overrides,
  };
}

function createWeightEntry(overrides: Partial<WeightEntry> = {}): WeightEntry {
  return {
    id: 'w-1',
    date: dateInPast(2).toISOString(),
    weightLbs: 180,
    createdAt: dateInPast(2).toISOString(),
    updatedAt: dateInPast(2).toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Spies + TestBed configuration.
// ---------------------------------------------------------------------------

interface ReportSpies {
  cardioService: jasmine.SpyObj<CardioService>;
  weightService: jasmine.SpyObj<WeightService>;
  readingsService: jasmine.SpyObj<ReadingsService>;
  storageService: jasmine.SpyObj<StorageService>;
}

function makeSpies(opts: {
  cardio?: CardioSession[];
  weight?: WeightEntry[];
  readings?: HealthReading[];
  initializeError?: Error;
} = {}): ReportSpies {
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
  if (opts.initializeError) {
    storageService.initialize.and.returnValue(throwError(() => opts.initializeError));
  } else {
    storageService.initialize.and.returnValue(of(undefined));
  }

  return { cardioService, weightService, readingsService, storageService };
}

async function configureBed(
  spies: ReportSpies,
  queryParams: Record<string, string> = {},
): Promise<void> {
  const route = {
    queryParamMap: of(convertToParamMap(queryParams)),
  };

  await TestBed.configureTestingModule({
    imports: [ReportPageComponent],
    providers: [
      provideRouter([]),
      provideCharts(withDefaultRegisterables()),
      { provide: ActivatedRoute, useValue: route },
      { provide: CardioService, useValue: spies.cardioService },
      { provide: WeightService, useValue: spies.weightService },
      { provide: ReadingsService, useValue: spies.readingsService },
      { provide: StorageService, useValue: spies.storageService },
    ],
  }).compileComponents();
}

describe('ReportPageComponent (characterization)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render report summaries from the store within the date range', async () => {
    // Arrange: 2 weight entries, 1 cardio session, 1 BP reading, all within range.
    const weight = [
      createWeightEntry({ id: 'w-a', weightLbs: 175 }),
      createWeightEntry({ id: 'w-b', weightLbs: 180 }),
    ];
    const cardio = [createCardioSession({ id: 'c-a', durationMinutes: 45 })];
    const readings = [createBloodPressure({ id: 'r-a' })];
    const spies = makeSpies({ weight, cardio, readings });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ReportPageComponent);
    fixture.detectChanges();

    // Assert: summaries reflect the data.
    expect(fixture.componentInstance.weightSummary.count).toBe(2);
    expect(fixture.componentInstance.cardioSummary.count).toBe(1);
    expect(fixture.componentInstance.cardioSummary.totalDurationMin).toBe(45);
    expect(fixture.componentInstance.readingsSummary.totalCount).toBe(1);

    // DOM shape: 3 summary cards exist.
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.summary-card');
    expect(cards.length).toBe(3);
  });

  it('should render <app-empty-state> when no entries fall in range', async () => {
    // Arrange: no data at all.
    const spies = makeSpies({ cardio: [], weight: [], readings: [] });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ReportPageComponent);
    fixture.detectChanges();

    // Assert: at least one empty-state surface visible (one per chart section).
    const compiled = fixture.nativeElement as HTMLElement;
    const empties = compiled.querySelectorAll('app-empty-state');
    expect(empties.length).toBeGreaterThanOrEqual(1);

    // And summaries are zero.
    expect(fixture.componentInstance.weightSummary.count).toBe(0);
    expect(fixture.componentInstance.cardioSummary.count).toBe(0);
    expect(fixture.componentInstance.readingsSummary.totalCount).toBe(0);
  });

  it('should render <app-error-state> when StorageService.initialize fails', async () => {
    // Arrange: storage init throws.
    const spies = makeSpies({
      initializeError: new StorageError('boom', 'PARSE_ERROR'),
    });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ReportPageComponent);
    fixture.detectChanges();

    // Assert: error-state surface visible AND loadError populated.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-error-state')).toBeTruthy();
    expect(fixture.componentInstance.loadError).toBeTruthy();
  });

  it('should have no serious or critical axe-core violations on initial load', async () => {
    // Arrange: representative happy path.
    const spies = makeSpies({
      weight: [createWeightEntry()],
      cardio: [createCardioSession()],
      readings: [createBloodPressure()],
    });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(ReportPageComponent);
    fixture.detectChanges();

    // Assert: structural a11y. `color-contrast` deferred to Phase 5 QUAL-08
    // per CONTEXT.md D-13. See a11y-test-helpers.ts header.
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});
