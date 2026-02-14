# Data Model Reference

> **Note**: The TypeScript source code is the authoritative source of truth. This document is a reference from initial design and may not reflect later changes. See `src/app/models/` for current interfaces.

**Storage Key**: `fitness_tracker_data`

## AppData (Root Container)

```typescript
interface AppData {
  schemaVersion: number;
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  lastModified: string;            // ISO 8601
}
```

## CardioSession

```typescript
interface CardioSession {
  id: string;                      // UUID v4
  date: string;                    // ISO 8601
  type: CardioType;
  durationMinutes: number;         // 1-1440
  distanceKm?: number;             // 0.01-1000
  caloriesBurned?: number;         // 0-20000 kcal (added in feature 002)
  notes?: string;                  // max 500 chars
  createdAt: string;
  updatedAt: string;
}

type CardioType = 'running' | 'cycling' | 'swimming' | 'walking' | 'rowing' | 'elliptical' | 'other';
```

## WeightEntry

```typescript
interface WeightEntry {
  id: string;
  date: string;
  weightLbs: number;               // 50-1000
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

## HealthReading (Discriminated Union)

```typescript
type HealthReading = BloodPressureReading | BloodGlucoseReading | KetoneReading;

interface BaseHealthReading {
  id: string;
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface BloodPressureReading extends BaseHealthReading {
  type: 'blood_pressure';
  systolic: number;                // 60-250 mmHg
  diastolic: number;               // 40-150 mmHg (systolic must be > diastolic)
}

interface BloodGlucoseReading extends BaseHealthReading {
  type: 'blood_glucose';
  glucoseMmol: number;             // 1.0-35.0 mmol/L
}

interface KetoneReading extends BaseHealthReading {
  type: 'ketone';
  ketoneMmol: number;              // 0.0-10.0 mmol/L
}
```

## Entity Relationships

```
AppData (1)
├── CardioSession (*)
├── WeightEntry (*)
└── HealthReading (*)
    ├── BloodPressureReading
    ├── BloodGlucoseReading
    └── KetoneReading
```

All entities stored in arrays within the single AppData object. No foreign key relationships — each entity is independent.

## Schema Migration Strategy

The `schemaVersion` field enables forward-compatible migrations applied in sequence on app initialization:

```typescript
if (version < 1) migrated = migrateV0ToV1(migrated);
if (version < 2) migrated = migrateV1ToV2(migrated);
// ...
```

## ID Generation

All entity IDs use `crypto.randomUUID()` (UUID v4).

## Date/Time Handling

All dates stored as ISO 8601 strings for JSON serialization. Display uses the user's locale.

## Storage Size Estimates

With ~5 MB LocalStorage limit: ~25,000 cardio sessions, ~40,000 weight entries, or ~33,000 health readings. For typical use (10 entries/week), storage supports ~50 years of data.
