import { Injectable } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  AppData,
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  createEmptyAppData
} from '../models/app-data.model';
import { SavedFood } from '../models/diet.model';
import { ChatMessage, DEFAULT_AI_TOOL_SETTINGS } from '../models/ai-chat.model';
import { DEFAULT_USER_PROFILE } from '../models/user-profile.model';
import {
  LegacyAppDataV0,
  LegacyAppDataV1,
  LegacyAppDataV2,
  LegacyAppDataV3,
  LegacyAppDataV4,
  LegacyAppDataV5,
  LegacySavedFoodV2,
} from './legacy-schemas';

/**
 * Storage usage information.
 */
export interface StorageInfo {
  usedBytes: number;
  availableBytes: number;
  percentUsed: number;
  /**
   * Phase 5 (QUAL-02): the REAL origin-wide usage percentage from
   * `navigator.storage.estimate()` — the honest proactive quota signal the
   * app-level banners (05-07) key on for the ≥70% warn / ≥95% block
   * thresholds. `undefined` when the API is unavailable (old browsers); the
   * consumer falls back to the byte-count `percentUsed` display.
   *
   * Origin-wide caveat: `estimate()` reports usage/quota for ALL storage at
   * the origin (IndexedDB, caches, etc.), not LocalStorage alone, and the
   * quota is browser/disk-dependent (often far larger than 5 MB). This is the
   * honest proactive signal; the write-time `QUOTA_EXCEEDED` error match in
   * `saveData` (which fires on the ~5 MB LocalStorage cap) is the reactive
   * backstop.
   */
  usagePct?: number;
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

