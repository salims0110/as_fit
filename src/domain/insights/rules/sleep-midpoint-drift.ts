import { circularMeanMin, clockDistanceMin } from '../../sleep';
import { clock, lastDays } from '../helpers';
import type { InsightRule } from '../types';

const WINDOW_DAYS = 14;
const MIN_WORKDAY_NIGHTS = 3;
const MIN_FREEDAY_NIGHTS = 2;
const DRIFT_THRESHOLD_MIN = 90;

function clockToMinutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

function minutesToClock(min: number): string {
  const total = ((Math.round(min) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Wake-up dates on Saturday (6) and Sunday (0) correspond to Friday→Saturday and Saturday→Sunday free nights.
function isWeekendWakeDate(isoDate: string): boolean {
  const dow = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

export const sleepMidpointDrift: InsightRule = {
  code: 'SLEEP_MIDPOINT_DRIFT',
  evaluate(ctx) {
    const window = lastDays(ctx, WINDOW_DAYS);
    const first = window[0];
    const last = window[window.length - 1];
    if (!first || !last) return [];

    const workMidpoints: number[] = [];
    const freeMidpoints: number[] = [];

    for (const d of window) {
      const s = d.sleep;
      if (!s?.onsetAt || !s.wakeAt) continue;
      const midAt = new Date(s.onsetAt.getTime() + (s.wakeAt.getTime() - s.onsetAt.getTime()) / 2);
      const midMin = clockToMinutes(clock(midAt, ctx.settings.timezone));
      if (isWeekendWakeDate(d.date)) {
        freeMidpoints.push(midMin);
      } else {
        workMidpoints.push(midMin);
      }
    }

    if (workMidpoints.length < MIN_WORKDAY_NIGHTS || freeMidpoints.length < MIN_FREEDAY_NIGHTS) {
      return [];
    }

    const workMean = circularMeanMin(workMidpoints);
    const freeMean = circularMeanMin(freeMidpoints);
    if (workMean == null || freeMean == null) return [];

    const driftMinutes = Math.round(clockDistanceMin(freeMean, workMean));
    if (driftMinutes < DRIFT_THRESHOLD_MIN) return [];

    const workdayMidpointClock = minutesToClock(workMean);
    const freedayMidpointClock = minutesToClock(freeMean);

    return [{
      ruleCode: this.code,
      severity: driftMinutes >= 120 ? 'warning' : 'info',
      title: 'تذبذب منتصف النوم بين الأسبوع وعطلة نهايته',
      message: `متوسط منتصف نومك في أيام الأسبوع ${workdayMidpointClock} مقابل ${freedayMidpointClock} في عطلة نهاية الأسبوع (فارق ${driftMinutes} دقيقة). تقريب مواعيد النوم والاستيقاظ يدعم انتظام الساعة البيولوجية والشهية.`,
      payload: {
        workdayMidpointClock,
        freedayMidpointClock,
        driftMinutes,
        workdayNights: workMidpoints.length,
        freedayNights: freeMidpoints.length,
      },
      periodStart: first.date,
      periodEnd: last.date,
    }];
  },
};
