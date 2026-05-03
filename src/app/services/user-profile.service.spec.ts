import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { UserProfileService } from './user-profile.service';
import { StorageService } from './storage.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';
import { DEFAULT_USER_PROFILE, UserProfile } from '../models/user-profile.model';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;
  let mockAppData: AppData;

  beforeEach(() => {
    mockAppData = createEmptyAppData();

    storageServiceSpy = jasmine.createSpyObj('StorageService', [
      'initialize',
      'getData',
      'saveData',
    ]);
    storageServiceSpy.initialize.and.returnValue(of(undefined));
    storageServiceSpy.getData.and.returnValue(of(mockAppData));
    storageServiceSpy.saveData.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        UserProfileService,
        { provide: StorageService, useValue: storageServiceSpy },
      ],
    });

    service = TestBed.inject(UserProfileService);
  });

  describe('getProfile', () => {
    it('returns DEFAULT_USER_PROFILE when AppData has no userProfile', (done) => {
      // Simulate a partial AppData without userProfile (defensive null-coalesce path).
      const partial = { ...mockAppData } as Partial<AppData> as AppData;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (partial as any).userProfile = undefined;
      storageServiceSpy.getData.and.returnValue(of(partial));

      service.getProfile().subscribe((profile) => {
        expect(profile).toEqual({ ...DEFAULT_USER_PROFILE });
        done();
      });
    });

    it('returns the persisted profile when set', (done) => {
      const stored: UserProfile = {
        goals: 'lose 15 lbs',
        preferences: 'morning workouts',
        dietaryConstraints: 'no dairy',
        trainingHistory: '2 years lifting',
        updatedAt: '2026-05-03T10:00:00.000Z',
      };
      mockAppData.userProfile = stored;

      service.getProfile().subscribe((profile) => {
        expect(profile).toEqual(stored);
        done();
      });
    });
  });

  describe('saveProfile', () => {
    it('persists with updatedAt set to current ISO string', (done) => {
      const profile: UserProfile = {
        goals: 'a',
        preferences: 'b',
        dietaryConstraints: 'c',
        trainingHistory: 'd',
        updatedAt: '2020-01-01T00:00:00.000Z', // stale; should be overwritten
      };

      service.saveProfile(profile).subscribe({
        next: () => {
          expect(storageServiceSpy.saveData).toHaveBeenCalledTimes(1);
          const saved = storageServiceSpy.saveData.calls.mostRecent()
            .args[0] as AppData;
          expect(saved.userProfile.goals).toBe('a');
          expect(saved.userProfile.preferences).toBe('b');
          expect(saved.userProfile.dietaryConstraints).toBe('c');
          expect(saved.userProfile.trainingHistory).toBe('d');
          // updatedAt rewritten to a fresh ISO string (truthy, not the stale 2020 value)
          expect(saved.userProfile.updatedAt).toBeTruthy();
          expect(saved.userProfile.updatedAt).not.toBe(
            '2020-01-01T00:00:00.000Z'
          );
          // ISO 8601 format check: matches YYYY-MM-DDTHH:MM:SS.sssZ
          expect(saved.userProfile.updatedAt).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
          );
          done();
        },
        error: (err) => done.fail(`unexpected error: ${err.message}`),
      });
    });

    it('saveProfile with empty strings (DEFAULT) is valid', (done) => {
      service.saveProfile({ ...DEFAULT_USER_PROFILE }).subscribe({
        next: () => {
          expect(storageServiceSpy.saveData).toHaveBeenCalledTimes(1);
          done();
        },
        error: (err) => done.fail(`unexpected error: ${err.message}`),
      });
    });

    it('rejects when goals exceeds 4096 characters', (done) => {
      const profile: UserProfile = {
        ...DEFAULT_USER_PROFILE,
        goals: 'x'.repeat(4097),
      };

      service.saveProfile(profile).subscribe({
        next: () => done.fail('expected validation error'),
        error: (err: Error) => {
          expect(err.message).toContain('4096');
          expect(err.message).toContain('goals');
          expect(storageServiceSpy.saveData).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('reports all 4 violations when all sections are over the cap', (done) => {
      const big = 'x'.repeat(4097);
      const profile: UserProfile = {
        goals: big,
        preferences: big,
        dietaryConstraints: big,
        trainingHistory: big,
        updatedAt: '',
      };

      service.saveProfile(profile).subscribe({
        next: () => done.fail('expected validation error'),
        error: (err: Error) => {
          expect(err.message).toContain('goals');
          expect(err.message).toContain('preferences');
          expect(err.message).toContain('dietaryConstraints');
          expect(err.message).toContain('trainingHistory');
          done();
        },
      });
    });

    it('propagates StorageService.saveData errors', (done) => {
      storageServiceSpy.saveData.and.returnValue(
        throwError(() => new Error('disk full'))
      );

      service.saveProfile({ ...DEFAULT_USER_PROFILE }).subscribe({
        next: () => done.fail('expected error to propagate'),
        error: (err: Error) => {
          expect(err.message).toBe('disk full');
          done();
        },
      });
    });

    it('rejects when storage not initialized', (done) => {
      storageServiceSpy.getData.and.returnValue(of(null));

      service.saveProfile({ ...DEFAULT_USER_PROFILE }).subscribe({
        next: () => done.fail('expected initialization error'),
        error: (err: Error) => {
          expect(err.message).toBe('Storage not initialized');
          done();
        },
      });
    });

    it('accepts exactly 4096 characters (boundary, inclusive cap)', (done) => {
      const profile: UserProfile = {
        ...DEFAULT_USER_PROFILE,
        goals: 'x'.repeat(4096),
      };

      service.saveProfile(profile).subscribe({
        next: () => {
          expect(storageServiceSpy.saveData).toHaveBeenCalledTimes(1);
          done();
        },
        error: (err: Error) =>
          done.fail(`should not reject at exact cap: ${err.message}`),
      });
    });
  });
});
