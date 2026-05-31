import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { generateId } from '../shared/id';
import { StorageService } from './storage.service';
import { CardioSession, CreateCardioSession } from '../models/cardio-session.model';
import { validateCardio, ValidationError } from './validators';

/**
 * Custom error class for cardio validation failures.
 */
export class CardioValidationError extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    const message = errors.map(e => `${e.field}: ${e.message}`).join('; ');
    super(message);
    this.name = 'CardioValidationError';
    this.errors = errors;
  }
}

/**
 * Service for managing cardio sessions.
 * Provides CRUD operations with validation and persistence.
 */
@Injectable({
  providedIn: 'root'
})
export class CardioService {
  constructor(private storageService: StorageService) {}

  /**
   * Get all cardio sessions sorted by date (newest first).
   */
  getSessions(): Observable<CardioSession[]> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return [];
        
        // Sort by date descending (newest first)
        return [...data.cardioSessions].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      })
    );
  }

  /**
   * Add a new cardio session.
   * Validates input and persists to storage.
   * 
   * @param sessionData - Session data without system fields
   * @returns Observable with the created session including generated fields
   * @throws CardioValidationError if validation fails
   */
  addSession(sessionData: CreateCardioSession): Observable<CardioSession> {
    // Validate input
    const validationResult = validateCardio(sessionData);
    
    if (!validationResult.valid) {
      return throwError(() => new CardioValidationError(validationResult.errors));
    }

    const now = new Date().toISOString();
    
    // Create the full session object
    const newSession: CardioSession = {
      id: generateId(),
      date: sessionData.date,
      type: sessionData.type,
      durationMinutes: sessionData.durationMinutes,
      distanceKm: sessionData.distanceKm,
      caloriesBurned: sessionData.caloriesBurned,
      notes: sessionData.notes,
      createdAt: now,
      updatedAt: now
    };

    // Get current data, add session, and save
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }

        const updatedData = {
          ...data,
          cardioSessions: [...data.cardioSessions, newSession]
        };

        return this.storageService.saveData(updatedData).pipe(
          map(() => newSession)
        );
      })
    );
  }

  /**
   * Update an existing cardio session in place.
   * Re-runs the same validators that guard {@link addSession}; preserves the
   * original `id` + `createdAt`, refreshes `updatedAt`, and overwrites the
   * editable fields from `input`. Storage is left untouched on any failure.
   *
   * @param id - The id of the session to update
   * @param input - Edited session data (same shape as add)
   * @returns Observable with the updated session
   * @throws CardioValidationError if validation fails
   */
  updateSession(id: string, input: CreateCardioSession): Observable<CardioSession> {
    const validationResult = validateCardio(input);

    if (!validationResult.valid) {
      return throwError(() => new CardioValidationError(validationResult.errors));
    }

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }

        const idx = data.cardioSessions.findIndex(session => session.id === id);
        if (idx < 0) {
          return throwError(() => new Error('Cardio session not found'));
        }

        const existing = data.cardioSessions[idx];
        const updated: CardioSession = {
          ...existing,
          date: input.date,
          type: input.type,
          durationMinutes: input.durationMinutes,
          distanceKm: input.distanceKm,
          caloriesBurned: input.caloriesBurned,
          notes: input.notes,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString()
        };

        const cardioSessions = [...data.cardioSessions];
        cardioSessions[idx] = updated;

        return this.storageService.saveData({ ...data, cardioSessions }).pipe(
          map(() => updated)
        );
      })
    );
  }

  /**
   * Get a single cardio session by ID.
   *
   * @param id - The session ID to find
   * @returns Observable with the session or null if not found
   */
  getSession(id: string): Observable<CardioSession | null> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return null;
        return data.cardioSessions.find(session => session.id === id) ?? null;
      })
    );
  }

  /**
   * Delete a cardio session by ID.
   * Returns true if a session was removed.
   */
  deleteSession(id: string): Observable<boolean> {
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }

        const exists = data.cardioSessions.some(session => session.id === id);
        if (!exists) {
          return of(false);
        }

        const updatedData = {
          ...data,
          cardioSessions: data.cardioSessions.filter(session => session.id !== id)
        };

        return this.storageService.saveData(updatedData).pipe(map(() => true));
      })
    );
  }
}
