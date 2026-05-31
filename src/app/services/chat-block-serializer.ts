/**
 * chat-block-serializer.ts
 *
 * PURE MODULE — no DI, no @Injectable.
 *
 * Single seam where our persisted ChatBlock[] meets the Anthropic wire
 * ContentBlockParam[]. Mirrors validators.ts's pure-module pattern.
 *
 * D-15: ChatMessage.content has been replaced with blocks: ChatBlock[].
 * D-16: persistence-only fields (status, editedFromText) are stripped
 *       BEFORE going on the wire. status='discarded' blocks are dropped
 *       entirely. status='pending' tool_use is replaced with a plain-text
 *       placeholder so the API never sees an unfinished tool_use loop.
 * 03-07: approved/edited tool_use degrades to placeholder text when no
 *       paired tool_result exists — prevents the Anthropic 400
 *       unpaired-tool_use brick (SC3-UNPAIRED-TOOLUSE).
 * 05-02 (Pitfall 1, D-02/D-03): `server_tool_use` + `web_search_tool_result`
 *       blocks pass through VERBATIM in both directions — `encrypted_content`
 *       (on results) and `encrypted_index` (carried inside the SDK citation,
 *       NOT persisted on our narrowed GroundedCitation) are the multi-turn
 *       resolution tokens; the result block's `encrypted_content` round-trips
 *       byte-stable (F13). The narrowed `TextBlock.citations` (GroundedCitation[])
 *       is render-only and is deliberately NOT re-emitted onto the wire
 *       `TextBlockParam` — replaying our lossy local shape (no `encrypted_index`)
 *       would be useless to the model, whereas the verbatim server-tool result
 *       block is what Anthropic actually resolves against on the next turn.
 *
 * Threat-model:
 *   - T-3-WL (Information Disclosure): persistence-only fields stripped
 *   - T-3-PT (Tampering): pending tool_use becomes plain-text placeholder
 *   - T-05-02-03 (Tampering): encrypted_content passed through verbatim,
 *     never decoded/modified (F13 byte-stability spec)
 *
 * Lint chokepoint (D-17): only this file, `anthropic-api.service.ts`, and
 * `web-citation-parser.ts` (import type only) may import from the Anthropic
 * SDK or its sub-paths.
 */
import type {
  ContentBlockParam,
  Message,
  ServerToolUseBlock,
  WebSearchToolResultBlock,
  WebSearchResultBlock,
  WebSearchToolResultErrorCode,
  TextBlock as SdkTextBlock,
} from '@anthropic-ai/sdk/resources/messages';
import type {
  ChatBlock,
  ToolUseBlock,
  WebSearchResultPersisted,
} from '../models/ai-chat.model';
import { toGroundedCitations } from './web-citation-parser';

/**
 * Convert our persisted ChatBlock[] → Anthropic wire ContentBlockParam[].
 *
 * Drops:
 *   - status='discarded' tool_use blocks (user rejected the proposal; do not send).
 *
 * Transforms:
 *   - status='pending' tool_use blocks → TextBlockParam placeholder so the
 *     API never sees an unfinished tool_use loop.
 *
 * Strips:
 *   - status, editedFromText (persistence-only fields).
 */
