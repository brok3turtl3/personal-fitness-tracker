import { parseClaimSpans } from './confidence-attribution-parser';
import { ClaimSpan } from '../models/ai-chat.model';

/**
 * E3 safe-degradation spec for the pure confidence/attribution parser.
 *
 * Mirrors validators.spec.ts — no TestBed, no DI; pure-function assertions.
 * The adversarial cases (malformed token, unknown grade, nested brackets)
 * assert the D-09 contract: a malformed/absent token degrades to an unbadged
 * span — never throws, never fabricates a grade.
 */
describe('confidence-attribution-parser', () => {
  describe('parseClaimSpans — confidence axis', () => {
    const grades: ClaimSpan['confidence'][] = [
      'strong',
      'moderate',
      'weak',
      'animal-only',
      'anecdotal',
      'speculative',
    ];

    grades.forEach((grade) => {
      it(`parses [evidence: ${grade}] into confidence='${grade}'`, () => {
        const spans = parseClaimSpans(`Creatine helps strength [evidence: ${grade}].`);
        expect(spans.length).toBe(1);
        expect(spans[0].confidence).toBe(grade);
        expect(spans[0].text).not.toContain('[evidence:');
        expect(spans[0].text).toContain('Creatine helps strength');
      });
    });
  });

  describe('parseClaimSpans — source axis', () => {
    (['data', 'research'] as const).forEach((src) => {
      it(`parses [source: ${src}] into source='${src}'`, () => {
        const spans = parseClaimSpans(`Your average is up [source: ${src}].`);
        expect(spans.length).toBe(1);
        expect(spans[0].source).toBe(src);
        expect(spans[0].text).not.toContain('[source:');
      });
    });
  });

  describe('parseClaimSpans — paired tokens', () => {
    it('parses [evidence: strong][source: data] into both fields with tokens stripped', () => {
      const spans = parseClaimSpans('You lost 2 lbs [evidence: strong][source: data].');
      expect(spans.length).toBe(1);
      expect(spans[0].confidence).toBe('strong');
      expect(spans[0].source).toBe('data');
      expect(spans[0].text).not.toContain('[evidence:');
      expect(spans[0].text).not.toContain('[source:');
      expect(spans[0].text).toContain('You lost 2 lbs');
    });

    it('is tolerant of spacing and case in tokens', () => {
      const spans = parseClaimSpans('Claim [ EVIDENCE :  Moderate ][ Source : Research ].');
      expect(spans[0].confidence).toBe('moderate');
      expect(spans[0].source).toBe('research');
    });
  });

  describe('parseClaimSpans — safe degradation (D-09)', () => {
    it('degrades a garbled [evidence: ???] token to an unbadged span (no throw, text preserved)', () => {
      let spans: ClaimSpan[] = [];
      expect(() => {
        spans = parseClaimSpans('Sleep matters [evidence: ???].');
      }).not.toThrow();
      expect(spans.length).toBe(1);
      expect(spans[0].confidence).toBeUndefined();
      expect(spans[0].text).toContain('Sleep matters');
    });

    it('does NOT fabricate a grade for an unknown value [evidence: superstrong]', () => {
      const spans = parseClaimSpans('Bold claim [evidence: superstrong].');
      expect(spans[0].confidence).toBeUndefined();
      expect(spans[0].source).toBeUndefined();
    });

    it('does NOT fabricate a source for an unknown value [source: hearsay]', () => {
      const spans = parseClaimSpans('Some claim [source: hearsay].');
      expect(spans[0].source).toBeUndefined();
    });

    it('leaves both fields undefined and preserves text when no token is present', () => {
      const spans = parseClaimSpans('Just plain prose with no grading at all.');
      expect(spans.length).toBe(1);
      expect(spans[0].confidence).toBeUndefined();
      expect(spans[0].source).toBeUndefined();
      expect(spans[0].text).toBe('Just plain prose with no grading at all.');
    });

    it('returns a valid ClaimSpan[] for empty-string input (no throw)', () => {
      let spans: ClaimSpan[] = [];
      expect(() => {
        spans = parseClaimSpans('');
      }).not.toThrow();
      expect(Array.isArray(spans)).toBe(true);
      spans.forEach((s) => expect(typeof s.text).toBe('string'));
    });

    it('does not throw on adversarial nested brackets [[evidence: weak]]', () => {
      let spans: ClaimSpan[] = [];
      expect(() => {
        spans = parseClaimSpans('Nested [[evidence: weak]] claim.');
      }).not.toThrow();
      expect(Array.isArray(spans)).toBe(true);
      spans.forEach((s) => expect(typeof s.text).toBe('string'));
    });
  });

  describe('parseClaimSpans — multi-claim', () => {
    it('yields one span per sentence, each carrying its own trailing tokens', () => {
      const text =
        'Creatine works [evidence: strong][source: research]. Your weight dropped [evidence: moderate][source: data].';
      const spans = parseClaimSpans(text);
      expect(spans.length).toBe(2);
      expect(spans[0].confidence).toBe('strong');
      expect(spans[0].source).toBe('research');
      expect(spans[1].confidence).toBe('moderate');
      expect(spans[1].source).toBe('data');
    });
  });

  describe('parseClaimSpans — idempotency', () => {
    it('produces identical spans when run twice on the same input (idempotent)', () => {
      const input =
        'First claim [evidence: strong]. Garbled [evidence: ???]. Plain prose.';
      const first = parseClaimSpans(input);
      const second = parseClaimSpans(input);
      expect(second).toEqual(first);
    });

    it('is idempotent across the paired-token case', () => {
      const input = 'Paired [evidence: weak][source: data].';
      expect(parseClaimSpans(input)).toEqual(parseClaimSpans(input));
    });
  });
});
