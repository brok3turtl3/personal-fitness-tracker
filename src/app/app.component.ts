import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet } from '@angular/router';
import { NavComponent } from './shared/nav.component';
import { RecoveryBannerComponent } from './shared/recovery-banner.component';
import { QuotaBannerComponent } from './shared/quota-banner.component';
import { MultiTabBannerComponent } from './shared/multi-tab-banner.component';
import { StorageError, StorageService } from './services/storage.service';
import { STORAGE_KEY } from './models/app-data.model';

/** ≥70% storage usage raises the dismissible warn banner. */
const QUOTA_WARN_THRESHOLD = 70;
/** ≥95% storage usage raises the persistent block banner. */
const QUOTA_BLOCK_THRESHOLD = 95;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    NavComponent,
    RecoveryBannerComponent,
    QuotaBannerComponent,
    MultiTabBannerComponent,
  ],
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

  // ---- Quota banner state (QUAL-02, D-14) ----
  /** Current quota banner mode: 'block' (≥95%, persistent), 'warn' (≥70%, dismissible), or null. */
  quotaMode: 'warn' | 'block' | null = null;
  /** Rounded usage percentage shown in the quota banner copy. */
  quotaPct = 0;
  /** All-data JSON for the 95% block safety valve, read via the StorageService chokepoint. */
  allDataJson = '';
  /** True once the user dismisses the 70% warn banner (re-armed only when usage drops below 70%). */
  private warnDismissed = false;

  // ---- Multi-tab banner state (QUAL-04) ----
  /** True when a `storage` event from another tab reported a newer lastModified. */
  showMultiTabBanner = false;

  private destroyRef = inject(DestroyRef);
  private storage = inject(StorageService);
  private router = inject(Router);

  ngOnInit(): void {
    this.runInitialize();
    this.registerMultiTabListener();
  }

  private runInitialize(): void {
    this.storage.initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.migrationError = null;
          this.refreshQuotaBanner();
        },
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
    this.refreshQuotaBanner();
  }

  // ======================================================================
  // Quota banner (QUAL-02, D-14)
  // ----------------------------------------------------------------------
  // Driven by the origin-wide `usagePct` from StorageService.getStorageInfo()
  // (the 05-04 navigator.storage.estimate() signal). Block (≥95%) is persistent
  // while still ≥95%; warn (≥70%) is dismissible and re-arms when usage drops
  // back below 70%. Banner stacking is collapsed to the SINGLE most-severe
  // applicable banner (05-UI-SPEC permits this): recovery > 95% block >
  // multi-tab > 70% warn. The host renders one quota banner via `quotaMode`.
  // ======================================================================

  /**
   * Re-reads storage usage and recomputes the quota banner mode. Called after
   * init and after the user clears the migration state. All access goes through
   * `StorageService` (the chokepoint) — never `localStorage.*` directly.
   */
  refreshQuotaBanner(): void {
    this.storage.getStorageInfo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (info) => {
          // usagePct is the authoritative estimate()-driven signal; if absent
          // (older browsers), the byte-count percentUsed is the fallback.
          const pct = info.usagePct ?? info.percentUsed;
          this.quotaPct = Math.round(pct);

          if (pct >= QUOTA_BLOCK_THRESHOLD) {
            this.quotaMode = 'block';
            // Load the all-data JSON for the safety valve via the chokepoint.
            this.allDataJson = this.storage.getBackup(STORAGE_KEY) ?? '';
          } else if (pct >= QUOTA_WARN_THRESHOLD) {
            this.quotaMode = this.warnDismissed ? null : 'warn';
          } else {
            this.quotaMode = null;
            this.warnDismissed = false; // re-arm warn for next time it climbs
          }
        },
        error: (e: unknown) => {
          // Quota read failure is non-fatal — leave banners as-is and log.
          console.error('AppComponent: storage info read failed', e);
        },
      });
  }

  onQuotaDismiss(): void {
    // Only the 70% warn is dismissible; the 95% block is persistent.
    this.warnDismissed = true;
    this.quotaMode = null;
  }

  onManageStorage(): void {
    // Route to the storage/AI management hub where chat archival + settings
    // live; per-entry delete lives on the data pages reachable from the nav.
    this.router.navigate(['/settings', 'ai']);
  }

  onCopyJson(): void {
    // No-op: QuotaBannerComponent handles the clipboard write internally.
  }

  // ======================================================================
  // Multi-tab banner (QUAL-04, Pitfall 6)
  // ----------------------------------------------------------------------
  // The `window` `storage` event fires ONLY in OTHER tabs (never the writer).
  // We listen for events on the app's STORAGE_KEY whose newValue carries a
  // `lastModified` newer/different than what THIS tab last knew
  // (StorageService.getLastModified()) and raise the neutral refresh banner.
  // The listener is removed via destroyRef.onDestroy. No direct localStorage
  // read — getLastModified() is the StorageService chokepoint.
  // ======================================================================

  private registerMultiTabListener(): void {
    if (typeof window === 'undefined') return;
    const handler = (event: StorageEvent): void => this.onStorageEvent(event);
    window.addEventListener('storage', handler);
    this.destroyRef.onDestroy(() => window.removeEventListener('storage', handler));
  }

  /**
   * Handle a cross-tab `storage` event. Ignores events for unrelated keys and
   * events whose payload's `lastModified` matches what this tab already knows
   * (avoids false positives — Pitfall 6). Never throws on a malformed payload.
   */
  private onStorageEvent(event: StorageEvent): void {
    if (event.key !== STORAGE_KEY) return;
    if (!event.newValue) return; // cleared/removed — nothing to compare

    let incomingLastModified: string | undefined;
    try {
      const parsed = JSON.parse(event.newValue) as { lastModified?: unknown };
      if (typeof parsed.lastModified === 'string') {
        incomingLastModified = parsed.lastModified;
      }
    } catch {
      return; // malformed payload — ignore
    }
    if (!incomingLastModified) return;

    const known = this.storage.getLastModified();
    // A differing lastModified means another tab wrote newer data.
    if (incomingLastModified !== known) {
      this.showMultiTabBanner = true;
    }
  }

  onMultiTabRefresh(): void {
    // Least-surprising for a local SPA: a full reload guarantees the in-memory
    // StorageService cache and every page re-read the now-changed LocalStorage.
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  onMultiTabDismiss(): void {
    this.showMultiTabBanner = false;
  }
}
