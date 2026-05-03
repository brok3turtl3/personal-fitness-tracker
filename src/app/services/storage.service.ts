import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  AppData,
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  createEmptyAppData
} from '../models/app-data.model';
import { SavedFood } from '../models/diet.model';
import { DEFAULT_AI_TOOL_SETTINGS } from '../models/ai-chat.model';
import { DEFAULT_USER_PROFILE } from '../models/user-profile.model';
import {
  LegacyAppDataV0,
  LegacyAppDataV1,
  LegacyAppDataV2,
  LegacyAppDataV3,
  LegacyAppDataV4,
  LegacySavedFoodV2,
} from './legacy-schemas';

/**
 * Storage usage information.
 */
export interface StorageInfo {
  usedBytes: number;
  availableBytes: number;
  percentUsed: number;
}

/**
 * Error codes for storage operations.
 */
export type StorageErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'PARSE_ERROR'
  | 'SERIALIZATION_ERROR'
  | 'NOT_AVAILABLE'
  | 'MIGRATION_FAILED';

/**
 * Custom error class for storage operations.
 */
export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public override readonly cause?: Error;

  constructor(
    message: string,
    code: StorageErrorCode,
    cause?: Error
  ) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Service for persisting application data to LocalStorage.
 * Provides an abstraction layer to enable future migration to
 * IndexedDB, backend API, or cloud storage.
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {
  /**
   * LocalStorage key prefix for pre-migration backups (D-14).
   * Format: `fitness_tracker_data.backup.v{N}.{ISO-timestamp}`. The trailing
   * dot is significant — pruneOldBackups() filters strictly on this prefix
   * so it can never delete the active STORAGE_KEY (security: T-09-02).
   */
  private static readonly BACKUP_KEY_PREFIX = 'fitness_tracker_data.backup.';

  /**
   * Maximum number of pre-migration backups to keep. Older backups are
   * pruned during initialize() to stay under the 5 MB quota (D-14, Pitfall 4).
   */
  private static readonly MAX_BACKUPS_TO_KEEP = 3;

  private initialized = false;
  private cachedData: AppData | null = null;

  /**
   * Initialize storage and run migrations if needed.
   * Must be called before other operations.
   *
   * Migration flow (D-14, D-15, RESEARCH §Pattern 5):
   *   1. Parse stored JSON.
   *   2. Read fromVersion (defaults to 0 if missing).
   *   3. If fromVersion < CURRENT: prune old backups, write new backup,
   *      then run migrate chain inside a try/catch.
   *   4. On migration failure: throw StorageError(MIGRATION_FAILED) carrying
   *      the recovery backup key in the message. Plan 10's recovery banner
   *      reads this error.
   */
  initialize(): Observable<void> {
    if (this.initialized) {
      return of(undefined);
    }

    try {
      if (!this.isLocalStorageAvailable()) {
        return throwError(() => new StorageError(
          'LocalStorage is not available',
          'NOT_AVAILABLE'
        ));
      }

      const rawData = localStorage.getItem(STORAGE_KEY);

      if (rawData === null) {
        // First run - create empty data
        this.cachedData = createEmptyAppData();
        this.persistToStorage(this.cachedData);
      } else {
        // Parse existing data
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawData);
        } catch (e) {
          return throwError(() => new StorageError(
            'Failed to parse stored data',
            'PARSE_ERROR',
            e instanceof Error ? e : undefined
          ));
        }

        const fromVersion = (parsed as { schemaVersion?: number } | null)?.schemaVersion ?? 0;

        if (fromVersion < CURRENT_SCHEMA_VERSION) {
          // D-14: write a backup snapshot BEFORE the migration runs.
          // Pitfall 4: prune older backups first so the new write has room.
          this.pruneOldBackups();
          const backupKey = this.writeBackup(rawData, fromVersion);

          try {
            this.cachedData = this.migrateData(parsed);
            this.persistToStorage(this.cachedData);
          } catch (e) {
            return throwError(() => new StorageError(
              `Migration failed (v${fromVersion} → v${CURRENT_SCHEMA_VERSION}). Backup at ${backupKey}.`,
              'MIGRATION_FAILED',
              e instanceof Error ? e : undefined,
            ));
          }
        } else {
          this.cachedData = parsed as AppData;
        }
      }

      this.initialized = true;
      return of(undefined);
    } catch (e) {
      return throwError(() => new StorageError(
        'Failed to initialize storage',
        'NOT_AVAILABLE',
        e instanceof Error ? e : undefined
      ));
    }
  }

  /**
   * Write a pre-migration backup of the raw stored JSON to a timestamped
   * key under BACKUP_KEY_PREFIX. Best-effort (Pitfall 4): if the backup
   * write itself overflows quota we swallow the error and continue — failing
   * the migration because the backup couldn't be written would lose data.
   * Returns the backup key (used in MIGRATION_FAILED error message for
   * downstream recovery UI in plan 10).
   */
  private writeBackup(rawData: string, fromVersion: number): string {
    const ts = new Date().toISOString().replace(/:/g, '-');
    const key = `${StorageService.BACKUP_KEY_PREFIX}v${fromVersion}.${ts}`;
    try {
      localStorage.setItem(key, rawData);
    } catch {
      /* swallow — best-effort backup, see Pitfall 4 */
    }
    return key;
  }

  /**
   * Reads a previously written backup payload from LocalStorage.
   *
   * This is the ONLY sanctioned path for callers outside StorageService to
   * obtain backup JSON (e.g., AppComponent feeding the recovery banner in
   * plan 10). Per CLAUDE.md "Storage chokepoint" rule, components MUST NOT
   * call `localStorage.*` directly — they go through this method instead.
   *
   * Returns null if the key is absent OR if the underlying read throws
   * (e.g., LocalStorage disabled, SecurityError in private browsing).
   * Never throws — failure is signalled by `null`.
   *
   * Synchronous (not Observable) by design: it's called inside the
   * recovery-banner construction path in AppComponent's error handler,
   * where async would force the banner to render with an empty payload
   * and only fill it on a later tick.
   */
  getBackup(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /**
   * Prune backup keys, keeping only the most recent MAX_BACKUPS_TO_KEEP.
   *
   * Security gate (T-09-02): filters STRICTLY on BACKUP_KEY_PREFIX so it
   * can never delete STORAGE_KEY itself or any unrelated key. The trailing
   * dot in the prefix is what makes this safe — `fitness_tracker_data` (the
   * live key) does NOT start with `fitness_tracker_data.backup.`.
   */
  private pruneOldBackups(): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(StorageService.BACKUP_KEY_PREFIX)) {
        keys.push(k);
      }
    }
    // Lexicographic sort works because the timestamp suffix is fixed-width
    // ISO-8601. Reverse so newest is first; slice off the head we want to
    // keep, leaving older keys to remove.
    keys.sort().reverse();
    for (const k of keys.slice(StorageService.MAX_BACKUPS_TO_KEEP)) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore — best-effort prune */
      }
    }
  }

  /**
   * Get the current application data.
   */
  getData(): Observable<AppData | null> {
    if (!this.initialized) {
      return throwError(() => new StorageError(
        'Storage not initialized. Call initialize() first.',
        'NOT_AVAILABLE'
      ));
    }
    return of(this.cachedData);
  }

  /**
   * Save the entire application data.
   */
  saveData(data: AppData): Observable<void> {
    if (!this.initialized) {
      return throwError(() => new StorageError(
        'Storage not initialized. Call initialize() first.',
        'NOT_AVAILABLE'
      ));
    }

    try {
      // Update lastModified timestamp
      const dataToSave: AppData = {
        ...data,
        lastModified: new Date().toISOString()
      };
      
      this.persistToStorage(dataToSave);
      this.cachedData = dataToSave;
      return of(undefined);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        return throwError(() => new StorageError(
          'Storage quota exceeded',
          'QUOTA_EXCEEDED',
          e
        ));
      }
      return throwError(() => new StorageError(
        'Failed to save data',
        'SERIALIZATION_ERROR',
        e instanceof Error ? e : undefined
      ));
    }
  }

  /**
   * Clear all stored data.
   */
  clearData(): Observable<void> {
    try {
      localStorage.removeItem(STORAGE_KEY);
      this.cachedData = createEmptyAppData();
      this.persistToStorage(this.cachedData);
      return of(undefined);
    } catch (e) {
      return throwError(() => new StorageError(
        'Failed to clear data',
        'NOT_AVAILABLE',
        e instanceof Error ? e : undefined
      ));
    }
  }

  /**
   * Get storage usage information.
   */
  getStorageInfo(): Observable<StorageInfo> {
    try {
      const dataString = localStorage.getItem(STORAGE_KEY) || '';
      const usedBytes = new Blob([dataString]).size;
      
      // Estimate available storage (5MB typical limit)
      const estimatedTotal = 5 * 1024 * 1024; // 5MB
      const availableBytes = Math.max(0, estimatedTotal - usedBytes);
      const percentUsed = (usedBytes / estimatedTotal) * 100;

      return of({
        usedBytes,
        availableBytes,
        percentUsed
      });
    } catch (e) {
      return throwError(() => new StorageError(
        'Failed to get storage info',
        'NOT_AVAILABLE',
        e instanceof Error ? e : undefined
      ));
    }
  }

  /**
   * Check if LocalStorage is available.
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Persist data to LocalStorage.
   */
  private persistToStorage(data: AppData): void {
    const jsonString = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, jsonString);
  }

  /**
   * Migrate data from older schema versions.
   *
   * Typed chain (D-16, RESEARCH §Pattern 6): each hop accepts and returns the
   * concrete `LegacyAppDataVN` shape. Strict TS now catches typos in legacy
   * field names — replaces the prior unsafe casts at lines 296/298/306.
   */
  private migrateData(data: unknown): AppData {
    const fromVersion = (data as { schemaVersion?: number }).schemaVersion ?? 0;

    const v1: LegacyAppDataV1 = (fromVersion < 1)
      ? this.migrateV0ToV1(data as LegacyAppDataV0)
      : (data as LegacyAppDataV1);

    const v2: LegacyAppDataV2 = (fromVersion < 2)
      ? this.migrateV1ToV2(v1)
      : (data as LegacyAppDataV2);

    const v3: LegacyAppDataV3 = (fromVersion < 3)
      ? this.migrateV2ToV3(v2)
      : (data as LegacyAppDataV3);

    const v4: LegacyAppDataV4 = (fromVersion < 4)
      ? this.migrateV3ToV4(v3)
      : (data as LegacyAppDataV4);

    const v5: AppData = (fromVersion < 5)
      ? this.migrateV4ToV5(v4)
      : (data as AppData);

    return v5;
  }

  /**
   * Migration from version 0 (no version) to version 1.
   * Defaults missing optional arrays/timestamp.
   */
  private migrateV0ToV1(data: LegacyAppDataV0): LegacyAppDataV1 {
    return {
      schemaVersion: 1,
      cardioSessions: data.cardioSessions ?? [],
      weightEntries: data.weightEntries ?? [],
      healthReadings: data.healthReadings ?? [],
      lastModified: data.lastModified ?? new Date().toISOString()
    };
  }

  /**
   * Migration from version 1 to version 2.
   * Adds diet containers (savedFoods, mealEntries).
   */
  private migrateV1ToV2(data: LegacyAppDataV1): LegacyAppDataV2 {
    return {
      schemaVersion: 2,
      cardioSessions: data.cardioSessions,
      weightEntries: data.weightEntries,
      healthReadings: data.healthReadings,
      savedFoods: [],
      mealEntries: [],
      lastModified: data.lastModified
    };
  }

  /**
   * Migration from version 2 to version 3.
   * Converts saved foods from nutrients-per-100g to nutrients-per-1g (baseUnit: 'g')
   * and converts servings from {grams} to {unit:'g', amount}.
   */
  private migrateV2ToV3(data: LegacyAppDataV2): LegacyAppDataV3 {
    const savedFoods = Array.isArray(data.savedFoods) ? data.savedFoods : [];
    const migratedFoods: SavedFood[] = savedFoods.map(
      (f: LegacySavedFoodV2) => migrateSavedFoodV2ToV3(f)
    );

    // Meals already store snapshots; we leave them unchanged. mealEntries is
    // typed `unknown[]` in V2 because meals existed but their pre-V3 shape was
    // already snapshot-based; the V3 type narrows them to `MealEntry[]`.
    return {
      schemaVersion: 3,
      cardioSessions: data.cardioSessions,
      weightEntries: data.weightEntries,
      healthReadings: data.healthReadings,
      savedFoods: migratedFoods,
      mealEntries: (Array.isArray(data.mealEntries) ? data.mealEntries : []) as LegacyAppDataV3['mealEntries'],
      lastModified: data.lastModified
    };
  }

  /**
   * Migration from version 3 to version 4.
   * Adds AI chat fields (chatConversations defaults to []; aiSettings stays
   * undefined per CLAUDE.md "no null for absent optional fields").
   *
   * Returns the legacy V4 shape (NOT current AppData) so the chain can hand
   * it off to migrateV4ToV5. V5-only fields (memoryFiles, userProfile,
   * aiToolSettings) are NOT introduced here — that's V4→V5's job.
   */
  private migrateV3ToV4(data: LegacyAppDataV3): LegacyAppDataV4 {
    return {
      schemaVersion: 4,
      cardioSessions: data.cardioSessions,
      weightEntries: data.weightEntries,
      healthReadings: data.healthReadings,
      savedFoods: data.savedFoods,
      mealEntries: data.mealEntries,
      chatConversations: [],
      lastModified: data.lastModified
    };
  }

  /**
   * Migration from version 4 to version 5 (D-15, FOUND-07 + T-3-DM).
   *
   * Lifts each ChatMessage's `content: string` into a single text block
   * (`blocks: [{ type: 'text', text: msg.content ?? '' }]`) and removes the
   * `content` field. Adds three V5-only fields with defaults: `memoryFiles`,
   * `userProfile`, `aiToolSettings`.
   *
   * Defensive guard per CONTEXT.md "Specific Ideas": `msg.content ?? ''` so
   * legacy messages with null/undefined content are lifted to an empty text
   * block rather than dropped or thrown on. Order: build new ChatMessage
   * literal with `blocks` → never mutate the legacy object in place.
   */
  private migrateV4ToV5(data: LegacyAppDataV4): AppData {
    const migratedConversations = data.chatConversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      messages: conv.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        // Build new blocks array from legacy content. Defensive guard
        // (CONTEXT.md "Specific Ideas" + T-3-CI): coerce to a string so
        // null/undefined/non-string content can never produce a malformed
        // TextBlock at runtime. Empty/falsy stays empty; 0/false/etc. would
        // be unusual but coerce to their string form rather than be dropped.
        blocks: [{ type: 'text' as const, text: typeof msg.content === 'string' ? msg.content : (msg.content == null ? '' : String(msg.content)) }],
        // Defensive coerce for malformed-V4 inputs (T-3-CI): missing or
        // wrong-type tokenEstimate becomes 0 rather than producing a NaN
        // anywhere downstream.
        tokenEstimate: typeof msg.tokenEstimate === 'number' ? msg.tokenEstimate : 0,
        createdAt: msg.createdAt,
      })),
      summary: conv.summary,
      summarizedMessageCount: conv.summarizedMessageCount,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));

    return {
      schemaVersion: 5,
      cardioSessions: data.cardioSessions,
      weightEntries: data.weightEntries,
      healthReadings: data.healthReadings,
      savedFoods: data.savedFoods,
      mealEntries: data.mealEntries,
      aiSettings: data.aiSettings,
      chatConversations: migratedConversations,
      memoryFiles: {},
      userProfile: { ...DEFAULT_USER_PROFILE },
      aiToolSettings: { ...DEFAULT_AI_TOOL_SETTINGS },
      lastModified: data.lastModified,
    };
  }
}

