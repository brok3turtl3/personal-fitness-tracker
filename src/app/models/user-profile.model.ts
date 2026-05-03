/**
 * Singleton free-form user profile (D-01..D-05).
 *
 * Four sectioned multi-line text fields the user writes themselves; the AI
 * reads them verbatim in the system prompt (wrapped in untrusted-data
 * delimiters per CHAT-11). No id/createdAt: this is a singleton, not a
 * collection entity. Empty defaults — when all four fields are empty, the
 * UserProfile section is omitted from the system prompt entirely (D-02).
 *
 * Per-section cap is enforced by `UserProfileService` (D-05): 4096 chars.
 */
export interface UserProfile {
  /** Free-form goals (e.g., "lose 15 lbs by July, train for a 10K"). Max 4096 chars. */
  goals: string;

  /** Free-form preferences (e.g., "prefer morning workouts, dislike running"). Max 4096 chars. */
  preferences: string;

  /** Free-form dietary constraints (e.g., "no dairy, low-FODMAP"). Max 4096 chars. */
  dietaryConstraints: string;

  /** Free-form training history (e.g., "2 years lifting, completed 1 half-marathon"). Max 4096 chars. */
  trainingHistory: string;

  /** ISO 8601 timestamp of last save (empty string before first save). */
  updatedAt: string;
}

/**
 * Default empty UserProfile — every section blank, updatedAt empty.
 * Used by `createEmptyAppData()` and the V4→V5 migration (D-02).
 */
export const DEFAULT_USER_PROFILE: UserProfile = {
  goals: '',
  preferences: '',
  dietaryConstraints: '',
  trainingHistory: '',
  updatedAt: '',
};
