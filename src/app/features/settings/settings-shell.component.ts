import { Component, DestroyRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Parent shell for `/settings/*` sub-routes (Plan 03-04 + 03-CONTEXT.md D-06, D-07).
 *
 * Renders a side-rail nav (≥ 768px) / horizontal tab strip (< 768px) and a
 * `<router-outlet>` for the three child sub-pages: AI, Profile, Memory.
 *
 * `aria-current="page"` is bound off `routerLinkActive`'s `isActive` state via
 * template references — preferred over a static class because the value is
 * `null` on inactive links (cleaner DOM than `aria-current="false"`).
 *
 * No business logic — purely presentational layout + nav. Subscriptions teardown
 * uses Pattern 2 Form A (`destroyRef = inject(DestroyRef)`) for parity with the
 * rest of the codebase even though this component declares no subscriptions
 * today.
 */
@Component({
  selector: 'app-settings-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="settings-shell">
      <aside class="settings-rail" role="complementary" aria-labelledby="settings-rail-heading">
        <h2 id="settings-rail-heading" class="visually-hidden">Settings sections</h2>
        <ul class="settings-rail-list">
          <li>
            <a
              routerLink="/settings/ai"
              routerLinkActive="active"
              [attr.aria-current]="rlaAi.isActive ? 'page' : null"
              #rlaAi="routerLinkActive"
            >AI</a>
          </li>
          <li>
            <a
              routerLink="/settings/profile"
              routerLinkActive="active"
              [attr.aria-current]="rlaProfile.isActive ? 'page' : null"
              #rlaProfile="routerLinkActive"
            >Profile</a>
          </li>
          <li>
            <a
              routerLink="/settings/memory"
              routerLinkActive="active"
              [attr.aria-current]="rlaMemory.isActive ? 'page' : null"
              #rlaMemory="routerLinkActive"
            >Memory</a>
          </li>
        </ul>
      </aside>
      <main class="settings-main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .settings-shell {
      display: flex;
      gap: 2rem;
    }

    .settings-rail {
      width: 200px;
      min-width: 200px;
      padding: 1.5rem 1rem;
      background: #ecf0f1;
    }

    .settings-rail-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .settings-rail-list a {
      display: block;
      padding: 0.5rem 0.75rem;
      color: #2c3e50;
      text-decoration: none;
      border-radius: 4px;
    }

    .settings-rail-list a:hover {
      background: #dfe6e9;
    }

    .settings-rail-list a.active {
      background: #3498db;
      color: #fff;
    }

    .settings-main {
      flex: 1;
      min-width: 0;
    }

    .visually-hidden {
      position: absolute;
      clip: rect(0 0 0 0);
      width: 1px;
      height: 1px;
      overflow: hidden;
    }

    @media (max-width: 768px) {
      .settings-shell {
        flex-direction: column;
        gap: 0.5rem;
      }
      .settings-rail {
        width: 100%;
        padding: 0.5rem;
      }
      .settings-rail-list {
        flex-direction: row;
        gap: 0.5rem;
      }
    }
  `],
})
export class SettingsShellComponent {
  private destroyRef = inject(DestroyRef);
  // No active subscriptions today; destroyRef declared to keep Pattern 2
  // Form A consistent with the rest of the codebase.
}
