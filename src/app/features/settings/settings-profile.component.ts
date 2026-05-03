import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserProfileService } from '../../services/user-profile.service';
import { StorageService } from '../../services/storage.service';
import { UserProfile } from '../../models/user-profile.model';
import { ErrorStateComponent } from '../../shared/error-state.component';

/**
 * `/settings/profile` — UserProfile editor (Plan 03-04 Task 3).
 *
 * Four-textarea reactive form bound to UserProfile (D-01..D-05). Per-section
 * 4096-char cap enforced via `Validators.maxLength(4096)`. Goals textarea is
 * the page focal point (UI-SPEC.md "Focal Point Declaration") — auto-focused
 * on view init via `ViewChild` + `setTimeout(...,0)` (matches the chat
 * scroll-restoration pattern). Char counter renders `{n} / 4096 characters`
 * right-aligned in the muted-secondary color, hidden when the section is
 * empty.
 *
 * Save success → "Profile saved." | Failure → "Couldn't save profile.
 * {underlying reason}". Service-side validation (UserProfileService) is the
 * defense-in-depth gate per T-3-DM threat-model entry.
 */
@Component({
  selector: 'app-settings-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ErrorStateComponent],
  template: `
    @if (loadError) {
      <app-error-state
        title="Couldn't load profile"
        [error]="loadError"
        (retry)="reloadData()"
      ></app-error-state>
    } @else {
      <h1>Your profile</h1>
      <p class="page-subhead">These notes are sent to the AI in every conversation so it knows who it's coaching. Leave any field blank if you'd rather not share it.</p>
      <form [formGroup]="profileForm" (ngSubmit)="onSave()" class="profile-form" aria-label="User profile form">
        <div class="form-group">
          <label for="goals">Goals</label>
          <textarea
            id="goals"
            #goalsField
            formControlName="goals"
            placeholder="e.g., lose 15 lbs by July, train for a 10K, hit 1 g protein per lb of bodyweight"
            rows="4"
            aria-describedby="goals-counter goals-error"
            [attr.aria-invalid]="profileForm.get('goals')?.invalid && profileForm.get('goals')?.touched ? 'true' : null"
          ></textarea>
          @if (goalsLength() > 0) {
            <p class="char-counter" id="goals-counter">{{ goalsLength() }} / 4096 characters</p>
          }
          @if (profileForm.get('goals')?.errors?.['maxlength'] && profileForm.get('goals')?.touched) {
            <p class="error-message" id="goals-error">This section can hold at most 4096 characters.</p>
          }
        </div>

        <div class="form-group">
          <label for="preferences">Preferences</label>
          <textarea
            id="preferences"
            formControlName="preferences"
            placeholder="e.g., I prefer running outdoors, I don't like long sessions on the bike, I train mornings before work"
            rows="4"
            aria-describedby="preferences-counter preferences-error"
            [attr.aria-invalid]="profileForm.get('preferences')?.invalid && profileForm.get('preferences')?.touched ? 'true' : null"
          ></textarea>
          @if (preferencesLength() > 0) {
            <p class="char-counter" id="preferences-counter">{{ preferencesLength() }} / 4096 characters</p>
          }
          @if (profileForm.get('preferences')?.errors?.['maxlength'] && profileForm.get('preferences')?.touched) {
            <p class="error-message" id="preferences-error">This section can hold at most 4096 characters.</p>
          }
        </div>

        <div class="form-group">
          <label for="dietaryConstraints">Dietary constraints</label>
          <textarea
            id="dietaryConstraints"
            formControlName="dietaryConstraints"
            placeholder="e.g., strict low-carb, no seed oils, dairy-free, target 150 g protein per day"
            rows="4"
            aria-describedby="dietaryConstraints-counter dietaryConstraints-error"
            [attr.aria-invalid]="profileForm.get('dietaryConstraints')?.invalid && profileForm.get('dietaryConstraints')?.touched ? 'true' : null"
          ></textarea>
          @if (dietaryConstraintsLength() > 0) {
            <p class="char-counter" id="dietaryConstraints-counter">{{ dietaryConstraintsLength() }} / 4096 characters</p>
          }
          @if (profileForm.get('dietaryConstraints')?.errors?.['maxlength'] && profileForm.get('dietaryConstraints')?.touched) {
            <p class="error-message" id="dietaryConstraints-error">This section can hold at most 4096 characters.</p>
          }
        </div>

        <div class="form-group">
          <label for="trainingHistory">Training history</label>
          <textarea
            id="trainingHistory"
            formControlName="trainingHistory"
            placeholder="e.g., 3 years of strength training, ran two half-marathons in 2024, currently in a fat-loss phase"
            rows="4"
            aria-describedby="trainingHistory-counter trainingHistory-error"
            [attr.aria-invalid]="profileForm.get('trainingHistory')?.invalid && profileForm.get('trainingHistory')?.touched ? 'true' : null"
          ></textarea>
          @if (trainingHistoryLength() > 0) {
            <p class="char-counter" id="trainingHistory-counter">{{ trainingHistoryLength() }} / 4096 characters</p>
          }
          @if (profileForm.get('trainingHistory')?.errors?.['maxlength'] && profileForm.get('trainingHistory')?.touched) {
            <p class="error-message" id="trainingHistory-error">This section can hold at most 4096 characters.</p>
          }
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" [disabled]="profileForm.invalid || saving">
            {{ saving ? 'Saving…' : 'Save profile' }}
          </button>
        </div>

        @if (statusMessage) {
          <p class="status-message" [class.error]="statusIsError" role="status" aria-live="polite">{{ statusMessage }}</p>
        }
      </form>
    }
  `,
  styles: [`
    :host { display: block; padding: 1.5rem; max-width: 720px; }
    h1 { margin-bottom: 0.5rem; }
    .page-subhead { color: #7f8c8d; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    label {
      display: block;
      margin-bottom: 0.375rem;
      font-weight: 600;
      color: #2c3e50;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      padding: 0.5rem;
      font-family: inherit;
      font-size: 1rem;
      line-height: 1.5;
      box-sizing: border-box;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    textarea:focus {
      border-color: #3498db;
      box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
      outline: none;
    }
    .char-counter {
      text-align: right;
      font-size: 0.875rem;
      color: #7f8c8d;
      margin: 0.25rem 0 0;
    }
    .error-message {
      color: #e74c3c;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
    .form-actions { margin-top: 1.5rem; }
    .btn {
      padding: 0.625rem 1.5rem;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      border: none;
    }
    .btn-primary {
      background-color: #3498db;
      color: white;
    }
    .btn-primary:hover:not(:disabled) { background-color: #2980b9; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
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
export class SettingsProfileComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);

  profileForm!: FormGroup;
  saving = false;
  statusMessage = '';
  statusIsError = false;
  loadError: Error | null = null;

  @ViewChild('goalsField') goalsField?: ElementRef<HTMLTextAreaElement>;

  constructor(
    private fb: FormBuilder,
    private userProfileService: UserProfileService,
    private storageService: StorageService,
  ) {}

  ngOnInit(): void {
    this.profileForm = this.fb.group({
      goals: ['', [Validators.maxLength(4096)]],
      preferences: ['', [Validators.maxLength(4096)]],
      dietaryConstraints: ['', [Validators.maxLength(4096)]],
      trainingHistory: ['', [Validators.maxLength(4096)]],
    });
    this.reloadData();
  }

  ngAfterViewInit(): void {
    // Focal point per UI-SPEC.md: Goals textarea receives focus immediately
    // after view init. setTimeout(0) defers past the current change-detection
    // cycle (matches the existing chat-message-list scroll-restoration pattern).
    setTimeout(() => this.goalsField?.nativeElement.focus(), 0);
  }

  goalsLength(): number {
    return ((this.profileForm?.get('goals')?.value as string | null) ?? '').length;
  }
  preferencesLength(): number {
    return ((this.profileForm?.get('preferences')?.value as string | null) ?? '').length;
  }
  dietaryConstraintsLength(): number {
    return ((this.profileForm?.get('dietaryConstraints')?.value as string | null) ?? '').length;
  }
  trainingHistoryLength(): number {
    return ((this.profileForm?.get('trainingHistory')?.value as string | null) ?? '').length;
  }

  reloadData(): void {
    this.loadError = null;
    this.storageService
      .initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.userProfileService
            .getProfile()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (profile) => {
                this.profileForm.patchValue({
                  goals: profile.goals,
                  preferences: profile.preferences,
                  dietaryConstraints: profile.dietaryConstraints,
                  trainingHistory: profile.trainingHistory,
                });
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

  onSave(): void {
    if (this.profileForm.invalid || this.saving) return;
    this.saving = true;
    this.statusMessage = '';

    const v = this.profileForm.value;
    const profile: UserProfile = {
      goals: v.goals ?? '',
      preferences: v.preferences ?? '',
      dietaryConstraints: v.dietaryConstraints ?? '',
      trainingHistory: v.trainingHistory ?? '',
      updatedAt: new Date().toISOString(),
    };

    this.userProfileService
      .saveProfile(profile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.statusMessage = 'Profile saved.';
          this.statusIsError = false;
          this.saving = false;
        },
        error: (err) => {
          const reason = err instanceof Error ? err.message : String(err);
          this.statusMessage = `Couldn't save profile. ${reason}`;
          this.statusIsError = true;
          this.saving = false;
        },
      });
  }
}
