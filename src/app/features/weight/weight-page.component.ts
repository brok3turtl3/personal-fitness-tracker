import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { WeightService, WeightValidationError } from '../../services/weight.service';
import { StorageService } from '../../services/storage.service';
import { WeightEntry, CreateWeightEntry } from '../../models/weight-entry.model';
import { VALIDATION_LIMITS } from '../../services/validators';

@Component({
  selector: 'app-weight-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <h1>Weight Entries</h1>
      
      <!-- Add Entry Form -->
      <form [formGroup]="entryForm" (ngSubmit)="onSubmit()" class="weight-form" aria-label="Add weight entry form">
        <div class="form-row">
          <div class="form-group">
            <label for="date">Date & Time *</label>
            <input 
              type="datetime-local" 
              id="date" 
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
            aria-label="Add weight entry"
          >
            @if (isSubmitting) {
              Saving...
            } @else {
              Add Entry
            }
          </button>
        </div>
      </form>

      <!-- Entries History -->
      <section class="history-section" aria-label="Weight entry history">
        <h2>History</h2>
        
        @if (entries.length === 0) {
          <div class="empty-state">
            <p>No weight entries yet. Add your first entry above!</p>
          </div>
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

    .history-item {
      padding: 1rem;
      border-bottom: 1px solid #eee;
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
  entryForm: FormGroup;
  entries: WeightEntry[] = [];
  limits = VALIDATION_LIMITS;
  isSubmitting = false;
  isDeleting = false;
  submitError: string | null = null;

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
    // Initialize storage and load entries
    this.storageService.initialize().subscribe({
      next: () => this.loadEntries(),
      error: (err) => console.error('Failed to initialize storage:', err)
    });
  }

  loadEntries(): void {
    this.weightService.getEntries().subscribe({
      next: (entries) => this.entries = entries,
      error: (err) => console.error('Failed to load entries:', err)
    });
  }

  onDeleteEntry(entry: WeightEntry): void {
    const ok = window.confirm('Delete this weight entry? This cannot be undone.');
    if (!ok) return;

    this.isDeleting = true;
    this.weightService.deleteEntry(entry.id).subscribe({
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

    this.weightService.addEntry(entryData).subscribe({
      next: () => {
        this.entryForm.reset();
        this.loadEntries();
        this.isSubmitting = false;
      },
      error: (err) => {
        this.isSubmitting = false;
        if (err instanceof WeightValidationError) {
          this.submitError = err.errors.map(e => e.message).join(', ');
        } else {
          this.submitError = 'Failed to save entry. Please try again.';
        }
      }
    });
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
