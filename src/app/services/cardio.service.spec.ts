import { TestBed } from '@angular/core/testing';
import { CardioService, CardioValidationError } from './cardio.service';
import { StorageService } from './storage.service';
import { CardioSession, CreateCardioSession } from '../models/cardio-session.model';
import { AppData, createEmptyAppData } from '../models/app-data.model';
import { of } from 'rxjs';

describe('CardioService', () => {
  let service: CardioService;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;
  let mockAppData: AppData;

  // Helper to create a valid cardio session input
  const createValidSession = (overrides: Partial<CreateCardioSession> = {}): CreateCardioSession => ({
    date: '2025-01-27T10:00:00.000Z',
    type: 'running',
    durationMinutes: 30,
    ...overrides
  });

  // Helper to create a CardioSession (as stored)
  const createStoredSession = (overrides: Partial<CardioSession> = {}): CardioSession => ({
    id: 'test-uuid-1',
    date: '2025-01-27T10:00:00.000Z',
    type: 'running',
    durationMinutes: 30,
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
        CardioService,
        { provide: StorageService, useValue: storageServiceSpy }
      ]
    });

    service = TestBed.inject(CardioService);
  });

  describe('getSessions', () => {
    it('should return empty array when no sessions exist', (done) => {
      service.getSessions().subscribe(sessions => {
        expect(sessions).toEqual([]);
        done();
      });
    });

    it('should return sessions sorted by date (newest first)', (done) => {
      const olderSession = createStoredSession({ 
        id: 'older',
        date: '2025-01-25T10:00:00.000Z' 
      });
      const newerSession = createStoredSession({ 
        id: 'newer',
        date: '2025-01-27T10:00:00.000Z' 
      });
      const middleSession = createStoredSession({ 
        id: 'middle',
        date: '2025-01-26T10:00:00.000Z' 
      });

      mockAppData.cardioSessions = [olderSession, newerSession, middleSession];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getSessions().subscribe(sessions => {
        expect(sessions.length).toBe(3);
        expect(sessions[0].id).toBe('newer');
        expect(sessions[1].id).toBe('middle');
        expect(sessions[2].id).toBe('older');
        done();
      });
    });

    it('should return all sessions with all properties', (done) => {
      const sessionWithNotes = createStoredSession({
        distanceKm: 5.5,
        notes: 'Morning run'
      });
      mockAppData.cardioSessions = [sessionWithNotes];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getSessions().subscribe(sessions => {
        expect(sessions.length).toBe(1);
        expect(sessions[0].distanceKm).toBe(5.5);
        expect(sessions[0].notes).toBe('Morning run');
        done();
      });
    });
  });

  describe('addSession - valid data', () => {
    it('should add a session with required fields only', (done) => {
      const input = createValidSession();

      service.addSession(input).subscribe(session => {
        expect(session.id).toBeDefined();
        expect(session.date).toBe(input.date);
        expect(session.type).toBe(input.type);
        expect(session.durationMinutes).toBe(input.durationMinutes);
        expect(session.createdAt).toBeDefined();
        expect(session.updatedAt).toBeDefined();
        expect(storageServiceSpy.saveData).toHaveBeenCalled();
        done();
      });
    });

    it('should add a session with all fields including optional', (done) => {
      const input = createValidSession({
        distanceKm: 10.5,
        caloriesBurned: 450,
        notes: 'Great workout!'
      });

      service.addSession(input).subscribe(session => {
        expect(session.distanceKm).toBe(10.5);
        expect(session.caloriesBurned).toBe(450);
        expect(session.notes).toBe('Great workout!');
        done();
      });
    });

    it('should preserve zero calories when provided', (done) => {
      const input = createValidSession({ caloriesBurned: 0 });

      service.addSession(input).subscribe(session => {
        expect(session.caloriesBurned).toBe(0);

        const savedData = storageServiceSpy.saveData.calls.mostRecent().args[0];
        expect(savedData.cardioSessions[0].caloriesBurned).toBe(0);
        done();
      });
    });

    it('should generate unique ID for each session', (done) => {
      const input1 = createValidSession();
      const input2 = createValidSession();

      service.addSession(input1).subscribe(session1 => {
        service.addSession(input2).subscribe(session2 => {
          expect(session1.id).not.toBe(session2.id);
          done();
        });
      });
    });

    it('should set createdAt and updatedAt to current time', (done) => {
      const before = new Date().toISOString();
      const input = createValidSession();

      service.addSession(input).subscribe(session => {
        const after = new Date().toISOString();
        expect(session.createdAt >= before).toBeTrue();
        expect(session.createdAt <= after).toBeTrue();
        expect(session.updatedAt).toBe(session.createdAt);
        done();
      });
    });

    it('should persist the session to storage', (done) => {
      const input = createValidSession();

      service.addSession(input).subscribe(() => {
        expect(storageServiceSpy.saveData).toHaveBeenCalled();
        const savedData = storageServiceSpy.saveData.calls.mostRecent().args[0];
        expect(savedData.cardioSessions.length).toBe(1);
        expect(savedData.cardioSessions[0].date).toBe(input.date);
        done();
      });
    });

    it('should accept all valid cardio types', (done) => {
      const types: Array<CreateCardioSession['type']> = [
        'running', 'cycling', 'swimming', 'walking', 'rowing', 'elliptical', 'other'
      ];
      
      let completed = 0;
      types.forEach(type => {
        const input = createValidSession({ type });
        service.addSession(input).subscribe(session => {
          expect(session.type).toBe(type);
          completed++;
          if (completed === types.length) done();
        });
      });
    });

    it('should accept minimum valid duration (1 minute)', (done) => {
      const input = createValidSession({ durationMinutes: 1 });

      service.addSession(input).subscribe(session => {
        expect(session.durationMinutes).toBe(1);
        done();
      });
    });

    it('should accept maximum valid duration (1440 minutes)', (done) => {
      const input = createValidSession({ durationMinutes: 1440 });

      service.addSession(input).subscribe(session => {
        expect(session.durationMinutes).toBe(1440);
        done();
      });
    });

    it('should accept minimum valid distance (0.01 km)', (done) => {
      const input = createValidSession({ distanceKm: 0.01 });

      service.addSession(input).subscribe(session => {
        expect(session.distanceKm).toBe(0.01);
        done();
      });
    });

    it('should accept maximum valid distance (1000 km)', (done) => {
      const input = createValidSession({ distanceKm: 1000 });

      service.addSession(input).subscribe(session => {
        expect(session.distanceKm).toBe(1000);
        done();
      });
    });
  });

  describe('addSession - invalid data', () => {
    it('should reject missing date', (done) => {
      const input = createValidSession({ date: '' });

      service.addSession(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: CardioValidationError) => {
          expect(err).toBeInstanceOf(CardioValidationError);
          expect(err.errors.some(e => e.field === 'date')).toBeTrue();
          expect(storageServiceSpy.saveData).not.toHaveBeenCalled();
          done();
        }
      });
    });

    it('should reject invalid date format', (done) => {
      const input = createValidSession({ date: 'not-a-date' });

      service.addSession(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: CardioValidationError) => {
          expect(err.errors.some(e => e.field === 'date')).toBeTrue();
          done();
        }
      });
    });

    it('should reject invalid cardio type', (done) => {
      const input = createValidSession({ type: 'invalid' as any });

      service.addSession(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: CardioValidationError) => {
          expect(err.errors.some(e => e.field === 'type')).toBeTrue();
          done();
        }
      });
    });

    it('should reject duration below minimum (0)', (done) => {
      const input = createValidSession({ durationMinutes: 0 });

      service.addSession(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: CardioValidationError) => {
          expect(err.errors.some(e => e.field === 'durationMinutes')).toBeTrue();
          done();
        }
      });
    });

    it('should reject duration above maximum (1441)', (done) => {
      const input = createValidSession({ durationMinutes: 1441 });

      service.addSession(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: CardioValidationError) => {
          expect(err.errors.some(e => e.field === 'durationMinutes')).toBeTrue();
          done();
        }
      });
    });

    it('should reject distance below minimum (0.001)', (done) => {
      const input = createValidSession({ distanceKm: 0.001 });

      service.addSession(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: CardioValidationError) => {
          expect(err.errors.some(e => e.field === 'distanceKm')).toBeTrue();
          done();
        }
      });
    });

    it('should reject distance above maximum (1001)', (done) => {
      const input = createValidSession({ distanceKm: 1001 });

      service.addSession(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: CardioValidationError) => {
          expect(err.errors.some(e => e.field === 'distanceKm')).toBeTrue();
          done();
        }
      });
    });

    it('should reject notes exceeding 500 characters', (done) => {
      const input = createValidSession({ notes: 'a'.repeat(501) });

      service.addSession(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: CardioValidationError) => {
          expect(err.errors.some(e => e.field === 'notes')).toBeTrue();
          done();
        }
      });
    });

    it('should include all validation errors in response', (done) => {
      const input = {
        date: '',
        type: 'invalid' as any,
        durationMinutes: 0
      };

      service.addSession(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: CardioValidationError) => {
          expect(err.errors.length).toBeGreaterThanOrEqual(3);
          expect(err.errors.some(e => e.field === 'date')).toBeTrue();
          expect(err.errors.some(e => e.field === 'type')).toBeTrue();
          expect(err.errors.some(e => e.field === 'durationMinutes')).toBeTrue();
          done();
        }
      });
    });
  });

  describe('getSession', () => {
    it('should return session when ID exists', (done) => {
      const existingSession = createStoredSession({ id: 'existing-id' });
      mockAppData.cardioSessions = [existingSession];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getSession('existing-id').subscribe(session => {
        expect(session).not.toBeNull();
        expect(session?.id).toBe('existing-id');
        done();
      });
    });

    it('should return null when ID does not exist', (done) => {
      mockAppData.cardioSessions = [];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getSession('non-existing-id').subscribe(session => {
        expect(session).toBeNull();
        done();
      });
    });

    it('should return correct session when multiple exist', (done) => {
      const session1 = createStoredSession({ id: 'id-1', durationMinutes: 30 });
      const session2 = createStoredSession({ id: 'id-2', durationMinutes: 45 });
      const session3 = createStoredSession({ id: 'id-3', durationMinutes: 60 });
      mockAppData.cardioSessions = [session1, session2, session3];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getSession('id-2').subscribe(session => {
        expect(session?.id).toBe('id-2');
        expect(session?.durationMinutes).toBe(45);
        done();
      });
    });
  });
});
