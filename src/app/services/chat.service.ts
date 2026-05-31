import { Injectable } from '@angular/core';
import { Observable, firstValueFrom, map, of, switchMap, throwError } from 'rxjs';
import { generateId } from '../shared/id';
import { StorageService } from './storage.service';
import { AnthropicApiService } from './anthropic-api.service';
import { AISettingsService } from './ai-settings.service';
import { FitnessContextService } from './fitness-context.service';
import { ToolRegistryService } from './tool-registry.service';
import { toAnthropicContent, fromAnthropicMessage } from './chat-block-serializer';
import {
  ChatBlock,
  ChatConversation,
  ChatMessage,
  ChatTurnEvent,
  CLAUDE_MODELS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_AI_TOOL_SETTINGS,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
} from '../models/ai-chat.model';
import { AppData } from '../models/app-data.model';

/**
 * Structural narrowing of the SDK `tool_use` response block (D-17). The loop
 * stays SDK-agnostic: it only needs the id/name/input fields here, never the
 * full SDK `ToolUseBlock` type. The transport boundary
 * (`anthropic-api.service.ts`) owns the real SDK types.
 */
interface WireToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

/**
 * Structural narrowing of the SDK `tool_result` request block (D-16). Pushed
 * back in a USER turn. SDK-agnostic — assignable to the SDK
 * `ToolResultBlockParam` at the transport chokepoint.
 */
interface WireToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/**
 * Structural narrowing of the inbound assistant `Message` the loop consumes
 * (D-17). Only `content` + `stop_reason` are load-bearing; the SDK owns the
 * full type. `stop_reason` is a plain `string` here, matching the SDK-agnostic
 * `ChatTurnEvent.done.stopReason` contract in ai-chat.model.ts.
 */
interface WireMessage {
  content: Array<{ type: string; [k: string]: unknown }>;
  stop_reason: string | null;
}

/**
 * Local structural alias for an SDK `ContentBlockParam` (D-17). We deliberately
 * do NOT import (even `import type`) from the Anthropic SDK here — this file is
 * not one of the two sanctioned SDK importers (`anthropic-api.service.ts` +
 * `chat-block-serializer.ts`). Even a type-only import creates a compile-time
 * coupling to the SDK type surface and would be caught by the chokepoint guard.
 * This shape is structurally assignable to the SDK param at the transport
 * boundary, where the cast happens.
 */
type ContentBlockParam = { type: string; [k: string]: unknown };

/**
 * Local structural alias for an SDK `MessageParam` (D-17). Same rationale as
 * `ContentBlockParam` above — SDK-agnostic, assignable at the transport
 * chokepoint in `anthropic-api.service.ts`.
 */
interface MessageParam {
  role: 'user' | 'assistant';
  content: string | ContentBlockParam[];
}

const MESSAGE_WINDOW_SIZE = 20;
const TOKEN_WINDOW_SIZE = 8000;
const SUMMARIZATION_PROMPT = 'Summarize this conversation preserving key facts, goals, decisions, and specific numbers. Keep under 200 words.';

/**
 * Cheap, deterministic per-message token tally for the persisted
 * `tokenEstimate` field used by the single-shot `sendMessage` path's sliding
 * window. NOT the `len/4` heuristic (retired in Phase 4 per D-15 / CHAT-10):
 * the AUTHORITATIVE window/summarize decision now runs through
 * `AnthropicApiService.countTokens` (the loop calls it before each send —
 * see `runAgenticLoop`). This local tally only seeds a coarse persisted
 * estimate; it never drives the loop's window decision.
 */
