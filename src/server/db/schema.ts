// Drizzle schema — must stay equivalent to .agents/skills/asfit-database/references/schema.sql
// NUMERIC columns are returned as strings: convert with Number() before passing to src/domain.
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  time,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

const tstz = (name: string) => timestamp(name, { withTimezone: true });

// ───────────── ENUMs ─────────────
export const genderEnum = pgEnum('gender_t', ['male', 'female']);
export const mealTypeEnum = pgEnum('meal_type_t', ['breakfast', 'lunch', 'dinner', 'snack']);
export const nutritionBasisEnum = pgEnum('nutrition_basis_t', ['per_100g', 'per_100ml', 'per_unit']);
export const milkTypeEnum = pgEnum('milk_type_t', ['none', 'whole', 'semi_skimmed', 'skimmed']);
export const insightSeverityEnum = pgEnum('insight_severity_t', ['info', 'warning', 'critical']);

// ───────────── Profile & Settings ─────────────
export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  displayName: varchar('display_name', { length: 80 }).notNull(),
  gender: genderEnum('gender').notNull(),
  birthDate: date('birth_date').notNull(),
  currentHeightCm: numeric('current_height_cm', { precision: 5, scale: 1 }).notNull(),
  initialWeightKg: numeric('initial_weight_kg', { precision: 5, scale: 2 }).notNull(),
  targetWeightKg: numeric('target_weight_kg', { precision: 5, scale: 2 }).notNull(),
  // Non-exercise activity only; logged exercise is added separately (no double counting)
  defaultActivityFactor: numeric('default_activity_factor', { precision: 4, scale: 3 }).notNull().default('1.200'),
  createdAt: tstz('created_at').notNull().defaultNow(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
}, (t) => [
  check('user_profiles_height_ck', sql`${t.currentHeightCm} BETWEEN 100 AND 250`),
  check('user_profiles_initial_weight_ck', sql`${t.initialWeightKg} BETWEEN 30 AND 300`),
  check('user_profiles_target_weight_ck', sql`${t.targetWeightKg} BETWEEN 30 AND 300`),
  check('user_profiles_activity_factor_ck', sql`${t.defaultActivityFactor} BETWEEN 1.0 AND 2.5`),
]);

export const userSettings = pgTable('user_settings', {
  userId: integer('user_id').primaryKey().references(() => userProfiles.id, { onDelete: 'cascade' }),
  timezone: varchar('timezone', { length: 64 }).notNull().default('Europe/Istanbul'),
  plannedDailyDeficitKcal: integer('planned_daily_deficit_kcal').notNull().default(500),
  proteinGPerKg: numeric('protein_g_per_kg', { precision: 3, scale: 2 }).notNull().default('1.80'),
  useNetMet: boolean('use_net_met').notNull().default(true),
  // BMR from lean mass (Katch-McArdle) when a body-fat measurement from the last 30 days exists
  useKatchMcArdle: boolean('use_katch_mcardle').notNull().default(false),
  caffeineMgPerGCoffee: numeric('caffeine_mg_per_g_coffee', { precision: 4, scale: 1 }).notNull().default('11.0'),
  caffeineHalfLifeHours: numeric('caffeine_half_life_hours', { precision: 3, scale: 1 }).notNull().default('5.0'),
  requiredFastingHours: integer('required_fasting_hours').notNull().default(14),
  kcalPerKgFat: integer('kcal_per_kg_fat').notNull().default(7700),
  emaAlphaDaily: numeric('ema_alpha_daily', { precision: 3, scale: 2 }).notNull().default('0.10'),
  // Meal schedule (user-defined; null = no scheduled time → no drift for that meal). Snacks are never scheduled.
  breakfastTime: time('breakfast_time'),
  lunchTime: time('lunch_time'),
  dinnerTime: time('dinner_time'),
}, (t) => [
  check('user_settings_deficit_ck', sql`${t.plannedDailyDeficitKcal} BETWEEN 0 AND 1200`),
  check('user_settings_protein_ck', sql`${t.proteinGPerKg} BETWEEN 0.8 AND 3.0`),
]);

