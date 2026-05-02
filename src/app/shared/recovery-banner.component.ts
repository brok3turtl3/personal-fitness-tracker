import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErrorStateComponent } from './error-state.component';

/**
 * Migration-failure recovery banner (D-15).
 *
 * Thin wrapper composing <app-error-state> with three actions:
 *   - Retry migration
 *   - Copy backup JSON to clipboard
 *   - Continue with empty data
 *
 * Inputs surface the recovery-key payload (key, fromVersion, toVersion)
 * so the user can locate their backup. AppComponent wires the three
 * outputs to StorageService methods.
 *
 * Per RESEARCH §"Open Q 3": separate component (not inline in AppComponent)
 * to isolate clipboard fallback logic and keep AppComponent simple.
 *
 * Clipboard handling uses feature detection: when `navigator.clipboard`
 * is unavailable (older browsers, non-secure contexts) we render a
 * `<textarea>` with the backup JSON for manual copy.
 */
@Component({
  selector: 'app-recovery-banner',
  standalone: true,
  imports: [CommonModule, ErrorStateComponent],
  template: `
    <app-error-state
      title="Couldn't upgrade your stored data"
      [message]="recoveryMessage()"
    >
      <button type="button" class="btn btn-primary" (click)="retry.emit()">
        Retry migration
      </button>
      <button type="button" class="btn btn-secondary" (click)="onCopyBackup()">
        Copy backup JSON to clipboard
      </button>
      <button type="button" class="btn btn-tertiary" (click)="continueEmpty.emit()">
        Continue with empty data
      </button>
    </app-error-state>

    @if (showFallbackTextarea) {
      <section class="recovery-banner__fallback">
        <p>Clipboard unavailable. Copy the JSON below manually:</p>
        <textarea readonly rows="10" class="recovery-banner__textarea">{{ backupJson }}</textarea>
      </section>
    }
  `,
  styles: [`
    .recovery-banner__fallback { margin-top: 1rem; }
    .recovery-banner__textarea { width: 100%; font-family: monospace; font-size: 0.85em; }
  `]
})
export class RecoveryBannerComponent {
  /** LocalStorage key where the pre-migration backup JSON was written. */
  @Input({ required: true }) recoveryKey!: string;
  /** Schema version the data was on before the migration was attempted. */
  @Input({ required: true }) fromVersion!: number;
  /** Schema version the migration was targeting. */
  @Input({ required: true }) toVersion!: number;
  /** Backup JSON text (read by AppComponent via StorageService.getBackup() and passed in). */
  @Input() backupJson = '';

  @Output() retry = new EventEmitter<void>();
  @Output() copyBackup = new EventEmitter<void>();
  @Output() continueEmpty = new EventEmitter<void>();

  showFallbackTextarea = false;

  recoveryMessage(): string {
    return `A backup of your data was saved at LocalStorage key '${this.recoveryKey}' before the upgrade was attempted (v${this.fromVersion} → v${this.toVersion}). You can retry, copy the backup for safekeeping, or continue with an empty dataset.`;
  }

  onCopyBackup(): void {
    // Feature-detect clipboard API (similar shape to id.ts Pitfall 5).
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(this.backupJson).then(
        () => { this.copyBackup.emit(); },
        () => { this.showFallbackTextarea = true; this.copyBackup.emit(); },
      );
    } else {
      // Clipboard unavailable — show the textarea for manual copy.
      this.showFallbackTextarea = true;
      this.copyBackup.emit();
    }
  }
}
