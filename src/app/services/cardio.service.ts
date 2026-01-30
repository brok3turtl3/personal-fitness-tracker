import { Injectable } from '@angular/core';
import { Observable, map, switchMap, throwError } from 'rxjs';
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
      id: generateUUID(),
      date: sessionData.date,
      type: sessionData.type,
      durationMinutes: sessionData.durationMinutes,
      distanceKm: sessionData.distanceKm,
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
}
