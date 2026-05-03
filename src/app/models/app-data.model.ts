import { CardioSession } from './cardio-session.model';
import { WeightEntry } from './weight-entry.model';
import { HealthReading } from './health-reading.model';
import { MealEntry, SavedFood } from './diet.model';
import {
  AISettings,
  AIToolSettings,
  ChatConversation,
  DEFAULT_AI_TOOL_SETTINGS,
} from './ai-chat.model';
import { UserProfile, DEFAULT_USER_PROFILE } from './user-profile.model';

/**
 * Root container for all application data.
 * Stored as a single JSON object in LocalStorage.
 */
export interface AppData {
  /** Schema version for migration support. Current: 5 */
  schemaVersion: number;

  /** All cardio workout sessions */
  cardioSessions: CardioSession[];

  /** All weight measurements */
  weightEntries: WeightEntry[];

  /** All health readings (BP, glucose, ketones) */
  healthReadings: HealthReading[];

  /** Saved foods catalog (manual nutrition entries) */
  savedFoods: SavedFood[];

  /** Logged meal entries */
  mealEntries: MealEntry[];

  /** AI assistant settings (API key, model selection) */
  aiSettings?: AISettings;

  /** Chat conversations with AI assistant */
  chatConversations: ChatConversation[];

  /** Memory tool storage: paths under /memories/ → file content (Phase 3 V5). */
  memoryFiles: Record<string, string>;

  /** Free-form user profile sections fed into the system prompt (Phase 3 V5, D-01..D-05). */
  userProfile: UserProfile;

  /** AI tool flags + redaction toggles (Phase 3 V5, D-09). */
  aiToolSettings: AIToolSettings;

  /** ISO 8601 timestamp of last modification */
  lastModified: string;
}

/** Current schema version */
export const CURRENT_SCHEMA_VERSION = 5;

/** LocalStorage key for app data */
export const STORAGE_KEY = 'fitness_tracker_data';

/**
 * Creates an empty AppData object with default values.
 */
export function createEmptyAppData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    cardioSessions: [],
    weightEntries: [],
    healthReadings: [],
    savedFoods: [],
    mealEntries: [],
    chatConversations: [],
    memoryFiles: {},
    userProfile: { ...DEFAULT_USER_PROFILE },
    aiToolSettings: { ...DEFAULT_AI_TOOL_SETTINGS },
    lastModified: new Date().toISOString()
  };
}
