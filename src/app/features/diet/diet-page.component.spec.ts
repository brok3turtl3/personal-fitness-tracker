/**
 * Diet-page characterization spec.
 *
 * Per FOUND-04 + D-05/D-06/D-07/D-08: Karma TestBed DOM specs that capture the
 * dominant user flows on diet-page so a Phase 2-5 refactor that regresses them
 * fails this suite. Per-spec factory helpers (D-07). DOM-shape assertions
 * (Pitfall 6 — not full textContent). axe-core inline (D-08, FOUND-05),
 * gated to serious|critical only.
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { DietPageComponent } from './diet-page.component';
import { DietService } from '../../services/diet.service';
import { StorageService, StorageError } from '../../services/storage.service';
import { DailyTargets, MealEntry, NutritionTotals, SavedFood } from '../../models/diet.model';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

// ---------------------------------------------------------------------------
// Per-spec factory helpers (D-07: NO shared canonical fixture file).
// ---------------------------------------------------------------------------

function emptyTotals(): NutritionTotals {
  return {
    caloriesKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
    netCarbsG: 0,
  };
}

function createValidSavedFood(overrides: Partial<SavedFood> = {}): SavedFood {
  return {
    id: 'food-1',
    name: 'Egg, large',
    baseUnit: 'g',
    nutrientsPerUnit: {
      caloriesKcal: 1.55,
      proteinG: 0.13,
      fatG: 0.11,
      carbsG: 0.011,
      fiberG: 0,
      sugarG: 0.011,
      sodiumMg: 1.4,
      netCarbsG: 0.011,
    },
    servings: [
      { id: 'serv-1', label: '1 large (50g)', unit: 'g', amount: 50 },
    ],
    createdAt: '2026-04-15T08:00:00.000Z',
    updatedAt: '2026-04-15T08:00:00.000Z',
    ...overrides,
  };
}

function createValidMeal(overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    id: 'meal-1',
    dateTime: '2026-04-15T12:00:00.000Z',
    mealType: 'lunch',
    items: [
      {
        id: 'mi-1',
        savedFoodId: 'food-1',
        savedFoodName: 'Egg, large',
        servingId: 'serv-1',
        servingLabel: '1 large (50g)',
        unit: 'g',
        quantity: 2,
        snapshot: { baseUnits: 100, totals: { ...emptyTotals(), caloriesKcal: 155 } },
      },
    ],
    totals: { ...emptyTotals(), caloriesKcal: 155 },
    createdAt: '2026-04-15T12:00:00.000Z',
    updatedAt: '2026-04-15T12:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Spec helpers: build the spies a single test wants. We rebuild the TestBed
// per-spec rather than in beforeEach so error-path scenarios can override
// the initialize() return value cleanly.
// ---------------------------------------------------------------------------

interface DietSpies {
  dietService: jasmine.SpyObj<DietService>;
  storageService: jasmine.SpyObj<StorageService>;
}

function makeSpies(opts: {
  initialize?: ReturnType<jasmine.Spy>;
  savedFoods?: SavedFood[];
  meals?: MealEntry[];
  rangeMeals?: MealEntry[];
  dailyTargets?: DailyTargets;
  computeTotals?: NutritionTotals;
} = {}): DietSpies {
  const dietService = jasmine.createSpyObj<DietService>('DietService', [
    'getSavedFoods',
    'getMealsForDay',
    'getMealsInRange',
    'computeDailyTotals',
    'addSavedFood',
    'updateSavedFood',
    'deleteSavedFood',
    'addCustomServing',
    'addMeal',
    'updateMeal',
    'deleteMeal',
    'copyMealItems',
    'getDailyTargets',
    'setDailyTargets',
    'clearDailyTargets',
  ]);
  dietService.getSavedFoods.and.returnValue(of(opts.savedFoods ?? []));
  dietService.getMealsForDay.and.returnValue(of(opts.meals ?? []));
  dietService.getMealsInRange.and.returnValue(of(opts.rangeMeals ?? opts.meals ?? []));
  dietService.getDailyTargets.and.returnValue(of(opts.dailyTargets));
  dietService.computeDailyTotals.and.returnValue(opts.computeTotals ?? emptyTotals());

  const storageService = jasmine.createSpyObj<StorageService>('StorageService', [
    'initialize',
    'getData',
    'saveData',
    'getBackup',
  ]);
  storageService.initialize.and.returnValue(opts.initialize ? (opts.initialize as unknown as ReturnType<typeof of>) : of(undefined));

  return { dietService, storageService };
}

async function configureBed(spies: DietSpies): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [DietPageComponent],
    providers: [
      provideRouter([]),
      { provide: DietService, useValue: spies.dietService },
      { provide: StorageService, useValue: spies.storageService },
    ],
  }).compileComponents();
}

describe('DietPageComponent (characterization)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render the saved-foods library count from the store', async () => {
    // Arrange: 2 saved foods.
    const foods = [
      createValidSavedFood({ id: 'food-a', name: 'Apple' }),
      createValidSavedFood({ id: 'food-b', name: 'Banana' }),
    ];
    const spies = makeSpies({ savedFoods: foods });
    await configureBed(spies);

    // Act
    const fixture: ComponentFixture<DietPageComponent> = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();

    // Assert: component picked up both foods (DOM shape — saved count text "<n> saved").
    expect(fixture.componentInstance.savedFoods.length).toBe(2);
    const countText = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(countText).toContain('2 saved');
  });

  it("should render the day's meals from the store", async () => {
    // Arrange: 3 meal entries for the selected day.
    const meals = [
      createValidMeal({ id: 'meal-a' }),
      createValidMeal({ id: 'meal-b' }),
      createValidMeal({ id: 'meal-c' }),
    ];
    const spies = makeSpies({ meals });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();

    // Assert: 3 history-item rows in the meals list (DOM shape; Pitfall 6).
    const compiled = fixture.nativeElement as HTMLElement;
    const mealItems = compiled.querySelectorAll('section[aria-label="Meals history"] .history-item');
    expect(mealItems.length).toBe(3);
  });

  it('should reflect daily totals computed by DietService.computeDailyTotals', async () => {
    // Arrange: meal exists, computeDailyTotals returns 1234 kcal.
    const totals: NutritionTotals = { ...emptyTotals(), caloriesKcal: 1234, netCarbsG: 12.3 };
    const spies = makeSpies({ meals: [createValidMeal()], computeTotals: totals });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();

    // Assert: totals state has been updated and the component invoked computeDailyTotals.
    expect(spies.dietService.computeDailyTotals).toHaveBeenCalled();
    expect(fixture.componentInstance.dailyTotals.caloriesKcal).toBe(1234);

    // DOM shape assertion: a totals block exists with a Calories label.
    const compiled = fixture.nativeElement as HTMLElement;
    const totalsBlock = compiled.querySelector('.totals-grid');
    expect(totalsBlock).toBeTruthy();
    expect((totalsBlock?.textContent ?? '').toLowerCase()).toContain('calories');
  });

  it('should render <app-empty-state> when no meals exist for the day', async () => {
    // Arrange: meals = []
    const spies = makeSpies({ meals: [] });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();

    // Assert
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-empty-state')).toBeTruthy();
  });

  it('should render <app-error-state> when StorageService.initialize fails', async () => {
    // Arrange: initialize throws PARSE_ERROR.
    const dietService = jasmine.createSpyObj<DietService>('DietService', [
      'getSavedFoods', 'getMealsForDay', 'computeDailyTotals',
      'addSavedFood', 'updateSavedFood', 'deleteSavedFood',
      'addCustomServing', 'addMeal', 'updateMeal', 'deleteMeal',
    ]);
    dietService.getSavedFoods.and.returnValue(of([]));
    dietService.getMealsForDay.and.returnValue(of([]));
    dietService.computeDailyTotals.and.returnValue(emptyTotals());

    const storageService = jasmine.createSpyObj<StorageService>('StorageService', [
      'initialize', 'getData', 'saveData', 'getBackup',
    ]);
    storageService.initialize.and.returnValue(
      throwError(() => new StorageError('Stored data could not be parsed', 'PARSE_ERROR'))
    );

    await TestBed.configureTestingModule({
      imports: [DietPageComponent],
      providers: [
        provideRouter([]),
        { provide: DietService, useValue: dietService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compileComponents();

    // Act
    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();

    // Assert
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-error-state')).toBeTruthy();
  });

  it('should have no serious or critical axe-core violations on initial load', async () => {
    // Arrange: render the steady-state happy path (a few foods + meals)
    // so axe sees the realistic surface.
    const spies = makeSpies({
      savedFoods: [createValidSavedFood()],
      meals: [createValidMeal()],
    });
    await configureBed(spies);

    // Act
    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();

    // Assert: structural a11y (label association, ARIA roles, landmarks, focus order)
    // AND contrast. The Phase 1 D-13 contrast deferral is LIFTED here (QUAL-08) —
    // axe contrast checking is now enforced (no rule opt-out passed).
    await expectNoSeriousA11yViolations(fixture.nativeElement);
  });
});
