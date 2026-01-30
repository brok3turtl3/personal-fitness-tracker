import { Injectable } from '@angular/core';
import { Observable, map, switchMap, throwError } from 'rxjs';
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
 * Generates a UUID v4 string.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
      id: generateUUID(),
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
      id: generateUUID(),
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
      id: generateUUID(),
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
