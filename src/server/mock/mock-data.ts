// بيانات المحاكاة — Mock data, used instead of the database when USE_MOCK_DATA=true.
// 90 days ending today, deterministic (seeded), and computed with the same domain functions as real entries,
// so dashboards, charts and insight rules behave exactly as they would with real data.
import { beverageMetrics } from '@/domain/beverages';
import { exerciseKcal } from '@/domain/exercise';
import { clockDriftMin } from '@/domain/meal-timing';
import { portionNutrition, type Basis } from '@/domain/nutrition';
import { addDaysIso, todayIn, zonedDateTime } from '@/lib/time';
import type { IntakeRow } from '@/server/queries/intake';
import type { BeverageView, DrinkView, ExerciseCatalogRow, ExerciseView, FoodView, MealView, MeasurementView, ScreenView, SleepView } from '@/server/queries/views';
import type { Profile, Settings } from '@/server/queries/profile';

export const MOCK_DAYS = 90;
const TZ = 'Europe/Istanbul';

// ───────── Profile & settings ─────────
export const mockProfile: Profile = {
  id: 1, displayName: 'مستخدم تجريبي', gender: 'male', birthDate: '1996-05-10',
  heightCm: 178, initialWeightKg: 88, targetWeightKg: 78, activityFactor: 1.2, createdAt: new Date('2026-01-01T00:00:00Z'),
};

export const mockSettings: Settings = {
  timezone: TZ, plannedDeficit: 500, proteinPerKg: 1.8, useNetMet: true, useKatchMcArdle: false, caffeineMgPerG: 11, caffeineHalfLifeH: 5,
  requiredFastingHours: 14, kcalPerKg: 7700, emaAlpha: 0.1,
  mealSchedule: { breakfast: '08:00', lunch: '13:30', dinner: '19:30' },
};

// ───────── User lists ─────────
const food = (id: number, nameAr: string, basis: Basis, calories: number, protein: number, carbs: number | null, fat: number | null, gramsPerUnit: number | null = null): FoodView =>
  ({ id, nameAr, nameEn: null, basis, gramsPerUnit, calories, protein, carbs, fat, isActive: true });

export const mockFoods: FoodView[] = [
  food(1, 'بيضة كاملة', 'per_unit', 72, 6.3, 0.4, 4.8, 50),
  food(2, 'خبز أسمر', 'per_100g', 247, 13, 41, 3.4),
  food(3, 'صدر دجاج مشوي', 'per_100g', 165, 31, 0, 3.6),
  food(4, 'رز أبيض مطبوخ', 'per_100g', 130, 2.7, 28, 0.3),
  food(5, 'زيت زيتون', 'per_100g', 884, 0, 0, 100),
  food(6, 'تونة بالماء', 'per_100g', 116, 26, 0, 0.8),
  food(7, 'زبادي يوناني', 'per_100g', 73, 10, 3.9, 1.9),
  food(8, 'شوفان', 'per_100g', 389, 16.9, 66, 6.9),
  food(9, 'خيار', 'per_100g', 15, 0.7, 3.6, 0.1),
  food(10, 'تمر', 'per_unit', 23, 0.2, 6, 0, 8),
];

const drink = (id: number, nameAr: string, byCoffeeWeight: boolean, caffeineMgPer100ml: number, kcalPer100ml: number, proteinGPer100ml: number, defaultVolumeMl: number, defaultCoffeeG: number | null = null): DrinkView =>
  ({ id, nameAr, byCoffeeWeight, caffeineMgPer100ml, kcalPer100ml, proteinGPer100ml, defaultVolumeMl, defaultCoffeeG, isActive: true });

export const mockDrinks: DrinkView[] = [
  drink(1, 'قهوة تركية', true, 40, 0, 0, 70, 7),
  drink(2, 'شاي أسود', false, 20, 0, 0, 240),
  drink(3, 'عصير برتقال', false, 0, 45, 0.7, 250),
  drink(4, 'ماء', false, 0, 0, 0, 300),
];

