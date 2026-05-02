/**
 * Generates a UUID v4 string suitable for local entity identifiers.
 *
 * Primary path: crypto.randomUUID() — cryptographically strong, available in
 * all modern browsers and Electron >= 22 in secure contexts (file:// included).
 *
 * Fallback path: Math.random()-based template — used when crypto.randomUUID
 * is unavailable (very old engines, non-secure contexts). NOT cryptographically
 * strong; acceptable here because IDs are local identifiers, not auth tokens
 * or session keys (per RESEARCH §"Security Domain" V6).
 *
 * Replaces 6 duplicated generateUUID copies (Wave 2 plan 06):
 * - cardio.service.ts:24, weight.service.ts:24, readings.service.ts:38,
 *   diet.service.ts:26, chat.service.ts:13, diet-page.component.ts:9-15
 *
 * TODO: drop fallback once minimum Electron is >= 22 across all targets.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
