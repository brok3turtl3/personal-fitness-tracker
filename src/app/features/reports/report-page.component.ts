import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { filterByRange, ResolvedDateRange } from '../../shared/date-range';

@Component({
  selector: 'app-report-page',
  standalone: true,
  imports: [CommonModule, RouterLink, BaseChartDirective],
  template: `
    <div class="page-container report">
      <header class="report-header">
        <div>
          <h1>Fitness Tracker Report</h1>
          <div class="meta">
            <div><strong>Range:</strong> {{ rangeLabel }}</div>
            <div><strong>Generated:</strong> {{ generatedLabel }}</div>
          </div>
        </div>

        <div class="actions no-print">
          <button type="button" class="btn btn-primary" (click)="onPrint()" aria-label="Print or save as PDF">Print / Save PDF</button>
          <a class="btn btn-secondary" [routerLink]="['/charts']">Back to Charts</a>
        </div>
      </header>

      @if (loadError) {
        <div class="form-error" role="alert">{{ loadError }}</div>
      }

      <section class="summary-grid">
        <div class="summary-card print-block" aria-label="Weight summary">
          <h2>Weight Summary</h2>
          @if (weightSummary.count === 0) {
            <div class="empty">No weight entries in range.</div>
          } @else {
            <div class="rows">
              <div><span class="k">Entries</span><span class="v">{{ weightSummary.count }}</span></div>
              <div><span class="k">Average</span><span class="v">{{ weightSummary.avgLbs }} lbs</span></div>
              <div><span class="k">Min</span><span class="v">{{ weightSummary.minLbs }} lbs</span></div>
              <div><span class="k">Max</span><span class="v">{{ weightSummary.maxLbs }} lbs</span></div>
            </div>
          }
        </div>

        <div class="summary-card print-block" aria-label="Cardio summary">
          <h2>Cardio Summary</h2>
          @if (cardioSummary.count === 0) {
            <div class="empty">No cardio sessions in range.</div>
          } @else {
            <div class="rows">
              <div><span class="k">Sessions</span><span class="v">{{ cardioSummary.count }}</span></div>
              <div><span class="k">Total duration</span><span class="v">{{ cardioSummary.totalDurationMin }} min</span></div>
              <div><span class="k">Total distance</span><span class="v">{{ cardioSummary.totalDistanceKm }} km</span></div>
              <div><span class="k">Total calories</span><span class="v">{{ cardioSummary.totalCalories }} kcal</span></div>
            </div>
          }
        </div>

        <div class="summary-card print-block" aria-label="Readings summary">
          <h2>Readings Summary</h2>
          @if (readingsSummary.totalCount === 0) {
            <div class="empty">No readings in range.</div>
          } @else {
            <div class="rows">
              <div><span class="k">Total</span><span class="v">{{ readingsSummary.totalCount }}</span></div>
              <div><span class="k">Blood pressure</span><span class="v">{{ readingsSummary.bpCount }}</span></div>
              <div><span class="k">Glucose</span><span class="v">{{ readingsSummary.glucoseCount }}</span></div>
              <div><span class="k">Ketones</span><span class="v">{{ readingsSummary.ketoneCount }}</span></div>
            </div>
          }
        </div>
      </section>

      <section class="chart-section print-block" aria-label="Weight chart">
        <h2>Weight</h2>
        @if (weightChartData.labels?.length) {
          <div class="chart-container">
            <canvas baseChart [type]="'line'" [data]="weightChartData" [options]="lineOptions"></canvas>
          </div>
        } @else {
          <div class="empty-state">No weight entries in this range.</div>
        }
      </section>

      <section class="chart-section print-block" aria-label="Cardio chart">
        <h2>Cardio</h2>
        @if (cardioChartData.labels?.length) {
          <div class="chart-container">
            <canvas baseChart [type]="'line'" [data]="cardioChartData" [options]="cardioOptions"></canvas>
          </div>
        } @else {
          <div class="empty-state">No cardio sessions in this range.</div>
        }
      </section>

      <section class="chart-section print-block" aria-label="Health readings chart">
        <h2>Readings ({{ readingsChartLabel }})</h2>
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
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .report-header h1 {
      margin: 0;
    }

    .meta {
      color: #7f8c8d;
      font-size: 0.95rem;
      margin-top: 0.25rem;
      display: grid;
      gap: 0.15rem;
    }

    .actions {
      display: inline-flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .form-error {
      background: #fdeaea;
      color: #c0392b;
      padding: 0.75rem;
      border-radius: 4px;
      margin-bottom: 1rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    @media (max-width: 900px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }

    .summary-card {
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 1rem;
      background: #ffffff;
    }

    .summary-card h2 {
      font-size: 1.1rem;
      color: #2c3e50;
      margin: 0 0 0.75rem 0;
    }

    .rows {
      display: grid;
      gap: 0.4rem;
    }

    .rows > div {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
    }

    .k {
      color: #7f8c8d;
    }

    .v {
      font-weight: 600;
      color: #2c3e50;
    }

    .chart-section {
      margin-top: 1.5rem;
    }

    .chart-section h2 {
      font-size: 1.25rem;
      color: #2c3e50;
      margin: 0 0 0.75rem 0;
    }

    .chart-container {
      height: 360px;
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

    .empty {
      color: #95a5a6;
    }

    @media print {
      .no-print {
        display: none !important;
      }
    }
  `]
})
export class ReportPageComponent implements OnInit {
  rangeLabel = 'All time';
  generatedLabel = '';

