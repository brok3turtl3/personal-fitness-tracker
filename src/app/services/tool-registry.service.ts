import { Injectable } from '@angular/core';
import { MemoryToolExecutor } from './memory-tool-executor.service';
import { DataQueryToolExecutor } from './data-query-tool-executor';

/**
 * Local subset of @anthropic-ai/sdk's Tool union.
 *
 * Kept SDK-agnostic so the registry layer doesn't pull SDK types in.
 * Phase 4 will map `definitions()` → SDK `Tool[]` inside
 * `anthropic-api.service.ts` (the chokepoint boundary).
 */
export interface ToolDefinition {
  /** e.g. 'memory_20250818' (server-typed) or 'custom' (Phase 4 client tools). */
  type: string;
  name: string;
  description?: string;
  input_schema?: unknown;
  /**
   * When true, Claude's tool `input` is guaranteed to match `input_schema`
   * (Anthropic strict tool use). Set on the Phase 4 client `query_*` tools so
   * malformed args never reach the executor. SDK-agnostic flag — mapped to the
   * SDK `Tool.strict` at the `anthropic-api.service.ts` chokepoint.
   */
  strict?: boolean;
}

/**
 * Common shape every tool implementation conforms to.
 *
 * @typeParam TInput  - The shape the executor accepts (typically `unknown` until
 *                      validated; Phase 4 will narrow with per-tool zod schemas).
 * @typeParam TOutput - The shape the executor returns (typically `string` —
 *                      tool_result content is text per Anthropic's spec).
 */
export interface ToolExecutor<TInput = unknown, TOutput = string> {
  readonly definition: ToolDefinition;
  execute(input: TInput): Promise<TOutput> | TOutput;
}

/**
 * Single dispatch point for all Phase-3+ tools (CHAT-12 / SC5 / T-3-RG).
 *
 * Phase 3: registers MemoryToolExecutor; tools[] are NEVER passed to
 * `messages.create`. Surface exists for unit tests only — `chat.service.ts`
 * MUST NOT import this class in Phase 3 (grep gate enforces SC5).
 *
 * Phase 4: chat.service.ts will gain a `while (stop_reason === 'tool_use')`
 * loop that calls `dispatch(name, input)` and feeds the string back as a
 * `tool_result` block.
 */
@Injectable({
  providedIn: 'root',
})
export class ToolRegistryService {
  private readonly executors = new Map<string, ToolExecutor>();

  /**
   * Allow-list of tool names that are *write proposals* (D-02 / D-03).
   *
   * A write-proposal tool is NOT auto-executed by the agentic loop; it surfaces
   * a pending pill the user must approve. Currently only the `memory` write
   * tool. The six read-only `query_*` tools — and any future read tool — are
   * absent, so they default to non-write and auto-execute. Keeping this an
   * explicit allow-list (rather than a `query_*` deny-list) means a new read
   * tool can never accidentally bypass the pending-pill gate.
   */
  private static readonly WRITE_PROPOSAL_TOOLS: ReadonlySet<string> = new Set([
    'memory',
  ]);

  constructor(
    memoryExecutor: MemoryToolExecutor,
    dataQueryExecutor: DataQueryToolExecutor
  ) {
    this.register(memoryExecutor);
    // Register the six read-only query_* adapters alongside memory.
    for (const executor of dataQueryExecutor.executors) {
      this.register(executor);
    }
  }

  /**
   * True iff the named tool is a write proposal (memory/profile write) that the
   * agentic loop must defer to user approval rather than auto-execute (D-03).
   * Read-only tools (the six `query_*`) return false ⇒ auto-execute (D-02).
   */
  isWriteProposal(name: string): boolean {
    return ToolRegistryService.WRITE_PROPOSAL_TOOLS.has(name);
  }

  /**
   * Register or overwrite an executor under its declared `definition.name`.
   * Last write wins (idempotent for the same instance; Phase 4 may swap
   * implementations during tests).
   */
  register(executor: ToolExecutor): void {
    this.executors.set(executor.definition.name, executor);
  }

  /** Returns true iff an executor is registered under the given name. */
  has(name: string): boolean {
    return this.executors.has(name);
  }

  /**
   * Phase 4 dispatcher — NOT called from `chat.service.ts` in Phase 3 (SC5).
   *
   * Re-validates input is an object at the registry boundary (CHAT-11 /
   * T-3-VL — defense-in-depth before the executor's own type guards).
   * Phase 4 will extend this with per-tool zod schema validation.
   *
   * The executor's output is coerced via `String()` so callers receive a
   * plain string suitable for a `tool_result` block content.
   */
  async dispatch(name: string, input: unknown): Promise<string> {
    const executor = this.executors.get(name);
    if (!executor) {
      throw new Error(`Unknown tool: ${name}`);
    }
    if (typeof input !== 'object' || input === null) {
      throw new Error(`Tool input must be an object: got ${typeof input}`);
    }
    return String(await executor.execute(input));
  }

  /**
   * Phase 4 surface — definitions to pass into
   * `messages.create({ tools: [...] })`. Phase 3 returns the array but never
   * sends it (chat.service.ts has zero references — grep-gated).
   */
  definitions(): ToolDefinition[] {
    return Array.from(this.executors.values()).map((e) => e.definition);
  }
}
