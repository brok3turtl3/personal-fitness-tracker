import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * "No data yet" surface for feature pages.
 *
 * Action is projected via `<ng-content>` so each page can supply its own
 * call-to-action ("Add your first meal", "Open recent foods", etc.) without
 * a [config] input — D-10 explicitly chose template flexibility over a
 * config object.
 *
 * A11y wrapper semantics fixed at `role="status"` + `aria-live="polite"`
 * (D-09) so screen-reader users get a non-interruptive cue when an empty
 * surface appears.
 *
 * Cross-app copy/spacing/labels polish is QUAL-09 in Phase 5.
 *
 * @example
 * <app-empty-state title="No meals yet" message="Add your first meal to start tracking.">
 *   <button type="button" (click)="openAddMeal()">Add a meal</button>
 * </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="empty-state" role="status" aria-live="polite">
      <h2 class="empty-state__title">{{ title }}</h2>
      @if (message) {
        <p class="empty-state__message">{{ message }}</p>
      }
      <div class="empty-state__action">
        <ng-content></ng-content>
      </div>
    </section>
  `,
  styles: [`
    .empty-state {
      padding: 2rem 1rem;
      text-align: center;
    }
    .empty-state__title {
      margin: 0 0 0.5rem;
    }
    .empty-state__message {
      margin: 0 0 1rem;
    }
    .empty-state__action {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
    }
  `]
})
export class EmptyStateComponent {
  /** Headline shown to the user. Required (D-10). */
  @Input({ required: true }) title!: string;

  /** Optional supporting copy under the headline. Omit to hide the element entirely. */
  @Input() message?: string;
}
