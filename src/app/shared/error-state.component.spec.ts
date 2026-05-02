import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ErrorStateComponent } from './error-state.component';
import { StorageError, StorageErrorCode } from '../services/storage.service';

describe('ErrorStateComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorStateComponent],
    }).compileComponents();
  });

  const codeToFriendly: Array<[StorageErrorCode, string]> = [
    ['PARSE_ERROR',         "Stored data couldn't be read."],
    ['QUOTA_EXCEEDED',      'Browser storage is full.'],
    ['NOT_AVAILABLE',       'Browser storage is unavailable.'],
    ['SERIALIZATION_ERROR', 'Could not serialize data for storage.'],
    ['MIGRATION_FAILED',    'Stored data could not be upgraded to the current version.'],
  ];

  for (const [code, expected] of codeToFriendly) {
    it(`should map StorageError code "${code}" to friendly copy`, () => {
      const fixture = TestBed.createComponent(ErrorStateComponent);
      fixture.componentRef.setInput('title', 'Could not load');
      fixture.componentRef.setInput('error', new StorageError('boom', code));
      fixture.detectChanges();
      const msg = fixture.nativeElement.querySelector('.error-state__message')?.textContent?.trim();
      expect(msg).toBe(expected);
    });
  }

  it('should fall back to "Something went wrong." for non-StorageError', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput('title', 'Oops');
    fixture.componentRef.setInput('error', new Error('arbitrary'));
    fixture.detectChanges();
    const msg = fixture.nativeElement.querySelector('.error-state__message')?.textContent?.trim();
    expect(msg).toBe('Something went wrong.');
  });

  it('should let an explicit [message] input override the friendlyMessage switch', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput('title', 'Could not load');
    fixture.componentRef.setInput('message', 'Custom override copy');
    fixture.componentRef.setInput('error', new StorageError('boom', 'PARSE_ERROR'));
    fixture.detectChanges();
    const msg = fixture.nativeElement.querySelector('.error-state__message')?.textContent?.trim();
    expect(msg).toBe('Custom override copy');
  });

  it('should render <details> collapsed by default (D-11)', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput('title', 'Failed');
    fixture.componentRef.setInput('error', new StorageError('boom', 'PARSE_ERROR'));
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
  });

  it('should set role="alert" and aria-live="assertive" on the wrapper', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput('title', 'Failed');
    fixture.detectChanges();
    const wrapper = fixture.nativeElement.querySelector('.error-state') as HTMLElement;
    expect(wrapper.getAttribute('role')).toBe('alert');
    expect(wrapper.getAttribute('aria-live')).toBe('assertive');
  });

  it('should NOT render a Retry button when (retry) is not observed', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput('title', 'Failed');
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.error-state__actions button');
    expect(btn).toBeNull();
  });

  it('should render and emit (retry) when a parent subscribes via host wrapper', () => {
    @Component({
      standalone: true,
      imports: [ErrorStateComponent],
      template: `<app-error-state title="Failed" (retry)="onRetry()"></app-error-state>`,
    })
    class HostComponent {
      retried = 0;
      onRetry() { this.retried++; }
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.error-state__actions button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.retried).toBe(1);
  });
});
