'use server';

import { eq } from 'drizzle-orm';
import { foodsCatalogBundleSchema, parseCatalogBundle } from '@/lib/validation/catalog-import';
import { INVALID_ID_MESSAGE, parseRecordId } from '@/lib/validation/common';
import { foodSchema } from '@/lib/validation/schemas';
import type { ActionResult } from '@/lib/validation/common';
import { db } from '@/server/db/client';
import { MOCK_MODE, MOCK_READ_ONLY_MESSAGE } from '@/server/mock/mode';
import { foodDictionary } from '@/server/db/schema';
import { failure, invalid, refreshAll, toNumStr } from '@/server/services/action-helpers';

// Editing a food never changes past meals: meal_items keep their nutrition snapshot.
export async function saveFood(input: unknown): Promise<ActionResult<{ id: number }>> {
  if (MOCK_MODE) return failure(MOCK_READ_ONLY_MESSAGE);
  const parsed = foodSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const values = {
    itemNameAr: v.itemNameAr, itemNameEn: v.itemNameEn || null, nutritionBasis: v.nutritionBasis,
    gramsPerUnit: toNumStr(v.gramsPerUnit, 1), calories: v.calories.toFixed(2), proteinG: v.proteinG.toFixed(2),
    carbsG: toNumStr(v.carbsG), fatG: toNumStr(v.fatG),
  };
  try {
    if (v.id) {
      await db.update(foodDictionary).set(values).where(eq(foodDictionary.id, v.id));
      refreshAll();
      return { ok: true, id: v.id };
    }
    const [row] = await db.insert(foodDictionary).values(values).returning({ id: foodDictionary.id });
    refreshAll();
    return { ok: true, id: row!.id };
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message + String((err as { cause?: unknown }).cause ?? ''))) {
      return { ok: false, errors: { itemNameAr: ['يوجد صنف بنفس الاسم'] } };
    }
    throw err;
  }
}

// Foods referenced by meals cannot be deleted; they are deactivated instead.
export async function setFoodActive(id: number, active: boolean): Promise<ActionResult> {
  if (MOCK_MODE) return failure(MOCK_READ_ONLY_MESSAGE);
  const recordId = parseRecordId(id);
  if (recordId == null) return failure(INVALID_ID_MESSAGE);
  if (typeof active !== 'boolean') return failure('قيمة غير صالحة');
  const [row] = await db.update(foodDictionary).set({ isActive: active }).where(eq(foodDictionary.id, recordId)).returning({ id: foodDictionary.id });
  if (!row) return failure('الصنف غير موجود');
  refreshAll();
  return { ok: true };
}

// Imports new items from a validated JSON bundle without mutating existing items or past meal snapshots.
export async function importFoodsJson(rawJson: unknown): Promise<ActionResult<{ added: number; skipped: number }>> {
  if (MOCK_MODE) return failure(MOCK_READ_ONLY_MESSAGE);
  const parsed = parseCatalogBundle(rawJson, foodsCatalogBundleSchema);
  if (!parsed.ok) return failure(parsed.message);

  const existingRows = await db.select({ name: foodDictionary.itemNameAr }).from(foodDictionary);
  const seen = new Set(existingRows.map((r) => r.name.trim()));

  const toInsert: (typeof foodDictionary.$inferInsert)[] = [];
  let skipped = 0;

  for (const item of parsed.data.items) {
    const key = item.itemNameAr.trim();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    toInsert.push({
      itemNameAr: key,
      itemNameEn: item.itemNameEn || null,
      nutritionBasis: item.nutritionBasis,
      gramsPerUnit: toNumStr(item.gramsPerUnit, 1),
      calories: item.calories.toFixed(2),
      proteinG: item.proteinG.toFixed(2),
      carbsG: toNumStr(item.carbsG),
      fatG: toNumStr(item.fatG),
    });
  }

  if (toInsert.length > 0) {
    await db.insert(foodDictionary).values(toInsert).onConflictDoNothing();
    refreshAll();
  }

  return { ok: true, added: toInsert.length, skipped };
}
