import { describe, expect, it } from 'vitest';
import { runRules, RULES } from '@/domain/insights/engine';
import { aggressiveDeficit } from '@/domain/insights/rules/aggressive-deficit';
import { bedtimeCaffeine } from '@/domain/insights/rules/bedtime-caffeine';
import { cognitiveLoad } from '@/domain/insights/rules/cognitive-load';
import { falsePlateau } from '@/domain/insights/rules/false-plateau';
import { lateEating } from '@/domain/insights/rules/late-eating';
import { lunchDrift } from '@/domain/insights/rules/lunch-drift';
import { proteinShortfall } from '@/domain/insights/rules/protein-shortfall';
import { sleepMidpointDrift } from '@/domain/insights/rules/sleep-midpoint-drift';
import { truePlateau } from '@/domain/insights/rules/true-plateau';
import type { DayContext, PeriodContext, WeighInContext } from '@/domain/insights/types';

const date = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);

function day(i: number, over: Partial<DayContext> = {}): DayContext {
  return {
    date: date(i), meals: [], intakeKcal: 1800, intakeComplete: true, proteinG: 150, proteinTargetG: 144,
    formulaTdee: 2400, tdee: 2400, deficit: 600, formulaDeficit: 600, highFocusH: 2, caffeineDoses: [], ...over,
  };
}

function weigh(i: number, weight: number, over: Partial<WeighInContext> = {}): WeighInContext {
  return { date: date(i), weight, trend: weight, highSodium: false, normalDigestion: true, compliant: true, ...over };
}

function ctx(over: Partial<PeriodContext> = {}): PeriodContext {
  return {
    days: Array.from({ length: 14 }, (_, i) => day(i)), weighIns: [],
    settings: { caffeineHalfLifeH: 5, kcalPerKg: 7700, timezone: 'UTC' }, weightKg: 80, observedTdee: null, trackingDay: 40, ...over,
  };
}

const lunch = (i: number, drift: number | null, kcal = 700) => ({ type: 'lunch' as const, driftMin: drift, kcal, protein: 30, actualAt: new Date(`${date(i)}T13:00:00Z`) });

describe('engine', () => {
  it('registers 9 unique rules', () => expect(new Set(RULES.map((r) => r.code)).size).toBe(9));
  it('quiet context → no insights', () => expect(runRules(ctx({ days: [day(0)] }))).toEqual([]));
});

describe('LUNCH_DRIFT', () => {
  it('90 min does not fire, 91 fires with regular-lunch comparison', () => {
    const c = ctx({ days: [day(0, { meals: [lunch(0, 90)] }), day(1, { meals: [lunch(1, 91, 950)] }), day(2, { meals: [lunch(2, 10, 650)] })] });
    const r = lunchDrift.evaluate(c);
    expect(r).toHaveLength(1);
    expect(r[0]!.periodStart).toBe(date(1));
    expect(r[0]!.payload).toMatchObject({ driftMin: 91, lunchKcal: 950, regularLunchAvgKcal: 650 });
  });
});

describe('COGNITIVE_LOAD', () => {
  it('> 5 h fires, never touches TDEE', () => {
    const r = cognitiveLoad.evaluate(ctx({ days: [day(0, { highFocusH: 5 }), day(1, { highFocusH: 6.5 })] }));
    expect(r).toHaveLength(1);
    expect(r[0]!.payload).toMatchObject({ proteinBoostG: 16 });
  });
});

