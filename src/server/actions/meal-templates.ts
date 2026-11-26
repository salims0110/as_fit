'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { INVALID_ID_MESSAGE, parseRecordId, type ActionResult } from '@/lib/validation/common';
import { mealTemplateSchema } from '@/lib/validation/meal-templates';
import { db } from '@/server/db/client';
import { foodDictionary, mealTemplateItems, mealTemplates } from '@/server/db/schema';
import { MOCK_MODE, MOCK_READ_ONLY_MESSAGE } from '@/server/mock/mode';
import { failure, invalid, refreshAll } from '@/server/services/action-helpers';
import { USER_ID } from '@/server/session';

export async function saveMealTemplate(input: unknown): Promise<ActionResult<{ id: number }>> {
  if (MOCK_MODE) return failure(MOCK_READ_ONLY_MESSAGE);
  const parsed = mealTemplateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  // Consolidate duplicate foodIds if submitted together
  const merged = new Map<number, number>();
  for (const item of v.items) {
    merged.set(item.foodId, (merged.get(item.foodId) ?? 0) + item.quantity);
  }

  const foodIds = [...merged.keys()];
  const existingFoods = await db
    .select({ id: foodDictionary.id })
    .from(foodDictionary)
    .where(and(inArray(foodDictionary.id, foodIds), eq(foodDictionary.isActive, true)));

  if (existingFoods.length !== foodIds.length) {
    return failure('أحد الأصناف غير موجود أو معطّل في القاموس');
  }

  try {
    const templateId = await db.transaction(async (tx) => {
      const [tpl] = await tx
        .insert(mealTemplates)
        .values({
          userId: USER_ID,
          nameAr: v.nameAr,
          defaultMealType: v.defaultMealType ?? null,
        })
        .returning({ id: mealTemplates.id });

      await tx.insert(mealTemplateItems).values(
        [...merged.entries()].map(([foodItemId, quantity]) => ({
          templateId: tpl!.id,
          foodItemId,
          quantity: quantity.toFixed(2),
        })),
      );

      return tpl!.id;
    });

    refreshAll();
    return { ok: true, id: templateId };
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message + String((err as { cause?: unknown }).cause ?? ''))) {
      return failure('يوجد قالب وجبة محفوظ بنفس الاسم');
    }
    throw err;
  }
}

export async function deleteMealTemplate(id: number): Promise<ActionResult> {
  if (MOCK_MODE) return failure(MOCK_READ_ONLY_MESSAGE);
  const recordId = parseRecordId(id);
  if (recordId == null) return failure(INVALID_ID_MESSAGE);

  await db.delete(mealTemplates).where(and(eq(mealTemplates.id, recordId), eq(mealTemplates.userId, USER_ID)));
  refreshAll();
  return { ok: true };
}
