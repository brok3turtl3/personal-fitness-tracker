import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { StorageService } from '../../services/storage.service';
import { DietService, DietValidationError, scaleFoodTotals, sumTotals } from '../../services/diet.service';
import { DailyTargets, FoodUnit, MealEntry, MealType, NutritionTotals, SavedFood, SavedFoodServing } from '../../models/diet.model';
import { filterFoods, rankFoods, recentFoods } from '../../services/food-ranking';
import { MeasuredUnit, isMeasuredUnit, toBaseUnits, UnitConversionError } from '../../services/units';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';

interface TargetBar {
  key: keyof DailyTargets;
  label: string;
  unit: string;
  value: number;
  target: number;
  pct: number;        // true percentage (may exceed 100)
  fillPct: number;    // clamped to 100 for the bar width
  over: boolean;
  overBy: number;
}

@Component({
  selector: 'app-diet-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent],
  template: `
    <div class="page-container">
      <h1>Diet</h1>

      @if (loadError) {
        <app-error-state
          title="Couldn't load your diet data"
          [error]="loadError"
          (retry)="reloadData()"
        ></app-error-state>
      }

      <section class="panel" aria-label="Saved foods">
        <h2>Saved Foods</h2>

        <div class="form-actions">
          <button type="button" class="btn btn-primary" (click)="toggleAddFood()">
            @if (showAddFood) { Close } @else { Add / Manage Foods }
          </button>
          @if (!showAddFood) {
            <span class="muted">{{ savedFoods.length }} saved</span>
          }
        </div>

        @if (showAddFood) {
          <div class="subpanel">
            <div class="subpanel-title">
              @if (editingFoodId) { Edit food } @else { Add food }
            </div>
            <form [formGroup]="addFoodForm" (ngSubmit)="onAddFood()">
              <div class="form-row">
                <div class="form-group">
                  <label for="baseUnit">Food base unit</label>
                  <select id="baseUnit" formControlName="baseUnit">
                    <option value="g">grams (per 1 g)</option>
                    <option value="tbsp">tablespoons (per 1 tbsp)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="gramsPerTbsp">Grams per tbsp</label>
                  <input id="gramsPerTbsp" type="number" formControlName="gramsPerTbsp" min="1" step="0.1" placeholder="optional">
                  <div class="muted">Optional; required only if you want to use both g and tbsp for this food.</div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="foodName">Name *</label>
                  <input id="foodName" type="text" formControlName="name" placeholder="e.g. ribeye steak">
                </div>
                <div class="form-group">
                  <label for="calories">Calories (kcal) per {{ foodUnitLabel() }} *</label>
                  <input id="calories" type="number" formControlName="caloriesKcal" min="0" step="1">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="protein">Protein (g) per {{ foodUnitLabel() }} *</label>
                  <input id="protein" type="number" formControlName="proteinG" min="0" step="0.1">
                </div>
                <div class="form-group">
                  <label for="fat">Fat (g) per {{ foodUnitLabel() }} *</label>
                  <input id="fat" type="number" formControlName="fatG" min="0" step="0.1">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="carbs">Carbs (g) per {{ foodUnitLabel() }} *</label>
                  <input id="carbs" type="number" formControlName="carbsG" min="0" step="0.1">
                </div>
                <div class="form-group">
                  <label for="fiber">Fiber (g) per {{ foodUnitLabel() }} *</label>
                  <input id="fiber" type="number" formControlName="fiberG" min="0" step="0.1">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="sugar">Sugar (g) per {{ foodUnitLabel() }} *</label>
                  <input id="sugar" type="number" formControlName="sugarG" min="0" step="0.1">
                </div>
                <div class="form-group">
                  <label for="sodium">Sodium (mg) per {{ foodUnitLabel() }} *</label>
                  <input id="sodium" type="number" formControlName="sodiumMg" min="0" step="1">
                </div>
              </div>

              @if (addFoodError) {
                <div class="form-error" role="alert">{{ addFoodError }}</div>
              }

              <div class="form-actions">
                <button type="submit" class="btn btn-primary" [disabled]="addFoodForm.invalid || isAddingFood">
                  @if (isAddingFood) { Saving... } @else {
                    @if (editingFoodId) { Save Changes } @else { Save Food }
                  }
                </button>
              </div>
            </form>

            <div class="muted">
              Tip: after saving, use “Add Serving” to create presets like “my scoop” or “my bowl”.
            </div>
          </div>
        }

        @if (showAddFood) {
          @if (!savedFoods.length) {
            <app-empty-state
              title="No saved foods yet"
              message="Add your first food while logging a meal — search for it, then choose &quot;Add as a new food&quot;. It'll be saved here for next time."
            ></app-empty-state>
          } @else {
            <div class="saved-foods">
              <h3>Your Foods</h3>
              <ul class="history-list" role="list" aria-label="Saved foods list">
                @for (food of savedFoods; track food.id) {
                  <li class="history-item">
                    <div class="history-item-main">
                      <div>
                        <div class="history-item-value">{{ food.name }}</div>
                        <div class="history-item-date">
                          {{ food.servings.length }} servings
                          &middot; {{ food.nutrientsPerUnit.caloriesKcal | number:'1.0-2' }} kcal / {{ food.baseUnit }}
                          @if (food.gramsPerTbsp) { &middot; {{ food.gramsPerTbsp }} g/tbsp }
                          @if (food.densityGramsPerMl) { &middot; {{ food.densityGramsPerMl }} g/ml }
                        </div>
                      </div>

                      <div class="form-actions">
                        <button type="button" class="btn btn-secondary" (click)="startEditFood(food)">Edit</button>
                        @if (confirmingDeleteFoodId === food.id) {
                          <span class="confirm-swap" role="group" aria-label="Confirm delete food">
                            <span class="confirm-text">Delete "{{ food.name }}"? This won't change past meals —</span>
                            <button type="button" class="btn btn-danger btn-sm" (click)="confirmDeleteFood(food)">Confirm</button>
                            <button type="button" class="btn btn-secondary btn-sm" (click)="cancelDeleteFood()">Cancel</button>
                          </span>
                        } @else {
                          <button type="button" class="btn btn-danger btn-sm" (click)="requestDeleteFood(food)">Delete</button>
                        }
                        <button type="button" class="btn btn-secondary" (click)="toggleServingEditor(food.id)">
                          @if (servingEditorFoodId === food.id) { Done } @else { Add Serving }
                        </button>
                      </div>
                    </div>

                    @if (servingEditorFoodId === food.id) {
                      <div class="subpanel">
                        <div class="subpanel-title">Custom serving preset</div>
                        <form [formGroup]="customServingForm" (ngSubmit)="onAddCustomServing(food)" class="inline-form">
                          <div class="form-row">
                            <div class="form-group">
                              <label for="servingLabel">Label</label>
                              <input id="servingLabel" type="text" formControlName="label" placeholder="e.g. my scoop">
                            </div>
                            <div class="form-group">
                              <label for="servingUnit">Unit</label>
                              <select id="servingUnit" formControlName="unit">
                                @for (u of servingUnitOptions(food); track u) {
                                  <option [value]="u">{{ u }}</option>
                                }
                              </select>
                            </div>
                          </div>

                          <div class="form-row">
                            <div class="form-group">
                              <label for="servingAmount">Amount</label>
                              <input id="servingAmount" type="number" formControlName="amount" min="0.1" step="0.1">
                            </div>
                          </div>

                          <div class="form-actions">
                            <button type="submit" class="btn btn-primary" [disabled]="customServingForm.invalid">Add</button>
                          </div>
                        </form>

                        @if (customServingError) {
                          <div class="form-error" role="alert">{{ customServingError }}</div>
                        }

                        <div class="servings">
                          <div class="muted">Servings</div>
                          <div class="pill-row">
                            @for (s of food.servings; track s.id) {
                                <span class="pill">{{ s.label }} ({{ s.amount }} {{ s.unit }})</span>
                              }
                            </div>
                          </div>
                      </div>
                    }
                  </li>
                }
              </ul>
            </div>
          }
        }
      </section>

      <section class="panel" aria-label="Meals">
        <h2>Meals</h2>

        <div class="form-row">
          <div class="form-group">
            <label for="day">Day</label>
            <input id="day" type="date" [value]="selectedDay" (change)="onDayChanged($event)">
          </div>
          <div class="totals">
            <div class="totals-title">Daily totals</div>
            <div class="totals-grid">
              <div>
                <span class="k">Calories</span>
                <span class="v">{{ liveTotals.caloriesKcal | number:'1.0-0' }} kcal</span>
              </div>
              @if (targetBarFor('caloriesKcal'); as bar) { <div class="target-cell">{{ '' }}<ng-container *ngTemplateOutlet="targetBarTpl; context: { $implicit: bar }"></ng-container></div> }
              <div>
                <span class="k">Protein</span>
                <span class="v">{{ liveTotals.proteinG | number:'1.0-1' }} g</span>
              </div>
              @if (targetBarFor('proteinG'); as bar) { <div class="target-cell"><ng-container *ngTemplateOutlet="targetBarTpl; context: { $implicit: bar }"></ng-container></div> }
              <div>
                <span class="k">Fat</span>
                <span class="v">{{ liveTotals.fatG | number:'1.0-1' }} g</span>
              </div>
              @if (targetBarFor('fatG'); as bar) { <div class="target-cell"><ng-container *ngTemplateOutlet="targetBarTpl; context: { $implicit: bar }"></ng-container></div> }
              <div>
                <span class="k">Carbs</span>
                <span class="v">{{ liveTotals.carbsG | number:'1.0-1' }} g</span>
              </div>
              @if (targetBarFor('carbsG'); as bar) { <div class="target-cell"><ng-container *ngTemplateOutlet="targetBarTpl; context: { $implicit: bar }"></ng-container></div> }
              <div>
                <span class="k">Net carbs</span>
                <span class="v">{{ liveTotals.netCarbsG | number:'1.0-1' }} g</span>
              </div>
              @if (targetBarFor('netCarbsG'); as bar) { <div class="target-cell"><ng-container *ngTemplateOutlet="targetBarTpl; context: { $implicit: bar }"></ng-container></div> }
              <div><span class="k">Fiber</span><span class="v">{{ liveTotals.fiberG | number:'1.0-1' }} g</span></div>
              <div><span class="k">Sugar</span><span class="v">{{ liveTotals.sugarG | number:'1.0-1' }} g</span></div>
              <div><span class="k">Sodium</span><span class="v">{{ liveTotals.sodiumMg | number:'1.0-0' }} mg</span></div>
            </div>

            <div class="form-actions targets-actions">
              @if (!showTargetsEditor) {
                <button type="button" class="btn btn-secondary btn-sm" (click)="toggleTargetsEditor()">
                  @if (hasTargets()) { Edit daily targets } @else { Set daily targets }
                </button>
              }
            </div>

            @if (showTargetsEditor) {
              <div class="subpanel">
                <div class="subpanel-title">Daily targets</div>
                <form [formGroup]="targetsForm" (ngSubmit)="onSaveTargets()" class="inline-form">
                  <div class="form-row">
                    <div class="form-group">
                      <label for="tCalories">Calories (kcal)</label>
                      <input id="tCalories" type="number" formControlName="caloriesKcal" min="0" step="1" placeholder="optional">
                    </div>
                    <div class="form-group">
                      <label for="tProtein">Protein (g)</label>
                      <input id="tProtein" type="number" formControlName="proteinG" min="0" step="0.1" placeholder="optional">
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="tFat">Fat (g)</label>
                      <input id="tFat" type="number" formControlName="fatG" min="0" step="0.1" placeholder="optional">
                    </div>
                    <div class="form-group">
                      <label for="tCarbs">Carbs (g)</label>
                      <input id="tCarbs" type="number" formControlName="carbsG" min="0" step="0.1" placeholder="optional">
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="tNetCarbs">Net carbs (g)</label>
                      <input id="tNetCarbs" type="number" formControlName="netCarbsG" min="0" step="0.1" placeholder="optional">
                    </div>
                  </div>

                  @if (targetsError) {
                    <div class="form-error" role="alert">{{ targetsError }}</div>
                  }

                  <div class="form-actions">
                    <button type="submit" class="btn btn-primary btn-sm">Save</button>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="toggleTargetsEditor()">Close</button>
                    @if (hasTargets()) {
                      @if (confirmingClearTargets) {
                        <span class="confirm-swap" role="group" aria-label="Confirm clear targets">
                          <span class="confirm-text">Clear daily targets? Totals will stop showing % of target —</span>
                          <button type="button" class="btn btn-danger btn-sm" (click)="confirmClearTargets()">Confirm</button>
                          <button type="button" class="btn btn-secondary btn-sm" (click)="cancelClearTargets()">Cancel</button>
                        </span>
                      } @else {
                        <button type="button" class="btn btn-danger btn-sm" (click)="requestClearTargets()">Clear targets</button>
                      }
                    }
                  </div>
                </form>
              </div>
            }
          </div>
        </div>

        <div class="form-actions copy-actions">
          <button type="button" class="btn btn-secondary" (click)="repeatYesterday()">Repeat yesterday</button>
          @if (!showCopyPicker) {
            <button type="button" class="btn btn-secondary" (click)="toggleCopyPicker()">Copy from another day…</button>
          } @else {
            <span class="copy-picker">
              <label for="copyDay" class="sr-label">Copy from</label>
              <input id="copyDay" type="date" [value]="copyDay" (change)="onCopyDayChanged($event)">
              <button type="button" class="btn btn-secondary btn-sm" (click)="copyFromDay()">Copy</button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="toggleCopyPicker()">Cancel</button>
            </span>
          }
          @if (copyResult) {
            <span class="muted copy-result" role="status">{{ copyResult }}</span>
          }
        </div>

        <div class="subpanel">
          <div class="subpanel-title">
            @if (editingMealId) { Edit meal } @else { Add meal }
          </div>
          <form [formGroup]="mealForm" (ngSubmit)="onAddMeal()">
            <div class="form-row">
              <div class="form-group">
                <label for="mealDateTime">Date & Time *</label>
                <input id="mealDateTime" type="datetime-local" formControlName="dateTime" aria-required="true">
              </div>
              <div class="form-group">
                <label for="mealType">Meal type</label>
                <select id="mealType" formControlName="mealType">
                  <option value="">(optional)</option>
                  @for (t of mealTypes; track t) {
                    <option [value]="t">{{ t }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="mealNotes">Notes</label>
              <textarea id="mealNotes" rows="2" formControlName="notes" placeholder="optional"></textarea>
            </div>

            <div class="subpanel">
              <div class="subpanel-title">Meal items</div>

              <!-- Food picker: search-as-you-type + Recent/Frequent + inline quick-add -->
              <div class="food-picker">
                <div class="form-group">
                  <label for="foodSearch">Find food</label>
                  <input
                    id="foodSearch"
                    type="text"
                    placeholder="Search foods…"
                    [value]="foodQuery"
                    (input)="onFoodSearch($event)"
                    (focus)="searchFocused = true"
                    autocomplete="off"
                  >
                </div>

                @if (foodQuery.trim().length === 0 && searchFocused) {
                  @if (recentPicks.length) {
                    <div class="subpanel pick-group">
                      <div class="subpanel-title">Recent</div>
                      <div class="pill-row">
                        @for (food of recentPicks; track food.id) {
                          <button type="button" class="pill pill-button" (click)="selectFood(food)">{{ food.name }}</button>
                        }
                      </div>
                    </div>
                  }
                  @if (frequentPicks.length) {
                    <div class="subpanel pick-group">
                      <div class="subpanel-title">Frequent</div>
                      <div class="pill-row">
                        @for (food of frequentPicks; track food.id) {
                          <button type="button" class="pill pill-button" (click)="selectFood(food)">{{ food.name }}</button>
                        }
                      </div>
                    </div>
                  }
                } @else if (foodQuery.trim().length > 0) {
                  @if (searchResults.length) {
                    <ul class="history-list search-results" role="list" aria-label="Search results">
                      @for (food of searchResults; track food.id) {
                        <li class="history-item search-result">
                          <button type="button" class="result-button" (click)="selectFood(food)">
                            <span class="history-item-value">{{ food.name }}</span>
                            <span class="history-item-date">{{ food.nutrientsPerUnit.caloriesKcal | number:'1.0-2' }} kcal / {{ food.baseUnit }}</span>
                          </button>
                        </li>
                      }
                    </ul>
                  } @else {
                    <div class="quick-add">
                      @if (!showQuickAdd) {
                        <button type="button" class="btn btn-secondary" (click)="openQuickAdd()">
                          No match. Add "{{ foodQuery.trim() }}" as a new food
                        </button>
                      } @else {
                        <form [formGroup]="quickAddForm" (ngSubmit)="onQuickAdd()" class="inline-form">
                          <div class="muted">Enter macros once — this food stays in your library for next time.</div>
                          <div class="form-row">
                            <div class="form-group">
                              <label for="qaName">Name *</label>
                              <input id="qaName" type="text" formControlName="name">
                            </div>
                            <div class="form-group">
                              <label for="qaBaseUnit">Base unit</label>
                              <select id="qaBaseUnit" formControlName="baseUnit">
                                @for (u of measuredUnits; track u) {
                                  <option [value]="u">{{ u }}</option>
                                }
                              </select>
                            </div>
                          </div>
                          <div class="form-row">
                            <div class="form-group">
                              <label for="qaCalories">Calories (kcal) per 1 unit *</label>
                              <input id="qaCalories" type="number" formControlName="caloriesKcal" min="0" step="1">
                            </div>
                            <div class="form-group">
                              <label for="qaProtein">Protein (g) *</label>
                              <input id="qaProtein" type="number" formControlName="proteinG" min="0" step="0.1">
                            </div>
                          </div>
                          <div class="form-row">
                            <div class="form-group">
                              <label for="qaFat">Fat (g) *</label>
                              <input id="qaFat" type="number" formControlName="fatG" min="0" step="0.1">
                            </div>
                            <div class="form-group">
                              <label for="qaCarbs">Carbs (g) *</label>
                              <input id="qaCarbs" type="number" formControlName="carbsG" min="0" step="0.1">
                            </div>
                          </div>
                          <div class="form-row">
                            <div class="form-group">
                              <label for="qaFiber">Fiber (g) *</label>
                              <input id="qaFiber" type="number" formControlName="fiberG" min="0" step="0.1">
                            </div>
                            <div class="form-group">
                              <label for="qaQty">Quantity (units) *</label>
                              <input id="qaQty" type="number" formControlName="quantity" min="0.1" step="0.1">
                            </div>
                          </div>

                          @if (quickAddError) {
                            <div class="form-error" role="alert">{{ quickAddError }}</div>
                          }

                          <div class="form-actions">
                            <button type="submit" class="btn btn-primary" [disabled]="quickAddForm.invalid || isQuickAdding">
                              @if (isQuickAdding) { Saving… } @else { Add food & log it }
                            </button>
                            <button type="button" class="btn btn-secondary" (click)="cancelQuickAdd()">Cancel</button>
                          </div>
                        </form>
                      }
                    </div>
                  }
                }
              </div>

              <!-- Selected-food add-to-meal form -->
              @if (selectedFood) {
                <form [formGroup]="mealItemForm" (ngSubmit)="onAddMealItem()" class="inline-form">
                  <div class="selected-food muted">Adding: <strong>{{ selectedFood.name }}</strong></div>
                  <div class="form-row items-row">
                    <div class="form-group">
                      <label for="servingSelect">Serving</label>
                      <select id="servingSelect" formControlName="servingId">
                        <option value="">Select serving...</option>
                        @for (s of mealServingOptions; track s.id) {
                          <option [value]="s.id">{{ s.label }} ({{ s.amount }} {{ s.unit }})</option>
                        }
                      </select>
                      @if (selectedFood && !selectedFood.densityGramsPerMl) {
                        <div class="muted">No density set — you can log this food in weight or volume units, but not convert between them.</div>
                      }
                    </div>

                    <div class="form-group">
                      <label for="qty">Qty</label>
                      <input id="qty" type="number" formControlName="quantity" min="0.1" step="0.1">
                    </div>

                    <div class="form-actions">
                      <button type="submit" class="btn btn-primary" [disabled]="mealItemForm.invalid">Add to meal</button>
                      <button type="button" class="btn btn-secondary" (click)="clearSelectedFood()">Change</button>
                    </div>
                  </div>
                </form>
              }

              @if (pendingItems.length) {
                <div class="items-list">
                  <div class="muted">Pending items</div>
                  <ul class="history-list" role="list">
                    @for (it of pendingItems; track $index) {
                      <li class="history-item">
                        <div class="history-item-main">
                          <div>
                            <div class="history-item-value">{{ it.label }}</div>
                            <div class="history-item-date">
                              {{ it.preview.caloriesKcal | number:'1.0-0' }} kcal &middot;
                              net {{ it.preview.netCarbsG | number:'1.0-1' }}g &middot;
                              P {{ it.preview.proteinG | number:'1.0-1' }}g &middot;
                              F {{ it.preview.fatG | number:'1.0-1' }}g
                            </div>
                          </div>
                          <button type="button" class="btn btn-danger btn-sm" (click)="removePendingItem($index)">Remove</button>
                        </div>
                      </li>
                    }
                  </ul>
                </div>
              } @else {
                <div class="empty-state">
                  <p>Add one or more items to save a meal.</p>
                </div>
              }
            </div>

            @if (mealError) {
              <div class="form-error" role="alert">{{ mealError }}</div>
            }

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="mealForm.invalid || pendingItems.length === 0 || isSavingMeal">
                @if (isSavingMeal) { Saving... } @else {
                  @if (editingMealId) { Save changes } @else { Save meal }
                }
              </button>
              @if (editingMealId) {
                <button type="button" class="btn btn-secondary" (click)="cancelEditMeal()">Cancel</button>
              }
            </div>
          </form>
        </div>

        <section class="history-section" aria-label="Meals history">
          <h2>Meals ({{ selectedDay }})</h2>

          @if (!meals.length) {
            <app-empty-state
              title="Nothing logged today"
              message="Add a meal below, or repeat yesterday to start fast."
            ></app-empty-state>
          } @else {
            <ul class="history-list" role="list">
              @for (meal of meals; track meal.id) {
                <li class="history-item">
                  <div class="history-item-main">
                    <div>
                      <div class="history-item-value">
                        {{ formatMealTime(meal.dateTime) }}
                        @if (meal.mealType) { &middot; {{ meal.mealType }} }
                      </div>
                      <div class="history-item-date">
                        {{ meal.totals.caloriesKcal | number:'1.0-0' }} kcal &middot; net {{ meal.totals.netCarbsG | number:'1.0-1' }}g
                      </div>
                    </div>

                    <div class="form-actions">
                      <button type="button" class="btn btn-secondary" (click)="startEditMeal(meal)">Edit</button>
                      @if (confirmingDeleteMealId === meal.id) {
                        <span class="confirm-swap" role="group" aria-label="Confirm delete meal">
                          <span class="confirm-text">Delete this meal?</span>
                          <button type="button" class="btn btn-danger btn-sm" (click)="confirmDeleteMeal(meal)" [disabled]="isDeletingMeal">Confirm</button>
                          <button type="button" class="btn btn-secondary btn-sm" (click)="cancelDeleteMeal()">Cancel</button>
                        </span>
                      } @else {
                        <button type="button" class="btn btn-danger btn-sm" (click)="requestDeleteMeal(meal)">Delete</button>
                      }
                    </div>
                  </div>
                  <div class="pill-row">
                    @for (it of meal.items; track it.id) {
                      <span class="pill">{{ it.savedFoodName }} x{{ it.quantity }}</span>
                    }
                  </div>
                  @if (meal.notes) {
                    <div class="history-item-notes">{{ meal.notes }}</div>
                  }
                </li>
              }
            </ul>
          }
        </section>
      </section>
    </div>

    <!-- Reusable target-bar template: text label is ALWAYS present (color never the sole signal). -->
    <ng-template #targetBarTpl let-bar>
      <div class="target-bar-wrap">
        <div class="target-bar" [class.over]="bar.over" role="img"
             [attr.aria-label]="bar.over
               ? bar.value + ' / ' + bar.target + ' ' + bar.unit + ' · over by ' + bar.overBy
               : bar.value + ' / ' + bar.target + ' ' + bar.unit + ' · ' + bar.pct + '%'">
          <div class="target-fill" [class.over]="bar.over" [style.width.%]="bar.fillPct"></div>
        </div>
        <span class="target-label">
          @if (bar.over) {
            {{ bar.value }} / {{ bar.target }} {{ bar.unit }} · over by {{ bar.overBy }}
          } @else {
            {{ bar.value }} / {{ bar.target }} {{ bar.unit }} · {{ bar.pct }}%
          }
        </span>
      </div>
    </ng-template>
  `,
  styles: [`
    .panel {
      background: #f8f9fa;
      padding: 1.25rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    .panel h2 {
      margin: 0 0 0.5rem 0;
      color: #2c3e50;
      font-size: 1.25rem;
    }

    .muted {
      color: #5f6c6d; /* QUAL-08: was #7f8c8d (3.47:1); #5f6c6d clears WCAG AA */
      font-size: 0.95rem;
      margin: 0 0 0.75rem 0;
    }

    .inline-form {
      margin-top: 0.75rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      align-items: end;
    }

    .items-row {
      grid-template-columns: 1.25fr 0.6fr auto;
    }

    @media (max-width: 850px) {
      .form-row,
      .items-row {
        grid-template-columns: 1fr;
      }
    }

    .form-group label {
      margin-bottom: 0.5rem;
    }

    .form-actions {
      display: inline-flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .confirm-swap {
      display: inline-flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .confirm-text {
      color: #2c3e50;
      font-size: 0.875rem;
    }

    .empty-state {
      background: #ffffff;
      border: 1px dashed #e5e5e5;
      border-radius: 8px;
      margin-top: 1rem;
    }

    .subpanel {
      background: #ffffff;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 1rem;
      margin-top: 0.75rem;
    }

    .subpanel-title {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 0.75rem;
    }

    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    .pill {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 999px;
      background: #ecf0f1;
      color: #2c3e50;
      font-size: 0.85rem;
    }

    .pill-button {
      border: none;
      cursor: pointer;
      font: inherit;
      font-size: 0.85rem;
    }

    .result-button {
      display: block;
      width: 100%;
      text-align: left;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      font: inherit;
    }

    .search-results {
      margin-top: 0.5rem;
    }

    .selected-food {
      margin-bottom: 0.5rem;
    }

    .totals {
      grid-column: span 1;
    }

    .totals-title {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 0.25rem;
    }

    .totals-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.5rem 1rem;
      background: #ffffff;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 0.75rem;
    }

    @media (max-width: 850px) {
      .totals-grid {
        grid-template-columns: 1fr;
      }
    }

    .totals-grid > div {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .totals-grid > div.target-cell {
      display: block;
    }

    .target-bar-wrap {
      width: 100%;
    }

    .target-bar {
      background: #ecf0f1;
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
    }

    .target-fill {
      height: 8px;
      border-radius: 999px;
      background: #2471a3;
    }

    .target-fill.over {
      background: #c0392b;
    }

    .target-label {
      display: block;
      font-size: 0.85rem;
      color: #5f6c6d;
      margin-top: 0.25rem;
    }

    .targets-actions,
    .copy-actions {
      margin-top: 0.75rem;
    }

    .copy-result {
      margin: 0;
    }

    .copy-picker {
      display: inline-flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .sr-label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    .k {
      color: #5f6c6d; /* QUAL-08: was #7f8c8d (3.47:1); #5f6c6d clears WCAG AA */
    }

    .v {
      font-weight: 600;
      color: #2c3e50;
    }
  `]
})
export class DietPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  addFoodForm: FormGroup;
  mealForm: FormGroup;
  mealItemForm: FormGroup;
  customServingForm: FormGroup;
  quickAddForm: FormGroup;
  targetsForm: FormGroup;

  showAddFood = false;
  addFoodError: string | null = null;
  isAddingFood = false;
  editingFoodId: string | null = null;
  loadError: Error | null = null;

  savedFoods: SavedFood[] = [];
  servingEditorFoodId: string | null = null;
  customServingError: string | null = null;
  confirmingDeleteFoodId: string | null = null;

  selectedDay: string;
  meals: MealEntry[] = [];
  allMeals: MealEntry[] = [];
  dailyTotals: NutritionTotals = emptyTotals();
  liveTotals: NutritionTotals = emptyTotals();
  dailyTargets: DailyTargets | undefined;

  mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  measuredUnits: MeasuredUnit[] = ['g', 'oz', 'lb', 'ml', 'tsp', 'tbsp', 'cup'];

  // Food picker state
  foodQuery = '';
  searchFocused = false;
  searchResults: SavedFood[] = [];
  recentPicks: SavedFood[] = [];
  frequentPicks: SavedFood[] = [];
  selectedFood: SavedFood | null = null;
  showQuickAdd = false;
  quickAddError: string | null = null;
  isQuickAdding = false;

  mealServingOptions: SavedFoodServing[] = [];
  pendingItems: Array<{ savedFoodId: string; servingId: string; quantity: number; label: string; preview: NutritionTotals }> = [];
  mealError: string | null = null;
  isSavingMeal = false;
  editingMealId: string | null = null;
  isDeletingMeal = false;
  confirmingDeleteMealId: string | null = null;

  // Targets editor state
  showTargetsEditor = false;
  targetsError: string | null = null;
  confirmingClearTargets = false;

  // Copy-a-meal state
  showCopyPicker = false;
  copyDay: string;
  copyResult: string | null = null;

  constructor(
    private fb: FormBuilder,
    private storageService: StorageService,
    private dietService: DietService,
  ) {
    this.addFoodForm = this.fb.group({
      baseUnit: ['g', Validators.required],
      name: ['', Validators.required],
      caloriesKcal: [0, [Validators.required, Validators.min(0)]],
      proteinG: [0, [Validators.required, Validators.min(0)]],
      fatG: [0, [Validators.required, Validators.min(0)]],
      carbsG: [0, [Validators.required, Validators.min(0)]],
      fiberG: [0, [Validators.required, Validators.min(0)]],
      sugarG: [0, [Validators.required, Validators.min(0)]],
      sodiumMg: [0, [Validators.required, Validators.min(0)]],
      gramsPerTbsp: [null]
    });

    this.mealForm = this.fb.group({
      dateTime: ['', Validators.required],
      mealType: [''],
      notes: ['']
    });

    this.mealItemForm = this.fb.group({
      servingId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.1)]]
    });

    this.customServingForm = this.fb.group({
      label: ['', Validators.required],
      unit: ['g', Validators.required],
      amount: [100, [Validators.required, Validators.min(0.1)]]
    });

    this.quickAddForm = this.fb.group({
      name: ['', Validators.required],
      baseUnit: ['g', Validators.required],
      caloriesKcal: [0, [Validators.required, Validators.min(0)]],
      proteinG: [0, [Validators.required, Validators.min(0)]],
      fatG: [0, [Validators.required, Validators.min(0)]],
      carbsG: [0, [Validators.required, Validators.min(0)]],
      fiberG: [0, [Validators.required, Validators.min(0)]],
      quantity: [1, [Validators.required, Validators.min(0.1)]]
    });

    this.targetsForm = this.fb.group({
      caloriesKcal: [null],
      proteinG: [null],
      fatG: [null],
      carbsG: [null],
      netCarbsG: [null]
    });

    this.selectedDay = formatLocalDate(new Date());
    this.copyDay = formatLocalDate(addDays(new Date(), -1));
  }

  ngOnInit(): void {
    const nowLocal = new Date();
    const localForInput = formatLocalDateTime(nowLocal);
    this.mealForm.patchValue({ dateTime: localForInput });

    this.reloadData();
  }

  reloadData(): void {
    this.loadError = null;
    this.storageService.initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadFoods();
          this.loadMeals();
          this.loadRankingMeals();
          this.loadTargets();
        },
        error: (err) => {
          this.loadError = err instanceof Error ? err : new Error(String(err));
        }
      });
  }

  toggleAddFood(): void {
    this.addFoodError = null;
    this.showAddFood = !this.showAddFood;
    if (this.showAddFood) {
      this.editingFoodId = null;
      this.addFoodForm.get('baseUnit')?.enable({ emitEvent: false });
      this.addFoodForm.reset({
        baseUnit: 'g',
        name: '',
        caloriesKcal: 0,
        proteinG: 0,
        fatG: 0,
        carbsG: 0,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0,
        gramsPerTbsp: null
      });
    }
  }

  startEditFood(food: SavedFood): void {
    this.addFoodError = null;
    this.showAddFood = true;
    this.editingFoodId = food.id;
    this.addFoodForm.get('baseUnit')?.disable({ emitEvent: false });

    this.addFoodForm.reset({
      baseUnit: food.baseUnit,
      name: food.name,
      caloriesKcal: food.nutrientsPerUnit.caloriesKcal,
      proteinG: food.nutrientsPerUnit.proteinG,
      fatG: food.nutrientsPerUnit.fatG,
      carbsG: food.nutrientsPerUnit.carbsG,
      fiberG: food.nutrientsPerUnit.fiberG,
      sugarG: food.nutrientsPerUnit.sugarG,
      sodiumMg: food.nutrientsPerUnit.sodiumMg,
      gramsPerTbsp: food.gramsPerTbsp ?? null
    });
  }

  requestDeleteFood(food: SavedFood): void {
    this.confirmingDeleteFoodId = food.id;
  }

  cancelDeleteFood(): void {
    this.confirmingDeleteFoodId = null;
  }

  confirmDeleteFood(food: SavedFood): void {
    this.confirmingDeleteFoodId = null;
    this.dietService.deleteSavedFood(food.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.selectedFood?.id === food.id) {
            this.clearSelectedFood();
          }
          this.loadFoods();
        },
        error: () => {
          this.addFoodError = 'Failed to delete food.';
        }
      });
  }

  foodUnitLabel(): string {
    const unit = String(this.addFoodForm.get('baseUnit')?.value || 'g');
    return unit === 'tbsp' ? '1 tbsp' : '1 g';
  }

  /**
   * Unit options offered for a custom serving (DIET-03 / Pitfall 5): only offer
   * cross-dimension units when the food has a density; otherwise restrict to the
   * food's base-dimension measured units so we never force a density-less
   * cross-dimension conversion.
   */
  servingUnitOptions(food: SavedFood): MeasuredUnit[] {
    const base = food.baseUnit;
    if (!isMeasuredUnit(base)) return [base as MeasuredUnit];
    if (food.densityGramsPerMl && Number.isFinite(food.densityGramsPerMl) && food.densityGramsPerMl > 0) {
      return this.measuredUnits;
    }
    return this.measuredUnits.filter(u => sameDimension(u, base as MeasuredUnit));
  }

  onAddFood(): void {
    this.addFoodError = null;
    if (this.addFoodForm.invalid) return;

    const v = this.addFoodForm.value;
    const name = String(v.name || '').trim();

    const baseUnit = String(v.baseUnit || 'g') as FoodUnit;
    const gramsPerTbsp = v.gramsPerTbsp === null || v.gramsPerTbsp === undefined || v.gramsPerTbsp === ''
      ? undefined
      : Number(v.gramsPerTbsp);

    const nutrientsPerUnit: NutritionTotals = {
      caloriesKcal: Number(v.caloriesKcal) || 0,
      proteinG: Number(v.proteinG) || 0,
      fatG: Number(v.fatG) || 0,
      carbsG: Number(v.carbsG) || 0,
      fiberG: Number(v.fiberG) || 0,
      sugarG: Number(v.sugarG) || 0,
      sodiumMg: Number(v.sodiumMg) || 0,
      netCarbsG: 0
    };
    nutrientsPerUnit.netCarbsG = Math.max(0, nutrientsPerUnit.carbsG - nutrientsPerUnit.fiberG);

    this.isAddingFood = true;
    const save$ = this.editingFoodId
      ? this.dietService.updateSavedFood(this.editingFoodId, { name, gramsPerTbsp, nutrientsPerUnit })
      : this.dietService.addSavedFood({
          name,
          baseUnit,
          gramsPerTbsp,
          nutrientsPerUnit
        });

    save$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isAddingFood = false;
          this.showAddFood = false;
          this.editingFoodId = null;
          this.loadFoods();
        },
        error: (err) => {
          this.isAddingFood = false;
          this.addFoodError = err instanceof DietValidationError ? err.errors.join(', ') : 'Failed to save food.';
        }
      });
  }

  toggleServingEditor(foodId: string): void {
    this.customServingError = null;
    this.customServingForm.reset({ label: '', unit: 'g', amount: 100 });
    this.servingEditorFoodId = this.servingEditorFoodId === foodId ? null : foodId;
  }

  onAddCustomServing(food: SavedFood): void {
    this.customServingError = null;
    const label = String(this.customServingForm.get('label')?.value || '').trim();
    const unit = String(this.customServingForm.get('unit')?.value || 'g') as FoodUnit;
    const amount = Number(this.customServingForm.get('amount')?.value);

    this.dietService.addCustomServing(food.id, label, unit, amount)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.customServingForm.reset({ label: '', unit: 'g', amount: 100 });
          this.loadFoods();
        },
        error: (err) => {
          this.customServingError = err instanceof DietValidationError ? err.errors.join(', ') : 'Failed to add serving.';
        }
      });
  }

  onDayChanged(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    this.selectedDay = value;
    this.loadMeals();
  }

  // -------------------------------------------------------------------------
  // Food picker — delegates ALL ranking/filtering to food-ranking.ts.
  // -------------------------------------------------------------------------

  onFoodSearch(event: Event): void {
    this.foodQuery = (event.target as HTMLInputElement).value;
    this.searchResults = filterFoods(this.savedFoods, this.foodQuery);
    if (this.foodQuery.trim().length > 0) {
      this.showQuickAdd = false;
      this.quickAddError = null;
    }
  }

  selectFood(food: SavedFood): void {
    this.selectedFood = food;
    this.mealServingOptions = food.servings;
    this.mealItemForm.reset({ servingId: '', quantity: 1 });
    this.foodQuery = '';
    this.searchResults = [];
    this.searchFocused = false;
    this.showQuickAdd = false;
  }

  clearSelectedFood(): void {
    this.selectedFood = null;
    this.mealServingOptions = [];
  }

  openQuickAdd(): void {
    this.quickAddError = null;
    this.showQuickAdd = true;
    this.quickAddForm.reset({
      name: this.foodQuery.trim(),
      baseUnit: 'g',
      caloriesKcal: 0,
      proteinG: 0,
      fatG: 0,
      carbsG: 0,
      fiberG: 0,
      quantity: 1
    });
  }

  cancelQuickAdd(): void {
    this.showQuickAdd = false;
    this.quickAddError = null;
  }

  /** Quick-add (D-01): manual macros, saves to library AND stages it in the meal. */
  onQuickAdd(): void {
    this.quickAddError = null;
    if (this.quickAddForm.invalid) return;

    const v = this.quickAddForm.value;
    const name = String(v.name || '').trim();
    const baseUnit = String(v.baseUnit || 'g') as FoodUnit;
    const quantity = Number(v.quantity) || 1;

    const nutrientsPerUnit: NutritionTotals = {
      caloriesKcal: Number(v.caloriesKcal) || 0,
      proteinG: Number(v.proteinG) || 0,
      fatG: Number(v.fatG) || 0,
      carbsG: Number(v.carbsG) || 0,
      fiberG: Number(v.fiberG) || 0,
      sugarG: 0,
      sodiumMg: 0,
      netCarbsG: 0
    };
    nutrientsPerUnit.netCarbsG = Math.max(0, nutrientsPerUnit.carbsG - nutrientsPerUnit.fiberG);

    this.isQuickAdding = true;
    this.dietService.addSavedFood({ name, baseUnit, nutrientsPerUnit })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (food) => {
          this.isQuickAdding = false;
          this.showQuickAdd = false;
          this.foodQuery = '';
          this.searchResults = [];
          this.searchFocused = false;
          // Stage the new food directly as a pending item (quantity of base units).
          const preview = scaleFoodTotals(food, quantity);
          this.pendingItems = [
            ...this.pendingItems,
            {
              savedFoodId: food.id,
              servingId: '',
              quantity,
              label: `${food.name} x${quantity} ${food.baseUnit}`,
              preview
            }
          ];
          this.recomputeLiveTotals();
          this.loadFoods();
        },
        error: (err) => {
          this.isQuickAdding = false;
          this.quickAddError = err instanceof DietValidationError ? err.errors.join(', ') : 'Failed to save food.';
        }
      });
  }

  onAddMealItem(): void {
    this.mealError = null;
    if (this.mealItemForm.invalid || !this.selectedFood) return;

    const food = this.selectedFood;
    const servingId = String(this.mealItemForm.get('servingId')?.value);
    const quantity = Number(this.mealItemForm.get('quantity')?.value);
    const serving = food.servings.find(s => s.id === servingId);
    if (!serving) return;

    const usedUnits = serving.amount * quantity;
    let baseUnits = 0;
    try {
      baseUnits = isMeasuredUnit(serving.unit) && isMeasuredUnit(food.baseUnit)
        ? toBaseUnits(serving.unit as MeasuredUnit, usedUnits, food.baseUnit as MeasuredUnit, food.densityGramsPerMl)
        : usedUnits;
    } catch (e) {
      this.mealError = e instanceof UnitConversionError
        ? 'This food needs a density (g/ml) to convert between weight and volume units.'
        : (e instanceof Error ? e.message : 'Invalid unit conversion.');
      return;
    }
    const preview = scaleFoodTotals(food, baseUnits);
    const label = `${food.name} - ${serving.label} x${quantity}`;

    this.pendingItems = [
      ...this.pendingItems,
      { savedFoodId: food.id, servingId, quantity, label, preview }
    ];
    this.recomputeLiveTotals();

    this.mealItemForm.patchValue({ quantity: 1 });
  }

  removePendingItem(index: number): void {
    this.pendingItems = this.pendingItems.filter((_, i) => i !== index);
    this.recomputeLiveTotals();
  }

  onAddMeal(): void {
    this.mealError = null;
    if (this.mealForm.invalid || this.pendingItems.length === 0) return;

    const localDateTime = String(this.mealForm.get('dateTime')?.value);
    const dateTimeIso = new Date(localDateTime).toISOString();
    const mealType = (String(this.mealForm.get('mealType')?.value || '').trim() || undefined) as MealType | undefined;
    const notes = String(this.mealForm.get('notes')?.value || '').trim() || undefined;

    const items = this.pendingItems
      .filter(i => i.servingId)
      .map(i => ({ savedFoodId: i.savedFoodId, servingId: i.servingId, quantity: i.quantity }));

    if (items.length === 0) {
      this.mealError = 'Pick a serving for each item before saving.';
      return;
    }

    this.isSavingMeal = true;
    const save$ = this.editingMealId
      ? this.dietService.updateMeal(this.editingMealId, { dateTime: dateTimeIso, mealType, notes, items })
      : this.dietService.addMeal({ dateTime: dateTimeIso, mealType, notes, items });

    save$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSavingMeal = false;
          this.pendingItems = [];
          this.editingMealId = null;
          this.copyResult = null;
          this.mealForm.reset({
            dateTime: formatLocalDateTime(new Date()),
            mealType: '',
            notes: ''
          });
          this.loadMeals();
          this.loadRankingMeals();
        },
        error: (err) => {
          this.isSavingMeal = false;
          this.mealError = err instanceof DietValidationError ? err.errors.join(', ') : 'Failed to save meal.';
        }
      });
  }

  startEditMeal(meal: MealEntry): void {
    this.mealError = null;
    this.editingMealId = meal.id;

    this.pendingItems = meal.items.map(it => ({
      savedFoodId: it.savedFoodId,
      servingId: it.servingId,
      quantity: it.quantity,
      label: `${it.savedFoodName} - ${it.servingLabel} x${it.quantity}`,
      preview: it.snapshot.totals
    }));
    this.recomputeLiveTotals();

    this.mealForm.reset({
      dateTime: formatLocalDateTimeFromIso(meal.dateTime),
      mealType: meal.mealType || '',
      notes: meal.notes || ''
    });
  }

  cancelEditMeal(): void {
    this.editingMealId = null;
    this.pendingItems = [];
    this.mealError = null;
    this.recomputeLiveTotals();
    this.mealForm.reset({
      dateTime: formatLocalDateTime(new Date()),
      mealType: '',
      notes: ''
    });
  }

  requestDeleteMeal(meal: MealEntry): void {
    this.confirmingDeleteMealId = meal.id;
  }

  cancelDeleteMeal(): void {
    this.confirmingDeleteMealId = null;
  }

  confirmDeleteMeal(meal: MealEntry): void {
    this.confirmingDeleteMealId = null;
    this.isDeletingMeal = true;
    this.dietService.deleteMeal(meal.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isDeletingMeal = false;
          if (this.editingMealId === meal.id) {
            this.cancelEditMeal();
          }
          this.loadMeals();
          this.loadRankingMeals();
        },
        error: () => {
          this.isDeletingMeal = false;
          this.mealError = 'Failed to delete meal.';
        }
      });
  }

  // -------------------------------------------------------------------------
  // Daily targets (D-08) — delegates persistence/validation to DietService.
  // -------------------------------------------------------------------------

  hasTargets(): boolean {
    const t = this.dailyTargets;
    return !!t && (t.caloriesKcal != null || t.proteinG != null || t.fatG != null || t.carbsG != null || t.netCarbsG != null);
  }

  toggleTargetsEditor(): void {
    this.targetsError = null;
    this.confirmingClearTargets = false;
    this.showTargetsEditor = !this.showTargetsEditor;
    if (this.showTargetsEditor) {
      const t = this.dailyTargets ?? {};
      this.targetsForm.reset({
        caloriesKcal: t.caloriesKcal ?? null,
        proteinG: t.proteinG ?? null,
        fatG: t.fatG ?? null,
        carbsG: t.carbsG ?? null,
        netCarbsG: t.netCarbsG ?? null
      });
    }
  }

  onSaveTargets(): void {
    this.targetsError = null;
    const v = this.targetsForm.value;
    const targets: DailyTargets = {};
    const assign = (key: keyof DailyTargets, raw: unknown): void => {
      if (raw === null || raw === undefined || raw === '') return;
      targets[key] = Number(raw);
    };
    assign('caloriesKcal', v.caloriesKcal);
    assign('proteinG', v.proteinG);
    assign('fatG', v.fatG);
    assign('carbsG', v.carbsG);
    assign('netCarbsG', v.netCarbsG);

    this.dietService.setDailyTargets(targets)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.dailyTargets = saved;
          this.showTargetsEditor = false;
        },
        error: (err) => {
          this.targetsError = err instanceof DietValidationError ? err.errors.join(', ') : 'Failed to save targets.';
        }
      });
  }

  requestClearTargets(): void {
    this.confirmingClearTargets = true;
  }

  cancelClearTargets(): void {
    this.confirmingClearTargets = false;
  }

  confirmClearTargets(): void {
    this.confirmingClearTargets = false;
    this.dietService.clearDailyTargets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dailyTargets = undefined;
          this.showTargetsEditor = false;
        },
        error: () => {
          this.targetsError = 'Failed to clear targets.';
        }
      });
  }

  /** Build a target-bar descriptor for a metric, or null when no target is set. */
  targetBarFor(key: keyof DailyTargets): TargetBar | null {
    const target = this.dailyTargets?.[key];
    if (target == null || !Number.isFinite(target) || target <= 0) return null;

    const value = round1(this.liveTotals[key as keyof NutritionTotals] as number);
    const pct = Math.round((value / target) * 100);
    const over = value > target;
    const unit = key === 'caloriesKcal' ? 'kcal' : 'g';
    return {
      key,
      label: key,
      unit,
      value,
      target,
      pct,
      fillPct: Math.min(100, pct),
      over,
      overBy: round1(Math.max(0, value - target))
    };
  }

  // -------------------------------------------------------------------------
  // Copy-a-meal (DIET-05) — delegates re-derivation to DietService.copyMealItems.
  // -------------------------------------------------------------------------

  repeatYesterday(): void {
    const key = formatLocalDate(addDays(new Date(), -1));
    this.copyFromDayKey(key);
  }

  toggleCopyPicker(): void {
    this.showCopyPicker = !this.showCopyPicker;
  }

  onCopyDayChanged(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.copyDay = value;
  }

  copyFromDay(): void {
    this.copyFromDayKey(this.copyDay);
    this.showCopyPicker = false;
  }

  private copyFromDayKey(dayKey: string): void {
    this.copyResult = null;
    this.dietService.getMealsForDay(dayKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sourceMeals) => {
          let copied = 0;
          for (const meal of sourceMeals) {
            const items = this.dietService.copyMealItems(meal, this.savedFoods);
            this.pendingItems = [...this.pendingItems, ...items];
            copied += items.length;
          }
          this.recomputeLiveTotals();
          this.copyResult = copied > 0
            ? `Copied ${copied} items — edit or remove any before saving.`
            : 'Nothing to copy from that day.';
        },
        error: () => {
          this.copyResult = 'Couldn\'t copy from that day.';
        }
      });
  }

  // -------------------------------------------------------------------------
  // Loaders
  // -------------------------------------------------------------------------

  private loadFoods(): void {
    this.dietService.getSavedFoods()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (foods) => {
          this.savedFoods = foods;
          if (this.selectedFood) {
            const refreshed = foods.find(f => f.id === this.selectedFood!.id) ?? null;
            this.selectedFood = refreshed;
            this.mealServingOptions = refreshed ? refreshed.servings : [];
          }
          this.searchResults = filterFoods(this.savedFoods, this.foodQuery);
          this.recomputeRankings();
        },
        error: (err) => {
          this.loadError = err instanceof Error ? err : new Error(String(err));
        }
      });
  }

  private loadMeals(): void {
    this.dietService.getMealsForDay(this.selectedDay)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meals) => {
          this.meals = meals;
          this.dailyTotals = this.dietService.computeDailyTotals(meals);
          this.recomputeLiveTotals();
        },
        error: (err) => {
          this.loadError = err instanceof Error ? err : new Error(String(err));
        }
      });
  }

  private loadRankingMeals(): void {
    const now = Date.now();
    const startMs = now - 90 * 86400000;
    this.dietService.getMealsInRange(startMs, now)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meals) => {
          this.allMeals = meals;
          this.recomputeRankings();
        },
        error: () => {
          // Ranking is a nicety; a failure here must not block the page.
          this.allMeals = [];
        }
      });
  }

  private loadTargets(): void {
    this.dietService.getDailyTargets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (t) => { this.dailyTargets = t; },
        error: () => { this.dailyTargets = undefined; }
      });
  }

  private recomputeRankings(): void {
    this.recentPicks = recentFoods(this.savedFoods, this.allMeals, 8);
    this.frequentPicks = rankFoods(this.savedFoods, this.allMeals, Date.now())
      .filter(f => this.allMeals.some(m => m.items.some(i => i.savedFoodId === f.id)))
      .slice(0, 8);
  }

  /** Live totals = saved meals (today) + pending items (DIET-06). */
  private recomputeLiveTotals(): void {
    this.liveTotals = sumTotals([
      ...this.meals.map(m => m.totals),
      ...this.pendingItems.map(p => p.preview)
    ]);
  }

  formatMealTime(dateTimeIso: string): string {
    const d = new Date(dateTimeIso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
}

function formatLocalDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatLocalDateTime(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function formatLocalDateTimeFromIso(isoString: string): string {
  const d = new Date(isoString);
  if (!Number.isFinite(d.getTime())) {
    return formatLocalDateTime(new Date());
  }
  return formatLocalDateTime(d);
}

function round1(n: number): number {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function emptyTotals(): NutritionTotals {
  return {
    caloriesKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
    netCarbsG: 0
  };
}

const MASS_UNITS: ReadonlySet<string> = new Set(['g', 'oz', 'lb']);

function sameDimension(a: MeasuredUnit, b: MeasuredUnit): boolean {
  return MASS_UNITS.has(a) === MASS_UNITS.has(b);
}
