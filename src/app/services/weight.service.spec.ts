import { TestBed } from '@angular/core/testing';
import { WeightService, WeightValidationError } from './weight.service';
import { StorageService } from './storage.service';
import { WeightEntry, CreateWeightEntry } from '../models/weight-entry.model';
import { AppData, createEmptyAppData } from '../models/app-data.model';
import { of } from 'rxjs';

describe('WeightService', () => {
  let service: WeightService;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;
  let mockAppData: AppData;

  // Helper to create a valid weight entry input
  const createValidEntry = (overrides: Partial<CreateWeightEntry> = {}): CreateWeightEntry => ({
    date: '2025-01-27T10:00:00.000Z',
    weightLbs: 165,
    ...overrides
  });

  // Helper to create a WeightEntry (as stored)
  const createStoredEntry = (overrides: Partial<WeightEntry> = {}): WeightEntry => ({
    id: 'test-uuid-1',
    date: '2025-01-27T10:00:00.000Z',
    weightLbs: 165,
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
        WeightService,
        { provide: StorageService, useValue: storageServiceSpy }
      ]
    });

    service = TestBed.inject(WeightService);
  });

  describe('getEntries', () => {
    it('should return empty array when no entries exist', (done) => {
      service.getEntries().subscribe(entries => {
        expect(entries).toEqual([]);
        done();
      });
    });

    it('should return entries sorted by date (newest first)', (done) => {
      const olderEntry = createStoredEntry({ 
        id: 'older',
        date: '2025-01-25T10:00:00.000Z' 
      });
      const newerEntry = createStoredEntry({ 
        id: 'newer',
        date: '2025-01-27T10:00:00.000Z' 
      });
      const middleEntry = createStoredEntry({ 
        id: 'middle',
        date: '2025-01-26T10:00:00.000Z' 
      });

      mockAppData.weightEntries = [olderEntry, newerEntry, middleEntry];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getEntries().subscribe(entries => {
        expect(entries.length).toBe(3);
        expect(entries[0].id).toBe('newer');
        expect(entries[1].id).toBe('middle');
        expect(entries[2].id).toBe('older');
        done();
      });
    });

    it('should return all entries with all properties', (done) => {
      const entryWithNotes = createStoredEntry({
        weightLbs: 170.5,
        notes: 'After breakfast'
      });
      mockAppData.weightEntries = [entryWithNotes];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getEntries().subscribe(entries => {
        expect(entries.length).toBe(1);
        expect(entries[0].weightLbs).toBe(170.5);
        expect(entries[0].notes).toBe('After breakfast');
        done();
      });
    });
  });

  describe('addEntry - valid data', () => {
    it('should add an entry with required fields only', (done) => {
      const input = createValidEntry();

      service.addEntry(input).subscribe(entry => {
        expect(entry.id).toBeDefined();
        expect(entry.date).toBe(input.date);
        expect(entry.weightLbs).toBe(input.weightLbs);
        expect(entry.createdAt).toBeDefined();
        expect(entry.updatedAt).toBeDefined();
        expect(storageServiceSpy.saveData).toHaveBeenCalled();
        done();
      });
    });

    it('should add an entry with notes', (done) => {
      const input = createValidEntry({
        notes: 'Morning weigh-in'
      });

      service.addEntry(input).subscribe(entry => {
        expect(entry.notes).toBe('Morning weigh-in');
        done();
      });
    });

    it('should generate unique ID for each entry', (done) => {
      const input1 = createValidEntry();
      const input2 = createValidEntry();

      service.addEntry(input1).subscribe(entry1 => {
        service.addEntry(input2).subscribe(entry2 => {
          expect(entry1.id).not.toBe(entry2.id);
          done();
        });
      });
    });

    it('should set createdAt and updatedAt to current time', (done) => {
      const before = new Date().toISOString();
      const input = createValidEntry();

      service.addEntry(input).subscribe(entry => {
        const after = new Date().toISOString();
        expect(entry.createdAt >= before).toBeTrue();
        expect(entry.createdAt <= after).toBeTrue();
        expect(entry.updatedAt).toBe(entry.createdAt);
        done();
      });
    });

    it('should persist the entry to storage', (done) => {
      const input = createValidEntry();

      service.addEntry(input).subscribe(() => {
        expect(storageServiceSpy.saveData).toHaveBeenCalled();
        const savedData = storageServiceSpy.saveData.calls.mostRecent().args[0];
        expect(savedData.weightEntries.length).toBe(1);
        expect(savedData.weightEntries[0].weightLbs).toBe(input.weightLbs);
        done();
      });
    });

    it('should accept minimum valid weight (50 lbs)', (done) => {
      const input = createValidEntry({ weightLbs: 50 });

      service.addEntry(input).subscribe(entry => {
        expect(entry.weightLbs).toBe(50);
        done();
      });
    });

    it('should accept maximum valid weight (1000 lbs)', (done) => {
      const input = createValidEntry({ weightLbs: 1000 });

      service.addEntry(input).subscribe(entry => {
        expect(entry.weightLbs).toBe(1000);
        done();
      });
    });

    it('should accept decimal weight values', (done) => {
      const input = createValidEntry({ weightLbs: 165.5 });

      service.addEntry(input).subscribe(entry => {
        expect(entry.weightLbs).toBe(165.5);
        done();
      });
    });
  });

  describe('addEntry - invalid data', () => {
    it('should reject missing date', (done) => {
      const input = createValidEntry({ date: '' });

      service.addEntry(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: WeightValidationError) => {
          expect(err).toBeInstanceOf(WeightValidationError);
          expect(err.errors.some(e => e.field === 'date')).toBeTrue();
          expect(storageServiceSpy.saveData).not.toHaveBeenCalled();
          done();
        }
      });
    });

    it('should reject invalid date format', (done) => {
      const input = createValidEntry({ date: 'not-a-date' });

      service.addEntry(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: WeightValidationError) => {
          expect(err.errors.some(e => e.field === 'date')).toBeTrue();
          done();
        }
      });
    });

    it('should reject weight below minimum (49 lbs)', (done) => {
      const input = createValidEntry({ weightLbs: 49 });

      service.addEntry(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: WeightValidationError) => {
          expect(err.errors.some(e => e.field === 'weightLbs')).toBeTrue();
          done();
        }
      });
    });

    it('should reject weight above maximum (1001 lbs)', (done) => {
      const input = createValidEntry({ weightLbs: 1001 });

      service.addEntry(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: WeightValidationError) => {
          expect(err.errors.some(e => e.field === 'weightLbs')).toBeTrue();
          done();
        }
      });
    });

    it('should reject notes exceeding 500 characters', (done) => {
      const input = createValidEntry({ notes: 'a'.repeat(501) });

      service.addEntry(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: WeightValidationError) => {
          expect(err.errors.some(e => e.field === 'notes')).toBeTrue();
          done();
        }
      });
    });

    it('should include all validation errors in response', (done) => {
      const input = {
        date: '',
        weightLbs: 0
      };

      service.addEntry(input).subscribe({
        next: () => fail('Expected error'),
        error: (err: WeightValidationError) => {
          expect(err.errors.length).toBeGreaterThanOrEqual(2);
          expect(err.errors.some(e => e.field === 'date')).toBeTrue();
          expect(err.errors.some(e => e.field === 'weightLbs')).toBeTrue();
          done();
        }
      });
    });
  });

  describe('getEntry', () => {
    it('should return entry when ID exists', (done) => {
      const existingEntry = createStoredEntry({ id: 'existing-id' });
      mockAppData.weightEntries = [existingEntry];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getEntry('existing-id').subscribe(entry => {
        expect(entry).not.toBeNull();
        expect(entry?.id).toBe('existing-id');
        done();
      });
    });

    it('should return null when ID does not exist', (done) => {
      mockAppData.weightEntries = [];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getEntry('non-existing-id').subscribe(entry => {
        expect(entry).toBeNull();
        done();
      });
    });

    it('should return correct entry when multiple exist', (done) => {
      const entry1 = createStoredEntry({ id: 'id-1', weightLbs: 160 });
      const entry2 = createStoredEntry({ id: 'id-2', weightLbs: 165 });
      const entry3 = createStoredEntry({ id: 'id-3', weightLbs: 170 });
      mockAppData.weightEntries = [entry1, entry2, entry3];
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.getEntry('id-2').subscribe(entry => {
        expect(entry?.id).toBe('id-2');
        expect(entry?.weightLbs).toBe(165);
        done();
      });
    });
  });
});
