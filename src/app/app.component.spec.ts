import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { StorageError, StorageService, StorageInfo } from './services/storage.service';
import { STORAGE_KEY } from './models/app-data.model';

describe('AppComponent', () => {
  beforeEach(async () => {
    const storageSpy = jasmine.createSpyObj('StorageService', [
      'initialize', 'getBackup', 'getStorageInfo', 'getLastModified',
    ]);
    storageSpy.initialize.and.returnValue(of(undefined));
    storageSpy.getStorageInfo.and.returnValue(of({ usedBytes: 0, availableBytes: 1, percentUsed: 0, usagePct: 0 } as StorageInfo));
    storageSpy.getLastModified.and.returnValue('2026-05-31T00:00:00.000Z');

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: StorageService, useValue: storageSpy },
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'Personal Fitness Tracker' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Personal Fitness Tracker');
  });

  it('should render the nav component', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-nav')).toBeTruthy();
  });
});

describe('AppComponent recovery banner (FOUND-07 / D-15)', () => {
  function configureWithStorage(spy: jasmine.SpyObj<StorageService>): void {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: StorageService, useValue: spy },
      ],
    });
  }

  it('should render <app-recovery-banner> when StorageService.initialize rejects with MIGRATION_FAILED', () => {
    const storageSpy = jasmine.createSpyObj<StorageService>('StorageService', ['initialize', 'getBackup', 'getStorageInfo', 'getLastModified']);
    storageSpy.initialize.and.returnValue(throwError(() =>
      new StorageError(
        'Migration failed (v3 → v4). Backup at fitness_tracker_data.backup.v3.2026-05-02T14-30-12-123Z.',
        'MIGRATION_FAILED',
      )
    ));
    storageSpy.getBackup.and.returnValue('{"schemaVersion":3}');
    storageSpy.getStorageInfo.and.returnValue(of({ usedBytes: 0, availableBytes: 1, percentUsed: 0, usagePct: 0 } as StorageInfo));
    storageSpy.getLastModified.and.returnValue(null);

    configureWithStorage(storageSpy);

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-recovery-banner')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeNull();
    // Verify AppComponent went through the chokepoint, not localStorage directly.
    expect(storageSpy.getBackup).toHaveBeenCalledWith(
      'fitness_tracker_data.backup.v3.2026-05-02T14-30-12-123Z'
    );
  });

  it('should render <router-outlet> on successful initialize', () => {
    const storageSpy = jasmine.createSpyObj<StorageService>('StorageService', ['initialize', 'getBackup', 'getStorageInfo', 'getLastModified']);
    storageSpy.initialize.and.returnValue(of(undefined));
    storageSpy.getStorageInfo.and.returnValue(of({ usedBytes: 0, availableBytes: 1, percentUsed: 0, usagePct: 0 } as StorageInfo));
    storageSpy.getLastModified.and.returnValue(null);

    configureWithStorage(storageSpy);

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-recovery-banner')).toBeNull();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should render <router-outlet> after Continue with empty is selected', () => {
    const storageSpy = jasmine.createSpyObj<StorageService>('StorageService', ['initialize', 'getBackup', 'getStorageInfo', 'getLastModified']);
    storageSpy.initialize.and.returnValue(throwError(() =>
      new StorageError(
        'Migration failed (v3 → v4). Backup at fitness_tracker_data.backup.v3.2026-05-02T14-30-12-123Z.',
        'MIGRATION_FAILED',
      )
    ));
    storageSpy.getBackup.and.returnValue('{"schemaVersion":3}');
    storageSpy.getStorageInfo.and.returnValue(of({ usedBytes: 0, availableBytes: 1, percentUsed: 0, usagePct: 0 } as StorageInfo));
    storageSpy.getLastModified.and.returnValue(null);

    configureWithStorage(storageSpy);

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    // Banner visible.
    expect(fixture.nativeElement.querySelector('app-recovery-banner')).toBeTruthy();

    // Simulate Continue empty.
    fixture.componentInstance.onContinueEmpty();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-recovery-banner')).toBeNull();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});

describe('AppComponent quota banner (QUAL-02 / D-14)', () => {
  function configure(spy: jasmine.SpyObj<StorageService>): void {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: StorageService, useValue: spy },
      ],
    });
  }

  function makeSpy(usagePct: number): jasmine.SpyObj<StorageService> {
    const spy = jasmine.createSpyObj<StorageService>('StorageService', ['initialize', 'getBackup', 'getStorageInfo', 'getLastModified']);
    spy.initialize.and.returnValue(of(undefined));
    spy.getStorageInfo.and.returnValue(of({ usedBytes: 0, availableBytes: 1, percentUsed: usagePct, usagePct } as StorageInfo));
    spy.getLastModified.and.returnValue('2026-05-31T00:00:00.000Z');
    spy.getBackup.and.returnValue('{"schemaVersion":6}');
    return spy;
  }

  it('shows the warn banner at usagePct ≥70 (and <95)', () => {
    configure(makeSpy(72));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.quotaMode).toBe('warn');
    const banner = fixture.nativeElement.querySelector('app-quota-banner');
    expect(banner).toBeTruthy();
    expect((banner.textContent ?? '')).toContain('Storage is filling up');
  });

  it('shows the block banner at usagePct ≥95 and reads all-data JSON via the chokepoint', () => {
    const spy = makeSpy(96);
    configure(spy);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.quotaMode).toBe('block');
    expect(spy.getBackup).toHaveBeenCalledWith(STORAGE_KEY);
    const banner = fixture.nativeElement.querySelector('app-quota-banner');
    expect((banner.textContent ?? '')).toContain("Storage is full");
  });

  it('shows no quota banner below 70%', () => {
    configure(makeSpy(40));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.quotaMode).toBeNull();
    expect(fixture.nativeElement.querySelector('app-quota-banner')).toBeNull();
  });

  it('dismisses the warn banner and does not re-show it at the same usage', () => {
    configure(makeSpy(72));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    fixture.componentInstance.onQuotaDismiss();
    fixture.detectChanges();
    expect(fixture.componentInstance.quotaMode).toBeNull();
    // Re-reading at the same usage keeps it dismissed.
    fixture.componentInstance.refreshQuotaBanner();
    fixture.detectChanges();
    expect(fixture.componentInstance.quotaMode).toBeNull();
  });

  it('does not steal focus when a quota banner renders', () => {
    configure(makeSpy(96));
    const fixture = TestBed.createComponent(AppComponent);
    const focusSpy = spyOn(HTMLElement.prototype, 'focus').and.callThrough();
    fixture.detectChanges();
    expect(focusSpy).not.toHaveBeenCalled();
  });
});

