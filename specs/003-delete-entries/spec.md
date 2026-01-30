# Feature Specification: Delete Entries

**Feature Branch**: `003-delete-entries`
**Created**: 2026-01-30
**Status**: Draft
**Input**: User description: "Add the ability to delete entries from any of the three tabs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete Cardio Sessions (Priority: P1)

As a fitness tracker user, I want to delete a cardio session so that I can remove mistakes or duplicates.

**Independent Test**: Navigate to `/cardio`, add a session, delete it from the history list, and confirm it disappears and stays deleted after refresh.

**Acceptance Scenarios**:

1. **Given** I am on `/cardio` with at least one session, **When** I click Delete and confirm, **Then** the session is removed from the history list.
2. **Given** I delete a session, **When** I refresh the page, **Then** the deleted session remains deleted.
3. **Given** I click Delete, **When** I cancel the confirmation, **Then** no session is deleted.

---

### User Story 2 - Delete Weight Entries (Priority: P1)

As a fitness tracker user, I want to delete a weight entry so that I can remove mistakes.

**Independent Test**: Navigate to `/weight`, add an entry, delete it from the history list, and confirm it disappears and stays deleted after refresh.

---

### User Story 3 - Delete Health Readings (Priority: P1)

As a fitness tracker user, I want to delete a health reading so that I can remove incorrect readings.

**Independent Test**: Navigate to `/readings`, add a reading, delete it from the history list, and confirm it disappears and stays deleted after refresh.

---

### Edge Cases

- Deleting an ID that no longer exists should not crash the app.
- Deletion must be persistent (LocalStorage) and should update `lastModified`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-301**: System MUST allow deleting cardio sessions from `/cardio` history.
- **FR-302**: System MUST allow deleting weight entries from `/weight` history.
- **FR-303**: System MUST allow deleting health readings from `/readings` history.
- **FR-304**: System MUST prompt the user for confirmation before deleting.
- **FR-305**: System MUST persist deletions via LocalStorage.
- **FR-306**: System MUST remain compatible with existing stored data (no schema migration required).

### UX/Accessibility Requirements

- Delete buttons MUST be keyboard accessible.
- Delete buttons MUST have descriptive `aria-label`s (include item type/value where possible).

## Success Criteria *(mandatory)*

- **SC-301**: Each page can delete an item and the list refreshes immediately.
- **SC-302**: Deleted items stay deleted after refresh.
- **SC-303**: Unit tests cover delete behavior for each domain service.

## Out of Scope

- Undo/restore
- Bulk delete
- Soft deletes or archive view
