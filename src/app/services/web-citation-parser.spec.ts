import { toGroundedCitations, toSourcesList, GroundedCitation } from './web-citation-parser';
import type { TextCitation } from '@anthropic-ai/sdk/resources/messages';

/**
 * Spec for web-citation-parser.ts pure module (Plan 05-02 Task 1).
 *
 * The parser is the D-17 transport-boundary narrowing step: it takes the SDK
 * `TextCitation[]` union and emits a local, SDK-free `GroundedCitation[]`,
 * admitting ONLY `web_search_result_location` citations whose url parses as
 * `https:` (D-03/D-09). It is a total function — never throws, never
 * fabricates a link.
 *
 * Threat-model coverage:
 *   - T-05-02-01 (Spoofing): allow-list drops every non-web_search_result_location type.
 *   - T-05-02-02 (Tampering): https-gate drops http:/ftp:/unparseable urls.
 *   - T-05-02-06 (DoS): total function — any input returns a valid array.
 *
 * Consumes the shared F6/F7/F8 fixtures (05-01) for the non-https / null-title /
 * dedupe cases. F-fixtures are SDK `Message`s; this spec pulls the relevant
 * `citations` arrays off their text blocks.
 */
import { F6, F7, F8 } from './web-citation-parser.fixtures';
import type { TextBlock as SdkTextBlock } from '@anthropic-ai/sdk/resources/messages';

/** Pull the `citations` array off the (last) text block of a fixture Message. */
function citationsOf(content: { type: string }[]): TextCitation[] {
  const textBlocks = content.filter(
    (b): b is SdkTextBlock => b.type === 'text',
  );
  const last = textBlocks[textBlocks.length - 1];
  return (last?.citations ?? []) as TextCitation[];
}

/** Convenience builder for an inline web_search_result_location citation. */
function webLoc(
  url: string,
  title: string | null,
  citedText: string | null,
): TextCitation {
  return {
    type: 'web_search_result_location',
    url,
    title,
    cited_text: citedText,
    encrypted_index: 'Eo',
  } as unknown as TextCitation;
}

describe('web-citation-parser', () => {
  describe('toGroundedCitations', () => {
    it('returns [] for undefined input (total function)', () => {
      expect(toGroundedCitations(undefined)).toEqual([]);
    });

    it('returns [] for an empty array', () => {
      expect(toGroundedCitations([])).toEqual([]);
    });

    it('narrows a valid https web_search_result_location to a GroundedCitation', () => {
      const out = toGroundedCitations([
        webLoc('https://x.com/a', 'A', 'cited excerpt'),
      ]);
      expect(out).toEqual([
        { url: 'https://x.com/a', title: 'A', citedText: 'cited excerpt' },
      ]);
    });

    it('drops a citation whose type is NOT web_search_result_location (allow-list, D-09)', () => {
      const charLoc = {
        type: 'char_location',
        document_index: 0,
        document_title: 'doc',
        start_char_index: 0,
        end_char_index: 5,
        cited_text: 'hello',
      } as unknown as TextCitation;
      expect(toGroundedCitations([charLoc])).toEqual([]);
    });

    it('drops an http: url (https gate, D-03) [F6]', () => {
      const out = toGroundedCitations([webLoc('http://x.com', 'HTTP', 'x')]);
      expect(out).toEqual([]);
    });

    it('drops an ftp: url (https gate, D-03) [F6]', () => {
      const out = toGroundedCitations([webLoc('ftp://x', 'FTP', 'x')]);
      expect(out).toEqual([]);
    });

    it('drops an unparseable url without throwing (total function)', () => {
      let out: GroundedCitation[] = [];
      expect(() => {
        out = toGroundedCitations([webLoc('not a url', 'Bad', 'x')]);
      }).not.toThrow();
      expect(out).toEqual([]);
    });

    it('falls back to the URL host when title is null (never blank) [F7]', () => {
      const out = toGroundedCitations([
        webLoc('https://no-title.example.net/page', null, 'excerpt'),
      ]);
      expect(out.length).toBe(1);
      expect(out[0].title).toBe('no-title.example.net');
    });

    it('falls back to the URL host when title is whitespace-only', () => {
      const out = toGroundedCitations([
        webLoc('https://host.example.org/p', '   ', 'excerpt'),
      ]);
      expect(out.length).toBe(1);
      expect(out[0].title).toBe('host.example.org');
    });

    it('coerces a null/undefined cited_text to empty string', () => {
      const out = toGroundedCitations([
        webLoc('https://x.com/a', 'A', null),
      ]);
      expect(out.length).toBe(1);
      expect(out[0].citedText).toBe('');
    });

    it('F6 fixture: both non-https citations are dropped (zero output)', () => {
      const out = toGroundedCitations(citationsOf(F6.content));
      expect(out.length).toBe(0);
    });

    it('F7 fixture: null-title citation falls back to host', () => {
      const out = toGroundedCitations(citationsOf(F7.content));
      expect(out.length).toBe(1);
      expect(out[0].url).toBe('https://no-title.example.net/page');
      expect(out[0].title).toBe('no-title.example.net');
    });
  });

  describe('toSourcesList', () => {
    it('dedupes by url (F8 → 1 entry)', () => {
      const grounded = toGroundedCitations(citationsOf(F8.content));
      // F8 cites the same https url twice.
      expect(grounded.length).toBe(2);
      const sources = toSourcesList(grounded);
      expect(sources.length).toBe(1);
      expect(sources[0].url).toBe('https://dup.example.org/study');
    });

    it('returns [] for an empty array, never throws', () => {
      expect(() => toSourcesList([])).not.toThrow();
      expect(toSourcesList([])).toEqual([]);
    });

    it('preserves first occurrence and order on dedupe', () => {
      const input: GroundedCitation[] = [
        { url: 'https://a.com', title: 'A', citedText: 'first' },
        { url: 'https://b.com', title: 'B', citedText: 'second' },
        { url: 'https://a.com', title: 'A', citedText: 'dup' },
      ];
      const out = toSourcesList(input);
      expect(out.map((c: GroundedCitation) => c.url)).toEqual(['https://a.com', 'https://b.com']);
      expect(out[0].citedText).toBe('first');
    });
  });
});
