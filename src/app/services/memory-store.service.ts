import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
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
 *
 * RED-phase stub. GREEN phase below.
 */
@Injectable({
  providedIn: 'root',
})
export class MemoryStoreService {
  constructor(private storageService: StorageService) {}

  listFiles(): Observable<MemoryFileEntry[]> {
    void this.storageService;
    return throwError(() => new Error('not implemented'));
  }

  readFile(_path: string): Observable<string | null> {
    return throwError(() => new Error('not implemented'));
  }

  writeFile(_path: string, _content: string): Observable<void> {
    return throwError(() => new Error('not implemented'));
  }

  deleteFile(_path: string): Observable<boolean> {
    return throwError(() => new Error('not implemented'));
  }

  renameFile(_oldPath: string, _newPath: string): Observable<boolean> {
    return throwError(() => new Error('not implemented'));
  }
}
