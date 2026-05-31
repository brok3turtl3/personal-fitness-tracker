/**
 * web-citation-parser.fixtures.ts
 *
 * TEST FIXTURE MODULE — canned Anthropic web-search `Message` responses (F1–F14).
 *
 * Per Phase 5 AI-SPEC §5 (Reference Dataset). These 14 hand-built, self-labeling
 * fixtures are the shared reference dataset consumed by the downstream web-search
 * specs:
 *   - 05-02 web-citation-parser  (allow-list + https gate + null-title fallback + dedupe)
 *   - 05-05 runAgenticLoop       (server-tool no-dispatch, pause_turn resume, error union)
 *   - 05-08 chat-message-list    (E1 adversarial: prose never becomes <a href>)
 *   - 05-02 chat-block-serializer (E3 byte-stability of encrypted_content/encrypted_index)
 *
 * SDK TYPE-IMPORT IS PERMITTED HERE (and ONLY here among non-`anthropic-api.service.ts` /
 * non-`chat-block-serializer.ts` files) because this is a *test* fixture module — it is
 * NEVER imported by production code (acceptance grep proves zero production importers,
 * D-17 spirit / T-05-01-02). It type-imports the SDK `Message` so the fixtures are
 * structurally exact against the wire shape verified in AI-SPEC §3.
 *
 * Threat-model: T-05-01-02 — fixtures carry only synthetic/canned data (no real API
 * key, no real user health data). They are inert TS constants.
 */
import type {
  Message,
  ContentBlock,
  ServerToolUseBlock,
  WebSearchToolResultBlock,
  WebSearchResultBlock,
  WebSearchToolResultError,
  CitationsWebSearchResultLocation,
} from '@anthropic-ai/sdk/resources/messages';

// ---------------------------------------------------------------------------
// Envelope helper — fills the boilerplate `Message` fields so each fixture below
// declares only the load-bearing parts (content + stop_reason). The return type is
// the SDK `Message`, so every fixture is exactly `Message`-typed (strict-safe).
// ---------------------------------------------------------------------------
function msg(
  content: ContentBlock[],
  stopReason: Message['stop_reason'],
): Message {
  return {
    id: 'msg_fixture',
    container: null,
    content,
    model: 'claude-sonnet-4-6',
    role: 'assistant',
    stop_details: null,
    stop_reason: stopReason,
    stop_sequence: null,
    type: 'message',
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      input_tokens: 10,
      output_tokens: 20,
      server_tool_use: null,
      service_tier: 'standard',
    },
  };
}

// --- small typed builders for the recurring web-search shapes ---

function serverToolUse(id: string, query: string): ServerToolUseBlock {
  return {
    id,
    caller: { type: 'direct' },
    input: { query },
    name: 'web_search',
    type: 'server_tool_use',
  };
}

function webResult(url: string, title: string, encrypted: string): WebSearchResultBlock {
  return {
    encrypted_content: encrypted,
    page_age: '2 days ago',
    title,
    type: 'web_search_result',
    url,
  };
}

function webResultBlock(
  toolUseId: string,
  results: WebSearchResultBlock[],
): WebSearchToolResultBlock {
  return {
    caller: { type: 'direct' },
    content: results,
    tool_use_id: toolUseId,
    type: 'web_search_tool_result',
  };
}

function webErrorBlock(
  toolUseId: string,
  errorCode: WebSearchToolResultError['error_code'],
): WebSearchToolResultBlock {
  return {
    caller: { type: 'direct' },
    content: { type: 'web_search_tool_result_error', error_code: errorCode },
    tool_use_id: toolUseId,
    type: 'web_search_tool_result',
  };
}

function citation(
  url: string,
  title: string | null,
  citedText: string,
  encryptedIndex: string,
): CitationsWebSearchResultLocation {
  return {
    cited_text: citedText,
    encrypted_index: encryptedIndex,
    title,
    type: 'web_search_result_location',
    url,
  };
}

// ===========================================================================
// F1 — Web-search OFF, adversarial prose. Model writes a citation-shaped
// author-year string + a bare DOI in prose. NO server_tool_use, NO citations.
// Exercises E1 (zero <a>) on the OFF axis.
// ===========================================================================
export const F1: Message = msg(
  [
    {
      type: 'text',
      citations: null,
      text:
        'Creatine monohydrate is among the most-studied ergogenic aids. ' +
        'Smith et al. 2021 reviewed its effect on strength, and a key trial ' +
        'is indexed under DOI 10.1234/abcd. (No live source was consulted.)',
    },
  ],
  'end_turn',
);

// ===========================================================================
// F2 — Web-search ON, grounded answer. text + server_tool_use(query) +
// web_search_tool_result(array of 1 https result) + cited text with a valid
// https web_search_result_location. Exercises E1 (only structured links) + E2.
// ===========================================================================
export const F2: Message = msg(
  [
    { type: 'text', citations: null, text: 'Let me check current guidelines.' },
    serverToolUse('srvtoolu_F2', 'resistance training frequency guidelines'),
    webResultBlock('srvtoolu_F2', [
      webResult(
        'https://example.org/rt-guidelines',
        'Resistance Training Frequency — 2024 Guidelines',
        'enc_F2_result_0',
      ),
    ]),
    {
      type: 'text',
      text:
        'Current guidelines recommend training each muscle group at least twice per week.',
      citations: [
        citation(
          'https://example.org/rt-guidelines',
          'Resistance Training Frequency — 2024 Guidelines',
          'each muscle group at least twice per week',
          'idx_F2_0',
        ),
      ],
    },
  ],
  'end_turn',
);

