import { toAnthropicContent, fromAnthropicMessage } from './chat-block-serializer';
import type { ChatBlock } from '../models/ai-chat.model';
import type {
  ContentBlockParam,
  Message,
} from '@anthropic-ai/sdk/resources/messages';
import { F2, F10, F11, F13_TURN1 } from './web-citation-parser.fixtures';

/**
 * Spec for chat-block-serializer.ts pure module (Plan 03-02 Task 2).
 *
 * The serializer is the SOLE seam where our persisted ChatBlock[] meets the
 * Anthropic wire ContentBlockParam[]. Tests cover:
 *   - Round-trip text blocks
 *   - 4-status tool_use matrix (approved, edited, discarded, pending)
 *   - status/editedFromText stripping (T-3-WL mitigation)
 *   - tool_result with/without isError
 *   - fromAnthropicMessage forward-compat (text-only, tool_use defaulting,
 *     unknown block type lift)
 */
describe('chat-block-serializer', () => {
  describe('toAnthropicContent', () => {
    it('text block round-trips as { type: text, text }', () => {
      const blocks: ChatBlock[] = [{ type: 'text', text: 'Hello world' }];
      const wire = toAnthropicContent(blocks);
      expect(wire.length).toBe(1);
      expect(wire[0].type).toBe('text');
      expect((wire[0] as { type: 'text'; text: string }).text).toBe('Hello world');
    });

    it('tool_use status=approved emits clean wire shape (no status, no editedFromText) when paired', () => {
      // 03-07 guard: an approved tool_use only emits a wire tool_use when a
      // paired tool_result for its id exists; include one so we test stripping.
      const blocks: ChatBlock[] = [
        {
          type: 'tool_use',
          id: 'tool_abc',
          name: 'memory',
          input: { command: 'create', path: '/memories/notes.md', file_text: 'hi' },
          status: 'approved',
        },
        { type: 'tool_result', tool_use_id: 'tool_abc', content: 'File created successfully' },
      ];
      const wire = toAnthropicContent(blocks);
      expect(wire.length).toBe(2);
      expect(wire[0].type).toBe('tool_use');
      const w = wire[0] as unknown as Record<string, unknown>;
      expect(w['id']).toBe('tool_abc');
      expect(w['name']).toBe('memory');
      expect('status' in w).toBeFalse();
      expect('editedFromText' in w).toBeFalse();
    });

    it('tool_use status=edited emits clean wire shape when paired', () => {
      const blocks: ChatBlock[] = [
        {
          type: 'tool_use',
          id: 'tool_def',
          name: 'memory',
          input: { command: 'create', path: '/memories/edited.md', file_text: 'edited content' },
          status: 'edited',
          editedFromText: 'original content',
        },
        { type: 'tool_result', tool_use_id: 'tool_def', content: 'File created successfully' },
      ];
      const wire = toAnthropicContent(blocks);
      expect(wire.length).toBe(2);
      expect(wire[0].type).toBe('tool_use');
      const w = wire[0] as unknown as Record<string, unknown>;
      expect('status' in w).toBeFalse();
      expect('editedFromText' in w).toBeFalse();
    });

    it('tool_use status=discarded is DROPPED', () => {
      const blocks: ChatBlock[] = [
        {
          type: 'tool_use',
          id: 'tool_drop',
          name: 'memory',
          input: { command: 'view', path: '/memories' },
          status: 'discarded',
        },
      ];
      const wire = toAnthropicContent(blocks);
      expect(wire.length).toBe(0);
    });

    it('tool_use status=pending becomes a text placeholder', () => {
      const blocks: ChatBlock[] = [
        {
          type: 'tool_use',
          id: 'tool_pending',
          name: 'memory',
          input: { command: 'create', path: '/memories/p.md', file_text: 'pending' },
          status: 'pending',
        },
      ];
      const wire = toAnthropicContent(blocks);
      expect(wire.length).toBe(1);
      expect(wire[0].type).toBe('text');
      const text = (wire[0] as { type: 'text'; text: string }).text;
      expect(text.startsWith('[user has not yet responded')).toBeTrue();
      expect(text).toContain('command');
    });

    it('pending placeholder truncates JSON > 200 chars', () => {
      const longString = 'x'.repeat(500);
      const blocks: ChatBlock[] = [
        {
          type: 'tool_use',
          id: 'tool_long',
          name: 'memory',
          input: { command: 'create', path: '/memories/long.md', file_text: longString },
          status: 'pending',
        },
      ];
      const wire = toAnthropicContent(blocks);
      const text = (wire[0] as { type: 'text'; text: string }).text;
      // Original JSON is ~540+ chars; placeholder text MUST contain exactly 200 chars
      // of the JSON followed by an ellipsis ('…').
      const json = JSON.stringify(blocks[0].type === 'tool_use' ? blocks[0].input : null);
      expect(json.length).toBeGreaterThan(200);
      expect(text).toContain(json.slice(0, 200));
      expect(text).toContain('…');
      // Verify NOT the full JSON.
      expect(text).not.toContain(json);
    });

    it('tool_result round-trips with isError → is_error rename', () => {
      const blocks: ChatBlock[] = [
        {
          type: 'tool_result',
          tool_use_id: 'tool_abc',
          content: 'Operation failed',
          isError: true,
        },
      ];
      const wire = toAnthropicContent(blocks);
      expect(wire.length).toBe(1);
      expect(wire[0].type).toBe('tool_result');
      const w = wire[0] as unknown as Record<string, unknown>;
      expect(w['tool_use_id']).toBe('tool_abc');
      expect(w['content']).toBe('Operation failed');
      expect(w['is_error']).toBe(true);
      expect('isError' in w).toBeFalse();
    });

    it('tool_result without isError omits is_error from wire', () => {
      const blocks: ChatBlock[] = [
        {
          type: 'tool_result',
          tool_use_id: 'tool_abc',
          content: 'success result',
        },
      ];
      const wire = toAnthropicContent(blocks);
      expect(wire.length).toBe(1);
      const w = wire[0] as unknown as Record<string, unknown>;
      expect('is_error' in w).toBeFalse();
      expect('isError' in w).toBeFalse();
    });

    it('mixed blocks preserve order (text + approved tool_use + tool_result)', () => {
      const blocks: ChatBlock[] = [
        { type: 'text', text: 'First' },
        {
          type: 'tool_use',
          id: 'tool_x',
          name: 'memory',
          input: { command: 'view', path: '/memories' },
          status: 'approved',
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool_x',
          content: '/memories: empty',
        },
      ];
      const wire = toAnthropicContent(blocks);
      expect(wire.length).toBe(3);
      expect(wire[0].type).toBe('text');
      expect(wire[1].type).toBe('tool_use');
      expect(wire[2].type).toBe('tool_result');
    });

    it('empty blocks produce empty wire array', () => {
      const wire = toAnthropicContent([]);
      expect(wire).toEqual([] as ContentBlockParam[]);
    });
  });

  describe('toAnthropicContent — approved/edited pairing guard (gap-closure 03-07, SC3-UNPAIRED-TOOLUSE)', () => {
    it('emits a wire tool_use when an approved tool_use has a paired tool_result block', () => {
      const blocks: ChatBlock[] = [
        {
          type: 'tool_use',
          id: 'tu1',
          name: 'memory',
          input: { command: 'create', path: '/memories/x.md' },
          status: 'approved',
        },
        { type: 'tool_result', tool_use_id: 'tu1', content: 'File created successfully' },
      ];
      const out = toAnthropicContent(blocks);
      const toolUses = out.filter((b) => b.type === 'tool_use');
      const toolResults = out.filter((b) => b.type === 'tool_result');
      const texts = out.filter((b) => b.type === 'text');
      expect(toolUses.length).toBe(1);
      expect((toolUses[0] as { id: string }).id).toBe('tu1');
      expect(toolResults.length).toBe(1);
      expect((toolResults[0] as { tool_use_id: string }).tool_use_id).toBe('tu1');
      expect(texts.length).toBe(0);
    });

    it('degrades an approved tool_use with NO paired tool_result to placeholder text (never an unpaired wire tool_use)', () => {
      const blocks: ChatBlock[] = [
        {
          type: 'tool_use',
          id: 'tu2',
          name: 'memory',
          input: { command: 'create', path: '/memories/x.md' },
          status: 'approved',
        },
      ];
      const out = toAnthropicContent(blocks);
      const toolUses = out.filter((b) => b.type === 'tool_use');
      const texts = out.filter((b) => b.type === 'text');
      expect(toolUses.length).toBe(0);
      expect(texts.length).toBe(1);
      expect((texts[0] as { text: string }).text).toContain('user has not yet responded');
    });

    it('degrades an edited tool_use with NO paired tool_result to placeholder text', () => {
      const blocks: ChatBlock[] = [
        {
          type: 'tool_use',
          id: 'tu3',
          name: 'memory',
          input: { command: 'create', path: '/memories/y.md' },
          status: 'edited',
          editedFromText: 'original',
        },
      ];
      const out = toAnthropicContent(blocks);
      const toolUses = out.filter((b) => b.type === 'tool_use');
      const texts = out.filter((b) => b.type === 'text');
      expect(toolUses.length).toBe(0);
      expect(texts.length).toBe(1);
      expect((texts[0] as { text: string }).text).toContain('user has not yet responded');
    });

    it('still drops discarded tool_use blocks entirely (D-16 regression)', () => {
      const blocks: ChatBlock[] = [
        {
          type: 'tool_use',
          id: 'tu4',
          name: 'memory',
          input: { command: 'view' },
          status: 'discarded',
        },
      ];
      const out = toAnthropicContent(blocks);
      expect(out.length).toBe(0);
    });

    it('still renders pending tool_use as placeholder text (D-16 regression)', () => {
      const blocks: ChatBlock[] = [
        {
          type: 'tool_use',
          id: 'tu5',
          name: 'memory',
          input: { command: 'create', path: '/memories/z.md' },
          status: 'pending',
        },
      ];
      const out = toAnthropicContent(blocks);
      const toolUses = out.filter((b) => b.type === 'tool_use');
      const texts = out.filter((b) => b.type === 'text');
      expect(toolUses.length).toBe(0);
      expect(texts.length).toBe(1);
      expect((texts[0] as { text: string }).text).toContain('user has not yet responded');
    });

    it('passes a standalone tool_result block through to the wire unchanged', () => {
      const blocks: ChatBlock[] = [
        { type: 'tool_result', tool_use_id: 'x', content: 'ok' },
      ];
      const out = toAnthropicContent(blocks);
      expect(out).toEqual([{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }]);
    });
  });

  describe('fromAnthropicMessage', () => {
    it('text-only response maps cleanly to TextBlock[]', () => {
      const msg = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'a', citations: null },
          { type: 'text', text: 'b', citations: null },
        ],
        model: 'claude-sonnet-4-6',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      } as unknown as Message;
      const blocks = fromAnthropicMessage(msg);
      expect(blocks.length).toBe(2);
      expect(blocks[0]).toEqual({ type: 'text', text: 'a' });
      expect(blocks[1]).toEqual({ type: 'text', text: 'b' });
    });

    it('tool_use defaults status to pending', () => {
      const msg = {
        id: 'msg_tool',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_xyz',
            name: 'memory',
            input: { command: 'view', path: '/memories' },
          },
        ],
        model: 'claude-sonnet-4-6',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 5, output_tokens: 10 },
      } as unknown as Message;
      const blocks = fromAnthropicMessage(msg);
      expect(blocks.length).toBe(1);
      expect(blocks[0].type).toBe('tool_use');
      const tu = blocks[0] as Extract<ChatBlock, { type: 'tool_use' }>;
      expect(tu.id).toBe('tool_xyz');
      expect(tu.name).toBe('memory');
      expect(tu.status).toBe('pending');
    });

    it('unknown block type lifts to a text placeholder rather than dropping content', () => {
      const msg = {
        id: 'msg_unknown',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'internal reasoning', signature: 'sig' },
        ],
        model: 'claude-sonnet-4-6',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      } as unknown as Message;
      const blocks = fromAnthropicMessage(msg);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toEqual({ type: 'text', text: '[unsupported block type: thinking]' });
    });
  });

  describe('Phase 5 — server-tool block passthrough + grounded citations (Pitfall 1, D-02/D-03)', () => {
    it('F2: a web_search_tool_result survives as a TYPED block, NOT an [unsupported block type] placeholder', () => {
      const blocks = fromAnthropicMessage(F2);
      // Pitfall 1 eliminated: no unsupported-placeholder for any server-tool block.
      const placeholders = blocks.filter(
        (b) => b.type === 'text' && b.text.startsWith('[unsupported block type'),
      );
      expect(placeholders.length).toBe(0);

      const result = blocks.find((b) => b.type === 'web_search_tool_result');
      expect(result).toBeTruthy();
      const r = result as Extract<ChatBlock, { type: 'web_search_tool_result' }>;
      expect(r.toolUseId).toBe('srvtoolu_F2');
      expect(Array.isArray(r.content)).toBeTrue();
      const arr = r.content as Array<{ type: string; url: string; encryptedContent: string }>;
      expect(arr[0].type).toBe('web_search_result');
      expect(arr[0].url).toBe('https://example.org/rt-guidelines');
      expect(arr[0].encryptedContent).toBe('enc_F2_result_0');
    });

    it('F2: server_tool_use survives as a typed block carrying id/name/input', () => {
      const blocks = fromAnthropicMessage(F2);
      const stu = blocks.find((b) => b.type === 'server_tool_use');
      expect(stu).toBeTruthy();
      const s = stu as Extract<ChatBlock, { type: 'server_tool_use' }>;
      expect(s.id).toBe('srvtoolu_F2');
      expect(s.name).toBe('web_search');
      expect(s.input).toEqual({ query: 'resistance training frequency guidelines' });
    });

    it('F2: a grounded text block carries narrowed GroundedCitation[] (https-gated)', () => {
      const blocks = fromAnthropicMessage(F2);
      const grounded = blocks.find(
        (b): b is Extract<ChatBlock, { type: 'text' }> =>
          b.type === 'text' && !!b.citations && b.citations.length > 0,
      );
      expect(grounded).toBeTruthy();
      expect(grounded!.citations!.length).toBe(1);
      expect(grounded!.citations![0].url).toBe('https://example.org/rt-guidelines');
      expect(grounded!.citations![0].title).toBe('Resistance Training Frequency — 2024 Guidelines');
    });

    it('F10: server_tool_use + web_search_tool_result both survive (no placeholder)', () => {
      const blocks = fromAnthropicMessage(F10);
      expect(blocks.some((b) => b.type === 'server_tool_use')).toBeTrue();
      expect(blocks.some((b) => b.type === 'web_search_tool_result')).toBeTrue();
      expect(
        blocks.some((b) => b.type === 'text' && b.text.startsWith('[unsupported block type')),
      ).toBeFalse();
    });

    it('F11: a web_search_tool_result_error union is preserved (D-05/E4)', () => {
      const blocks = fromAnthropicMessage(F11);
      const result = blocks.find((b) => b.type === 'web_search_tool_result');
      const r = result as Extract<ChatBlock, { type: 'web_search_tool_result' }>;
      expect(Array.isArray(r.content)).toBeFalse();
      const err = r.content as { type: string; errorCode: string };
      expect(err.type).toBe('web_search_tool_result_error');
      expect(err.errorCode).toBe('max_uses_exceeded');
    });

    it('F13 round-trip: encrypted_content + encrypted_index are byte-stable after from→to (E3)', () => {
      // from→persist→to round-trip must keep the result block's encrypted_content
      // byte-identical; encrypted_index lives only inside the SDK citation, which
      // the narrowed GroundedCitation deliberately drops — the result block is the
      // multi-turn resolution carrier (Pitfall 1).
      const persisted = fromAnthropicMessage(F13_TURN1);
      const wire = toAnthropicContent(persisted);

      const wireResult = wire.find((b) => b.type === 'web_search_tool_result');
      expect(wireResult).toBeTruthy();
      const wr = wireResult as unknown as {
        tool_use_id: string;
        content: Array<{ encrypted_content: string; url: string; title: string }>;
      };
      expect(wr.tool_use_id).toBe('srvtoolu_F13');
      expect(wr.content[0].encrypted_content).toBe('ENC_CONTENT_F13_BYTE_STABLE');
      // Deep-equal the original wire result content (byte-stable).
      const originalResultBlock = F13_TURN1.content.find(
        (b) => b.type === 'web_search_tool_result',
      ) as unknown as { content: Array<{ encrypted_content: string; url: string; title: string }> };
      expect(wr.content[0].encrypted_content).toBe(
        originalResultBlock.content[0].encrypted_content,
      );
      expect(wr.content[0].url).toBe(originalResultBlock.content[0].url);

      // server_tool_use replays verbatim.
      const wireStu = wire.find((b) => b.type === 'server_tool_use');
      expect(wireStu).toBeTruthy();
      expect((wireStu as { id: string }).id).toBe('srvtoolu_F13');
    });

    it('round-trips a persisted error-union result block back to the wire error shape', () => {
      const persisted = fromAnthropicMessage(F11);
      const wire = toAnthropicContent(persisted);
      const wireResult = wire.find((b) => b.type === 'web_search_tool_result');
      const wr = wireResult as unknown as {
        content: { type: string; error_code: string };
      };
      expect(wr.content.type).toBe('web_search_tool_result_error');
      expect(wr.content.error_code).toBe('max_uses_exceeded');
    });
  });
});
