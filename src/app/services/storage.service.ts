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
    if (version < 2) {
      migrated = this.migrateV1ToV2(migrated);
    }
    if (version < 3) {
      migrated = this.migrateV2ToV3(migrated);
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
      schemaVersion: 1,
      cardioSessions: oldData.cardioSessions ?? [],
      weightEntries: oldData.weightEntries ?? [],
      healthReadings: oldData.healthReadings ?? [],
      savedFoods: [],
      mealEntries: [],
      lastModified: oldData.lastModified ?? new Date().toISOString()
    };
  }

  /**
   * Migration from version 1 to version 2.
   * Adds diet containers (savedFoods, mealEntries).
   */
  private migrateV1ToV2(data: AppData): AppData {
    return {
      ...data,
      schemaVersion: 2,
      savedFoods: (data as Partial<AppData>).savedFoods ?? [],
      mealEntries: (data as Partial<AppData>).mealEntries ?? []
    };
  }

  /**
   * Migration from version 2 to version 3.
   * Converts saved foods from nutrients-per-100g to nutrients-per-1g (baseUnit: 'g')
   * and converts servings from {grams} to {unit:'g', amount}.
   */
  private migrateV2ToV3(data: AppData): AppData {
    const savedFoods = (data as any).savedFoods ?? [];
    const migratedFoods = Array.isArray(savedFoods)
      ? savedFoods.map((f: any) => migrateSavedFoodV2ToV3(f))
      : [];

    // Meals already store snapshots; we leave them unchanged.
    return {
      ...data,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      savedFoods: migratedFoods,
      mealEntries: (data as any).mealEntries ?? []
    };
  }
}

function migrateSavedFoodV2ToV3(food: any): any {
  const per100g = food?.nutrientsPer100g;

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

  const servings = Array.isArray(food?.servings)
    ? food.servings.map((s: any) => ({
        id: s.id,
        label: s.label,
        unit: 'g',
        amount: safeNumber(s.grams)
      }))
    : [{ id: 'default', label: '100 g', unit: 'g', amount: 100 }];

  return {
    ...food,
    baseUnit: 'g',
    nutrientsPerUnit,
    servings,
    // remove legacy fields
    nutrientsPer100g: undefined
  };
}

function safeNumber(n: unknown): number {
  return Number.isFinite(n as number) ? (n as number) : 0;
}
