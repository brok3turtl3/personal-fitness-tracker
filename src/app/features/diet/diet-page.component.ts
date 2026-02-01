import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { StorageService } from '../../services/storage.service';
import { DietService, DietValidationError, scaleFoodTotals } from '../../services/diet.service';
import { MealEntry, MealType, NutritionTotals, SavedFood } from '../../models/diet.model';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

@Component({
  selector: 'app-diet-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <h1>Diet</h1>

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
            <div class="empty-state">
              <p>No saved foods yet. Add your first food above.</p>
            </div>
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
                          &middot; {{ food.nutrientsPerUnit.caloriesKcal | number:'1.0-2' }} kcal / {{ food.baseUnit === 'tbsp' ? 'tbsp' : 'g' }}
                          @if (food.gramsPerTbsp) { &middot; {{ food.gramsPerTbsp }} g/tbsp }
                        </div>
                      </div>

                      <div class="form-actions">
                        <button type="button" class="btn btn-secondary" (click)="startEditFood(food)">Edit</button>
                        <button type="button" class="btn btn-danger btn-sm" (click)="onDeleteFood(food)">Delete</button>
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
                                <option value="g">grams</option>
                                <option value="tbsp">tbsp</option>
                              </select>
                            </div>
                          </div>

                          <div class="form-row">
                            <div class="form-group">
                              <label for="servingAmount">Amount</label>
                              <input id="servingAmount" type="number" formControlName="amount" min="0.1" step="0.1">
                              <div class="muted">
                                @if (customServingForm.get('unit')?.value === 'tbsp') {
                                  Uses grams-per-tbsp from the food.
                                }
                              </div>
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
              <div><span class="k">Calories</span><span class="v">{{ dailyTotals.caloriesKcal | number:'1.0-0' }} kcal</span></div>
              <div><span class="k">Net carbs</span><span class="v">{{ dailyTotals.netCarbsG | number:'1.0-1' }} g</span></div>
              <div><span class="k">Protein</span><span class="v">{{ dailyTotals.proteinG | number:'1.0-1' }} g</span></div>
              <div><span class="k">Fat</span><span class="v">{{ dailyTotals.fatG | number:'1.0-1' }} g</span></div>
              <div><span class="k">Carbs</span><span class="v">{{ dailyTotals.carbsG | number:'1.0-1' }} g</span></div>
              <div><span class="k">Fiber</span><span class="v">{{ dailyTotals.fiberG | number:'1.0-1' }} g</span></div>
              <div><span class="k">Sugar</span><span class="v">{{ dailyTotals.sugarG | number:'1.0-1' }} g</span></div>
              <div><span class="k">Sodium</span><span class="v">{{ dailyTotals.sodiumMg | number:'1.0-0' }} mg</span></div>
            </div>
          </div>
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

              <form [formGroup]="mealItemForm" (ngSubmit)="onAddMealItem()" class="inline-form">
                <div class="form-row items-row">
                  <div class="form-group">
                    <label for="foodSelect">Food</label>
                    <select id="foodSelect" formControlName="savedFoodId" (change)="onMealFoodChanged()">
                      <option value="">Select a food...</option>
                      @for (food of savedFoods; track food.id) {
                        <option [value]="food.id">{{ food.name }}</option>
                      }
                    </select>
                  </div>

                  <div class="form-group">
                    <label for="servingSelect">Serving</label>
                    <select id="servingSelect" formControlName="servingId">
                      <option value="">Select serving...</option>
                      @for (s of mealServingOptions; track s.id) {
                        <option [value]="s.id">{{ s.label }} ({{ s.amount }} {{ s.unit }})</option>
                      }
                    </select>
                  </div>

                  <div class="form-group">
                    <label for="qty">Qty</label>
                    <input id="qty" type="number" formControlName="quantity" min="0.1" step="0.1">
                  </div>

                  <div class="form-actions">
                    <button type="submit" class="btn btn-primary" [disabled]="mealItemForm.invalid">Add item</button>
                  </div>
                </div>
              </form>

              @if (pendingItems.length) {
                <div class="items-list">
                  <div class="muted">Pending items</div>
                  <ul class="history-list" role="list">
                    @for (it of pendingItems; track it.id) {
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
                          <button type="button" class="btn btn-danger btn-sm" (click)="removePendingItem(it.id)">Remove</button>
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
            <div class="empty-state">
              <p>No meals logged for this day.</p>
            </div>
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
                      <button type="button" class="btn btn-danger btn-sm" (click)="onDeleteMeal(meal)" [disabled]="isDeletingMeal" [attr.aria-busy]="isDeletingMeal">Delete</button>
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
      color: #7f8c8d;
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
      grid-template-columns: 1.25fr 1fr 0.6fr auto;
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

    .k {
      color: #7f8c8d;
    }

    .v {
      font-weight: 600;
      color: #2c3e50;
    }
  `]
})
export class DietPageComponent implements OnInit {
  addFoodForm: FormGroup;
  mealForm: FormGroup;
  mealItemForm: FormGroup;
  customServingForm: FormGroup;

  showAddFood = false;
  addFoodError: string | null = null;
  isAddingFood = false;
  editingFoodId: string | null = null;

  savedFoods: SavedFood[] = [];
  servingEditorFoodId: string | null = null;
  customServingError: string | null = null;

  selectedDay: string;
  meals: MealEntry[] = [];
  dailyTotals: NutritionTotals = emptyTotals();

  mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  mealServingOptions: Array<{ id: string; label: string; unit: 'g' | 'tbsp'; amount: number }> = [];
  pendingItems: Array<{ id: string; savedFoodId: string; servingId: string; quantity: number; label: string; preview: NutritionTotals }> = [];
  mealError: string | null = null;
  isSavingMeal = false;
  editingMealId: string | null = null;
  isDeletingMeal = false;

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
      savedFoodId: ['', Validators.required],
      servingId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.1)]]
    });

    this.customServingForm = this.fb.group({
      label: ['', Validators.required],
      unit: ['g', Validators.required],
      amount: [100, [Validators.required, Validators.min(0.1)]]
    });

    this.selectedDay = formatLocalDate(new Date());
  }

  ngOnInit(): void {
    const nowLocal = new Date();
    const localForInput = formatLocalDateTime(nowLocal);
    this.mealForm.patchValue({ dateTime: localForInput });

    this.storageService.initialize().subscribe({
      next: () => {
        this.loadFoods();
        this.loadMeals();
      },
      error: (err) => console.error('Failed to initialize storage:', err)
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

  onDeleteFood(food: SavedFood): void {
    const ok = window.confirm(`Delete "${food.name}"? Existing logged meals will keep their snapshots.`);
    if (!ok) return;

    this.dietService.deleteSavedFood(food.id).subscribe({
      next: () => {
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

  onAddFood(): void {
    this.addFoodError = null;
    if (this.addFoodForm.invalid) return;

    const v = this.addFoodForm.value;
    const name = String(v.name || '').trim();

    const baseUnit = String(v.baseUnit || 'g') as 'g' | 'tbsp';
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

    save$.subscribe({
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
    const unit = String(this.customServingForm.get('unit')?.value || 'g') as 'g' | 'tbsp';
    const amount = Number(this.customServingForm.get('amount')?.value);

    // If the serving unit is not the food base unit, ensure conversions are possible.
    if (unit !== food.baseUnit) {
      if (!food.gramsPerTbsp || !Number.isFinite(food.gramsPerTbsp) || food.gramsPerTbsp <= 0) {
        this.customServingError = 'This food needs grams-per-tbsp set to use both g and tbsp servings.';
        return;
      }
    }

    this.dietService.addCustomServing(food.id, label, unit, amount).subscribe({
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

  onMealFoodChanged(): void {
    const foodId = String(this.mealItemForm.get('savedFoodId')?.value || '');
    const food = this.savedFoods.find(f => f.id === foodId);
    this.mealServingOptions = food ? food.servings : [];
    this.mealItemForm.patchValue({ servingId: '' });
  }

  onAddMealItem(): void {
    this.mealError = null;
    if (this.mealItemForm.invalid) return;

    const savedFoodId = String(this.mealItemForm.get('savedFoodId')?.value);
    const servingId = String(this.mealItemForm.get('servingId')?.value);
    const quantity = Number(this.mealItemForm.get('quantity')?.value);
    const food = this.savedFoods.find(f => f.id === savedFoodId);
    const serving = food?.servings.find(s => s.id === servingId);
    if (!food || !serving) return;

    const usedUnits = serving.amount * quantity;
    let baseUnits = 0;
    try {
      baseUnits = toBaseUnitsForPreview(food, serving.unit, usedUnits);
    } catch (e) {
      this.mealError = e instanceof Error ? e.message : 'Invalid unit conversion.';
      return;
    }
    const preview = scaleFoodTotals(food, baseUnits);
    const label = `${food.name} - ${serving.label} x${quantity}`;

    this.pendingItems = [
      ...this.pendingItems,
      {
        id: generateUUID(),
        savedFoodId,
        servingId,
        quantity,
        label,
        preview
      }
    ];

    this.mealItemForm.patchValue({ quantity: 1 });
  }

  removePendingItem(id: string): void {
    this.pendingItems = this.pendingItems.filter(i => i.id !== id);
  }

  onAddMeal(): void {
    this.mealError = null;
    if (this.mealForm.invalid || this.pendingItems.length === 0) return;

    const localDateTime = String(this.mealForm.get('dateTime')?.value);
    const dateTimeIso = new Date(localDateTime).toISOString();
    const mealType = (String(this.mealForm.get('mealType')?.value || '').trim() || undefined) as MealType | undefined;
    const notes = String(this.mealForm.get('notes')?.value || '').trim() || undefined;

    this.isSavingMeal = true;
    const save$ = this.editingMealId
      ? this.dietService.updateMeal(this.editingMealId, {
          dateTime: dateTimeIso,
          mealType,
          notes,
          items: this.pendingItems.map(i => ({
            savedFoodId: i.savedFoodId,
            servingId: i.servingId,
            quantity: i.quantity
          }))
        })
      : this.dietService.addMeal({
          dateTime: dateTimeIso,
          mealType,
          notes,
          items: this.pendingItems.map(i => ({
            savedFoodId: i.savedFoodId,
            servingId: i.servingId,
            quantity: i.quantity
          }))
        });

    save$.subscribe({
      next: () => {
        this.isSavingMeal = false;
        this.pendingItems = [];
        this.editingMealId = null;
        this.mealForm.reset({
          dateTime: formatLocalDateTime(new Date()),
          mealType: '',
          notes: ''
        });
        this.loadMeals();
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
      id: it.id || generateUUID(),
      savedFoodId: it.savedFoodId,
      servingId: it.servingId,
      quantity: it.quantity,
      label: `${it.savedFoodName} - ${it.servingLabel} x${it.quantity}`,
      preview: it.snapshot.totals
    }));

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
    this.mealForm.reset({
      dateTime: formatLocalDateTime(new Date()),
      mealType: '',
      notes: ''
    });
  }

  onDeleteMeal(meal: MealEntry): void {
    const ok = window.confirm('Delete this meal? This cannot be undone.');
    if (!ok) return;

    this.isDeletingMeal = true;
    this.dietService.deleteMeal(meal.id).subscribe({
      next: () => {
        this.isDeletingMeal = false;
        if (this.editingMealId === meal.id) {
          this.cancelEditMeal();
        }
        this.loadMeals();
      },
      error: () => {
        this.isDeletingMeal = false;
        this.mealError = 'Failed to delete meal.';
      }
    });
  }

  private loadFoods(): void {
    this.dietService.getSavedFoods().subscribe({
      next: (foods) => {
        this.savedFoods = foods;
        this.onMealFoodChanged();
      },
      error: (err) => console.error('Failed to load saved foods:', err)
    });
  }

  private loadMeals(): void {
    this.dietService.getMealsForDay(this.selectedDay).subscribe({
      next: (meals) => {
        this.meals = meals;
        this.dailyTotals = this.dietService.computeDailyTotals(meals);
      },
      error: (err) => console.error('Failed to load meals:', err)
    });
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

function toBaseUnitsForPreview(food: SavedFood, unit: 'g' | 'tbsp', amount: number): number {
  if (unit === food.baseUnit) return amount;

  const gpt = food.gramsPerTbsp;
  if (!gpt || !Number.isFinite(gpt) || gpt <= 0) {
    throw new Error('Cannot convert between g and tbsp without grams-per-tbsp for this food.');
  }

  if (food.baseUnit === 'g' && unit === 'tbsp') {
    return amount * gpt;
  }
  if (food.baseUnit === 'tbsp' && unit === 'g') {
    return amount / gpt;
  }

  throw new Error('Unsupported unit conversion.');
}
