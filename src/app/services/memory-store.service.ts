import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import { StorageService } from './storage.service';

export interface MemoryFileEntry {
  path: string;
  size: number;
}

/**
 * Service for managing the memory-tool file map (CHAT-03 / Phase 3 V5).
 *
 * Thin Observable wrapper over `AppData.memoryFiles: Record<string, string>`.
 * CRUD goes through `StorageService` chokepoint (no direct localStorage).
 *
 * Path validation lives ONLY in MemoryToolExecutor — this layer is
 * intentionally validation-free (single-source-of-truth principle, see
 * threat-model entry T-3-MS).
 */
@Injectable({
  providedIn: 'root',
})
export class MemoryStoreService {
  constructor(private storageService: StorageService) {}

  /**
   * List all memory files as `{ path, size }` entries, sorted lexicographically
   * by path. Returns `[]` when AppData is null (uninitialized) or empty.
   */
  listFiles(): Observable<MemoryFileEntry[]> {
    return this.storageService.getData().pipe(
      map((data) => {
        if (!data) return [];
        return Object.entries(data.memoryFiles)
          .map(([path, content]) => ({ path, size: content.length }))
          .sort((a, b) => a.path.localeCompare(b.path));
      })
    );
  }

  /**
   * Read a memory file's content. Returns `null` if path is missing or
   * AppData is null.
   */
  readFile(path: string): Observable<string | null> {
    return this.storageService.getData().pipe(
      map((data) => {
        if (!data) return null;
        return path in data.memoryFiles ? data.memoryFiles[path] : null;
      })
    );
  }

  /**
   * Write content at the given path (creates or overwrites).
   * Errors with "Storage not initialized" if no AppData exists yet.
   */
  writeFile(path: string, content: string): Observable<void> {
    return this.storageService.getData().pipe(
      switchMap((data) => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }
        return this.storageService.saveData({
          ...data,
          memoryFiles: { ...data.memoryFiles, [path]: content },
        });
      })
    );
  }

  /**
   * Delete a memory file. Returns `true` if removed, `false` if path didn't
   * exist (no save side-effect in that case). Errors if AppData is null.
   */
  deleteFile(path: string): Observable<boolean> {
    return this.storageService.getData().pipe(
      switchMap((data) => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }
        if (!(path in data.memoryFiles)) return of(false);
        // Destructure-with-rename to drop one key without mutating in place.
        const { [path]: _removed, ...rest } = data.memoryFiles;
        void _removed;
        return this.storageService
          .saveData({ ...data, memoryFiles: rest })
          .pipe(map(() => true));
      })
    );
  }

  /**
   * Rename a memory file. Returns `true` on success, `false` if `oldPath`
   * is missing OR `newPath` already exists (no clobber). Atomic write+delete
   * via a single saveData call.
   */
  renameFile(oldPath: string, newPath: string): Observable<boolean> {
    return this.storageService.getData().pipe(
      switchMap((data) => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }
        if (!(oldPath in data.memoryFiles)) return of(false);
        if (newPath in data.memoryFiles) return of(false);
        const { [oldPath]: content, ...rest } = data.memoryFiles;
        return this.storageService
          .saveData({
            ...data,
            memoryFiles: { ...rest, [newPath]: content },
          })
          .pipe(map(() => true));
      })
    );
  }
}
