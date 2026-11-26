import type { Metadata } from 'next';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { MealCard } from '@/components/LogCards';
import { DateNav } from '@/components/DateNav';
import { DayCompleteToggle } from '@/components/forms/DayCompleteToggle';
import { Num } from '@/components/Num';
import { ProgressBar } from '@/components/ProgressBar';
import { EmptyState, PageHeader, SectionTitle } from '@/components/ui';
import { SideColumn } from '@/components/SideColumn';
import { nowClock } from '@/lib/time';
import { deleteMeal } from '@/server/actions/meals';
import { getDayComplete, getFoods, getMealsBetween } from '@/server/queries/logs';
import { getMealTemplates } from '@/server/queries/meal-templates';
import { resolveDate, type DateSearchParams } from '@/server/queries/page';
import { loadModel } from '@/server/services/metabolic-model';
import { USER_ID } from '@/server/session';
import { MealForm } from './MealForm';

export const metadata: Metadata = { title: 'الوجبات', description: 'تسجيل الوجبات وتوقيتها مع حساب السعرات والبروتين.' };

export default async function MealsPage({ searchParams }: { searchParams: DateSearchParams }) {
  const { tz, today, date } = await resolveDate(searchParams);
  const [foods, meals, complete, model, templates] = await Promise.all([
    getFoods({ activeOnly: true }),
    getMealsBetween(USER_ID, date, date),
    getDayComplete(USER_ID, date),
    loadModel(USER_ID, date, date),
    getMealTemplates(USER_ID),
  ]);
  const day = model?.days[0];
  const kcal = meals.reduce((s, m) => s + m.kcal, 0);
  const protein = meals.reduce((s, m) => s + m.protein, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="الوجبات" description="سجّل كل وجبة بوقتها الفعلي. السعرات تُحفظ لحظة التسجيل ولا تتغير إذا عدّلت القاموس لاحقاً." actions={<DateNav path="/log/meals" date={date} today={today} />} />

      {day && (
        <Card className="grid gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink-muted">السعرات من الطعام</span>
            <span className="text-2xl font-semibold"><Num value={kcal} /> <span className="text-base text-ink-muted">/ <Num value={day.targets.calories} unit="سعرة" /></span></span>
            <ProgressBar value={kcal} max={day.targets.calories} tone={kcal > day.targets.calories ? 'danger' : 'brand'} label="السعرات مقابل الهدف" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink-muted">البروتين</span>
            <span className="text-2xl font-semibold"><Num value={protein} /> <span className="text-base text-ink-muted">/ <Num value={day.targets.proteinG} unit="غ" /></span></span>
            <ProgressBar value={protein} max={day.targets.proteinG} label="البروتين مقابل الهدف" />
          </div>
          <div className="flex flex-col justify-center gap-2">
            <DayCompleteToggle date={date} complete={complete} />
            <span className="text-xs text-ink-muted">الأيام المكتملة فقط تدخل حساب العجز والحرق الفعلي.</span>
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <SectionTitle>وجبة جديدة</SectionTitle>
          <MealForm
            key={date}
            date={date}
            nowClock={nowClock(tz)}
            foods={foods}
            templates={templates}
            schedule={model?.settings.mealSchedule ?? { breakfast: null, lunch: null, dinner: null }}
          />
        </Card>

        <SideColumn title={<SectionTitle aside={<Badge>{meals.length} وجبات</Badge>}>وجبات اليوم</SectionTitle>}>
          {meals.length === 0 && <EmptyState title="لا توجد وجبات مسجلة لهذا اليوم">ابدأ بإضافة وجبة من النموذج.</EmptyState>}
          {meals.map((m) => <MealCard key={m.id} meal={m} onDelete={deleteMeal} />)}
        </SideColumn>
      </div>
    </div>
  );
}
