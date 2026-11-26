import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/ui';
import { DEFAULT_TIMEZONE, getProfileAndSettings } from '@/server/queries/profile';
import { USER_ID } from '@/server/session';
import { DataExportCard } from './DataExportCard';
import { SettingsForm } from './SettingsForm';

export const metadata: Metadata = { title: 'الإعدادات', description: 'الملف الشخصي والأهداف والثوابت العلمية.' };

export default async function SettingsPage() {
  await connection();
  const ps = await getProfileAndSettings(USER_ID);
  const p = ps?.profile;
  const s = ps?.settings;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="الإعدادات" description="كل الحسابات تعتمد على هذه القيم. تغييرها يعيد حساب الأهداف فوراً، ولا يغيّر السجلات المحفوظة." />
      <Card>
        <SettingsForm
          initial={{
            displayName: p?.displayName ?? '', gender: p?.gender ?? 'male', birthDate: p?.birthDate ?? '1995-01-01',
            heightCm: p?.heightCm ?? '', initialWeightKg: p?.initialWeightKg ?? '', targetWeightKg: p?.targetWeightKg ?? '',
            activityFactor: p?.activityFactor ?? 1.2, timezone: s?.timezone ?? DEFAULT_TIMEZONE,
            plannedDeficit: s?.plannedDeficit ?? 500, proteinPerKg: s?.proteinPerKg ?? 1.8, useNetMet: s?.useNetMet ?? true,
            useKatchMcArdle: s?.useKatchMcArdle ?? false,
            caffeineMgPerG: s?.caffeineMgPerG ?? 11, caffeineHalfLifeH: s?.caffeineHalfLifeH ?? 5,
            requiredFastingHours: s?.requiredFastingHours ?? 14, kcalPerKg: s?.kcalPerKg ?? 7700, emaAlpha: s?.emaAlpha ?? 0.1,
            breakfastTime: s?.mealSchedule.breakfast ?? '', lunchTime: s?.mealSchedule.lunch ?? '', dinnerTime: s?.mealSchedule.dinner ?? '',
          }}
        />
      </Card>
      <DataExportCard />
    </div>
  );
}
