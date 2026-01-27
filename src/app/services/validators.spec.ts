import {
  validateCardio,
  validateWeight,
  validateBloodPressure,
  validateGlucose,
  validateKetone,
  VALIDATION_LIMITS
} from './validators';
import { CreateCardioSession } from '../models/cardio-session.model';
import { CreateWeightEntry } from '../models/weight-entry.model';
import { CreateBloodPressure, CreateBloodGlucose, CreateKetone } from '../models/health-reading.model';

describe('Validators', () => {
  const validDate = '2025-01-25T10:00:00Z';

  // ============================================================================
  // Cardio Validation Tests
  // ============================================================================

  describe('validateCardio', () => {
    const validCardio: CreateCardioSession = {
      date: validDate,
      type: 'running',
      durationMinutes: 30,
      distanceKm: 5,
      notes: 'Great run!'
    };

    it('should pass for valid cardio session', () => {
      const result = validateCardio(validCardio);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should pass without optional fields', () => {
      const result = validateCardio({
        date: validDate,
        type: 'cycling',
        durationMinutes: 60
      });
      expect(result.valid).toBe(true);
    });

    it('should fail for missing date', () => {
      const result = validateCardio({ ...validCardio, date: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'date')).toBe(true);
    });

    it('should fail for invalid date format', () => {
      const result = validateCardio({ ...validCardio, date: 'not-a-date' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'date' && e.message.includes('Invalid'))).toBe(true);
    });

    it('should fail for invalid cardio type', () => {
      const result = validateCardio({ ...validCardio, type: 'invalid' as any });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'type')).toBe(true);
    });

    it('should fail for duration below minimum', () => {
      const result = validateCardio({ ...validCardio, durationMinutes: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'durationMinutes')).toBe(true);
    });

    it('should fail for duration above maximum', () => {
      const result = validateCardio({ ...validCardio, durationMinutes: 1441 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'durationMinutes')).toBe(true);
    });

    it('should pass for duration at boundaries', () => {
      expect(validateCardio({ ...validCardio, durationMinutes: VALIDATION_LIMITS.DURATION_MIN }).valid).toBe(true);
      expect(validateCardio({ ...validCardio, durationMinutes: VALIDATION_LIMITS.DURATION_MAX }).valid).toBe(true);
    });

    it('should fail for distance below minimum', () => {
      const result = validateCardio({ ...validCardio, distanceKm: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'distanceKm')).toBe(true);
    });

    it('should fail for distance above maximum', () => {
      const result = validateCardio({ ...validCardio, distanceKm: 1001 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'distanceKm')).toBe(true);
    });

    it('should fail for notes exceeding max length', () => {
      const result = validateCardio({ ...validCardio, notes: 'a'.repeat(501) });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'notes')).toBe(true);
    });

    it('should pass for notes at max length', () => {
      const result = validateCardio({ ...validCardio, notes: 'a'.repeat(500) });
      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // Weight Validation Tests
  // ============================================================================

  describe('validateWeight', () => {
    const validWeight: CreateWeightEntry = {
      date: validDate,
      weightLbs: 165,
      notes: 'Morning weight'
    };

    it('should pass for valid weight entry', () => {
      const result = validateWeight(validWeight);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should pass without optional notes', () => {
      const result = validateWeight({
        date: validDate,
        weightLbs: 150
      });
      expect(result.valid).toBe(true);
    });

    it('should fail for missing date', () => {
      const result = validateWeight({ ...validWeight, date: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'date')).toBe(true);
    });

    it('should fail for weight below minimum (50 lbs)', () => {
      const result = validateWeight({ ...validWeight, weightLbs: 49 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'weightLbs')).toBe(true);
    });

    it('should fail for weight above maximum (1000 lbs)', () => {
      const result = validateWeight({ ...validWeight, weightLbs: 1001 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'weightLbs')).toBe(true);
    });

    it('should pass for weight at boundaries', () => {
      expect(validateWeight({ ...validWeight, weightLbs: VALIDATION_LIMITS.WEIGHT_MIN }).valid).toBe(true);
      expect(validateWeight({ ...validWeight, weightLbs: VALIDATION_LIMITS.WEIGHT_MAX }).valid).toBe(true);
    });

    it('should fail for notes exceeding max length', () => {
      const result = validateWeight({ ...validWeight, notes: 'a'.repeat(501) });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'notes')).toBe(true);
    });
  });

  // ============================================================================
  // Blood Pressure Validation Tests
  // ============================================================================

  describe('validateBloodPressure', () => {
    const validBP: CreateBloodPressure = {
      date: validDate,
      systolic: 120,
      diastolic: 80,
      notes: 'Resting BP'
    };

    it('should pass for valid blood pressure', () => {
      const result = validateBloodPressure(validBP);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail for missing date', () => {
      const result = validateBloodPressure({ ...validBP, date: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'date')).toBe(true);
    });

    it('should fail for systolic below minimum', () => {
      const result = validateBloodPressure({ ...validBP, systolic: 59 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'systolic')).toBe(true);
    });

    it('should fail for systolic above maximum', () => {
      const result = validateBloodPressure({ ...validBP, systolic: 251 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'systolic')).toBe(true);
    });

    it('should fail for diastolic below minimum', () => {
      const result = validateBloodPressure({ ...validBP, diastolic: 39 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'diastolic')).toBe(true);
    });

    it('should fail for diastolic above maximum', () => {
      const result = validateBloodPressure({ ...validBP, diastolic: 151 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'diastolic')).toBe(true);
    });

    it('should fail when systolic is not greater than diastolic', () => {
      const result = validateBloodPressure({ ...validBP, systolic: 80, diastolic: 80 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('greater than diastolic'))).toBe(true);
    });

    it('should fail when systolic is less than diastolic', () => {
      const result = validateBloodPressure({ ...validBP, systolic: 70, diastolic: 80 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('greater than diastolic'))).toBe(true);
    });

    it('should pass for BP at boundaries', () => {
      expect(validateBloodPressure({ 
        ...validBP, 
        systolic: VALIDATION_LIMITS.SYSTOLIC_MIN + 1, 
        diastolic: VALIDATION_LIMITS.DIASTOLIC_MIN 
      }).valid).toBe(true);
    });
  });

  // ============================================================================
  // Blood Glucose Validation Tests
  // ============================================================================

  describe('validateGlucose', () => {
    const validGlucose: CreateBloodGlucose = {
      date: validDate,
      glucoseMmol: 5.5,
      notes: 'Fasting glucose'
    };

    it('should pass for valid glucose reading', () => {
      const result = validateGlucose(validGlucose);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail for missing date', () => {
      const result = validateGlucose({ ...validGlucose, date: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'date')).toBe(true);
    });

    it('should fail for glucose below minimum', () => {
      const result = validateGlucose({ ...validGlucose, glucoseMmol: 0.9 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'glucoseMmol')).toBe(true);
    });

    it('should fail for glucose above maximum', () => {
      const result = validateGlucose({ ...validGlucose, glucoseMmol: 35.1 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'glucoseMmol')).toBe(true);
    });

    it('should pass for glucose at boundaries', () => {
      expect(validateGlucose({ ...validGlucose, glucoseMmol: VALIDATION_LIMITS.GLUCOSE_MIN }).valid).toBe(true);
      expect(validateGlucose({ ...validGlucose, glucoseMmol: VALIDATION_LIMITS.GLUCOSE_MAX }).valid).toBe(true);
    });

    it('should fail for notes exceeding max length', () => {
      const result = validateGlucose({ ...validGlucose, notes: 'a'.repeat(501) });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'notes')).toBe(true);
    });
  });

  // ============================================================================
  // Ketone Validation Tests
  // ============================================================================

  describe('validateKetone', () => {
    const validKetone: CreateKetone = {
      date: validDate,
      ketoneMmol: 1.5,
      notes: 'Morning ketones'
    };

    it('should pass for valid ketone reading', () => {
      const result = validateKetone(validKetone);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail for missing date', () => {
      const result = validateKetone({ ...validKetone, date: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'date')).toBe(true);
    });

    it('should fail for ketone below minimum', () => {
      const result = validateKetone({ ...validKetone, ketoneMmol: -0.1 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'ketoneMmol')).toBe(true);
    });

    it('should fail for ketone above maximum', () => {
      const result = validateKetone({ ...validKetone, ketoneMmol: 10.1 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'ketoneMmol')).toBe(true);
    });

    it('should pass for ketone at boundaries', () => {
      expect(validateKetone({ ...validKetone, ketoneMmol: VALIDATION_LIMITS.KETONE_MIN }).valid).toBe(true);
      expect(validateKetone({ ...validKetone, ketoneMmol: VALIDATION_LIMITS.KETONE_MAX }).valid).toBe(true);
    });

    it('should pass for zero ketones', () => {
      const result = validateKetone({ ...validKetone, ketoneMmol: 0 });
      expect(result.valid).toBe(true);
    });

    it('should fail for notes exceeding max length', () => {
      const result = validateKetone({ ...validKetone, notes: 'a'.repeat(501) });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'notes')).toBe(true);
    });
  });
});
