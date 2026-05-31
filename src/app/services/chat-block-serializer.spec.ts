import { toAnthropicContent, fromAnthropicMessage } from './chat-block-serializer';
import type { ChatBlock } from '../models/ai-chat.model';
import type {
  ContentBlockParam,
  Message,
} from '@anthropic-ai/sdk/resources/messages';

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
});
