import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { MealEntry } from '../../models/diet.model';
import { WeightEntry } from '../../models/weight-entry.model';
import { CardioService } from '../../services/cardio.service';
import { DietService } from '../../services/diet.service';
import { ReadingsService } from '../../services/readings.service';
import { StorageService } from '../../services/storage.service';
import { WeightService } from '../../services/weight.service';
import { groupByDay, sumByDay, toDateKey, round2 } from '../../shared/chart-grouping';
import { DateRangePreset, filterByRange, resolveDateRange } from '../../shared/date-range';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';


@Component({
  selector: 'app-charts-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BaseChartDirective, EmptyStateComponent, ErrorStateComponent],
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
            <app-error-state
              title="Couldn't build charts"
              [message]="rangeError"
            ></app-error-state>
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

          <div class="form-row">
            <div class="form-group">
              <label>Diet metrics</label>
              <div class="inline-controls" role="group" aria-label="Select diet metrics">
                <label class="checkbox">
                  <input type="checkbox" formControlName="dietShowCalories" (change)="onControlsChanged()" aria-label="Show diet calories">
                  Calories
                </label>
                <label class="checkbox">
                  <input type="checkbox" formControlName="dietShowProtein" (change)="onControlsChanged()" aria-label="Show protein">
                  Protein
                </label>
                <label class="checkbox">
                  <input type="checkbox" formControlName="dietShowFat" (change)="onControlsChanged()" aria-label="Show fat">
                  Fat
                </label>
                <label class="checkbox">
                  <input type="checkbox" formControlName="dietShowCarbs" (change)="onControlsChanged()" aria-label="Show carbs">
                  Carbs
                </label>
                <label class="checkbox">
                  <input type="checkbox" formControlName="dietShowNetCarbs" (change)="onControlsChanged()" aria-label="Show net carbs">
                  Net carbs
                </label>
              </div>
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
          <app-empty-state
            title="No weight entries in this range"
            message="Try a wider range or add more entries."
          ></app-empty-state>
        }
      </section>

      <section class="chart-section" aria-label="Cardio chart">
        <h2>Cardio</h2>
        @if (cardioChartData.labels?.length) {
          <div class="chart-container">
            <canvas baseChart [type]="'line'" [data]="cardioChartData" [options]="cardioOptions"></canvas>
          </div>
        } @else {
          <app-empty-state
            title="No cardio sessions in this range"
            message="Try a wider range or add more entries."
          ></app-empty-state>
        }
      </section>

      <section class="chart-section" aria-label="Health readings chart">
        <h2>Readings</h2>
        @if (readingsChartData.labels?.length) {
          <div class="chart-container">
            <canvas baseChart [type]="'line'" [data]="readingsChartData" [options]="lineOptions"></canvas>
          </div>
        } @else {
          <app-empty-state
            title="No readings in this range"
            message="Try a wider range or add more entries."
          ></app-empty-state>
        }
      </section>

      <section class="chart-section" aria-label="Diet chart">
        <h2>Diet</h2>
        @if (dietChartData.labels?.length) {
          <div class="chart-container">
            <canvas baseChart [type]="'line'" [data]="dietChartData" [options]="dietOptions"></canvas>
          </div>
        } @else {
          <app-empty-state
            title="No diet data in this range"
            message="Log some meals or widen the date range to see calories and macros over time."
          ></app-empty-state>
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
      color: #5f6c6d; /* QUAL-08: was #95a5a6 (2.56:1); #5f6c6d clears WCAG AA */
      background: #f8f9fa;
      border-radius: 8px;
    }

    input.invalid {
      border-color: #e74c3c;
    }
  `]
})
export class ChartsPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

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
  dietChartData: ChartData<'line'> = { labels: [], datasets: [] };

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

  dietOptions: ChartConfiguration<'line'>['options'] = {
    ...this.lineOptions,
    scales: {
      y: {
        position: 'left',
        title: { display: true, text: 'Calories (kcal)' }
      }
    }
  };

  private cardioSessions: CardioSession[] = [];
  private weightEntries: WeightEntry[] = [];
  private healthReadings: HealthReading[] = [];
  private mealEntries: MealEntry[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private storageService: StorageService,
    private cardioService: CardioService,
    private weightService: WeightService,
    private readingsService: ReadingsService,
    private dietService: DietService
  ) {
    this.controlsForm = this.fb.group({
      rangePreset: ['30d' as DateRangePreset, Validators.required],
      customStart: [''],
      customEnd: [''],
      cardioShowDistance: [false],
      cardioShowCalories: [false],
      readingType: ['blood_pressure' as HealthReadingType, Validators.required],
      dietShowCalories: [false],
      dietShowProtein: [false],
      dietShowFat: [false],
      dietShowCarbs: [false],
      dietShowNetCarbs: [false]
    });
  }

  ngOnInit(): void {
    this.storageService.initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadAllData(),
        error: () => {
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
      readings: this.readingsService.getReadings(),
      // Fetch every meal once (full open range); buildDietChart re-applies the
      // resolved date-range via filterByRange on each control change, mirroring
      // the cardio/weight path so changing the range never re-queries storage.
      diet: this.dietService.getMealsInRange(0, Date.now())
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cardio, weight, readings, diet }) => {
          this.cardioSessions = cardio;
          this.weightEntries = weight;
          this.healthReadings = readings;
          this.mealEntries = diet;
          this.rebuildCharts();
        },
        error: () => {
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
    this.buildDietChart(range);
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

    if (!filtered.length) {
      this.readingsChartData = { labels: [], datasets: [] };
      return;
    }

    if (type === 'blood_pressure') {
      const bp = filtered as BloodPressureReading[];
      const grouped = groupByDay(bp, r => [r.systolic, r.diastolic]);
      this.readingsChartData = {
        labels: grouped.labels.map(d => this.formatShortDate(d)),
        datasets: [
          {
            data: grouped.averages.map(a => round2(a[0])),
            label: 'Systolic (mmHg)',
            borderColor: '#c0392b',
            backgroundColor: 'rgba(192, 57, 43, 0.12)',
            pointRadius: 2,
            tension: 0.25
          },
          {
            data: grouped.averages.map(a => round2(a[1])),
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
      const grouped = groupByDay(glucose, r => [r.glucoseMmol]);
      this.readingsChartData = {
        labels: grouped.labels.map(d => this.formatShortDate(d)),
        datasets: [{
          data: grouped.averages.map(a => round2(a[0])),
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
    const grouped = groupByDay(ketones, r => [r.ketoneMmol]);
    this.readingsChartData = {
      labels: grouped.labels.map(d => this.formatShortDate(d)),
      datasets: [{
        data: grouped.averages.map(a => round2(a[0])),
        label: 'Ketones (mmol/L)',
        borderColor: '#1e8449',
        backgroundColor: 'rgba(30, 132, 73, 0.12)',
        pointRadius: 2,
        tension: 0.25
      }]
    };
  }

  private buildDietChart(range: { startMs?: number; endMs?: number }): void {
    const showCalories = !!this.controlsForm.get('dietShowCalories')?.value;
    const showProtein = !!this.controlsForm.get('dietShowProtein')?.value;
    const showFat = !!this.controlsForm.get('dietShowFat')?.value;
    const showCarbs = !!this.controlsForm.get('dietShowCarbs')?.value;
    const showNetCarbs = !!this.controlsForm.get('dietShowNetCarbs')?.value;

    // Range-filter consistently with the cardio/weight path (filterByRange),
    // then SUM per LOCAL day via sumByDay keyed on dateTime (D-11). NEVER
    // groupByDay — averaging would halve a multi-meal day (RESEARCH Pitfall 2).
    const filtered = filterByRange(
      this.mealEntries,
      m => new Date(m.dateTime).getTime(),
      range
    );

    const { labels, values } = sumByDay(
      filtered,
      m => m.dateTime,
      m => [
        m.totals.caloriesKcal,
        m.totals.proteinG,
        m.totals.fatG,
        m.totals.carbsG,
        m.totals.netCarbsG
      ]
    );

    const displayLabels = labels.map(d => this.formatShortDate(d));

    // Column indices match the extractor order above.
    const calories = values.map(v => v[0]);
    const protein = values.map(v => v[1]);
    const fat = values.map(v => v[2]);
    const carbs = values.map(v => v[3]);
    const netCarbs = values.map(v => v[4]);

    const datasets: ChartData<'line'>['datasets'] = [];

    if (labels.length && showCalories) {
      datasets.push({
        data: calories,
        label: 'Calories (kcal)',
        borderColor: '#e67e22',
        backgroundColor: 'rgba(230, 126, 34, 0.12)',
        pointRadius: 2,
        tension: 0.25,
        yAxisID: 'y'
      });
    }

    if (labels.length && showProtein) {
      datasets.push({
        data: protein,
        label: 'Protein (g)',
        borderColor: '#16a085',
        backgroundColor: 'rgba(22, 160, 133, 0.12)',
        pointRadius: 2,
        tension: 0.25,
        yAxisID: 'y1'
      });
    }

    if (labels.length && showFat) {
      datasets.push({
        data: fat,
        label: 'Fat (g)',
        borderColor: '#f1c40f',
        backgroundColor: 'rgba(241, 196, 15, 0.12)',
        pointRadius: 2,
        tension: 0.25,
        yAxisID: 'y1'
      });
    }

    if (labels.length && showCarbs) {
      datasets.push({
        data: carbs,
        label: 'Carbs (g)',
        borderColor: '#8e44ad',
        backgroundColor: 'rgba(142, 68, 173, 0.12)',
        pointRadius: 2,
        tension: 0.25,
        yAxisID: 'y1'
      });
    }

    if (labels.length && showNetCarbs) {
      datasets.push({
        data: netCarbs,
        label: 'Net carbs (g)',
        borderColor: '#c0392b',
        backgroundColor: 'rgba(192, 57, 43, 0.12)',
        borderDash: [4, 4],
        pointRadius: 2,
        tension: 0.25,
        yAxisID: 'y1'
      });
    }

    const showMacros = showProtein || showFat || showCarbs || showNetCarbs;

    this.dietOptions = {
      ...this.lineOptions,
      scales: {
        y: {
          position: 'left',
          title: { display: true, text: 'Calories (kcal)' }
        },
        ...(showMacros
          ? {
              y1: {
                position: 'right',
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'Macros (g)' }
              }
            }
          : {})
      }
    };

    this.dietChartData = {
      labels: datasets.length ? displayLabels : [],
      datasets
    };
  }

  private parseLocalDateTime(value: unknown): Date | null {
    if (typeof value !== 'string' || value.trim() === '') return null;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  private formatShortDate(isoString: string): string {
    // A bare `YYYY-MM-DD` (the local-day KEY produced by toDateKey via
    // sumByDay/groupByDay) must be parsed in LOCAL time, not UTC. `new
    // Date('2026-03-08')` is spec'd to parse as UTC midnight, which then renders
    // a day early in any UTC-negative timezone — the exact DST/TZ label drift
    // DIET-08/D-11 forbids. Re-key bare date strings to local midnight; full ISO
    // timestamps (with a time component) keep their original parsing.
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoString);
    const d = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(isoString);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    });
  }

}
