/**
 * Base fields common to all health readings.
 */
export interface BaseHealthReading {
  /** Unique identifier (UUID v4) */
  id: string;
  
  /** Date and time of the reading (ISO 8601) */
  date: string;
  
  /** Optional notes (max 500 chars) */
  notes?: string;
  
  /** When the record was created (ISO 8601) */
  createdAt: string;
  
  /** When the record was last updated (ISO 8601) */
  updatedAt: string;
}

/**
 * Blood pressure reading with systolic and diastolic values.
 */
export interface BloodPressureReading extends BaseHealthReading {
  type: 'blood_pressure';
  
  /** Systolic pressure in mmHg (60-250) */
  systolic: number;
  
  /** Diastolic pressure in mmHg (40-150) */
  diastolic: number;
}

/**
 * Blood glucose reading in mmol/L.
 */
export interface BloodGlucoseReading extends BaseHealthReading {
  type: 'blood_glucose';
  
  /** Glucose level in mmol/L (1.0-35.0) */
  glucoseMmol: number;
}

/**
 * Ketone reading in mmol/L.
 */
export interface KetoneReading extends BaseHealthReading {
  type: 'ketone';
  
  /** Ketone level in mmol/L (0.0-10.0) */
  ketoneMmol: number;
}

/**
 * Discriminated union of all health reading types.
 * Use the 'type' field to narrow the type.
 */
export type HealthReading =
  | BloodPressureReading
  | BloodGlucoseReading
  | KetoneReading;

/**
 * The type discriminator values for health readings.
 */
export type HealthReadingType = HealthReading['type'];

/**
 * Data required to create a new BloodPressureReading.
 */
export interface CreateBloodPressure {
  date: string;
  systolic: number;
  diastolic: number;
  notes?: string;
}

/**
 * Data required to create a new BloodGlucoseReading.
 */
export interface CreateBloodGlucose {
  date: string;
  glucoseMmol: number;
  notes?: string;
}

/**
 * Data required to create a new KetoneReading.
 */
export interface CreateKetone {
  date: string;
  ketoneMmol: number;
  notes?: string;
}

/** Available reading types for UI dropdowns */
export const READING_TYPES: { value: HealthReadingType; label: string }[] = [
  { value: 'blood_pressure', label: 'Blood Pressure' },
  { value: 'blood_glucose', label: 'Blood Glucose' },
  { value: 'ketone', label: 'Ketones' }
];
