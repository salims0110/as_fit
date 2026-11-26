import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Card } from '@/components/Card';
import { CatalogPortability } from '@/components/forms/CatalogPortability';
import { PageHeader, SectionTitle } from '@/components/ui';
import { importFoodsJson } from '@/server/actions/foods';
import { getFoods } from '@/server/queries/logs';
import { FoodForm } from './FoodForm';
import { FoodList } from './FoodList';

export const metadata: Metadata = { title: 'قاموس الأغذية', description: 'إدارة أصناف الطعام وقيمها الغذائية.' };

export default async function FoodsPage() {
  await connection();
  const foods = await getFoods();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="قاموس الأغذية"
        description="القيم لكل 100 غ أو 100 مل أو لكل حبة. تعديل صنف لا يغيّر سعرات الوجبات المسجلة سابقاً. الصنف المستخدم لا يُحذف بل يُعطَّل."
        actions={<CatalogPortability kind="foods" itemCount={foods.length} onImport={importFoodsJson} />}
      />
      <Card>
        <SectionTitle>صنف جديد</SectionTitle>
        <FoodForm />
      </Card>
      <section>
        <SectionTitle>الأصناف ({foods.length})</SectionTitle>
        <FoodList foods={foods} />
      </section>
    </div>
  );
}
