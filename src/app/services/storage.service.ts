import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { 
  AppData, 
  CURRENT_SCHEMA_VERSION, 
  STORAGE_KEY, 
  createEmptyAppData 
} from '../models/app-data.model';

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
  private initialized = false;
  private cachedData: AppData | null = null;

  /**
   * Initialize storage and run migrations if needed.
   * Must be called before other operations.
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
        try {
          const parsed = JSON.parse(rawData);
          this.cachedData = this.migrateData(parsed);
          
          // Save if migration occurred
          if (this.cachedData.schemaVersion !== parsed.schemaVersion) {
            this.persistToStorage(this.cachedData);
          }
        } catch (e) {
          return throwError(() => new StorageError(
            'Failed to parse stored data',
            'PARSE_ERROR',
            e instanceof Error ? e : undefined
          ));
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
   * This is a hook for future migrations.
   */
  private migrateData(data: unknown): AppData {
    const parsed = data as { schemaVersion?: number };
    const version = parsed.schemaVersion ?? 0;

    let migrated = data as AppData;

    // Apply migrations in sequence
    if (version < 1) {
      migrated = this.migrateV0ToV1(data);
    }
    // Future migrations:
    // if (version < 2) { migrated = this.migrateV1ToV2(migrated); }

    return migrated;
  }

  /**
   * Migration from version 0 (no version) to version 1.
   */
  private migrateV0ToV1(data: unknown): AppData {
    // For v0 -> v1, we assume any existing data without schemaVersion
    // is from before versioning was added. Create proper structure.
    const oldData = data as Partial<AppData>;
    
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      cardioSessions: oldData.cardioSessions ?? [],
      weightEntries: oldData.weightEntries ?? [],
      healthReadings: oldData.healthReadings ?? [],
      lastModified: oldData.lastModified ?? new Date().toISOString()
    };
  }
}
