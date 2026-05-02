import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    }).compileComponents();
  });

  it('should render the required title', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('title', 'No meals yet');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state__title')?.textContent?.trim()).toBe('No meals yet');
  });

  it('should render the optional message when provided', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('title', 'No meals yet');
    fixture.componentRef.setInput('message', 'Add your first meal to start tracking.');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state__message')?.textContent?.trim())
      .toBe('Add your first meal to start tracking.');
  });

  it('should NOT render the message element when message input is absent', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('title', 'No meals yet');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state__message')).toBeNull();
  });

  it('should set role="status" and aria-live="polite" on the wrapper for a11y (D-09)', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('title', 'No meals yet');
    fixture.detectChanges();
    const wrapper = fixture.nativeElement.querySelector('.empty-state') as HTMLElement;
    expect(wrapper.getAttribute('role')).toBe('status');
    expect(wrapper.getAttribute('aria-live')).toBe('polite');
  });

  it('should project ng-content into the action slot', () => {
    // Use a host wrapper to project content (the only way to test ng-content)
    @Component({
      standalone: true,
      imports: [EmptyStateComponent],
      template: `<app-empty-state title="X"><button class="cta">Click me</button></app-empty-state>`,
    })
    class HostComponent {}

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const action = fixture.nativeElement.querySelector('.empty-state__action');
    expect(action?.querySelector('.cta')?.textContent?.trim()).toBe('Click me');
  });
});
