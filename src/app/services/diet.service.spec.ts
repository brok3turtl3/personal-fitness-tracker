import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DietService } from './diet.service';
import { StorageService } from './storage.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';
import { CreateSavedFood, NutritionTotals, SavedFoodServing } from '../models/diet.model';

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
});
