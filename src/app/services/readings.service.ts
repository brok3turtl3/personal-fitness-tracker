import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { generateId } from '../shared/id';
import { StorageService } from './storage.service';
import {
  HealthReading,
  HealthReadingType,
  BloodPressureReading,
  BloodGlucoseReading,
  KetoneReading,
  CreateBloodPressure,
  CreateBloodGlucose,
  CreateKetone
} from '../models/health-reading.model';
import { 
  validateBloodPressure, 
  validateGlucose, 
  validateKetone, 
  ValidationError 
} from './validators';

/**
 * Custom error class for readings validation failures.
 */
export class ReadingsValidationError extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    const message = errors.map(e => `${e.field}: ${e.message}`).join('; ');
    super(message);
    this.name = 'ReadingsValidationError';
    this.errors = errors;
  }
}

/**
 * Service for managing health readings (BP, glucose, ketones).
 * Provides CRUD operations with validation and persistence.
 */
@Injectable({
  providedIn: 'root'
})
export class ReadingsService {
  constructor(private storageService: StorageService) {}

  /**
   * Get all health readings, optionally filtered by type.
   * Sorted by date (newest first).
   */
  getReadings(type?: HealthReadingType): Observable<HealthReading[]> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return [];
        
        let readings = [...data.healthReadings];
        
        // Filter by type if specified
        if (type) {
          readings = readings.filter(r => r.type === type);
        }
        
        // Sort by date descending (newest first)
        return readings.sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      })
    );
  }

  /**
   * Add a blood pressure reading.
   */
  addBloodPressure(data: CreateBloodPressure): Observable<BloodPressureReading> {
    const validationResult = validateBloodPressure(data);
    
    if (!validationResult.valid) {
      return throwError(() => new ReadingsValidationError(validationResult.errors));
    }

    const now = new Date().toISOString();
    
    const newReading: BloodPressureReading = {
      id: generateId(),
      type: 'blood_pressure',
      date: data.date,
      systolic: data.systolic,
      diastolic: data.diastolic,
      notes: data.notes,
      createdAt: now,
      updatedAt: now
    };

    return this.saveReading(newReading);
  }

  /**
   * Add a blood glucose reading.
   */
  addBloodGlucose(data: CreateBloodGlucose): Observable<BloodGlucoseReading> {
    const validationResult = validateGlucose(data);
    
    if (!validationResult.valid) {
      return throwError(() => new ReadingsValidationError(validationResult.errors));
    }

    const now = new Date().toISOString();
    
    const newReading: BloodGlucoseReading = {
      id: generateId(),
      type: 'blood_glucose',
      date: data.date,
      glucoseMmol: data.glucoseMmol,
      notes: data.notes,
      createdAt: now,
      updatedAt: now
    };

    return this.saveReading(newReading);
  }

  /**
   * Add a ketone reading.
   */
  addKetone(data: CreateKetone): Observable<KetoneReading> {
    const validationResult = validateKetone(data);
    
    if (!validationResult.valid) {
      return throwError(() => new ReadingsValidationError(validationResult.errors));
    }

    const now = new Date().toISOString();
    
    const newReading: KetoneReading = {
      id: generateId(),
      type: 'ketone',
      date: data.date,
      ketoneMmol: data.ketoneMmol,
      notes: data.notes,
      createdAt: now,
      updatedAt: now
    };

    return this.saveReading(newReading);
  }

  /**
   * Update an existing blood pressure reading in place.
   * Re-runs {@link validateBloodPressure}; preserves the original `id` +
   * `createdAt` and the `'blood_pressure'` discriminant, refreshes `updatedAt`.
   * Storage is left untouched on validation failure or a missing id.
   */
  updateBloodPressure(id: string, data: CreateBloodPressure): Observable<BloodPressureReading> {
    const validationResult = validateBloodPressure(data);

    if (!validationResult.valid) {
      return throwError(() => new ReadingsValidationError(validationResult.errors));
    }

    return this.replaceReading(id, existing => ({
      ...existing,
      type: 'blood_pressure',
      date: data.date,
      systolic: data.systolic,
      diastolic: data.diastolic,
      notes: data.notes,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    }));
  }

  /**
   * Update an existing blood glucose reading in place.
   * Re-runs {@link validateGlucose}; preserves identity and the
   * `'blood_glucose'` discriminant, refreshes `updatedAt`.
   */
  updateBloodGlucose(id: string, data: CreateBloodGlucose): Observable<BloodGlucoseReading> {
    const validationResult = validateGlucose(data);

    if (!validationResult.valid) {
      return throwError(() => new ReadingsValidationError(validationResult.errors));
    }

    return this.replaceReading(id, existing => ({
      ...existing,
      type: 'blood_glucose',
      date: data.date,
      glucoseMmol: data.glucoseMmol,
      notes: data.notes,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    }));
  }

  /**
   * Update an existing ketone reading in place.
   * Re-runs {@link validateKetone}; preserves identity and the `'ketone'`
   * discriminant, refreshes `updatedAt`.
   */
  updateKetone(id: string, data: CreateKetone): Observable<KetoneReading> {
    const validationResult = validateKetone(data);

    if (!validationResult.valid) {
      return throwError(() => new ReadingsValidationError(validationResult.errors));
    }

    return this.replaceReading(id, existing => ({
      ...existing,
      type: 'ketone',
      date: data.date,
      ketoneMmol: data.ketoneMmol,
      notes: data.notes,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    }));
  }

  /**
   * Get a single reading by ID.
   */
  getReading(id: string): Observable<HealthReading | null> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return null;
        return data.healthReadings.find(reading => reading.id === id) ?? null;
      })
    );
  }

  /**
   * Delete a health reading by ID.
   * Returns true if a reading was removed.
   */
  deleteReading(id: string): Observable<boolean> {
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }

        const exists = data.healthReadings.some(reading => reading.id === id);
        if (!exists) {
          return of(false);
        }

        const updatedData = {
          ...data,
          healthReadings: data.healthReadings.filter(reading => reading.id !== id)
        };

        return this.storageService.saveData(updatedData).pipe(map(() => true));
      })
    );
  }

  /**
   * Internal helper to update a reading in place by id.
   * Finds the reading by `id`, builds the replacement via the per-type
   * `build` callback (which re-pins identity and the literal discriminant),
   * copy-array-replaces, and saves. No runtime `type` dispatch, no cast.
   */
  private replaceReading<T extends HealthReading>(
    id: string,
    build: (existing: HealthReading) => T
  ): Observable<T> {
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }

        const idx = data.healthReadings.findIndex(reading => reading.id === id);
        if (idx < 0) {
          return throwError(() => new Error('Reading not found'));
        }

        const updated = build(data.healthReadings[idx]);
        const healthReadings = [...data.healthReadings];
        healthReadings[idx] = updated;

        return this.storageService.saveData({ ...data, healthReadings }).pipe(
          map(() => updated)
        );
      })
    );
  }

  /**
   * Internal helper to save a reading to storage.
   */
  private saveReading<T extends HealthReading>(reading: T): Observable<T> {
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }

        const updatedData = {
          ...data,
          healthReadings: [...data.healthReadings, reading]
        };

        return this.storageService.saveData(updatedData).pipe(
          map(() => reading)
        );
      })
    );
  }
}
