import { Injectable } from '@angular/core';

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
 * `messages.create`. Surface exists for unit tests only.
 *
 * Phase 4: chat.service.ts will gain a `while (stop_reason === 'tool_use')`
 * loop that calls `dispatch(name, input)`.
 *
 * Task 4 fills out the implementation. This file ships the interfaces in
 * Task 3 to break the circular import (MemoryToolExecutor implements
 * `ToolExecutor`, which lives here).
 */
@Injectable({
  providedIn: 'root',
})
export class ToolRegistryService {
  // Filled in by Task 4 — Task 3 ships only the type surface.
}
