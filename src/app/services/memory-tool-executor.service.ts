import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}

/**
 * Executes the Anthropic memory_20250818 tool against the singleton
 * MemoryStoreService (CHAT-03 / T-3-PT).
 *
 * Implements all 6 commands: view, create, str_replace, insert, delete,
 * rename. Every command runs `validatePath` FIRST (T-3-PT mitigation —
 * combines string-level pre-check with parsed-segment check).
 *
 * Return strings are byte-exact for the canonical Anthropic
 * `memory_20250818` spec — the model's behaviour is conditioned on the
 * verbatim text; drift will break model-side reasoning.
 *
 * SDK chokepoint preserved: this file does NOT import from
 * `@anthropic-ai/sdk`. The `ToolDefinition` shape is a local subset
 * (defined in tool-registry.service.ts); Phase 4 maps it to the SDK
 * `Tool` type at the request boundary in `anthropic-api.service.ts`.
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

  async execute(input: unknown): Promise<string> {
    if (!isObject(input) || typeof input['command'] !== 'string') {
      return 'Error: invalid memory command — missing command';
    }

    const command = input['command'];
    try {
      switch (command) {
        case 'view':
          return await this.viewCommand(input);
        case 'create':
          return await this.createCommand(input);
        case 'str_replace':
          return await this.strReplaceCommand(input);
        case 'insert':
          return await this.insertCommand(input);
        case 'delete':
          return await this.deleteCommand(input);
        case 'rename':
          return await this.renameCommand(input);
        default:
          return `Error: unknown command "${command}"`;
      }
    } catch (err) {
      if (err instanceof MemoryPathError) return `Error: ${err.message}`;
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /**
   * Validates a memory tool path argument (T-3-PT mitigation).
   *
   * Layered checks:
   *   1. Type check — must be a non-empty string.
   *   2. String pre-check — reject `..`, URL-encoded `%2e%2e` (case-insensitive),
   *      NUL byte, embedded newline/CR.
   *   3. Prefix check — must start with `/memories`.
   *   4. Parsed-segment check — first non-empty path segment must be exactly
   *      `memories` (catches `/memoriesbad/foo` which lexically starts with
   *      `/memories` but is a different directory name).
   */
  private validatePath(path: unknown): string {
    if (typeof path !== 'string' || path.length === 0) {
      throw new MemoryPathError('Path must be a non-empty string');
    }
    if (path.includes('..')) {
      throw new MemoryPathError(`Path traversal rejected: ${path}`, path);
    }
    if (/%2e%2e/i.test(path)) {
      throw new MemoryPathError(
        `URL-encoded traversal rejected: ${path}`,
        path
      );
    }
    if (path.includes('\0')) {
      throw new MemoryPathError(`NUL byte rejected: ${path}`, path);
    }
    if (path.includes('\n') || path.includes('\r')) {
      throw new MemoryPathError(`Embedded newline rejected: ${path}`, path);
    }
    if (!path.startsWith('/memories')) {
      throw new MemoryPathError(
        `Path must start with /memories: ${path}`,
        path
      );
    }
    const segments = path.split('/').filter(Boolean);
    if (segments[0] !== 'memories') {
      throw new MemoryPathError(`Path must be under /memories: ${path}`, path);
    }
    return path;
  }

  private async viewCommand(input: Record<string, unknown>): Promise<string> {
    const path = this.validatePath(input['path']);
    // Directory view: exact `/memories` or trailing slash. Otherwise treat as file.
    const isDirectory =
      path === '/memories' || (path.endsWith('/') && path !== '/memories/');
    if (isDirectory) {
      const files = await firstValueFrom(this.store.listFiles());
      const prefix = path === '/memories' ? '/memories/' : path;
      const matching = files.filter((f) => f.path.startsWith(prefix));
      if (matching.length === 0 && path !== '/memories') {
        return `The path ${path} does not exist. Please provide a valid path.`;
      }
      const lines = matching
        .map((f) => `${formatSize(f.size)}\t${f.path}`)
        .join('\n');
      return `Here're the files and directories up to 2 levels deep in ${path}, excluding hidden items and node_modules:\n${lines}`;
    }

    const content = await firstValueFrom(this.store.readFile(path));
    if (content === null) {
      return `The path ${path} does not exist. Please provide a valid path.`;
    }
    const lines = content.split('\n');
    const view_range = input['view_range'];
    const range: [number, number] =
      Array.isArray(view_range) &&
      view_range.length === 2 &&
      typeof view_range[0] === 'number' &&
      typeof view_range[1] === 'number'
        ? [view_range[0], view_range[1]]
        : [1, lines.length];
    const slice = lines.slice(range[0] - 1, range[1]);
    const numbered = slice
      .map((line, i) => `${String(range[0] + i).padStart(6, ' ')}\t${line}`)
      .join('\n');
    return `Here's the content of ${path} with line numbers:\n${numbered}`;
  }

  private async createCommand(
    input: Record<string, unknown>
  ): Promise<string> {
    const path = this.validatePath(input['path']);
    const fileTextRaw = input['file_text'];
    const fileText = typeof fileTextRaw === 'string' ? fileTextRaw : '';
    const existing = await firstValueFrom(this.store.readFile(path));
    if (existing !== null) {
      return `Error: File ${path} already exists`;
    }
    await firstValueFrom(this.store.writeFile(path, fileText));
    return `File created successfully at: ${path}`;
  }

  private async strReplaceCommand(
    input: Record<string, unknown>
  ): Promise<string> {
    const path = this.validatePath(input['path']);
    const oldStr = String(input['old_str'] ?? '');
    const newStr = String(input['new_str'] ?? '');
    const existing = await firstValueFrom(this.store.readFile(path));
    if (existing === null) {
      return `Error: The path ${path} does not exist. Please provide a valid path.`;
    }
    const occurrences = oldStr === '' ? 0 : existing.split(oldStr).length - 1;
    if (occurrences === 0) {
      return `No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${path}.`;
    }
    if (occurrences > 1) {
      const lineNumbers: number[] = [];
      existing.split('\n').forEach((line, i) => {
        if (line.includes(oldStr)) lineNumbers.push(i + 1);
      });
      return `No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines: [${lineNumbers.join(', ')}]. Please ensure it is unique`;
    }
    const updated = existing.replace(oldStr, newStr);
    await firstValueFrom(this.store.writeFile(path, updated));
    return `The memory file has been edited.\n${this.snippetAroundEdit(updated, newStr)}`;
  }

  private async insertCommand(
    input: Record<string, unknown>
  ): Promise<string> {
    const path = this.validatePath(input['path']);
    const insertLineRaw = input['insert_line'];
    const insertLine =
      typeof insertLineRaw === 'number' ? insertLineRaw : -1;
    const insertText = String(input['insert_text'] ?? '');
    const existing = await firstValueFrom(this.store.readFile(path));
    if (existing === null) {
      return `Error: The path ${path} does not exist`;
    }
    const lines = existing.split('\n');
    if (insertLine < 0 || insertLine > lines.length) {
      return `Error: Invalid \`insert_line\` parameter: ${insertLine}. It should be within the range of lines of the file: [0, ${lines.length}]`;
    }
    lines.splice(insertLine, 0, insertText);
    await firstValueFrom(this.store.writeFile(path, lines.join('\n')));
    return `The file ${path} has been edited.`;
  }

  private async deleteCommand(
    input: Record<string, unknown>
  ): Promise<string> {
    const path = this.validatePath(input['path']);
    const ok = await firstValueFrom(this.store.deleteFile(path));
    if (!ok) {
      return `Error: The path ${path} does not exist`;
    }
    return `Successfully deleted ${path}`;
  }

  private async renameCommand(
    input: Record<string, unknown>
  ): Promise<string> {
    const oldPath = this.validatePath(input['old_path']);
    const newPath = this.validatePath(input['new_path']);
    const oldContent = await firstValueFrom(this.store.readFile(oldPath));
    if (oldContent === null) {
      return `Error: The path ${oldPath} does not exist`;
    }
    const newExisting = await firstValueFrom(this.store.readFile(newPath));
    if (newExisting !== null) {
      return `Error: The destination ${newPath} already exists`;
    }
    await firstValueFrom(this.store.renameFile(oldPath, newPath));
    return `Successfully renamed ${oldPath} to ${newPath}`;
  }

  /** Best-effort ±3-line snippet around the first occurrence of newStr. */
  private snippetAroundEdit(content: string, newStr: string): string {
    const lines = content.split('\n');
    const idx = lines.findIndex((line) => line.includes(newStr));
    if (idx === -1) return '';
    const start = Math.max(0, idx - 3);
    const end = Math.min(lines.length, idx + 4);
    return lines
      .slice(start, end)
      .map(
        (line, i) =>
          `${String(start + i + 1).padStart(6, ' ')}\t${line}`
      )
      .join('\n');
  }
}