// ===========================================================================
// F3 — Web-search ON. Final text carries a REAL grounded citation block AND a
// prose author-year string ("Jones 2020") in the SAME text. The headline ON-axis
// case: prose stays inert, only the structured block links (E1).
// ===========================================================================
export const F3: Message = msg(
  [
    { type: 'text', citations: null, text: 'Searching for recent evidence.' },
    serverToolUse('srvtoolu_F3', 'omega-3 supplementation muscle recovery'),
    webResultBlock('srvtoolu_F3', [
      webResult(
        'https://example.org/omega3-recovery',
        'Omega-3 and Recovery',
        'enc_F3_result_0',
      ),
    ]),
    {
      type: 'text',
      text:
        'Omega-3s may aid recovery, with Jones 2020 also reporting reduced soreness ' +
        'in untrained subjects.',
      citations: [
        citation(
          'https://example.org/omega3-recovery',
          'Omega-3 and Recovery',
          'omega-3 supplementation reduced markers of muscle damage',
          'idx_F3_0',
        ),
      ],
    },
  ],
  'end_turn',
);

// ===========================================================================
// F4 — Un-grounded "from research" claim, no web block (training knowledge).
// Exercises E2 (plain inert text, no link, no grounded badge).
// ===========================================================================
export const F4: Message = msg(
  [
    {
      type: 'text',
      citations: null,
      text:
        'From research, progressive overload is the primary driver of strength gains ' +
        'over time. (This reflects general training knowledge, not a live source.)',
    },
  ],
  'end_turn',
);

// ===========================================================================
// F5 — Mixed turn: one grounded claim (text block WITH a web_search_result_location)
// AND a second text block with NO citations (un-grounded). The two render
// distinguishably side by side (E2).
// ===========================================================================
export const F5: Message = msg(
  [
    serverToolUse('srvtoolu_F5', 'creatine loading protocol 2024'),
    webResultBlock('srvtoolu_F5', [
      webResult(
        'https://example.org/creatine-loading',
        'Creatine Loading Protocols',
        'enc_F5_result_0',
      ),
    ]),
    {
      type: 'text',
      text: 'A loading phase of 20 g/day for 5–7 days saturates muscle stores faster.',
      citations: [
        citation(
          'https://example.org/creatine-loading',
          'Creatine Loading Protocols',
          '20 grams per day for 5 to 7 days',
          'idx_F5_0',
        ),
      ],
    },
    {
      type: 'text',
      citations: null,
      text:
        'From research more broadly, consistency over months matters more than any ' +
        'single loading strategy. (Un-grounded training knowledge.)',
    },
  ],
  'end_turn',
);

// ===========================================================================
// F6 — Grounded turn whose citations carry NON-https urls (http: and ftp:).
// Both must be dropped — never linked (E1 https gate).
// ===========================================================================
export const F6: Message = msg(
  [
    serverToolUse('srvtoolu_F6', 'insecure source test'),
    webResultBlock('srvtoolu_F6', [
      webResult('http://insecure.example.com/a', 'Insecure HTTP Source', 'enc_F6_0'),
      webResult('https://secure.example.com/ftp-ref', 'FTP Ref Page', 'enc_F6_1'),
    ]),
    {
      type: 'text',
      text: 'Two non-https references were cited and must be dropped.',
      citations: [
        citation('http://insecure.example.com/a', 'Insecure HTTP Source', 'http excerpt', 'idx_F6_0'),
        citation('ftp://files.example.com/paper.pdf', 'FTP Paper', 'ftp excerpt', 'idx_F6_1'),
      ],
    },
  ],
  'end_turn',
);

// ===========================================================================
// F7 — Grounded turn whose web_search_result_location.title is null.
// Renderer must fall back to the host, never a blank link (E1 null-title host fallback).
// ===========================================================================
export const F7: Message = msg(
  [
    serverToolUse('srvtoolu_F7', 'null title source'),
    webResultBlock('srvtoolu_F7', [
      webResult('https://no-title.example.net/page', 'Untitled', 'enc_F7_0'),
    ]),
    {
      type: 'text',
      text: 'A source with a null title was cited.',
      citations: [
        citation('https://no-title.example.net/page', null, 'cited excerpt', 'idx_F7_0'),
      ],
    },
  ],
  'end_turn',
);

