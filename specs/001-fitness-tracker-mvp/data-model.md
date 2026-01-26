# Data Model: Personal Fitness Tracker MVP

**Feature**: 001-fitness-tracker-mvp
**Date**: 2025-01-25
**Schema Version**: 1

## Overview

This document defines the TypeScript interfaces for the Personal Fitness Tracker MVP. All models are designed for:
- Type safety (strict TypeScript)
- LocalStorage serialization (JSON-compatible)
- Future extensibility (optional fields, schema versioning)

**MVP Unit Constraints**: Weight in lbs (imperial), distance in km, glucose/ketones in mmol/L. No unit conversion for MVP.

## Core Entities

### AppData (Root Container)

The root storage container that holds all application data with schema versioning for migrations.

```typescript
interface AppData {
  schemaVersion: number;           // Current: 1
  cardioSessions: CardioSession[];
  weightEntries: WeightEntry[];
  healthReadings: HealthReading[];
  lastModified: string;            // ISO 8601 timestamp
}
```

**Storage Key**: `fitness_tracker_data`

### CardioSession

Represents a single cardio workout session.

```typescript
interface CardioSession {
  id: string;                      // UUID v4
  date: string;                    // ISO 8601 date-time
  type: CardioType;
  durationMinutes: number;         // Required, 1-1440
  distanceKm?: number;             // Optional, 0.01-1000
  notes?: string;                  // Optional, max 500 chars
  createdAt: string;               // ISO 8601 timestamp
  updatedAt: string;               // ISO 8601 timestamp
}

type CardioType = 
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'walking'
  | 'rowing'
  | 'elliptical'
  | 'other';
```

**Validation Rules**:

| Field | Valid Range | Required |
|-------|-------------|----------|
| durationMinutes | 1 - 1440 | Yes |
| distanceKm | 0.01 - 1000 | No |
| notes | max 500 chars | No |

### WeightEntry

Represents a single weight measurement.

```typescript
interface WeightEntry {
  id: string;                      // UUID v4
  date: string;                    // ISO 8601 date-time
  weightLbs: number;               // Required, 50-1000
  notes?: string;                  // Optional, max 500 chars
  createdAt: string;               // ISO 8601 timestamp
  updatedAt: string;               // ISO 8601 timestamp
}
```

**Validation Rules**:

| Field | Valid Range | Required |
|-------|-------------|----------|
| weightLbs | 50 - 1000 | Yes |
| notes | max 500 chars | No |

### HealthReading

Represents a health metric reading. Uses discriminated union for type-specific fields.

```typescript
type HealthReading = 
  | BloodPressureReading 
  | BloodGlucoseReading 
  | KetoneReading;

interface BaseHealthReading {
  id: string;                      // UUID v4
  date: string;                    // ISO 8601 date-time
  notes?: string;                  // Optional, max 500 chars
  createdAt: string;               // ISO 8601 timestamp
  updatedAt: string;               // ISO 8601 timestamp
}

interface BloodPressureReading extends BaseHealthReading {
  type: 'blood_pressure';
  systolic: number;                // mmHg, 60-250
  diastolic: number;               // mmHg, 40-150
}

interface BloodGlucoseReading extends BaseHealthReading {
  type: 'blood_glucose';
  glucoseMmol: number;             // mmol/L, 1.0-35.0
}

interface KetoneReading extends BaseHealthReading {
  type: 'ketone';
  ketoneMmol: number;              // mmol/L, 0.0-10.0
}
```

**Validation Rules**:

| Reading Type | Field | Valid Range | Unit | Required |
|--------------|-------|-------------|------|----------|
| Blood Pressure | systolic | 60 - 250 | mmHg | Yes |
| Blood Pressure | diastolic | 40 - 150 | mmHg | Yes |
| Blood Glucose | glucoseMmol | 1.0 - 35.0 | mmol/L | Yes |
| Ketone | ketoneMmol | 0.0 - 10.0 | mmol/L | Yes |

Additional validation:
- Blood Pressure: `systolic` MUST be greater than `diastolic`

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

- All entities are stored in arrays within the single `AppData` object
- No foreign key relationships - each entity is independent
- All entities have `id` for unique identification and potential future referencing

## Schema Migration Strategy

### Version Tracking

The `schemaVersion` field in `AppData` enables forward-compatible migrations:

```typescript
const CURRENT_SCHEMA_VERSION = 1;

function migrateData(data: unknown): AppData {
  const parsed = data as { schemaVersion?: number };
  const version = parsed.schemaVersion ?? 0;
  
  let migrated = data;
  
  // Apply migrations in sequence
  if (version < 1) {
    migrated = migrateV0ToV1(migrated);
  }
  // Future: if (version < 2) { migrated = migrateV1ToV2(migrated); }
  
  return migrated as AppData;
}
```

### Future Migration Examples

| Version | Changes |
|---------|---------|
| v1 → v2 | Add unit fields for multi-unit support |
| v2 → v3 | Add `tags` field to all entries |
| v3 → v4 | Add `goal` field to track progress |

## ID Generation

Use UUID v4 for all entity IDs:

```typescript
function generateId(): string {
  return crypto.randomUUID();
}
```

## Date/Time Handling

All dates stored as ISO 8601 strings for JSON serialization:

```typescript
// Storage format
const dateString = new Date().toISOString();
// Example: "2025-01-25T14:30:00.000Z"

// Display: Parse and format using user's locale
const displayDate = new Date(dateString).toLocaleDateString();
```

## Storage Size Considerations

Estimated entry sizes:
- CardioSession: ~200 bytes
- WeightEntry: ~120 bytes
- HealthReading: ~150 bytes

With 5MB LocalStorage limit:
- ~25,000 cardio sessions, OR
- ~40,000 weight entries, OR
- ~33,000 health readings

For typical use (10 entries/week across all types), storage supports ~50 years of data.
