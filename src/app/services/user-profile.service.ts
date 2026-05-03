import { Injectable } from '@angular/core';
import { Observable, map, switchMap, throwError } from 'rxjs';
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
  /** Per-section character cap (D-05). Inclusive: 4096 is OK, 4097 rejected. */
  private static readonly MAX_SECTION_CHARS = 4096;

  constructor(private storageService: StorageService) {}

  /**
   * Get the current UserProfile, or DEFAULT_USER_PROFILE if no AppData or
   * no userProfile field is persisted yet.
   */
  getProfile(): Observable<UserProfile> {
    return this.storageService.getData().pipe(
      map((data) => data?.userProfile ?? { ...DEFAULT_USER_PROFILE })
    );
  }

  /**
   * Persist the given profile. Validates per-section 4096-char cap before
   * writing. On success, sets `updatedAt` to a fresh ISO 8601 string.
   *
   * Errors:
   * - "{field} can hold at most 4096 characters." for each over-cap section.
   * - "Storage not initialized" if no AppData exists yet.
   * - Propagates StorageService.saveData errors.
   */
  saveProfile(profile: UserProfile): Observable<void> {
    const errors = this.validate(profile);
    if (errors.length > 0) {
      return throwError(() => new Error(errors.join('; ')));
    }

    return this.storageService.getData().pipe(
      switchMap((data) => {
        if (!data) {
          return throwError(() => new Error('Storage not initialized'));
        }
        return this.storageService.saveData({
          ...data,
          userProfile: { ...profile, updatedAt: new Date().toISOString() },
        });
      })
    );
  }

  private validate(profile: UserProfile): string[] {
    const errors: string[] = [];
    const sections: Array<keyof UserProfile> = [
      'goals',
      'preferences',
      'dietaryConstraints',
      'trainingHistory',
    ];
    for (const key of sections) {
      const v = profile[key];
      if (typeof v !== 'string') {
        errors.push(`${key} must be a string.`);
        continue;
      }
      if (v.length > UserProfileService.MAX_SECTION_CHARS) {
        errors.push(
          `${key} can hold at most ${UserProfileService.MAX_SECTION_CHARS} characters.`
        );
      }
    }
    return errors;
  }
}
