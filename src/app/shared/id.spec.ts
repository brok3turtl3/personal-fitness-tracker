import { generateId } from './id';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('id.generateId', () => {
  describe('with crypto.randomUUID available (primary path)', () => {
    it('should return a UUID v4-shaped string', () => {
      // Sanity: crypto.randomUUID is the primary path under Karma+Chrome.
      expect(typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function').toBe(true);
      expect(generateId()).toMatch(UUID_V4_REGEX);
    });

    it('should produce 100 unique values', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) ids.add(generateId());
      expect(ids.size).toBe(100);
    });
  });

  describe('with crypto.randomUUID unavailable (fallback path — Pitfall 5)', () => {
    let originalCrypto: typeof globalThis.crypto;

    beforeEach(() => {
      originalCrypto = globalThis.crypto;
      // Force the feature-detection branch: simulate environments without
      // crypto.randomUUID (older Electron file:// per RESEARCH Pitfall 5).
      // We can't directly delete read-only crypto property — replace with
      // a stub that lacks randomUUID.
      Object.defineProperty(globalThis, 'crypto', {
        value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) },
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
    });

    it('should still return a UUID v4-shaped string via Math.random fallback', () => {
      expect((globalThis.crypto as { randomUUID?: unknown }).randomUUID).toBeUndefined();
      expect(generateId()).toMatch(UUID_V4_REGEX);
    });

    it('should produce 100 unique values via fallback', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) ids.add(generateId());
      expect(ids.size).toBe(100);
    });
  });
});
