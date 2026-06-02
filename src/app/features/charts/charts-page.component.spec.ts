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
import { DietService } from '../../services/diet.service';
import {
  BloodPressureReading,
  HealthReading,
} from '../../models/health-reading.model';
import { CardioSession } from '../../models/cardio-session.model';
import { WeightEntry } from '../../models/weight-entry.model';
import { MealEntry, NutritionTotals } from '../../models/diet.model';
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

function createTotals(overrides: Partial<NutritionTotals> = {}): NutritionTotals {
  return {
    caloriesKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
    netCarbsG: 0,
    ...overrides,
  };
}

/**
 * Build a minimal MealEntry whose `totals` carry the macro values under test.
 * The diet chart only reads `dateTime` + `totals.*`, so `items` stays empty.
 */
function createMeal(
  id: string,
  dateTime: string,
  totals: Partial<NutritionTotals>,
): MealEntry {
  return {
    id,
    dateTime,
    items: [],
    totals: createTotals(totals),
    createdAt: dateTime,
    updatedAt: dateTime,
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
  dietService: jasmine.SpyObj<DietService>;
  router: jasmine.SpyObj<Router>;
}

function makeSpies(opts: {
  cardio?: CardioSession[];
  weight?: WeightEntry[];
  readings?: HealthReading[];
  meals?: MealEntry[];
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

  const dietService = jasmine.createSpyObj<DietService>('DietService', [
    'getMealsInRange',
  ]);
  // The component fetches the full open range once (0, Date.now()) and
  // re-applies the date-range via filterByRange on each rebuild.
  dietService.getMealsInRange.and.returnValue(of(opts.meals ?? []));

  const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  router.navigate.and.returnValue(Promise.resolve(true));

  return { cardioService, weightService, readingsService, storageService, dietService, router };
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
      { provide: DietService, useValue: spies.dietService },
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

  // -------------------------------------------------------------------------
  // Diet series (02-05): calories + toggleable macros, SUM-per-local-day.
  // -------------------------------------------------------------------------

  it('should SUM (not average) two meals on the same local day for calories (DIET-08)', async () => {
    // Arrange: two meals on the SAME local calendar day, within the 30d window.
    const day = dateInPast(2);
    const morning = new Date(day);
    morning.setHours(8, 0, 0, 0);
    const evening = new Date(day);
    evening.setHours(19, 0, 0, 0);

    const meals: MealEntry[] = [
      createMeal('m-am', morning.toISOString(), { caloriesKcal: 400, proteinG: 30 }),
      createMeal('m-pm', evening.toISOString(), { caloriesKcal: 600, proteinG: 20 }),
    ];
    const spies = makeSpies({ meals });
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChartsPageComponent);
    fixture.detectChanges();

    // Enable the calories series (default off, mirroring cardio).
    fixture.componentInstance.controlsForm.patchValue({ dietShowCalories: true });
    fixture.componentInstance.onControlsChanged();
    fixture.detectChanges();

    const data = fixture.componentInstance.dietChartData;
    // ONE label (one local day), calories = SUM (1000), not the average (500).
    expect(data.labels?.length).toBe(1);
    const caloriesSet = data.datasets.find(d => d.label === 'Calories (kcal)');
    expect(caloriesSet).toBeTruthy();
    expect((caloriesSet!.data as number[])[0]).toBe(1000);
  });

  it('should add/remove the protein dataset as dietShowProtein toggles', async () => {
    const meals: MealEntry[] = [
      createMeal('m-1', dateInPast(2).toISOString(), { caloriesKcal: 500, proteinG: 40 }),
    ];
    const spies = makeSpies({ meals });
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChartsPageComponent);
    fixture.detectChanges();

    // Off by default → no protein dataset.
    expect(
      fixture.componentInstance.dietChartData.datasets.some(d => d.label === 'Protein (g)'),
    ).toBeFalse();

    // Toggle on → protein dataset present with the summed value.
    fixture.componentInstance.controlsForm.patchValue({ dietShowProtein: true });
    fixture.componentInstance.onControlsChanged();
    fixture.detectChanges();
    const proteinSet = fixture.componentInstance.dietChartData.datasets.find(
      d => d.label === 'Protein (g)',
    );
    expect(proteinSet).toBeTruthy();
    expect((proteinSet!.data as number[])[0]).toBe(40);

    // Toggle off → protein dataset removed.
    fixture.componentInstance.controlsForm.patchValue({ dietShowProtein: false });
    fixture.componentInstance.onControlsChanged();
    fixture.detectChanges();
    expect(
      fixture.componentInstance.dietChartData.datasets.some(d => d.label === 'Protein (g)'),
    ).toBeFalse();
  });

  it('should bucket a 23:30-local meal on a spring-forward date to the correct local day (DIET-08, D-11)', async () => {
    // 2026-03-08 is US spring-forward. A 23:30 LOCAL meal must key to 2026-03-08
    // (local day), not roll to 03-09 via a UTC-based bucketer. Build the ISO from
    // local components so the assertion is timezone-agnostic for the runner.
    const local = new Date(2026, 2, 8, 23, 30, 0, 0); // month 2 = March
    const meals: MealEntry[] = [
      createMeal('m-dst', local.toISOString(), { caloriesKcal: 700 }),
    ];
    const spies = makeSpies({ meals });
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChartsPageComponent);
    fixture.detectChanges();

    // Use the 'all' preset so the 2026-03-08 meal is in range regardless of "today".
    fixture.componentInstance.controlsForm.patchValue({
      rangePreset: 'all',
      dietShowCalories: true,
    });
    fixture.componentInstance.onControlsChanged();
    fixture.detectChanges();

    const data = fixture.componentInstance.dietChartData;
    expect(data.labels?.length).toBe(1);
    // The formatted short-date label is derived from the local-day key 2026-03-08.
    const expectedLabel = new Date(2026, 2, 8).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
    expect((data.labels as string[])[0]).toBe(expectedLabel);
  });

  it('should show the diet empty-state when no meals fall in range', async () => {
    const spies = makeSpies({ meals: [] });
    await configureBed(spies);

    const fixture = TestBed.createComponent(ChartsPageComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const dietSection = compiled.querySelector('section[aria-label="Diet chart"]');
    expect(dietSection).toBeTruthy();
    expect(dietSection!.querySelector('app-empty-state')).toBeTruthy();
  });
});
