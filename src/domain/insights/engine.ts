import { aggressiveDeficit } from './rules/aggressive-deficit';
import { bedtimeCaffeine } from './rules/bedtime-caffeine';
import { cognitiveLoad } from './rules/cognitive-load';
import { falsePlateau } from './rules/false-plateau';
import { lateEating } from './rules/late-eating';
import { lunchDrift } from './rules/lunch-drift';
import { proteinShortfall } from './rules/protein-shortfall';
import { sleepMidpointDrift } from './rules/sleep-midpoint-drift';
import { truePlateau } from './rules/true-plateau';
import type { InsightResult, InsightRule, PeriodContext } from './types';

export const RULES: InsightRule[] = [
  lunchDrift, cognitiveLoad, falsePlateau, truePlateau,
  bedtimeCaffeine, lateEating, proteinShortfall, aggressiveDeficit, sleepMidpointDrift,
];

export const runRules = (ctx: PeriodContext): InsightResult[] => RULES.flatMap((r) => r.evaluate(ctx));
