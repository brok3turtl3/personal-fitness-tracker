import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardioService, CardioValidationError } from '../../services/cardio.service';
import { StorageService } from '../../services/storage.service';
import { CardioSession, CreateCardioSession, CARDIO_TYPES } from '../../models/cardio-session.model';
import { VALIDATION_LIMITS } from '../../services/validators';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';

@Component({
  selector: 'app-cardio-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent],
  template: `
    <div class="page-container">
      <h1>Cardio Sessions</h1>

      <!-- Edit-mode announce (a11y: mode change is spoken, not color-only) -->
      <p class="sr-status" role="status" aria-live="polite">{{ editStatus }}</p>

      <!-- Add / Edit Session Form -->
      <form [formGroup]="sessionForm" (ngSubmit)="onSubmit()" class="cardio-form" [attr.aria-label]="editingId ? 'Edit cardio session form' : 'Add cardio session form'">
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
              aria-label="Session date and time"
              aria-required="true"
              [attr.aria-invalid]="isFieldInvalid('date')"
              [class.invalid]="isFieldInvalid('date')"
            >
            @if (isFieldInvalid('date')) {
              <span class="error-message">
                @if (sessionForm.get('date')?.errors?.['required']) {
                  Date is required
                }
              </span>
            }
          </div>

          <div class="form-group">
            <label for="type">Type *</label>
            <select 
              id="type" 
              formControlName="type"
              aria-label="Cardio exercise type"
              aria-required="true"
              [attr.aria-invalid]="isFieldInvalid('type')"
              [class.invalid]="isFieldInvalid('type')"
            >
              <option value="">Select type...</option>
              @for (cardioType of cardioTypes; track cardioType.value) {
                <option [value]="cardioType.value">{{ cardioType.label }}</option>
              }
            </select>
            @if (isFieldInvalid('type')) {
              <span class="error-message">
                @if (sessionForm.get('type')?.errors?.['required']) {
                  Type is required
                }
              </span>
            }
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="durationMinutes">Duration (minutes) *</label>
            <input 
              type="number" 
              id="durationMinutes" 
              formControlName="durationMinutes"
              [min]="limits.DURATION_MIN"
              [max]="limits.DURATION_MAX"
              aria-label="Duration in minutes"
              aria-required="true"
              [attr.aria-invalid]="isFieldInvalid('durationMinutes')"
              [class.invalid]="isFieldInvalid('durationMinutes')"
            >
            @if (isFieldInvalid('durationMinutes')) {
              <span class="error-message">
                @if (sessionForm.get('durationMinutes')?.errors?.['required']) {
                  Duration is required
                } @else if (sessionForm.get('durationMinutes')?.errors?.['min'] || sessionForm.get('durationMinutes')?.errors?.['max']) {
                  Duration must be between {{ limits.DURATION_MIN }} and {{ limits.DURATION_MAX }} minutes
                }
              </span>
            }
          </div>

          <div class="form-group">
            <label for="distanceKm">Distance (km)</label>
            <input 
              type="number" 
              id="distanceKm" 
              formControlName="distanceKm"
              [min]="limits.DISTANCE_MIN"
              [max]="limits.DISTANCE_MAX"
              step="0.01"
              aria-label="Distance in kilometers (optional)"
              [attr.aria-invalid]="isFieldInvalid('distanceKm')"
              [class.invalid]="isFieldInvalid('distanceKm')"
            >
            @if (isFieldInvalid('distanceKm')) {
              <span class="error-message">
                @if (sessionForm.get('distanceKm')?.errors?.['min'] || sessionForm.get('distanceKm')?.errors?.['max']) {
                  Distance must be between {{ limits.DISTANCE_MIN }} and {{ limits.DISTANCE_MAX }} km
                }
              </span>
            }
          </div>
        </div>

        <div class="form-group">
          <label for="caloriesBurned">Calories burned (kcal)</label>
          <input
            type="number"
            id="caloriesBurned"
            formControlName="caloriesBurned"
            [min]="limits.CALORIES_MIN"
            [max]="limits.CALORIES_MAX"
            step="1"
            aria-label="Calories burned in kilocalories (optional)"
            [attr.aria-invalid]="isFieldInvalid('caloriesBurned')"
            [class.invalid]="isFieldInvalid('caloriesBurned')"
          >
          @if (isFieldInvalid('caloriesBurned')) {
            <span class="error-message">
              @if (sessionForm.get('caloriesBurned')?.errors?.['min'] || sessionForm.get('caloriesBurned')?.errors?.['max']) {
                Calories must be between {{ limits.CALORIES_MIN }} and {{ limits.CALORIES_MAX }} kcal
              }
            </span>
          }
        </div>

        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea 
            id="notes" 
            formControlName="notes"
            rows="3"
            [maxlength]="limits.NOTES_MAX_LENGTH"
            aria-label="Session notes (optional)"
            [attr.aria-invalid]="isFieldInvalid('notes')"
            [class.invalid]="isFieldInvalid('notes')"
          ></textarea>
          <span class="char-count">
            {{ sessionForm.get('notes')?.value?.length || 0 }}/{{ limits.NOTES_MAX_LENGTH }}
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
            [disabled]="sessionForm.invalid || isSubmitting"
            [attr.aria-busy]="isSubmitting"
            [attr.aria-label]="editingId ? 'Save changes' : 'Add cardio session'"
          >
            @if (isSubmitting) {
              Saving...
            } @else if (editingId) {
              Save changes
            } @else {
              Add Session
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

      <!-- Sessions History -->
      <section class="history-section" aria-label="Cardio session history">
        <h2>History</h2>

        @if (loadError) {
          <app-error-state
            title="Couldn't load your cardio sessions"
            [error]="loadError"
            (retry)="reloadData()"
          ></app-error-state>
        } @else if (sessions.length === 0) {
          <app-empty-state
            title="No cardio sessions yet"
            message="Log your first session using the form above."
          ></app-empty-state>
        } @else {
          <ul class="history-list" role="list" aria-label="Cardio sessions list">
            @for (session of sessions; track session.id) {
              <li class="history-item">
                <div class="history-item-main">
                  <span class="history-item-type">{{ getTypeLabel(session.type) }}</span>
                  <div class="history-item-actions">
                    <span class="history-item-value">
                      {{ session.durationMinutes }} min
                      @if (session.distanceKm) {
                        &middot; {{ session.distanceKm }} km
                      }
                      @if (session.caloriesBurned !== undefined && session.caloriesBurned !== null) {
                        &middot; {{ session.caloriesBurned }} kcal
                      }
                    </span>
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      [id]="'edit-btn-' + session.id"
                      (click)="onEdit(session)"
                      aria-label="Edit this cardio session"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="btn btn-danger btn-sm"
                      (click)="onDeleteSession(session)"
                      [disabled]="isDeleting"
                      [attr.aria-busy]="isDeleting"
                      [attr.aria-label]="'Delete cardio session on ' + formatDate(session.date)"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div class="history-item-meta">
                  <span class="history-item-date">{{ formatDate(session.date) }}</span>
                  @if (session.notes) {
                    <span class="history-item-notes">{{ session.notes }}</span>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: [`
    .cardio-form {
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
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
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


    .history-item-type {
      font-weight: 600;
      color: #2c3e50;
      background: #e8f4fd;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.875rem;
    }

    .history-item-value {
      font-weight: 500;
      color: #2c3e50;
    }

    .history-item-meta {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .history-item-date {
      font-size: 0.875rem;
      color: #7f8c8d;
    }

    .history-item-notes {
      font-size: 0.875rem;
      color: #7f8c8d;
      font-style: italic;
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
export class CardioPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  @ViewChild('firstField') firstField?: ElementRef<HTMLInputElement>;

  sessionForm: FormGroup;
  sessions: CardioSession[] = [];
  cardioTypes = CARDIO_TYPES;
  limits = VALIDATION_LIMITS;
  isSubmitting = false;
  isDeleting = false;
  submitError: string | null = null;
  loadError: Error | null = null;

  /** Non-null when an existing session is being edited in place (D-11). */
  editingId: string | null = null;
  /** Live-region copy announcing edit-mode transitions (a11y, not color). */
  editStatus = '';

  constructor(
    private fb: FormBuilder,
    private cardioService: CardioService,
    private storageService: StorageService
  ) {
    this.sessionForm = this.fb.group({
      date: ['', Validators.required],
      type: ['', Validators.required],
      durationMinutes: ['', [
        Validators.required,
        Validators.min(VALIDATION_LIMITS.DURATION_MIN),
        Validators.max(VALIDATION_LIMITS.DURATION_MAX)
      ]],
      distanceKm: ['', [
        Validators.min(VALIDATION_LIMITS.DISTANCE_MIN),
        Validators.max(VALIDATION_LIMITS.DISTANCE_MAX)
      ]],
      caloriesBurned: ['', [
        Validators.min(VALIDATION_LIMITS.CALORIES_MIN),
        Validators.max(VALIDATION_LIMITS.CALORIES_MAX)
      ]],
      notes: ['', Validators.maxLength(VALIDATION_LIMITS.NOTES_MAX_LENGTH)]
    });
  }

  ngOnInit(): void {
    this.reloadData();
  }

  reloadData(): void {
    // Initialize storage and load sessions
    this.loadError = null;
    this.storageService.initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadSessions(),
        error: (err) => {
          this.loadError = err instanceof Error ? err : new Error(String(err));
        }
      });
  }

  loadSessions(): void {
    this.cardioService.getSessions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => this.sessions = sessions,
        error: (err) => {
          this.loadError = err instanceof Error ? err : new Error(String(err));
        }
      });
  }

  onDeleteSession(session: CardioSession): void {
    const ok = window.confirm('Delete this cardio session? This cannot be undone.');
    if (!ok) return;

    this.isDeleting = true;
    this.cardioService.deleteSession(session.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadSessions();
          this.isDeleting = false;
        },
        error: () => {
          this.isDeleting = false;
          this.submitError = 'Failed to delete session. Please try again.';
        }
      });
  }

  /**
   * Enter edit mode for an existing session: pre-fill the form in place
   * (D-11), announce the mode change, and focus the first field. Writes
   * nothing — the original entry stays untouched until Save (D-12).
   */
  onEdit(session: CardioSession): void {
    this.editingId = session.id;
    this.submitError = null;
    this.sessionForm.reset();
    this.sessionForm.patchValue({
      date: this.toDatetimeLocal(session.date),
      type: session.type,
      durationMinutes: session.durationMinutes,
      distanceKm: session.distanceKm ?? '',
      caloriesBurned: session.caloriesBurned ?? '',
      notes: session.notes ?? ''
    });
    this.editStatus = 'Editing entry — make your changes and save.';
    // Focus the first field once the edit-mode header has rendered.
    setTimeout(() => this.firstField?.nativeElement?.focus(), 0);
  }

  /**
   * Discard an in-progress edit and restore add mode (D-11). Non-destructive:
   * no service write. Returns focus to the originating row's Edit button.
   */
  onCancelEdit(): void {
    const returnId = this.editingId;
    this.editingId = null;
    this.submitError = null;
    this.sessionForm.reset();
    this.editStatus = 'Edit discarded — back to adding a new entry.';
    if (returnId) {
      setTimeout(() => {
        document.getElementById('edit-btn-' + returnId)?.focus();
      }, 0);
    }
  }

  onSubmit(): void {
    if (this.sessionForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.sessionForm.controls).forEach(key => {
        this.sessionForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.submitError = null;

    const formValue = this.sessionForm.value;

    const caloriesBurned =
      formValue.caloriesBurned === '' || formValue.caloriesBurned === null || formValue.caloriesBurned === undefined
        ? undefined
        : Number(formValue.caloriesBurned);

    // Convert local datetime to ISO string
    const sessionData: CreateCardioSession = {
      date: new Date(formValue.date).toISOString(),
      type: formValue.type,
      durationMinutes: Number(formValue.durationMinutes),
      distanceKm: formValue.distanceKm ? Number(formValue.distanceKm) : undefined,
      caloriesBurned,
      notes: formValue.notes || undefined
    };

    const handleError = (err: unknown) => {
      this.isSubmitting = false;
      if (err instanceof CardioValidationError) {
        this.submitError = err.errors.map(e => e.message).join(', ');
      } else {
        this.submitError = 'Failed to save session. Please try again.';
      }
    };

    if (this.editingId) {
      this.cardioService.updateSession(this.editingId, sessionData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.editingId = null;
            this.sessionForm.reset();
            this.editStatus = 'Entry updated.';
            this.loadSessions();
            this.isSubmitting = false;
          },
          error: handleError
        });
      return;
    }

    this.cardioService.addSession(sessionData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sessionForm.reset();
          this.loadSessions();
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
    const field = this.sessionForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getTypeLabel(type: string): string {
    return CARDIO_TYPES.find(t => t.value === type)?.label || type;
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