/**
 * V2 → V3 saved-food shape migration.
 * Reads the typed `LegacySavedFoodV2` (replaces the previous unsafe cast).
 */
function migrateSavedFoodV2ToV3(food: LegacySavedFoodV2): SavedFood {
  const per100g = food.nutrientsPer100g;

  const nutrientsPerUnit = per100g
    ? {
        caloriesKcal: safeNumber(per100g.caloriesKcal) / 100,
        proteinG: safeNumber(per100g.proteinG) / 100,
        fatG: safeNumber(per100g.fatG) / 100,
        carbsG: safeNumber(per100g.carbsG) / 100,
        fiberG: safeNumber(per100g.fiberG) / 100,
        sugarG: safeNumber(per100g.sugarG) / 100,
        sodiumMg: safeNumber(per100g.sodiumMg) / 100,
        netCarbsG: Math.max(0, (safeNumber(per100g.carbsG) - safeNumber(per100g.fiberG)) / 100)
      }
    : {
        caloriesKcal: 0,
        proteinG: 0,
        fatG: 0,
        carbsG: 0,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0,
        netCarbsG: 0
      };

  const servings = Array.isArray(food.servings)
    ? food.servings.map((s) => ({
        id: s.id,
        label: s.label,
        unit: 'g' as const,
        amount: safeNumber(s.grams)
      }))
    : [{ id: 'default', label: '100 g', unit: 'g' as const, amount: 100 }];

  // Preserve fdcId as a runtime extra (not part of the SavedFood type but
  // present on some legacy V2 entries). Spread-from-source keeps that field
  // intact without re-introducing an unsafe cast.
  const base: SavedFood = {
    id: food.id,
    name: food.name,
    baseUnit: 'g',
    nutrientsPerUnit,
    servings,
    createdAt: food.createdAt,
    updatedAt: food.updatedAt
  };
  return food.fdcId !== undefined
    ? { ...base, fdcId: food.fdcId } as SavedFood
    : base;
}

function safeNumber(n: unknown): number {
  return Number.isFinite(n as number) ? (n as number) : 0;
}
