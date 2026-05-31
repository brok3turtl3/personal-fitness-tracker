import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { WeightService, WeightValidationError } from '../../services/weight.service';
import { StorageService } from '../../services/storage.service';
import { WeightEntry, CreateWeightEntry } from '../../models/weight-entry.model';
import { VALIDATION_LIMITS } from '../../services/validators';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';

@Component({
  selector: 'app-weight-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent],
  template: `
    <div class="page-container">
      <h1>Weight Entries</h1>

      <!-- Edit-mode announce (a11y: mode change is spoken, not color-only) -->
      <p class="sr-status" role="status" aria-live="polite">{{ editStatus }}</p>

      <!-- Add / Edit Entry Form -->
      <form [formGroup]="entryForm" (ngSubmit)="onSubmit()" class="weight-form" [attr.aria-label]="editingId ? 'Edit weight entry form' : 'Add weight entry form'">
        @if (editingId) {
          <h2 class="edit-mode-header">Editing entry</h2>
        }
        <div class="form-row">
          <div class="form-group">
            <label for="date">Date & Time *</label>
            <input
              type="datetime-local"
              id="date"
              #firstField
              formControlName="date"
              aria-label="Entry date and time"
              aria-required="true"
              [attr.aria-invalid]="isFieldInvalid('date')"
              [class.invalid]="isFieldInvalid('date')"
            >
            @if (isFieldInvalid('date')) {
              <span class="error-message">
                @if (entryForm.get('date')?.errors?.['required']) {
                  Date is required
                }
              </span>
            }
          </div>

          <div class="form-group">
            <label for="weightLbs">Weight (lbs) *</label>
            <input 
              type="number" 
              id="weightLbs" 
              formControlName="weightLbs"
              [min]="limits.WEIGHT_MIN"
              [max]="limits.WEIGHT_MAX"
              step="0.1"
              aria-label="Weight in pounds"
              aria-required="true"
              [attr.aria-invalid]="isFieldInvalid('weightLbs')"
              [class.invalid]="isFieldInvalid('weightLbs')"
            >
            @if (isFieldInvalid('weightLbs')) {
              <span class="error-message">
                @if (entryForm.get('weightLbs')?.errors?.['required']) {
                  Weight is required
                } @else if (entryForm.get('weightLbs')?.errors?.['min'] || entryForm.get('weightLbs')?.errors?.['max']) {
                  Weight must be between {{ limits.WEIGHT_MIN }} and {{ limits.WEIGHT_MAX }} lbs
                }
              </span>
            }
          </div>
        </div>

        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea 
            id="notes" 
            formControlName="notes"
            rows="3"
            [maxlength]="limits.NOTES_MAX_LENGTH"
            aria-label="Entry notes (optional)"
            [attr.aria-invalid]="isFieldInvalid('notes')"
            [class.invalid]="isFieldInvalid('notes')"
          ></textarea>
          <span class="char-count">
            {{ entryForm.get('notes')?.value?.length || 0 }}/{{ limits.NOTES_MAX_LENGTH }}
          </span>
          @if (isFieldInvalid('notes')) {
            <span class="error-message">
              Notes must be {{ limits.NOTES_MAX_LENGTH }} characters or less
            </span>
          }
        </div>

        @if (submitError) {
          <div class="form-error">{{ submitError }}</div>
        }

        <div class="form-actions">
          <button
            type="submit"
            class="btn btn-primary"
            [disabled]="entryForm.invalid || isSubmitting"
            [attr.aria-busy]="isSubmitting"
            [attr.aria-label]="editingId ? 'Save changes' : 'Add weight entry'"
          >
            @if (isSubmitting) {
              Saving...
            } @else if (editingId) {
              Save changes
            } @else {
              Add Entry
            }
          </button>
          @if (editingId) {
            <button
              type="button"
              class="btn btn-secondary"
              (click)="onCancelEdit()"
              [disabled]="isSubmitting"
              aria-label="Discard changes and stop editing this entry"
            >
              Discard changes
            </button>
          }
        </div>
      </form>

      <!-- Entries History -->
      <section class="history-section" aria-label="Weight entry history">
        <h2>History</h2>

        @if (loadError) {
          <app-error-state
            title="Couldn't load your weight entries"
            [error]="loadError"
            (retry)="reloadData()"
          ></app-error-state>
        } @else if (entries.length === 0) {
          <app-empty-state
            title="No weight entries yet"
            message="Log your first weight using the form above."
          ></app-empty-state>
        } @else {
          <ul class="history-list" role="list" aria-label="Weight entries list">
            @for (entry of entries; track entry.id) {
              <li class="history-item">
                <div class="history-item-main">
                  <span class="history-item-value">{{ entry.weightLbs }} lbs</span>
                  <div class="history-item-actions">
                    <span class="history-item-date">{{ formatDate(entry.date) }}</span>
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      [id]="'edit-btn-' + entry.id"
                      (click)="onEdit(entry)"
                      aria-label="Edit this weight entry"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="btn btn-danger btn-sm"
                      (click)="onDeleteEntry(entry)"
                      [disabled]="isDeleting"
                      [attr.aria-busy]="isDeleting"
                      [attr.aria-label]="'Delete weight entry on ' + formatDate(entry.date)"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                @if (entry.notes) {
                  <div class="history-item-notes">{{ entry.notes }}</div>
                }
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: [`
    .weight-form {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 600px) {
      .form-row {
        grid-template-columns: 1fr;
      }
    }

    .form-group {
      margin-bottom: 1rem;
      position: relative;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #555;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 0.625rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #3498db;
      box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
    }

    .form-group input.invalid,
    .form-group select.invalid,
    .form-group textarea.invalid {
      border-color: #e74c3c;
    }

    .error-message {
      color: #e74c3c;
      font-size: 0.875rem;
      margin-top: 0.25rem;
      display: block;
    }

    .char-count {
      font-size: 0.75rem;
      color: #95a5a6;
      text-align: right;
      display: block;
      margin-top: 0.25rem;
    }

    .form-error {
      background: #fdeaea;
      color: #c0392b;
      padding: 0.75rem;
      border-radius: 4px;
      margin-bottom: 1rem;
    }

    .form-actions {
      margin-top: 1rem;
    }

    .history-section {
      margin-top: 2rem;
    }

    .history-section h2 {
      font-size: 1.25rem;
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .history-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .edit-mode-header {
      font-size: 1.25rem;
      font-weight: 600;
      line-height: 1.2;
      color: #2c3e50;
      margin: 0 0 1rem 0;
    }

    .sr-status {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .history-item {
      padding: 1rem;
      border-bottom: 1px solid #eee;
      min-height: 44px;
    }

    .history-item:last-child {
      border-bottom: none;
    }

    .history-item-main {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }


    .history-item-value {
      font-size: 1.25rem;
      font-weight: 600;
      color: #2c3e50;
    }

    .history-item-date {
      font-size: 0.875rem;
      color: #7f8c8d;
    }

    .history-item-notes {
      font-size: 0.875rem;
      color: #7f8c8d;
      font-style: italic;
      margin-top: 0.5rem;
    }

    .empty-state {
      text-align: center;
      padding: 2rem;
      color: #95a5a6;
      background: #f8f9fa;
      border-radius: 8px;
    }
  `]
})
export class WeightPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  @ViewChild('firstField') firstField?: ElementRef<HTMLInputElement>;

  entryForm: FormGroup;
  entries: WeightEntry[] = [];
  limits = VALIDATION_LIMITS;
  isSubmitting = false;
  isDeleting = false;
  submitError: string | null = null;
  loadError: Error | null = null;

  /** Non-null when an existing entry is being edited in place (D-11). */
  editingId: string | null = null;
  /** Live-region copy announcing edit-mode transitions (a11y, not color). */
  editStatus = '';

  constructor(
    private fb: FormBuilder,
    private weightService: WeightService,
    private storageService: StorageService
  ) {
    this.entryForm = this.fb.group({
      date: ['', Validators.required],
      weightLbs: ['', [
        Validators.required,
        Validators.min(VALIDATION_LIMITS.WEIGHT_MIN),
        Validators.max(VALIDATION_LIMITS.WEIGHT_MAX)
      ]],
      notes: ['', Validators.maxLength(VALIDATION_LIMITS.NOTES_MAX_LENGTH)]
    });
  }

  ngOnInit(): void {
    this.reloadData();
  }

  reloadData(): void {
    // Initialize storage and load entries
    this.loadError = null;
    this.storageService.initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadEntries(),
        error: (err) => {
          this.loadError = err instanceof Error ? err : new Error(String(err));
        }
      });
  }

  loadEntries(): void {
    this.weightService.getEntries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entries) => this.entries = entries,
        error: (err) => {
          this.loadError = err instanceof Error ? err : new Error(String(err));
        }
      });
  }

  onDeleteEntry(entry: WeightEntry): void {
    const ok = window.confirm('Delete this weight entry? This cannot be undone.');
    if (!ok) return;

    this.isDeleting = true;
    this.weightService.deleteEntry(entry.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadEntries();
          this.isDeleting = false;
        },
        error: () => {
          this.isDeleting = false;
          this.submitError = 'Failed to delete entry. Please try again.';
        }
      });
  }

  /**
   * Enter edit mode for an existing entry: pre-fill the form in place (D-11),
   * announce the mode change, and focus the first field. Non-destructive —
   * nothing is written until Save (D-12).
   */
  onEdit(entry: WeightEntry): void {
    this.editingId = entry.id;
    this.submitError = null;
    this.entryForm.reset();
    this.entryForm.patchValue({
      date: this.toDatetimeLocal(entry.date),
      weightLbs: entry.weightLbs,
      notes: entry.notes ?? ''
    });
    this.editStatus = 'Editing entry — make your changes and save.';
    setTimeout(() => this.firstField?.nativeElement?.focus(), 0);
  }

  /**
   * Discard an in-progress edit and restore add mode (D-11). No service write;
   * returns focus to the originating row's Edit button.
   */
  onCancelEdit(): void {
    const returnId = this.editingId;
    this.editingId = null;
    this.submitError = null;
    this.entryForm.reset();
    this.editStatus = 'Edit discarded — back to adding a new entry.';
    if (returnId) {
      setTimeout(() => {
        document.getElementById('edit-btn-' + returnId)?.focus();
      }, 0);
    }
  }

  onSubmit(): void {
    if (this.entryForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.entryForm.controls).forEach(key => {
        this.entryForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.submitError = null;

    const formValue = this.entryForm.value;

    // Convert local datetime to ISO string
    const entryData: CreateWeightEntry = {
      date: new Date(formValue.date).toISOString(),
      weightLbs: Number(formValue.weightLbs),
      notes: formValue.notes || undefined
    };

    const handleError = (err: unknown) => {
      this.isSubmitting = false;
      if (err instanceof WeightValidationError) {
        this.submitError = err.errors.map(e => e.message).join(', ');
      } else {
        this.submitError = 'Failed to save entry. Please try again.';
      }
    };

    if (this.editingId) {
      this.weightService.updateEntry(this.editingId, entryData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.editingId = null;
            this.entryForm.reset();
            this.editStatus = 'Entry updated.';
            this.loadEntries();
            this.isSubmitting = false;
          },
          error: handleError
        });
      return;
    }

    this.weightService.addEntry(entryData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.entryForm.reset();
          this.loadEntries();
          this.isSubmitting = false;
        },
        error: handleError
      });
  }

  /**
   * Convert a stored ISO 8601 timestamp to the local `YYYY-MM-DDTHH:mm`
   * string a `<input type="datetime-local">` expects when pre-filling.
   */
  private toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.entryForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
