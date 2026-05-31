/**
 * confidence-attribution-parser.ts
 *
 * PURE MODULE — no DI (no Angular injectable decorator), no StorageService, no
 * Anthropic SDK import (D-17 chokepoint). Mirrors validators.ts /
 * chat-block-serializer.ts.
 *
 * Narrows graded assistant text into typed ClaimSpan[]. The model emits inline
 * grading tokens on graded claims — a confidence axis
 * `[evidence: strong|moderate|weak|animal-only|anecdotal|speculative]` (D-09)
 * and a source axis `[source: data|research]` (D-10). This module:
 *   - strips those tokens from the rendered claim text,
 *   - sets `confidence`/`source` ONLY when a token matches the allow-list,
 *   - degrades safely otherwise (malformed/absent token ⇒ unbadged span).
 *
 * Threat-model:
 *   - T-04-01-01 (Spoofing / false provenance): allow-list `ReadonlySet`s gate
 *     every assignment — an unknown/garbled token leaves the field `undefined`.
 *     The parser can NEVER fabricate a grade the model didn't validly emit.
 *   - T-04-01-02 (DoS / crash): total function — every input (empty, nested
 *     brackets, garbage) returns a valid `ClaimSpan[]`, never throws.
 *
 * Retry logic: NONE. A missing/garbled token degrades to an unbadged claim and
 * does NOT trigger a re-call (04-AI-SPEC §4b(a)).
 */
import type { Confidence, Attribution, ClaimSpan } from '../models/ai-chat.model';

/** Canonical confidence allow-list (D-09). Frozen module-scope constant. */
const CONFIDENCE_VALUES: ReadonlySet<string> = new Set([
  'strong',
  'moderate',
  'weak',
  'animal-only',
  'anecdotal',
  'speculative',
]);

/** Canonical source allow-list (D-10). */
const SOURCE_VALUES: ReadonlySet<string> = new Set(['data', 'research']);

/**
 * Matches `[evidence: weak]` / `[source: research]` — case-insensitive,
 * tolerant of internal spacing. Captures axis (group 1) and raw value (group 2).
 */
const TOKEN_RE = /\[\s*(evidence|source)\s*:\s*([a-z-]+)\s*\]/gi;

/** Sentence-boundary split: `.`/`!`/`?` (optionally followed by `]`) then whitespace. */
const SENTENCE_BOUNDARY_RE = /(?<=[.!?]\]?)\s+/;

/**
 * Parse assistant text into typed claim spans.
 *
 * Total function — any input returns a valid `ClaimSpan[]`; never throws. Each
 * sentence becomes one span carrying its own trailing grading tokens; the
 * tokens are stripped from `.text`. A multi-claim paragraph yields one span per
 * sentence.
 */
export function parseClaimSpans(assistantText: string): ClaimSpan[] {
  return splitIntoClaimChunks(assistantText).map((chunk) => {
    let confidence: Confidence | undefined;
    let source: Attribution | undefined;
    let match: RegExpExecArray | null;

    // Reset stateful global regex before each chunk (avoids lastIndex carry-over).
    TOKEN_RE.lastIndex = 0;
    while ((match = TOKEN_RE.exec(chunk)) !== null) {
      const [, axis, rawValue] = match;
      const value = rawValue.toLowerCase();
      if (axis.toLowerCase() === 'evidence' && CONFIDENCE_VALUES.has(value)) {
        // Allow-list gate — unknown grade is left undefined (no fabrication, D-09).
        confidence = value as Confidence;
      } else if (axis.toLowerCase() === 'source' && SOURCE_VALUES.has(value)) {
        source = value as Attribution;
      }
      // Malformed/unknown token: silently ignored ⇒ span renders unbadged.
    }

    return { text: stripTokens(chunk), confidence, source };
  });
}

/**
 * Split text on sentence boundaries, keeping each sentence's trailing grading
 * tokens attached to the preceding sentence (04-RESEARCH Open Question #2).
 * Whitespace-only / empty input yields a single empty-text chunk so callers
 * always get a valid `ClaimSpan[]`.
 */
function splitIntoClaimChunks(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed === '') {
    return [''];
  }
  return trimmed
    .split(SENTENCE_BOUNDARY_RE)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

/**
 * Remove every grading token from a chunk and collapse the whitespace left
 * behind. A fresh regex instance avoids mutating the shared `TOKEN_RE` state.
 */
function stripTokens(chunk: string): string {
  const re = new RegExp(TOKEN_RE.source, TOKEN_RE.flags);
  return chunk
    .replace(re, '')
    .replace(/\s+/g, ' ')
    .trim();
}
