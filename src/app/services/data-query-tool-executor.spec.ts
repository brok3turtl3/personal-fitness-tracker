import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DataQueryToolExecutor } from './data-query-tool-executor';
import { WeightService } from './weight.service';
import { CardioService } from './cardio.service';
import { ReadingsService } from './readings.service';
import { DietService } from './diet.service';
import { WeightEntry } from '../models/weight-entry.model';
import { CardioSession } from '../models/cardio-session.model';
import { HealthReading, HealthReadingType } from '../models/health-reading.model';
import { MealEntry, NutritionTotals, SavedFood } from '../models/diet.model';

/** Helper: zeroed nutrition totals with a configurable calorie value. */
function totals(kcal: number): NutritionTotals {
  return {
    caloriesKcal: kcal,
    proteinG: kcal / 10,
    fatG: 1,
    carbsG: 2,
    fiberG: 0.5,
    sugarG: 1,
    sodiumMg: 10,
    netCarbsG: 1.5,
  };
}

function makeWeight(date: string, lbs: number): WeightEntry {
  return {
    id: `w-${date}-${lbs}`,
    date,
    weightLbs: lbs,
    createdAt: date,
    updatedAt: date,
  };
}

function makeCardio(date: string, minutes: number): CardioSession {
  return {
    id: `c-${date}`,
    date,
    type: 'running',
    durationMinutes: minutes,
    distanceKm: 5,
    createdAt: date,
    updatedAt: date,
  };
}

function makeMeal(dateTime: string, kcal: number): MealEntry {
  return {
    id: `m-${dateTime}`,
    dateTime,
    mealType: 'lunch',
    items: [],
    totals: totals(kcal),
    createdAt: dateTime,
    updatedAt: dateTime,
  };
}

