/**
 * web-citation-parser.ts
 *
 * PURE MODULE — no dependency injection (no Angular injectable decorator), no
 * persistence-service coupling, no class. Mirrors validators.ts /
 * chat-block-serializer.ts / confidence-attribution-parser.ts.
 *
 * D-17 SDK-import boundary: this is the THIRD sanctioned Anthropic-SDK
 * importer (alongside `anthropic-api.service.ts` + `chat-block-serializer.ts`),
 * and it imports ONLY a type — `TextCitation` — and emits a local SDK-free
 * `GroundedCitation`. SDK types never cross its output boundary.
 *
 * Narrows the SDK `TextCitation` union into the one citation type Phase 5
 * allows to become a link, `https:`-gated, converted to a local structural
 * shape so the renderer can never be tricked into linking a non-structured
 * string (D-03/D-09, RESEARCH Pitfall 1/2):
 *   - allow-list `type === 'web_search_result_location'` ONLY,
 *   - `new URL().protocol === 'https:'` gate (http:/ftp:/javascript:/unparseable dropped),
 *   - null/blank title falls back to the URL host (never a blank link),
 *   - degrades safely otherwise (dropped, never thrown).
 *
 * Threat-model:
 *   - T-05-02-01 (Spoofing / false provenance): allow-list — a fabricated or
 *     other citation type can NEVER become a GroundedCitation (D-09).
 *   - T-05-02-02 (Tampering / unsafe link): `https:`-only protocol gate via
 *     `new URL().protocol` in try/catch — every non-https or unparseable url is
 *     dropped, never linked (Pitfall 2).
 *   - T-05-02-06 (DoS / crash): total function — every input (undefined, empty,
 *     garbage) returns a valid `GroundedCitation[]`, never throws.
 *
 * Retry logic: NONE. A malformed/non-https citation is silently dropped and
 * degrades to an unbadged, unlinked claim (05-AI-SPEC §4b(a)).
 */
import type { TextCitation } from '@anthropic-ai/sdk/resources/messages';

/**
 * Local structural shape — what the renderer sees. NO SDK types past this
 * point (D-17). Mirrors `ClaimSpan` in ai-chat.model.ts.
 */
export interface GroundedCitation {
  /** GUARANTEED https: (gated below). */
  readonly url: string;
  /** Falls back to the host when the API title is null/blank. Never blank. */
  readonly title: string;
  /** The cited_text excerpt, for the footnote tooltip. Coerced from null. */
  readonly citedText: string;
}

/**
 * Narrow + https-gate the SDK citation union into local GroundedCitation[].
 *
 * Total function — any input returns a valid `GroundedCitation[]`; never throws,
 * never fabricates a link.
 */
export function toGroundedCitations(
  citations: readonly TextCitation[] | undefined,
): GroundedCitation[] {
  if (!citations) return [];
  const out: GroundedCitation[] = [];
  for (const c of citations) {
    // (1) ALLOW-LIST: only the structured web-search citation may become a link (D-09).
    if (c.type !== 'web_search_result_location') continue; // ignore every other citation type
    // (2) HTTPS GATE: a non-https url is dropped entirely — never rendered as a link (D-03).
    let parsed: URL;
    try {
      parsed = new URL(c.url);
    } catch {
      continue; // unparseable ⇒ drop, no throw
    }
    if (parsed.protocol !== 'https:') continue; // http:/ftp:/javascript: ⇒ dropped
    out.push({
      url: parsed.toString(),
      title: c.title?.trim() || parsed.host, // null/blank title ⇒ show the host, never blank
      citedText: c.cited_text ?? '',
    });
  }
  return out;
}

/**
 * Dedupe by URL for the per-message "Sources" list (the model often cites one
 * source twice). Preserves first occurrence + order. Never throws.
 */
export function toSourcesList(
  citations: readonly GroundedCitation[],
): GroundedCitation[] {
  const seen = new Set<string>();
  return citations.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}
