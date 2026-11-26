import { and, asc, eq, inArray } from 'drizzle-orm';
import type { MealType } from '@/domain/insights/types';
import { db } from '@/server/db/client';
import { foodDictionary, mealTemplateItems, mealTemplates } from '@/server/db/schema';
import { mockMealTemplates } from '@/server/mock/mock-data';
import { MOCK_MODE } from '@/server/mock/mode';

export interface MealTemplateView {
  id: number;
  nameAr: string;
  defaultMealType: MealType | null;
  items: { foodId: number; nameAr: string; quantity: number }[];
}

export async function getMealTemplates(userId: number): Promise<MealTemplateView[]> {
  if (MOCK_MODE) return mockMealTemplates;

  const tpls = await db
    .select()
    .from(mealTemplates)
    .where(eq(mealTemplates.userId, userId))
    .orderBy(asc(mealTemplates.nameAr));

  if (tpls.length === 0) return [];

  const itemRows = await db
    .select({
      templateId: mealTemplateItems.templateId,
      foodId: mealTemplateItems.foodItemId,
      quantity: mealTemplateItems.quantity,
      nameAr: foodDictionary.itemNameAr,
    })
    .from(mealTemplateItems)
    .innerJoin(
      foodDictionary,
      and(eq(foodDictionary.id, mealTemplateItems.foodItemId), eq(foodDictionary.isActive, true)),
    )
    .where(inArray(mealTemplateItems.templateId, tpls.map((t) => t.id)))
    .orderBy(asc(mealTemplateItems.id));

  return tpls
    .map((t) => ({
      id: t.id,
      nameAr: t.nameAr,
      defaultMealType: t.defaultMealType,
      items: itemRows
        .filter((r) => r.templateId === t.id)
        .map((r) => ({ foodId: r.foodId, nameAr: r.nameAr, quantity: Number(r.quantity) })),
    }))
    .filter((t) => t.items.length > 0);
}
