# Contract: Domain Services

**Type**: Internal Service Interfaces
**Purpose**: Define CRUD operations for each data type

## CardioService

```typescript
import { Observable } from 'rxjs';

interface ICardioService {
  /**
   * Get all cardio sessions sorted by date (newest first)
   */
  getSessions(): Observable<CardioSession[]>;

  /**
   * Add a new cardio session
   * @param session - Session data (without id, createdAt, updatedAt)
   * @returns Observable with created session including generated fields
   */
  addSession(session: CreateCardioSession): Observable<CardioSession>;

  /**
   * Get a single session by ID
   */
  getSession(id: string): Observable<CardioSession | null>;
}

interface CreateCardioSession {
  date: string;
  type: CardioType;
  durationMinutes: number;
  distanceKm?: number;
  notes?: string;
}
```

### Behaviors

| Method | Input | Output | Side Effects |
|--------|-------|--------|--------------|
| getSessions() | N/A | CardioSession[] (sorted by date desc) | None |
| addSession(data) | Valid CreateCardioSession | Created CardioSession | Persists to storage |
| addSession(data) | Invalid data | Error (ValidationError) | None |
| getSession(id) | Existing ID | CardioSession | None |
| getSession(id) | Non-existing ID | null | None |

---

## WeightService

```typescript
interface IWeightService {
  /**
   * Get all weight entries sorted by date (newest first)
   */
  getEntries(): Observable<WeightEntry[]>;

  /**
   * Add a new weight entry
   */
  addEntry(entry: CreateWeightEntry): Observable<WeightEntry>;

  /**
   * Get a single entry by ID
   */
  getEntry(id: string): Observable<WeightEntry | null>;
}

interface CreateWeightEntry {
  date: string;
  weightLbs: number;
  notes?: string;
}
```

### Behaviors

| Method | Input | Output | Side Effects |
|--------|-------|--------|--------------|
| getEntries() | N/A | WeightEntry[] (sorted by date desc) | None |
| addEntry(data) | Valid CreateWeightEntry | Created WeightEntry | Persists to storage |
| addEntry(data) | Invalid weight value | Error (ValidationError) | None |
| getEntry(id) | Existing ID | WeightEntry | None |
| getEntry(id) | Non-existing ID | null | None |

---

## ReadingsService

```typescript
interface IReadingsService {
  /**
   * Get all health readings, optionally filtered by type
   */
  getReadings(type?: HealthReadingType): Observable<HealthReading[]>;

  /**
   * Add a blood pressure reading
   */
  addBloodPressure(reading: CreateBloodPressure): Observable<BloodPressureReading>;

  /**
   * Add a blood glucose reading
   */
  addBloodGlucose(reading: CreateBloodGlucose): Observable<BloodGlucoseReading>;

  /**
   * Add a ketone reading
   */
  addKetone(reading: CreateKetone): Observable<KetoneReading>;

  /**
   * Get a single reading by ID
   */
  getReading(id: string): Observable<HealthReading | null>;
}

type HealthReadingType = 'blood_pressure' | 'blood_glucose' | 'ketone';

interface CreateBloodPressure {
  date: string;
  systolic: number;
  diastolic: number;
  notes?: string;
}

interface CreateBloodGlucose {
  date: string;
  glucoseMmol: number;
  notes?: string;
}

interface CreateKetone {
  date: string;
  ketoneMmol: number;
  notes?: string;
}
```

### Behaviors

| Method | Input | Output | Side Effects |
|--------|-------|--------|--------------|
| getReadings() | No filter | All HealthReading[] (sorted by date desc) | None |
| getReadings(type) | 'blood_pressure' | BloodPressureReading[] only | None |
| addBloodPressure(data) | Valid systolic/diastolic | BloodPressureReading | Persists |
| addBloodPressure(data) | systolic <= diastolic | Error (ValidationError) | None |
| addBloodGlucose(data) | Valid glucoseMmol | BloodGlucoseReading | Persists |
| addKetone(data) | Valid ketoneMmol | KetoneReading | Persists |

---

## Validation Rules (All Services)

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### Cardio Validation

| Field | Rule | Error Message |
|-------|------|---------------|
| date | Must be valid ISO date | "Invalid date format" |
| type | Must be valid CardioType | "Invalid cardio type" |
| durationMinutes | 1-1440 | "Duration must be between 1 and 1440 minutes" |
| distanceKm | 0.01-1000 if provided | "Distance must be between 0.01 and 1000 km" |
| notes | <= 500 chars | "Notes must be 500 characters or less" |

### Weight Validation

| Field | Rule | Error Message |
|-------|------|---------------|
| date | Must be valid ISO date | "Invalid date format" |
| weightLbs | 50-1000 | "Weight must be between 50 and 1000 lbs" |
| notes | <= 500 chars | "Notes must be 500 characters or less" |

### Blood Pressure Validation

| Field | Rule | Error Message |
|-------|------|---------------|
| date | Must be valid ISO date | "Invalid date format" |
| systolic | 60-250 | "Systolic must be between 60 and 250 mmHg" |
| diastolic | 40-150 | "Diastolic must be between 40 and 150 mmHg" |
| systolic > diastolic | Must be true | "Systolic must be greater than diastolic" |
| notes | <= 500 chars | "Notes must be 500 characters or less" |

### Blood Glucose Validation

| Field | Rule | Error Message |
|-------|------|---------------|
| date | Must be valid ISO date | "Invalid date format" |
| glucoseMmol | 1.0-35.0 | "Glucose must be between 1.0 and 35.0 mmol/L" |
| notes | <= 500 chars | "Notes must be 500 characters or less" |

### Ketone Validation

| Field | Rule | Error Message |
|-------|------|---------------|
| date | Must be valid ISO date | "Invalid date format" |
| ketoneMmol | 0.0-10.0 | "Ketone must be between 0.0 and 10.0 mmol/L" |
| notes | <= 500 chars | "Notes must be 500 characters or less" |