describe('FALSE_PLATEAU', () => {
  const stalled = [weigh(0, 80), weigh(7, 80.1, { highSodium: true }), weigh(13, 80)];
  it('fires on stall with sodium flag', () => {
    const r = falsePlateau.evaluate(ctx({ weighIns: stalled }));
    expect(r).toHaveLength(1);
    expect(r[0]!.payload).toMatchObject({ completeDays: 14 });
  });
  it('does not fire without noise flags', () =>
    expect(falsePlateau.evaluate(ctx({ weighIns: [weigh(0, 80), weigh(7, 80.1), weigh(13, 80)] }))).toEqual([]));
  it('fewer than 7 complete days → no fire (A2)', () => {
    const days = Array.from({ length: 14 }, (_, i) => day(i, { intakeComplete: i < 6 }));
    expect(falsePlateau.evaluate(ctx({ days, weighIns: stalled }))).toEqual([]);
  });
  it('decision follows formulaDeficit, not the blended deficit (A3)', () => {
    const days = Array.from({ length: 14 }, (_, i) => day(i, { deficit: 50, formulaDeficit: 600 }));
    expect(falsePlateau.evaluate(ctx({ days, weighIns: stalled }))).toHaveLength(1);
    const small = Array.from({ length: 14 }, (_, i) => day(i, { deficit: 600, formulaDeficit: 50 }));
    expect(falsePlateau.evaluate(ctx({ days: small, weighIns: stalled }))).toEqual([]);
  });
  it('real loss → no fire', () =>
    expect(falsePlateau.evaluate(ctx({ weighIns: [weigh(0, 80), weigh(7, 79.4, { highSodium: true }), weigh(13, 79)] }))).toEqual([]));
  it('fires on short sleep', () => {
    const days = Array.from({ length: 14 }, (_, i) => day(i, { sleep: { tstMin: 300, efficiencyPct: 80, bedAt: new Date(`${date(i)}T23:00:00Z`) } }));
    expect(falsePlateau.evaluate(ctx({ days, weighIns: [weigh(0, 80), weigh(7, 80.1), weigh(13, 80)] }))[0]!.payload).toMatchObject({ avgSleepH: 5 });
  });
});

describe('TRUE_PLATEAU', () => {
  const days = Array.from({ length: 28 }, (_, i) => day(i));
  const flat = [weigh(0, 80), weigh(7, 80.1), weigh(14, 80), weigh(21, 80.05), weigh(27, 80)];
  it('fires on 21+ day stall without noise', () => {
    const r = truePlateau.evaluate(ctx({ days, weighIns: flat, observedTdee: 1850 }));
    expect(r).toHaveLength(1);
    expect(r[0]!.message).toContain('1850');
  });
  it('noise flag suppresses it', () =>
    expect(truePlateau.evaluate(ctx({ days, weighIns: flat.map((w, i) => (i === 2 ? { ...w, normalDigestion: false } : w)) }))).toEqual([]));
  it('short window → no fire', () => expect(truePlateau.evaluate(ctx({ weighIns: [weigh(0, 80), weigh(13, 80)] }))).toEqual([]));
});

describe('BEDTIME_CAFFEINE', () => {
  const bedAt = new Date(`${date(1)}T23:00:00Z`);
  const sleep = { tstMin: 420, efficiencyPct: 90, bedAt };
  it('fires above 100 mg and suggests the final-cup cutoff (A11)', () => {
    const doses = [{ mg: 198, at: new Date(`${date(1)}T09:00:00Z`) }, { mg: 198, at: new Date(`${date(1)}T17:00:00Z`) }];
    const r = bedtimeCaffeine.evaluate(ctx({ days: [day(1, { caffeineDoses: doses, sleep })] }));
    expect(r).toHaveLength(1);
    expect(r[0]!.payload.residualMg as number).toBeCloseTo(114.6, 0);
    expect(r[0]!.message).toContain('15:39');
  });
  it('does not fire below the limit', () =>
    expect(bedtimeCaffeine.evaluate(ctx({ days: [day(1, { caffeineDoses: [{ mg: 198, at: new Date(`${date(1)}T09:00:00Z`) }], sleep })] }))).toEqual([]));
  it('prior cups alone exceed the limit → advises cutting total', () => {
    const doses = [{ mg: 400, at: new Date(`${date(1)}T19:00:00Z`) }, { mg: 50, at: new Date(`${date(1)}T21:00:00Z`) }];
    const r = bedtimeCaffeine.evaluate(ctx({ days: [day(1, { caffeineDoses: doses, sleep })] }));
    expect(r[0]!.payload.latestFinalCupAt).toBeNull();
  });
});

