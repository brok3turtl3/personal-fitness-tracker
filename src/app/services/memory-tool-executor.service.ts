import { Injectable } from '@angular/core';
import { MemoryStoreService } from './memory-store.service';
import type { ToolDefinition, ToolExecutor } from './tool-registry.service';

/**
 * Custom error class for path-validation failures (T-3-PT mitigation).
 */
export class MemoryPathError extends Error {
  constructor(message: string, public readonly path?: string) {
    super(message);
    this.name = 'MemoryPathError';
  }
}

/**
 * Executes the Anthropic memory_20250818 tool against the singleton
 * MemoryStoreService (CHAT-03 / T-3-PT).
 *
 * RED-phase stub. GREEN phase below.
 */
@Injectable({
  providedIn: 'root',
})
export class MemoryToolExecutor implements ToolExecutor {
  readonly definition: ToolDefinition = {
    type: 'memory_20250818',
    name: 'memory',
  };

  constructor(private store: MemoryStoreService) {}

  async execute(_input: unknown): Promise<string> {
    void this.store;
    return Promise.resolve('Error: not implemented');
  }
}
