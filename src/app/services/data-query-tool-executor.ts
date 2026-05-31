import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WeightService } from './weight.service';
import { CardioService } from './cardio.service';
import { ReadingsService } from './readings.service';
import { DietService } from './diet.service';
import type { ToolDefinition, ToolExecutor } from './tool-registry.service';
import { HealthReading, HealthReadingType } from '../models/health-reading.model';
import { WeightEntry } from '../models/weight-entry.model';
import { CardioSession } from '../models/cardio-session.model';
import { MealEntry, NutritionTotals } from '../models/diet.model';

/**
 * Six read-only `query_*` data tools (CHAT-02) wrapping the existing domain
 * services with BOUNDED, summarized string output (D-14).
 *
 * Design (per 04-RESEARCH "Alternatives Considered" + 04-PATTERNS):
 *   - ONE injectable service holding SIX thin per-name `ToolExecutor` adapters
 *     (`executors`). This is the simplest fit against the existing
 *     `ToolRegistryService.register(executor)` API, which keys a single
 *     `definition.name`. `ToolRegistryService` iterates `executors` and
 *     registers each one in its constructor.
 *
 * Safety contract:
 *   - SDK-agnostic: imports zero Anthropic SDK types (D-17 chokepoint preserved).
 *   - Read-only: injects the domain services only — never the storage layer,
 *     never browser storage APIs (CLAUDE.md chokepoint). The domain getters return
 *     `Observable<T[]>` and perform zero writes (E5).
 *   - Bounded: each handler `firstValueFrom`s the FULL list, filters by the
 *     model-supplied `from`/`to` (and `type` for readings), then caps +
 *     summarizes. Wide ranges return an aggregate header + the most-recent N
 *     rows, never the whole dataset (E6 / Pitfall 6 — token-budget protection).
 *   - Invalid/out-of-range input returns a readable `Error: …` string and
 *     NEVER throws through to storage. Read-only ⇒ no `validators.ts` write
 *     gate is needed here (that gate is only the memory write executor, D-14).
 */
@Injectable({ providedIn: 'root' })
export class DataQueryToolExecutor {
  /** Rows above this threshold are summarized rather than dumped verbatim. */
  private static readonly SUMMARIZE_THRESHOLD = 60;
  /** Most-recent rows surfaced when summarizing a wide range. */
  private static readonly RECENT_N = 20;
  /** Hard cap on iterated days for range queries (DoS guard). */
  private static readonly MAX_RANGE_DAYS = 1000;

  readonly executors: ToolExecutor[];

  constructor(
    private weight: WeightService,
    private cardio: CardioService,
    private readings: ReadingsService,
    private diet: DietService
  ) {
    this.executors = [
      this.makeAdapter(
        'query_cardio_sessions',
        'Read-only. Returns the user logged cardio sessions in an optional ISO date range (from/to, YYYY-MM-DD). Output is BOUNDED: wide ranges return aggregate stats plus the most recent sessions, not the full list.',
        (input) => this.queryCardioSessions(input)
      ),
      this.makeAdapter(
        'query_weight_entries',
        'Read-only. Returns the user weight entries (lbs) in an optional ISO date range (from/to, YYYY-MM-DD). Output is BOUNDED: wide ranges return min/max/avg plus the most recent entries, not every row.',
        (input) => this.queryWeightEntries(input)
      ),
      this.makeAdapter(
        'query_readings',
        'Read-only. Returns health readings (blood_pressure | blood_glucose | ketone) in an optional ISO date range (from/to). Pass `type` to filter to one kind. Output is BOUNDED: wide ranges summarize and cap.',
        (input) => this.queryReadings(input)
      ),
      this.makeAdapter(
        'query_meals_in_range',
        'Read-only. Returns logged meals across an ISO date range (from/to, YYYY-MM-DD). Output is BOUNDED: wide ranges return per-day calorie totals plus the most recent meals, not every meal.',
        (input) => this.queryMealsInRange(input)
      ),
      this.makeAdapter(
        'query_daily_totals',
        'Read-only. Returns aggregated daily nutrition totals (calories, protein, fat, carbs, net carbs) across an ISO date range (from/to). Output is BOUNDED and summarized.',
        (input) => this.queryDailyTotals(input)
      ),
      this.makeAdapter(
        'query_saved_foods',
        'Read-only. Returns the user saved-foods library (name + per-unit nutrition). Output is BOUNDED: large libraries return a count plus a capped alphabetical sample.',
        (input) => this.querySavedFoods(input)
      ),
    ];
  }

