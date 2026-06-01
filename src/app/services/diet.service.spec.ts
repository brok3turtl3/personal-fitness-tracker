import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DietService } from './diet.service';
import { StorageService } from './storage.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';
import { CreateSavedFood, MealEntry, NutritionTotals, SavedFoodServing } from '../models/diet.model';

describe('DietService', () => {
  let service: DietService;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;
  let mockAppData: AppData;

  beforeEach(() => {
    mockAppData = createEmptyAppData();

    storageServiceSpy = jasmine.createSpyObj('StorageService', ['initialize', 'getData', 'saveData']);
    storageServiceSpy.initialize.and.returnValue(of(undefined));
    storageServiceSpy.getData.and.returnValue(of(mockAppData));
    storageServiceSpy.saveData.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        DietService,
        { provide: StorageService, useValue: storageServiceSpy }
      ]
    });

    service = TestBed.inject(DietService);
  });

  // Nutrition per 1 gram (so 100g would be 200 kcal)
  const perUnit: NutritionTotals = {
    caloriesKcal: 2,
    proteinG: 0.1,
    fatG: 0.12,
    carbsG: 0.05,
    fiberG: 0.02,
    sugarG: 0.01,
    sodiumMg: 3,
    netCarbsG: 0.03
  };

  const serving: SavedFoodServing = { id: 'serv-1', label: '50 g', unit: 'g', amount: 50 };

  const createFood = (overrides: Partial<CreateSavedFood> = {}): CreateSavedFood => ({
    name: 'Test Food',
    baseUnit: 'g',
    nutrientsPerUnit: perUnit,
    servings: [serving],
    ...overrides
  });

  it('should default to a 100g serving when none provided', (done) => {
    service.addSavedFood(createFood({ servings: [] as any })).subscribe(food => {
      expect(food.servings.length).toBe(1);
      expect(food.servings[0].label).toBe('100 g');
      expect(food.servings[0].unit).toBe('g');
      expect(food.servings[0].amount).toBe(100);
      done();
    });
  });

  it('should allow adding tbsp support (gramsPerTbsp)', (done) => {
    service.addSavedFood(createFood({ servings: [] as any, gramsPerTbsp: 15 })).subscribe(food => {
      expect(food.gramsPerTbsp).toBe(15);
      expect(food.servings.some(s => s.label.toLowerCase() === '1 tbsp')).toBeTrue();
      done();
    });
  });

  it('should add a saved food', (done) => {
    service.addSavedFood(createFood()).subscribe(food => {
      expect(food.id).toBeDefined();
      expect(food.baseUnit).toBe('g');
      expect(food.nutrientsPerUnit.caloriesKcal).toBe(2);
      expect(storageServiceSpy.saveData).toHaveBeenCalled();
      done();
    });
  });

  it('should add a meal and store item snapshots', (done) => {
    service.addSavedFood(createFood()).subscribe(savedFood => {
      // Update mock data to include the food (since our spy returns mockAppData by value)
      mockAppData.savedFoods = [savedFood];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      const mealDate = '2026-01-31T12:00:00.000Z';
      service.addMeal({
        dateTime: mealDate,
        items: [{ savedFoodId: savedFood.id, servingId: serving.id, quantity: 2 }]
      }).subscribe(meal => {
        expect(meal.items.length).toBe(1);
        expect(meal.items[0].snapshot.baseUnits).toBe(100);
        expect(meal.items[0].snapshot.totals.caloriesKcal).toBeCloseTo(200, 6);
        expect(meal.items[0].snapshot.totals.netCarbsG).toBeCloseTo(3, 6);

        const savedData = storageServiceSpy.saveData.calls.mostRecent().args[0];
        expect(savedData.mealEntries.length).toBe(1);
        expect(savedData.mealEntries[0].totals.caloriesKcal).toBeCloseTo(200, 6);
        done();
      });
    });
  });

  it('should update meal metadata without recomputing item snapshots when items unchanged', (done) => {
    service.addSavedFood(createFood()).subscribe(savedFood => {
      mockAppData.savedFoods = [savedFood];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.addMeal({
        dateTime: '2026-01-31T12:00:00.000Z',
        notes: 'before',
        items: [{ savedFoodId: savedFood.id, servingId: serving.id, quantity: 2 }]
      }).subscribe(meal => {
        // Mutate the saved food to prove we don't recompute when items are unchanged
        mockAppData.savedFoods[0] = {
          ...mockAppData.savedFoods[0],
          nutrientsPerUnit: { ...mockAppData.savedFoods[0].nutrientsPerUnit, caloriesKcal: 999 }
        };
        mockAppData.mealEntries = [meal];
        storageServiceSpy.getData.and.returnValue(of(mockAppData));

        service.updateMeal(meal.id, {
          dateTime: '2026-01-31T13:00:00.000Z',
          notes: 'after',
          items: [{ savedFoodId: savedFood.id, servingId: serving.id, quantity: 2 }]
        }).subscribe(updated => {
          expect(updated.notes).toBe('after');
          expect(updated.items[0].snapshot.totals.caloriesKcal).toBeCloseTo(200, 6);
          done();
        });
      });
    });
  });

  it('should delete a meal', (done) => {
    service.addSavedFood(createFood()).subscribe(savedFood => {
      mockAppData.savedFoods = [savedFood];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.addMeal({
        dateTime: '2026-01-31T12:00:00.000Z',
        items: [{ savedFoodId: savedFood.id, servingId: serving.id, quantity: 1 }]
      }).subscribe(meal => {
        mockAppData.mealEntries = [meal];
        storageServiceSpy.getData.and.returnValue(of(mockAppData));

        service.deleteMeal(meal.id).subscribe(result => {
          expect(result).toBeTrue();
          const savedData = storageServiceSpy.saveData.calls.mostRecent().args[0];
          expect(savedData.mealEntries.length).toBe(0);
          done();
        });
      });
    });
  });

  it('should compute daily totals across meals', (done) => {
    // Pretend there are two meals already
    mockAppData.mealEntries = [
      {
        id: 'm1',
        dateTime: '2026-01-31T08:00:00.000Z',
        items: [],
        totals: { ...perUnit, caloriesKcal: 300 },
        createdAt: '2026-01-31T08:00:00.000Z',
        updatedAt: '2026-01-31T08:00:00.000Z'
      },
      {
        id: 'm2',
        dateTime: '2026-01-31T18:00:00.000Z',
        items: [],
        totals: { ...perUnit, caloriesKcal: 500 },
        createdAt: '2026-01-31T18:00:00.000Z',
        updatedAt: '2026-01-31T18:00:00.000Z'
      }
    ];

    storageServiceSpy.getData.and.returnValue(of(mockAppData));
    service.getMealsForDay('2026-01-31').subscribe(meals => {
      const totals = service.computeDailyTotals(meals);
      expect(totals.caloriesKcal).toBeCloseTo(800, 6);
      done();
    });
  });

  // ==========================================================================
  // Task 1: toBaseUnits delegation to units.ts + widened unit/density validation
  // ==========================================================================

  describe('widened unit acceptance (DIET-01 service path)', () => {
    it('should accept a food with baseUnit "oz" (a widened MeasuredUnit)', (done) => {
      service.addSavedFood(createFood({ baseUnit: 'oz', servings: [] as any })).subscribe(food => {
        expect(food.baseUnit).toBe('oz');
        done();
      });
    });

    it('should accept a food with baseUnit "ml"', (done) => {
      service.addSavedFood(createFood({ baseUnit: 'ml', servings: [] as any })).subscribe(food => {
        expect(food.baseUnit).toBe('ml');
        done();
      });
    });

    it('should reject a food with an invalid base unit', (done) => {
      service.addSavedFood(createFood({ baseUnit: 'furlong' as any, servings: [] as any })).subscribe({
        next: () => done.fail('expected validation error'),
        error: (err) => {
          expect(err.name).toBe('DietValidationError');
          done();
        }
      });
    });

    it('should accept a serving expressed in a widened unit (cup)', (done) => {
      service.addSavedFood(createFood({
        servings: [{ id: 's-cup', label: '1 cup', unit: 'cup', amount: 1 }] as any,
        densityGramsPerMl: 1
      })).subscribe(food => {
        expect(food.servings.some(s => s.unit === 'cup')).toBeTrue();
        done();
      });
    });

    it('should reject a serving with an invalid unit', (done) => {
      service.addSavedFood(createFood({
        servings: [{ id: 's-bad', label: 'bad', unit: 'furlong', amount: 1 }] as any
      })).subscribe({
        next: () => done.fail('expected validation error'),
        error: (err) => {
          expect(err.name).toBe('DietValidationError');
          done();
        }
      });
    });

    it('should reject a non-positive densityGramsPerMl on add', (done) => {
      service.addSavedFood(createFood({ densityGramsPerMl: 0 })).subscribe({
        next: () => done.fail('expected validation error'),
        error: (err) => {
          expect(err.name).toBe('DietValidationError');
          done();
        }
      });
    });
  });

  describe('toBaseUnits delegation to units.ts', () => {
    it('should use a named-serving amount directly (baseUnit g, serving 50 g)', (done) => {
      // perUnit is per 1 g; serving 50 g x quantity 2 => 100 base units => 200 kcal
      service.addSavedFood(createFood()).subscribe(savedFood => {
        mockAppData.savedFoods = [savedFood];
        storageServiceSpy.getData.and.returnValue(of(mockAppData));

        service.addMeal({
          dateTime: '2026-01-31T12:00:00.000Z',
          items: [{ savedFoodId: savedFood.id, servingId: serving.id, quantity: 2 }]
        }).subscribe(meal => {
          expect(meal.items[0].snapshot.baseUnits).toBeCloseTo(100, 6);
          done();
        });
      });
    });

    it('should convert a same-dimension serving unit (oz serving on a g-based food)', (done) => {
      // baseUnit g, serving 1 oz => 28.349523125 g per quantity
      service.addSavedFood(createFood({
        servings: [{ id: 's-oz', label: '1 oz', unit: 'oz', amount: 1 }] as any
      })).subscribe(savedFood => {
        mockAppData.savedFoods = [savedFood];
        storageServiceSpy.getData.and.returnValue(of(mockAppData));

        service.addMeal({
          dateTime: '2026-01-31T12:00:00.000Z',
          items: [{ savedFoodId: savedFood.id, servingId: 's-oz', quantity: 1 }]
        }).subscribe(meal => {
          expect(meal.items[0].snapshot.baseUnits).toBeCloseTo(28.349523125, 6);
          done();
        });
      });
    });

    it('should convert a cross-dimension serving WITH density (tbsp serving on a g-based food)', (done) => {
      // baseUnit g, density 0.9 g/ml, serving 1 tbsp (14.78676478125 ml) => 13.308 g
      service.addSavedFood(createFood({
        densityGramsPerMl: 0.9,
        servings: [{ id: 's-tbsp', label: '1 tbsp', unit: 'tbsp', amount: 1 }] as any
      })).subscribe(savedFood => {
        mockAppData.savedFoods = [savedFood];
        storageServiceSpy.getData.and.returnValue(of(mockAppData));

        service.addMeal({
          dateTime: '2026-01-31T12:00:00.000Z',
          items: [{ savedFoodId: savedFood.id, servingId: 's-tbsp', quantity: 1 }]
        }).subscribe(meal => {
          expect(meal.items[0].snapshot.baseUnits).toBeCloseTo(14.78676478125 * 0.9, 6);
          done();
        });
      });
    });

    it('should THROW for a cross-dimension serving WITHOUT density (no default density)', (done) => {
      // baseUnit g, NO density, serving 1 tbsp (volume) => cannot convert
      service.addSavedFood(createFood({
        servings: [{ id: 's-tbsp', label: '1 tbsp', unit: 'tbsp', amount: 1 }] as any
      })).subscribe(savedFood => {
        mockAppData.savedFoods = [savedFood];
        storageServiceSpy.getData.and.returnValue(of(mockAppData));

        service.addMeal({
          dateTime: '2026-01-31T12:00:00.000Z',
          items: [{ savedFoodId: savedFood.id, servingId: 's-tbsp', quantity: 1 }]
        }).subscribe({
          next: () => done.fail('expected a conversion error (no density)'),
          error: (err) => {
            expect(err).toBeTruthy();
            done();
          }
        });
      });
    });
  });

  describe('snapshot carries resolved unit + serving label (D-09)', () => {
    it('should store the resolved unit and servingLabel on the snapshot', (done) => {
      service.addSavedFood(createFood()).subscribe(savedFood => {
        mockAppData.savedFoods = [savedFood];
        storageServiceSpy.getData.and.returnValue(of(mockAppData));

        service.addMeal({
          dateTime: '2026-01-31T12:00:00.000Z',
          items: [{ savedFoodId: savedFood.id, servingId: serving.id, quantity: 1 }]
        }).subscribe(meal => {
          expect(meal.items[0].snapshot.unit).toBe('g');
          expect(meal.items[0].snapshot.servingLabel).toBe('50 g');
          done();
        });
      });
    });
  });

  // ==========================================================================
  // Task 2: meals-in-range + copy-meal + DailyTargets pass-through + immutability
  // ==========================================================================

  describe('getMealsInRange', () => {
    beforeEach(() => {
      mockAppData.mealEntries = [
        { id: 'a', dateTime: '2026-01-10T12:00:00.000Z', items: [], totals: { ...perUnit }, createdAt: '', updatedAt: '' },
        { id: 'b', dateTime: '2026-01-20T12:00:00.000Z', items: [], totals: { ...perUnit }, createdAt: '', updatedAt: '' },
        { id: 'c', dateTime: '2026-02-01T12:00:00.000Z', items: [], totals: { ...perUnit }, createdAt: '', updatedAt: '' }
      ];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));
    });

    it('should return only meals whose dateTime falls within [start, end], sorted by dateTime', (done) => {
      const start = Date.parse('2026-01-15T00:00:00.000Z');
      const end = Date.parse('2026-01-31T23:59:59.999Z');
      service.getMealsInRange(start, end).subscribe(meals => {
        expect(meals.map(m => m.id)).toEqual(['b']);
        done();
      });
    });

    it('should include the boundary meals (inclusive range) sorted ascending', (done) => {
      const start = Date.parse('2026-01-10T12:00:00.000Z');
      const end = Date.parse('2026-02-01T12:00:00.000Z');
      service.getMealsInRange(start, end).subscribe(meals => {
        expect(meals.map(m => m.id)).toEqual(['a', 'b', 'c']);
        done();
      });
    });

    it('should return an empty array when no meals fall in range', (done) => {
      service.getMealsInRange(Date.parse('2025-01-01T00:00:00.000Z'), Date.parse('2025-12-31T00:00:00.000Z'))
        .subscribe(meals => {
          expect(meals).toEqual([]);
          done();
        });
    });
  });

  describe('copyMealItems (D-09 / A5 re-derive from current food)', () => {
    it('should re-derive preview from the CURRENT food (not the snapshot) when the food still exists', (done) => {
      service.addSavedFood(createFood()).subscribe(savedFood => {
        mockAppData.savedFoods = [savedFood];
        storageServiceSpy.getData.and.returnValue(of(mockAppData));

        service.addMeal({
          dateTime: '2026-01-31T12:00:00.000Z',
          items: [{ savedFoodId: savedFood.id, servingId: serving.id, quantity: 2 }]
        }).subscribe(meal => {
          // Original preview: 100 base units * 2 kcal/unit = 200 kcal.
          // Now edit the food to double calories per unit.
          const editedFood = { ...savedFood, nutrientsPerUnit: { ...perUnit, caloriesKcal: 4 } };
          const copied = service.copyMealItems(meal, [editedFood]);

          expect(copied.length).toBe(1);
          expect(copied[0].savedFoodId).toBe(savedFood.id);
          expect(copied[0].servingId).toBe(serving.id);
          expect(copied[0].quantity).toBe(2);
          // Re-derived from CURRENT (edited) food: 100 base units * 4 = 400 kcal.
          expect(copied[0].preview.caloriesKcal).toBeCloseTo(400, 6);
          done();
        });
      });
    });

    it('should fall back to the snapshot totals when the food no longer exists', (done) => {
      service.addSavedFood(createFood()).subscribe(savedFood => {
        mockAppData.savedFoods = [savedFood];
        storageServiceSpy.getData.and.returnValue(of(mockAppData));

        service.addMeal({
          dateTime: '2026-01-31T12:00:00.000Z',
          items: [{ savedFoodId: savedFood.id, servingId: serving.id, quantity: 2 }]
        }).subscribe(meal => {
          const snapshotKcal = meal.items[0].snapshot.totals.caloriesKcal; // 200
          const copied = service.copyMealItems(meal, []); // food deleted
          expect(copied[0].preview.caloriesKcal).toBeCloseTo(snapshotKcal, 6);
          done();
        });
      });
    });
  });

  describe('DailyTargets get/set/clear (D-08)', () => {
    it('should return undefined when no targets are persisted', (done) => {
      service.getDailyTargets().subscribe(t => {
        expect(t).toBeUndefined();
        done();
      });
    });

    it('should persist and round-trip targets', (done) => {
      const targets = { caloriesKcal: 2000, proteinG: 150 };
      service.setDailyTargets(targets).subscribe(saved => {
        expect(saved).toEqual(targets);
        const persisted = storageServiceSpy.saveData.calls.mostRecent().args[0];
        expect(persisted.dailyTargets).toEqual(targets);
        done();
      });
    });

    it('should reject invalid targets via DietValidationError', (done) => {
      service.setDailyTargets({ proteinG: -5 }).subscribe({
        next: () => done.fail('expected validation error'),
        error: (err) => {
          expect(err.name).toBe('DietValidationError');
          done();
        }
      });
    });

    it('should clear targets without writing null', (done) => {
      mockAppData.dailyTargets = { caloriesKcal: 1800 };
      storageServiceSpy.getData.and.returnValue(of(mockAppData));
      service.clearDailyTargets().subscribe(() => {
        const persisted = storageServiceSpy.saveData.calls.mostRecent().args[0];
        expect(persisted.dailyTargets).toBeUndefined();
        expect('dailyTargets' in persisted ? persisted.dailyTargets : undefined).toBeUndefined();
        done();
      });
    });
  });

  describe('snapshot immutability (DIET-09, D-12)', () => {
    it('should leave logged MealEntry.totals and MealItem.snapshot byte-identical after a food edit', (done) => {
      service.addSavedFood(createFood()).subscribe(savedFood => {
        mockAppData.savedFoods = [savedFood];
        storageServiceSpy.getData.and.returnValue(of(mockAppData));

        service.addMeal({
          dateTime: '2026-01-31T12:00:00.000Z',
          items: [{ savedFoodId: savedFood.id, servingId: serving.id, quantity: 2 }]
        }).subscribe(meal => {
          // Capture deep copies of the historical totals + snapshot.
          const capturedTotals = JSON.parse(JSON.stringify(meal.totals));
          const capturedSnapshot = JSON.parse(JSON.stringify(meal.items[0].snapshot));

          mockAppData.mealEntries = [meal];
          storageServiceSpy.getData.and.returnValue(of(mockAppData));

          // Edit the food's macros — historical meal must NOT change.
          service.updateSavedFood(savedFood.id, {
            name: savedFood.name,
            nutrientsPerUnit: { ...perUnit, caloriesKcal: 999, proteinG: 99 }
          }).subscribe(() => {
            // Re-read the stored meal from the most recent save (updateSavedFood
            // only touches savedFoods, never mealEntries).
            const persisted = storageServiceSpy.saveData.calls.mostRecent().args[0];
            const storedMeal = persisted.mealEntries.find((m: MealEntry) => m.id === meal.id)!;

            expect(storedMeal.totals).toEqual(capturedTotals);
            expect(storedMeal.items[0].snapshot).toEqual(capturedSnapshot);
            done();
          });
        });
      });
    });
  });
});
