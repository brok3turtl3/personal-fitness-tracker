import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { StorageService } from './storage.service';
import { AppData } from '../models/app-data.model';
import { WeightEntry } from '../models/weight-entry.model';
import { CardioSession } from '../models/cardio-session.model';
import { HealthReading } from '../models/health-reading.model';
import { MealEntry } from '../models/diet.model';

@Injectable({
  providedIn: 'root'
})
export class FitnessContextService {
  constructor(private storageService: StorageService) {}

  buildSystemPrompt(): Observable<string> {
    return this.storageService.getData().pipe(
      map(data => {
        const snapshot = data ? this.buildFitnessDataSnapshot(data) : 'No fitness data recorded yet.';
        return `You are a knowledgeable health and fitness expert and personal assistant.
You are working with the user as their dedicated fitness advisor. You have
access to their tracked fitness data below. Reference their actual data
when relevant. Be supportive, evidence-based, and concise.

Remember key details from our conversations — the user's goals, preferences,
injuries, and any context they share with you.

## Current Fitness Data (as of ${new Date().toISOString()})

${snapshot}`;
      })
    );
  }

  private buildFitnessDataSnapshot(data: AppData): string {
    const sections: string[] = [];

    sections.push(this.buildWeightSection(data.weightEntries));
    sections.push(this.buildCardioSection(data.cardioSessions));
    sections.push(this.buildHealthSection(data.healthReadings));
    sections.push(this.buildNutritionSection(data.mealEntries));

    return sections.join('\n\n');
  }

  private buildWeightSection(entries: WeightEntry[]): string {
    if (entries.length === 0) {
      return '### Weight Trend\nNo weight entries recorded.';
    }

    const sorted = [...entries].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latest = sorted[0];
    const latestDate = new Date(latest.date).toLocaleDateString();

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const last7 = sorted.filter(e => new Date(e.date).getTime() >= sevenDaysAgo);
    const avg7 = last7.length > 0
      ? (last7.reduce((sum, e) => sum + e.weightLbs, 0) / last7.length).toFixed(1)
      : 'N/A';

    const thirtyDayEntries = sorted.filter(e => new Date(e.date).getTime() >= thirtyDaysAgo);
    let changeStr = 'N/A';
    if (thirtyDayEntries.length >= 2) {
      const oldest = thirtyDayEntries[thirtyDayEntries.length - 1];
      const change = latest.weightLbs - oldest.weightLbs;
      const direction = change >= 0 ? '+' : '';
      changeStr = `${direction}${change.toFixed(1)} lbs`;
    }

    return `### Weight Trend
- Latest: ${latest.weightLbs} lbs on ${latestDate}
- 7-day avg: ${avg7} lbs | 30-day change: ${changeStr}`;
  }

  private buildCardioSection(sessions: CardioSession[]): string {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recent = sessions.filter(s => new Date(s.date).getTime() >= sevenDaysAgo);

    if (recent.length === 0) {
      return '### Recent Cardio (last 7 days)\nNo cardio sessions in the last 7 days.';
    }

    const totalMin = recent.reduce((sum, s) => sum + s.durationMinutes, 0);
    const typeCounts = new Map<string, number>();
    for (const s of recent) {
      typeCounts.set(s.type, (typeCounts.get(s.type) ?? 0) + 1);
    }
    const breakdown = Array.from(typeCounts.entries())
      .map(([type, count]) => `${type} (${count})`)
      .join(', ');

    return `### Recent Cardio (last 7 days)
- ${recent.length} sessions, ${totalMin} min total
- Types: ${breakdown}`;
  }

  private buildHealthSection(readings: HealthReading[]): string {
    if (readings.length === 0) {
      return '### Latest Health Readings\nNo health readings recorded.';
    }

    const sorted = [...readings].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const lines: string[] = ['### Latest Health Readings'];

    const latestBP = sorted.find(r => r.type === 'blood_pressure');
    if (latestBP && latestBP.type === 'blood_pressure') {
      lines.push(`- BP: ${latestBP.systolic}/${latestBP.diastolic} mmHg (${new Date(latestBP.date).toLocaleDateString()})`);
    }

    const latestGlucose = sorted.find(r => r.type === 'blood_glucose');
    if (latestGlucose && latestGlucose.type === 'blood_glucose') {
      lines.push(`- Glucose: ${latestGlucose.glucoseMmol} mmol/L (${new Date(latestGlucose.date).toLocaleDateString()})`);
    }

    const latestKetone = sorted.find(r => r.type === 'ketone');
    if (latestKetone && latestKetone.type === 'ketone') {
      lines.push(`- Ketones: ${latestKetone.ketoneMmol} mmol/L (${new Date(latestKetone.date).toLocaleDateString()})`);
    }

    if (lines.length === 1) {
      lines.push('No recent health readings.');
    }

    return lines.join('\n');
  }

  private buildNutritionSection(meals: MealEntry[]): string {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recent = meals.filter(m => new Date(m.dateTime).getTime() >= sevenDaysAgo);

    if (recent.length === 0) {
      return '### Nutrition (7-day daily average)\nNo meal entries in the last 7 days.';
    }

    const totals = { cal: 0, p: 0, f: 0, c: 0, fi: 0, nc: 0 };
    for (const meal of recent) {
      totals.cal += meal.totals.caloriesKcal;
      totals.p += meal.totals.proteinG;
      totals.f += meal.totals.fatG;
      totals.c += meal.totals.carbsG;
      totals.fi += meal.totals.fiberG;
      totals.nc += meal.totals.netCarbsG;
    }

    // Calculate days with entries for daily average
    const uniqueDays = new Set(
      recent.map(m => new Date(m.dateTime).toDateString())
    );
    const days = uniqueDays.size;

    const avg = (v: number) => Math.round(v / days);

    return `### Nutrition (7-day daily average)
- ${avg(totals.cal)} kcal | P: ${avg(totals.p)}g | F: ${avg(totals.f)}g | C: ${avg(totals.c)}g | Fiber: ${avg(totals.fi)}g | Net carbs: ${avg(totals.nc)}g`;
  }
}