// ───────────── Food Dictionary ─────────────
export const foodDictionary = pgTable('food_dictionary', {
  id: serial('id').primaryKey(),
  itemNameAr: varchar('item_name_ar', { length: 120 }).notNull().unique(),
  itemNameEn: varchar('item_name_en', { length: 120 }),
  nutritionBasis: nutritionBasisEnum('nutrition_basis').notNull(),
  gramsPerUnit: numeric('grams_per_unit', { precision: 6, scale: 1 }),
  calories: numeric('calories', { precision: 7, scale: 2 }).notNull(),
  proteinG: numeric('protein_g', { precision: 6, scale: 2 }).notNull(),
  carbsG: numeric('carbs_g', { precision: 6, scale: 2 }),
  fatG: numeric('fat_g', { precision: 6, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: tstz('created_at').notNull().defaultNow(),
}, (t) => [
  check('food_calories_ck', sql`${t.calories} >= 0`),
  check('food_protein_ck', sql`${t.proteinG} >= 0`),
  check('food_carbs_ck', sql`${t.carbsG} >= 0`),
  check('food_fat_ck', sql`${t.fatG} >= 0`),
]);

// ───────────── Meals ─────────────
export const meals = pgTable('meals', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  mealType: mealTypeEnum('meal_type').notNull(),
  scheduledTime: time('scheduled_time'),
  actualTime: time('actual_time').notNull(),
  // positive = late; wrapped to [-720, 720) so 23:30 → 00:30 is +60, not -1380
  timeDriftMinutes: integer('time_drift_minutes').generatedAlwaysAs(sql`CASE WHEN scheduled_time IS NULL THEN NULL
    ELSE ((((EXTRACT(EPOCH FROM (actual_time - scheduled_time)) / 60)::INT + 720) % 1440 + 1440) % 1440) - 720 END`),
  notes: text('notes'),
  createdAt: tstz('created_at').notNull().defaultNow(),
}, (t) => [index('idx_meals_user_date').on(t.userId, t.logDate)]);

export const mealItems = pgTable('meal_items', {
  id: serial('id').primaryKey(),
  mealId: integer('meal_id').notNull().references(() => meals.id, { onDelete: 'cascade' }),
  foodItemId: integer('food_item_id').notNull().references(() => foodDictionary.id),
  quantity: numeric('quantity', { precision: 7, scale: 2 }).notNull(),
  // Snapshot: unaffected by later dictionary edits
  calculatedCalories: numeric('calculated_calories', { precision: 7, scale: 2 }).notNull(),
  calculatedProtein: numeric('calculated_protein', { precision: 6, scale: 2 }).notNull(),
  calculatedCarbs: numeric('calculated_carbs', { precision: 6, scale: 2 }),
  calculatedFat: numeric('calculated_fat', { precision: 6, scale: 2 }),
}, (t) => [
  index('idx_meal_items_meal').on(t.mealId),
  check('meal_items_quantity_ck', sql`${t.quantity} > 0`),
]);

// Saved meal templates store references + quantities only; snapshots are computed fresh when logging a meal.
export const mealTemplates = pgTable('meal_templates', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  nameAr: varchar('name_ar', { length: 120 }).notNull(),
  defaultMealType: mealTypeEnum('default_meal_type'),
  createdAt: tstz('created_at').notNull().defaultNow(),
}, (t) => [unique('meal_templates_user_name_uq').on(t.userId, t.nameAr)]);

export const mealTemplateItems = pgTable('meal_template_items', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id').notNull().references(() => mealTemplates.id, { onDelete: 'cascade' }),
  foodItemId: integer('food_item_id').notNull().references(() => foodDictionary.id),
  quantity: numeric('quantity', { precision: 7, scale: 2 }).notNull(),
}, (t) => [
  index('idx_meal_template_items_tpl').on(t.templateId),
  check('meal_template_items_quantity_ck', sql`${t.quantity} > 0`),
]);