export function toAnthropicContent(blocks: ChatBlock[]): ContentBlockParam[] {
  // Defensive guard (gap-closure plan 03-07, SC3-UNPAIRED-TOOLUSE): an
  // approved/edited tool_use may only be emitted as a REAL wire tool_use
  // when a paired tool_result block for its id exists. Otherwise it would
  // produce the Anthropic 400 "tool_use ids were found without tool_result
  // blocks" and brick the conversation. Fall back to placeholder text.
  const pairedToolResultIds = new Set<string>(
    blocks
      .filter((b): b is Extract<ChatBlock, { type: 'tool_result' }> => b.type === 'tool_result')
      .map((b) => b.tool_use_id),
  );

  const out: ContentBlockParam[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'text':
        out.push({ type: 'text', text: b.text });
        break;
      case 'tool_use':
        if (b.status === 'discarded') {
          continue;
        }
        if (b.status === 'pending') {
          // Plain-text placeholder — model should not treat as a real tool_use.
          out.push({
            type: 'text',
            text: `[user has not yet responded to AI proposal: ${summarizeProposal(b)}]`,
          });
          continue;
        }
        // 'approved' | 'edited': emit a real wire tool_use ONLY if paired.
        if (!pairedToolResultIds.has(b.id)) {
          // No paired tool_result — emitting an unpaired tool_use would
          // brick the conversation (Anthropic 400). Degrade to placeholder.
          out.push({
            type: 'text',
            text: `[user has not yet responded to AI proposal: ${summarizeProposal(b)}]`,
          });
          continue;
        }
        out.push({
          type: 'tool_use',
          id: b.id,
          name: b.name,
          input: b.input,
        });
        break;
      case 'tool_result':
        out.push({
          type: 'tool_result',
          tool_use_id: b.tool_use_id,
          content: b.content,
          ...(b.isError !== undefined ? { is_error: b.isError } : {}),
        });
        break;
      case 'server_tool_use':
        // Phase 5 (Pitfall 1): replay the Anthropic-executed web_search server
        // tool verbatim. `name` is the wire-literal 'web_search'; cast at this
        // sanctioned boundary because the persisted shape widens it to string.
        out.push({
          type: 'server_tool_use',
          id: b.id,
          name: b.name as 'web_search',
          input: b.input,
        });
        break;
      case 'web_search_tool_result':
        // Phase 5 (Pitfall 1 / F13): replay the result block byte-stable so
        // `encrypted_content` survives for multi-turn citation resolution.
        // The error union and result array map back 1:1.
        out.push({
          type: 'web_search_tool_result',
          tool_use_id: b.toolUseId,
          content: Array.isArray(b.content)
            ? b.content.map((r) => ({
                type: 'web_search_result' as const,
                url: r.url,
                title: r.title,
                encrypted_content: r.encryptedContent, // byte-stable, never decoded
                ...(r.pageAge !== undefined ? { page_age: r.pageAge } : {}),
              }))
            : {
                type: 'web_search_tool_result_error' as const,
                // Persisted shape widens the code to string; narrow at this
                // sanctioned boundary back to the wire error-code union.
                error_code: b.content.errorCode as WebSearchToolResultErrorCode,
              },
        });
        break;
    }
  }
  return out;
}

/**
 * Convert an inbound Anthropic Message into our ChatBlock[].
 *
 * Phase 3: only TextBlock arrives (no tool_use because we send no tools[]).
 * Phase 4: tool_use blocks arrive with default status='pending'.
 *
 * Forward-compat: unknown block types lift to a text placeholder so we
 * never silently lose content.
 */
export function fromAnthropicMessage(msg: Message): ChatBlock[] {
  return msg.content.map((b): ChatBlock => {
    switch (b.type) {
      case 'text': {
        // Phase 5 (D-03/D-09): narrow + https-gate any grounded web-search
        // citations into the local SDK-free GroundedCitation shape at this
        // transport chokepoint. Un-grounded text has no citations ⇒ field omitted.
        const grounded = toGroundedCitations(
          (b as SdkTextBlock).citations ?? undefined,
        );
        return grounded.length > 0
          ? { type: 'text', text: b.text, citations: grounded }
          : { type: 'text', text: b.text };
      }
      case 'tool_use':
        // Phase 4: default new tool_use to pending; Phase 3 should never hit this.
        return {
          type: 'tool_use',
          id: b.id,
          name: b.name,
          input: b.input,
          status: 'pending',
        };
      case 'server_tool_use': {
        // Phase 5 (Pitfall 1, D-02): persist the Anthropic-executed server tool
        // verbatim. NEVER routed through ToolRegistryService.dispatch — render-only.
        const st = b as ServerToolUseBlock;
        return {
          type: 'server_tool_use',
          id: st.id,
          name: st.name,
          input: st.input,
        };
      }
      case 'web_search_tool_result': {
        // Phase 5 (Pitfall 1, F13): persist the result block verbatim so
        // `encrypted_content` survives reload for multi-turn citation
        // resolution. The error union is preserved 1:1 (D-05/E4).
        const wr = b as WebSearchToolResultBlock;
        const content = Array.isArray(wr.content)
          ? wr.content.map(
              (r: WebSearchResultBlock): WebSearchResultPersisted => ({
                type: 'web_search_result',
                url: r.url,
                title: r.title,
                encryptedContent: r.encrypted_content, // verbatim, never decoded
                ...(r.page_age != null ? { pageAge: r.page_age } : {}),
              }),
            )
          : {
              type: 'web_search_tool_result_error' as const,
              errorCode: wr.content.error_code,
            };
        return {
          type: 'web_search_tool_result',
          toolUseId: wr.tool_use_id,
          content,
        };
      }
      default:
        // Conservative forward-compat: surface unknown block as text so we
        // never silently lose content.
        return {
          type: 'text',
          text: `[unsupported block type: ${(b as { type: string }).type}]`,
        };
    }
  });
}

/**
 * Bounded-length plain-text summary of a pending tool_use's input — used to
 * build the placeholder text when status='pending'. Truncates at 200 chars
 * with an ellipsis suffix to keep the prompt context lean.
 */
function summarizeProposal(b: ToolUseBlock): string {
  const json = JSON.stringify(b.input);
  return json.length > 200 ? json.slice(0, 200) + '…' : json;
}
