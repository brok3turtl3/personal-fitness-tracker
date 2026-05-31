import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { generateId } from '../shared/id';
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
      id: generateId(),
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
   * Update an existing weight entry in place.
   * Re-runs the same validators that guard {@link addEntry}; preserves the
   * original `id` + `createdAt`, refreshes `updatedAt`, and overwrites the
   * editable fields from `input`. Storage is left untouched on any failure.
   *
   * @param id - The id of the entry to update
   * @param input - Edited entry data (same shape as add)
   * @returns Observable with the updated entry
   * @throws WeightValidationError if validation fails
   */
  updateEntry(id: string, input: CreateWeightEntry): Observable<WeightEntry> {
    const validationResult = validateWeight(input);

    if (!validationResult.valid) {
      return throwError(() => new WeightValidationError(validationResult.errors));
    }

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }

        const idx = data.weightEntries.findIndex(entry => entry.id === id);
        if (idx < 0) {
          return throwError(() => new Error('Weight entry not found'));
        }

        const existing = data.weightEntries[idx];
        const updated: WeightEntry = {
          ...existing,
          date: input.date,
          weightLbs: input.weightLbs,
          notes: input.notes,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString()
        };

        const weightEntries = [...data.weightEntries];
        weightEntries[idx] = updated;

        return this.storageService.saveData({ ...data, weightEntries }).pipe(
          map(() => updated)
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

  /**
   * Delete a weight entry by ID.
   * Returns true if an entry was removed.
   */
  deleteEntry(id: string): Observable<boolean> {
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }

        const exists = data.weightEntries.some(entry => entry.id === id);
        if (!exists) {
          return of(false);
        }

        const updatedData = {
          ...data,
          weightEntries: data.weightEntries.filter(entry => entry.id !== id)
        };

        return this.storageService.saveData(updatedData).pipe(map(() => true));
      })
    );
  }
}
