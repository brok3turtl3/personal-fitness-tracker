# Contract: StorageService

**Type**: Internal Service Interface
**Purpose**: Abstract storage operations to enable future backend migration

## Interface Definition

```typescript
import { Observable } from 'rxjs';

/**
 * Abstract storage service interface.
 * MVP: Implemented with LocalStorage
 * Future: Can be implemented with IndexedDB, HTTP API, etc.
 */
interface IStorageService {
  /**
   * Initialize storage, run migrations if needed
   * @returns Observable that completes when ready
   */
  initialize(): Observable<void>;

  /**
   * Get the current application data
   * @returns Observable with AppData or null if not found
   */
  getData(): Observable<AppData | null>;

  /**
   * Save the entire application data
   * @param data - The AppData to persist
   * @returns Observable that completes on success, errors on failure
   */
  saveData(data: AppData): Observable<void>;

  /**
   * Clear all stored data
   * @returns Observable that completes on success
   */
  clearData(): Observable<void>;

  /**
   * Get storage usage info
   * @returns Observable with usage statistics
   */
  getStorageInfo(): Observable<StorageInfo>;
}

interface StorageInfo {
  usedBytes: number;
  availableBytes: number;
  percentUsed: number;
}
```

## Behaviors

### initialize()

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| First run (no data) | N/A | Emits void, storage ready |
| Existing data (current version) | N/A | Emits void, no migration |
| Existing data (old version) | N/A | Runs migration, emits void |
| Corrupted data | N/A | Errors with StorageError |

### getData()

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| Data exists | N/A | Emits AppData |
| No data | N/A | Emits null |
| Parse error | N/A | Errors with StorageError |

### saveData(data)

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| Valid data | AppData | Emits void |
| Storage full | AppData | Errors with QuotaExceededError |
| Invalid data | Non-serializable | Errors with StorageError |

### clearData()

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| Any state | N/A | Emits void, data cleared |

## Error Types

```typescript
class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

type StorageErrorCode = 
  | 'QUOTA_EXCEEDED'
  | 'PARSE_ERROR'
  | 'SERIALIZATION_ERROR'
  | 'NOT_AVAILABLE'
  | 'MIGRATION_FAILED';
```

## LocalStorage Implementation Notes

- Storage key: `fitness_tracker_data`
- Data format: JSON stringified AppData
- Synchronous operations wrapped in Observable for consistency
- Check `navigator.storage?.estimate()` for quota info (where available)
