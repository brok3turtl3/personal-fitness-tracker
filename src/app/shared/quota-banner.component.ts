import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * App-level storage-quota banner (QUAL-02, D-14).
 *
 * Two modes, driven by the origin-wide `usagePct` the host (AppComponent)
 * reads from `StorageService.getStorageInfo()`:
 *   - `warn`  (≥70%): amber, dismissible, non-blocking. `role="status"`
 *     `aria-live="polite"`. LOCKED 05-UI-SPEC copy.
 *   - `block` (≥95%): red, PERSISTENT (not dismissible while ≥95%), surfaces
 *     that saving is paused. `role="alert"` `aria-live="assertive"`. Offers a
 *     `Manage storage` primary action (routes to where archive/delete lives)
 *     and a `Copy all data as JSON` safety valve (D-14 — reuses the
 *     recovery-banner clipboard feature-detect against `StorageService.getBackup`;
 *     NOT a built export feature).
 *
 * This is a structural sibling of `<app-recovery-banner>` (the established
 * app-level banner-ahead-of-`<router-outlet>` pattern). It does NOT compose
 * `<app-error-state>` because the quota states need bounded amber/red semantic
 * treatment (the error-state surface is fixed red) and the warn state is
 * explicitly NON-error — so it carries its own component-scoped styles per the
 * 05-UI-SPEC (no new global CSS).
 *
 * Triple-encoding (color is never the only indicator, CLAUDE.md a11y):
 * color (amber/red) + icon (`⚠`/`⛔`) + explicit text each encode the state.
 *
 * Clipboard handling mirrors recovery-banner: feature-detect
 * `navigator.clipboard.writeText`, fall back to a readonly `<textarea>` for
 * manual copy when unavailable (older browsers / non-secure contexts).
 */
@Component({
  selector: 'app-quota-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (mode === 'warn') {
      <section
        class="quota-banner quota-banner--warn"
        role="status"
        aria-live="polite"
      >
        <h2 class="quota-banner__title">
          <span class="quota-banner__icon" aria-hidden="true">⚠</span>
          Storage is filling up
        </h2>
        <p class="quota-banner__body">
          You've used about {{ pct }}% of this app's local storage. Consider
          archiving old chats or deleting entries you no longer need.
        </p>
        <div class="quota-banner__actions">
          <button type="button" class="btn btn-secondary" (click)="dismiss.emit()">
            Dismiss
          </button>
        </div>
      </section>
    } @else if (mode === 'block') {
      <section
        class="quota-banner quota-banner--block"
        role="alert"
        aria-live="assertive"
      >
        <h2 class="quota-banner__title">
          <span class="quota-banner__icon" aria-hidden="true">⛔</span>
          Storage is full — new entries can't be saved
        </h2>
        <p class="quota-banner__body">
          You've used about {{ pct }}% of local storage, so saving is paused.
          Free up space by archiving chat history or deleting old entries.
        </p>
        <div class="quota-banner__actions">
          <button type="button" class="btn btn-primary" (click)="manageStorage.emit()">
            Manage storage
          </button>
          <button type="button" class="btn btn-secondary" (click)="onCopyJson()">
            Copy all data as JSON
          </button>
        </div>

        @if (showFallbackTextarea) {
          <div class="quota-banner__fallback">
            <p>Clipboard unavailable. Copy the JSON below manually:</p>
            <textarea
              readonly
              rows="10"
              aria-label="All data as JSON"
              class="quota-banner__textarea"
            >{{ backupJson }}</textarea>
          </div>
        }
      </section>
    }
  `,
  styles: [`
    .quota-banner {
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid transparent;
      /* Default body/control text uses the high-contrast neutral; the semantic
         amber/red is applied to the TITLE only (color is paired with icon+text,
         and stays above WCAG AA — QUAL-08). */
      color: #2c3e50;
    }
    .quota-banner--warn {
      background: #fdf3e7;
      border-color: #b9770e;
    }
    .quota-banner--block {
      background: #fdeaea;
      border-color: #c0392b;
    }
    .quota-banner__title {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      line-height: 1.2;
    }
    /* QUAL-08: #b9770e on #fdf3e7 is 3.36:1 (below AA). The warn title is
       nudged to a darker amber (#8a5808 → 5.50:1) per the UI-SPEC "nudge the
       hex only if a row fails" allowance; #b9770e is retained as the border. */
    .quota-banner--warn .quota-banner__title {
      color: #8a5808;
    }
    /* #c0392b on #fdeaea is 4.70:1 — clears AA, used as-is. */
    .quota-banner--block .quota-banner__title {
      color: #c0392b;
    }
    .quota-banner__icon {
      margin-right: 0.25rem;
    }
    .quota-banner__body {
      margin: 0 0 1rem;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    .quota-banner__actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    /* Component-scoped button colors (QUAL-08): the global .btn-primary
       (#3498db) / .btn-secondary (#95a5a6) palettes sit below WCAG AA on white
       text. Those globals are 05-09's cross-app contrast sweep; here the banner
       buttons override to an AA-clean dark-neutral so THIS new surface is clean
       without touching the shared palette. */
    .quota-banner__actions .btn {
      min-height: 44px;
      background-color: #2c3e50;
      color: #ffffff;
    }
    .quota-banner__actions .btn:hover {
      background-color: #1f2d3a;
    }
    .quota-banner__fallback {
      margin-top: 1rem;
    }
    .quota-banner__textarea {
      width: 100%;
      font-family: monospace;
      font-size: 0.85em;
    }
    @media (max-width: 768px) {
      .quota-banner__actions {
        flex-direction: column;
      }
    }
  `]
})
export class QuotaBannerComponent {
  /** Which banner to render. `null` renders nothing. */
  @Input({ required: true }) mode!: 'warn' | 'block' | null;

  /** The usage percentage shown in the LOCKED copy (rounded by the host). */
  @Input() pct = 0;

  /**
   * All-data JSON payload for the 95% block safety valve. The host reads this
   * via `StorageService.getBackup(STORAGE_KEY)` and passes it in; the textarea
   * fallback renders it for manual copy when the clipboard API is unavailable.
   */
  @Input() backupJson = '';

  /** Warn-mode dismiss. */
  @Output() dismiss = new EventEmitter<void>();
  /** Block-mode primary action — host routes to where archive/delete lives. */
  @Output() manageStorage = new EventEmitter<void>();
  /** Block-mode safety valve — emitted after a successful/attempted clipboard write. */
  @Output() copyJson = new EventEmitter<void>();

  showFallbackTextarea = false;

  onCopyJson(): void {
    // Feature-detect clipboard API (same shape as recovery-banner).
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(this.backupJson).then(
        () => { this.copyJson.emit(); },
        () => { this.showFallbackTextarea = true; this.copyJson.emit(); },
      );
    } else {
      this.showFallbackTextarea = true;
      this.copyJson.emit();
    }
  }
}
