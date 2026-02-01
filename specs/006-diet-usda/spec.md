# Feature Specification: Diet Logging (Manual Food Library)

**Feature Branch**: `006-diet-usda`
**Created**: 2026-01-31
**Status**: Draft
**Input**: Track diet and calories by logging meals and computing per-meal and per-day nutrition totals. Users manually create foods with nutrition per unit (per 1 g or per 1 tbsp). Support fiber/sugar/sodium and net carbs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Foods To Local Library and Reuse Them (Priority: P1)

As a user, I want to add foods to my local library (nutrition per base unit) so I can reuse them when logging meals.

**Independent Test**: Navigate to `/diet`, add a food, then add it to a meal.

**Acceptance Scenarios**:

1. **Given** I am on `/diet`, **When** I add a new food with nutrition per unit (per 1 g or per 1 tbsp), **Then** it appears in my Saved Foods list.
2. **Given** I have saved a food, **When** I add it to a meal later, **Then** it loads instantly from local storage.

---

### User Story 2 - Log Meals With Items and Serving Sizes (Priority: P1)

As a user, I want to log a meal by selecting saved foods and serving sizes so I can track calories and macros.

**Independent Test**: Create a meal with multiple items (with different servings/quantities) and verify computed totals.

**Acceptance Scenarios**:

1. **Given** I am on `/diet`, **When** I add a meal and add one or more food items to it, **Then** the meal is saved and appears in the day’s meal list.
2. **Given** I select a different serving size or quantity, **When** I save the meal, **Then** nutrition values scale accordingly.
3. **Given** a saved food has custom serving presets (e.g. “my scoop”), **When** I choose it, **Then** the grams mapping is used to compute nutrients.

---

### User Story 5 - Edit and Delete Meals (Priority: P1)

As a user, I want to edit or delete previously logged meals so I can fix mistakes.

**Acceptance Scenarios**:

1. **Given** I have a logged meal, **When** I click Edit and save changes, **Then** the meal updates in the list.
2. **Given** I have a logged meal, **When** I click Delete and confirm, **Then** the meal is removed and daily totals update.

---

### User Story 3 - View Daily Totals and Keto-Relevant Metrics (Priority: P1)

As a user, I want daily totals and net carb calculations so I can stay within keto targets and monitor sugar/sodium.

**Independent Test**: Log multiple meals in a day and verify daily totals (including net carbs).

**Acceptance Scenarios**:

1. **Given** I have meals logged for a day, **When** I view `/diet`, **Then** I see per-day totals for calories, protein, fat, carbs, fiber, sugar, sodium.
2. **Given** totals are displayed, **Then** net carbs are shown as `max(0, carbs - fiber)`.
3. **Given** I have no meals in the selected day, **Then** the page shows a friendly empty-state.

---

### User Story 4 - Snapshot Nutrition At Log Time (Priority: P1)

As a user, I want logged meals to preserve their nutrition values even if I later change food presets.

**Acceptance Scenarios**:

1. **Given** I log a meal item and it stores a nutrient snapshot, **When** I later edit the saved food’s serving presets, **Then** the previously logged meal’s nutrition remains unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-601**: App MUST add a `/diet` route and navigation link.
- **FR-602**: App MUST allow adding foods to a local library (nutrition per 1 g or per 1 tbsp) and reusing them locally.
- **FR-603**: App MUST allow defining custom serving presets for a saved food (label + unit + amount).
- **FR-604**: App MUST allow logging meals composed of one or more meal items referencing saved foods.
- **FR-605**: App MUST compute nutrition per meal and per day totals.
- **FR-606**: App MUST track at least: calories, protein, fat, total carbs, fiber, sugar, sodium.
- **FR-607**: App MUST show net carbs = max(0, carbs - fiber).
- **FR-608**: App MUST store nutrition snapshots on meal items at log time.
- **FR-609**: App MUST allow deleting a previously logged meal.
- **FR-610**: App MUST allow updating a previously logged meal.

### Nutrition Source

- No external nutrition API.

### Data & Migration

- **FR-612**: App MUST migrate existing data safely (add diet containers without breaking existing storage).

### Validation Rules

- Meal datetime required
- Meal item quantity required (> 0)
- Serving selection required
- Custom serving amount required (> 0)

## Success Criteria *(mandatory)*

- **SC-601**: User can add a food, create custom servings, and log meals using those servings.
- **SC-602**: Daily totals and net carbs are correct and persist across refresh.
- **SC-603**: `ng test --no-watch` and `ng build --configuration=production` pass.

## Out of Scope

- Parsing full meal text into multiple items automatically
- Barcode scanning
- Goals/targets and adherence scoring
- Cloud sync
