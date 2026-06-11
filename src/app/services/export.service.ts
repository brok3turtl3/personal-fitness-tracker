import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { WeightService } from './weight.service';
import { ReadingsService } from './readings.service';
import { CardioService } from './cardio.service';
import { WeightEntry } from '../models/weight-entry.model';
import { CardioSession } from '../models/cardio-session.model';
import {
  HealthReading,
  BloodPressureReading,
  BloodGlucoseReading,
  KetoneReading
} from '../models/health-reading.model';

/** Column order for the weight entries CSV export. */
const WEIGHT_COLUMNS = [
  'id',
  'date',
  'weightLbs',
  'notes',
  'createdAt',
  'updatedAt'
] as const;

/** Column order for the health readings CSV export. */
const READING_COLUMNS = [
  'id',
  'type',
  'date',
  'systolic',
  'diastolic',
  'glucoseMmol',
  'ketoneMmol',
  'notes',
  'createdAt',
  'updatedAt'
] as const;

/** Column order for the cardio sessions CSV export. */
const CARDIO_COLUMNS = [
  'id',
  'date',
  'type',
  'durationMinutes',
  'distanceKm',
  'caloriesBurned',
  'notes',
  'createdAt',
  'updatedAt'
] as const;

/**
 * Escape a single CSV field per RFC 4180.
 * Fields containing a comma, double-quote, CR or LF are wrapped in double
 * quotes, with any embedded double-quotes doubled. `undefined`/`null` become
 * an empty field.
 */
export function escapeCsvField(value: string | number | undefined | null): string {
  if (value === undefined || value === null) {
    return '';
  }

  const str = String(value);

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Build a single CSV line from an ordered list of field values.
 */
function buildCsvRow(values: (string | number | undefined | null)[]): string {
  return values.map(escapeCsvField).join(',');
}

/**
 * Service for exporting logged data as CSV.
 *
 * The pure "build CSV string" logic ({@link buildWeightCsv},
 * {@link buildReadingsCsv}) is kept separate from the DOM download
 * side-effect ({@link triggerDownload}) so the string building can be unit
 * tested without a browser. Data is pulled through the existing domain
 * services rather than touching LocalStorage directly.
 */
@Injectable({
  providedIn: 'root'
})
export class ExportService {
  constructor(
    private weightService: WeightService,
    private readingsService: ReadingsService,
    private cardioService: CardioService
  ) {}

  /**
   * Build a CSV string for the given weight entries.
   * Pure and synchronous — safe to unit test without the DOM.
   */
  buildWeightCsv(entries: WeightEntry[]): string {
    const header = buildCsvRow([...WEIGHT_COLUMNS]);

    const rows = entries.map(entry =>
      buildCsvRow([
        entry.id,
        entry.date,
        entry.weightLbs,
        entry.notes,
        entry.createdAt,
        entry.updatedAt
      ])
    );

    return [header, ...rows].join('\r\n');
  }

  /**
   * Build a CSV string for the given health readings.
   * Type-specific values (systolic/diastolic, glucose, ketones) populate the
   * column matching their reading type; other measurement columns are blank.
   * Pure and synchronous — safe to unit test without the DOM.
   */
  buildReadingsCsv(readings: HealthReading[]): string {
    const header = buildCsvRow([...READING_COLUMNS]);

    const rows = readings.map(reading => {
      const bp = reading.type === 'blood_pressure' ? (reading as BloodPressureReading) : undefined;
      const glucose = reading.type === 'blood_glucose' ? (reading as BloodGlucoseReading) : undefined;
      const ketone = reading.type === 'ketone' ? (reading as KetoneReading) : undefined;

      return buildCsvRow([
        reading.id,
        reading.type,
        reading.date,
        bp?.systolic,
        bp?.diastolic,
        glucose?.glucoseMmol,
        ketone?.ketoneMmol,
        reading.notes,
        reading.createdAt,
        reading.updatedAt
      ]);
    });

    return [header, ...rows].join('\r\n');
  }

  /**
   * Build a CSV string for the given cardio sessions.
   * Optional measurements (distance, calories) are left blank when absent.
   * Pure and synchronous — safe to unit test without the DOM.
   */
  buildCardioCsv(sessions: CardioSession[]): string {
    const header = buildCsvRow([...CARDIO_COLUMNS]);

    const rows = sessions.map(session =>
      buildCsvRow([
        session.id,
        session.date,
        session.type,
        session.durationMinutes,
        session.distanceKm,
        session.caloriesBurned,
        session.notes,
        session.createdAt,
        session.updatedAt
      ])
    );

    return [header, ...rows].join('\r\n');
  }

  /**
   * Get the weight entries CSV as a string (newest first, matching the app).
   */
  getWeightCsv(): Observable<string> {
    return this.weightService.getEntries().pipe(
      map(entries => this.buildWeightCsv(entries))
    );
  }

  /**
   * Get the health readings CSV as a string (newest first, matching the app).
   */
  getReadingsCsv(): Observable<string> {
    return this.readingsService.getReadings().pipe(
      map(readings => this.buildReadingsCsv(readings))
    );
  }

  /**
   * Get the cardio sessions CSV as a string (newest first, matching the app).
   */
  getCardioCsv(): Observable<string> {
    return this.cardioService.getSessions().pipe(
      map(sessions => this.buildCardioCsv(sessions))
    );
  }

  /**
   * Build the weight CSV and trigger a browser download.
   */
  exportWeightCsv(): Observable<void> {
    return this.getWeightCsv().pipe(
      map(csv => this.triggerDownload('weight-entries.csv', csv))
    );
  }

  /**
   * Build the health readings CSV and trigger a browser download.
   */
  exportReadingsCsv(): Observable<void> {
    return this.getReadingsCsv().pipe(
      map(csv => this.triggerDownload('health-readings.csv', csv))
    );
  }

  /**
   * Build the cardio sessions CSV and trigger a browser download.
   */
  exportCardioCsv(): Observable<void> {
    return this.getCardioCsv().pipe(
      map(csv => this.triggerDownload('cardio-sessions.csv', csv))
    );
  }

  /**
   * Trigger a browser download of the given text content.
   * DOM side-effect — deliberately kept out of the pure CSV builders.
   */
  triggerDownload(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(url);
  }
}