// ───────────── Beverages ─────────────
// User-defined drinks (the list starts empty). Values per 100 ml of the drink itself, before milk and sugar.
export const beverageCatalog = pgTable('beverage_catalog', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  nameAr: varchar('name_ar', { length: 120 }).notNull(),
  // true: caffeine = ground-coffee grams × user_settings.caffeine_mg_per_g_coffee (when grams are given)
  byCoffeeWeight: boolean('by_coffee_weight').notNull().default(false),
  caffeineMgPer100ml: numeric('caffeine_mg_per_100ml', { precision: 6, scale: 1 }).notNull().default('0'),
  kcalPer100ml: numeric('kcal_per_100ml', { precision: 6, scale: 1 }).notNull().default('0'),
  proteinGPer100ml: numeric('protein_g_per_100ml', { precision: 5, scale: 1 }).notNull().default('0'),
  defaultVolumeMl: numeric('default_volume_ml', { precision: 6, scale: 1 }).notNull().default('250'),
  defaultCoffeeG: numeric('default_coffee_g', { precision: 5, scale: 1 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: tstz('created_at').notNull().defaultNow(),
}, (t) => [
  unique('beverage_catalog_user_name_uq').on(t.userId, t.nameAr),
  check('bev_cat_caffeine_ck', sql`${t.caffeineMgPer100ml} >= 0`),
  check('bev_cat_kcal_ck', sql`${t.kcalPer100ml} >= 0`),
  check('bev_cat_protein_ck', sql`${t.proteinGPer100ml} >= 0`),
  check('bev_cat_volume_ck', sql`${t.defaultVolumeMl} > 0`),
]);

export const beverageLogs = pgTable('beverage_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  consumedAt: tstz('consumed_at').notNull(),
  beverageId: integer('beverage_id').references(() => beverageCatalog.id, { onDelete: 'set null' }),
  drinkName: varchar('drink_name', { length: 120 }).notNull(), // snapshot: history survives renames/deletes
  liquidVolumeMl: numeric('liquid_volume_ml', { precision: 6, scale: 1 }).notNull(),
  dryCoffeeGrams: numeric('dry_coffee_grams', { precision: 5, scale: 1 }),
  milkType: milkTypeEnum('milk_type').notNull().default('none'),
  milkAddedMl: numeric('milk_added_ml', { precision: 5, scale: 1 }).notNull().default('0'),
  sugarTeaspoons: numeric('sugar_teaspoons', { precision: 3, scale: 1 }).notNull().default('0'),
  // Snapshots computed in src/domain/beverages.ts
  caffeineMg: numeric('caffeine_mg', { precision: 6, scale: 1 }).notNull().default('0'),
  milkCalories: numeric('milk_calories', { precision: 6, scale: 1 }).notNull().default('0'),
  milkProteinG: numeric('milk_protein_g', { precision: 5, scale: 1 }).notNull().default('0'),
  sugarCalories: numeric('sugar_calories', { precision: 6, scale: 1 }).notNull().default('0'),
  baseCalories: numeric('base_calories', { precision: 6, scale: 1 }).notNull().default('0'),   // the drink itself (juice, soda…)
  baseProteinG: numeric('base_protein_g', { precision: 5, scale: 1 }).notNull().default('0'),
  totalCalories: numeric('total_calories', { precision: 6, scale: 1 }).generatedAlwaysAs(sql`base_calories + milk_calories + sugar_calories`),
}, (t) => [
  index('idx_bev_user_date').on(t.userId, t.logDate),
  check('bev_volume_ck', sql`${t.liquidVolumeMl} >= 0`),
  check('bev_coffee_ck', sql`${t.dryCoffeeGrams} >= 0`),
]);

// ───────────── Day Status (intake completeness) ─────────────
// Only days with intake_complete = TRUE enter deficit, expected loss and observed TDEE.
export const dayStatus = pgTable('day_status', {
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  intakeComplete: boolean('intake_complete').notNull().default(false),
  closedAt: tstz('closed_at'),
}, (t) => [primaryKey({ columns: [t.userId, t.logDate] })]);

// ───────────── Screen Time ─────────────
export const screenTimeLogs = pgTable('screen_time_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  highFocusHours: numeric('high_focus_hours', { precision: 4, scale: 2 }).notNull().default('0'),
  moderateAdminHours: numeric('moderate_admin_hours', { precision: 4, scale: 2 }).notNull().default('0'),
  passiveMediaHours: numeric('passive_media_hours', { precision: 4, scale: 2 }).notNull().default('0'),
  totalScreenHours: numeric('total_screen_hours', { precision: 4, scale: 2 })
    .generatedAlwaysAs(sql`high_focus_hours + moderate_admin_hours + passive_media_hours`),
}, (t) => [
  unique('screen_time_user_date_uq').on(t.userId, t.logDate),
  check('screen_high_focus_ck', sql`${t.highFocusHours} BETWEEN 0 AND 24`),
  check('screen_moderate_ck', sql`${t.moderateAdminHours} BETWEEN 0 AND 24`),
  check('screen_passive_ck', sql`${t.passiveMediaHours} BETWEEN 0 AND 24`),
  check('screen_total_ck', sql`${t.highFocusHours} + ${t.moderateAdminHours} + ${t.passiveMediaHours} <= 24`),
]);

// ───────────── Exercise ─────────────
export const exerciseCatalog = pgTable('exercise_catalog', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  nameAr: varchar('name_ar', { length: 80 }).notNull(),
  defaultMet: numeric('default_met', { precision: 4, scale: 1 }).notNull(),
  compendiumRef: varchar('compendium_ref', { length: 20 }),
}, (t) => [check('exercise_met_ck', sql`${t.defaultMet} > 1`)]);

export const exerciseLogs = pgTable('exercise_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  exerciseId: integer('exercise_id').notNull().references(() => exerciseCatalog.id),
  durationMinutes: integer('duration_minutes').notNull(),
  metValue: numeric('met_value', { precision: 4, scale: 1 }).notNull(),
  weightUsedKg: numeric('weight_used_kg', { precision: 5, scale: 2 }).notNull(),
  grossBurnedKcal: numeric('gross_burned_kcal', { precision: 7, scale: 1 }).notNull(),
  netBurnedKcal: numeric('net_burned_kcal', { precision: 7, scale: 1 }).notNull(),
  notes: text('notes'),
}, (t) => [
  index('idx_ex_user_date').on(t.userId, t.logDate),
  check('exercise_duration_ck', sql`${t.durationMinutes} BETWEEN 1 AND 600`),
]);

