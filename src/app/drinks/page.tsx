import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Card } from '@/components/Card';
import { CatalogPortability } from '@/components/forms/CatalogPortability';
import { Num } from '@/components/Num';
import { PageHeader, SectionTitle } from '@/components/ui';
import { CAFFEINE_REFERENCE } from '@/domain/beverages';
import { importDrinksJson } from '@/server/actions/drinks';
import { getDrinks } from '@/server/queries/logs';
import { getProfileAndSettings } from '@/server/queries/profile';
import { USER_ID } from '@/server/session';
import { DrinkForm } from './DrinkForm';
import { DrinkList } from './DrinkList';

export const metadata: Metadata = { title: 'قائمة المشروبات', description: 'مشروباتك أنت بقيمها: الكافيين والسعرات والبروتين.' };

export default async function DrinksPage() {
  await connection();
  const [drinks, ps] = await Promise.all([getDrinks(USER_ID), getProfileAndSettings(USER_ID)]);
  const mgPerG = ps?.settings.caffeineMgPerG ?? 11;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="قائمة المشروبات"
        description="أضف المشروبات التي تشربها فعلاً بقيمها. تعديل مشروب أو حذفه لا يغيّر ما سُجّل سابقاً."
        actions={<CatalogPortability kind="drinks" itemCount={drinks.length} onImport={importDrinksJson} />}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle>مشروب جديد</SectionTitle>
            <DrinkForm caffeineMgPerG={mgPerG} />
          </Card>
          <section>
            <SectionTitle>مشروباتي ({drinks.length})</SectionTitle>
            <DrinkList drinks={drinks} caffeineMgPerG={mgPerG} />
          </section>
        </div>
        <Card className="self-start">
          <SectionTitle>قيم مرجعية للكافيين</SectionTitle>
          <p className="mb-3 text-sm text-ink-muted">تقريبية لكل 100 مل، للاستئناس عند إدخال مشروب. القيمة الفعلية تختلف حسب النوع والتحضير.</p>
          <ul className="flex flex-col gap-2 text-sm">
            {CAFFEINE_REFERENCE.map((r) => (
              <li key={r.name} className="flex justify-between gap-2 border-b border-line pb-2 last:border-0">
                <span>{r.name}</span>
                <span className="flex gap-2"><Num value={r.mgPer100ml} unit="ملغ" /><bdi className="font-mono text-xs text-ink-muted">{r.note}</bdi></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