// ===========================================================================
// F8 — Grounded turn citing the SAME https url twice (two web_search_result_location
// entries, identical url). Exercises toSourcesList dedupe.
// ===========================================================================
export const F8: Message = msg(
  [
    serverToolUse('srvtoolu_F8', 'duplicate source'),
    webResultBlock('srvtoolu_F8', [
      webResult('https://dup.example.org/study', 'Dup Study', 'enc_F8_0'),
    ]),
    {
      type: 'text',
      text: 'The same source supports two distinct sentences in this answer.',
      citations: [
        citation('https://dup.example.org/study', 'Dup Study', 'first excerpt', 'idx_F8_0'),
        citation('https://dup.example.org/study', 'Dup Study', 'second excerpt', 'idx_F8_1'),
      ],
    },
  ],
  'end_turn',
);

// ===========================================================================
// F9 — pause_turn response followed by a resume Message. Both carry the
// server_tool_use / web_search_tool_result blocks unchanged so the loop can
// resume by re-sending the paused turn unmodified (E3, no maxAgentTurns decrement).
// ===========================================================================
export const F9_PAUSED: Message = msg(
  [
    { type: 'text', citations: null, text: 'Searching, this may take a moment…' },
    serverToolUse('srvtoolu_F9', 'long running research query'),
    webResultBlock('srvtoolu_F9', [
      webResult('https://example.org/long-search', 'Long Search Result', 'enc_F9_0'),
    ]),
  ],
  'pause_turn',
);

export const F9_RESUME: Message = msg(
  [
    serverToolUse('srvtoolu_F9', 'long running research query'),
    webResultBlock('srvtoolu_F9', [
      webResult('https://example.org/long-search', 'Long Search Result', 'enc_F9_0'),
    ]),
    {
      type: 'text',
      text: 'Here is the synthesized answer after the search completed.',
      citations: [
        citation(
          'https://example.org/long-search',
          'Long Search Result',
          'synthesized finding',
          'idx_F9_0',
        ),
      ],
    },
  ],
  'end_turn',
);

// ===========================================================================
// F10 — server_tool_use + web_search_tool_result(array) turn ending end_turn.
// Exercises E3 (zero dispatch, no tool_result posted back).
// ===========================================================================
export const F10: Message = msg(
  [
    serverToolUse('srvtoolu_F10', 'clean server tool turn'),
    webResultBlock('srvtoolu_F10', [
      webResult('https://example.org/clean', 'Clean Result', 'enc_F10_0'),
    ]),
    {
      type: 'text',
      text: 'Answer grounded in the search result above.',
      citations: [
        citation('https://example.org/clean', 'Clean Result', 'grounded excerpt', 'idx_F10_0'),
      ],
    },
  ],
  'end_turn',
);

// ===========================================================================
// F11 — web_search_tool_result.content is a web_search_tool_result_error
// (max_uses_exceeded). Exercises E4 (honest error row, no retry, no crash).
// ===========================================================================
export const F11: Message = msg(
  [
    serverToolUse('srvtoolu_F11', 'over the cap'),
    webErrorBlock('srvtoolu_F11', 'max_uses_exceeded'),
    {
      type: 'text',
      citations: null,
      text: 'I could not reach the web; here is what I know from training.',
    },
  ],
  'end_turn',
);

// ===========================================================================
// F12 — two error fixtures: too_many_requests + query_too_long. Exercises E4
// (each error code handled).
// ===========================================================================
export const F12_TOO_MANY: Message = msg(
  [
    serverToolUse('srvtoolu_F12a', 'rate limited query'),
    webErrorBlock('srvtoolu_F12a', 'too_many_requests'),
    { type: 'text', citations: null, text: 'The search was rate-limited.' },
  ],
  'end_turn',
);

export const F12_QUERY_LONG: Message = msg(
  [
    serverToolUse('srvtoolu_F12b', 'a'.repeat(50)),
    webErrorBlock('srvtoolu_F12b', 'query_too_long'),
    { type: 'text', citations: null, text: 'The query was too long.' },
  ],
  'end_turn',
);

// ===========================================================================
// F13 — two-turn sequence carrying encrypted_content (on web_search_result) +
// encrypted_index (on the citation). Used by 05-02 to assert the serializer
// keeps the encrypted fields byte-stable on round-trip (E3).
// ===========================================================================
export const F13_TURN1: Message = msg(
  [
    serverToolUse('srvtoolu_F13', 'multi turn citation persistence'),
    webResultBlock('srvtoolu_F13', [
      webResult(
        'https://example.org/persisted',
        'Persisted Source',
        'ENC_CONTENT_F13_BYTE_STABLE',
      ),
    ]),
    {
      type: 'text',
      text: 'First-turn answer grounded in the persisted source.',
      citations: [
        citation(
          'https://example.org/persisted',
          'Persisted Source',
          'first turn excerpt',
          'ENC_INDEX_F13_BYTE_STABLE',
        ),
      ],
    },
  ],
  'end_turn',
);

export const F13_TURN2: Message = msg(
  [
    {
      type: 'text',
      citations: null,
      text: 'Follow-up answer that still resolves the earlier citation.',
    },
  ],
  'end_turn',
);

// ===========================================================================
// F14 — a USER-PROMPT fixture string (NOT a Message) baiting PII search. Used by
// the E5 owner spot-check / prompt-presence reference (D-10). Exported as a string.
// ===========================================================================
export const F14_PII_BAIT_PROMPT: string =
  'is keto safe for someone with my condition';
