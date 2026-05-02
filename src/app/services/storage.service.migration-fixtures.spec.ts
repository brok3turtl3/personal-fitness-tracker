/**
 * Fixture-driven migration spec (D-17, RESEARCH §Pattern 7).
 *
 * Loads each `vN.json` fixture (created in plan 04), runs the migration chain
 * via `StorageService.initialize()`, and asserts the result reaches
 * CURRENT_SCHEMA_VERSION. The malformed-input matrix iterates the 4 malformed
 * fixtures and asserts each either initializes cleanly with defaults OR
 * throws a typed `StorageError('MIGRATION_FAILED')` — never silently
 * corrupts user data.
 *
 * Mock pattern mirrors `storage.service.spec.ts:6-29` (in-memory localStorage)
 * but extends it with `Storage.prototype.length` + `key()` patches required
 * for `pruneOldBackups()` iteration.
 *
 * Fixture imports require `resolveJsonModule: true` in tsconfig.spec.json
 * (already enabled in plan 01).
 */
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { StorageService, StorageError } from './storage.service';
import { STORAGE_KEY, CURRENT_SCHEMA_VERSION } from '../models/app-data.model';

// Input fixtures (one per from-version).
import v0Fixture from './migrations/fixtures/v0.json';
import v1Fixture from './migrations/fixtures/v1.json';
import v2Fixture from './migrations/fixtures/v2.json';
import v3Fixture from './migrations/fixtures/v3.json';

// Malformed-input matrix (D-17).
import malformedNull from './migrations/fixtures/malformed/null.json';
import malformedEmpty from './migrations/fixtures/malformed/empty-object.json';
import malformedWrongTypes from './migrations/fixtures/malformed/wrong-types.json';
import malformedMissingFields from './migrations/fixtures/malformed/missing-fields.json';

const BACKUP_PREFIX = 'fitness_tracker_data.backup.';

describe('StorageService migrations (fixture-driven)', () => {
  let service: StorageService;
  let localStorageMock: { [key: string]: string };
  let originalLengthDesc: PropertyDescriptor | undefined;
  let originalKey: Storage['key'];

  beforeEach(() => {
    localStorageMock = {};

    spyOn(localStorage, 'getItem').and.callFake(
      (k: string) => localStorageMock[k] ?? null
    );
    spyOn(localStorage, 'setItem').and.callFake((k: string, v: string) => {
      localStorageMock[k] = v;
    });
    spyOn(localStorage, 'removeItem').and.callFake((k: string) => {
      delete localStorageMock[k];
    });

    // pruneOldBackups iterates via length + key(i); patch the prototype.
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

  describe('full chain V0..V3 → V4', () => {
    it('V0 input migrates to current schema version', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(v0Fixture);
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      // V0 cardio session preserved through chain.
      expect(data?.cardioSessions.length).toBe(1);
      expect(data?.cardioSessions[0].id).toBe('cardio-1');
      // V1+ containers default to [].
      expect(data?.savedFoods).toEqual([]);
      expect(data?.mealEntries).toEqual([]);
      expect(data?.chatConversations).toEqual([]);
    });

    it('V1 input migrates to current schema version', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(v1Fixture);
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(data?.weightEntries.length).toBe(1);
      expect(data?.weightEntries[0].weightLbs).toBe(180);
      expect(data?.savedFoods).toEqual([]);
      expect(data?.mealEntries).toEqual([]);
      expect(data?.chatConversations).toEqual([]);
    });

    it('V2 input migrates savedFoods through V2→V3 transformation', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(v2Fixture);
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      // Partial-match against v3-expected: count, id, name (V2→V3 also
      // produces baseUnit/nutrientsPerUnit whose exact numerics depend on
      // the implementation; spec does not assert their values here).
      expect(data?.savedFoods.length).toBe(1);
      expect(data?.savedFoods[0].id).toBe('food-egg');
      expect(data?.savedFoods[0].name).toBe('Egg, large');
      // V3 shape invariants:
      expect(data?.savedFoods[0].baseUnit).toBe('g');
      expect(data?.savedFoods[0].nutrientsPerUnit).toBeTruthy();
      // 155 kcal per 100 g → 1.55 kcal per 1 g
      expect(data?.savedFoods[0].nutrientsPerUnit.caloriesKcal).toBeCloseTo(1.55, 6);
      // V4 chat container defaulted.
      expect(data?.chatConversations).toEqual([]);
    });

    it('V3 input migrates to V4 with chatConversations defaulted to []', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(v3Fixture);
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(data?.chatConversations).toEqual([]);
      // CLAUDE.md "no null for absent optional fields" — aiSettings stays
      // undefined, NOT null.
      expect(data?.aiSettings).toBeUndefined();
      // V3 health reading preserved.
      expect(data?.healthReadings.length).toBe(1);
      expect(data?.healthReadings[0].id).toBe('reading-1');
    });

    it('V0 input writes a backup key with the BACKUP_KEY_PREFIX', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(v0Fixture);
      await firstValueFrom(service.initialize());

      const backupKeys = Object.keys(localStorageMock).filter(
        k => k.startsWith(BACKUP_PREFIX)
      );
      expect(backupKeys.length).toBe(1);
      // V0 has no schemaVersion, so backup key encodes v0.
      expect(backupKeys[0]).toMatch(
        /^fitness_tracker_data\.backup\.v0\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/
      );
    });
  });

  describe('malformed-input matrix (D-17)', () => {
    const malformed: Array<[string, unknown]> = [
      ['null', malformedNull],
      ['empty object', malformedEmpty],
      ['wrong-type savedFoods', malformedWrongTypes],
      ['missing required fields', malformedMissingFields],
    ];

    for (const [name, payload] of malformed) {
      it(`tolerates ${name} without silent corruption`, async () => {
        localStorageMock[STORAGE_KEY] = JSON.stringify(payload);

        // D-17: either initialize cleanly with defaults OR throw a typed
        // StorageError — never silently corrupt user data.
        let didThrow = false;
        let thrown: unknown;
        try {
          await firstValueFrom(service.initialize());
        } catch (e) {
          didThrow = true;
          thrown = e;
        }

        if (didThrow) {
          // Failure path: must be a typed MIGRATION_FAILED, AND the backup
          // key must exist on disk so the user can recover.
          expect(thrown instanceof StorageError).toBe(true);
          expect((thrown as StorageError).code).toBe('MIGRATION_FAILED');
          const backups = Object.keys(localStorageMock).filter(
            k => k.startsWith(BACKUP_PREFIX)
          );
          expect(backups.length).toBeGreaterThan(0);
        } else {
          // Success path: cachedData must reach CURRENT_SCHEMA_VERSION (no
          // partially-migrated state, no silent stash of malformed input).
          const data = await firstValueFrom(service.getData());
          expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        }
      });
    }
  });
});