export const mockMealTemplates = [
  {
    id: 1,
    nameAr: 'فطور البيض والخبز الأسمر',
    defaultMealType: 'breakfast' as const,
    items: [
      { foodId: 1, nameAr: 'بيضة كاملة', quantity: 2 },
      { foodId: 2, nameAr: 'خبز أسمر', quantity: 60 },
    ],
  },
  {
    id: 2,
    nameAr: 'غداء دجاج ورز',
    defaultMealType: 'lunch' as const,
    items: [
      { foodId: 3, nameAr: 'صدر دجاج مشوي', quantity: 180 },
      { foodId: 4, nameAr: 'رز أبيض مطبوخ', quantity: 200 },
      { foodId: 5, nameAr: 'زيت زيتون', quantity: 10 },
    ],
  },
];

export const mockExerciseCatalog: ExerciseCatalogRow[] = [
  ['walking_moderate', 'مشي معتدل (~5 كم/س)', '3.5'], ['walking_brisk', 'مشي سريع (~5.6–6.4 كم/س)', '4.3'],
  ['running_8kmh', 'جري (8 كم/س)', '8.3'], ['running_10kmh', 'جري (10 كم/س)', '9.8'],
  ['football_gk_training', 'كرة قدم — حارس مرمى/تدريب', '5.0'], ['football_casual', 'كرة قدم — لعب عام', '7.0'],
  ['football_competitive', 'كرة قدم — مباراة تنافسية', '10.0'], ['home_workout_moderate', 'تمارين منزلية (وزن الجسم) معتدلة', '3.8'],
  ['home_workout_vigorous', 'تمارين منزلية مكثفة / دائرية', '8.0'],
].map(([code, nameAr, defaultMet], i) => ({ id: i + 1, code: code!, nameAr: nameAr!, defaultMet: defaultMet!, compendiumRef: null }))
  .sort((a, b) => Number(a.defaultMet) - Number(b.defaultMet));

// ───────── Generated history ─────────
export type MockExercise = ExerciseView;
export type MockScreen = ScreenView;
export type MockWeighIn = { id: number; logDate: string; measuredAt: Date; weight: number; fastingH: number; compliant: boolean; official: boolean; highSodium: boolean; normalDigestion: boolean };

export type MockDataset = {
  today: string;
  meals: MealView[]; beverages: BeverageView[]; exercises: MockExercise[]; screens: MockScreen[];
  sleeps: SleepView[]; weighIns: MockWeighIn[]; measurements: MeasurementView[]; complete: Set<string>;
};