describe('LATE_EATING', () => {
  const bedAt = new Date(`${date(1)}T23:00:00Z`);
  const meal = (h: string) => ({ type: 'dinner' as const, driftMin: null, kcal: 600, protein: 30, actualAt: new Date(`${date(1)}T${h}:00Z`) });
  it('fires under 3 h', () =>
    expect(lateEating.evaluate(ctx({ days: [day(1, { meals: [meal('21:00')], sleep: { tstMin: 420, efficiencyPct: 90, bedAt } })] }))).toHaveLength(1));
  it('3 h exactly does not fire', () =>
    expect(lateEating.evaluate(ctx({ days: [day(1, { meals: [meal('20:00')], sleep: { tstMin: 420, efficiencyPct: 90, bedAt } })] }))).toEqual([]));
  it('no meals → nothing', () =>
    expect(lateEating.evaluate(ctx({ days: [day(1, { sleep: { tstMin: 420, efficiencyPct: 90, bedAt } })] }))).toEqual([]));
});

describe('PROTEIN_SHORT', () => {
  it('3 of last 5 complete days short → fires', () => {
    const days = [0, 1, 2, 3, 4].map((i) => day(i, { proteinG: i % 2 === 0 ? 100 : 150 }));
    expect(proteinShortfall.evaluate(ctx({ days }))).toHaveLength(1);
  });
  it('incomplete days are ignored', () => {
    const days = [0, 1, 2, 3, 4].map((i) => day(i, { proteinG: 50, intakeComplete: i < 2 }));
    expect(proteinShortfall.evaluate(ctx({ days }))).toEqual([]);
  });
  it('only 2 short days → no fire', () => {
    const days = [0, 1, 2, 3, 4].map((i) => day(i, { proteinG: i < 2 ? 100 : 150 }));
    expect(proteinShortfall.evaluate(ctx({ days }))).toEqual([]);
  });
});

describe('AGGRESSIVE_DEFICIT', () => {
  const fast = [weigh(0, 80), weigh(4, 79.3), weigh(9, 78.5), weigh(13, 77.8)]; // ~1.4%/week
  it('suppressed during grace period (A6): trackingDay 20', () =>
    expect(aggressiveDeficit.evaluate(ctx({ weighIns: fast, trackingDay: 20 }))).toEqual([]));
  it('fires at trackingDay 30', () => {
    const r = aggressiveDeficit.evaluate(ctx({ weighIns: fast, trackingDay: 30 }));
    expect(r).toHaveLength(1);
    expect(r[0]!.payload.weeklyLossPct as number).toBeGreaterThan(0.01);
  });
  it('safe pace → no fire', () =>
    expect(aggressiveDeficit.evaluate(ctx({ weighIns: [weigh(0, 80), weigh(7, 79.6), weigh(13, 79.2)], trackingDay: 30 }))).toEqual([]));
  it('too few readings → no fire', () =>
    expect(aggressiveDeficit.evaluate(ctx({ weighIns: [weigh(0, 80), weigh(13, 77)], trackingDay: 30 }))).toEqual([]));
});

