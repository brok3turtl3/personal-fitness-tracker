import { TestBed } from '@angular/core/testing';
import { StorageService, StorageError } from './storage.service';
import { AppData, STORAGE_KEY, CURRENT_SCHEMA_VERSION } from '../models/app-data.model';
import { firstValueFrom } from 'rxjs';

describe('StorageService', () => {
  let service: StorageService;

  // Mock localStorage
  let localStorageMock: { [key: string]: string };
  let originalLengthDesc: PropertyDescriptor | undefined;
  let originalKey: Storage['key'];

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

    // pruneOldBackups iterates via localStorage.length + localStorage.key(i).
    // `length` is an accessor on Storage.prototype (not the instance), so
    // spyOnProperty(localStorage, ...) fails with "Accessor properties are
    // not allowed". Patch the prototype getter for the duration of the spec.
    originalLengthDesc = Object.getOwnPropertyDescriptor(Storage.prototype, 'length');
    Object.defineProperty(Storage.prototype, 'length', {
      configurable: true,
      get: () => Object.keys(localStorageMock).length,
    });
    originalKey = Storage.prototype.key;
    Storage.prototype.key = (i: number) => Object.keys(localStorageMock)[i] ?? null;

    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
  });

  afterEach(() => {
    if (originalLengthDesc) {
      Object.defineProperty(Storage.prototype, 'length', originalLengthDesc);
    }
    Storage.prototype.key = originalKey;
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
        chatConversations: [],
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
        chatConversations: [],
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

    it('should migrate v3 data to v4 by adding AI chat fields', async () => {
      const v3Data = {
        schemaVersion: 3,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        lastModified: '2026-02-14T00:00:00.000Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(v3Data);

      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(data?.chatConversations).toEqual([]);
      expect(data?.aiSettings).toBeUndefined();
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

  describe('backup-before-migrate', () => {
    const BACKUP_PREFIX = 'fitness_tracker_data.backup.';

    it('should write a backup key matching fitness_tracker_data.backup.v{N}.{ISO} before running a migration', async () => {
      const v3Data = {
        schemaVersion: 3,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        lastModified: '2026-02-14T00:00:00.000Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(v3Data);

      await firstValueFrom(service.initialize());

      const backupKeys = Object.keys(localStorageMock).filter(k => k.startsWith(BACKUP_PREFIX));
      expect(backupKeys.length).toBe(1);
      expect(backupKeys[0]).toMatch(
        /^fitness_tracker_data\.backup\.v3\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/
      );
      // The backup contents are the original raw V3 JSON (pre-migration).
      const backed = JSON.parse(localStorageMock[backupKeys[0]]);
      expect(backed.schemaVersion).toBe(3);
    });

    it('should NOT write a backup when no migration runs (data already at CURRENT_SCHEMA_VERSION)', async () => {
      const currentData: AppData = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        chatConversations: [],
        lastModified: '2026-05-01T08:00:00.000Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(currentData);

      await firstValueFrom(service.initialize());

      const backupKeys = Object.keys(localStorageMock).filter(k => k.startsWith(BACKUP_PREFIX));
      expect(backupKeys.length).toBe(0);
    });

    it('should NOT write a backup on first run (rawData === null)', async () => {
      // localStorageMock is empty — no STORAGE_KEY set.
      await firstValueFrom(service.initialize());

      const backupKeys = Object.keys(localStorageMock).filter(k => k.startsWith(BACKUP_PREFIX));
      expect(backupKeys.length).toBe(0);
    });
  });

  describe('migration failure recovery', () => {
    const BACKUP_PREFIX = 'fitness_tracker_data.backup.';

    it('should throw StorageError with code MIGRATION_FAILED and recovery key in message when migrate function throws', async () => {
      const v3Data = {
        schemaVersion: 3,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        lastModified: '2026-02-14T00:00:00.000Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(v3Data);

      // Force migration failure by stubbing migrateV3ToV4 to throw.
      spyOn<any>(service, 'migrateV3ToV4').and.throwError('synthetic V3->V4 failure');

      try {
        await firstValueFrom(service.initialize());
        fail('Should have thrown an error');
      } catch (e) {
        expect(e instanceof StorageError).toBe(true);
        const err = e as StorageError;
        expect(err.code).toBe('MIGRATION_FAILED');
        // Error message must carry the recovery backup key for plan 10's banner.
        expect(err.message).toMatch(/Backup at fitness_tracker_data\.backup\.v3\./);
      }

      // Backup must still exist on disk (it was written before the migration ran).
      const backupKeys = Object.keys(localStorageMock).filter(k => k.startsWith(BACKUP_PREFIX));
      expect(backupKeys.length).toBe(1);
    });

    it('should NOT corrupt cachedData when migration throws (initialized stays false)', async () => {
      const v3Data = {
        schemaVersion: 3,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        lastModified: '2026-02-14T00:00:00.000Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(v3Data);

      spyOn<any>(service, 'migrateV3ToV4').and.throwError('synthetic V3->V4 failure');

      try {
        await firstValueFrom(service.initialize());
      } catch {
        /* expected */
      }

      // initialize() must not have flipped initialized=true; getData() should
      // still error with NOT_AVAILABLE so callers don't read half-migrated data.
      try {
        await firstValueFrom(service.getData());
        fail('Should have thrown — service is not initialized');
      } catch (e) {
        expect(e instanceof StorageError).toBe(true);
        expect((e as StorageError).code).toBe('NOT_AVAILABLE');
      }
    });
  });

  describe('pruneOldBackups', () => {
    const BACKUP_PREFIX = 'fitness_tracker_data.backup.';

    it('should keep the most recent 3 backups and remove older ones', async () => {
      // Seed 5 backup keys with sortable ISO timestamps (lexicographic order
      // matches chronological order). Pre-existing migration trigger requires
      // STORAGE_KEY at < CURRENT_SCHEMA_VERSION so initialize() runs the prune.
      localStorageMock[`${BACKUP_PREFIX}v0.2026-01-01T00-00-00.000Z`] = '"backup-1"';
      localStorageMock[`${BACKUP_PREFIX}v0.2026-02-01T00-00-00.000Z`] = '"backup-2"';
      localStorageMock[`${BACKUP_PREFIX}v0.2026-03-01T00-00-00.000Z`] = '"backup-3"';
      localStorageMock[`${BACKUP_PREFIX}v0.2026-04-01T00-00-00.000Z`] = '"backup-4"';
      localStorageMock[`${BACKUP_PREFIX}v0.2026-05-01T00-00-00.000Z`] = '"backup-5"';

      const v3Data = {
        schemaVersion: 3,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        lastModified: '2026-05-15T00:00:00.000Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(v3Data);

      await firstValueFrom(service.initialize());

      // After prune (which keeps 3 newest pre-existing) + the new pre-migration
      // backup write, expect: 3 most recent pre-existing kept + 1 new = 4.
      const remaining = Object.keys(localStorageMock).filter(k => k.startsWith(BACKUP_PREFIX));
      expect(remaining.length).toBe(4);
      // Two oldest must be gone.
      expect(remaining).not.toContain(`${BACKUP_PREFIX}v0.2026-01-01T00-00-00.000Z`);
      expect(remaining).not.toContain(`${BACKUP_PREFIX}v0.2026-02-01T00-00-00.000Z`);
      // Three newest pre-existing must still be present.
      expect(remaining).toContain(`${BACKUP_PREFIX}v0.2026-03-01T00-00-00.000Z`);
      expect(remaining).toContain(`${BACKUP_PREFIX}v0.2026-04-01T00-00-00.000Z`);
      expect(remaining).toContain(`${BACKUP_PREFIX}v0.2026-05-01T00-00-00.000Z`);
    });

    it('should never remove the active STORAGE_KEY', async () => {
      // Seed 4 backups + the live STORAGE_KEY (the active store).
      localStorageMock[`${BACKUP_PREFIX}v0.2026-01-01T00-00-00.000Z`] = '"backup-1"';
      localStorageMock[`${BACKUP_PREFIX}v0.2026-02-01T00-00-00.000Z`] = '"backup-2"';
      localStorageMock[`${BACKUP_PREFIX}v0.2026-03-01T00-00-00.000Z`] = '"backup-3"';
      localStorageMock[`${BACKUP_PREFIX}v0.2026-04-01T00-00-00.000Z`] = '"backup-4"';

      const v3Data = {
        schemaVersion: 3,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        lastModified: '2026-05-15T00:00:00.000Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(v3Data);

      await firstValueFrom(service.initialize());

      // Security gate: STORAGE_KEY must still be present after the migration
      // + prune. (initialize() rewrites it with the migrated payload, but the
      // key itself must NEVER be removed by pruneOldBackups.)
      expect(localStorageMock[STORAGE_KEY]).toBeDefined();
      expect(JSON.parse(localStorageMock[STORAGE_KEY]).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('should never remove keys without the BACKUP_KEY_PREFIX', async () => {
      // Unrelated foreign keys that could collide with a sloppy prefix filter.
      localStorageMock['fitness_tracker_data_other'] = '"foreign-1"';
      localStorageMock['some.other.app.backup'] = '"foreign-2"';
      // Legitimate backup keys (more than MAX_BACKUPS_TO_KEEP=3 to force prune).
      localStorageMock[`${BACKUP_PREFIX}v0.2026-01-01T00-00-00.000Z`] = '"backup-1"';
      localStorageMock[`${BACKUP_PREFIX}v0.2026-02-01T00-00-00.000Z`] = '"backup-2"';
      localStorageMock[`${BACKUP_PREFIX}v0.2026-03-01T00-00-00.000Z`] = '"backup-3"';
      localStorageMock[`${BACKUP_PREFIX}v0.2026-04-01T00-00-00.000Z`] = '"backup-4"';

      const v3Data = {
        schemaVersion: 3,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        lastModified: '2026-05-15T00:00:00.000Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(v3Data);

      await firstValueFrom(service.initialize());

      // Foreign keys must still be present.
      expect(localStorageMock['fitness_tracker_data_other']).toBe('"foreign-1"');
      expect(localStorageMock['some.other.app.backup']).toBe('"foreign-2"');
    });
  });
});
