import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuotaBannerComponent } from './quota-banner.component';
import { expectNoSeriousA11yViolations } from './a11y-test-helpers';

describe('QuotaBannerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuotaBannerComponent],
    }).compileComponents();
  });

  function makeFixture(
    mode: 'warn' | 'block' | null,
    pct = 0,
    backupJson = '',
  ): ComponentFixture<QuotaBannerComponent> {
    const fixture = TestBed.createComponent(QuotaBannerComponent);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('pct', pct);
    fixture.componentRef.setInput('backupJson', backupJson);
    fixture.detectChanges();
    return fixture;
  }

  it('renders nothing when mode is null', () => {
    const fixture = makeFixture(null);
    expect(fixture.nativeElement.querySelector('.quota-banner')).toBeNull();
  });

  describe('warn mode (≥70%)', () => {
    it('renders the LOCKED warn title + body with role=status aria-live=polite', () => {
      const fixture = makeFixture('warn', 72);
      const section = fixture.nativeElement.querySelector('.quota-banner--warn') as HTMLElement;
      expect(section).toBeTruthy();
      expect(section.getAttribute('role')).toBe('status');
      expect(section.getAttribute('aria-live')).toBe('polite');

      const text = (section.textContent ?? '').trim();
      expect(text).toContain('Storage is filling up');
      expect(text).toContain("You've used about 72% of this app's local storage");
      expect(text).toContain('⚠');
    });

    it('emits (dismiss) when Dismiss is clicked', () => {
      const fixture = makeFixture('warn', 72);
      let count = 0;
      fixture.componentInstance.dismiss.subscribe(() => count++);
      const btn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(b => b.textContent?.trim() === 'Dismiss')!;
      btn.click();
      expect(count).toBe(1);
    });

    it('has no serious/critical a11y violations', async () => {
      const fixture = makeFixture('warn', 72);
      await expectNoSeriousA11yViolations(fixture.nativeElement);
    });
  });

  describe('block mode (≥95%)', () => {
    it('renders the LOCKED block title + body with role=alert aria-live=assertive', () => {
      const fixture = makeFixture('block', 97);
      const section = fixture.nativeElement.querySelector('.quota-banner--block') as HTMLElement;
      expect(section).toBeTruthy();
      expect(section.getAttribute('role')).toBe('alert');
      expect(section.getAttribute('aria-live')).toBe('assertive');

      const text = (section.textContent ?? '').trim();
      expect(text).toContain("Storage is full — new entries can't be saved");
      expect(text).toContain("You've used about 97% of local storage");
      expect(text).toContain('⛔');
    });

    it('exposes the Manage storage + Copy all data as JSON actions', () => {
      const fixture = makeFixture('block', 97);
      const labels = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .map(b => b.textContent?.trim());
      expect(labels).toContain('Manage storage');
      expect(labels).toContain('Copy all data as JSON');
    });

    it('emits (manageStorage) when Manage storage is clicked', () => {
      const fixture = makeFixture('block', 97);
      let count = 0;
      fixture.componentInstance.manageStorage.subscribe(() => count++);
      const btn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(b => b.textContent?.trim() === 'Manage storage')!;
      btn.click();
      expect(count).toBe(1);
    });

    it('invokes the clipboard copy path and emits (copyJson)', () => {
      const fixture = makeFixture('block', 97, '{"schemaVersion":6}');
      // Stub clipboard unavailable to force the deterministic synchronous emit.
      const originalNavigator = globalThis.navigator;
      Object.defineProperty(globalThis, 'navigator', {
        value: Object.assign({}, originalNavigator, { clipboard: undefined }),
        configurable: true,
      });
      try {
        let count = 0;
        fixture.componentInstance.copyJson.subscribe(() => count++);
        const btn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
          .find(b => b.textContent?.trim() === 'Copy all data as JSON')!;
        btn.click();
        expect(count).toBe(1);
        fixture.detectChanges();
        const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).toBeTruthy();
        expect(textarea.value).toBe('{"schemaVersion":6}');
      } finally {
        Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
      }
    });

    it('uses navigator.clipboard.writeText when available', () => {
      const fixture = makeFixture('block', 97, '{"schemaVersion":6}');
      const writeText = jasmine.createSpy('writeText').and.returnValue(Promise.resolve());
      const originalNavigator = globalThis.navigator;
      Object.defineProperty(globalThis, 'navigator', {
        value: Object.assign({}, originalNavigator, { clipboard: { writeText } }),
        configurable: true,
      });
      try {
        const btn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
          .find(b => b.textContent?.trim() === 'Copy all data as JSON')!;
        btn.click();
        expect(writeText).toHaveBeenCalledWith('{"schemaVersion":6}');
      } finally {
        Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
      }
    });

    it('has no serious/critical a11y violations', async () => {
      const fixture = makeFixture('block', 97, '{"schemaVersion":6}');
      await expectNoSeriousA11yViolations(fixture.nativeElement);
    });
  });
});
