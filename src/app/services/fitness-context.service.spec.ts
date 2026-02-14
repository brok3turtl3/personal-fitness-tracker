import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { FitnessContextService } from './fitness-context.service';
import { StorageService } from './storage.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';

describe('FitnessContextService', () => {
  let service: FitnessContextService;
  let mockAppData: AppData;
  let mockStorageService: jasmine.SpyObj<StorageService>;

  beforeEach(() => {
    mockAppData = createEmptyAppData();

    mockStorageService = jasmine.createSpyObj('StorageService', ['getData']);
    mockStorageService.getData.and.callFake(() => of(mockAppData));

    TestBed.configureTestingModule({
      providers: [
        FitnessContextService,
        { provide: StorageService, useValue: mockStorageService }
      ]
    });

    service = TestBed.inject(FitnessContextService);
  });

  describe('buildSystemPrompt', () => {
    it('should include fitness expert persona', async () => {
      const prompt = await firstValueFrom(service.buildSystemPrompt());
      expect(prompt).toContain('health and fitness expert');
      expect(prompt).toContain('Current Fitness Data');
    });

    it('should handle empty data gracefully', async () => {
      const prompt = await firstValueFrom(service.buildSystemPrompt());
      expect(prompt).toContain('No weight entries recorded');
      expect(prompt).toContain('No cardio sessions');
      expect(prompt).toContain('No meal entries');
      expect(prompt).toContain('No health readings');
    });

    it('should include weight data when available', async () => {
      const now = new Date().toISOString();
      mockAppData.weightEntries = [
        { id: '1', date: now, weightLbs: 180, createdAt: now, updatedAt: now },
        { id: '2', date: new Date(Date.now() - 86400000).toISOString(), weightLbs: 181, createdAt: now, updatedAt: now }
      ];

      const prompt = await firstValueFrom(service.buildSystemPrompt());
      expect(prompt).toContain('180 lbs');
      expect(prompt).toContain('Weight Trend');
    });

    it('should include cardio data when available', async () => {
      const now = new Date().toISOString();
      mockAppData.cardioSessions = [
        {
          id: '1', date: now, type: 'running', durationMinutes: 30,
          createdAt: now, updatedAt: now
        }
      ];

      const prompt = await firstValueFrom(service.buildSystemPrompt());
      expect(prompt).toContain('1 sessions');
      expect(prompt).toContain('30 min');
      expect(prompt).toContain('running');
    });

    it('should include health readings when available', async () => {
      const now = new Date().toISOString();
      mockAppData.healthReadings = [
        {
          id: '1', date: now, type: 'blood_pressure',
          systolic: 120, diastolic: 80,
          createdAt: now, updatedAt: now
        },
        {
          id: '2', date: now, type: 'blood_glucose',
          glucoseMmol: 5.5,
          createdAt: now, updatedAt: now
        }
      ];

      const prompt = await firstValueFrom(service.buildSystemPrompt());
      expect(prompt).toContain('120/80');
      expect(prompt).toContain('5.5 mmol/L');
    });

    it('should include nutrition data when available', async () => {
      const now = new Date().toISOString();
      mockAppData.mealEntries = [
        {
          id: '1', dateTime: now, items: [],
          totals: {
            caloriesKcal: 2000, proteinG: 150, fatG: 80, carbsG: 200,
            fiberG: 30, sugarG: 50, sodiumMg: 2000, netCarbsG: 170
          },
          createdAt: now, updatedAt: now
        }
      ];

      const prompt = await firstValueFrom(service.buildSystemPrompt());
      expect(prompt).toContain('2000 kcal');
      expect(prompt).toContain('P: 150g');
    });
  });
});
