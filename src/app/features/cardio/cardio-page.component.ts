import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardioService, CardioValidationError } from '../../services/cardio.service';
import { StorageService } from '../../services/storage.service';
import { CardioSession, CreateCardioSession, CARDIO_TYPES } from '../../models/cardio-session.model';
import { VALIDATION_LIMITS } from '../../services/validators';

@Component({
  selector: 'app-cardio-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <h1>Cardio Sessions</h1>
      
      <!-- Add Session Form -->
      <form [formGroup]="sessionForm" (ngSubmit)="onSubmit()" class="cardio-form" aria-label="Add cardio session form">
        <div class="form-row">
          <div class="form-group">
            <label for="date">Date & Time *</label>
            <input 
              type="datetime-local" 
              id="date" 
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
            aria-label="Add cardio session"
          >
            @if (isSubmitting) {
              Saving...
            } @else {
              Add Session
            }
          </button>
        </div>
      </form>

      <!-- Sessions History -->
      <section class="history-section" aria-label="Cardio session history">
        <h2>History</h2>
        
        @if (sessions.length === 0) {
          <div class="empty-state">
            <p>No cardio sessions yet. Add your first session above!</p>
          </div>
        } @else {
          <ul class="history-list" role="list" aria-label="Cardio sessions list">
            @for (session of sessions; track session.id) {
              <li class="history-item">
                <div class="history-item-main">
                  <span class="history-item-type">{{ getTypeLabel(session.type) }}</span>
                  <span class="history-item-value">
                    {{ session.durationMinutes }} min
                    @if (session.distanceKm) {
                      &middot; {{ session.distanceKm }} km
                    }
                  </span>
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

    .history-item {
      padding: 1rem;
      border-bottom: 1px solid #eee;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
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
  sessionForm: FormGroup;
  sessions: CardioSession[] = [];
  cardioTypes = CARDIO_TYPES;
  limits = VALIDATION_LIMITS;
  isSubmitting = false;
  submitError: string | null = null;

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
      notes: ['', Validators.maxLength(VALIDATION_LIMITS.NOTES_MAX_LENGTH)]
    });
  }

  ngOnInit(): void {
    // Initialize storage and load sessions
    this.storageService.initialize().subscribe({
      next: () => this.loadSessions(),
      error: (err) => console.error('Failed to initialize storage:', err)
    });
  }

  loadSessions(): void {
    this.cardioService.getSessions().subscribe({
      next: (sessions) => this.sessions = sessions,
      error: (err) => console.error('Failed to load sessions:', err)
    });
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
    
    // Convert local datetime to ISO string
    const sessionData: CreateCardioSession = {
      date: new Date(formValue.date).toISOString(),
      type: formValue.type,
      durationMinutes: Number(formValue.durationMinutes),
      distanceKm: formValue.distanceKm ? Number(formValue.distanceKm) : undefined,
      notes: formValue.notes || undefined
    };

    this.cardioService.addSession(sessionData).subscribe({
      next: () => {
        this.sessionForm.reset();
        this.loadSessions();
        this.isSubmitting = false;
      },
      error: (err) => {
        this.isSubmitting = false;
        if (err instanceof CardioValidationError) {
          this.submitError = err.errors.map(e => e.message).join(', ');
        } else {
          this.submitError = 'Failed to save session. Please try again.';
        }
      }
    });
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
