export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface DayContext {
  date: string; // YYYY-MM-DD (user's local day)
  meals: { type: MealType; driftMin: number | null; kcal: number; protein: number; actualAt: Date }[];
  intakeKcal: number;
  intakeComplete: boolean;
  proteinG: number;
  proteinTargetG: number;
  formulaTdee: number;
  tdee: number;              // TDEE_used (blended) — display
  deficit: number;           // TDEE_used − intake
  formulaDeficit: number;    // TDEE_formula − intake — plateau rules use this (avoids circularity, A3)
  highFocusH: number;
  sleep?: { tstMin: number; efficiencyPct: number; bedAt: Date; onsetAt?: Date; wakeAt?: Date }; // night ending on this date
  caffeineDoses: { mg: number; at: Date }[];
}

export interface WeighInContext {
  date: string;
  weight: number;
  trend: number;
  highSodium: boolean;
  normalDigestion: boolean;
  compliant: boolean;
}

export interface PeriodContext {
  days: DayContext[];        // ascending by date
  weighIns: WeighInContext[]; // ascending by date
  settings: { caffeineHalfLifeH: number; kcalPerKg: number; timezone: string };
  weightKg: number;          // current trend weight
  observedTdee: number | null;
  trackingDay: number;       // days since the first weigh-in
}

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface InsightResult {
  ruleCode: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  periodStart: string;
  periodEnd: string;
}

export interface InsightRule {
  code: string;
  evaluate(ctx: PeriodContext): InsightResult[];
}