  /** Builds one thin per-name adapter with a strict, custom tool definition. */
  private makeAdapter(
    name: string,
    description: string,
    handler: (input: unknown) => Promise<string>
  ): ToolExecutor {
    const definition: ToolDefinition = {
      type: 'custom',
      name,
      description,
      strict: true,
      input_schema: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            description: 'Inclusive start date, ISO YYYY-MM-DD (optional).',
          },
          to: {
            type: 'string',
            description: 'Inclusive end date, ISO YYYY-MM-DD (optional).',
          },
          ...(name === 'query_readings'
            ? {
                type: {
                  type: 'string',
                  enum: ['blood_pressure', 'blood_glucose', 'ketone'],
                  description: 'Optional reading-type filter.',
                },
              }
            : {}),
        },
        additionalProperties: false,
      },
    };
    return {
      definition,
      execute: (input: unknown) => handler(input),
    };
  }

  // --- Handlers ------------------------------------------------------------

  private async queryWeightEntries(input: unknown): Promise<string> {
    try {
      const range = this.parseRange(input);
      const all = await firstValueFrom(this.weight.getEntries());
      const rows = all.filter((e) => this.inRange(e.date, range));
      if (rows.length === 0) return 'No weight entries found for the given range.';

      const values = rows.map((r) => r.weightLbs);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const header =
        `Weight entries: ${rows.length} total, span ${this.span(rows.map((r) => r.date))}. ` +
        `min ${min.toFixed(1)} / max ${max.toFixed(1)} / avg ${avg.toFixed(1)} lbs.`;

      const sample =
        rows.length > DataQueryToolExecutor.SUMMARIZE_THRESHOLD
          ? rows.slice(0, DataQueryToolExecutor.RECENT_N)
          : rows;
      const lines = sample.map(
        (r) => `${this.day(r.date)}: ${r.weightLbs.toFixed(1)} lbs`
      );
      return this.compose(header, sample.length, rows.length, lines);
    } catch (err) {
      return this.errString(err);
    }
  }

  private async queryCardioSessions(input: unknown): Promise<string> {
    try {
      const range = this.parseRange(input);
      const all = await firstValueFrom(this.cardio.getSessions());
      const rows = all.filter((e) => this.inRange(e.date, range));
      if (rows.length === 0) return 'No cardio sessions found for the given range.';

      const totalMin = rows.reduce((a, s) => a + s.durationMinutes, 0);
      const totalKm = rows.reduce((a, s) => a + (s.distanceKm ?? 0), 0);
      const header =
        `Cardio sessions: ${rows.length} total, span ${this.span(rows.map((r) => r.date))}. ` +
        `${totalMin} min, ${totalKm.toFixed(1)} km combined.`;

      const sample =
        rows.length > DataQueryToolExecutor.SUMMARIZE_THRESHOLD
          ? rows.slice(0, DataQueryToolExecutor.RECENT_N)
          : rows;
      const lines = sample.map((s: CardioSession) => {
        const dist = s.distanceKm !== undefined ? `, ${s.distanceKm} km` : '';
        return `${this.day(s.date)}: ${s.type} ${s.durationMinutes} min${dist}`;
      });
      return this.compose(header, sample.length, rows.length, lines);
    } catch (err) {
      return this.errString(err);
    }
  }

  private async queryReadings(input: unknown): Promise<string> {
    try {
      const range = this.parseRange(input);
      const type = this.parseReadingType(input);
      const all = await firstValueFrom(this.readings.getReadings(type));
      const rows = all.filter((e) => this.inRange(e.date, range));
      if (rows.length === 0) {
        return `No${type ? ` ${type}` : ''} readings found for the given range.`;
      }

      const header =
        `Readings${type ? ` (${type})` : ''}: ${rows.length} total, span ${this.span(
          rows.map((r) => r.date)
        )}.`;
      const sample =
        rows.length > DataQueryToolExecutor.SUMMARIZE_THRESHOLD
          ? rows.slice(0, DataQueryToolExecutor.RECENT_N)
          : rows;
      const lines = sample.map((r) => `${this.day(r.date)}: ${this.readingValue(r)}`);
      return this.compose(header, sample.length, rows.length, lines);
    } catch (err) {
      return this.errString(err);
    }
  }

  private async querySavedFoods(input: unknown): Promise<string> {
    try {
      this.assertObjectIfPresent(input);
      const foods = await firstValueFrom(this.diet.getSavedFoods());
      if (foods.length === 0) return 'No saved foods in the library.';

      const header = `Saved foods: ${foods.length} total.`;
      const sample =
        foods.length > DataQueryToolExecutor.SUMMARIZE_THRESHOLD
          ? foods.slice(0, DataQueryToolExecutor.RECENT_N)
          : foods;
      const lines = sample.map(
        (f) =>
          `${f.name}: ${f.nutrientsPerUnit.caloriesKcal} kcal/${f.baseUnit}, ` +
          `${f.nutrientsPerUnit.proteinG}g protein/${f.baseUnit}`
      );
      return this.compose(header, sample.length, foods.length, lines);
    } catch (err) {
      return this.errString(err);
    }
  }

  private async queryMealsInRange(input: unknown): Promise<string> {
    try {
      const range = this.requireRange(input);
      const byDay = await this.mealsByDay(range);
      const meals = byDay.flatMap((d) => d.meals);
      if (meals.length === 0) return 'No meals logged for the given range.';

      const totalKcal = meals.reduce((a, m) => a + m.totals.caloriesKcal, 0);
      const header =
        `Meals: ${meals.length} across ${byDay.length} day(s) (${range.from}..${range.to}). ` +
        `${Math.round(totalKcal)} kcal combined.`;

      const sorted = meals
        .slice()
        .sort(
          (a, b) =>
            new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
        );
      const sample =
        sorted.length > DataQueryToolExecutor.SUMMARIZE_THRESHOLD
          ? sorted.slice(0, DataQueryToolExecutor.RECENT_N)
          : sorted;
      const lines = sample.map(
        (m: MealEntry) =>
          `${this.day(m.dateTime)} ${m.mealType ?? 'meal'}: ${Math.round(
            m.totals.caloriesKcal
          )} kcal`
      );
      return this.compose(header, sample.length, meals.length, lines);
    } catch (err) {
      return this.errString(err);
    }
  }

  private async queryDailyTotals(input: unknown): Promise<string> {
    try {
      const range = this.requireRange(input);
      const byDay = await this.mealsByDay(range);
      const days = byDay.filter((d) => d.meals.length > 0);
      if (days.length === 0) return 'No daily totals available for the given range.';

      const perDay = days.map((d) => ({
        day: d.day,
        // Sum each meal's snapshot totals directly (read-only, self-contained —
        // matches DietService.computeDailyTotals semantics without depending on
        // it, so the handler stays a pure aggregation over the fetched meals).
        totals: this.sumNutrition(d.meals.map((m) => m.totals)),
      }));
      const grand = this.sumNutrition(perDay.map((d) => d.totals));
      const avgKcal = grand.caloriesKcal / perDay.length;
      const header =
        `Daily totals across ${perDay.length} day(s) (${range.from}..${range.to}): ` +
        `avg ${Math.round(avgKcal)} kcal/day, ${Math.round(grand.caloriesKcal)} kcal total.`;

      const sample =
        perDay.length > DataQueryToolExecutor.SUMMARIZE_THRESHOLD
          ? perDay.slice(-DataQueryToolExecutor.RECENT_N)
          : perDay;
      const lines = sample.map(
        (d) =>
          `${d.day}: ${Math.round(d.totals.caloriesKcal)} kcal, ` +
          `P ${Math.round(d.totals.proteinG)} / F ${Math.round(d.totals.fatG)} / ` +
          `C ${Math.round(d.totals.carbsG)} / net ${Math.round(d.totals.netCarbsG)} g`
      );
      return this.compose(header, sample.length, perDay.length, lines);
    } catch (err) {
      return this.errString(err);
    }
  }

  // --- Helpers -------------------------------------------------------------

  /** Per-day meal fetch across a range, iterating local days (D-14). */
  private async mealsByDay(
    range: { from: string; to: string }
  ): Promise<Array<{ day: string; meals: MealEntry[] }>> {
    const result: Array<{ day: string; meals: MealEntry[] }> = [];
    const cursor = new Date(`${range.from}T00:00:00`);
    const end = new Date(`${range.to}T00:00:00`);
    let guard = 0;
    while (cursor.getTime() <= end.getTime()) {
      if (++guard > DataQueryToolExecutor.MAX_RANGE_DAYS) {
        throw new Error(
          `range too large: exceeds ${DataQueryToolExecutor.MAX_RANGE_DAYS} days`
        );
      }
      const day = cursor.toISOString().slice(0, 10);
      const meals = await firstValueFrom(this.diet.getMealsForDay(day));
      result.push({ day, meals });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  private compose(
    header: string,
    shown: number,
    total: number,
    lines: string[]
  ): string {
    const note =
      shown < total
        ? `\n(showing most recent ${shown} of ${total} — output bounded)`
        : '';
    return `${header}\n${lines.join('\n')}${note}`;
  }

  private readingValue(r: HealthReading): string {
    switch (r.type) {
      case 'blood_pressure':
        return `BP ${r.systolic}/${r.diastolic} mmHg`;
      case 'blood_glucose':
        return `glucose ${r.glucoseMmol} mmol/L`;
      case 'ketone':
        return `ketone ${r.ketoneMmol} mmol/L`;
    }
  }

  private sumNutrition(list: NutritionTotals[]): NutritionTotals {
    return list.reduce(
      (acc, t) => {
        acc.caloriesKcal += t.caloriesKcal;
        acc.proteinG += t.proteinG;
        acc.fatG += t.fatG;
        acc.carbsG += t.carbsG;
        acc.fiberG += t.fiberG;
        acc.sugarG += t.sugarG;
        acc.sodiumMg += t.sodiumMg;
        acc.netCarbsG += t.netCarbsG;
        return acc;
      },
      {
        caloriesKcal: 0,
        proteinG: 0,
        fatG: 0,
        carbsG: 0,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0,
        netCarbsG: 0,
      } as NutritionTotals
    );
  }

  /** Returns the local-day portion (YYYY-MM-DD) of an ISO date string. */
  private day(iso: string): string {
    return iso.slice(0, 10);
  }

  private span(dates: string[]): string {
    if (dates.length === 0) return 'n/a';
    const sorted = dates.map((d) => this.day(d)).sort();
    return `${sorted[0]}..${sorted[sorted.length - 1]}`;
  }

  /** Parse optional from/to; throws on unparseable or inverted range. */
  private parseRange(input: unknown): { from?: string; to?: string } {
    this.assertObjectIfPresent(input);
    const obj = isObject(input) ? input : {};
    const from = this.coerceDate(obj['from'], 'from');
    const to = this.coerceDate(obj['to'], 'to');
    if (from && to && from > to) {
      throw new Error(`invalid range: from (${from}) is after to (${to})`);
    }
    return {
      from: from ?? undefined,
      to: to ?? undefined,
    };
  }

  /** Like parseRange but both ends required (range-mandatory tools). */
  private requireRange(input: unknown): { from: string; to: string } {
    const { from, to } = this.parseRange(input);
    if (!from || !to) {
      throw new Error('both `from` and `to` (ISO YYYY-MM-DD) are required');
    }
    return { from, to };
  }

  private parseReadingType(input: unknown): HealthReadingType | undefined {
    if (!isObject(input)) return undefined;
    const t = input['type'];
    if (t === undefined) return undefined;
    if (t === 'blood_pressure' || t === 'blood_glucose' || t === 'ketone') {
      return t;
    }
    throw new Error(`invalid reading type: ${String(t)}`);
  }

  /** Returns YYYY-MM-DD for a valid date arg, undefined if absent; throws if invalid. */
  private coerceDate(value: unknown, field: string): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') {
      throw new Error(`invalid ${field}: must be an ISO date string`);
    }
    const t = new Date(value).getTime();
    if (!Number.isFinite(t)) {
      throw new Error(`invalid ${field}: unparseable date "${value}"`);
    }
    return this.day(value);
  }

  private inRange(date: string, range: { from?: string; to?: string }): boolean {
    const d = this.day(date);
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    return true;
  }

  private assertObjectIfPresent(input: unknown): void {
    if (input !== undefined && input !== null && !isObject(input)) {
      throw new Error(`tool input must be an object, got ${typeof input}`);
    }
  }

  private errString(err: unknown): string {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
