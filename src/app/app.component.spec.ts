import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { StorageError, StorageService } from './services/storage.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    const storageSpy = jasmine.createSpyObj('StorageService', ['initialize', 'getBackup']);
    storageSpy.initialize.and.returnValue(of(undefined));

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
    const storageSpy = jasmine.createSpyObj<StorageService>('StorageService', ['initialize', 'getBackup']);
    storageSpy.initialize.and.returnValue(throwError(() =>
      new StorageError(
        'Migration failed (v3 → v4). Backup at fitness_tracker_data.backup.v3.2026-05-02T14-30-12-123Z.',
        'MIGRATION_FAILED',
      )
    ));
    storageSpy.getBackup.and.returnValue('{"schemaVersion":3}');

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
    const storageSpy = jasmine.createSpyObj<StorageService>('StorageService', ['initialize', 'getBackup']);
    storageSpy.initialize.and.returnValue(of(undefined));

    configureWithStorage(storageSpy);

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-recovery-banner')).toBeNull();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should render <router-outlet> after Continue with empty is selected', () => {
    const storageSpy = jasmine.createSpyObj<StorageService>('StorageService', ['initialize', 'getBackup']);
    storageSpy.initialize.and.returnValue(throwError(() =>
      new StorageError(
        'Migration failed (v3 → v4). Backup at fitness_tracker_data.backup.v3.2026-05-02T14-30-12-123Z.',
        'MIGRATION_FAILED',
      )
    ));
    storageSpy.getBackup.and.returnValue('{"schemaVersion":3}');

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
