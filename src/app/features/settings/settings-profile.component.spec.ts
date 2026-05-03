/**
 * Settings Profile sub-page spec — Plan 03-04 Task 3.
 *
 * Verifies:
 *   - Page h1 "Your profile" + subhead.
 *   - 4 textarea fields with verbatim labels and placeholders (Goals,
 *     Preferences, Dietary constraints, Training history).
 *   - Reactive form: 4 controls each with maxLength(4096).
 *   - patchValue from getProfile() populates the form.
 *   - 4097-char input flags maxlength validator + verbatim error copy.
 *   - Goals textarea receives focus after ngAfterViewInit.
 *   - onSave calls UserProfileService.saveProfile.
 *   - Save success / failure status messages match UI-SPEC.md verbatim.
 *   - Char counter visible when length > 0; hidden when empty.
 *   - Load failure renders <app-error-state>.
 *   - Severity-gated axe-core a11y (color-contrast deferred).
 */
import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SettingsProfileComponent } from './settings-profile.component';
import { UserProfileService } from '../../services/user-profile.service';
import { StorageService } from '../../services/storage.service';
import { DEFAULT_USER_PROFILE, UserProfile } from '../../models/user-profile.model';
import { expectNoSeriousA11yViolations } from '../../shared/a11y-test-helpers';

interface Spies {
  userProfile: jasmine.SpyObj<UserProfileService>;
  storage: jasmine.SpyObj<StorageService>;
}

function makeSpies(opts: {
  hasInitError?: boolean;
  profile?: UserProfile;
  saveError?: Error;
} = {}): Spies {
  const userProfile = jasmine.createSpyObj<UserProfileService>('UserProfileService', [
    'getProfile',
    'saveProfile',
  ]);
  userProfile.getProfile.and.returnValue(of(opts.profile ?? { ...DEFAULT_USER_PROFILE }));
  userProfile.saveProfile.and.returnValue(
    opts.saveError ? throwError(() => opts.saveError) : of(undefined),
  );

  const storage = jasmine.createSpyObj<StorageService>('StorageService', [
    'initialize',
  ]);
  storage.initialize.and.returnValue(
    opts.hasInitError ? throwError(() => new Error('init failed')) : of(undefined),
  );

  return { userProfile, storage };
}

