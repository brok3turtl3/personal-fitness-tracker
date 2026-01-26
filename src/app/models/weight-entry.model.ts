/**
 * Represents a single weight measurement.
 */
export interface WeightEntry {
  /** Unique identifier (UUID v4) */
  id: string;
  
  /** Date and time of the measurement (ISO 8601) */
  date: string;
  
  /** Weight in pounds (50-1000) */
  weightLbs: number;
  
  /** Optional notes (max 500 chars) */
  notes?: string;
  
  /** When the record was created (ISO 8601) */
  createdAt: string;
  
  /** When the record was last updated (ISO 8601) */
  updatedAt: string;
}

/**
 * Data required to create a new WeightEntry.
 * System fields (id, createdAt, updatedAt) are generated automatically.
 */
export interface CreateWeightEntry {
  date: string;
  weightLbs: number;
  notes?: string;
}
