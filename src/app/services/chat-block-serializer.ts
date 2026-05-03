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
 *
 * Threat-model:
 *   - T-3-WL (Information Disclosure): persistence-only fields stripped
 *   - T-3-PT (Tampering): pending tool_use becomes plain-text placeholder
 *
 * Lint chokepoint: only this file and `anthropic-api.service.ts` may
 * import from `@anthropic-ai/sdk` or its sub-paths.
 */
import type {
  ContentBlockParam,
  Message,
} from '@anthropic-ai/sdk/resources/messages';
import type { ChatBlock, ToolUseBlock } from '../models/ai-chat.model';

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
        // 'approved' or 'edited': emit real tool_use; strip status + editedFromText.
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
      case 'text':
        return { type: 'text', text: b.text };
      case 'tool_use':
        // Phase 4: default new tool_use to pending; Phase 3 should never hit this.
        return {
          type: 'tool_use',
          id: b.id,
          name: b.name,
          input: b.input,
          status: 'pending',
        };
      default:
        // Conservative forward-compat: surface unknown block as text so we
        // never silently lose content. Server tool blocks deferred to Phase 5
        // per CONTEXT.md D-14.
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
