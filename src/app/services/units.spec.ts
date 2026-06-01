import {
  convertMeasured,
  toBaseUnits,
  isMeasuredUnit,
  UnitConversionError,
  MeasuredUnit,
} from './units';

describe('units.ts — pure unit/density conversion', () => {
  describe('convertMeasured — within-dimension (mass)', () => {
    it('converts grams to ounces', () => {
      expect(convertMeasured(100, 'g', 'oz')).toBeCloseTo(3.5274, 4);
    });

    it('converts pounds to grams via the canonical factor', () => {
      expect(convertMeasured(1, 'lb', 'g')).toBeCloseTo(453.59237, 5);
    });

    it('identity conversion returns the input amount', () => {
      expect(convertMeasured(5, 'g', 'g')).toBe(5);
    });
  });

  describe('convertMeasured — within-dimension (volume)', () => {
    it('converts cup to ml exactly (US customary)', () => {
      expect(convertMeasured(1, 'cup', 'ml')).toBe(236.5882365);
    });

    it('converts tbsp to tsp (3 tsp per tbsp)', () => {
      expect(convertMeasured(1, 'tbsp', 'tsp')).toBeCloseTo(3, 9);
    });
  });

  describe('convertMeasured — cross-dimension WITH density', () => {
    it('mass→volume uses density (g→ml at 0.5 g/ml doubles volume)', () => {
      expect(convertMeasured(100, 'g', 'ml', 0.5)).toBe(200);
    });

    it('volume→mass uses density (ml→g at 0.5 g/ml halves mass)', () => {
      expect(convertMeasured(200, 'ml', 'g', 0.5)).toBe(100);
    });
  });

  describe('convertMeasured — cross-dimension WITHOUT a valid density THROWS', () => {
    it('throws when density is absent', () => {
      expect(() => convertMeasured(100, 'g', 'ml')).toThrowError(UnitConversionError);
    });

    it('throws when density is 0 (never defaults to 1)', () => {
      expect(() => convertMeasured(100, 'g', 'ml', 0)).toThrowError(UnitConversionError);
    });

    it('throws when density is NaN', () => {
      expect(() => convertMeasured(100, 'g', 'ml', NaN)).toThrowError(UnitConversionError);
    });

    it('throws when density is negative', () => {
      expect(() => convertMeasured(100, 'g', 'ml', -1)).toThrowError(UnitConversionError);
    });

    it('throws on volume→mass without density too', () => {
      expect(() => convertMeasured(200, 'ml', 'g')).toThrowError(UnitConversionError);
    });
  });

  describe('convertMeasured — defensive numeric guard on amount', () => {
    it('treats a non-finite amount as 0', () => {
      expect(convertMeasured(NaN as number, 'g', 'oz')).toBe(0);
    });
  });

  describe('isMeasuredUnit', () => {
    const measured: MeasuredUnit[] = ['g', 'oz', 'lb', 'ml', 'tsp', 'tbsp', 'cup'];
    measured.forEach((u) => {
      it(`returns true for '${u}'`, () => {
        expect(isMeasuredUnit(u)).toBe(true);
      });
    });

    it('returns false for a named-serving label', () => {
      expect(isMeasuredUnit('slice')).toBe(false);
      expect(isMeasuredUnit('')).toBe(false);
    });
  });

  describe('toBaseUnits — pure helper (not food-coupled)', () => {
    it('returns amount unchanged when unit === baseUnit (identity)', () => {
      expect(toBaseUnits('g', 10, 'g')).toBe(10);
    });

    it('same-dimension resolves via convertMeasured (oz→g base)', () => {
      // 2 oz expressed in grams base = 2 * 28.349523125
      expect(toBaseUnits('oz', 2, 'g')).toBeCloseTo(56.69904625, 6);
    });

    it('cross-dimension resolves via density (ml amount, g base, 0.5 g/ml)', () => {
      // 200 ml of a 0.5 g/ml food → 100 g
      expect(toBaseUnits('ml', 200, 'g', 0.5)).toBe(100);
    });

    it('cross-dimension WITHOUT density throws UnitConversionError', () => {
      expect(() => toBaseUnits('ml', 200, 'g')).toThrowError(UnitConversionError);
    });
  });
});
