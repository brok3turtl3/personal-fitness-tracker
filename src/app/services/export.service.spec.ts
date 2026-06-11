import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ExportService, escapeCsvField } from './export.service';
import { WeightService } from './weight.service';
import { ReadingsService } from './readings.service';
import { CardioService } from './cardio.service';
import { WeightEntry } from '../models/weight-entry.model';
import { CardioSession } from '../models/cardio-session.model';
import {
  BloodPressureReading,
  BloodGlucoseReading,
  KetoneReading,
  HealthReading
} from '../models/health-reading.model';

describe('ExportService', () => {
  let service: ExportService;
  let weightServiceSpy: jasmine.SpyObj<WeightService>;
  let readingsServiceSpy: jasmine.SpyObj<ReadingsService>;
  let cardioServiceSpy: jasmine.SpyObj<CardioService>;

  const createWeightEntry = (overrides: Partial<WeightEntry> = {}): WeightEntry => ({
    id: 'w-1',
    date: '2025-01-27T10:00:00.000Z',
    weightLbs: 165,
    createdAt: '2025-01-27T10:00:00.000Z',
    updatedAt: '2025-01-27T10:00:00.000Z',
    ...overrides
  });

  const createBpReading = (overrides: Partial<BloodPressureReading> = {}): BloodPressureReading => ({
    id: 'r-1',
    type: 'blood_pressure',
    date: '2025-01-27T08:00:00.000Z',
    systolic: 120,
    diastolic: 80,
    createdAt: '2025-01-27T08:00:00.000Z',
    updatedAt: '2025-01-27T08:00:00.000Z',
    ...overrides
  });

  const createCardioSession = (overrides: Partial<CardioSession> = {}): CardioSession => ({
    id: 'c-1',
    date: '2025-01-27T06:00:00.000Z',
    type: 'running',
    durationMinutes: 30,
    distanceKm: 5.2,
    caloriesBurned: 320,
    createdAt: '2025-01-27T06:00:00.000Z',
    updatedAt: '2025-01-27T06:00:00.000Z',
    ...overrides
  });

  beforeEach(() => {
    weightServiceSpy = jasmine.createSpyObj('WeightService', ['getEntries']);
    readingsServiceSpy = jasmine.createSpyObj('ReadingsService', ['getReadings']);
    cardioServiceSpy = jasmine.createSpyObj('CardioService', ['getSessions']);
    weightServiceSpy.getEntries.and.returnValue(of([]));
    readingsServiceSpy.getReadings.and.returnValue(of([]));
    cardioServiceSpy.getSessions.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        ExportService,
        { provide: WeightService, useValue: weightServiceSpy },
        { provide: ReadingsService, useValue: readingsServiceSpy },
        { provide: CardioService, useValue: cardioServiceSpy }
      ]
    });

    service = TestBed.inject(ExportService);
  });

  describe('escapeCsvField', () => {
    it('should return empty string for undefined and null', () => {
      expect(escapeCsvField(undefined)).toBe('');
      expect(escapeCsvField(null)).toBe('');
    });

    it('should leave plain values unquoted', () => {
      expect(escapeCsvField('hello')).toBe('hello');
      expect(escapeCsvField(165)).toBe('165');
    });

    it('should quote fields containing a comma', () => {
      expect(escapeCsvField('a, b')).toBe('"a, b"');
    });

    it('should quote and double embedded quotes', () => {
      expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    });

    it('should quote fields containing newlines', () => {
      expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
      expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
    });
  });

  describe('buildWeightCsv', () => {
    it('should emit only the header row for empty data', () => {
      const csv = service.buildWeightCsv([]);
      expect(csv).toBe('id,date,weightLbs,notes,createdAt,updatedAt');
    });

    it('should produce correct values for a representative entry', () => {
      const csv = service.buildWeightCsv([
        createWeightEntry({ notes: 'Morning weigh-in' })
      ]);
      const lines = csv.split('\r\n');
      expect(lines.length).toBe(2);
      expect(lines[0]).toBe('id,date,weightLbs,notes,createdAt,updatedAt');
      expect(lines[1]).toBe(
        'w-1,2025-01-27T10:00:00.000Z,165,Morning weigh-in,2025-01-27T10:00:00.000Z,2025-01-27T10:00:00.000Z'
      );
    });

    it('should leave the notes field blank when omitted', () => {
      const csv = service.buildWeightCsv([createWeightEntry()]);
      const lines = csv.split('\r\n');
      // notes is the 4th column → empty between two commas
      expect(lines[1]).toContain('165,,2025-01-27T10:00:00.000Z');
    });

    it('should escape notes containing commas, quotes and newlines', () => {
      const csv = service.buildWeightCsv([
        createWeightEntry({ notes: 'felt "great", then\ntired' })
      ]);
      const lines = csv.split('\r\n');
      // The escaped multi-line field keeps its internal newline, so the
      // record spans more than one physical line.
      expect(csv).toContain('"felt ""great"", then\ntired"');
      expect(lines[0]).toBe('id,date,weightLbs,notes,createdAt,updatedAt');
    });

    it('should emit one record per entry', () => {
      const csv = service.buildWeightCsv([
        createWeightEntry({ id: 'w-1' }),
        createWeightEntry({ id: 'w-2' })
      ]);
      const lines = csv.split('\r\n');
      expect(lines.length).toBe(3);
      expect(lines[1].startsWith('w-1,')).toBeTrue();
      expect(lines[2].startsWith('w-2,')).toBeTrue();
    });
  });

  describe('buildReadingsCsv', () => {
    it('should emit only the header row for empty data', () => {
      const csv = service.buildReadingsCsv([]);
      expect(csv).toBe(
        'id,type,date,systolic,diastolic,glucoseMmol,ketoneMmol,notes,createdAt,updatedAt'
      );
    });

    it('should populate systolic/diastolic for a blood pressure reading', () => {
      const csv = service.buildReadingsCsv([createBpReading({ notes: 'resting' })]);
      const lines = csv.split('\r\n');
      expect(lines[1]).toBe(
        'r-1,blood_pressure,2025-01-27T08:00:00.000Z,120,80,,,resting,2025-01-27T08:00:00.000Z,2025-01-27T08:00:00.000Z'
      );
    });

    it('should populate only the glucose column for a glucose reading', () => {
      const glucose: BloodGlucoseReading = {
        id: 'r-2',
        type: 'blood_glucose',
        date: '2025-01-27T09:00:00.000Z',
        glucoseMmol: 5.4,
        createdAt: '2025-01-27T09:00:00.000Z',
        updatedAt: '2025-01-27T09:00:00.000Z'
      };
      const csv = service.buildReadingsCsv([glucose]);
      const lines = csv.split('\r\n');
      expect(lines[1]).toBe(
        'r-2,blood_glucose,2025-01-27T09:00:00.000Z,,,5.4,,,2025-01-27T09:00:00.000Z,2025-01-27T09:00:00.000Z'
      );
    });

    it('should populate only the ketone column for a ketone reading', () => {
      const ketone: KetoneReading = {
        id: 'r-3',
        type: 'ketone',
        date: '2025-01-27T07:00:00.000Z',
        ketoneMmol: 1.2,
        createdAt: '2025-01-27T07:00:00.000Z',
        updatedAt: '2025-01-27T07:00:00.000Z'
      };
      const csv = service.buildReadingsCsv([ketone]);
      const lines = csv.split('\r\n');
      expect(lines[1]).toBe(
        'r-3,ketone,2025-01-27T07:00:00.000Z,,,,1.2,,2025-01-27T07:00:00.000Z,2025-01-27T07:00:00.000Z'
      );
    });

    it('should escape notes containing a comma', () => {
      const csv = service.buildReadingsCsv([
        createBpReading({ notes: 'after coffee, before lunch' })
      ]);
      expect(csv).toContain(',"after coffee, before lunch",');
    });

    it('should emit one record per reading across mixed types', () => {
      const readings: HealthReading[] = [
        createBpReading({ id: 'r-1' }),
        {
          id: 'r-2',
          type: 'ketone',
          date: '2025-01-27T07:00:00.000Z',
          ketoneMmol: 0.8,
          createdAt: '2025-01-27T07:00:00.000Z',
          updatedAt: '2025-01-27T07:00:00.000Z'
        }
      ];
      const csv = service.buildReadingsCsv(readings);
      const lines = csv.split('\r\n');
      expect(lines.length).toBe(3);
      expect(lines[1].startsWith('r-1,blood_pressure,')).toBeTrue();
      expect(lines[2].startsWith('r-2,ketone,')).toBeTrue();
    });
  });

  describe('buildCardioCsv', () => {
    it('should emit only the header row for empty data', () => {
      const csv = service.buildCardioCsv([]);
      expect(csv).toBe(
        'id,date,type,durationMinutes,distanceKm,caloriesBurned,notes,createdAt,updatedAt'
      );
    });

    it('should produce correct values for a representative session', () => {
      const csv = service.buildCardioCsv([
        createCardioSession({ notes: 'Morning run' })
      ]);
      const lines = csv.split('\r\n');
      expect(lines.length).toBe(2);
      expect(lines[0]).toBe(
        'id,date,type,durationMinutes,distanceKm,caloriesBurned,notes,createdAt,updatedAt'
      );
      expect(lines[1]).toBe(
        'c-1,2025-01-27T06:00:00.000Z,running,30,5.2,320,Morning run,2025-01-27T06:00:00.000Z,2025-01-27T06:00:00.000Z'
      );
    });

    it('should leave optional distance and calories blank when omitted', () => {
      const csv = service.buildCardioCsv([
        createCardioSession({ distanceKm: undefined, caloriesBurned: undefined })
      ]);
      const lines = csv.split('\r\n');
      // distanceKm and caloriesBurned are columns 5 and 6 → empty between commas
      expect(lines[1]).toBe(
        'c-1,2025-01-27T06:00:00.000Z,running,30,,,,2025-01-27T06:00:00.000Z,2025-01-27T06:00:00.000Z'
      );
    });

    it('should escape notes containing commas, quotes and newlines', () => {
      const csv = service.buildCardioCsv([
        createCardioSession({ notes: 'hard "intervals", then\ncooldown' })
      ]);
      expect(csv).toContain('"hard ""intervals"", then\ncooldown"');
    });

    it('should emit one record per session', () => {
      const csv = service.buildCardioCsv([
        createCardioSession({ id: 'c-1' }),
        createCardioSession({ id: 'c-2', type: 'cycling' })
      ]);
      const lines = csv.split('\r\n');
      expect(lines.length).toBe(3);
      expect(lines[1].startsWith('c-1,')).toBeTrue();
      expect(lines[2].startsWith('c-2,2025-01-27T06:00:00.000Z,cycling,')).toBeTrue();
    });
  });

  describe('getWeightCsv / getReadingsCsv / getCardioCsv', () => {
    it('should pull weight entries through WeightService', (done) => {
      weightServiceSpy.getEntries.and.returnValue(of([createWeightEntry()]));
      service.getWeightCsv().subscribe(csv => {
        expect(weightServiceSpy.getEntries).toHaveBeenCalled();
        expect(csv.split('\r\n').length).toBe(2);
        done();
      });
    });

    it('should pull readings through ReadingsService', (done) => {
      readingsServiceSpy.getReadings.and.returnValue(of([createBpReading()]));
      service.getReadingsCsv().subscribe(csv => {
        expect(readingsServiceSpy.getReadings).toHaveBeenCalled();
        expect(csv.split('\r\n').length).toBe(2);
        done();
      });
    });

    it('should pull cardio sessions through CardioService', (done) => {
      cardioServiceSpy.getSessions.and.returnValue(of([createCardioSession()]));
      service.getCardioCsv().subscribe(csv => {
        expect(cardioServiceSpy.getSessions).toHaveBeenCalled();
        expect(csv.split('\r\n').length).toBe(2);
        done();
      });
    });
  });

  describe('triggerDownload', () => {
    it('should create and click an anchor with the given filename', () => {
      const anchor = document.createElement('a');
      const clickSpy = spyOn(anchor, 'click');
      spyOn(document, 'createElement').and.returnValue(anchor);
      spyOn(document.body, 'appendChild').and.callThrough();
      spyOn(document.body, 'removeChild').and.callThrough();
      spyOn(URL, 'createObjectURL').and.returnValue('blob:fake');
      const revokeSpy = spyOn(URL, 'revokeObjectURL');

      service.triggerDownload('weight-entries.csv', 'id,date\n');

      expect(anchor.download).toBe('weight-entries.csv');
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeSpy).toHaveBeenCalledWith('blob:fake');
    });
  });
});
