/**
 * units.ts
 *
 * PURE MODULE — no dependency injection (no Angular @Injectable), no
 * persistence-service coupling, no class, no internal clock. Mirrors
 * validators.ts / web-citation-parser.ts / confidence-attribution-parser.ts.
 *
 * Hand-rolled unit/density conversion for the diet domain (D-05: NO `convert`
 * dependency is added — a fixed-factor table over our small unit set is exact,
 * type-safe, and the most testable). The per-food weight↔volume bridge is
 * bespoke regardless (DIET-03), so a library buys nothing.
 *
 * Hard rule (DIET-03 / D-04, RESEARCH §Open Q1 / Pitfall 5): cross-dimension
 * (mass↔volume) conversion REQUIRES a positive, finite `densityGramsPerMl`.
 * When it is absent/0/NaN/negative, `convertMeasured` THROWS — it NEVER
 * substitutes a global default density. A wrong macro is worse than an error.
 *
 * Named servings (e.g. "1 slice") are NOT MeasuredUnit — they carry an explicit
 * stored gram/ml equivalent and must be resolved by the caller WITHOUT going
 * through `convertMeasured`.
 */

export type Dimension = 'mass' | 'volume';
export type MassUnit = 'g' | 'oz' | 'lb';
export type VolumeUnit = 'ml' | 'tsp' | 'tbsp' | 'cup';
export type MeasuredUnit = MassUnit | VolumeUnit;

const DIMENSION: Record<MeasuredUnit, Dimension> = {
  g: 'mass',
  oz: 'mass',
  lb: 'mass',
  ml: 'volume',
  tsp: 'volume',
  tbsp: 'volume',
  cup: 'volume',
};

/** Canonical units: grams for mass, millilitres for volume (US customary). */
const TO_CANONICAL: Record<MeasuredUnit, number> = {
  g: 1,
  oz: 28.349523125,
  lb: 453.59237,
  ml: 1,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  cup: 236.5882365,
};

/** Thrown when a cross-dimension conversion is attempted without a valid density. */
export class UnitConversionError extends Error {}

/** True for the physical measured units; false for named-serving labels. */
export function isMeasuredUnit(u: string): u is MeasuredUnit {
  return Object.prototype.hasOwnProperty.call(DIMENSION, u);
}

/** Defensive numeric idiom (diet.service.ts:438-440): non-finite → 0. */
function safeNumber(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/**
 * Convert `amount` of `from` into `to`.
 *
 * Within-dimension (mass↔mass, volume↔volume) uses the fixed TO_CANONICAL
 * table. Cross-dimension (mass↔volume) REQUIRES `densityGramsPerMl > 0` &
 * finite — otherwise throws `UnitConversionError`. NEVER defaults the density.
 */
export function convertMeasured(
  amount: number,
  from: MeasuredUnit,
  to: MeasuredUnit,
  densityGramsPerMl?: number,
): number {
  const safeAmount = safeNumber(amount);
  const dFrom = DIMENSION[from];
  const dTo = DIMENSION[to];
  const canonicalFrom = safeAmount * TO_CANONICAL[from]; // grams or millilitres

  if (dFrom === dTo) {
    return canonicalFrom / TO_CANONICAL[to]; // within-dimension
  }

  // Cross-dimension: density is mandatory — never invent a default (DIET-03 / D-04).
  if (
    !densityGramsPerMl ||
    !Number.isFinite(densityGramsPerMl) ||
    densityGramsPerMl <= 0
  ) {
    throw new UnitConversionError('density required for weight↔volume conversion');
  }

  const grams = dFrom === 'mass' ? canonicalFrom : canonicalFrom * densityGramsPerMl;
  const ml = dFrom === 'volume' ? canonicalFrom : canonicalFrom / densityGramsPerMl;
  return dTo === 'mass' ? grams / TO_CANONICAL[to] : ml / TO_CANONICAL[to];
}

/**
 * Resolve a measured (`unit`, `amount`) into the food's `baseUnit` count.
 *
 * Pure helper — NOT food-coupled. The service composes food context (a named
 * serving's explicit gram/ml equivalent is resolved by the caller and never
 * reaches here). Composition order (Pattern 2):
 *   1. identity (unit === baseUnit) → amount unchanged;
 *   2. same-dimension → convertMeasured;
 *   3. cross-dimension → convertMeasured with the food's density (throws if absent).
 */
export function toBaseUnits(
  unit: MeasuredUnit,
  amount: number,
  baseUnit: MeasuredUnit,
  densityGramsPerMl?: number,
): number {
  if (unit === baseUnit) return safeNumber(amount);
  return convertMeasured(amount, unit, baseUnit, densityGramsPerMl);
}
