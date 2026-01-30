import { Injectable } from '@angular/core';
import { Observable, map, switchMap, throwError } from 'rxjs';
import { StorageService } from './storage.service';
import { WeightEntry, CreateWeightEntry } from '../models/weight-entry.model';
import { validateWeight, ValidationError } from './validators';

/**
 * Custom error class for weight validation failures.
 */
export class WeightValidationError extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    const message = errors.map(e => `${e.field}: ${e.message}`).join('; ');
    super(message);
    this.name = 'WeightValidationError';
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
 * Service for managing weight entries.
 * Provides CRUD operations with validation and persistence.
 */
@Injectable({
  providedIn: 'root'
})
export class WeightService {
  constructor(private storageService: StorageService) {}

  /**
   * Get all weight entries sorted by date (newest first).
   */
  getEntries(): Observable<WeightEntry[]> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return [];
        
        // Sort by date descending (newest first)
        return [...data.weightEntries].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      })
    );
  }

  /**
   * Add a new weight entry.
   * Validates input and persists to storage.
   * 
   * @param entryData - Entry data without system fields
   * @returns Observable with the created entry including generated fields
   * @throws WeightValidationError if validation fails
   */
  addEntry(entryData: CreateWeightEntry): Observable<WeightEntry> {
    // Validate input
    const validationResult = validateWeight(entryData);
    
    if (!validationResult.valid) {
      return throwError(() => new WeightValidationError(validationResult.errors));
    }

    const now = new Date().toISOString();
    
    // Create the full entry object
    const newEntry: WeightEntry = {
      id: generateUUID(),
      date: entryData.date,
      weightLbs: entryData.weightLbs,
      notes: entryData.notes,
      createdAt: now,
      updatedAt: now
    };

    // Get current data, add entry, and save
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }

        const updatedData = {
          ...data,
          weightEntries: [...data.weightEntries, newEntry]
        };

        return this.storageService.saveData(updatedData).pipe(
          map(() => newEntry)
        );
      })
    );
  }

  /**
   * Get a single weight entry by ID.
   * 
   * @param id - The entry ID to find
   * @returns Observable with the entry or null if not found
   */
  getEntry(id: string): Observable<WeightEntry | null> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return null;
        return data.weightEntries.find(entry => entry.id === id) ?? null;
      })
    );
  }
}
