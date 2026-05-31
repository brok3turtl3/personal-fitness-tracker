import { TestBed } from '@angular/core/testing';
import { StorageService, StorageError } from './storage.service';
import { AppData, STORAGE_KEY, CURRENT_SCHEMA_VERSION } from '../models/app-data.model';
import { DEFAULT_AI_TOOL_SETTINGS } from '../models/ai-chat.model';
import { DEFAULT_USER_PROFILE } from '../models/user-profile.model';
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
        memoryFiles: {},
        userProfile: { ...DEFAULT_USER_PROFILE },
        aiToolSettings: { ...DEFAULT_AI_TOOL_SETTINGS },
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
        memoryFiles: {},
        userProfile: { ...DEFAULT_USER_PROFILE },
        aiToolSettings: { ...DEFAULT_AI_TOOL_SETTINGS },
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

  describe('getStorageInfo — navigator.storage.estimate() quota (QUAL-02)', () => {
    let originalStorage: PropertyDescriptor | undefined;

    function stubNavigatorStorage(value: unknown): void {
      originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        get: () => value,
      });
    }

    afterEach(() => {
      if (originalStorage) {
        Object.defineProperty(navigator, 'storage', originalStorage);
      } else {
        // navigator.storage had no own descriptor — remove the stub.
        try { delete (navigator as unknown as { storage?: unknown }).storage; } catch { /* ignore */ }
      }
      originalStorage = undefined;
    });

    it('reports usagePct at 70% from estimate()', async () => {
      stubNavigatorStorage({
        estimate: () => Promise.resolve({ usage: 70, quota: 100 }),
      });
      await firstValueFrom(service.initialize());

      const info = await firstValueFrom(service.getStorageInfo());

      expect(info.usagePct).toBeCloseTo(70, 6);
    });

    it('reports usagePct at 95% from estimate()', async () => {
      stubNavigatorStorage({
        estimate: () => Promise.resolve({ usage: 950, quota: 1000 }),
      });
      await firstValueFrom(service.initialize());

      const info = await firstValueFrom(service.getStorageInfo());

      expect(info.usagePct).toBeCloseTo(95, 6);
    });

    it('leaves usagePct undefined when navigator.storage.estimate is unavailable (old browsers)', async () => {
      // navigator.storage present but with no estimate fn → graceful null.
      stubNavigatorStorage({});
      await firstValueFrom(service.initialize());

      const info = await firstValueFrom(service.getStorageInfo());

      expect(info.usagePct).toBeUndefined();
      // Byte-count fallback fields still populated.
      expect(info.usedBytes).toBeGreaterThan(0);
      expect(info.percentUsed).toBeGreaterThanOrEqual(0);
    });

    it('leaves usagePct undefined when reported quota is 0', async () => {
      stubNavigatorStorage({
        estimate: () => Promise.resolve({ usage: 0, quota: 0 }),
      });
      await firstValueFrom(service.initialize());

      const info = await firstValueFrom(service.getStorageInfo());

      expect(info.usagePct).toBeUndefined();
    });
  });

  describe('saveData — cross-browser quota-error matching (QUAL-02, D-14)', () => {
    async function expectQuotaError(thrown: unknown): Promise<void> {
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      // Make persistToStorage's setItem throw the engine-specific error. The
      // initialize() call above already succeeded; only the saveData write
      // throws (the isLocalStorageAvailable probe also uses setItem, but that
      // ran during initialize before this re-stub).
      (localStorage.setItem as jasmine.Spy).and.callFake(() => { throw thrown; });

      try {
        await firstValueFrom(service.saveData(data!));
        fail('Should have thrown a StorageError');
      } catch (e) {
        expect(e instanceof StorageError).toBe(true);
        expect((e as StorageError).code).toBe('QUOTA_EXCEEDED');
      }
    }

    it('maps a QuotaExceededError DOMException (Chrome/Safari/spec) to QUOTA_EXCEEDED', async () => {
      await expectQuotaError(new DOMException('quota', 'QuotaExceededError'));
    });

    it('maps a Firefox NS_ERROR_DOM_QUOTA_REACHED DOMException to QUOTA_EXCEEDED', async () => {
      await expectQuotaError(new DOMException('quota', 'NS_ERROR_DOM_QUOTA_REACHED'));
    });

    it('maps a legacy numeric code-22 DOMException to QUOTA_EXCEEDED', async () => {
      // Older engines set the numeric `code` (22) but an unrecognized `name`.
      // Build a real DOMException instance and pin code=22 to exercise the
      // numeric-fallback branch of isQuotaError.
      const ex = new DOMException('quota', 'SomeLegacyName');
      Object.defineProperty(ex, 'code', { configurable: true, value: 22 });
      await expectQuotaError(ex);
    });

    it('maps a NON-quota error to SERIALIZATION_ERROR, not QUOTA_EXCEEDED', async () => {
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());
      (localStorage.setItem as jasmine.Spy).and.callFake(() => { throw new Error('disk on fire'); });

      try {
        await firstValueFrom(service.saveData(data!));
        fail('Should have thrown a StorageError');
      } catch (e) {
        expect(e instanceof StorageError).toBe(true);
        expect((e as StorageError).code).toBe('SERIALIZATION_ERROR');
      }
    });
  });

  describe('getLastModified (QUAL-04)', () => {
    it('returns the stored lastModified after a save', async () => {
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());
      await firstValueFrom(service.saveData(data!));

      const stored = JSON.parse(localStorageMock[STORAGE_KEY]).lastModified;
      expect(service.getLastModified()).toBe(stored);
      expect(typeof service.getLastModified()).toBe('string');
    });

    it('returns the value from loaded existing data', async () => {
      const existingData: AppData = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        chatConversations: [],
        memoryFiles: {},
        userProfile: { ...DEFAULT_USER_PROFILE },
        aiToolSettings: { ...DEFAULT_AI_TOOL_SETTINGS },
        lastModified: '2025-06-01T09:00:00.000Z'
      };
      localStorageMock[STORAGE_KEY] = JSON.stringify(existingData);

      await firstValueFrom(service.initialize());

      expect(service.getLastModified()).toBe('2025-06-01T09:00:00.000Z');
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
      // V5 defaults — full chain V0→V5 ends with defaulted memory/profile/tool fields.
      expect(data?.memoryFiles).toEqual({});
      expect(data?.userProfile).toEqual(DEFAULT_USER_PROFILE);
      expect(data?.aiToolSettings).toEqual(DEFAULT_AI_TOOL_SETTINGS);
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

    it('should migrate v1 data to current schema by adding diet + V5 defaults', async () => {
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
      // V5 defaults reached through the full V1→V5 chain.
      expect(data?.memoryFiles).toEqual({});
      expect(data?.userProfile).toEqual(DEFAULT_USER_PROFILE);
      expect(data?.aiToolSettings).toEqual(DEFAULT_AI_TOOL_SETTINGS);
    });

    it('should migrate v3 data to current schema by adding chat + V5 defaults', async () => {
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
      // V3→V4 introduces chatConversations.
      expect(data?.chatConversations).toEqual([]);
      // CLAUDE.md "no null for absent optional fields" — aiSettings stays undefined.
      expect(data?.aiSettings).toBeUndefined();
      // V5 defaults reached through the full V3→V5 chain.
      expect(data?.memoryFiles).toEqual({});
      expect(data?.userProfile).toEqual(DEFAULT_USER_PROFILE);
      expect(data?.aiToolSettings).toEqual(DEFAULT_AI_TOOL_SETTINGS);
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
        memoryFiles: {},
        userProfile: { ...DEFAULT_USER_PROFILE },
        aiToolSettings: { ...DEFAULT_AI_TOOL_SETTINGS },
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

  describe('getBackup', () => {
    it('returns the stored value when the key exists', () => {
      const key = 'fitness_tracker_data.backup.v3.2026-05-02T14-30-12-123Z';
      const payload = '{"schemaVersion":3,"data":{}}';
      // Seed the mock directly — getItem is spied via callFake at top of file.
      localStorageMock[key] = payload;
      expect(service.getBackup(key)).toBe(payload);
    });

    it('returns null when the key is absent', () => {
      expect(service.getBackup('absent_key')).toBeNull();
    });

    it('returns null (does not throw) when underlying localStorage.getItem throws', () => {
      // The outer beforeEach already spied getItem with callFake. Replace the
      // call-fake with a throw to simulate SecurityError / private-browsing.
      (localStorage.getItem as jasmine.Spy).and.throwError(new Error('SecurityError'));
      expect(service.getBackup('any_key')).toBeNull();
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

  describe('dev-seed sentinel (D-12)', () => {
    const DEV_SEED_KEY = 'dev_seed_pending';

    afterEach(() => {
      delete localStorageMock[DEV_SEED_KEY];
    });

    it('setDevSeed("memory") writes a JSON sentinel under dev_seed_pending key', () => {
      service.setDevSeed('memory');

      const raw = localStorageMock[DEV_SEED_KEY];
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw);
      expect(parsed.kind).toBe('memory');
      expect(typeof parsed.at).toBe('string');
      expect(new Date(parsed.at).getTime()).not.toBeNaN();
    });

    it('setDevSeed("profile") writes a sentinel with kind: "profile"', () => {
      service.setDevSeed('profile');

      const parsed = JSON.parse(localStorageMock[DEV_SEED_KEY]);
      expect(parsed.kind).toBe('profile');
    });

    it('consumeDevSeed returns parsed sentinel AND removes the key (idempotent on second call)', () => {
      service.setDevSeed('memory');

      const first = service.consumeDevSeed();
      expect(first?.kind).toBe('memory');
      expect(typeof first?.at).toBe('string');
      expect(localStorageMock[DEV_SEED_KEY]).toBeUndefined();

      // Second call returns null — sentinel was consumed.
      const second = service.consumeDevSeed();
      expect(second).toBeNull();
    });

    it('consumeDevSeed on empty LocalStorage returns null without throwing', () => {
      expect(() => service.consumeDevSeed()).not.toThrow();
      expect(service.consumeDevSeed()).toBeNull();
    });

    it('consumeDevSeed on malformed JSON returns null AND removes the corrupted key', () => {
      localStorageMock[DEV_SEED_KEY] = 'not-json{{';

      const result = service.consumeDevSeed();
      expect(result).toBeNull();
      // Best-effort removal so we don't loop on a bad value.
      expect(localStorageMock[DEV_SEED_KEY]).toBeUndefined();
    });

    it('setDevSeed swallows storage-quota errors gracefully', () => {
      // Replace the existing setItem call-fake with a thrower.
      (localStorage.setItem as jasmine.Spy).and.throwError('QuotaExceededError');
      expect(() => service.setDevSeed('memory')).not.toThrow();
    });

    it('consumeDevSeed rejects sentinel with unexpected kind value', () => {
      localStorageMock[DEV_SEED_KEY] = JSON.stringify({ kind: 'arbitrary', at: '2026-05-03T00:00:00Z' });

      const result = service.consumeDevSeed();
      expect(result).toBeNull();
    });
  });
});
