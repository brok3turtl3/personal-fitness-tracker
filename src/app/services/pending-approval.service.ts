import { Injectable } from '@angular/core';
import { ToolRegistryService } from './tool-registry.service';
import type { ToolUseBlock } from '../models/ai-chat.model';

/**
 * Executes a user-APPROVED tool_use block (gap-closure plan 03-07,
 * SC3-NO-PERSIST). This is the discrete, user-triggered approval action —
 * NOT the Phase 4 agentic `while (stop_reason === 'tool_use')` loop.
 *
 * SC5 boundary: this service is the SOLE new owner of the
 * ToolRegistryService import. Routing execution through here keeps
 * chat-page.component.ts AND chat.service.ts grep-clean of
 * ToolRegistryService / MemoryToolExecutor (resolution (a)). Phase 4's
 * agentic loop reuses ToolRegistryService.dispatch directly.
 *
 * Persistence is NOT this service's concern — it only computes the
 * tool-result string. chat.service.approveToolUseBlock persists it.
 */
@Injectable({ providedIn: 'root' })
export class PendingApprovalService {
  constructor(private toolRegistry: ToolRegistryService) {}

  /**
   * Dispatch an approved tool_use through the tool registry (which
   * re-validates input shape and the executor re-validates path —
   * T-3-RG). Never throws: a failed/unknown tool still yields a paired
   * tool_result so the conversation does not brick (SC3-UNPAIRED-TOOLUSE).
   */
  async executeApprovedToolUse(
    block: ToolUseBlock,
  ): Promise<{ content: string; isError: boolean }> {
    if (!this.toolRegistry.has(block.name)) {
      return {
        content: `Error: unknown tool "${block.name}" — no executor registered (Phase 3)`,
        isError: true,
      };
    }
    try {
      const content = await this.toolRegistry.dispatch(block.name, block.input);
      return { content, isError: content.startsWith('Error:') };
    } catch (err) {
      return {
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  }
}
