import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MemoryFileEntry, MemoryStoreService } from '../../services/memory-store.service';
import { StorageService } from '../../services/storage.service';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';

/**
 * `/settings/memory` — AI memory inspector (Plan 03-04 Task 4).
 *
 * Lists all memory files (paths under `/memories/`) as a flat path-tree —
 * shallow nesting is the dominant case so a flat list with full-path labels
 * keeps the UI simple (Deferred Ideas: nested-folder tree component is
 * premature abstraction). Click a leaf to toggle inline preview; Edit swaps
 * the preview for a textarea + Save changes / Discard edits; Delete uses
 * `window.confirm` (matches existing cardio/weight/readings/diet pattern).
 *
 * Empty state via `<app-empty-state>` (Phase 1 reusable). Load failure via
 * `<app-error-state>`.
 */
@Component({
  selector: 'app-settings-memory',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, ErrorStateComponent],
  template: `
    @if (loadError) {
      <app-error-state
        title="Couldn't load memory files"
        [error]="loadError"
        (retry)="reloadData()"
      ></app-error-state>
    } @else {
      <h1>AI memory</h1>
      <p class="page-subhead">Files the AI has saved to remember things between conversations. You can read, edit, or delete any of them.</p>
      @if (files.length === 0) {
        <app-empty-state
          title="No memory files yet"
          message="When the AI saves something to remember, it will show up here."
        ></app-empty-state>
      } @else {
        <ul class="memory-tree" role="list">
          @for (file of files; track file.path) {
            <li class="memory-tree-row">
              <button
                type="button"
                class="memory-tree-leaf"
                (click)="onToggleExpand(file.path)"
                [attr.aria-expanded]="expandedPath === file.path"
                [attr.aria-controls]="'preview-' + slugify(file.path)"
                [attr.aria-label]="file.path + ', ' + file.size + ' bytes'"
              >
                {{ file.path }}
              </button>
              @if (expandedPath === file.path) {
                <div class="memory-preview" [id]="'preview-' + slugify(file.path)">
                  @if (editingPath === file.path) {
                    <textarea
                      [(ngModel)]="editingDraft"
                      aria-label="Edit memory file content"
                    ></textarea>
                    <div class="memory-preview-actions">
                      <button type="button" class="btn btn-primary btn-sm" (click)="onSaveEdit()">Save changes</button>
                      <button type="button" class="btn btn-secondary btn-sm" (click)="onCancelEdit()">Discard edits</button>
                    </div>
                  } @else {
                    <pre class="memory-preview-content">{{ previewContent }}</pre>
                    <div class="memory-preview-actions">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="onStartEdit(file.path)">Edit</button>
                      <button type="button" class="btn btn-danger btn-sm" (click)="onDelete(file.path)">Delete</button>
                    </div>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
      @if (statusMessage) {
        <p class="status-message" [class.error]="statusIsError" role="status" aria-live="polite">{{ statusMessage }}</p>
      }
    }
  `,
  styles: [`
    :host { display: block; padding: 1.5rem; max-width: 720px; }
    h1 { margin-bottom: 0.5rem; }
    .page-subhead { color: #7f8c8d; margin-bottom: 1.5rem; }
    .memory-tree { list-style: none; padding: 0; margin: 0; }
    .memory-tree-row { margin-bottom: 0.25rem; }
    .memory-tree-leaf {
      background: none;
      border: none;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      font-family: inherit;
      font-size: 1rem;
      text-align: left;
      width: 100%;
      border-radius: 4px;
      color: #2c3e50;
    }
    .memory-tree-leaf:hover { background: #f0f0f0; }
    .memory-tree-leaf[aria-expanded="true"] { background: #ecf0f1; }
    .memory-preview {
      padding: 0.5rem 0.75rem 0.75rem;
      background: #f8f9fa;
      border-radius: 4px;
      margin-top: 0.25rem;
    }
    .memory-preview-content {
      white-space: pre-wrap;
      max-height: 240px;
      overflow-y: auto;
      margin: 0 0 0.5rem;
      padding: 0.5rem;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .memory-preview textarea {
      width: 100%;
      min-height: 200px;
      padding: 0.5rem;
      font-family: inherit;
      font-size: 1rem;
      box-sizing: border-box;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    .memory-preview-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .btn {
      padding: 0.375rem 0.75rem;
      border-radius: 4px;
      font-size: 0.875rem;
      cursor: pointer;
      border: none;
    }
    .btn-primary {
      background-color: #3498db;
      color: #fff;
    }
    .btn-primary:hover:not(:disabled) { background-color: #2980b9; }
    .btn-secondary {
      background-color: #ecf0f1;
      color: #2c3e50;
      border: 1px solid #ddd;
    }
    .btn-secondary:hover:not(:disabled) { background-color: #dfe6e9; }
    .btn-danger {
      background-color: #fff;
      color: #e74c3c;
      border: 1px solid #e74c3c;
    }
    .btn-danger:hover:not(:disabled) {
      background-color: #e74c3c;
      color: #fff;
    }
    .btn-sm { padding: 0.25rem 0.625rem; font-size: 0.875rem; }
    .status-message {
      margin-top: 1rem;
      padding: 0.75rem;
      border-radius: 4px;
      background: #d4edda;
      color: #155724;
    }
    .status-message.error {
      background: #f8d7da;
      color: #721c24;
    }
  `],
})
export class SettingsMemoryComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  files: MemoryFileEntry[] = [];
  expandedPath: string | null = null;
  editingPath: string | null = null;
  editingDraft = '';
  previewContent = '';
  statusMessage = '';
  statusIsError = false;
  loadError: Error | null = null;

  constructor(
    private memoryStore: MemoryStoreService,
    private storageService: StorageService,
  ) {}

  ngOnInit(): void {
    this.reloadData();
  }

  reloadData(): void {
    this.loadError = null;
    this.storageService
      .initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.memoryStore
            .listFiles()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (files) => {
                this.files = files;
              },
              error: (err) => {
                this.loadError = err instanceof Error ? err : new Error(String(err));
              },
            });
        },
        error: (err) => {
          this.loadError = err instanceof Error ? err : new Error(String(err));
        },
      });
  }

  onToggleExpand(path: string): void {
    if (this.expandedPath === path) {
      // Collapse: also exit any edit-in-progress on this row.
      this.expandedPath = null;
      this.editingPath = null;
      this.editingDraft = '';
      return;
    }
    this.expandedPath = path;
    this.editingPath = null;
    this.editingDraft = '';
    this.memoryStore
      .readFile(path)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (content) => {
          this.previewContent = content ?? '';
        },
      });
  }

  onStartEdit(path: string): void {
    this.editingPath = path;
    this.editingDraft = this.previewContent;
  }

  onSaveEdit(): void {
    if (!this.editingPath) return;
    const path = this.editingPath;
    const draft = this.editingDraft;
    this.memoryStore
      .writeFile(path, draft)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.previewContent = draft;
          this.editingPath = null;
          this.editingDraft = '';
          this.statusMessage = 'Memory file saved.';
          this.statusIsError = false;
          this.reloadData();
        },
        error: (err) => {
          const reason = err instanceof Error ? err.message : String(err);
          this.statusMessage = `Couldn't save memory file. ${reason}`;
          this.statusIsError = true;
        },
      });
  }

  onCancelEdit(): void {
    this.editingPath = null;
    this.editingDraft = '';
  }

  onDelete(path: string): void {
    if (!window.confirm(`Delete memory file "${path}"? This can't be undone.`)) {
      return;
    }
    this.memoryStore
      .deleteFile(path)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ok) => {
          if (ok) {
            this.statusMessage = 'Memory file deleted.';
            this.statusIsError = false;
            this.expandedPath = null;
            this.editingPath = null;
            this.editingDraft = '';
            this.previewContent = '';
            this.reloadData();
          }
        },
        error: (err) => {
          const reason = err instanceof Error ? err.message : String(err);
          this.statusMessage = `Couldn't delete memory file. ${reason}`;
          this.statusIsError = true;
        },
      });
  }

  /**
   * Slug helper for `aria-controls` ID generation. Memory paths contain
   * slashes and dots that aren't valid in HTML IDs; map non-alphanumeric
   * chars to dashes.
   */
  slugify(path: string): string {
    return path.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }
}
