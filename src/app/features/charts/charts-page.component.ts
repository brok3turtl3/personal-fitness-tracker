import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { forkJoin } from 'rxjs';

import { CardioSession } from '../../models/cardio-session.model';
import {
  BloodGlucoseReading,
  BloodPressureReading,
  HealthReading,
  HealthReadingType,
  KetoneReading,
  READING_TYPES
} from '../../models/health-reading.model';
import { WeightEntry } from '../../models/weight-entry.model';
import { CardioService } from '../../services/cardio.service';
import { ReadingsService } from '../../services/readings.service';
import { StorageService } from '../../services/storage.service';
import { WeightService } from '../../services/weight.service';
import { DateRangePreset, filterByRange, resolveDateRange } from '../../shared/date-range';


@Component({
  selector: 'app-charts-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BaseChartDirective],
  template: `
    <div class="page-container">
      <h1>Charts</h1>

      <section class="controls" aria-label="Charts controls">
        <form [formGroup]="controlsForm" class="controls-form">
          <div class="controls-actions">
            <button
              type="button"
              class="btn btn-secondary"
              (click)="onPrintExport()"
              [disabled]="!!rangeError"
              aria-label="Print or export charts report"
            >
              Print / Export
            </button>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="rangePreset">Date range</label>
              <select
                id="rangePreset"
                formControlName="rangePreset"
                (change)="onControlsChanged()"
                aria-label="Select date range"
              >
                @for (opt of rangePresetOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>

            @if (controlsForm.get('rangePreset')?.value === 'custom') {
              <div class="form-group">
                <label for="customStart">Start</label>
                <input
                  type="datetime-local"
                  id="customStart"
                  formControlName="customStart"
                  (change)="onControlsChanged()"
                  aria-label="Custom start date and time"
                  [class.invalid]="isCustomRangeInvalid()"
                >
              </div>
              <div class="form-group">
                <label for="customEnd">End</label>
                <input
                  type="datetime-local"
                  id="customEnd"
                  formControlName="customEnd"
                  (change)="onControlsChanged()"
                  aria-label="Custom end date and time"
                  [class.invalid]="isCustomRangeInvalid()"
                >
              </div>
            }
          </div>

          @if (rangeError) {
            <div class="form-error" role="alert">{{ rangeError }}</div>
          }

          <div class="form-row">
            <div class="form-group">
              <label>Cardio metrics</label>
              <div class="inline-controls" role="group" aria-label="Select cardio metrics">
                <label class="checkbox">
                  <input type="checkbox" checked disabled aria-label="Duration (always on)">
                  Duration
                </label>
                <label class="checkbox">
                  <input type="checkbox" formControlName="cardioShowDistance" (change)="onControlsChanged()" aria-label="Show distance">
                  Distance
                </label>
                <label class="checkbox">
                  <input type="checkbox" formControlName="cardioShowCalories" (change)="onControlsChanged()" aria-label="Show calories">
                  Calories
                </label>
              </div>
            </div>

            <div class="form-group">
              <label for="readingType">Reading type</label>
              <select
                id="readingType"
                formControlName="readingType"
                (change)="onControlsChanged()"
                aria-label="Select health reading type"
              >
                @for (type of readingTypes; track type.value) {
                  <option [value]="type.value">{{ type.label }}</option>
                }
              </select>
            </div>
          </div>
        </form>
      </section>

      <section class="chart-section" aria-label="Weight chart">
        <h2>Weight</h2>
        @if (weightChartData.labels?.length) {
          <div class="chart-container">
            <canvas baseChart [type]="'line'" [data]="weightChartData" [options]="lineOptions"></canvas>
          </div>
        } @else {
          <div class="empty-state">No weight entries in this range.</div>
        }
      </section>

      <section class="chart-section" aria-label="Cardio chart">
        <h2>Cardio</h2>
        @if (cardioChartData.labels?.length) {
          <div class="chart-container">
            <canvas baseChart [type]="'line'" [data]="cardioChartData" [options]="cardioOptions"></canvas>
          </div>
        } @else {
          <div class="empty-state">No cardio sessions in this range.</div>
        }
      </section>

      <section class="chart-section" aria-label="Health readings chart">
        <h2>Readings</h2>
        @if (readingsChartData.labels?.length) {
          <div class="chart-container">
            <canvas baseChart [type]="'line'" [data]="readingsChartData" [options]="lineOptions"></canvas>
          </div>
        } @else {
          <div class="empty-state">No readings in this range.</div>
        }
      </section>
    </div>
  `,
  styles: [`
    .controls {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    .controls-actions {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 0.75rem;
    }

    .controls-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      align-items: end;
    }

    @media (max-width: 768px) {
      .form-row {
        grid-template-columns: 1fr;
      }
    }

    .form-error {
      background: #fdeaea;
      color: #c0392b;
      padding: 0.75rem;
      border-radius: 4px;
    }

    .chart-section {
      margin-top: 1.5rem;
    }

    .inline-controls {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      margin-top: 0.25rem;
    }

    .checkbox {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
      color: #555;
    }

    .chart-section h2 {
      font-size: 1.25rem;
      color: #2c3e50;
      margin: 0 0 0.75rem 0;
    }

    .chart-container {
      height: 320px;
      background: #ffffff;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 0.75rem;
    }

    .empty-state {
      padding: 1.25rem;
      color: #95a5a6;
      background: #f8f9fa;
      border-radius: 8px;
    }

    input.invalid {
      border-color: #e74c3c;
    }
  `]
})
export class ChartsPageComponent implements OnInit {
  controlsForm: FormGroup;
  rangeError: string | null = null;

