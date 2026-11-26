import { todayIn } from '@/lib/time';
import { getDrinks, getFoods } from '@/server/queries/logs';
import { DEFAULT_TIMEZONE, getProfileAndSettings } from '@/server/queries/profile';
import { USER_ID } from '@/server/session';

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== 'foods' && kind !== 'drinks') {
    return Response.json({ error: 'نوع القاموس غير معروف' }, { status: 404 });
  }

  const ps = await getProfileAndSettings(USER_ID);
  const today = todayIn(ps?.settings.timezone ?? DEFAULT_TIMEZONE);

  if (kind === 'foods') {
    const foods = await getFoods({ activeOnly: true });
    const bundle = {
      kind: 'asfit-foods' as const,
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      items: foods.map((f) => ({
        itemNameAr: f.nameAr,
        ...(f.nameEn ? { itemNameEn: f.nameEn } : {}),
        nutritionBasis: f.basis,
        ...(f.gramsPerUnit != null ? { gramsPerUnit: f.gramsPerUnit } : {}),
        calories: f.calories,
        proteinG: f.protein,
        ...(f.carbs != null ? { carbsG: f.carbs } : {}),
        ...(f.fat != null ? { fatG: f.fat } : {}),
      })),
    };
    return new Response(`${JSON.stringify(bundle, null, 2)}\n`, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="asfit-foods-${today}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const drinks = await getDrinks(USER_ID, { activeOnly: true });
  const bundle = {
    kind: 'asfit-drinks' as const,
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    items: drinks.map((d) => ({
      nameAr: d.nameAr,
      byCoffeeWeight: d.byCoffeeWeight,
      caffeineMgPer100ml: d.caffeineMgPer100ml,
      kcalPer100ml: d.kcalPer100ml,
      proteinGPer100ml: d.proteinGPer100ml,
      defaultVolumeMl: d.defaultVolumeMl,
      ...(d.defaultCoffeeG != null ? { defaultCoffeeG: d.defaultCoffeeG } : {}),
    })),
  };
  return new Response(`${JSON.stringify(bundle, null, 2)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="asfit-drinks-${today}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
