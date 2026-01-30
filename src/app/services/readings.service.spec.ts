import { TestBed } from '@angular/core/testing';
import { ReadingsService, ReadingsValidationError } from './readings.service';
import { StorageService } from './storage.service';
import { 
  HealthReading, 
  BloodPressureReading, 
  BloodGlucoseReading, 
  KetoneReading,
  CreateBloodPressure,
  CreateBloodGlucose,
  CreateKetone
} from '../models/health-reading.model';
import { AppData, createEmptyAppData } from '../models/app-data.model';
import { of } from 'rxjs';

describe('ReadingsService', () => {
  let service: ReadingsService;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;
  let mockAppData: AppData;

  // Helpers to create valid inputs
  const createValidBP = (overrides: Partial<CreateBloodPressure> = {}): CreateBloodPressure => ({
    date: '2025-01-27T10:00:00.000Z',
    systolic: 120,
    diastolic: 80,
    ...overrides
  });

  const createValidGlucose = (overrides: Partial<CreateBloodGlucose> = {}): CreateBloodGlucose => ({
    date: '2025-01-27T10:00:00.000Z',
    glucoseMmol: 5.5,
    ...overrides
  });

  const createValidKetone = (overrides: Partial<CreateKetone> = {}): CreateKetone => ({
    date: '2025-01-27T10:00:00.000Z',
    ketoneMmol: 0.5,
    ...overrides
  });

  // Helpers to create stored readings
  const createStoredBP = (overrides: Partial<BloodPressureReading> = {}): BloodPressureReading => ({
    id: 'test-bp-1',
    type: 'blood_pressure',
    date: '2025-01-27T10:00:00.000Z',
    systolic: 120,
    diastolic: 80,
    createdAt: '2025-01-27T10:00:00.000Z',
    updatedAt: '2025-01-27T10:00:00.000Z',
    ...overrides
  });

  const createStoredGlucose = (overrides: Partial<BloodGlucoseReading> = {}): BloodGlucoseReading => ({
    id: 'test-glucose-1',
    type: 'blood_glucose',
    date: '2025-01-27T10:00:00.000Z',
    glucoseMmol: 5.5,
    createdAt: '2025-01-27T10:00:00.000Z',
    updatedAt: '2025-01-27T10:00:00.000Z',
    ...overrides
  });

  const createStoredKetone = (overrides: Partial<KetoneReading> = {}): KetoneReading => ({
    id: 'test-ketone-1',
    type: 'ketone',
    date: '2025-01-27T10:00:00.000Z',
    ketoneMmol: 0.5,
    createdAt: '2025-01-27T10:00:00.000Z',
    updatedAt: '2025-01-27T10:00:00.000Z',
    ...overrides
  });

  beforeEach(() => {
    mockAppData = createEmptyAppData();
    
    storageServiceSpy = jasmine.createSpyObj('StorageService', ['initialize', 'getData', 'saveData']);
    storageServiceSpy.initialize.and.returnValue(of(undefined));
    storageServiceSpy.getData.and.returnValue(of(mockAppData));
    storageServiceSpy.saveData.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        ReadingsService,
        { provide: StorageService, useValue: storageServiceSpy }
      ]
    });

    service = TestBed.inject(ReadingsService);
  });

  describe('getReadings', () => {
    it('should return empty array when no readings exist', (done) => {
      service.getReadings().subscribe(readings => {
        expect(readings).toEqual([]);
        done();
      });
    });

    it('should return all readings sorted by date (newest first)', (done) => {
      const olderBP = createStoredBP({ id: 'older', date: '2025-01-25T10:00:00.000Z' });
      const newerGlucose = createStoredGlucose({ id: 'newer', date: '2025-01-27T10:00:00.000Z' });
      const middleKetone = createStoredKetone({ id: 'middle', date: '2025-01-26T10:00:00.000Z' });

      mockAppData.healthReadings = [olderBP, newerGlucose, middleKetone];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getReadings().subscribe(readings => {
        expect(readings.length).toBe(3);
        expect(readings[0].id).toBe('newer');
        expect(readings[1].id).toBe('middle');
        expect(readings[2].id).toBe('older');
        done();
      });
    });

    it('should filter by blood_pressure type', (done) => {
      const bp = createStoredBP({ id: 'bp-1' });
      const glucose = createStoredGlucose({ id: 'glucose-1' });
      const ketone = createStoredKetone({ id: 'ketone-1' });

      mockAppData.healthReadings = [bp, glucose, ketone];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getReadings('blood_pressure').subscribe(readings => {
        expect(readings.length).toBe(1);
        expect(readings[0].type).toBe('blood_pressure');
        done();
      });
    });

    it('should filter by blood_glucose type', (done) => {
      const bp = createStoredBP({ id: 'bp-1' });
      const glucose = createStoredGlucose({ id: 'glucose-1' });
      const ketone = createStoredKetone({ id: 'ketone-1' });

      mockAppData.healthReadings = [bp, glucose, ketone];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getReadings('blood_glucose').subscribe(readings => {
        expect(readings.length).toBe(1);
        expect(readings[0].type).toBe('blood_glucose');
        done();
      });
    });

    it('should filter by ketone type', (done) => {
      const bp = createStoredBP({ id: 'bp-1' });
      const glucose = createStoredGlucose({ id: 'glucose-1' });
      const ketone = createStoredKetone({ id: 'ketone-1' });

      mockAppData.healthReadings = [bp, glucose, ketone];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getReadings('ketone').subscribe(readings => {
        expect(readings.length).toBe(1);
        expect(readings[0].type).toBe('ketone');
        done();
      });
    });
  });

  describe('addBloodPressure - valid data', () => {
    it('should add a blood pressure reading', (done) => {
      const input = createValidBP();

      service.addBloodPressure(input).subscribe(reading => {
        expect(reading.id).toBeDefined();
        expect(reading.type).toBe('blood_pressure');
        expect(reading.systolic).toBe(120);
        expect(reading.diastolic).toBe(80);
        expect(reading.createdAt).toBeDefined();
        expect(storageServiceSpy.saveData).toHaveBeenCalled();
        done();
      });
    });

    it('should accept minimum valid systolic (60)', (done) => {
      const input = createValidBP({ systolic: 60, diastolic: 40 });

      service.addBloodPressure(input).subscribe(reading => {
        expect(reading.systolic).toBe(60);
        done();
      });
    });

    it('should accept maximum valid systolic (250)', (done) => {
      const input = createValidBP({ systolic: 250 });

      service.addBloodPressure(input).subscribe(reading => {
        expect(reading.systolic).toBe(250);
        done();
      });
    });

    it('should accept minimum valid diastolic (40)', (done) => {
      const input = createValidBP({ diastolic: 40 });

      service.addBloodPressure(input).subscribe(reading => {
        expect(reading.diastolic).toBe(40);
        done();
      });
    });

    it('should accept maximum valid diastolic (150)', (done) => {
      const input = createValidBP({ systolic: 200, diastolic: 150 });

      service.addBloodPressure(input).subscribe(reading => {
        expect(reading.diastolic).toBe(150);
        done();
      });
    });
  });

  describe('addBloodPressure - invalid data', () => {
    it('should reject systolic below minimum (59)', (done) => {
      const input = createValidBP({ systolic: 59 });

      service.addBloodPressure(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: ReadingsValidationError) => {
          expect(err.errors.some(e => e.field === 'systolic')).toBeTrue();
          done();
        }
      });
    });

    it('should reject systolic above maximum (251)', (done) => {
      const input = createValidBP({ systolic: 251 });

      service.addBloodPressure(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: ReadingsValidationError) => {
          expect(err.errors.some(e => e.field === 'systolic')).toBeTrue();
          done();
        }
      });
    });

    it('should reject diastolic below minimum (39)', (done) => {
      const input = createValidBP({ diastolic: 39 });

      service.addBloodPressure(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: ReadingsValidationError) => {
          expect(err.errors.some(e => e.field === 'diastolic')).toBeTrue();
          done();
        }
      });
    });

    it('should reject diastolic above maximum (151)', (done) => {
      const input = createValidBP({ systolic: 200, diastolic: 151 });

      service.addBloodPressure(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: ReadingsValidationError) => {
          expect(err.errors.some(e => e.field === 'diastolic')).toBeTrue();
          done();
        }
      });
    });

    it('should reject systolic <= diastolic', (done) => {
      const input = createValidBP({ systolic: 80, diastolic: 80 });

      service.addBloodPressure(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: ReadingsValidationError) => {
          expect(err.errors.some(e => e.message.includes('greater than'))).toBeTrue();
          done();
        }
      });
    });
  });

  describe('addBloodGlucose - valid data', () => {
    it('should add a blood glucose reading', (done) => {
      const input = createValidGlucose();

      service.addBloodGlucose(input).subscribe(reading => {
        expect(reading.id).toBeDefined();
        expect(reading.type).toBe('blood_glucose');
        expect(reading.glucoseMmol).toBe(5.5);
        expect(storageServiceSpy.saveData).toHaveBeenCalled();
        done();
      });
    });

    it('should accept minimum valid glucose (1.0)', (done) => {
      const input = createValidGlucose({ glucoseMmol: 1.0 });

      service.addBloodGlucose(input).subscribe(reading => {
        expect(reading.glucoseMmol).toBe(1.0);
        done();
      });
    });

    it('should accept maximum valid glucose (35.0)', (done) => {
      const input = createValidGlucose({ glucoseMmol: 35.0 });

      service.addBloodGlucose(input).subscribe(reading => {
        expect(reading.glucoseMmol).toBe(35.0);
        done();
      });
    });
  });

  describe('addBloodGlucose - invalid data', () => {
    it('should reject glucose below minimum (0.9)', (done) => {
      const input = createValidGlucose({ glucoseMmol: 0.9 });

      service.addBloodGlucose(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: ReadingsValidationError) => {
          expect(err.errors.some(e => e.field === 'glucoseMmol')).toBeTrue();
          done();
        }
      });
    });

    it('should reject glucose above maximum (35.1)', (done) => {
      const input = createValidGlucose({ glucoseMmol: 35.1 });

      service.addBloodGlucose(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: ReadingsValidationError) => {
          expect(err.errors.some(e => e.field === 'glucoseMmol')).toBeTrue();
          done();
        }
      });
    });
  });

  describe('addKetone - valid data', () => {
    it('should add a ketone reading', (done) => {
      const input = createValidKetone();

      service.addKetone(input).subscribe(reading => {
        expect(reading.id).toBeDefined();
        expect(reading.type).toBe('ketone');
        expect(reading.ketoneMmol).toBe(0.5);
        expect(storageServiceSpy.saveData).toHaveBeenCalled();
        done();
      });
    });

    it('should accept minimum valid ketone (0.0)', (done) => {
      const input = createValidKetone({ ketoneMmol: 0.0 });

      service.addKetone(input).subscribe(reading => {
        expect(reading.ketoneMmol).toBe(0.0);
        done();
      });
    });

    it('should accept maximum valid ketone (10.0)', (done) => {
      const input = createValidKetone({ ketoneMmol: 10.0 });

      service.addKetone(input).subscribe(reading => {
        expect(reading.ketoneMmol).toBe(10.0);
        done();
      });
    });
  });

  describe('addKetone - invalid data', () => {
    it('should reject ketone below minimum (-0.1)', (done) => {
      const input = createValidKetone({ ketoneMmol: -0.1 });

      service.addKetone(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: ReadingsValidationError) => {
          expect(err.errors.some(e => e.field === 'ketoneMmol')).toBeTrue();
          done();
        }
      });
    });

    it('should reject ketone above maximum (10.1)', (done) => {
      const input = createValidKetone({ ketoneMmol: 10.1 });

      service.addKetone(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: ReadingsValidationError) => {
          expect(err.errors.some(e => e.field === 'ketoneMmol')).toBeTrue();
          done();
        }
      });
    });
  });

  describe('getReading', () => {
    it('should return reading when ID exists', (done) => {
      const existingBP = createStoredBP({ id: 'existing-id' });
      mockAppData.healthReadings = [existingBP];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getReading('existing-id').subscribe(reading => {
        expect(reading).not.toBeNull();
        expect(reading?.id).toBe('existing-id');
        done();
      });
    });

    it('should return null when ID does not exist', (done) => {
      mockAppData.healthReadings = [];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getReading('non-existing-id').subscribe(reading => {
        expect(reading).toBeNull();
        done();
      });
    });
  });

  describe('deleteReading', () => {
    it('should delete an existing reading and persist', (done) => {
      mockAppData.healthReadings = [
        createStoredBP({ id: 'id-1' }),
        createStoredGlucose({ id: 'id-2' })
      ];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.deleteReading('id-1').subscribe(result => {
        expect(result).toBeTrue();
        expect(storageServiceSpy.saveData).toHaveBeenCalled();

        const savedData = storageServiceSpy.saveData.calls.mostRecent().args[0];
        expect(savedData.healthReadings.map(r => r.id)).toEqual(['id-2']);
        done();
      });
    });

    it('should return false and not persist when ID does not exist', (done) => {
      mockAppData.healthReadings = [createStoredKetone({ id: 'id-1' })];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.deleteReading('missing-id').subscribe(result => {
        expect(result).toBeFalse();
        expect(storageServiceSpy.saveData).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