  rangePresetOptions: { value: DateRangePreset; label: string }[] = [
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '6m', label: 'Last 6 months' },
    { value: '1y', label: 'Last 1 year' },
    { value: 'all', label: 'All time' },
    { value: 'custom', label: 'Custom range' }
  ];

  readingTypes = READING_TYPES;

  weightChartData: ChartData<'line'> = { labels: [], datasets: [] };
  cardioChartData: ChartData<'line'> = { labels: [], datasets: [] };
  readingsChartData: ChartData<'line'> = { labels: [], datasets: [] };

  lineOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true }
    }
  };

  cardioOptions: ChartConfiguration<'line'>['options'] = {
    ...this.lineOptions,
    scales: {
      y: {
        position: 'left',
        title: { display: true, text: 'Value' }
      }
    }
  };

  private cardioSessions: CardioSession[] = [];
  private weightEntries: WeightEntry[] = [];
  private healthReadings: HealthReading[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private storageService: StorageService,
    private cardioService: CardioService,
    private weightService: WeightService,
    private readingsService: ReadingsService
  ) {
    this.controlsForm = this.fb.group({
      rangePreset: ['30d' as DateRangePreset, Validators.required],
      customStart: [''],
      customEnd: [''],
      cardioShowDistance: [false],
      cardioShowCalories: [false],
      readingType: ['blood_pressure' as HealthReadingType, Validators.required]
    });
  }

  ngOnInit(): void {
    this.storageService.initialize().subscribe({
      next: () => this.loadAllData(),
      error: (err) => {
        console.error('Failed to initialize storage:', err);
        this.rangeError = 'Failed to load charts data.';
      }
    });
  }

  onControlsChanged(): void {
    this.rebuildCharts();
  }

  onPrintExport(): void {
    const preset = this.controlsForm.get('rangePreset')?.value as DateRangePreset;
    const customStart = this.parseLocalDateTime(this.controlsForm.get('customStart')?.value);
    const customEnd = this.parseLocalDateTime(this.controlsForm.get('customEnd')?.value);

    const now = new Date();
    const { range, error } = resolveDateRange(preset, now, customStart ?? undefined, customEnd ?? undefined);
    this.rangeError = error;
    if (error) return;

    const queryParams: Record<string, string> = {
      generatedAt: now.toISOString(),
      readingType: String(this.controlsForm.get('readingType')?.value ?? 'blood_pressure'),
      cardioShowDistance: String(!!this.controlsForm.get('cardioShowDistance')?.value),
      cardioShowCalories: String(!!this.controlsForm.get('cardioShowCalories')?.value)
    };

    if (range.startMs !== undefined && range.endMs !== undefined) {
      queryParams['startMs'] = String(range.startMs);
      queryParams['endMs'] = String(range.endMs);
    }

    this.router.navigate(['/report'], { queryParams });
  }

  isCustomRangeInvalid(): boolean {
    return this.controlsForm.get('rangePreset')?.value === 'custom' && !!this.rangeError;
  }

  private loadAllData(): void {
    forkJoin({
      cardio: this.cardioService.getSessions(),
      weight: this.weightService.getEntries(),
      readings: this.readingsService.getReadings()
    }).subscribe({
      next: ({ cardio, weight, readings }) => {
        this.cardioSessions = cardio;
        this.weightEntries = weight;
        this.healthReadings = readings;
        this.rebuildCharts();
      },
      error: (err) => {
        console.error('Failed to load charts data:', err);
        this.rangeError = 'Failed to load charts data.';
      }
    });
  }

  private rebuildCharts(): void {
    const preset = this.controlsForm.get('rangePreset')?.value as DateRangePreset;
    const customStart = this.parseLocalDateTime(this.controlsForm.get('customStart')?.value);
    const customEnd = this.parseLocalDateTime(this.controlsForm.get('customEnd')?.value);

    const { range, error } = resolveDateRange(preset, new Date(), customStart ?? undefined, customEnd ?? undefined);
    this.rangeError = error;
    if (error) {
      return;
    }

    this.buildWeightChart(range);
    this.buildCardioChart(range);
    this.buildReadingsChart(range);
  }

  private buildWeightChart(range: { startMs?: number; endMs?: number }): void {
    const filtered = filterByRange(
      this.weightEntries,
      e => new Date(e.date).getTime(),
      range
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const labels = filtered.map(e => this.formatShortDate(e.date));
    const data = filtered.map(e => e.weightLbs);

    this.weightChartData = {
      labels,
      datasets: labels.length
        ? [{
            data,
            label: 'Weight (lbs)',
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.15)',
            pointRadius: 2,
            tension: 0.25
          }]
        : []
    };
  }

  private buildCardioChart(range: { startMs?: number; endMs?: number }): void {
    const showDistance = !!this.controlsForm.get('cardioShowDistance')?.value;
    const showCalories = !!this.controlsForm.get('cardioShowCalories')?.value;

    const filtered = filterByRange(
      this.cardioSessions,
      s => new Date(s.date).getTime(),
      range
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const labels = filtered.map(s => this.formatShortDate(s.date));

    const duration = filtered.map(s => s.durationMinutes);
    const distance = filtered.map(s => (s.distanceKm ?? null));
    const calories = filtered.map(s => (s.caloriesBurned ?? null));

    const hasDistance = distance.some(v => typeof v === 'number' && Number.isFinite(v));
    const hasCalories = calories.some(v => typeof v === 'number' && Number.isFinite(v));

    const datasets: ChartData<'line'>['datasets'] = labels.length
      ? [
          {
            data: duration,
            label: 'Duration (min)',
            borderColor: '#2ecc71',
            backgroundColor: 'rgba(46, 204, 113, 0.15)',
            pointRadius: 2,
            tension: 0.25,
            yAxisID: 'y'
          }
        ]
      : [];

    if (showDistance && hasDistance) {
      datasets.push({
        data: distance,
        label: 'Distance (km)',
        borderColor: '#9b59b6',
        backgroundColor: 'rgba(155, 89, 182, 0.12)',
        spanGaps: true,
        pointRadius: 2,
        tension: 0.25,
        yAxisID: 'y1'
      });
    }

    if (showCalories && hasCalories) {
      datasets.push({
        data: calories,
        label: 'Calories (kcal)',
        borderColor: '#e67e22',
        backgroundColor: 'rgba(230, 126, 34, 0.12)',
        spanGaps: true,
        pointRadius: 2,
        tension: 0.25,
        yAxisID: 'y2'
      });
    }

    this.cardioOptions = {
      ...this.lineOptions,
      scales: {
        y: {
          position: 'left',
          title: { display: true, text: 'Duration (min)' }
        },
        ...(showDistance && hasDistance
          ? {
              y1: {
                position: 'right',
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'Distance (km)' }
              }
            }
          : {}),
        ...(showCalories && hasCalories
          ? {
              y2: {
                position: 'right',
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'Calories (kcal)' }
              }
            }
          : {})
      }
    };

    this.cardioChartData = {
      labels,
      datasets
    };
  }

  private buildReadingsChart(range: { startMs?: number; endMs?: number }): void {
    const type = this.controlsForm.get('readingType')?.value as HealthReadingType;

    const filtered = filterByRange(
      this.healthReadings.filter(r => r.type === type),
      r => new Date(r.date).getTime(),
      range
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const labels = filtered.map(r => this.formatShortDate(r.date));

    if (!labels.length) {
      this.readingsChartData = { labels: [], datasets: [] };
      return;
    }

    if (type === 'blood_pressure') {
      const bp = filtered as BloodPressureReading[];
      this.readingsChartData = {
        labels,
        datasets: [
          {
            data: bp.map(r => r.systolic),
            label: 'Systolic (mmHg)',
            borderColor: '#c0392b',
            backgroundColor: 'rgba(192, 57, 43, 0.12)',
            pointRadius: 2,
            tension: 0.25
          },
          {
            data: bp.map(r => r.diastolic),
            label: 'Diastolic (mmHg)',
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.12)',
            pointRadius: 2,
            tension: 0.25
          }
        ]
      };
      return;
    }

    if (type === 'blood_glucose') {
      const glucose = filtered as BloodGlucoseReading[];
      this.readingsChartData = {
        labels,
        datasets: [{
          data: glucose.map(r => r.glucoseMmol),
          label: 'Blood glucose (mmol/L)',
          borderColor: '#d68910',
          backgroundColor: 'rgba(214, 137, 16, 0.12)',
          pointRadius: 2,
          tension: 0.25
        }]
      };
      return;
    }

    const ketones = filtered as KetoneReading[];
    this.readingsChartData = {
      labels,
      datasets: [{
        data: ketones.map(r => r.ketoneMmol),
        label: 'Ketones (mmol/L)',
        borderColor: '#1e8449',
        backgroundColor: 'rgba(30, 132, 73, 0.12)',
        pointRadius: 2,
        tension: 0.25
      }]
    };
  }

  private parseLocalDateTime(value: unknown): Date | null {
    if (typeof value !== 'string' || value.trim() === '') return null;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  private formatShortDate(isoString: string): string {
    const d = new Date(isoString);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    });
  }

}
