import { CreateCardioSession, CardioType, CARDIO_TYPES } from '../models/cardio-session.model';
import { CreateWeightEntry } from '../models/weight-entry.model';
import { CreateBloodPressure, CreateBloodGlucose, CreateKetone } from '../models/health-reading.model';

/**
 * Validation error with field and message details.
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Creates a successful validation result.
 */
function validResult(): ValidationResult {
  return { valid: true, errors: [] };
}

/**
 * Creates a failed validation result with errors.
 */
function invalidResult(errors: ValidationError[]): ValidationResult {
  return { valid: false, errors };
}

/**
 * Checks if a string is a valid ISO 8601 date.
 */
function isValidISODate(dateString: string): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Checks if a value is a valid CardioType.
 */
function isValidCardioType(type: string): type is CardioType {
  return CARDIO_TYPES.some(t => t.value === type);
}

// ============================================================================
// Validation Constants
// ============================================================================

export const VALIDATION_LIMITS = {
  // Cardio
  DURATION_MIN: 1,
  DURATION_MAX: 1440,
  DISTANCE_MIN: 0.01,
  DISTANCE_MAX: 1000,
  CALORIES_MIN: 0,
  CALORIES_MAX: 20000,
  
  // Weight (in lbs)
  WEIGHT_MIN: 50,
  WEIGHT_MAX: 1000,
  
  // Blood Pressure
  SYSTOLIC_MIN: 60,
  SYSTOLIC_MAX: 250,
  DIASTOLIC_MIN: 40,
  DIASTOLIC_MAX: 150,
  
  // Blood Glucose (mmol/L)
  GLUCOSE_MIN: 1.0,
  GLUCOSE_MAX: 35.0,
  
  // Ketones (mmol/L)
  KETONE_MIN: 0.0,
  KETONE_MAX: 10.0,
  
  // Notes
  NOTES_MAX_LENGTH: 500
} as const;

// ============================================================================
// Cardio Validation
// ============================================================================

/**
 * Validates a cardio session creation request.
 */
