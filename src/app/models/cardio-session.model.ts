/**
 * Types of cardio exercises supported.
 */
export type CardioType =
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'walking'
  | 'rowing'
  | 'elliptical'
  | 'other';

/**
 * Represents a single cardio workout session.
 */
export interface CardioSession {
  /** Unique identifier (UUID v4) */
  id: string;
  
  /** Date and time of the session (ISO 8601) */
  date: string;
  
  /** Type of cardio exercise */
  type: CardioType;
  
  /** Duration in minutes (1-1440) */
  durationMinutes: number;
  
  /** Distance in kilometers (0.01-1000), optional */
  distanceKm?: number;

  /** Calories burned (0-20000 kcal), optional */
  caloriesBurned?: number;
  
  /** Optional notes (max 500 chars) */
  notes?: string;
  
  /** When the record was created (ISO 8601) */
  createdAt: string;
  
  /** When the record was last updated (ISO 8601) */
  updatedAt: string;
}

/**
 * Data required to create a new CardioSession.
 * System fields (id, createdAt, updatedAt) are generated automatically.
 */
export interface CreateCardioSession {
  date: string;
  type: CardioType;
  durationMinutes: number;
  distanceKm?: number;
  caloriesBurned?: number;
  notes?: string;
}

/** Available cardio types for UI dropdowns */
export const CARDIO_TYPES: { value: CardioType; label: string }[] = [
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'walking', label: 'Walking' },
  { value: 'rowing', label: 'Rowing' },
  { value: 'elliptical', label: 'Elliptical' },
  { value: 'other', label: 'Other' }
];