  weightChartData: ChartData<'line'> = { labels: [], datasets: [] };
  cardioChartData: ChartData<'line'> = { labels: [], datasets: [] };
  readingsChartData: ChartData<'line'> = { labels: [], datasets: [] };
  readingsChartLabel = 'Blood Pressure';

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
        title: { display: true, text: 'Duration (min)' }
      }
    }
  };

  loadError: string | null = null;

  weightSummary = { count: 0, avgLbs: '0.0', minLbs: '0.0', maxLbs: '0.0' };
  cardioSummary = { count: 0, totalDurationMin: 0, totalDistanceKm: '0.00', totalCalories: 0 };
  readingsSummary = { totalCount: 0, bpCount: 0, glucoseCount: 0, ketoneCount: 0 };

  private range: ResolvedDateRange = {};
  private showDistance = false;
  private showCalories = false;
  private readingType: HealthReadingType = 'blood_pressure';

  private cardioSessions: CardioSession[] = [];
  private weightEntries: WeightEntry[] = [];
  private healthReadings: HealthReading[] = [];

  constructor(
    private route: ActivatedRoute,
    private storageService: StorageService,
    private cardioService: CardioService,
    private weightService: WeightService,
    private readingsService: ReadingsService
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const startMs = this.parseNumber(params.get('startMs'));
      const endMs = this.parseNumber(params.get('endMs'));
      const generatedAt = params.get('generatedAt');

      this.showDistance = this.parseBoolean(params.get('cardioShowDistance'));
      this.showCalories = this.parseBoolean(params.get('cardioShowCalories'));
      this.readingType = (params.get('readingType') as HealthReadingType) || 'blood_pressure';

      this.range = {
        startMs: startMs ?? undefined,
        endMs: endMs ?? undefined
      };

      const generatedDate = generatedAt ? new Date(generatedAt) : new Date();
      this.generatedLabel = this.formatLongDateTime(generatedDate);
      this.rangeLabel = this.describeRange(this.range);

      const readingLabel = READING_TYPES.find(t => t.value === this.readingType)?.label;
      this.readingsChartLabel = readingLabel ?? 'Readings';

      this.loadData();
    });
  }

  onPrint(): void {
    window.print();
  }

  private loadData(): void {
    this.loadError = null;

    this.storageService.initialize().subscribe({
      next: () => {
        forkJoin({
          cardio: this.cardioService.getSessions(),
          weight: this.weightService.getEntries(),
          readings: this.readingsService.getReadings()
        }).subscribe({
          next: ({ cardio, weight, readings }) => {
            this.cardioSessions = cardio;
            this.weightEntries = weight;
            this.healthReadings = readings;
            this.rebuild();
          },
          error: () => {
            this.loadError = 'Failed to load report data.';
          }
        });
      },
      error: () => {
        this.loadError = 'Failed to initialize storage.';
      }
    });
  }

  private rebuild(): void {
    this.buildSummaries();
    this.buildWeightChart();
    this.buildCardioChart();
    this.buildReadingsChart();
  }

  private buildSummaries(): void {
    const weight = filterByRange(this.weightEntries, e => new Date(e.date).getTime(), this.range);
    const cardio = filterByRange(this.cardioSessions, s => new Date(s.date).getTime(), this.range);
    const readings = filterByRange(this.healthReadings, r => new Date(r.date).getTime(), this.range);

    this.weightSummary = computeWeightSummary(weight);
    this.cardioSummary = computeCardioSummary(cardio);
    this.readingsSummary = computeReadingsSummary(readings);
  }

  private buildWeightChart(): void {
    const filtered = filterByRange(this.weightEntries, e => new Date(e.date).getTime(), this.range)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

  private buildCardioChart(): void {
    const filtered = filterByRange(this.cardioSessions, s => new Date(s.date).getTime(), this.range)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const labels = filtered.map(s => this.formatShortDate(s.date));
    const duration = filtered.map(s => s.durationMinutes);
    const distance = filtered.map(s => (s.distanceKm ?? null));
    const calories = filtered.map(s => (s.caloriesBurned ?? null));

    const hasDistance = distance.some(v => typeof v === 'number' && Number.isFinite(v));
    const hasCalories = calories.some(v => typeof v === 'number' && Number.isFinite(v));

    const datasets: ChartData<'line'>['datasets'] = labels.length
      ? [{
          data: duration,
          label: 'Duration (min)',
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46, 204, 113, 0.15)',
          pointRadius: 2,
          tension: 0.25,
          yAxisID: 'y'
        }]
      : [];

    if (this.showDistance && hasDistance) {
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

    if (this.showCalories && hasCalories) {
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
        ...(this.showDistance && hasDistance
          ? {
              y1: {
                position: 'right',
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'Distance (km)' }
              }
            }
          : {}),
        ...(this.showCalories && hasCalories
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

    this.cardioChartData = { labels, datasets };
  }

  private buildReadingsChart(): void {
    const filtered = filterByRange(
      this.healthReadings.filter(r => r.type === this.readingType),
      r => new Date(r.date).getTime(),
      this.range
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const labels = filtered.map(r => this.formatShortDate(r.date));

    if (!labels.length) {
      this.readingsChartData = { labels: [], datasets: [] };
      return;
    }

    if (this.readingType === 'blood_pressure') {
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

    if (this.readingType === 'blood_glucose') {
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

  private describeRange(range: ResolvedDateRange): string {
    if (range.startMs === undefined || range.endMs === undefined) {
      return 'All time';
    }
    const start = new Date(range.startMs);
    const end = new Date(range.endMs);
    return `${this.formatShortDate(start.toISOString())} – ${this.formatShortDate(end.toISOString())}`;
  }

  private formatShortDate(isoString: string): string {
    const d = new Date(isoString);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private formatLongDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private parseNumber(value: string | null): number | null {
    if (value === null || value.trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private parseBoolean(value: string | null): boolean {
    return value === 'true' || value === '1';
  }
}

function computeWeightSummary(entries: WeightEntry[]): { count: number; avgLbs: string; minLbs: string; maxLbs: string } {
  const count = entries.length;
  if (count === 0) {
    return { count: 0, avgLbs: '0.0', minLbs: '0.0', maxLbs: '0.0' };
  }
  const values = entries.map(e => e.weightLbs).filter(v => Number.isFinite(v));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return { count, avgLbs: avg.toFixed(1), minLbs: min.toFixed(1), maxLbs: max.toFixed(1) };
}

function computeCardioSummary(sessions: CardioSession[]): { count: number; totalDurationMin: number; totalDistanceKm: string; totalCalories: number } {
  const count = sessions.length;
  const totalDurationMin = sessions.reduce((s, x) => s + (Number.isFinite(x.durationMinutes) ? x.durationMinutes : 0), 0);
  const totalDistance = sessions.reduce((s, x) => s + (Number.isFinite(x.distanceKm as number) ? (x.distanceKm as number) : 0), 0);
  const totalCalories = sessions.reduce((s, x) => s + (Number.isFinite(x.caloriesBurned as number) ? (x.caloriesBurned as number) : 0), 0);
  return { count, totalDurationMin, totalDistanceKm: totalDistance.toFixed(2), totalCalories };
}

function computeReadingsSummary(readings: HealthReading[]): { totalCount: number; bpCount: number; glucoseCount: number; ketoneCount: number } {
  const totalCount = readings.length;
  const bpCount = readings.filter(r => r.type === 'blood_pressure').length;
  const glucoseCount = readings.filter(r => r.type === 'blood_glucose').length;
  const ketoneCount = readings.filter(r => r.type === 'ketone').length;
  return { totalCount, bpCount, glucoseCount, ketoneCount };
}