export function validateCardio(data: CreateCardioSession): ValidationResult {
  const errors: ValidationError[] = [];

  // Date validation
  if (!data.date) {
    errors.push({ field: 'date', message: 'Date is required' });
  } else if (!isValidISODate(data.date)) {
    errors.push({ field: 'date', message: 'Invalid date format', value: data.date });
  }

  // Type validation
  if (!data.type) {
    errors.push({ field: 'type', message: 'Type is required' });
  } else if (!isValidCardioType(data.type)) {
    errors.push({ field: 'type', message: 'Invalid cardio type', value: data.type });
  }

  // Duration validation
  if (data.durationMinutes === undefined || data.durationMinutes === null) {
    errors.push({ field: 'durationMinutes', message: 'Duration is required' });
  } else if (
    data.durationMinutes < VALIDATION_LIMITS.DURATION_MIN || 
    data.durationMinutes > VALIDATION_LIMITS.DURATION_MAX
  ) {
    errors.push({ 
      field: 'durationMinutes', 
      message: `Duration must be between ${VALIDATION_LIMITS.DURATION_MIN} and ${VALIDATION_LIMITS.DURATION_MAX} minutes`,
      value: data.durationMinutes
    });
  }

  // Distance validation (optional)
  if (data.distanceKm !== undefined && data.distanceKm !== null) {
    if (
      data.distanceKm < VALIDATION_LIMITS.DISTANCE_MIN || 
      data.distanceKm > VALIDATION_LIMITS.DISTANCE_MAX
    ) {
      errors.push({ 
        field: 'distanceKm', 
        message: `Distance must be between ${VALIDATION_LIMITS.DISTANCE_MIN} and ${VALIDATION_LIMITS.DISTANCE_MAX} km`,
        value: data.distanceKm
      });
    }
  }

  // Calories validation (optional)
  if (data.caloriesBurned !== undefined && data.caloriesBurned !== null) {
    if (!Number.isFinite(data.caloriesBurned)) {
      errors.push({
        field: 'caloriesBurned',
        message: 'Calories must be a finite number',
        value: data.caloriesBurned
      });
    } else if (
      data.caloriesBurned < VALIDATION_LIMITS.CALORIES_MIN ||
      data.caloriesBurned > VALIDATION_LIMITS.CALORIES_MAX
    ) {
      errors.push({
        field: 'caloriesBurned',
        message: `Calories must be between ${VALIDATION_LIMITS.CALORIES_MIN} and ${VALIDATION_LIMITS.CALORIES_MAX} kcal`,
        value: data.caloriesBurned
      });
    }
  }

  // Notes validation (optional)
  if (data.notes && data.notes.length > VALIDATION_LIMITS.NOTES_MAX_LENGTH) {
    errors.push({ 
      field: 'notes', 
      message: `Notes must be ${VALIDATION_LIMITS.NOTES_MAX_LENGTH} characters or less`,
      value: data.notes.length
    });
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

// ============================================================================
// Weight Validation
// ============================================================================

/**
 * Validates a weight entry creation request.
 */
export function validateWeight(data: CreateWeightEntry): ValidationResult {
  const errors: ValidationError[] = [];

  // Date validation
  if (!data.date) {
    errors.push({ field: 'date', message: 'Date is required' });
  } else if (!isValidISODate(data.date)) {
    errors.push({ field: 'date', message: 'Invalid date format', value: data.date });
  }

  // Weight validation
  if (data.weightLbs === undefined || data.weightLbs === null) {
    errors.push({ field: 'weightLbs', message: 'Weight is required' });
  } else if (
    data.weightLbs < VALIDATION_LIMITS.WEIGHT_MIN || 
    data.weightLbs > VALIDATION_LIMITS.WEIGHT_MAX
  ) {
    errors.push({ 
      field: 'weightLbs', 
      message: `Weight must be between ${VALIDATION_LIMITS.WEIGHT_MIN} and ${VALIDATION_LIMITS.WEIGHT_MAX} lbs`,
      value: data.weightLbs
    });
  }

  // Notes validation (optional)
  if (data.notes && data.notes.length > VALIDATION_LIMITS.NOTES_MAX_LENGTH) {
    errors.push({ 
      field: 'notes', 
      message: `Notes must be ${VALIDATION_LIMITS.NOTES_MAX_LENGTH} characters or less`,
      value: data.notes.length
    });
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

// ============================================================================
// Blood Pressure Validation
// ============================================================================

/**
 * Validates a blood pressure reading creation request.
 */
export function validateBloodPressure(data: CreateBloodPressure): ValidationResult {
  const errors: ValidationError[] = [];

  // Date validation
  if (!data.date) {
    errors.push({ field: 'date', message: 'Date is required' });
  } else if (!isValidISODate(data.date)) {
    errors.push({ field: 'date', message: 'Invalid date format', value: data.date });
  }

  // Systolic validation
  if (data.systolic === undefined || data.systolic === null) {
    errors.push({ field: 'systolic', message: 'Systolic pressure is required' });
  } else if (
    data.systolic < VALIDATION_LIMITS.SYSTOLIC_MIN || 
    data.systolic > VALIDATION_LIMITS.SYSTOLIC_MAX
  ) {
    errors.push({ 
      field: 'systolic', 
      message: `Systolic must be between ${VALIDATION_LIMITS.SYSTOLIC_MIN} and ${VALIDATION_LIMITS.SYSTOLIC_MAX} mmHg`,
      value: data.systolic
    });
  }

  // Diastolic validation
  if (data.diastolic === undefined || data.diastolic === null) {
    errors.push({ field: 'diastolic', message: 'Diastolic pressure is required' });
  } else if (
    data.diastolic < VALIDATION_LIMITS.DIASTOLIC_MIN || 
    data.diastolic > VALIDATION_LIMITS.DIASTOLIC_MAX
  ) {
    errors.push({ 
      field: 'diastolic', 
      message: `Diastolic must be between ${VALIDATION_LIMITS.DIASTOLIC_MIN} and ${VALIDATION_LIMITS.DIASTOLIC_MAX} mmHg`,
      value: data.diastolic
    });
  }

  // Systolic must be greater than diastolic
  if (
    data.systolic !== undefined && 
    data.diastolic !== undefined && 
    data.systolic <= data.diastolic
  ) {
    errors.push({ 
      field: 'systolic', 
      message: 'Systolic must be greater than diastolic',
      value: { systolic: data.systolic, diastolic: data.diastolic }
    });
  }

  // Notes validation (optional)
  if (data.notes && data.notes.length > VALIDATION_LIMITS.NOTES_MAX_LENGTH) {
    errors.push({ 
      field: 'notes', 
      message: `Notes must be ${VALIDATION_LIMITS.NOTES_MAX_LENGTH} characters or less`,
      value: data.notes.length
    });
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

// ============================================================================
// Blood Glucose Validation
// ============================================================================

/**
 * Validates a blood glucose reading creation request.
 */
export function validateGlucose(data: CreateBloodGlucose): ValidationResult {
  const errors: ValidationError[] = [];

  // Date validation
  if (!data.date) {
    errors.push({ field: 'date', message: 'Date is required' });
  } else if (!isValidISODate(data.date)) {
    errors.push({ field: 'date', message: 'Invalid date format', value: data.date });
  }

  // Glucose validation
  if (data.glucoseMmol === undefined || data.glucoseMmol === null) {
    errors.push({ field: 'glucoseMmol', message: 'Glucose level is required' });
  } else if (
    data.glucoseMmol < VALIDATION_LIMITS.GLUCOSE_MIN || 
    data.glucoseMmol > VALIDATION_LIMITS.GLUCOSE_MAX
  ) {
    errors.push({ 
      field: 'glucoseMmol', 
      message: `Glucose must be between ${VALIDATION_LIMITS.GLUCOSE_MIN} and ${VALIDATION_LIMITS.GLUCOSE_MAX} mmol/L`,
      value: data.glucoseMmol
    });
  }

  // Notes validation (optional)
  if (data.notes && data.notes.length > VALIDATION_LIMITS.NOTES_MAX_LENGTH) {
    errors.push({ 
      field: 'notes', 
      message: `Notes must be ${VALIDATION_LIMITS.NOTES_MAX_LENGTH} characters or less`,
      value: data.notes.length
    });
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

// ============================================================================
// Ketone Validation
// ============================================================================

/**
 * Validates a ketone reading creation request.
 */
export function validateKetone(data: CreateKetone): ValidationResult {
  const errors: ValidationError[] = [];

  // Date validation
  if (!data.date) {
    errors.push({ field: 'date', message: 'Date is required' });
  } else if (!isValidISODate(data.date)) {
    errors.push({ field: 'date', message: 'Invalid date format', value: data.date });
  }

  // Ketone validation
  if (data.ketoneMmol === undefined || data.ketoneMmol === null) {
    errors.push({ field: 'ketoneMmol', message: 'Ketone level is required' });
  } else if (
    data.ketoneMmol < VALIDATION_LIMITS.KETONE_MIN || 
    data.ketoneMmol > VALIDATION_LIMITS.KETONE_MAX
  ) {
    errors.push({ 
      field: 'ketoneMmol', 
      message: `Ketone must be between ${VALIDATION_LIMITS.KETONE_MIN} and ${VALIDATION_LIMITS.KETONE_MAX} mmol/L`,
      value: data.ketoneMmol
    });
  }

  // Notes validation (optional)
  if (data.notes && data.notes.length > VALIDATION_LIMITS.NOTES_MAX_LENGTH) {
    errors.push({ 
      field: 'notes', 
      message: `Notes must be ${VALIDATION_LIMITS.NOTES_MAX_LENGTH} characters or less`,
      value: data.notes.length
    });
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}
