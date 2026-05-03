import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { StorageService } from './storage.service';
import { UserProfile, DEFAULT_USER_PROFILE } from '../models/user-profile.model';

/**
 * Service for managing the singleton free-form UserProfile (D-01..D-05).
 *
 * Mirrors `AISettingsService` shape exactly — Observable get/save with
 * per-section 4096-char validation. The AI sees the change on the next
 * message via `FitnessContextService.buildSystemPrompt`.
 *
 * Per-section cap is 4096 chars (D-05), enforced inclusive (4096 OK, 4097
 * rejected). Empty strings are valid (D-02).
 */
@Injectable({
  providedIn: 'root',
})
export class UserProfileService {
  // RED-phase stub: compiles so spec can fail with meaningful messages.
  // GREEN phase below replaces with full implementation.
  constructor(private storageService: StorageService) {}

  getProfile(): Observable<UserProfile> {
    return throwError(() => new Error('not implemented'));
  }

  saveProfile(_profile: UserProfile): Observable<void> {
    void this.storageService;
    void DEFAULT_USER_PROFILE;
    return throwError(() => new Error('not implemented'));
  }
}
