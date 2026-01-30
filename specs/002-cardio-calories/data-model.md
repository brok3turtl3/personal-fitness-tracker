# Data Model: Cardio Session Calories

**Feature**: 002-cardio-calories
**Date**: 2026-01-30

## Overview

This feature adds an optional calories field to `CardioSession`. The change is backward-compatible because existing stored sessions may omit this field.

## Updated Entity

### CardioSession

```typescript
interface CardioSession {
  id: string;
  date: string;
  type: CardioType;
  durationMinutes: number;
  distanceKm?: number;
  caloriesBurned?: number;          // Optional, 0-20000 (kcal)
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Compatibility Notes

- Existing LocalStorage data remains valid: `caloriesBurned` may be missing.
- Empty UI input maps to `undefined` (not stored / omitted).
