import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReadingsService, ReadingsValidationError } from '../../services/readings.service';
import { StorageService } from '../../services/storage.service';
import { 
  HealthReading, 
  HealthReadingType, 
  READING_TYPES,
  BloodPressureReading,
  BloodGlucoseReading,
  KetoneReading
} from '../../models/health-reading.model';
import { VALIDATION_LIMITS } from '../../services/validators';

@Component({
  selector: 'app-readings-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <h1>Health Readings</h1>
      
      <!-- Add Reading Form -->
      <form [formGroup]="readingForm" (ngSubmit)="onSubmit()" class="readings-form" aria-label="Add health reading form">
        <div class="form-row">
          <div class="form-group">
            <label for="date">Date & Time *</label>
            <input 
              type="datetime-local" 
              id="date" 
              formControlName="date"
              aria-label="Reading date and time"
              aria-required="true"
              [attr.aria-invalid]="isFieldInvalid('date')"
              [class.invalid]="isFieldInvalid('date')"
            >
            @if (isFieldInvalid('date')) {
              <span class="error-message">Date is required</span>
            }
          </div>

          <div class="form-group">
            <label for="readingType">Reading Type *</label>
            <select 
              id="readingType" 
              formControlName="readingType"
              (change)="onTypeChange()"
              aria-label="Health reading type"
              aria-required="true"
              [attr.aria-invalid]="isFieldInvalid('readingType')"
              [class.invalid]="isFieldInvalid('readingType')"
            >
              <option value="">Select type...</option>
              @for (type of readingTypes; track type.value) {
                <option [value]="type.value">{{ type.label }}</option>
              }
            </select>
            @if (isFieldInvalid('readingType')) {
              <span class="error-message">Type is required</span>
            }
          </div>
        </div>

        <!-- Blood Pressure Fields -->
        @if (selectedType === 'blood_pressure') {
          <div class="form-row">
            <div class="form-group">
              <label for="systolic">Systolic (mmHg) *</label>
            <input 
              type="number" 
              id="systolic" 
              formControlName="systolic"
              [min]="limits.SYSTOLIC_MIN"
              [max]="limits.SYSTOLIC_MAX"
              aria-label="Systolic blood pressure in mmHg"
              aria-required="true"
              [attr.aria-invalid]="isFieldInvalid('systolic')"
              [class.invalid]="isFieldInvalid('systolic')"
            >
              @if (isFieldInvalid('systolic')) {
                <span class="error-message">
                  @if (readingForm.get('systolic')?.errors?.['required']) {
                    Systolic is required
                  } @else {
                    Systolic must be between {{ limits.SYSTOLIC_MIN }} and {{ limits.SYSTOLIC_MAX }} mmHg
                  }
                </span>
              }
            </div>

            <div class="form-group">
              <label for="diastolic">Diastolic (mmHg) *</label>
            <input 
              type="number" 
              id="diastolic" 
              formControlName="diastolic"
              [min]="limits.DIASTOLIC_MIN"
              [max]="limits.DIASTOLIC_MAX"
              aria-label="Diastolic blood pressure in mmHg"
              aria-required="true"
              [attr.aria-invalid]="isFieldInvalid('diastolic')"
              [class.invalid]="isFieldInvalid('diastolic')"
            >
              @if (isFieldInvalid('diastolic')) {
                <span class="error-message">
                  @if (readingForm.get('diastolic')?.errors?.['required']) {
                    Diastolic is required
                  } @else {
                    Diastolic must be between {{ limits.DIASTOLIC_MIN }} and {{ limits.DIASTOLIC_MAX }} mmHg
                  }
                </span>
              }
            </div>
          </div>
        }

        <!-- Blood Glucose Field -->
        @if (selectedType === 'blood_glucose') {
          <div class="form-group">
            <label for="glucoseMmol">Blood Glucose (mmol/L) *</label>
            <input 
              type="number" 
              id="glucoseMmol" 
              formControlName="glucoseMmol"
              [min]="limits.GLUCOSE_MIN"
              [max]="limits.GLUCOSE_MAX"
              step="0.1"
              aria-label="Blood glucose level in mmol per liter"
              aria-required="true"
              [attr.aria-invalid]="isFieldInvalid('glucoseMmol')"
              [class.invalid]="isFieldInvalid('glucoseMmol')"
            >
            @if (isFieldInvalid('glucoseMmol')) {
              <span class="error-message">
                @if (readingForm.get('glucoseMmol')?.errors?.['required']) {
                  Glucose level is required
                } @else {
                  Glucose must be between {{ limits.GLUCOSE_MIN }} and {{ limits.GLUCOSE_MAX }} mmol/L
                }
              </span>
            }
          </div>
        }

        <!-- Ketone Field -->
        @if (selectedType === 'ketone') {
          <div class="form-group">
            <label for="ketoneMmol">Ketones (mmol/L) *</label>
            <input 
              type="number" 
              id="ketoneMmol" 
              formControlName="ketoneMmol"
              [min]="limits.KETONE_MIN"
              [max]="limits.KETONE_MAX"
              step="0.1"
              aria-label="Ketone level in mmol per liter"
              aria-required="true"
              [attr.aria-invalid]="isFieldInvalid('ketoneMmol')"
              [class.invalid]="isFieldInvalid('ketoneMmol')"
            >
            @if (isFieldInvalid('ketoneMmol')) {
              <span class="error-message">
                @if (readingForm.get('ketoneMmol')?.errors?.['required']) {
                  Ketone level is required
                } @else {
                  Ketones must be between {{ limits.KETONE_MIN }} and {{ limits.KETONE_MAX }} mmol/L
                }
              </span>
            }
          </div>
        }

        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea 
            id="notes" 
            formControlName="notes"
            rows="3"
            [maxlength]="limits.NOTES_MAX_LENGTH"
            aria-label="Reading notes (optional)"
            [attr.aria-invalid]="isFieldInvalid('notes')"
            [class.invalid]="isFieldInvalid('notes')"
          ></textarea>
          <span class="char-count">
            {{ readingForm.get('notes')?.value?.length || 0 }}/{{ limits.NOTES_MAX_LENGTH }}
          </span>
        </div>

        @if (submitError) {
          <div class="form-error">{{ submitError }}</div>
        }

        <div class="form-actions">
          <button 
            type="submit" 
            class="btn btn-primary" 
            [disabled]="!isFormValid() || isSubmitting"
            [attr.aria-busy]="isSubmitting"
            aria-label="Add health reading"
          >
            @if (isSubmitting) {
              Saving...
            } @else {
              Add Reading
            }
          </button>
        </div>
      </form>

      <!-- Readings History -->
      <section class="history-section" aria-label="Health readings history">
        <h2>History</h2>
        
        @if (readings.length === 0) {
          <div class="empty-state">
            <p>No health readings yet. Add your first reading above!</p>
          </div>
        } @else {
          <ul class="history-list" role="list" aria-label="Health readings list">
            @for (reading of readings; track reading.id) {
              <li class="history-item">
                <div class="history-item-main">
                  <span class="history-item-type" [class]="'type-' + reading.type">
                    {{ getTypeLabel(reading.type) }}
                  </span>
                  <span class="history-item-value">{{ formatReadingValue(reading) }}</span>
                </div>
                <div class="history-item-meta">
                  <span class="history-item-date">{{ formatDate(reading.date) }}</span>
                  @if (reading.notes) {
                    <span class="history-item-notes">{{ reading.notes }}</span>
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
    .readings-form {
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
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
    }

    .type-blood_pressure {
      background: #fdeaea;
      color: #c0392b;
    }

    .type-blood_glucose {
      background: #fef3e2;
      color: #d68910;
    }

    .type-ketone {
      background: #e8f8f5;
      color: #1e8449;
    }

    .history-item-value {
      font-weight: 600;
      color: #2c3e50;
      font-size: 1.1rem;
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
export class ReadingsPageComponent implements OnInit {
  readingForm: FormGroup;
  readings: HealthReading[] = [];
  readingTypes = READING_TYPES;
  limits = VALIDATION_LIMITS;
  selectedType: HealthReadingType | '' = '';
  isSubmitting = false;
  submitError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private readingsService: ReadingsService,
    private storageService: StorageService
  ) {
    this.readingForm = this.fb.group({
      date: ['', Validators.required],
      readingType: ['', Validators.required],
      // BP fields
      systolic: [''],
      diastolic: [''],
      // Glucose field
      glucoseMmol: [''],
      // Ketone field
      ketoneMmol: [''],
      // Common
      notes: ['', Validators.maxLength(VALIDATION_LIMITS.NOTES_MAX_LENGTH)]
    });
  }

  ngOnInit(): void {
    this.storageService.initialize().subscribe({
      next: () => this.loadReadings(),
      error: (err) => console.error('Failed to initialize storage:', err)
    });
  }

  loadReadings(): void {
    this.readingsService.getReadings().subscribe({
      next: (readings) => this.readings = readings,
      error: (err) => console.error('Failed to load readings:', err)
    });
  }

  onTypeChange(): void {
    this.selectedType = this.readingForm.get('readingType')?.value || '';
    this.updateValidators();
  }

  updateValidators(): void {
    const { systolic, diastolic, glucoseMmol, ketoneMmol } = this.readingForm.controls;

    // Clear all type-specific validators first
    systolic.clearValidators();
    diastolic.clearValidators();
    glucoseMmol.clearValidators();
    ketoneMmol.clearValidators();

    // Set validators based on selected type
    switch (this.selectedType) {
      case 'blood_pressure':
        systolic.setValidators([
          Validators.required,
          Validators.min(VALIDATION_LIMITS.SYSTOLIC_MIN),
          Validators.max(VALIDATION_LIMITS.SYSTOLIC_MAX)
        ]);
        diastolic.setValidators([
          Validators.required,
          Validators.min(VALIDATION_LIMITS.DIASTOLIC_MIN),
          Validators.max(VALIDATION_LIMITS.DIASTOLIC_MAX)
        ]);
        break;
      case 'blood_glucose':
        glucoseMmol.setValidators([
          Validators.required,
          Validators.min(VALIDATION_LIMITS.GLUCOSE_MIN),
          Validators.max(VALIDATION_LIMITS.GLUCOSE_MAX)
        ]);
        break;
      case 'ketone':
        ketoneMmol.setValidators([
          Validators.required,
          Validators.min(VALIDATION_LIMITS.KETONE_MIN),
          Validators.max(VALIDATION_LIMITS.KETONE_MAX)
        ]);
        break;
    }

    // Update validity
    systolic.updateValueAndValidity();
    diastolic.updateValueAndValidity();
    glucoseMmol.updateValueAndValidity();
    ketoneMmol.updateValueAndValidity();
  }

  isFormValid(): boolean {
    if (!this.selectedType) return false;
    
    const dateValid = this.readingForm.get('date')?.valid ?? false;
    const typeValid = this.readingForm.get('readingType')?.valid ?? false;
    
    if (!dateValid || !typeValid) return false;

    switch (this.selectedType) {
      case 'blood_pressure':
        return (this.readingForm.get('systolic')?.valid ?? false) && 
               (this.readingForm.get('diastolic')?.valid ?? false);
      case 'blood_glucose':
        return this.readingForm.get('glucoseMmol')?.valid ?? false;
      case 'ketone':
        return this.readingForm.get('ketoneMmol')?.valid ?? false;
      default:
        return false;
    }
  }

  onSubmit(): void {
    if (!this.isFormValid()) {
      Object.keys(this.readingForm.controls).forEach(key => {
        this.readingForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.submitError = null;

    const formValue = this.readingForm.value;
    const date = new Date(formValue.date).toISOString();
    const notes = formValue.notes || undefined;

    const handleSuccess = () => {
      this.readingForm.reset();
      this.selectedType = '';
      this.loadReadings();
      this.isSubmitting = false;
    };

    const handleError = (err: unknown) => {
      this.isSubmitting = false;
      if (err instanceof ReadingsValidationError) {
        this.submitError = err.errors.map(e => e.message).join(', ');
      } else {
        this.submitError = 'Failed to save reading. Please try again.';
      }
    };

    switch (this.selectedType) {
      case 'blood_pressure':
        this.readingsService.addBloodPressure({
          date,
          systolic: Number(formValue.systolic),
          diastolic: Number(formValue.diastolic),
          notes
        }).subscribe({ next: handleSuccess, error: handleError });
        break;
      case 'blood_glucose':
        this.readingsService.addBloodGlucose({
          date,
          glucoseMmol: Number(formValue.glucoseMmol),
          notes
        }).subscribe({ next: handleSuccess, error: handleError });
        break;
      case 'ketone':
        this.readingsService.addKetone({
          date,
          ketoneMmol: Number(formValue.ketoneMmol),
          notes
        }).subscribe({ next: handleSuccess, error: handleError });
        break;
      default:
        this.isSubmitting = false;
        return;
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.readingForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getTypeLabel(type: HealthReadingType): string {
    return READING_TYPES.find(t => t.value === type)?.label || type;
  }

  formatReadingValue(reading: HealthReading): string {
    switch (reading.type) {
      case 'blood_pressure':
        const bp = reading as BloodPressureReading;
        return `${bp.systolic}/${bp.diastolic} mmHg`;
      case 'blood_glucose':
        const glucose = reading as BloodGlucoseReading;
        return `${glucose.glucoseMmol} mmol/L`;
      case 'ketone':
        const ketone = reading as KetoneReading;
        return `${ketone.ketoneMmol} mmol/L`;
      default:
        return '';
    }
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
