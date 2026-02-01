import { TestBed } from '@angular/core/testing';
import { StorageService, StorageError } from './storage.service';
import { AppData, STORAGE_KEY, CURRENT_SCHEMA_VERSION } from '../models/app-data.model';
import { firstValueFrom } from 'rxjs';

describe('StorageService', () => {
  let service: StorageService;

  // Mock localStorage
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    localStorageMock = {};

    spyOn(localStorage, 'getItem').and.callFake((key: string) => {
      return localStorageMock[key] ?? null;
    });

    spyOn(localStorage, 'setItem').and.callFake((key: string, value: string) => {
      localStorageMock[key] = value;
    });

    spyOn(localStorage, 'removeItem').and.callFake((key: string) => {
      delete localStorageMock[key];
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
  });

  describe('initialize', () => {
    it('should create empty data on first run', async () => {
      await firstValueFrom(service.initialize());
      
      const data = await firstValueFrom(service.getData());
      
      expect(data).toBeTruthy();
      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(data?.cardioSessions).toEqual([]);
      expect(data?.weightEntries).toEqual([]);
      expect(data?.healthReadings).toEqual([]);
      expect(data?.savedFoods).toEqual([]);
      expect(data?.mealEntries).toEqual([]);
    });

    it('should load existing data', async () => {
      const existingData: AppData = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        cardioSessions: [],
        weightEntries: [{ 
          id: '123', 
          date: '2025-01-25T10:00:00Z', 
          weightLbs: 150, 
          createdAt: '2025-01-25T10:00:00Z', 
          updatedAt: '2025-01-25T10:00:00Z' 
        }],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        lastModified: '2025-01-25T10:00:00Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(existingData);

      await firstValueFrom(service.initialize());
      
      const data = await firstValueFrom(service.getData());
      
      expect(data?.weightEntries.length).toBe(1);
      expect(data?.weightEntries[0].weightLbs).toBe(150);
    });

    it('should only initialize once', async () => {
      await firstValueFrom(service.initialize());
      await firstValueFrom(service.initialize());
      
      // Should not throw and should work fine
      const data = await firstValueFrom(service.getData());
      expect(data).toBeTruthy();
    });

    it('should error on corrupted data', async () => {
      localStorageMock[STORAGE_KEY] = 'not valid json{{{';

      try {
        await firstValueFrom(service.initialize());
        fail('Should have thrown an error');
      } catch (e) {
        expect(e instanceof StorageError).toBe(true);
        expect((e as StorageError).code).toBe('PARSE_ERROR');
      }
    });
  });

  describe('getData', () => {
    it('should error if not initialized', async () => {
      try {
        await firstValueFrom(service.getData());
        fail('Should have thrown an error');
      } catch (e) {
        expect(e instanceof StorageError).toBe(true);
        expect((e as StorageError).code).toBe('NOT_AVAILABLE');
      }
    });

    it('should return data after initialization', async () => {
      await firstValueFrom(service.initialize());
      
      const data = await firstValueFrom(service.getData());
      
      expect(data).toBeTruthy();
      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('saveData', () => {
    it('should error if not initialized', async () => {
      const data: AppData = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        lastModified: new Date().toISOString()
      };

      try {
        await firstValueFrom(service.saveData(data));
        fail('Should have thrown an error');
      } catch (e) {
        expect(e instanceof StorageError).toBe(true);
        expect((e as StorageError).code).toBe('NOT_AVAILABLE');
      }
    });

    it('should persist data to localStorage', async () => {
      await firstValueFrom(service.initialize());
      
      const data = await firstValueFrom(service.getData());
      data!.weightEntries.push({
        id: 'test-id',
        date: '2025-01-25T12:00:00Z',
        weightLbs: 165,
        createdAt: '2025-01-25T12:00:00Z',
        updatedAt: '2025-01-25T12:00:00Z'
      });

      await firstValueFrom(service.saveData(data!));

      // Verify it's in localStorage
      const stored = JSON.parse(localStorageMock[STORAGE_KEY]);
      expect(stored.weightEntries.length).toBe(1);
      expect(stored.weightEntries[0].weightLbs).toBe(165);
    });

    it('should update lastModified timestamp', async () => {
      await firstValueFrom(service.initialize());
      
      const dataBefore = await firstValueFrom(service.getData());
      const lastModifiedBefore = dataBefore!.lastModified;

      // Wait a small amount to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      await firstValueFrom(service.saveData(dataBefore!));
      
      const dataAfter = await firstValueFrom(service.getData());
      expect(dataAfter!.lastModified).not.toBe(lastModifiedBefore);
    });
  });

  describe('clearData', () => {
    it('should reset to empty data', async () => {
      await firstValueFrom(service.initialize());
      
      // Add some data
      const data = await firstValueFrom(service.getData());
      data!.weightEntries.push({
        id: 'test-id',
        date: '2025-01-25T12:00:00Z',
        weightLbs: 165,
        createdAt: '2025-01-25T12:00:00Z',
        updatedAt: '2025-01-25T12:00:00Z'
      });
      await firstValueFrom(service.saveData(data!));

      // Clear data
      await firstValueFrom(service.clearData());

      // Verify it's empty
      const clearedData = await firstValueFrom(service.getData());
      expect(clearedData?.weightEntries).toEqual([]);
      expect(clearedData?.cardioSessions).toEqual([]);
      expect(clearedData?.healthReadings).toEqual([]);
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage usage information', async () => {
      await firstValueFrom(service.initialize());
      
      const info = await firstValueFrom(service.getStorageInfo());
      
      expect(info.usedBytes).toBeGreaterThan(0);
      expect(info.availableBytes).toBeGreaterThan(0);
      expect(info.percentUsed).toBeGreaterThanOrEqual(0);
      expect(info.percentUsed).toBeLessThan(100);
    });
  });

  describe('migration', () => {
    it('should migrate data without schemaVersion to v1', async () => {
      // Data without schemaVersion (v0)
      const oldData = {
        cardioSessions: [],
        weightEntries: [{ 
          id: '123', 
          date: '2025-01-25T10:00:00Z', 
          weightLbs: 150,
          createdAt: '2025-01-25T10:00:00Z',
          updatedAt: '2025-01-25T10:00:00Z'
        }],
        healthReadings: [],
        lastModified: '2025-01-25T10:00:00Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(oldData);

      await firstValueFrom(service.initialize());
      
      const data = await firstValueFrom(service.getData());
      
      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(data?.weightEntries.length).toBe(1);
      expect(data?.savedFoods).toEqual([]);
      expect(data?.mealEntries).toEqual([]);
    });

    it('should preserve data during migration', async () => {
      const oldData = {
        cardioSessions: [{
          id: 'cardio-1',
          date: '2025-01-25T08:00:00Z',
          type: 'running',
          durationMinutes: 30,
          distanceKm: 5,
          createdAt: '2025-01-25T08:00:00Z',
          updatedAt: '2025-01-25T08:00:00Z'
        }],
        weightEntries: [],
        healthReadings: [],
        lastModified: '2025-01-25T08:00:00Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(oldData);

      await firstValueFrom(service.initialize());
      
      const data = await firstValueFrom(service.getData());
      
      expect(data?.cardioSessions.length).toBe(1);
      expect(data?.cardioSessions[0].type).toBe('running');
      expect(data?.cardioSessions[0].durationMinutes).toBe(30);
      expect(data?.savedFoods).toEqual([]);
      expect(data?.mealEntries).toEqual([]);
    });

    it('should migrate v1 data to v3 by adding diet containers', async () => {
      const v1Data = {
        schemaVersion: 1,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        lastModified: '2025-01-25T08:00:00Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(v1Data);

      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(data?.savedFoods).toEqual([]);
      expect(data?.mealEntries).toEqual([]);
    });

    it('should migrate v2 saved foods to v3 (per100g -> perUnit)', async () => {
      const v2Data = {
        schemaVersion: 2,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [
          {
            id: 'food-1',
            fdcId: 999,
            name: 'Legacy Food',
            nutrientsPer100g: {
              caloriesKcal: 200,
              proteinG: 10,
              fatG: 12,
              carbsG: 5,
              fiberG: 2,
              sugarG: 1,
              sodiumMg: 300,
              netCarbsG: 3
            },
            servings: [{ id: 's1', label: '50 g', grams: 50 }],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        ],
        mealEntries: [],
        lastModified: '2026-01-01T00:00:00.000Z'
      };

      localStorageMock[STORAGE_KEY] = JSON.stringify(v2Data);

      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(data?.savedFoods.length).toBe(1);

      const food = data!.savedFoods[0] as any;
      expect(food.baseUnit).toBe('g');
      expect(food.nutrientsPerUnit.caloriesKcal).toBeCloseTo(2, 6);
      expect(food.servings[0].unit).toBe('g');
      expect(food.servings[0].amount).toBeCloseTo(50, 6);
    });
  });
});
