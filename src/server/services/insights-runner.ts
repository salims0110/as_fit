import { runRules } from '@/domain/insights/engine';
import type { DayContext, PeriodContext } from '@/domain/insights/types';
import { dayNumber } from '@/domain/weight-trend';
import { addDaysIso, todayIn, zonedDateTime } from '@/lib/time';
import { db } from '@/server/db/client';
import { insights } from '@/server/db/schema';
import { getBeveragesBetween, getMealsBetween, getScreenBetween, getSleepBetween, type MealView } from '@/server/queries/logs';
import { getTimezone } from '@/server/queries/profile';
import { MOCK_MODE } from '@/server/mock/mode';
import { loadModel } from './metabolic-model';

const WINDOW_DAYS = 28;

// A meal logged on D at 00:30 for a 23:30 schedule happened on D+1 (drift wraps across midnight)
function mealInstant(m: MealView, tz: string) {
  const crossesMidnight = m.scheduledTime != null && m.driftMin != null && m.driftMin > 0 && m.actualTime < m.scheduledTime;
  return zonedDateTime(crossesMidnight ? addDaysIso(m.date, 1) : m.date, m.actualTime, tz);
}

export async function buildPeriodContext(userId: number, endDate?: string): Promise<PeriodContext | null> {
  const tz = await getTimezone(userId);
  const end = endDate ?? todayIn(tz);
  const start = addDaysIso(end, -(WINDOW_DAYS - 1));

  const [model, mealsRows, bevs, sleeps, screens] = await Promise.all([
    loadModel(userId, start, end),
    getMealsBetween(userId, addDaysIso(start, -1), end),
    getBeveragesBetween(userId, addDaysIso(start, -1), end),
    getSleepBetween(userId, start, end),
    getScreenBetween(userId, start, end),
  ]);
  if (!model) return null;

  const days: DayContext[] = model.days.map((d) => ({
    date: d.date,
    meals: mealsRows.filter((m) => m.date === d.date).map((m) => ({
      type: m.type, driftMin: m.driftMin, kcal: m.kcal, protein: m.protein, actualAt: mealInstant(m, tz),
    })),
    intakeKcal: d.intake.totalKcal,
    intakeComplete: d.intake.intakeComplete,
    proteinG: d.intake.totalProteinG,
    proteinTargetG: d.targets.proteinG,
    formulaTdee: d.formulaTdee,
    tdee: d.tdee,
    deficit: d.deficit,
    formulaDeficit: d.formulaDeficit,
    highFocusH: screens.find((s) => s.date === d.date)?.highFocusH ?? 0,
    sleep: (() => {
      const s = sleeps.find((x) => x.date === d.date);
      return s
        ? {
          tstMin: s.tstMin,
          efficiencyPct: s.tibMin > 0 ? (s.tstMin / s.tibMin) * 100 : 0,
          bedAt: s.bedAt,
          onsetAt: s.onsetAt,
          wakeAt: s.wakeAt,
        }
        : undefined;
    })(),
    caffeineDoses: bevs.filter((b) => b.date === d.date && b.caffeineMg > 0).map((b) => ({ mg: b.caffeineMg, at: b.consumedAt })),
  }));
  // Doses from the day before the window still count toward the first night's residual
  const prior = bevs.filter((b) => b.date < start && b.caffeineMg > 0).map((b) => ({ mg: b.caffeineMg, at: b.consumedAt }));
  if (days[0]) days[0].caffeineDoses = [...prior, ...days[0].caffeineDoses];

  const firstWeighIn = model.weighIns[0];
  return {
    days,
    weighIns: model.weighIns.filter((w) => w.date >= start && w.date <= end && w.trend != null).map((w) => ({
      date: w.date, weight: w.weight, trend: w.trend!, highSodium: w.highSodium, normalDigestion: w.normalDigestion, compliant: w.compliant,
    })),
    settings: { caffeineHalfLifeH: model.settings.caffeineHalfLifeH, kcalPerKg: model.settings.kcalPerKg, timezone: tz },
    weightKg: model.currentWeightKg,
    observedTdee: model.observed?.tdee ?? null,
    trackingDay: firstWeighIn ? dayNumber(end) - dayNumber(firstWeighIn.date) : 0,
  };
}

// Evaluates all rules on the 28-day window ending at endDate and stores new results (deduplicated by period).
export async function runInsights(userId: number, endDate?: string) {
  if (MOCK_MODE) return 0; // mock insights are computed on read (src/server/mock/insights.ts)
  const ctx = await buildPeriodContext(userId, endDate);
  if (!ctx) return 0;
  const results = runRules(ctx);
  if (results.length === 0) return 0;
  const inserted = await db.insert(insights).values(results.map((r) => ({
    userId, ruleCode: r.ruleCode, severity: r.severity, title: r.title, message: r.message,
    payload: r.payload, periodStart: r.periodStart, periodEnd: r.periodEnd,
  }))).onConflictDoNothing().returning({ id: insights.id });
  return inserted.length;
}