describe('AppComponent multi-tab banner (QUAL-04 / Pitfall 6)', () => {
  function configure(spy: jasmine.SpyObj<StorageService>): void {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: StorageService, useValue: spy },
      ],
    });
  }

  function makeSpy(lastModified: string | null): jasmine.SpyObj<StorageService> {
    const spy = jasmine.createSpyObj<StorageService>('StorageService', ['initialize', 'getBackup', 'getStorageInfo', 'getLastModified']);
    spy.initialize.and.returnValue(of(undefined));
    spy.getStorageInfo.and.returnValue(of({ usedBytes: 0, availableBytes: 1, percentUsed: 0, usagePct: 0 } as StorageInfo));
    spy.getLastModified.and.returnValue(lastModified);
    return spy;
  }

  function dispatchStorageEvent(key: string | null, newValue: string | null): void {
    // Pitfall 6: the real `storage` event only fires in OTHER tabs, so the spec
    // synthesizes one. StorageEvent's init dict carries key/newValue.
    window.dispatchEvent(new StorageEvent('storage', { key: key ?? undefined, newValue }));
  }

  it('shows the multi-tab banner on a synthetic StorageEvent with a DIFFERING lastModified', () => {
    configure(makeSpy('2026-05-31T00:00:00.000Z'));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    dispatchStorageEvent(STORAGE_KEY, JSON.stringify({ lastModified: '2026-05-31T12:00:00.000Z' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.showMultiTabBanner).toBeTrue();
    expect(fixture.nativeElement.querySelector('app-multi-tab-banner')).toBeTruthy();
  });

  it('does NOT show the banner when the incoming lastModified MATCHES (no false positive)', () => {
    configure(makeSpy('2026-05-31T00:00:00.000Z'));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    dispatchStorageEvent(STORAGE_KEY, JSON.stringify({ lastModified: '2026-05-31T00:00:00.000Z' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.showMultiTabBanner).toBeFalse();
    expect(fixture.nativeElement.querySelector('app-multi-tab-banner')).toBeNull();
  });

  it('ignores StorageEvents for unrelated keys', () => {
    configure(makeSpy('2026-05-31T00:00:00.000Z'));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    dispatchStorageEvent('some_other_key', JSON.stringify({ lastModified: '2026-05-31T12:00:00.000Z' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.showMultiTabBanner).toBeFalse();
  });

  it('ignores a malformed payload without throwing', () => {
    configure(makeSpy('2026-05-31T00:00:00.000Z'));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(() => dispatchStorageEvent(STORAGE_KEY, 'not-json')).not.toThrow();
    fixture.detectChanges();
    expect(fixture.componentInstance.showMultiTabBanner).toBeFalse();
  });

  it('does not steal focus when the multi-tab banner renders', () => {
    configure(makeSpy('2026-05-31T00:00:00.000Z'));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const focusSpy = spyOn(HTMLElement.prototype, 'focus').and.callThrough();
    dispatchStorageEvent(STORAGE_KEY, JSON.stringify({ lastModified: '2026-05-31T12:00:00.000Z' }));
    fixture.detectChanges();
    expect(focusSpy).not.toHaveBeenCalled();
  });
});
