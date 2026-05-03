/**
 * Settings shell spec — side-rail nav + RouterOutlet + a11y.
 *
 * Per Plan 03-04 Task 1 + 03-UI-SPEC.md "Component Inventory" + "Accessibility
 * Contract". Severity gate: serious|critical, color-contrast deferred per
 * Plan 01-08 D-13.
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SettingsShellComponent } from './settings-shell.component';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

describe('SettingsShellComponent', () => {
  let fixture: ComponentFixture<SettingsShellComponent>;
  let component: SettingsShellComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsShellComponent],
      providers: [
        provideRouter([
          {
            path: 'settings',
            component: SettingsShellComponent,
            children: [
              { path: '', redirectTo: 'ai', pathMatch: 'full' },
              { path: 'ai', component: SettingsShellComponent },
              { path: 'profile', component: SettingsShellComponent },
              { path: 'memory', component: SettingsShellComponent },
            ],
          },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders 3 nav links with verbatim labels: AI, Profile, Memory', () => {
    const links = fixture.nativeElement.querySelectorAll('.settings-rail-list a');
    expect(links.length).toBe(3);
    const labels = Array.from(links).map((a) => (a as HTMLAnchorElement).textContent?.trim());
    expect(labels).toEqual(['AI', 'Profile', 'Memory']);
  });

  it('side-rail has role="complementary" with visually-hidden h2 "Settings sections"', () => {
    const aside = fixture.nativeElement.querySelector('aside.settings-rail');
    expect(aside).toBeTruthy();
    expect(aside.getAttribute('role')).toBe('complementary');

    const heading = fixture.nativeElement.querySelector('#settings-rail-heading');
    expect(heading).toBeTruthy();
    expect(heading.textContent?.trim()).toBe('Settings sections');
    expect(heading.classList.contains('visually-hidden')).toBeTrue();
    expect(aside.getAttribute('aria-labelledby')).toBe('settings-rail-heading');
  });

  it('router-outlet exists in the main column', () => {
    const main = fixture.nativeElement.querySelector('main.settings-main');
    expect(main).toBeTruthy();
    const outlet = main.querySelector('router-outlet');
    expect(outlet).toBeTruthy();
  });

  it('links carry routerLinkActive directive (active class wired)', () => {
    const links = fixture.nativeElement.querySelectorAll('.settings-rail-list a');
    // routerLinkActive applies the "active" class when the link's URL matches.
    // Without navigation, no link is active — but the directive is configured.
    // We verify presence of the routerLink href on each anchor.
    const hrefs = Array.from(links).map((a) => (a as HTMLAnchorElement).getAttribute('href'));
    expect(hrefs).toEqual([
      jasmine.stringMatching(/\/settings\/ai$/),
      jasmine.stringMatching(/\/settings\/profile$/),
      jasmine.stringMatching(/\/settings\/memory$/),
    ]);
  });

  it('aria-current is null on inactive links and "page" on the active one after navigation', async () => {
    const router = TestBed.inject(Router);
    await router.navigate(['/settings/ai']);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('.settings-rail-list a');
    const aiLink = links[0] as HTMLAnchorElement;
    const profileLink = links[1] as HTMLAnchorElement;
    const memoryLink = links[2] as HTMLAnchorElement;

    expect(aiLink.getAttribute('aria-current')).toBe('page');
    expect(profileLink.getAttribute('aria-current')).toBeNull();
    expect(memoryLink.getAttribute('aria-current')).toBeNull();
  });

  it('each link has a routerLinkActive="active" hook (active class applied to the matching link)', async () => {
    const router = TestBed.inject(Router);
    await router.navigate(['/settings/profile']);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('.settings-rail-list a');
    const aiLink = links[0] as HTMLAnchorElement;
    const profileLink = links[1] as HTMLAnchorElement;

    expect(profileLink.classList.contains('active')).toBeTrue();
    expect(aiLink.classList.contains('active')).toBeFalse();
  });

  it('passes axe-core severe a11y check (color-contrast deferred per Plan 01-08 D-13)', async () => {
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});
