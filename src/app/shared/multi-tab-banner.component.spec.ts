import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MultiTabBannerComponent } from './multi-tab-banner.component';
import { expectNoSeriousA11yViolations } from './a11y-test-helpers';

describe('MultiTabBannerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiTabBannerComponent],
    }).compileComponents();
  });

  function makeFixture(): ComponentFixture<MultiTabBannerComponent> {
    const fixture = TestBed.createComponent(MultiTabBannerComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the LOCKED copy with role=status aria-live=polite', () => {
    const fixture = makeFixture();
    const section = fixture.nativeElement.querySelector('.multi-tab-banner') as HTMLElement;
    expect(section).toBeTruthy();
    expect(section.getAttribute('role')).toBe('status');
    expect(section.getAttribute('aria-live')).toBe('polite');

    const text = (section.textContent ?? '').trim();
    expect(text).toContain('Data changed in another window');
    expect(text).toContain('This app is open in more than one place and the data changed elsewhere. Refresh to see the latest.');
    expect(text).toContain('🔄');
  });

  it('uses the neutral (non-error) surface styling', () => {
    const fixture = makeFixture();
    const section = fixture.nativeElement.querySelector('.multi-tab-banner') as HTMLElement;
    const bg = getComputedStyle(section).backgroundColor;
    // Neutral #f8f9fa, NOT an amber/red error tint.
    expect(bg).toBe('rgb(248, 249, 250)');
  });

  it('exposes Refresh + Dismiss actions and emits them', () => {
    const fixture = makeFixture();
    let refreshCount = 0;
    let dismissCount = 0;
    fixture.componentInstance.refresh.subscribe(() => refreshCount++);
    fixture.componentInstance.dismiss.subscribe(() => dismissCount++);

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    const refresh = buttons.find(b => b.textContent?.trim() === 'Refresh')!;
    const dismiss = buttons.find(b => b.textContent?.trim() === 'Dismiss')!;
    refresh.click();
    dismiss.click();
    expect(refreshCount).toBe(1);
    expect(dismissCount).toBe(1);
  });

  it('has no serious/critical a11y violations', async () => {
    const fixture = makeFixture();
    await expectNoSeriousA11yViolations(fixture.nativeElement);
  });
});