// ───────────── Sleep ─────────────
export const sleepLogs = pgTable('sleep_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(), // wake-up date
  bedTime: tstz('bed_time').notNull(),
  sleepOnsetTime: tstz('sleep_onset_time').notNull(),
  wakeUpTime: tstz('wake_up_time').notNull(),
  nightInterruptionsCount: integer('night_interruptions_count').notNull().default(0),
  wasoMinutes: integer('waso_minutes').notNull().default(0),
  wakeFreshnessScore: smallint('wake_freshness_score').notNull(),
  timeInBedMin: integer('time_in_bed_min')
    .generatedAlwaysAs(sql`(EXTRACT(EPOCH FROM (wake_up_time - bed_time)) / 60)::INT`),
  sleepLatencyMin: integer('sleep_latency_min')
    .generatedAlwaysAs(sql`(EXTRACT(EPOCH FROM (sleep_onset_time - bed_time)) / 60)::INT`),
  totalSleepMin: integer('total_sleep_min')
    .generatedAlwaysAs(sql`(EXTRACT(EPOCH FROM (wake_up_time - sleep_onset_time)) / 60)::INT - waso_minutes`),
}, (t) => [
  unique('sleep_user_date_uq').on(t.userId, t.logDate),
  check('sleep_interruptions_ck', sql`${t.nightInterruptionsCount} >= 0`),
  check('sleep_waso_ck', sql`${t.wasoMinutes} >= 0`),
  check('sleep_freshness_ck', sql`${t.wakeFreshnessScore} BETWEEN 1 AND 5`),
  check('sleep_order_ck', sql`${t.bedTime} <= ${t.sleepOnsetTime} AND ${t.sleepOnsetTime} < ${t.wakeUpTime}`),
]);

// ───────────── Weigh-ins ─────────────
export const weighIns = pgTable('weigh_ins', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  measuredAt: tstz('measured_at').notNull(),
  dryFastedWeightKg: numeric('dry_fasted_weight_kg', { precision: 5, scale: 2 }).notNull(),
  lastMealAt: tstz('last_meal_at').notNull(),
  fastingHours: numeric('fasting_hours', { precision: 4, scale: 1 })
    .generatedAlwaysAs(sql`EXTRACT(EPOCH FROM (measured_at - last_meal_at)) / 3600`),
  bathroomDone: boolean('bathroom_done').notNull(),
  noFluidsBefore: boolean('no_fluids_before').notNull(),
  highSodiumYesterday: boolean('high_sodium_yesterday').notNull().default(false),
  normalDigestion: boolean('normal_digestion').notNull().default(true),
  isOfficialWeekly: boolean('is_official_weekly').notNull().default(true),
  isProtocolCompliant: boolean('is_protocol_compliant').notNull(),
}, (t) => [
  unique('weigh_ins_user_date_uq').on(t.userId, t.logDate),
  check('weigh_ins_weight_ck', sql`${t.dryFastedWeightKg} BETWEEN 30 AND 300`),
]);

// ───────────── Monthly Measurements ─────────────
export const bodyMeasurements = pgTable('body_measurements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  neckCm: numeric('neck_cm', { precision: 5, scale: 1 }),
  chestCm: numeric('chest_cm', { precision: 5, scale: 1 }),
  waistCm: numeric('waist_cm', { precision: 5, scale: 1 }).notNull(), // navel level, end of exhale
  hipCm: numeric('hip_cm', { precision: 5, scale: 1 }).notNull(), // widest point of buttocks
  thighCm: numeric('thigh_cm', { precision: 5, scale: 1 }),
  bicepCm: numeric('bicep_cm', { precision: 5, scale: 1 }),
  whr: numeric('whr', { precision: 4, scale: 3 }).generatedAlwaysAs(sql`waist_cm / NULLIF(hip_cm, 0)`),
}, (t) => [unique('body_measurements_user_date_uq').on(t.userId, t.logDate)]);

// ───────────── Insights ─────────────
export const insights = pgTable('insights', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  ruleCode: varchar('rule_code', { length: 40 }).notNull(),
  severity: insightSeverityEnum('severity').notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  message: text('message').notNull(),
  payload: jsonb('payload').notNull().default({}),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  dismissedAt: tstz('dismissed_at'),
}, (t) => [unique('insights_dedupe_uq').on(t.userId, t.ruleCode, t.periodStart, t.periodEnd)]);
