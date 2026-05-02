import { TestBed } from '@angular/core/testing';
import { RecoveryBannerComponent } from './recovery-banner.component';

describe('RecoveryBannerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecoveryBannerComponent],
    }).compileComponents();
  });

  function makeFixture() {
    const fixture = TestBed.createComponent(RecoveryBannerComponent);
    fixture.componentRef.setInput('recoveryKey', 'fitness_tracker_data.backup.v3.2026-05-02T14-30-12-123Z');
    fixture.componentRef.setInput('fromVersion', 3);
    fixture.componentRef.setInput('toVersion', 4);
    fixture.componentRef.setInput('backupJson', '{"schemaVersion":3}');
    fixture.detectChanges();
    return fixture;
  }

  it('should render via <app-error-state>', () => {
    const fixture = makeFixture();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
  });

  it('should render the recoveryKey, fromVersion, and toVersion in the message', () => {
    const fixture = makeFixture();
    const text = (fixture.nativeElement.textContent ?? '').trim();
    expect(text).toContain('fitness_tracker_data.backup.v3.2026-05-02T14-30-12-123Z');
    expect(text).toContain('v3');
    expect(text).toContain('v4');
  });

  it('should emit (retry) when "Retry migration" is clicked', () => {
    const fixture = makeFixture();
    let count = 0;
    fixture.componentInstance.retry.subscribe(() => count++);
    const btn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(b => b.textContent?.trim() === 'Retry migration')!;
    btn.click();
    expect(count).toBe(1);
  });

  it('should emit (continueEmpty) when "Continue with empty data" is clicked', () => {
    const fixture = makeFixture();
    let count = 0;
    fixture.componentInstance.continueEmpty.subscribe(() => count++);
    const btn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(b => b.textContent?.trim() === 'Continue with empty data')!;
    btn.click();
    expect(count).toBe(1);
  });

  it('should emit (copyBackup) when "Copy backup JSON to clipboard" is clicked', async () => {
    // Force the synchronous emit path by stubbing clipboard unavailable. This
    // makes the assertion deterministic regardless of whether the Karma+Chrome
    // env exposes a real clipboard (where writeText resolution timing varies).
    const fixture = makeFixture();
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: Object.assign({}, originalNavigator, { clipboard: undefined }),
      configurable: true,
    });

    try {
      let count = 0;
      fixture.componentInstance.copyBackup.subscribe(() => count++);
      const btn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(b => b.textContent?.trim() === 'Copy backup JSON to clipboard')!;
      btn.click();
      expect(count).toBe(1);
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
    }
  });

  it('should fall back to <textarea> when navigator.clipboard is undefined', () => {
    const fixture = makeFixture();
    const originalNavigator = globalThis.navigator;
    // Simulate clipboard-unavailable environment (Pitfall 5 shape).
    Object.defineProperty(globalThis, 'navigator', {
      value: Object.assign({}, originalNavigator, { clipboard: undefined }),
      configurable: true,
    });

    try {
      const btn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(b => b.textContent?.trim() === 'Copy backup JSON to clipboard')!;
      btn.click();
      fixture.detectChanges();
      const textarea = fixture.nativeElement.querySelector('textarea');
      expect(textarea).toBeTruthy();
      expect(textarea.value).toBe('{"schemaVersion":3}');
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
    }
  });
});
