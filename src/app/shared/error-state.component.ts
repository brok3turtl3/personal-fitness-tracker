import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageError } from '../services/storage.service';

/**
 * "Operation failed" surface for feature pages.
 *
 * Renders a friendly headline + message + optional collapsed `<details>` with
 * raw error text (D-11: power-user inspection without leaking ugly default copy
 * in the visible UI).
 *
 * `friendlyMessage()` maps each `StorageError.code` to specific copy:
 *   - `PARSE_ERROR`         → "Stored data couldn't be read."
 *   - `QUOTA_EXCEEDED`      → "Browser storage is full."
 *   - `NOT_AVAILABLE`       → "Browser storage is unavailable."
 *   - `SERIALIZATION_ERROR` → "Could not serialize data for storage."
 *   - `MIGRATION_FAILED`    → "Stored data could not be upgraded to the current version."
 *
 * Non-`StorageError` inputs (or `StorageError` with an unknown code added in a
 * future schema change) fall back to "Something went wrong." rather than
 * crashing — a deliberate trade-off so the UI stays robust if `StorageErrorCode`
 * is extended without updating this switch.
 *
 * `(retry)` is conditionally rendered via `retry.observed` so pages that don't
 * wire up retry don't get a dead button. Additional actions go through
 * `<ng-content>` (D-10) so each page can supply context-specific CTAs.
 *
 * A11y wrapper is `role="alert"` + `aria-live="assertive"` (D-09) — error
 * severity outranks empty-state, so screen readers announce immediately.
 *
 * @example
 * <app-error-state
 *   title="Could not load meals"
 *   [error]="loadError"
 *   (retry)="reload()"
 * ></app-error-state>
 */
@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="error-state" role="alert" aria-live="assertive">
      <h2 class="error-state__title">{{ title }}</h2>
      @if (friendlyMessage()) {
        <p class="error-state__message">{{ friendlyMessage() }}</p>
      }
      @if (rawErrorText()) {
        <details class="error-state__details">
          <summary>Technical details</summary>
          <pre>{{ rawErrorText() }}</pre>
        </details>
      }
      <div class="error-state__actions">
        <ng-content></ng-content>
        @if (retry.observed) {
          <button type="button" class="btn btn-secondary" (click)="retry.emit()">Retry</button>
        }
      </div>
    </section>
  `,
  styles: [`
    .error-state {
      padding: 1.5rem 1rem;
      border: 1px solid #c33;
      background: #fff5f5;
      border-radius: 4px;
    }
    .error-state__title {
      margin: 0 0 0.5rem;
      color: #c33;
    }
    .error-state__message {
      margin: 0 0 0.75rem;
    }
    .error-state__details {
      margin: 0 0 1rem;
    }
    .error-state__details pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 0.85em;
    }
    .error-state__actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
  `]
})
export class ErrorStateComponent {
  /** Headline shown to the user. Required (D-10). */
  @Input({ required: true }) title!: string;

  /** Optional message override. When provided, wins over the friendlyMessage() switch. */
  @Input() message?: string;

  /** The underlying error. `StorageError.code` drives friendlyMessage; raw text rendered in collapsed <details>. */
  @Input() error?: Error | string;

  /** Emitted when the user clicks the Retry button. Button is only rendered when this output is observed. */
  @Output() retry = new EventEmitter<void>();

  /**
   * User-facing message. Explicit `[message]` input takes precedence; otherwise
   * map known StorageError codes to specific copy; otherwise fall back to a
   * generic message. The fallback also covers any future StorageErrorCode that
   * is added without a case here — fail soft, not crash.
   */
  friendlyMessage(): string {
    if (this.message) return this.message;
    if (this.error instanceof StorageError) {
      switch (this.error.code) {
        case 'PARSE_ERROR':         return "Stored data couldn't be read.";
        case 'QUOTA_EXCEEDED':      return 'Browser storage is full.';
        case 'NOT_AVAILABLE':       return 'Browser storage is unavailable.';
        case 'SERIALIZATION_ERROR': return 'Could not serialize data for storage.';
        case 'MIGRATION_FAILED':    return 'Stored data could not be upgraded to the current version.';
      }
    }
    return 'Something went wrong.';
  }

  /**
   * Raw error text rendered inside the collapsed `<details>` element. Returns
   * empty string when no error is supplied so the `<details>` block is omitted
   * entirely.
   */
  rawErrorText(): string {
    if (!this.error) return '';
    if (typeof this.error === 'string') return this.error;
    return this.error.stack ?? this.error.message;
  }
}
