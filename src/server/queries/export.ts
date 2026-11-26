import { toCsv } from '@/domain/csv';
import { sleepMetrics } from '@/domain/sleep';
import { addDaysIso, localClockOf, todayIn } from '@/lib/time';
import { getIntake } from './intake';
import { getSleepBetween } from './logs';
import { DEFAULT_TIMEZONE, getProfileAndSettings } from './profile';
import { getWeighIns } from './weight';

export const EXPORT_DATASETS = ['weigh-ins', 'daily-nutrition', 'sleep'] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export function isExportDataset(v: string): v is ExportDataset {
  return (EXPORT_DATASETS as readonly string[]).includes(v);
}

const EXPORT_WINDOW_DAYS = 365;

export async function buildDatasetCsv(userId: number, dataset: ExportDataset): Promise<{ csv: string; filename: string }> {
  const ps = await getProfileAndSettings(userId);
  const tz = ps?.settings.timezone ?? DEFAULT_TIMEZONE;
  const alpha = ps?.settings.emaAlpha ?? 0.1;
  const today = todayIn(tz);
  const from = addDaysIso(today, -(EXPORT_WINDOW_DAYS - 1));

  if (dataset === 'weigh-ins') {
    const rows = await getWeighIns(userId, alpha);
    const csv = toCsv(
      ['التاريخ', 'وقت القياس', 'الوزن (كغ)', 'اتجاه EMA (كغ)', 'الصيام (س)', 'ملتزم بالبروتوكول', 'رسمي أسبوعي', 'صوديوم مرتفع أمس', 'هضم طبيعي'],
      rows.map((r) => [
        r.date,
        localClockOf(r.measuredAt, tz),
        Number(r.weight.toFixed(2)),
        r.trend == null ? null : Number(r.trend.toFixed(2)),
        Number(r.fastingH.toFixed(1)),
        r.compliant,
        r.official,
        r.highSodium,
        r.normalDigestion,
      ]),
    );
    return { csv, filename: `asfit-weigh-ins-${today}.csv` };
  }

  if (dataset === 'daily-nutrition') {
    const intakeMap = await getIntake(userId, from, today);
    const sorted = [...intakeMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const csv = toCsv(
      ['التاريخ', 'سعرات الطعام', 'سعرات المشروبات', 'إجمالي السعرات', 'البروتين (غ)', 'الكافيين (ملغ)', 'حرق التمارين الصافي (سعرة)', 'حرق التمارين الإجمالي (سعرة)', 'اليوم مكتمل'],
      sorted.map((r) => [
        r.date,
        Math.round(r.foodKcal),
        Math.round(r.beverageKcal),
        Math.round(r.totalKcal),
        Number(r.totalProteinG.toFixed(1)),
        Math.round(r.caffeineMg),
        Number(r.exerciseNetKcal.toFixed(1)),
        Number(r.exerciseGrossKcal.toFixed(1)),
        r.intakeComplete,
      ]),
    );
    return { csv, filename: `asfit-daily-nutrition-${today}.csv` };
  }

  const sleeps = await getSleepBetween(userId, from, today);
  const csv = toCsv(
    ['تاريخ الاستيقاظ', 'وقت الفراش', 'بدء النوم', 'وقت الاستيقاظ', 'الوقت في السرير (د)', 'كمون النوم (د)', 'الاستيقاظ الليلي WASO (د)', 'النوم الفعلي (د)', 'كفاءة النوم (%)', 'مرات الاستيقاظ', 'الانتعاش (1-5)'],
    sleeps.map((s) => {
      const m = sleepMetrics({ bed: s.bedAt, onset: s.onsetAt, wake: s.wakeAt, wasoMin: s.wasoMin });
      return [
        s.date,
        localClockOf(s.bedAt, tz),
        localClockOf(s.onsetAt, tz),
        localClockOf(s.wakeAt, tz),
        Math.round(s.tibMin),
        Math.round(s.latencyMin),
        s.wasoMin,
        Math.round(s.tstMin),
        Number(m.efficiencyPct.toFixed(1)),
        s.interruptions,
        s.freshness,
      ];
    }),
  );
  return { csv, filename: `asfit-sleep-${today}.csv` };
}
