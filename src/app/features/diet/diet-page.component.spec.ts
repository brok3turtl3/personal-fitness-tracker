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

  it('should update live daily totals when a pending item is added', async () => {
    // Arrange: a food with a serving + one already-saved meal (155 kcal).
    const food = createValidSavedFood();
    const spies = makeSpies({ savedFoods: [food], meals: [createValidMeal()] });
    // computeDailyTotals reflects the single saved meal.
    spies.dietService.computeDailyTotals.and.returnValue({ ...emptyTotals(), caloriesKcal: 155 });
    await configureBed(spies);

    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    // Baseline live totals = saved meal only.
    expect(cmp.liveTotals.caloriesKcal).toBe(155);

    // Act: select the food, choose its serving, add to meal (stages a pending item).
    cmp.selectFood(food);
    cmp.mealItemForm.patchValue({ servingId: 'serv-1', quantity: 1 });
    cmp.onAddMealItem();
    fixture.detectChanges();

    // Assert: a pending item exists and live net-carbs reflects the running sum.
    expect(cmp.pendingItems.length).toBe(1);
    // 1 serving = 50g of egg @ 0.011 net carbs/g ≈ 0.55g net carbs added.
    expect(cmp.liveTotals.netCarbsG).toBeCloseTo(0.55, 2);
    // Live calories grew beyond the saved-meal baseline.
    expect(cmp.liveTotals.caloriesKcal).toBeGreaterThan(155);

    // DOM shape: the totals grid net-carbs cell reflects the live sum (>0).
    const compiled = fixture.nativeElement as HTMLElement;
    const totalsText = (compiled.querySelector('.totals-grid')?.textContent ?? '').toLowerCase();
    expect(totalsText).toContain('net carbs');
  });

  it('should render a %-of-target bar with an always-present text label, destructive over-target state, and over-by copy', async () => {
    // Arrange: calorie target of 100 with a saved meal of 155 kcal → over target.
    const targets: DailyTargets = { caloriesKcal: 100 };
    const spies = makeSpies({
      savedFoods: [createValidSavedFood()],
      meals: [createValidMeal()],
      dailyTargets: targets,
    });
    spies.dietService.computeDailyTotals.and.returnValue({ ...emptyTotals(), caloriesKcal: 155 });
    await configureBed(spies);

    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // Assert: a target bar exists with the destructive over-target modifier.
    const bar = compiled.querySelector('.target-bar.over');
    expect(bar).toBeTruthy();

    // Text label is ALWAYS present (color is never the only signal) and uses the over-by copy.
    const labelText = (compiled.querySelector('.target-label')?.textContent ?? '');
    expect(labelText).toContain('over by');
    expect(labelText).toContain('155 / 100 kcal');
  });

  it('should render a %-of-target bar with a percentage label when under target', async () => {
    const targets: DailyTargets = { caloriesKcal: 1000 };
    const spies = makeSpies({
      savedFoods: [createValidSavedFood()],
      meals: [createValidMeal()],
      dailyTargets: targets,
    });
    spies.dietService.computeDailyTotals.and.returnValue({ ...emptyTotals(), caloriesKcal: 155 });
    await configureBed(spies);

    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // Under target → no .over modifier, but the percentage label is still present.
    expect(compiled.querySelector('.target-bar.over')).toBeFalsy();
    const labelText = (compiled.querySelector('.target-label')?.textContent ?? '');
    expect(labelText).toContain('155 / 1000 kcal');
    expect(labelText).toContain('%');
  });

  it('should populate editable pending items from a prior day when "Repeat yesterday" is used (DIET-05)', async () => {
    // Arrange: yesterday has one meal; copyMealItems re-derives editable pending items.
    const food = createValidSavedFood();
    const sourceMeal = createValidMeal();
    const spies = makeSpies({ savedFoods: [food], meals: [] });
    // getMealsForDay is used both for the selected day (empty) and the copy source.
    // Return the source meal regardless of the day key for this test.
    spies.dietService.getMealsForDay.and.returnValue(of([sourceMeal]));
    spies.dietService.copyMealItems.and.returnValue([
      {
        savedFoodId: 'food-1',
        servingId: 'serv-1',
        quantity: 2,
        label: 'Egg, large - 1 large (50g) x2',
        preview: { ...emptyTotals(), caloriesKcal: 155 },
      },
    ]);
    await configureBed(spies);

    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    // Act
    cmp.repeatYesterday();
    fixture.detectChanges();

    // Assert: copyMealItems was used (re-derive in service) and items landed as editable pending.
    expect(spies.dietService.copyMealItems).toHaveBeenCalled();
    expect(cmp.pendingItems.length).toBe(1);
    expect(cmp.pendingItems[0].savedFoodId).toBe('food-1');
    expect(cmp.copyResult).toContain('Copied 1 items');
    // Editable: a removable pending row is rendered.
    const compiled = fixture.nativeElement as HTMLElement;
    const removeBtn = Array.from(compiled.querySelectorAll('.items-list .history-item button'))
      .find(b => (b.textContent ?? '').trim() === 'Remove');
    expect(removeBtn).toBeTruthy();
  });

  it('should render logged-meal history from the stored snapshot, not a re-resolved food (DIET-09)', async () => {
    // Arrange: the live food was edited to 999 kcal/unit, but the meal snapshot is frozen at 155.
    const editedFood = createValidSavedFood({
      nutrientsPerUnit: { ...emptyTotals(), caloriesKcal: 999 },
    });
    const meal = createValidMeal(); // totals.caloriesKcal === 155 (snapshot)
    const spies = makeSpies({ savedFoods: [editedFood], meals: [meal] });
    spies.dietService.computeDailyTotals.and.returnValue({ ...emptyTotals(), caloriesKcal: 155 });
    await configureBed(spies);

    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // Assert: the history row shows the snapshot value (155 kcal), never the live food's 999.
    const historyRow = compiled.querySelector('section[aria-label="Meals history"] .history-item');
    const rowText = historyRow?.textContent ?? '';
    expect(rowText).toContain('155');
    expect(rowText).not.toContain('999');
  });

  it('CR-01: should preview (not throw) a tbsp serving on a legacy g-base food carrying only gramsPerTbsp, matching the service conversion', async () => {
    // Arrange: a legacy g-base oil with NO explicit densityGramsPerMl, only the
    // legacy gramsPerTbsp bridge, and a cross-dimension `tbsp` serving. Before
    // CR-01 the preview passed `food.densityGramsPerMl` (undefined) straight to
    // toBaseUnits → UnitConversionError → "needs a density" → add blocked.
    const gramsPerTbsp = 13.5; // ~olive oil
    const oil = createValidSavedFood({
      id: 'oil-1',
      name: 'Olive oil (legacy)',
      baseUnit: 'g',
      gramsPerTbsp,
      densityGramsPerMl: undefined,
      nutrientsPerUnit: { ...emptyTotals(), caloriesKcal: 8.84 }, // per gram
      servings: [{ id: 'oil-tbsp', label: '1 tbsp', unit: 'tbsp', amount: 1 }],
    });
    const spies = makeSpies({ savedFoods: [oil], meals: [] });
    await configureBed(spies);

    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    // Act: select the legacy food, choose its tbsp serving, add to the meal.
    cmp.selectFood(oil);
    cmp.mealItemForm.patchValue({ servingId: 'oil-tbsp', quantity: 1 });
    cmp.onAddMealItem();
    fixture.detectChanges();

    // Assert: the add succeeded (no density error, item staged).
    expect(cmp.mealError).toBeNull();
    expect(cmp.pendingItems.length).toBe(1);

    // The preview must match what DietService persists: 1 tbsp → gramsPerTbsp
    // grams (derived density round-trips exactly through ML_PER_TBSP), so
    // calories = gramsPerTbsp * 8.84.
    expect(cmp.pendingItems[0].preview.caloriesKcal).toBeCloseTo(gramsPerTbsp * 8.84, 6);

    // And the serving-unit picker offers cross-dimension units for this food
    // (gated on effectiveDensity, not the absent raw densityGramsPerMl).
    expect(cmp.servingUnitOptions(oil)).toContain('ml');

    // CR-01 follow-up: the "No density set" note must NOT claim this food is
    // inconvertible — it is convertible via the legacy gramsPerTbsp bridge, so
    // selectedFoodConvertible is true and the note is suppressed.
    cmp.selectedFood = oil;
    expect(cmp.selectedFoodConvertible).toBe(true);
    cmp.selectedFood = createValidSavedFood({ densityGramsPerMl: undefined, gramsPerTbsp: undefined });
    expect(cmp.selectedFoodConvertible).toBe(false);
  });

  it('WR-01: should block the save (not silently drop) when a serving-less pending item is mixed with a valid one', async () => {
    // Arrange: a valid food + an already-staged serving-less pending item
    // (as onQuickAdd stages: servingId: '').
    const food = createValidSavedFood();
    const spies = makeSpies({ savedFoods: [food], meals: [] });
    await configureBed(spies);

    const fixture = TestBed.createComponent(DietPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    // One valid item via the normal flow...
    cmp.selectFood(food);
    cmp.mealItemForm.patchValue({ servingId: 'serv-1', quantity: 1 });
    cmp.onAddMealItem();
    // ...plus a serving-less quick-add-style pending item.
    cmp.pendingItems = [
      ...cmp.pendingItems,
      { savedFoodId: food.id, servingId: '', quantity: 1, label: 'Quick add x1 g', preview: emptyTotals() },
    ];
    fixture.detectChanges();

    // Act: attempt to save the meal.
    cmp.onAddMeal();
    fixture.detectChanges();

    // Assert: save was BLOCKED with an error — addMeal never called, nothing dropped silently.
    expect(spies.dietService.addMeal).not.toHaveBeenCalled();
    expect(cmp.mealError).toBeTruthy();
    expect(cmp.pendingItems.length).toBe(2);
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