describe('SLEEP_MIDPOINT_DRIFT', () => {
  // 2026-01-01 is Thursday (i=0: Thu, i=1: Fri, i=2: Sat, i=3: Sun, i=4: Mon, i=5: Tue)
  const nightEndingOn = (i: number, onsetIso: string, wakeIso: string) =>
    day(i, {
      sleep: {
        tstMin: 480,
        efficiencyPct: 90,
        bedAt: new Date(onsetIso),
        onsetAt: new Date(onsetIso),
        wakeAt: new Date(wakeIso),
      },
    });

  it('fires when circular midpoint drifts >= 90 min across midnight (e.g., 23:30 work vs 01:30 weekend)', () => {
    // Workdays (Thu 01-01, Fri 01-02, Mon 01-05): sleep 19:30 -> 03:30 => midpoint 23:30
    // Weekends (Sat 01-03, Sun 01-04): sleep 21:30 -> 05:30 => midpoint 01:30 (drift = 120 min)
    const days = [
      nightEndingOn(0, '2025-12-31T19:30:00Z', '2026-01-01T03:30:00Z'),
      nightEndingOn(1, '2026-01-01T19:30:00Z', '2026-01-02T03:30:00Z'),
      nightEndingOn(2, '2026-01-02T21:30:00Z', '2026-01-03T05:30:00Z'),
      nightEndingOn(3, '2026-01-03T21:30:00Z', '2026-01-04T05:30:00Z'),
      nightEndingOn(4, '2026-01-04T19:30:00Z', '2026-01-05T03:30:00Z'),
    ];
    const r = sleepMidpointDrift.evaluate(ctx({ days }));
    expect(r).toHaveLength(1);
    expect(r[0]!.severity).toBe('warning');
    expect(r[0]!.payload).toEqual({
      workdayMidpointClock: '23:30',
      freedayMidpointClock: '01:30',
      driftMinutes: 120,
      workdayNights: 3,
      freedayNights: 2,
    });
  });

  it('fires with info severity when drift is between 90 and 119 minutes', () => {
    // Workdays: 23:00 -> 07:00 => midpoint 03:00; Weekends: 00:35 -> 08:35 => midpoint 04:35 (drift = 95 min)
    const days = [
      nightEndingOn(0, '2025-12-31T23:00:00Z', '2026-01-01T07:00:00Z'),
      nightEndingOn(1, '2026-01-01T23:00:00Z', '2026-01-02T07:00:00Z'),
      nightEndingOn(2, '2026-01-03T00:35:00Z', '2026-01-03T08:35:00Z'),
      nightEndingOn(3, '2026-01-04T00:35:00Z', '2026-01-04T08:35:00Z'),
      nightEndingOn(4, '2026-01-04T23:00:00Z', '2026-01-05T07:00:00Z'),
    ];
    const r = sleepMidpointDrift.evaluate(ctx({ days }));
    expect(r).toHaveLength(1);
    expect(r[0]!.severity).toBe('info');
    expect(r[0]!.payload.driftMinutes).toBe(95);
  });

  it('does not fire when drift is below 90 minutes', () => {
    const days = [
      nightEndingOn(0, '2025-12-31T23:00:00Z', '2026-01-01T07:00:00Z'),
      nightEndingOn(1, '2026-01-01T23:00:00Z', '2026-01-02T07:00:00Z'),
      nightEndingOn(2, '2026-01-03T00:00:00Z', '2026-01-03T08:00:00Z'),
      nightEndingOn(3, '2026-01-04T00:00:00Z', '2026-01-04T08:00:00Z'),
      nightEndingOn(4, '2026-01-04T23:00:00Z', '2026-01-05T07:00:00Z'),
    ];
    expect(sleepMidpointDrift.evaluate(ctx({ days }))).toEqual([]);
  });

  it('does not fire when fewer than 3 workday or 2 weekend nights are logged', () => {
    const days = [
      nightEndingOn(0, '2025-12-31T22:00:00Z', '2026-01-01T06:00:00Z'),
      nightEndingOn(1, '2026-01-01T22:00:00Z', '2026-01-02T06:00:00Z'),
      nightEndingOn(2, '2026-01-03T02:00:00Z', '2026-01-03T10:00:00Z'),
    ];
    expect(sleepMidpointDrift.evaluate(ctx({ days }))).toEqual([]);
    expect(sleepMidpointDrift.evaluate(ctx({ days: [] }))).toEqual([]);
  });
});