// mulberry32: small deterministic PRNG so the same day always shows the same data
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const clockPlus = (clock: string, minutes: number) => {
  const total = (((Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5)) + Math.round(minutes)) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

function generate(today: string): MockDataset {
  const rand = rng(20261019);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const chance = (p: number) => rand() < p;
  const foodById = new Map(mockFoods.map((f) => [f.id, f]));
  const exById = new Map(mockExerciseCatalog.map((e) => [e.id, e]));

  const ds: MockDataset = { today, meals: [], beverages: [], exercises: [], screens: [], sleeps: [], weighIns: [], measurements: [], complete: new Set() };
  let mealId = 1, itemId = 1, bevId = 1, exId = 1, sleepId = 1, wId = 1;

  for (let i = MOCK_DAYS - 1; i >= 0; i--) {
    const date = addDaysIso(today, -i);
    const dayIndex = MOCK_DAYS - 1 - i;
    const trueWeight = 88 - 0.068 * dayIndex; // ~0.48 kg/week underlying fat loss

    // Meals
    const mealPlan: { type: MealView['type']; clock: string; items: [number, number][] }[] = [
      { type: 'breakfast', clock: clockPlus('08:00', between(-15, 25)), items: [[1, 2], [2, Math.round(between(50, 80))], ...(chance(0.5) ? [[7, 150] as [number, number]] : [])] },
      { type: 'lunch', clock: clockPlus('13:30', dayIndex % 6 === 3 ? between(95, 140) : between(-10, 40)), items: [[3, Math.round(between(150, 210))], [4, Math.round(between(180, 260))], [5, 10]] },
      { type: 'dinner', clock: clockPlus('19:30', dayIndex % 9 === 4 ? between(150, 190) : between(-20, 30)), items: [[6, Math.round(between(100, 150))], [2, Math.round(between(60, 90))], [9, 200]] },
    ];
    if (chance(0.45)) mealPlan.push({ type: 'snack', clock: clockPlus('17:00', between(-30, 30)), items: chance(0.5) ? [[8, 50]] : [[10, 4]] });
    if (i === 0) mealPlan.splice(2); // today: dinner not eaten yet

    for (const m of mealPlan) {
      const scheduled = m.type === 'snack' ? null : mockSettings.mealSchedule[m.type];
      const items = m.items.map(([foodId, qty]) => {
        const f = foodById.get(foodId)!;
        const n = portionNutrition({ basis: f.basis, calories: f.calories, protein: f.protein }, qty);
        return { id: itemId++, foodId, nameAr: f.nameAr, basis: f.basis, quantity: qty, kcal: n.calories, protein: n.protein };
      });
      ds.meals.push({
        id: mealId++, date, type: m.type, scheduledTime: scheduled, actualTime: m.clock,
        driftMin: scheduled ? clockDriftMin(scheduled, m.clock) : null, notes: null, items,
        kcal: items.reduce((s, x) => s + x.kcal, 0), protein: items.reduce((s, x) => s + x.protein, 0),
      });
    }

    // Beverages (coffee timing drifts later some days → bedtime caffeine insight)
    const coffees = ['09:00', dayIndex % 7 === 2 ? clockPlus('18:30', between(0, 40)) : clockPlus('15:30', between(-30, 30))];
    for (const clock of i === 0 ? coffees.slice(0, 1) : coffees) {
      const d = mockDrinks[0]!;
      const m = beverageMetrics({ drink: d, volumeMl: 70, dryCoffeeG: 7, milkType: 'none', milkMl: 0, sugarTsp: chance(0.3) ? 1 : 0 }, mockSettings.caffeineMgPerG);
      ds.beverages.push({ id: bevId++, date, consumedAt: zonedDateTime(date, clock, TZ), beverageId: d.id, drinkName: d.nameAr, volumeMl: 70, dryCoffeeG: 7, milkType: 'none', milkMl: 0, sugarTsp: m.sugarKcal ? 1 : 0, caffeineMg: m.caffeineMg, kcal: m.totalKcal, proteinG: m.proteinG });
    }
    if (chance(0.5)) {
      const d = mockDrinks[1]!;
      const m = beverageMetrics({ drink: d, volumeMl: 240, milkType: 'semi_skimmed', milkMl: 30, sugarTsp: 1 }, mockSettings.caffeineMgPerG);
      ds.beverages.push({ id: bevId++, date, consumedAt: zonedDateTime(date, '11:00', TZ), beverageId: d.id, drinkName: d.nameAr, volumeMl: 240, dryCoffeeG: null, milkType: 'semi_skimmed', milkMl: 30, sugarTsp: 1, caffeineMg: m.caffeineMg, kcal: m.totalKcal, proteinG: m.proteinG });
    }
    if (chance(0.25)) {
      const d = mockDrinks[2]!;
      const m = beverageMetrics({ drink: d, volumeMl: 250, milkType: 'none', milkMl: 0, sugarTsp: 0 }, mockSettings.caffeineMgPerG);
      ds.beverages.push({ id: bevId++, date, consumedAt: zonedDateTime(date, '14:30', TZ), beverageId: d.id, drinkName: d.nameAr, volumeMl: 250, dryCoffeeG: null, milkType: 'none', milkMl: 0, sugarTsp: 0, caffeineMg: 0, kcal: m.totalKcal, proteinG: m.proteinG });
    }

    // Exercise: brisk walk every other day, football on Fridays
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const sessions: [number, number][] = [];
    if (dayIndex % 2 === 0) sessions.push([2, Math.round(between(35, 55))]); // id 2 = walking_brisk
    if (weekday === 5) sessions.push([6, 75]); // id 6 = football_casual
    for (const [exerciseId, minutes] of sessions) {
      const e = exById.get(exerciseId)!;
      const k = exerciseKcal(Number(e.defaultMet), trueWeight, minutes);
      ds.exercises.push({ id: exId++, date, nameAr: e.nameAr, minutes, met: Number(e.defaultMet), weightKg: r1(trueWeight), grossKcal: k.gross, netKcal: k.net, notes: null });
    }

    // Screen time
    const focus = r1(dayIndex % 5 === 1 ? between(5.5, 7.5) : between(2.5, 4.8));
    const admin = r1(between(1, 3));
    const passive = r1(between(0.5, 2.5));
    ds.screens.push({ date, highFocusH: focus, moderateAdminH: admin, passiveMediaH: passive, totalH: r1(focus + admin + passive) });

    // Sleep (night ending on this date)
    const prev = addDaysIso(date, -1);
    const bedClock = clockPlus('23:00', between(-30, 50));
    const latency = Math.round(between(8, 30));
    const onsetClock = clockPlus(bedClock, latency);
    const wakeClock = clockPlus('07:00', between(-20, 30));
    const shortNight = dayIndex % 11 === 6;
    const bedAt = zonedDateTime(bedClock < '12:00' ? date : prev, bedClock, TZ);
    const onsetAt = zonedDateTime(onsetClock < '12:00' ? date : prev, onsetClock, TZ);
    const wakeAt = zonedDateTime(date, shortNight ? clockPlus(wakeClock, -90) : wakeClock, TZ);
    const waso = Math.round(between(0, 30));
    const tib = (wakeAt.getTime() - bedAt.getTime()) / 60000;
    ds.sleeps.push({
      id: sleepId++, date, bedAt, onsetAt, wakeAt, interruptions: waso > 15 ? 2 : waso > 5 ? 1 : 0, wasoMin: waso,
      freshness: shortNight ? 2 : Math.round(between(3, 5)), tibMin: Math.round(tib), latencyMin: latency,
      tstMin: Math.round((wakeAt.getTime() - onsetAt.getTime()) / 60000 - waso),
    });

    // Weigh-in (most mornings): true trend + water noise; sodium days read heavier
    if (chance(0.8) || i % 7 === 0) {
      const highSodium = chance(0.15);
      const normalDigestion = !chance(0.07);
      const weight = trueWeight + between(-0.45, 0.45) + (highSodium ? 0.5 : 0) + (normalDigestion ? 0 : 0.3);
      const fastingH = chance(0.9) ? r1(between(14, 16)) : r1(between(11, 13.5));
      ds.weighIns.push({
        id: wId++, logDate: date, measuredAt: zonedDateTime(date, '07:15', TZ), weight: Math.round(weight * 100) / 100,
        fastingH, compliant: fastingH >= mockSettings.requiredFastingHours, official: i % 7 === 0, highSodium, normalDigestion,
      });
    }

    if (i > 0 && !chance(0.12)) ds.complete.add(date); // most past days fully logged
  }

  // Monthly measurements (latest first, like the real query)
  ds.measurements = [89, 59, 29, 0].map((back, k) => {
    const waist = r1(98 - k * 1.6);
    const hip = r1(104 - k * 0.8);
    return { id: k + 1, date: addDaysIso(today, -back), neckCm: r1(40 - k * 0.2), chestCm: r1(106 - k * 0.7), waistCm: waist, hipCm: hip, thighCm: r1(60 - k * 0.5), bicepCm: 35, whr: Math.round((waist / hip) * 1000) / 1000 };
  }).reverse();

  return ds;
}

let cache: MockDataset | null = null;
export function mockDataset(): MockDataset {
  const today = todayIn(TZ);
  if (!cache || cache.today !== today) cache = generate(today);
  return cache;
}

// Daily totals, same shape as the v_daily_intake read model
export function mockIntake(from: string, to: string): Map<string, IntakeRow> {
  const ds = mockDataset();
  const out = new Map<string, IntakeRow>();
  const row = (date: string) => out.get(date) ?? (out.set(date, {
    date, foodKcal: 0, beverageKcal: 0, totalKcal: 0, totalProteinG: 0, caffeineMg: 0, exerciseNetKcal: 0, exerciseGrossKcal: 0, intakeComplete: ds.complete.has(date),
  }), out.get(date)!);
  for (const m of ds.meals) if (m.date >= from && m.date <= to) { const r = row(m.date); r.foodKcal += m.kcal; r.totalKcal += m.kcal; r.totalProteinG += m.protein; }
  for (const b of ds.beverages) if (b.date >= from && b.date <= to) { const r = row(b.date); r.beverageKcal += b.kcal; r.totalKcal += b.kcal; r.totalProteinG += b.proteinG; r.caffeineMg += b.caffeineMg; }
  for (const e of ds.exercises) if (e.date >= from && e.date <= to) { const r = row(e.date); r.exerciseNetKcal += e.netKcal; r.exerciseGrossKcal += e.grossKcal; }
  return out;
}
