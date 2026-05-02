import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { NavComponent } from './shared/nav.component';
import { RecoveryBannerComponent } from './shared/recovery-banner.component';
import { StorageError, StorageService } from './services/storage.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavComponent, RecoveryBannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Personal Fitness Tracker';

  /** Set when StorageService.initialize() rejects with code MIGRATION_FAILED. */
  migrationError: StorageError | null = null;
  /** Parsed from the error message — fed to <app-recovery-banner>. */
  recoveryKey = '';
  fromVersion = 0;
  toVersion = 0;
  /** Backup payload read via the StorageService chokepoint (NOT direct localStorage). */
  backupJson = '';
  /** True after the user picks "Continue with empty data" — re-enables router-outlet. */
  continuedEmpty = false;

  private destroyRef = inject(DestroyRef);
  private storage = inject(StorageService);

  ngOnInit(): void {
    this.runInitialize();
  }

  private runInitialize(): void {
    this.storage.initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.migrationError = null; },
        error: (e: unknown) => {
          if (e instanceof StorageError && e.code === 'MIGRATION_FAILED') {
            this.migrationError = e;
            this.parseRecoveryFromError(e);
            this.loadBackupJson();
          } else {
            // Non-migration storage errors are handled by individual feature
            // pages via <app-error-state>. Surface to console for debugging.
            console.error('AppComponent: storage init failed', e);
          }
        },
      });
  }

  /**
   * Extracts the recovery key + version range from the StorageError message
   * shape produced by storage.service.ts initialize() (plan 09):
   *   "Migration failed (v3 → v4). Backup at fitness_tracker_data.backup.v3.<ts>."
   * If the parse fails, fields stay at their default values; the banner still
   * renders so the user is not left on a blank screen.
   */
  private parseRecoveryFromError(e: StorageError): void {
    const match = /v(\d+)\s*→\s*v(\d+)\)\.\s*Backup at\s+(\S+?)\.?$/.exec(e.message);
    if (match) {
      this.fromVersion = Number(match[1]);
      this.toVersion = Number(match[2]);
      this.recoveryKey = match[3];
    }
  }

  /**
   * Reads the backup JSON via the StorageService chokepoint.
   *
   * CLAUDE.md mandates that all LocalStorage access goes through StorageService.
   * This method calls `storage.getBackup(key)` — it does NOT touch the
   * browser storage API directly. Any future change MUST keep the call
   * going through StorageService (the tree-wide chokepoint gate enforces this).
   */
  private loadBackupJson(): void {
    this.backupJson = this.storage.getBackup(this.recoveryKey) ?? '';
  }

  onRetryMigration(): void {
    // Re-run initialize. Per plan 09, the `initialized` flag stays false on
    // the throw path so a retry will actually re-attempt the migration.
    this.runInitialize();
  }

  onCopyBackup(): void {
    // No-op: RecoveryBannerComponent handles the clipboard write internally.
  }

  onContinueEmpty(): void {
    this.continuedEmpty = true;
    this.migrationError = null;
    // The user accepted the empty-state path. <router-outlet> renders;
    // feature pages will show their own empty states on first render.
  }
}