function approxMessageTokens(text: string): number {
  // ~0.75 tokens per whitespace-delimited word (a stable, non-len/4 figure).
  // WR-03: multiply (not divide) so the result matches the stated 0.75
  // tokens/word intent — dividing inflated the estimate to ~1.33 tokens/word
  // and caused premature sliding-window truncation.
  const words = text.trim().length ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words * 0.75));
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  constructor(
    private storageService: StorageService,
    private anthropicApi: AnthropicApiService,
    private aiSettingsService: AISettingsService,
    private fitnessContext: FitnessContextService,
    private toolRegistry: ToolRegistryService
  ) {}

  getConversations(): Observable<ChatConversation[]> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return [];
        return [...data.chatConversations].sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      })
    );
  }

  getConversation(id: string): Observable<ChatConversation | null> {
    return this.storageService.getData().pipe(
      map(data => {
        if (!data) return null;
        return data.chatConversations.find(c => c.id === id) ?? null;
      })
    );
  }

  createConversation(title?: string): Observable<ChatConversation> {
    const now = new Date();
    const defaultTitle = `Chat — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const conversation: ChatConversation = {
      id: generateId(),
      title: title ?? defaultTitle,
      messages: [],
      summarizedMessageCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));
        return this.storageService.saveData({
          ...data,
          chatConversations: [...data.chatConversations, conversation]
        }).pipe(map(() => conversation));
      })
    );
  }

  deleteConversation(id: string): Observable<boolean> {
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));
        const exists = data.chatConversations.some(c => c.id === id);
        if (!exists) return of(false);
        return this.storageService.saveData({
          ...data,
          chatConversations: data.chatConversations.filter(c => c.id !== id)
        }).pipe(map(() => true));
      })
    );
  }

  sendMessage(conversationId: string, userMessageText: string): Observable<ChatMessage> {
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      blocks: [{ type: 'text', text: userMessageText }],
      tokenEstimate: approxMessageTokens(userMessageText),
      createdAt: now
    };

    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));

        const convIndex = data.chatConversations.findIndex(c => c.id === conversationId);
        if (convIndex === -1) return throwError(() => new Error('Conversation not found'));

        const conversation = { ...data.chatConversations[convIndex] };
        conversation.messages = [...conversation.messages, userMessage];
        conversation.updatedAt = now;

        // Persist user message
        const updatedConversations = [...data.chatConversations];
        updatedConversations[convIndex] = conversation;
        const updatedData = { ...data, chatConversations: updatedConversations };

        return this.storageService.saveData(updatedData).pipe(
          switchMap(() => this.aiSettingsService.getSettings()),
          switchMap(settings => {
            const apiKey = settings.apiKey;
            if (!apiKey) return throwError(() => new Error('No API key configured. Please add your key in Settings.'));

            const model = settings.selectedModel ?? CLAUDE_MODELS[0].value;
            const maxTokens = settings.maxResponseTokens ?? DEFAULT_AI_SETTINGS.maxResponseTokens;

            return this.fitnessContext.buildSystemPrompt().pipe(
              switchMap(systemPrompt => {
                const apiMessages = this.buildApiMessages(conversation);

                // Cast at the transport boundary (D-17): the local SDK-agnostic
                // MessageParam[] / SystemTextBlock[] shapes are structurally
                // assignable to the SDK params; anthropic-api.service.ts owns
                // the real SDK types.
                return this.anthropicApi.sendMessage(apiKey, {
                  model,
                  max_tokens: maxTokens,
                  system: systemPrompt,
                  messages: apiMessages
                } as never);
              }),
              switchMap(response => {
                const assistantBlocks = fromAnthropicMessage(response);

                const assistantMessage: ChatMessage = {
                  id: generateId(),
                  role: 'assistant',
                  blocks: assistantBlocks,
                  // Accurate token count from the SDK (replaces estimateTokens
                  // heuristic for assistant messages — CONCERNS.md drift item).
                  tokenEstimate: response.usage.output_tokens,
                  createdAt: new Date().toISOString()
                };

                // Re-read data to avoid stale writes
                return this.storageService.getData().pipe(
                  switchMap(freshData => {
                    if (!freshData) return throwError(() => new Error('Storage not initialized'));

                    const freshConvIndex = freshData.chatConversations.findIndex(c => c.id === conversationId);
                    if (freshConvIndex === -1) return throwError(() => new Error('Conversation not found'));

                    const freshConv = { ...freshData.chatConversations[freshConvIndex] };
                    freshConv.messages = [...freshConv.messages, assistantMessage];
                    freshConv.updatedAt = assistantMessage.createdAt;

                    const freshConversations = [...freshData.chatConversations];
                    freshConversations[freshConvIndex] = freshConv;

                    return this.storageService.saveData({
                      ...freshData,
                      chatConversations: freshConversations
                    }).pipe(
                      switchMap(() => this.maybeSummarize(conversationId, freshConv, settings.apiKey!, model, maxTokens)),
                      map(() => assistantMessage)
                    );
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  /**
   * Phase 4 agentic loop (CHAT-05 / D-04 / D-16) — a bounded, multi-emit
   * `Observable<ChatTurnEvent>` running `while (stop_reason === 'tool_use')`,
   * capped by `maxAgentTurns`.
   *
   * Invariants (do NOT deviate — E2 critical-failure surface):
   *  - Every terminal `StopReason` is handled: `end_turn` / `stop_sequence` /
   *    `max_tokens` / `refusal` complete; `pause_turn` re-sends unmodified
   *    WITHOUT counting the turn (D-16 / Pitfall 2); `tool_use` is the ONLY
   *    branch that continues; `default` completes (should never fire).
   *  - Read-only `query_*` tools auto-execute via ToolRegistryService.dispatch
   *    (D-02); their result is fed back in a USER turn (49e275b regression).
   *  - A model-proposed WRITE (`isWriteProposal`, currently `memory`) is NEVER
   *    auto-executed: it surfaces a pending pill and is fed a synthetic
   *    "not yet persisted" tool_result so the loop NEVER blocks (D-03).
   *  - Hitting `maxAgentTurns` emits `turn_limit` and makes ONE final
   *    `sendMessage` WITHOUT tools for a best-effort answer (D-04).
   *  - Teardown sets `cancelled`; the `for` loop checks it each iteration
   *    (the takeUntilDestroyed cancellation seam — stops billing on navigate).
   *
   * SDK-agnostic (D-17): only the transport (`anthropic-api.service.ts`)
   * touches SDK types. The loop narrows responses to local `Wire*` shapes and
   * passes `ToolDefinition[]` through as `tools` (structurally assignable to
   * the SDK `Tool[]` at the chokepoint).
   *
   * @param conversationId Existing conversation; its persisted user message is
   *                       already on disk (the chat-page persists it before
   *                       starting the loop — mirrors `sendMessage`).
   * @param apiKey         User key from AISettingsService.
   */
  runAgenticLoop(conversationId: string, apiKey: string): Observable<ChatTurnEvent> {
    return new Observable<ChatTurnEvent>(subscriber => {
      let cancelled = false;

      (async () => {
        try {
          const settings = await firstValueFrom(this.aiSettingsService.getSettings());
          const toolSettings = await firstValueFrom(this.aiSettingsService.getToolSettings());

          const model = settings.selectedModel ?? CLAUDE_MODELS[0].value;
          const maxTokens = settings.maxResponseTokens ?? DEFAULT_AI_SETTINGS.maxResponseTokens;
          const maxAgentTurns = toolSettings.maxAgentTurns ?? DEFAULT_AI_TOOL_SETTINGS.maxAgentTurns;
          // WR-02: honour the user's tool-capability toggles. The settings
          // section is not cosmetic — disabling data-query / memory tools must
          // actually remove them from the tools[] handed to the API loop.
          const tools = this.toolRegistry.definitions().filter(t => {
            const name = (t as { name?: string }).name ?? '';
            if (name === 'memory' && !toolSettings.enableMemoryTool) return false;
            if (name.startsWith('query_') && !toolSettings.enableDataQueryTools) return false;
            return true;
          });
          const system = await firstValueFrom(this.fitnessContext.buildSystemPrompt());

          // CR-01: pause_turn must NEVER defeat the maxAgentTurns billing cap.
          // A perpetual pause_turn stream (transient API condition / future API
          // change) would otherwise keep `turn--`-ing forever. Track consecutive
          // pauses and treat an excess as a terminal condition so the loop is
          // GUARANTEED to terminate.
          let pauseCount = 0;
          const MAX_CONSECUTIVE_PAUSES = 3;

          // Build the working message list from persisted ChatBlock[] via the
          // Phase 3 serializer (REUSE — tool_result→user placement already solved).
          const conversation = await firstValueFrom(this.getConversation(conversationId));
          if (!conversation) {
            subscriber.error(new Error(`Conversation not found: ${conversationId}`));
            return;
          }
          const messages = this.buildApiMessages(conversation) as MessageParam[];

          // D-15 / CHAT-10: the window/summarize decision is driven by the
          // SDK's free `countTokens` endpoint (NOT the retired `len/4`
          // heuristic). Called ONCE here when constructing the request — never
          // per keystroke / in change detection (Pitfall 7). Best-effort: a
          // count failure must not wedge the loop, so it is swallowed and the
          // window falls back to the buildApiMessages sliding cap.
          await this.maybeSummarizeByTokenCount(conversationId, apiKey, model, system, messages, tools);

          for (let turn = 0; turn < maxAgentTurns && !cancelled; turn++) {
            let response: WireMessage;
            try {
              response = (await firstValueFrom(
                this.anthropicApi.sendMessage(apiKey, {
                  model,
                  max_tokens: maxTokens,
                  // `system` and `tools` are SDK-agnostic structural shapes
                  // assignable to the SDK params at the transport boundary.
                  system: system as unknown as MessageParam['content'],
                  messages,
                  tools: tools as unknown[],
                } as never),
              )) as unknown as WireMessage;
            } catch (err) {
              subscriber.error(err);
              return;
            }
            if (cancelled) return;

            // Emit + persist the assistant turn; push it onto the working list.
            const assistantBlocks = fromAnthropicMessage(response as never);
            subscriber.next({ kind: 'assistant_text', blocks: assistantBlocks });
            messages.push({
              role: 'assistant',
              content: response.content as unknown as ContentBlockParam[],
            });

            // --- D-16: terminal stop reasons. Only 'tool_use' continues. ---
            const stopReason = response.stop_reason ?? 'end_turn';
            switch (stopReason) {
              case 'end_turn':
              case 'stop_sequence':
              case 'max_tokens':
              case 'refusal':
                await this.persistAssistantBlocks(conversationId, assistantBlocks);
                subscriber.next({ kind: 'done', stopReason });
                subscriber.complete();
                return;
              case 'pause_turn':
                // CR-01: bound the number of consecutive pauses so a perpetual
                // pause_turn stream cannot evade the maxAgentTurns cap. Once the
                // ceiling is hit, persist what was gathered and terminate
                // (mirrors the terminal-stop path) rather than re-sending again.
                if (++pauseCount >= MAX_CONSECUTIVE_PAUSES) {
                  await this.persistAssistantBlocks(conversationId, assistantBlocks);
                  subscriber.next({ kind: 'done', stopReason: 'pause_turn' });
                  subscriber.complete();
                  return;
                }
                // Re-send the SAME messages unmodified (the paused assistant
                // turn is already pushed); do NOT count this against the cap.
                turn--;
                continue;
              case 'tool_use':
                // A real tool turn means progress — reset the pause streak so
                // only CONSECUTIVE pauses count toward the ceiling.
                pauseCount = 0;
                break;
              default:
                await this.persistAssistantBlocks(conversationId, assistantBlocks);
                subscriber.next({ kind: 'done', stopReason });
                subscriber.complete();
                return;
            }

            // --- Execute every tool_use block; collect tool_result blocks. ---
            const toolUseBlocks: WireToolUse[] = response.content
              .filter(b => b.type === 'tool_use')
              .map(b => ({
                type: 'tool_use',
                id: String(b['id']),
                name: String(b['name']),
                input: b['input'],
              }));
            const toolResults: WireToolResult[] = [];
            // Persisted blocks for THIS assistant turn: text + auto-executed
            // query tool_use (status:'approved') + their paired tool_result, so
            // the serializer replays a real wire tool_use (RESEARCH Open Q #1).
            const persistedBlocks: ChatBlock[] = assistantBlocks.filter(
              b => b.type === 'text',
            );

            for (const tu of toolUseBlocks) {
              subscriber.next({
                kind: 'tool_use_started',
                toolUseId: tu.id,
                toolName: tu.name,
                input: tu.input,
              });

              if (this.toolRegistry.isWriteProposal(tu.name)) {
                // D-03: NEVER block on approval. Surface a pending pill and feed
                // a synthetic "not yet persisted" tool_result so the model can
                // finish. Nothing is persisted until the user approves the pill.
                await this.surfacePendingProposal(conversationId, tu);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: tu.id,
                  content:
                    'Proposal surfaced to the user for approval and is NOT yet persisted. ' +
                    'Do not assume it was saved; continue your answer using only confirmed data.',
                });
                continue;
              }

              // D-02 / D-14: read-only query_* auto-execute through the registry.
              try {
                const result = await this.toolRegistry.dispatch(tu.name, tu.input);
                toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
                subscriber.next({ kind: 'tool_result', toolUseId: tu.id, summary: result });
                // Persist the auto-run tool_use as 'approved' + its paired result.
                persistedBlocks.push(
                  { type: 'tool_use', id: tu.id, name: tu.name, input: tu.input, status: 'approved' },
                  { type: 'tool_result', tool_use_id: tu.id, content: result },
                );
              } catch (e) {
                // CHAT-11: validation/range errors come back as a recoverable
                // tool_result the model can correct from — never a throw-through.
                const msg = e instanceof Error ? e.message : String(e);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: tu.id,
                  content: `Error: ${msg}`,
                  is_error: true,
                });
                persistedBlocks.push(
                  { type: 'tool_use', id: tu.id, name: tu.name, input: tu.input, status: 'approved' },
                  { type: 'tool_result', tool_use_id: tu.id, content: `Error: ${msg}`, isError: true },
                );
              }
            }

            // Persist this turn's assistant blocks (text + approved query
            // tool_use + paired tool_result). Write proposals are persisted
            // separately by surfacePendingProposal as their own pending message.
            if (persistedBlocks.length) {
              await this.persistAssistantBlocks(conversationId, persistedBlocks);
            }

            // tool_result blocks ALWAYS go in a USER turn (49e275b regression).
            messages.push({
              role: 'user',
              content: toolResults as unknown as ContentBlockParam[],
            });
          }

          // --- D-04: cap reached. Ask for a best-effort answer WITHOUT tools. ---
          if (cancelled) return;
          subscriber.next({ kind: 'turn_limit', turnsUsed: maxAgentTurns });

          let finalResponse: WireMessage;
          try {
            finalResponse = (await firstValueFrom(
              this.anthropicApi.sendMessage(apiKey, {
                model,
                max_tokens: maxTokens,
                system: system as unknown as MessageParam['content'],
                messages,
                // NO tools — best-effort summary of what was gathered (D-04).
              } as never),
            )) as unknown as WireMessage;
          } catch (err) {
            subscriber.error(err);
            return;
          }
          if (cancelled) return;

          const finalBlocks = fromAnthropicMessage(finalResponse as never);
          subscriber.next({ kind: 'assistant_text', blocks: finalBlocks });
          await this.persistAssistantBlocks(conversationId, finalBlocks);
          subscriber.next({ kind: 'done', stopReason: finalResponse.stop_reason ?? 'end_turn' });
          subscriber.complete();
        } catch (err) {
          if (!cancelled) subscriber.error(err);
        }
      })();

      // takeUntilDestroyed unsubscribes → the loop's for-condition stops.
      return () => {
        cancelled = true;
      };
    });
  }

  /**
   * D-15 / CHAT-10 — the window/summarize gate for the agentic loop, driven by
   * the SDK's free `countTokens` (model + system + messages + tools), NOT the
   * retired `len/4` heuristic. When the live count crosses `TOKEN_WINDOW_SIZE`
   * the older turns are compacted into the running summary (reusing the Phase 3
   * `maybeSummarize` machinery) so the in-flight `messages` shrinks.
   *
   * Best-effort: a `countTokens` failure (offline, rate-limited) is swallowed —
   * the loop still proceeds with the buildApiMessages sliding-window cap, never
   * wedges. Called ONCE per loop construction (Pitfall 7: never per keystroke).
   */
  private async maybeSummarizeByTokenCount(
    conversationId: string,
    apiKey: string,
    model: string,
    system: unknown,
    messages: MessageParam[],
    tools: unknown,
  ): Promise<void> {
    try {
      const count = await firstValueFrom(
        this.anthropicApi.countTokens(apiKey, {
          model,
          system: system as never,
          messages: messages as never,
          tools: tools as never,
        }),
      );
      if (count <= TOKEN_WINDOW_SIZE) return;

      // Over budget — compact older turns into the running summary so the next
      // buildApiMessages rebuild trims them out of the window.
      const conversation = await firstValueFrom(this.getConversation(conversationId));
      const settings = await firstValueFrom(this.aiSettingsService.getSettings());
      if (!conversation || !settings.apiKey) return;
      const maxTokens = settings.maxResponseTokens ?? DEFAULT_AI_SETTINGS.maxResponseTokens;
      await firstValueFrom(
        this.maybeSummarize(conversationId, conversation, settings.apiKey, model, maxTokens),
      );
      // Rebuild the working window from the (now summarized) conversation.
      const refreshed = await firstValueFrom(this.getConversation(conversationId));
      if (refreshed) {
        const rebuilt = this.buildApiMessages(refreshed) as MessageParam[];
        messages.length = 0;
        messages.push(...rebuilt);
      }
    } catch {
      // Swallow — countTokens is best-effort; the sliding-window cap still bounds the window.
    }
  }

  /**
   * Surface a model-proposed WRITE (memory/profile) as a `status:'pending'`
   * tool_use pill on the conversation so the chat-page renders it for approval
   * (D-03). It persists ONLY the pending proposal block — NOT any write. The
   * actual write happens later through the existing pill-approve flow
   * (`approveToolUseBlock`). Reuses `appendAssistantBlocks` (the same primitive
   * the dev-seed pending-pill flow uses).
   */
  private async surfacePendingProposal(
    conversationId: string,
    tu: WireToolUse,
  ): Promise<void> {
    const pending: ToolUseBlock = {
      type: 'tool_use',
      id: tu.id,
      name: tu.name,
      input: tu.input,
      status: 'pending',
    };
    await firstValueFrom(this.appendAssistantBlocks(conversationId, [pending]));
  }

  /**
   * Append a synthetic assistant message carrying the given persisted blocks
   * (loop turn persistence). Thin wrapper over `appendAssistantBlocks` for
   * readability at the loop call sites.
   */
  private async persistAssistantBlocks(
    conversationId: string,
    blocks: ChatBlock[],
  ): Promise<void> {
    if (!blocks.length) return;
    await firstValueFrom(this.appendAssistantBlocks(conversationId, blocks));
  }

  /**
   * Patch a single tool_use ChatBlock inside a conversation/message. Used
   * by chat-page block-action handlers to flip pending → approved /
   * discarded / edited (Plan 03-05 Task 2; D-11). Type-narrows to
   * tool_use; throws if any node along the path is missing or the block
   * at the given index is not a tool_use block.
   */
  updateMessageBlock(
    conversationId: string,
    messageId: string,
    blockIndex: number,
    patch: Partial<ToolUseBlock>,
  ): Observable<void> {
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));

        const convIdx = data.chatConversations.findIndex(c => c.id === conversationId);
        if (convIdx === -1) return throwError(() => new Error(`Conversation not found: ${conversationId}`));

        const conv = data.chatConversations[convIdx];
        const msgIdx = conv.messages.findIndex(m => m.id === messageId);
        if (msgIdx === -1) return throwError(() => new Error(`Message not found: ${messageId}`));

        const msg = conv.messages[msgIdx];
        if (blockIndex < 0 || blockIndex >= msg.blocks.length) {
          return throwError(() => new Error(`Block index out of range: ${blockIndex}`));
        }

        const block = msg.blocks[blockIndex];
        if (block.type !== 'tool_use') {
          return throwError(() => new Error(`Block at index ${blockIndex} is not tool_use (got: ${block.type})`));
        }

        const updatedBlock: ToolUseBlock = { ...block, ...patch };
        const updatedBlocks = [
          ...msg.blocks.slice(0, blockIndex),
          updatedBlock,
          ...msg.blocks.slice(blockIndex + 1),
        ];
        const updatedMsg: ChatMessage = { ...msg, blocks: updatedBlocks };
        const updatedConv: ChatConversation = {
          ...conv,
          messages: [
            ...conv.messages.slice(0, msgIdx),
            updatedMsg,
            ...conv.messages.slice(msgIdx + 1),
          ],
          updatedAt: new Date().toISOString(),
        };
        const updatedData: AppData = {
          ...data,
          chatConversations: [
            ...data.chatConversations.slice(0, convIdx),
            updatedConv,
            ...data.chatConversations.slice(convIdx + 1),
          ],
        };
        return this.storageService.saveData(updatedData);
      }),
    );
  }

  /**
   * Approve a tool_use block AND append its paired tool_result in ONE
   * atomic StorageService write (gap-closure plan 03-07, SC3). Flips the
   * block at [conversationId][messageId][blockIndex] to status='approved'
   * and appends a ToolResultBlock whose tool_use_id === that block's id to
   * the SAME message — so the transcript is never left with an approved
   * tool_use that has no paired tool_result (which would brick the
   * conversation via Anthropic 400).
   *
   * The result string is COMPUTED ELSEWHERE (PendingApprovalService → the
   * tool registry) and passed in. SC5: this method imports no tool
   * executor; chat.service.ts stays grep-clean.
   */
  approveToolUseBlock(
    conversationId: string,
    messageId: string,
    blockIndex: number,
    result: { content: string; isError: boolean },
  ): Observable<void> {
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));

        const convIdx = data.chatConversations.findIndex(c => c.id === conversationId);
        if (convIdx === -1) return throwError(() => new Error(`Conversation not found: ${conversationId}`));

        const conv = data.chatConversations[convIdx];
        const msgIdx = conv.messages.findIndex(m => m.id === messageId);
        if (msgIdx === -1) return throwError(() => new Error(`Message not found: ${messageId}`));

        const msg = conv.messages[msgIdx];
        if (blockIndex < 0 || blockIndex >= msg.blocks.length) {
          return throwError(() => new Error(`Block index out of range: ${blockIndex}`));
        }
        const block = msg.blocks[blockIndex];
        if (block.type !== 'tool_use') {
          return throwError(() => new Error(`Block at index ${blockIndex} is not tool_use (got: ${block.type})`));
        }

        const approvedBlock: ToolUseBlock = {
          ...block,
          status: 'approved',
          resolvedAt: new Date().toISOString(),
        };
        const resultBlock: ToolResultBlock = {
          type: 'tool_result',
          tool_use_id: block.id,
          content: result.content,
          ...(result.isError ? { isError: true } : {}),
        };
        const updatedBlocks: ChatBlock[] = [
          ...msg.blocks.slice(0, blockIndex),
          approvedBlock,
          ...msg.blocks.slice(blockIndex + 1),
          resultBlock,
        ];
        const updatedMsg: ChatMessage = { ...msg, blocks: updatedBlocks };
        const updatedConv: ChatConversation = {
          ...conv,
          messages: [
            ...conv.messages.slice(0, msgIdx),
            updatedMsg,
            ...conv.messages.slice(msgIdx + 1),
          ],
          updatedAt: new Date().toISOString(),
        };
        const updatedData: AppData = {
          ...data,
          chatConversations: [
            ...data.chatConversations.slice(0, convIdx),
            updatedConv,
            ...data.chatConversations.slice(convIdx + 1),
          ],
        };
        return this.storageService.saveData(updatedData);
      }),
    );
  }

  /**
   * Append a synthetic assistant message containing the supplied blocks
   * to an existing conversation. Used by the chat-page dev-seed reader
   * (Plan 03-05 Task 3; D-12). Returns the new ChatMessage so callers can
   * reference its id (e.g., to dispatch follow-up block-action events).
   */
  appendAssistantBlocks(
    conversationId: string,
    blocks: ChatBlock[],
  ): Observable<ChatMessage> {
    const newMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      blocks,
      tokenEstimate: 0,
      createdAt: new Date().toISOString(),
    };
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));

        const idx = data.chatConversations.findIndex(c => c.id === conversationId);
        if (idx === -1) return throwError(() => new Error(`Conversation not found: ${conversationId}`));

        const conv = data.chatConversations[idx];
        const updatedConv: ChatConversation = {
          ...conv,
          messages: [...conv.messages, newMessage],
          updatedAt: new Date().toISOString(),
        };
        const updatedData: AppData = {
          ...data,
          chatConversations: [
            ...data.chatConversations.slice(0, idx),
            updatedConv,
            ...data.chatConversations.slice(idx + 1),
          ],
        };
        return this.storageService.saveData(updatedData).pipe(map(() => newMessage));
      }),
    );
  }

  /**
   * Persist a single user text message to a conversation (Plan 04-06). The
   * agentic loop (`runAgenticLoop`) reads the persisted transcript from disk,
   * so the chat-page persists the user's turn through this method BEFORE
   * starting the loop (mirrors the user-message write at the head of
   * `sendMessage`, but without the single-shot API call). Returns the new
   * ChatMessage so the caller can surface it immediately.
   */
  appendUserMessage(
    conversationId: string,
    text: string,
  ): Observable<ChatMessage> {
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      blocks: [{ type: 'text', text }],
      tokenEstimate: approxMessageTokens(text),
      createdAt: now,
    };
    return this.storageService.getData().pipe(
      switchMap(data => {
        if (!data) return throwError(() => new Error('Storage not initialized'));

        const idx = data.chatConversations.findIndex(c => c.id === conversationId);
        if (idx === -1) return throwError(() => new Error(`Conversation not found: ${conversationId}`));

        const conv = data.chatConversations[idx];
        const updatedConv: ChatConversation = {
          ...conv,
          messages: [...conv.messages, userMessage],
          updatedAt: now,
        };
        const updatedData: AppData = {
          ...data,
          chatConversations: [
            ...data.chatConversations.slice(0, idx),
            updatedConv,
            ...data.chatConversations.slice(idx + 1),
          ],
        };
        return this.storageService.saveData(updatedData).pipe(map(() => userMessage));
      }),
    );
  }

  private buildApiMessages(conversation: ChatConversation): MessageParam[] {
    const messages: MessageParam[] = [];

    // If there's a summary, prepend it as context
    if (conversation.summary) {
      messages.push({
        role: 'user',
        content: [{ type: 'text', text: `[Previous conversation summary: ${conversation.summary}]` }]
      });
      messages.push({
        role: 'assistant',
        content: [{ type: 'text', text: 'I understand the context from our previous conversation. How can I help you?' }]
      });
    }

    // Apply sliding window: keep recent messages within token budget
    const allMessages = conversation.messages;
    let windowMessages: ChatMessage[] = [];
    let tokenCount = 0;

    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i];
      if (windowMessages.length >= MESSAGE_WINDOW_SIZE || tokenCount + msg.tokenEstimate > TOKEN_WINDOW_SIZE) {
        break;
      }
      windowMessages.unshift(msg);
      tokenCount += msg.tokenEstimate;
    }

    // Serialize each stored message to wire form. Plan 03-07 co-locates a
    // tool_result block INSIDE the same ASSISTANT ChatMessage that holds its
    // tool_use (so chat-block-serializer's same-message pairing guard works).
    // But Anthropic forbids tool_result blocks in assistant turns — they may
    // only appear in user turns. So we split each message's content: non-
    // tool_result blocks stay on the message's own role; tool_result blocks
    // move to a user turn. We do NOT change persistence; only the wire shape.
    for (const msg of windowMessages) {
      const content = toAnthropicContent(msg.blocks);
      const toolResults = content.filter(b => b.type === 'tool_result');
      const others = content.filter(b => b.type !== 'tool_result');

      if (others.length) {
        // `others` are SDK content blocks from the serializer; assignable to
        // the local SDK-agnostic ContentBlockParam[] at this boundary.
        messages.push({ role: msg.role, content: others as unknown as ContentBlockParam[] });
      }
      if (toolResults.length) {
        messages.push({ role: 'user', content: toolResults as unknown as ContentBlockParam[] });
      }
    }

    // Coalesce consecutive same-role messages into one. The split above can
    // produce assistant{tool_use} → user{tool_result} → user{new text}; merging
    // adjacent user turns yields a single user{tool_result, new text} (tool_result
    // first) and guarantees role alternation on the wire.
    const coalesced: MessageParam[] = [];
    for (const m of messages) {
      const last = coalesced[coalesced.length - 1];
      if (last && last.role === m.role) {
        const lastContent = last.content as ContentBlockParam[];
        const nextContent = m.content as ContentBlockParam[];
        last.content = [...lastContent, ...nextContent];
      } else {
        coalesced.push(m);
      }
    }

    return coalesced;
  }

  private maybeSummarize(
    conversationId: string,
    conversation: ChatConversation,
    apiKey: string,
    model: string,
    maxTokens: number
  ): Observable<void> {
    const totalMessages = conversation.messages.length;
    const unsummarized = totalMessages - conversation.summarizedMessageCount;

    // Only summarize if we have significantly more messages than the window
    if (unsummarized <= MESSAGE_WINDOW_SIZE + 5) {
      return of(undefined);
    }

    // Messages to summarize (everything outside the current window)
    const messagesToSummarize = conversation.messages.slice(
      conversation.summarizedMessageCount,
      totalMessages - MESSAGE_WINDOW_SIZE
    );

    if (messagesToSummarize.length === 0) {
      return of(undefined);
    }

    const conversationText = messagesToSummarize
      .map(m => `${m.role}: ${m.blocks.filter((b): b is TextBlock => b.type === 'text').map(b => b.text).join('')}`)
      .join('\n');

    const existingSummary = conversation.summary
      ? `Previous summary: ${conversation.summary}\n\nNew messages:\n`
      : '';

    return this.anthropicApi.sendMessage(apiKey, {
      model,
      max_tokens: Math.min(maxTokens, 1024),
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: `${SUMMARIZATION_PROMPT}\n\n${existingSummary}${conversationText}` }]
      }]
    }).pipe(
      switchMap(response => {
        const summaryText = fromAnthropicMessage(response)
          .filter((b): b is TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('');

        return this.storageService.getData().pipe(
          switchMap(data => {
            if (!data) return of(undefined);

            const convIndex = data.chatConversations.findIndex(c => c.id === conversationId);
            if (convIndex === -1) return of(undefined);

            const updatedConv = { ...data.chatConversations[convIndex] };
            updatedConv.summary = summaryText;
            updatedConv.summarizedMessageCount = totalMessages - MESSAGE_WINDOW_SIZE;

            const updatedConversations = [...data.chatConversations];
            updatedConversations[convIndex] = updatedConv;

            return this.storageService.saveData({
              ...data,
              chatConversations: updatedConversations
            });
          })
        );
      })
    );
  }
}