  /**
   * Legacy reference byte budget (~5 MB) used ONLY to populate the backward-
   * compatible `usedBytes`/`availableBytes`/`percentUsed` fields on
   * StorageInfo. It is NOT the quota source — the authoritative QUAL-02 quota
   * signal is `usagePct` from `navigator.storage.estimate()`. Expressed as
   * KiB × 1024 (the old inline three-factor 5-megabyte literal has been
   * removed) to make explicit that the hardcoded quota estimate is gone.
   */
  private static readonly REFERENCE_BYTE_BUDGET = 5120 * 1024;

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
      // Cross-browser quota-error matching (QUAL-02, D-14, RESEARCH §Pattern 4):
      // Chrome/Safari + spec use `QuotaExceededError`; Firefox uses
      // `NS_ERROR_DOM_QUOTA_REACHED`; older engines surface the legacy numeric
      // codes 22 / 1014. All map to the typed QUOTA_EXCEEDED StorageError the
      // app-level 95%-block banner (05-07) keys on. This write-time match is
      // the reactive backstop to the proactive estimate()-driven banner.
      if (StorageService.isQuotaError(e)) {
        return throwError(() => new StorageError(
          'Storage quota exceeded',
          'QUOTA_EXCEEDED',
          e instanceof Error ? e : undefined
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
   * Cross-browser LocalStorage quota-error matcher (QUAL-02, D-14,
   * RESEARCH §Pattern 4). A `setItem` overflow surfaces under different names
   * across engines:
   *   - `QuotaExceededError` — Chrome / Safari / WHATWG spec
   *   - `NS_ERROR_DOM_QUOTA_REACHED` — Firefox
   *   - numeric `code` 22 (spec) / 1014 (legacy Firefox) — older engines that
   *     set `code` but not the spec `name`
   * Anything that is not a DOMException matching one of these is NOT a quota
   * error (e.g. a JSON serialization failure) and falls through to
   * SERIALIZATION_ERROR.
   */
  private static isQuotaError(e: unknown): boolean {
    return (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 ||
        e.code === 1014)
    );
  }

  /**
   * Read the persisted `lastModified` ISO-8601 timestamp (QUAL-04). It is
   * written on every `saveData` (and carried through migrations) but was never
   * readable before Phase 5. The 05-07 multi-tab listener compares this against
   * the `lastModified` it parses from an incoming `storage` event to decide
   * whether to show the "data changed in another tab" banner (Pitfall 6: the
   * `storage` event never fires in the writing tab, so the comparison must be
   * against the value this tab last knew).
   *
   * Returns null when storage is uninitialized / the field is absent. Never
   * throws — failure is signalled by null.
   */
  getLastModified(): string | null {
    return this.cachedData?.lastModified ?? null;
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
   * Get storage usage information (QUAL-02).
   *
   * `usagePct` is the REAL origin-wide usage percentage from
   * `navigator.storage.estimate()` — the honest proactive signal the 05-07
   * banners key on for the ≥70% warn / ≥95% block thresholds. It replaces the
   * old hardcoded 5 MB guess. On browsers without `navigator.storage.estimate`
   * the estimate degrades to `null` and `usagePct` is left `undefined`; the
   * `usedBytes`/`availableBytes`/`percentUsed` byte-count fields are retained
   * for backward compatibility so the consumer can still render a fallback.
   *
   * Origin-wide caveat (RESEARCH §Pattern 4): `estimate()` reports usage/quota
   * across ALL origin storage, not LocalStorage alone, and the quota is
   * browser/disk-dependent. This is the correct honest proactive signal; the
   * write-time `QUOTA_EXCEEDED` match in `saveData` is the reactive backstop
   * for the LocalStorage-specific ~5 MB cap.
   *
   * Wrapped in an Observable to fit the existing return type even though the
   * estimate read is async.
   */
  getStorageInfo(): Observable<StorageInfo> {
    return from(
      (async (): Promise<StorageInfo> => {
        const dataString = localStorage.getItem(STORAGE_KEY) || '';
        const usedBytes = new Blob([dataString]).size;

        // Backward-compat byte-count fields (legacy ~5 MB reference). The
        // estimate()-driven usagePct below is the authoritative QUAL-02 signal.
        const referenceTotal = StorageService.REFERENCE_BYTE_BUDGET;
        const availableBytes = Math.max(0, referenceTotal - usedBytes);
        const percentUsed = (usedBytes / referenceTotal) * 100;

        const quota = await StorageService.readQuotaPct();

        return {
          usedBytes,
          availableBytes,
          percentUsed,
          ...(quota === null ? {} : { usagePct: quota }),
        };
      })(),
    ).pipe(
      catchError((e: unknown) =>
        throwError(() => new StorageError(
          'Failed to get storage info',
          'NOT_AVAILABLE',
          e instanceof Error ? e : undefined,
        )),
      ),
    );
  }

  /**
   * Read the origin-wide usage percentage via `navigator.storage.estimate()`
   * (QUAL-02, RESEARCH §Pattern 4). Returns `null` (graceful degradation) when
   * the API is unavailable (old browsers) or the reported quota is 0/unknown.
   */
  private static async readQuotaPct(): Promise<number | null> {
    if (!navigator.storage?.estimate) return null; // older browsers — graceful null
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return quota > 0 ? (usage / quota) * 100 : null;
  }

  // ========================================================================
  // Lazy per-conversation chat archival (QUAL-05, D-13 — Phase 5)
  // ------------------------------------------------------------------------
  // Pre-summary chat messages move OUT of the hot `AppData` conversation slice
  // into a per-conversation archive key so the active conversation stays small
  // (cap-pressure relief, D-13). Archival is a MOVE, not a delete — nothing is
  // lost. The chat archival affordance (05-08) loads these on demand. ALL
  // localStorage access stays inside StorageService (the chokepoint); ChatService
  // calls these methods, never localStorage directly. The pattern mirrors the
  // sanctioned writeBackup/getBackup/consumeDevSeed best-effort, never-throw shape.
  // ========================================================================

  /**
   * LocalStorage key prefix for lazy per-conversation chat archives (D-13).
   * Format: `fitness_tracker_archive_{conversationId}`. A SEPARATE key per
   * conversation, NOT under STORAGE_KEY — archived messages are not migrated
   * and never participate in the active-data load path.
   */
  private static readonly ARCHIVE_KEY_PREFIX = 'fitness_tracker_archive_';

  private static archiveKey(conversationId: string): string {
    return `${StorageService.ARCHIVE_KEY_PREFIX}${conversationId}`;
  }

  /**
   * Append pre-summary messages to a conversation's archive key (QUAL-05,
   * D-13). Reads the existing archived array (oldest-first), appends the new
   * messages, and writes it back. Best-effort: a quota/serialization failure
   * is swallowed (mirrors writeBackup — Pitfall 4) so a summarization can never
   * be wedged by a failed archive write. A no-op on an empty `messages` array.
   *
   * Order semantics: archives accumulate in chronological summarization order
   * (each summarization appends the next-oldest batch), so a later on-demand
   * load returns the full pre-summary history oldest-first.
   */
  archiveMessages(conversationId: string, messages: ChatMessage[]): void {
    if (!messages.length) return;
    try {
      const existing = this.loadArchivedMessages(conversationId);
      const merged = [...existing, ...messages];
      localStorage.setItem(
        StorageService.archiveKey(conversationId),
        JSON.stringify(merged),
      );
    } catch {
      /* swallow — best-effort archive, see Pitfall 4 */
    }
  }

  /**
   * Load a conversation's archived pre-summary messages on demand (QUAL-05,
   * D-13). Returns `[]` when the key is absent, the payload is malformed, the
   * parsed value is not an array, or LocalStorage access throws. NEVER throws
   * — matches getBackup's fail-soft contract so the 05-08 affordance can call
   * it freely without a try/catch.
   */
  loadArchivedMessages(conversationId: string): ChatMessage[] {
    try {
      const raw = localStorage.getItem(StorageService.archiveKey(conversationId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Cheap presence check for the archival affordance (05-08) — true iff the
   * conversation has a non-empty archive key. Never throws; a LocalStorage
   * access failure reports `false`.
   */
  hasArchivedMessages(conversationId: string): boolean {
    try {
      const raw = localStorage.getItem(StorageService.archiveKey(conversationId));
      return !!raw && raw !== '[]';
    } catch {
      return false;
    }
  }

  // ========================================================================
  // Dev-only seed sentinel (D-12 — Phase 3)
  // ------------------------------------------------------------------------
  // Plans 04 (writer in /settings/ai "Developer tools" container) and 05
  // (reader in chat-page ngOnInit) consume these methods. The sentinel is
  // stored under a SEPARATE LocalStorage key (`dev_seed_pending`) — NOT
  // under STORAGE_KEY. It is not user data, never migrated, never backed
  // up. Lifting these methods into Wave 1 removes the implicit Plan 04 →
  // Plan 05 cross-wave coupling.
  // ========================================================================

  private static readonly DEV_SEED_KEY = 'dev_seed_pending';

  /**
   * Dev-only seed sentinel writer (D-12). Visible from /settings/ai only
   * when `location.hostname === 'localhost'`. Best-effort — quota or
   * serialization failures are swallowed (the seed is a debugging
   * convenience, not a correctness path).
   */
  setDevSeed(kind: 'memory' | 'profile'): void {
    try {
      const sentinel = JSON.stringify({ kind, at: new Date().toISOString() });
      localStorage.setItem(StorageService.DEV_SEED_KEY, sentinel);
    } catch {
      /* ignore — best-effort */
    }
  }

  /**
   * Dev-only seed sentinel reader (D-12). Reads-and-removes idempotently.
   * Called from chat-page.component.ts ngOnInit (Plan 05). Returns null
   * when absent, when JSON parse fails, or when LocalStorage access throws.
   */
  consumeDevSeed(): { kind: 'memory' | 'profile'; at: string } | null {
    try {
      const raw = localStorage.getItem(StorageService.DEV_SEED_KEY);
      if (!raw) return null;
      localStorage.removeItem(StorageService.DEV_SEED_KEY);
      const parsed = JSON.parse(raw) as { kind?: unknown; at?: unknown };
      if (parsed.kind !== 'memory' && parsed.kind !== 'profile') return null;
      const at = typeof parsed.at === 'string' ? parsed.at : '';
      return { kind: parsed.kind, at };
    } catch {
      // Corrupted JSON or localStorage error — best-effort removal so we
      // don't loop on a bad value.
      try { localStorage.removeItem(StorageService.DEV_SEED_KEY); } catch { /* ignore */ }
      return null;
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

    const v5: LegacyAppDataV5 = (fromVersion < 5)
      ? this.migrateV4ToV5(v4)
      : (data as LegacyAppDataV5);

    const v6: AppData = (fromVersion < 6)
      ? this.migrateV5ToV6(v5)
      : (data as AppData);

    return v6;
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
  private migrateV4ToV5(data: LegacyAppDataV4): LegacyAppDataV5 {
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

  /**
   * Migration from version 5 to version 6 (Phase 5, RESEARCH A3, FOUND-07).
   *
   * The persisted `ChatBlock` union now admits the web-search variants
   * (`server_tool_use`, `web_search_tool_result`) and optional
   * `TextBlock.citations`. These are ADDITIVE — existing V5 chat blocks
   * (text-only / Phase-4 tool_use) are already valid V6 blocks. The web-search
   * settings flags (`enableWebSearch`, `webSearchMaxUses`) already live in the
   * `AIToolSettings` slice from V5, so there is no settings transform either.
   *
   * The transform is therefore a no-op on existing data: it carries every field
   * through unchanged and only stamps `schemaVersion: 6`. Defensive `?? []`
   * coercion (mirrors the V0→V1 / V2→V3 template) guards a malformed V5 whose
   * top-level arrays are missing — coerced to `[]` rather than throwing, so an
   * un-migrated V5 chat loads unchanged with a pre-migration backup written by
   * the surrounding `initialize()` flow (backward compat).
   */
  private migrateV5ToV6(data: LegacyAppDataV5): AppData {
    return {
      schemaVersion: 6,
      cardioSessions: data.cardioSessions ?? [],
      weightEntries: data.weightEntries ?? [],
      healthReadings: data.healthReadings ?? [],
      savedFoods: data.savedFoods ?? [],
      mealEntries: data.mealEntries ?? [],
      aiSettings: data.aiSettings,
      // V5 chat blocks are already valid V6 blocks (additive union); pass through.
      chatConversations: data.chatConversations ?? [],
      memoryFiles: data.memoryFiles ?? {},
      userProfile: data.userProfile,
      aiToolSettings: data.aiToolSettings,
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