describe('DataQueryToolExecutor', () => {
  let executor: DataQueryToolExecutor;
  let weightSpy: jasmine.SpyObj<WeightService>;
  let cardioSpy: jasmine.SpyObj<CardioService>;
  let readingsSpy: jasmine.SpyObj<ReadingsService>;
  let dietSpy: jasmine.SpyObj<DietService>;

  beforeEach(() => {
    weightSpy = jasmine.createSpyObj('WeightService', ['getEntries']);
    cardioSpy = jasmine.createSpyObj('CardioService', ['getSessions']);
    readingsSpy = jasmine.createSpyObj('ReadingsService', ['getReadings']);
    dietSpy = jasmine.createSpyObj('DietService', [
      'getMealsForDay',
      'getSavedFoods',
      'computeDailyTotals',
    ]);

    weightSpy.getEntries.and.returnValue(of([]));
    cardioSpy.getSessions.and.returnValue(of([]));
    readingsSpy.getReadings.and.returnValue(of([]));
    dietSpy.getMealsForDay.and.returnValue(of([]));
    dietSpy.getSavedFoods.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        DataQueryToolExecutor,
        { provide: WeightService, useValue: weightSpy },
        { provide: CardioService, useValue: cardioSpy },
        { provide: ReadingsService, useValue: readingsSpy },
        { provide: DietService, useValue: dietSpy },
      ],
    });

    executor = TestBed.inject(DataQueryToolExecutor);
  });

  /** Dispatch a tool by name via the executor's per-name adapters. */
  function dispatch(name: string, input: unknown): Promise<string> {
    const adapter = executor.executors.find((e) => e.definition.name === name);
    if (!adapter) {
      return Promise.reject(new Error(`no adapter for ${name}`));
    }
    return Promise.resolve(adapter.execute(input));
  }

  describe('surface', () => {
    it('exposes exactly six query_* executors', () => {
      const names = executor.executors.map((e) => e.definition.name).sort();
      expect(names).toEqual(
        [
          'query_cardio_sessions',
          'query_daily_totals',
          'query_meals_in_range',
          'query_readings',
          'query_saved_foods',
          'query_weight_entries',
        ].sort()
      );
    });

    it('every definition declares type:"custom", a description and strict:true', () => {
      for (const ex of executor.executors) {
        expect(ex.definition.type).toBe('custom');
        expect(typeof ex.definition.description).toBe('string');
        expect(ex.definition.description!.length).toBeGreaterThan(0);
        expect(ex.definition.strict).toBeTrue();
        expect(ex.definition.input_schema).toBeDefined();
      }
    });
  });

  describe('each tool returns a non-empty summary string', () => {
    it('query_weight_entries', async () => {
      weightSpy.getEntries.and.returnValue(
        of([makeWeight('2026-01-01', 200), makeWeight('2026-01-02', 199)])
      );
      const out = await dispatch('query_weight_entries', {});
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
      expect(out).toContain('200');
    });

    it('query_cardio_sessions', async () => {
      cardioSpy.getSessions.and.returnValue(of([makeCardio('2026-01-01', 30)]));
      const out = await dispatch('query_cardio_sessions', {});
      expect(out.length).toBeGreaterThan(0);
      expect(out).toContain('running');
    });

    it('query_readings', async () => {
      const bp: HealthReading = {
        id: 'r1',
        type: 'blood_pressure',
        date: '2026-01-01',
        systolic: 120,
        diastolic: 80,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };
      readingsSpy.getReadings.and.returnValue(of([bp]));
      const out = await dispatch('query_readings', {});
      expect(out.length).toBeGreaterThan(0);
      expect(out).toContain('120');
    });

    it('query_saved_foods', async () => {
      const food: SavedFood = {
        id: 'f1',
        name: 'Chicken Breast',
        baseUnit: 'g',
        nutrientsPerUnit: totals(2),
        servings: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };
      dietSpy.getSavedFoods.and.returnValue(of([food]));
      const out = await dispatch('query_saved_foods', {});
      expect(out.length).toBeGreaterThan(0);
      expect(out).toContain('Chicken Breast');
    });

    it('query_meals_in_range', async () => {
      dietSpy.getMealsForDay.and.callFake((day: string) =>
        day === '2026-01-01' ? of([makeMeal('2026-01-01T12:00:00', 500)]) : of([])
      );
      const out = await dispatch('query_meals_in_range', {
        from: '2026-01-01',
        to: '2026-01-01',
      });
      expect(out.length).toBeGreaterThan(0);
      expect(out).toContain('500');
    });

    it('query_daily_totals', async () => {
      dietSpy.getMealsForDay.and.callFake((day: string) =>
        day === '2026-01-01' ? of([makeMeal('2026-01-01T12:00:00', 500)]) : of([])
      );
      const out = await dispatch('query_daily_totals', {
        from: '2026-01-01',
        to: '2026-01-01',
      });
      expect(out.length).toBeGreaterThan(0);
      expect(out).toContain('500');
    });
  });

  describe('E5 — read-only safety (zero writes)', () => {
    it('no domain service exposes/receives a write call after any query', async () => {
      // The spies only declare read methods — there is no saveData / addEntry
      // surface on them at all. Executing every tool must not attempt a write.
      weightSpy.getEntries.and.returnValue(of([makeWeight('2026-01-01', 200)]));
      cardioSpy.getSessions.and.returnValue(of([makeCardio('2026-01-01', 30)]));
      readingsSpy.getReadings.and.returnValue(of([]));
      dietSpy.getSavedFoods.and.returnValue(of([]));
      dietSpy.getMealsForDay.and.returnValue(of([]));

      await dispatch('query_weight_entries', {});
      await dispatch('query_cardio_sessions', {});
      await dispatch('query_readings', {});
      await dispatch('query_saved_foods', {});
      await dispatch('query_meals_in_range', { from: '2026-01-01', to: '2026-01-01' });
      await dispatch('query_daily_totals', { from: '2026-01-01', to: '2026-01-01' });

      // Only read getters were ever invoked.
      expect(weightSpy.getEntries).toHaveBeenCalled();
      expect(cardioSpy.getSessions).toHaveBeenCalled();
      // No write-shaped method exists on any spy (createSpyObj only declared reads),
      // so a write attempt would throw "is not a function" and fail the test.
      expect((weightSpy as unknown as Record<string, unknown>)['addEntry']).toBeUndefined();
      expect((dietSpy as unknown as Record<string, unknown>)['addMeal']).toBeUndefined();
    });
  });

  describe('E6 — bounded output for a 5-year dataset', () => {
    it('query_weight_entries over 1825 entries stays under budget + summarizes', async () => {
      const big: WeightEntry[] = [];
      const base = new Date('2021-01-01').getTime();
      for (let i = 0; i < 1825; i++) {
        const d = new Date(base + i * 86400000).toISOString().slice(0, 10);
        big.push(makeWeight(d, 200 - i * 0.01));
      }
      // Newest-first per the real getter contract.
      big.reverse();
      weightSpy.getEntries.and.returnValue(of(big));

      const out = await dispatch('query_weight_entries', {});

      // Bounded: under a fixed character budget (token proxy).
      expect(out.length).toBeLessThanOrEqual(4000);
      // Summarized: an aggregate/summary line is present (a count of all 1825).
      expect(out).toContain('1825');
      // Capped: does NOT contain all 1825 rows — far fewer lines than entries.
      expect(out.split('\n').length).toBeLessThan(60);
    });
  });

  describe('filter pass-through', () => {
    it('query_readings passes { type } to getReadings(type)', async () => {
      readingsSpy.getReadings.and.returnValue(of([]));
      await dispatch('query_readings', { type: 'blood_glucose' });
      const arg = readingsSpy.getReadings.calls.mostRecent().args[0] as
        | HealthReadingType
        | undefined;
      expect(arg).toBe('blood_glucose');
    });
  });

  describe('invalid input returns an Error string, never throws', () => {
    it('non-object input', async () => {
      const out = await dispatch('query_weight_entries', 'not-an-object');
      expect(out).toContain('Error');
    });

    it('from > to range', async () => {
      const out = await dispatch('query_weight_entries', {
        from: '2026-12-31',
        to: '2026-01-01',
      });
      expect(out).toContain('Error');
    });

    it('unparseable date', async () => {
      const out = await dispatch('query_weight_entries', { from: 'not-a-date' });
      expect(out).toContain('Error');
    });
  });
});
