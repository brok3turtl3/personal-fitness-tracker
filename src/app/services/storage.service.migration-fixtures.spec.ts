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
import { DEFAULT_AI_TOOL_SETTINGS, TextBlock } from '../models/ai-chat.model';
import { DEFAULT_USER_PROFILE } from '../models/user-profile.model';

// Input fixtures (one per from-version).
import v0Fixture from './migrations/fixtures/v0.json';
import v1Fixture from './migrations/fixtures/v1.json';
import v2Fixture from './migrations/fixtures/v2.json';
import v3Fixture from './migrations/fixtures/v3.json';
import v4Fixture from './migrations/fixtures/v4.json';
import v5ExpectedFixture from './migrations/fixtures/v5-expected.json';

// Malformed-input matrix (D-17).
import malformedNull from './migrations/fixtures/malformed/null.json';
import malformedEmpty from './migrations/fixtures/malformed/empty-object.json';
import malformedWrongTypes from './migrations/fixtures/malformed/wrong-types.json';
import malformedMissingFields from './migrations/fixtures/malformed/missing-fields.json';

// V4 malformed matrix (Phase 3 V4→V5 — T-3-DM, T-3-CI mitigations).
import malformedV4MissingChat from './migrations/fixtures/malformed/v4-missing-chat-conversations.json';
import malformedV4WrongTypeContent from './migrations/fixtures/malformed/v4-wrong-type-content.json';
import malformedV4NullContent from './migrations/fixtures/malformed/v4-null-content.json';
import malformedV4MissingTokenEstimate from './migrations/fixtures/malformed/v4-missing-token-estimate.json';

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
      // V5 defaults reach end of chain (FOUND-07 regression-locked).
      expect(data?.memoryFiles).toEqual({});
      expect(data?.userProfile).toEqual(DEFAULT_USER_PROFILE);
      expect(data?.aiToolSettings).toEqual(DEFAULT_AI_TOOL_SETTINGS);
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
      // V5 defaults reach end of chain.
      expect(data?.memoryFiles).toEqual({});
      expect(data?.userProfile).toEqual(DEFAULT_USER_PROFILE);
      expect(data?.aiToolSettings).toEqual(DEFAULT_AI_TOOL_SETTINGS);
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
      // V5 defaults reach end of chain.
      expect(data?.memoryFiles).toEqual({});
      expect(data?.userProfile).toEqual(DEFAULT_USER_PROFILE);
      expect(data?.aiToolSettings).toEqual(DEFAULT_AI_TOOL_SETTINGS);
    });

    it('V3 input migrates to current schema with chat + V5 defaults', async () => {
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
      // V5 defaults reach end of chain.
      expect(data?.memoryFiles).toEqual({});
      expect(data?.userProfile).toEqual(DEFAULT_USER_PROFILE);
      expect(data?.aiToolSettings).toEqual(DEFAULT_AI_TOOL_SETTINGS);
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

  describe('V4 → V5 migration (D-15, FOUND-07, T-3-DM, T-3-CI)', () => {
    it('happy-path V4 fixture migrates to V5-expected (deep equal modulo lastModified)', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(v4Fixture);
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      // Cardio + weight carried forward unchanged. Compare via JSON round-trip
      // to bypass the strict-TS narrowing on JSON-imported fixtures (the
      // imported type widens enums like CardioType to plain `string`).
      expect(JSON.parse(JSON.stringify(data?.cardioSessions))).toEqual(v5ExpectedFixture.cardioSessions);
      expect(JSON.parse(JSON.stringify(data?.weightEntries))).toEqual(v5ExpectedFixture.weightEntries);
      // Chat conversation lifted: blocks replace content. Compare structure.
      expect(data?.chatConversations.length).toBe(1);
      const conv = data!.chatConversations[0];
      expect(conv.id).toBe('conv1');
      expect(conv.messages.length).toBe(2);
      expect(conv.messages[0].blocks).toEqual([{ type: 'text', text: 'Hi' }]);
      expect(conv.messages[1].blocks).toEqual([
        { type: 'text', text: 'Hello! How can I help with your fitness today?' },
      ]);
      // V5-only fields: defaults applied.
      expect(data?.memoryFiles).toEqual({});
      expect(data?.userProfile).toEqual(DEFAULT_USER_PROFILE);
      expect(data?.aiToolSettings).toEqual(DEFAULT_AI_TOOL_SETTINGS);
      // V4 aiSettings carried forward.
      expect(data?.aiSettings?.apiKey).toBe('sk-ant-test');
    });

    it('V5 input is unchanged (idempotent migrateData on V5 shape)', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(v5ExpectedFixture);
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      // No fields drop, blocks survive intact.
      expect(data?.chatConversations[0].messages[0].blocks).toEqual([
        { type: 'text', text: 'Hi' },
      ]);
      expect(data?.memoryFiles).toEqual({});
      expect(data?.userProfile).toEqual(DEFAULT_USER_PROFILE);
      expect(data?.aiToolSettings).toEqual(DEFAULT_AI_TOOL_SETTINGS);
    });

    it('V4 with null message content migrates to empty text block (defensive guard)', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(malformedV4NullContent);
      // Defensive null guard: must not throw.
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      const msg = data!.chatConversations[0].messages[0];
      expect(msg.blocks.length).toBe(1);
      const block = msg.blocks[0] as TextBlock;
      expect(block.type).toBe('text');
      expect(block.text).toBe('');
    });

    it('malformed V4 missing chatConversations throws MIGRATION_FAILED with backup key', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(malformedV4MissingChat);

      try {
        await firstValueFrom(service.initialize());
        fail('Should have thrown an error');
      } catch (e) {
        expect(e instanceof StorageError).toBe(true);
        const err = e as StorageError;
        expect(err.code).toBe('MIGRATION_FAILED');
        // Recovery key must be in error message for plan 10 banner.
        expect(err.message).toContain(BACKUP_PREFIX);
        expect(err.message).toMatch(/Backup at fitness_tracker_data\.backup\.v4\./);
      }

      // Backup key must exist on disk for recovery.
      const backups = Object.keys(localStorageMock).filter(k => k.startsWith(BACKUP_PREFIX));
      expect(backups.length).toBeGreaterThan(0);
      expect(backups.some(k => /\.v4\./.test(k))).toBe(true);
    });

    it('malformed V4 with wrong-type content coerces to string (defensive)', async () => {
      // Per T-3-CI: the implementation coerces non-string content to string
      // form rather than producing a malformed TextBlock at runtime. Lock in
      // the actual outcome so the contract is explicit.
      localStorageMock[STORAGE_KEY] = JSON.stringify(malformedV4WrongTypeContent);
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      const block = data!.chatConversations[0].messages[0].blocks[0] as TextBlock;
      expect(block.type).toBe('text');
      // 123 (number) → '123' (string). NEVER a non-string block.text.
      expect(typeof block.text).toBe('string');
      expect(block.text).toBe('123');
    });

    it('malformed V4 missing tokenEstimate coerces to 0 (defensive)', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(malformedV4MissingTokenEstimate);
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      const msg = data!.chatConversations[0].messages[0];
      expect(msg.tokenEstimate).toBe(0);
      // Content 'Hello' lifted into a single text block.
      const block = msg.blocks[0] as TextBlock;
      expect(block.text).toBe('Hello');
    });
  });

  describe('V5 → V6 migration (Phase 5, RESEARCH A3, FOUND-07 backward compat)', () => {
    /**
     * A well-formed V5 AppData whose chat blocks are all text-only — NO
     * citations, NO server-tool variants (the pre-web-search shape). This is
     * exactly what an un-migrated V5 store looks like on disk; it MUST load
     * unchanged at V6 (additive union ⇒ no data transform).
     */
    function makeV5Store() {
      return {
        schemaVersion: 5,
        cardioSessions: [],
        weightEntries: [],
        healthReadings: [],
        savedFoods: [],
        mealEntries: [],
        aiSettings: { apiKey: 'sk-ant-v5', maxResponseTokens: 4096 },
        chatConversations: [
          {
            id: 'conv-v5',
            title: 'Pre-web-search chat',
            messages: [
              {
                id: 'm1',
                role: 'user',
                blocks: [{ type: 'text', text: 'What is progressive overload?' }],
                tokenEstimate: 5,
                createdAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'm2',
                role: 'assistant',
                blocks: [{ type: 'text', text: 'Gradually increasing demands over time.' }],
                tokenEstimate: 8,
                createdAt: '2026-01-01T00:00:01.000Z',
              },
            ],
            summarizedMessageCount: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:01.000Z',
          },
        ],
        memoryFiles: { '/memories/notes.md': 'prefers metric' },
        userProfile: DEFAULT_USER_PROFILE,
        aiToolSettings: DEFAULT_AI_TOOL_SETTINGS,
        lastModified: '2026-01-01T00:00:01.000Z',
      };
    }

    it('a V5 store with text-only chat blocks loads unchanged at the current version (blocks + memory + settings preserved)', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(makeV5Store());
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      // Chat blocks preserved verbatim — no citations injected, no blocks dropped.
      expect(data?.chatConversations.length).toBe(1);
      const conv = data!.chatConversations[0];
      expect(conv.id).toBe('conv-v5');
      expect(conv.messages.length).toBe(2);
      expect(conv.messages[0].blocks).toEqual([
        { type: 'text', text: 'What is progressive overload?' },
      ]);
      expect(conv.messages[1].blocks).toEqual([
        { type: 'text', text: 'Gradually increasing demands over time.' },
      ]);
      // No web-search citations were fabricated onto an un-grounded V5 text block.
      const firstBlock = conv.messages[0].blocks[0] as TextBlock;
      expect('citations' in firstBlock).toBeFalse();
      // V5-only slices carried through unchanged.
      expect(data?.memoryFiles).toEqual({ '/memories/notes.md': 'prefers metric' });
      expect(data?.aiSettings?.apiKey).toBe('sk-ant-v5');
      expect(data?.aiToolSettings).toEqual(DEFAULT_AI_TOOL_SETTINGS);
    });

    it('migrating a V5 store writes a pre-migration backup keyed v5 (FOUND-07)', async () => {
      localStorageMock[STORAGE_KEY] = JSON.stringify(makeV5Store());
      await firstValueFrom(service.initialize());

      const backupKeys = Object.keys(localStorageMock).filter(k =>
        k.startsWith(BACKUP_PREFIX),
      );
      expect(backupKeys.length).toBe(1);
      // Backup is keyed at the FROM-version (v5) so the user can recover the
      // pre-migration data if V6 ever proves bad.
      expect(backupKeys[0]).toMatch(
        /^fitness_tracker_data\.backup\.v5\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/,
      );
    });

    it('a V5 store with a MISSING top-level array coerces to [] (defensive, not thrown)', async () => {
      const malformed = makeV5Store() as Record<string, unknown>;
      delete malformed['mealEntries']; // V5 with a missing array
      localStorageMock[STORAGE_KEY] = JSON.stringify(malformed);

      // Defensive coercion: must not throw.
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(data?.mealEntries).toEqual([]);
      // Other fields still preserved.
      expect(data?.chatConversations.length).toBe(1);
    });

    it('a V6 store migrates up to the current version (V6 is no longer terminal after the Phase 2 V7 bump)', async () => {
      const v6 = makeV5Store() as Record<string, unknown>;
      v6['schemaVersion'] = 6;
      localStorageMock[STORAGE_KEY] = JSON.stringify(v6);
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(data?.chatConversations[0].messages[0].blocks).toEqual([
        { type: 'text', text: 'What is progressive overload?' },
      ]);
      // A V6 store is below-version ⇒ the V6→V7 hop runs and writes a backup
      // keyed at the FROM-version (v6). (Plan 02-02 owns the in-depth V6/V7
      // fixture coverage; this asserts the chain reaches V7 cleanly.)
      const backupKeys = Object.keys(localStorageMock).filter(k =>
        k.startsWith(BACKUP_PREFIX),
      );
      expect(backupKeys.length).toBe(1);
      expect(backupKeys[0]).toMatch(/\.backup\.v6\./);
    });

    it('a store already at the current version is idempotent (no re-transform, no backup)', async () => {
      const current = makeV5Store() as Record<string, unknown>;
      current['schemaVersion'] = CURRENT_SCHEMA_VERSION;
      localStorageMock[STORAGE_KEY] = JSON.stringify(current);
      await firstValueFrom(service.initialize());
      const data = await firstValueFrom(service.getData());

      expect(data?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(data?.chatConversations[0].messages[0].blocks).toEqual([
        { type: 'text', text: 'What is progressive overload?' },
      ]);
      // At-version skips migration ⇒ no backup written.
      const backupKeys = Object.keys(localStorageMock).filter(k =>
        k.startsWith(BACKUP_PREFIX),
      );
      expect(backupKeys.length).toBe(0);
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
