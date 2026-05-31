import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * App-level multi-tab "data changed elsewhere" banner (QUAL-04).
 *
 * Neutral, INFORMATIONAL banner — NOT error-colored. The data being changed in
 * another window is a notification, not a failure, so it uses the neutral
 * surface (`#f8f9fa` / `#2c3e50` / `1px solid #ddd`) with a leading `🔄` glyph
 * rather than the amber/red of the quota banner.
 *
 * Raised by AppComponent's `window` `storage`-event listener when the incoming
 * event's `lastModified` differs from `StorageService.getLastModified()`
 * (Pitfall 6: the `storage` event only fires in OTHER tabs).
 *
 * Triple-encoding: icon (`🔄`) + explicit copy carry the meaning; color is
 * deliberately neutral (not a signal).
 *
 * `role="status"` `aria-live="polite"` — announces without stealing focus.
 */
@Component({
  selector: 'app-multi-tab-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="multi-tab-banner" role="status" aria-live="polite">
      <h2 class="multi-tab-banner__title">
        <span class="multi-tab-banner__icon" aria-hidden="true">🔄</span>
        Data changed in another window
      </h2>
      <p class="multi-tab-banner__body">
        This app is open in more than one place and the data changed elsewhere.
        Refresh to see the latest.
      </p>
      <div class="multi-tab-banner__actions">
        <button type="button" class="btn btn-secondary" (click)="refresh.emit()">
          Refresh
        </button>
        <button type="button" class="btn btn-secondary" (click)="dismiss.emit()">
          Dismiss
        </button>
      </div>
    </section>
  `,
  styles: [`
    .multi-tab-banner {
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      background: #f8f9fa;
      border: 1px solid #ddd;
      color: #2c3e50;
    }
    .multi-tab-banner__title {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      line-height: 1.2;
    }
    .multi-tab-banner__icon {
      margin-right: 0.25rem;
    }
    .multi-tab-banner__body {
      margin: 0 0 1rem;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    .multi-tab-banner__actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    /* Component-scoped button colors (QUAL-08): override the global
       .btn-secondary (#95a5a6, below AA on white) to an AA-clean dark-neutral
       so this new surface is contrast-clean. The global palette sweep is 05-09. */
    .multi-tab-banner__actions .btn {
      min-height: 44px;
      background-color: #2c3e50;
      color: #ffffff;
    }
    .multi-tab-banner__actions .btn:hover {
      background-color: #1f2d3a;
    }
    @media (max-width: 768px) {
      .multi-tab-banner__actions {
        flex-direction: column;
      }
    }
  `]
})
export class MultiTabBannerComponent {
  /**
   * Reload the active data. The host reloads via `window.location.reload()`
   * (least-surprising for a local single-page app — guarantees the in-memory
   * cache and every page's view re-read the now-changed LocalStorage), so this
   * component only signals intent.
   */
  @Output() refresh = new EventEmitter<void>();
  /** Dismiss without reloading. */
  @Output() dismiss = new EventEmitter<void>();
}
