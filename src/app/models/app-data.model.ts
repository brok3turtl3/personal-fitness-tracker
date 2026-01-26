import { CardioSession } from './cardio-session.model';
import { WeightEntry } from './weight-entry.model';
import { HealthReading } from './health-reading.model';

/**
 * Root container for all application data.
 * Stored as a single JSON object in LocalStorage.
 */
export interface AppData {
  /** Schema version for migration support. Current: 1 */
  schemaVersion: number;
  
  /** All cardio workout sessions */
  cardioSessions: CardioSession[];
  
  /** All weight measurements */
  weightEntries: WeightEntry[];
  
  /** All health readings (BP, glucose, ketones) */
  healthReadings: HealthReading[];
  
  /** ISO 8601 timestamp of last modification */
  lastModified: string;
}

/** Current schema version */
export const CURRENT_SCHEMA_VERSION = 1;

/** LocalStorage key for app data */
export const STORAGE_KEY = 'fitness_tracker_data';

/**
 * Creates an empty AppData object with default values.
 */
export function createEmptyAppData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    cardioSessions: [],
    weightEntries: [],
    healthReadings: [],
    lastModified: new Date().toISOString()
  };
}
