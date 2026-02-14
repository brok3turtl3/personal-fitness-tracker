# Service Contract Reference

> **Note**: The TypeScript source code is the authoritative source of truth. This document is a reference from initial design and may not reflect later changes. See `src/app/services/` for current implementations.

## StorageService

Abstract storage operations to enable future backend migration (IndexedDB, HTTP API, etc.).

```typescript
interface IStorageService {
  initialize(): Observable<void>;            // Run migrations if needed
  getData(): Observable<AppData | null>;     // Get current app data
  saveData(data: AppData): Observable<void>; // Persist entire app data
  clearData(): Observable<void>;             // Clear all stored data
  getStorageInfo(): Observable<StorageInfo>; // Usage statistics
}

interface StorageInfo {
  usedBytes: number;
  availableBytes: number;
  percentUsed: number;
}
```

### Error Types

```typescript
type StorageErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'PARSE_ERROR'
  | 'SERIALIZATION_ERROR'
  | 'NOT_AVAILABLE'
  | 'MIGRATION_FAILED';
```

### Behaviors

| Method | Scenario | Result |
|--------|----------|--------|
| `initialize()` | First run | Storage ready, no migration |
| `initialize()` | Old schema version | Runs migration chain, emits void |
| `initialize()` | Corrupted data | Errors with StorageError |
| `getData()` | Data exists | Emits AppData |
| `getData()` | No data | Emits null |
| `saveData(data)` | Storage full | Errors with QUOTA_EXCEEDED |

**Implementation notes**: Storage key `fitness_tracker_data`, JSON stringified, synchronous operations wrapped in Observable for interface consistency.

---

## CardioService

```typescript
interface ICardioService {
  getSessions(): Observable<CardioSession[]>;                    // Sorted by date desc
  addSession(session: CreateCardioSession): Observable<CardioSession>;
  getSession(id: string): Observable<CardioSession | null>;
}
```

---

## WeightService

```typescript
interface IWeightService {
  getEntries(): Observable<WeightEntry[]>;                       // Sorted by date desc
  addEntry(entry: CreateWeightEntry): Observable<WeightEntry>;
  getEntry(id: string): Observable<WeightEntry | null>;
}
```

---

## ReadingsService

```typescript
interface IReadingsService {
  getReadings(type?: HealthReadingType): Observable<HealthReading[]>;
  addBloodPressure(reading: CreateBloodPressure): Observable<BloodPressureReading>;
  addBloodGlucose(reading: CreateBloodGlucose): Observable<BloodGlucoseReading>;
  addKetone(reading: CreateKetone): Observable<KetoneReading>;
  getReading(id: string): Observable<HealthReading | null>;
}
```

---

## Validation (All Services)

All services validate input before persistence. Invalid data throws errors. See `CLAUDE.md` for validation ranges.

| Data Type | Field | Range |
|-----------|-------|-------|
| Cardio | durationMinutes | 1–1440 |
| Cardio | distanceKm | 0.01–1000 |
| Cardio | caloriesBurned | 0–20000 |
| Weight | weightLbs | 50–1000 |
| Blood Pressure | systolic | 60–250 mmHg |
| Blood Pressure | diastolic | 40–150 mmHg |
| Blood Pressure | systolic > diastolic | required |
| Blood Glucose | glucoseMmol | 1.0–35.0 mmol/L |
| Ketone | ketoneMmol | 0.0–10.0 mmol/L |
| All | notes | max 500 chars |