async function configureBed(spies: Spies): Promise<ComponentFixture<SettingsProfileComponent>> {
  await TestBed.configureTestingModule({
    imports: [SettingsProfileComponent],
    providers: [
      { provide: UserProfileService, useValue: spies.userProfile },
      { provide: StorageService, useValue: spies.storage },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SettingsProfileComponent);
  fixture.detectChanges();
  return fixture;
}

describe('SettingsProfileComponent', () => {
  it('renders h1 "Your profile" + subhead', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);

    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('Your profile');

    const subhead = fixture.nativeElement.querySelector('.page-subhead');
    expect(subhead?.textContent?.trim()).toContain('These notes are sent to the AI');
  });

  it('renders 4 textarea fields with verbatim labels', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);

    const labels = Array.from(fixture.nativeElement.querySelectorAll('label')).map(
      (l) => (l as HTMLLabelElement).textContent?.trim(),
    );
    expect(labels).toContain('Goals');
    expect(labels).toContain('Preferences');
    expect(labels).toContain('Dietary constraints');
    expect(labels).toContain('Training history');

    const textareas = fixture.nativeElement.querySelectorAll('textarea');
    expect(textareas.length).toBe(4);
  });

  it('renders verbatim placeholders on each textarea', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);

    const goals = fixture.nativeElement.querySelector('#goals') as HTMLTextAreaElement;
    expect(goals.placeholder).toBe('e.g., lose 15 lbs by July, train for a 10K, hit 1 g protein per lb of bodyweight');

    const preferences = fixture.nativeElement.querySelector('#preferences') as HTMLTextAreaElement;
    expect(preferences.placeholder).toBe("e.g., I prefer running outdoors, I don't like long sessions on the bike, I train mornings before work");

    const dietary = fixture.nativeElement.querySelector('#dietaryConstraints') as HTMLTextAreaElement;
    expect(dietary.placeholder).toBe('e.g., strict low-carb, no seed oils, dairy-free, target 150 g protein per day');

    const training = fixture.nativeElement.querySelector('#trainingHistory') as HTMLTextAreaElement;
    expect(training.placeholder).toBe('e.g., 3 years of strength training, ran two half-marathons in 2024, currently in a fat-loss phase');
  });

  it('reactive form has 4 controls each with maxLength(4096) validator', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    const sections = ['goals', 'preferences', 'dietaryConstraints', 'trainingHistory'];
    for (const key of sections) {
      const ctrl = c.profileForm.get(key);
      expect(ctrl).withContext(`${key} control`).toBeTruthy();
      ctrl?.setValue('a'.repeat(4097));
      expect(ctrl?.errors?.['maxlength']).withContext(`${key} maxlength error at 4097`).toBeTruthy();
      ctrl?.setValue('a'.repeat(4096));
      expect(ctrl?.errors?.['maxlength']).withContext(`${key} no error at 4096`).toBeFalsy();
    }
  });

  it('patchValue from getProfile() populates the form', async () => {
    const profile: UserProfile = {
      goals: 'run a 10K',
      preferences: 'morning workouts',
      dietaryConstraints: 'no dairy',
      trainingHistory: '2 years lifting',
      updatedAt: '2026-05-01T00:00:00Z',
    };
    const spies = makeSpies({ profile });
    const fixture = await configureBed(spies);

    expect(fixture.componentInstance.profileForm.get('goals')?.value).toBe('run a 10K');
    expect(fixture.componentInstance.profileForm.get('preferences')?.value).toBe('morning workouts');
    expect(fixture.componentInstance.profileForm.get('dietaryConstraints')?.value).toBe('no dairy');
    expect(fixture.componentInstance.profileForm.get('trainingHistory')?.value).toBe('2 years lifting');
  });

  it('shows verbatim error copy for 4097-char input on Goals', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;

    c.profileForm.get('goals')?.setValue('a'.repeat(4097));
    c.profileForm.get('goals')?.markAsTouched();
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('#goals-error');
    expect(errorEl?.textContent?.trim()).toBe('This section can hold at most 4096 characters.');
  });

  it('Goals textarea receives focus after ngAfterViewInit', fakeAsync(async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);
    // ngAfterViewInit's setTimeout(...,0) is queued; flush it.
    tick(0);
    fixture.detectChanges();

    const goals = fixture.nativeElement.querySelector('#goals') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(goals);
  }));

  it('onSave calls userProfileService.saveProfile with current values', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);
    const c = fixture.componentInstance;
    c.profileForm.patchValue({
      goals: 'g',
      preferences: 'p',
      dietaryConstraints: 'd',
      trainingHistory: 't',
    });

    c.onSave();

    expect(spies.userProfile.saveProfile).toHaveBeenCalled();
    const arg = spies.userProfile.saveProfile.calls.mostRecent().args[0];
    expect(arg.goals).toBe('g');
    expect(arg.preferences).toBe('p');
    expect(arg.dietaryConstraints).toBe('d');
    expect(arg.trainingHistory).toBe('t');
    expect(typeof arg.updatedAt).toBe('string');
  });

  it('save success sets statusMessage = "Profile saved."', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);
    fixture.componentInstance.onSave();

    expect(fixture.componentInstance.statusMessage).toBe('Profile saved.');
    expect(fixture.componentInstance.statusIsError).toBeFalse();
  });

  it('save failure status starts with "Couldn\'t save profile."', async () => {
    const spies = makeSpies({ saveError: new Error('quota exceeded') });
    const fixture = await configureBed(spies);
    fixture.componentInstance.onSave();

    expect(fixture.componentInstance.statusMessage.startsWith("Couldn't save profile.")).toBeTrue();
    expect(fixture.componentInstance.statusMessage).toContain('quota exceeded');
    expect(fixture.componentInstance.statusIsError).toBeTrue();
  });

  it('renders <app-error-state> when storage.initialize() fails', async () => {
    const spies = makeSpies({ hasInitError: true });
    const fixture = await configureBed(spies);

    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
  });

  it('char counter shows {n} / 4096 characters when input non-empty; hidden when empty', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);

    // Initially empty: counter should not appear.
    expect(fixture.nativeElement.querySelector('#goals-counter')).toBeNull();

    fixture.componentInstance.profileForm.get('goals')?.setValue('hello');
    fixture.detectChanges();

    const counter = fixture.nativeElement.querySelector('#goals-counter');
    expect(counter?.textContent?.trim()).toBe('5 / 4096 characters');
  });

  it('passes axe-core severe a11y check (color-contrast deferred per Plan 01-08 D-13)', async () => {
    const spies = makeSpies();
    const fixture = await configureBed(spies);
    await expectNoSeriousA11yViolations(fixture.nativeElement, {
      disableRules: ['color-contrast'],
    });
  });
});
