'use server';

import { and, eq } from 'drizzle-orm';
import { drinksCatalogBundleSchema, parseCatalogBundle } from '@/lib/validation/catalog-import';
import { INVALID_ID_MESSAGE, parseRecordId } from '@/lib/validation/common';
import { drinkSchema } from '@/lib/validation/schemas';
import type { ActionResult } from '@/lib/validation/common';
import { db } from '@/server/db/client';
import { beverageCatalog } from '@/server/db/schema';
import { invalid, refreshAll, toNumStr, failure } from '@/server/services/action-helpers';
import { MOCK_MODE, MOCK_READ_ONLY_MESSAGE } from '@/server/mock/mode';
import { USER_ID } from '@/server/session';

// Editing or deleting a drink never changes past logs: each log keeps its own name and values (snapshot).
export async function saveDrink(input: unknown): Promise<ActionResult<{ id: number }>> {
  if (MOCK_MODE) return failure(MOCK_READ_ONLY_MESSAGE);
  const parsed = drinkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const values = {
    nameAr: v.nameAr, byCoffeeWeight: v.byCoffeeWeight,
    caffeineMgPer100ml: v.caffeineMgPer100ml.toFixed(1), kcalPer100ml: v.kcalPer100ml.toFixed(1),
    proteinGPer100ml: v.proteinGPer100ml.toFixed(1), defaultVolumeMl: v.defaultVolumeMl.toFixed(1),
    defaultCoffeeG: v.byCoffeeWeight ? toNumStr(v.defaultCoffeeG, 1) : null,
  };
  try {
    if (v.id) {
      await db.update(beverageCatalog).set(values).where(and(eq(beverageCatalog.id, v.id), eq(beverageCatalog.userId, USER_ID)));
      refreshAll();
      return { ok: true, id: v.id };
    }
    const [row] = await db.insert(beverageCatalog).values({ userId: USER_ID, ...values }).returning({ id: beverageCatalog.id });
    refreshAll();
    return { ok: true, id: row!.id };
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message + String((err as { cause?: unknown }).cause ?? ''))) {
      return { ok: false, errors: { nameAr: ['يوجد مشروب بنفس الاسم في قائمتك'] } };
    }
    throw err;
  }
}

export async function deleteDrink(id: number): Promise<ActionResult> {
  if (MOCK_MODE) return failure(MOCK_READ_ONLY_MESSAGE);
  const recordId = parseRecordId(id);
  if (recordId == null) return failure(INVALID_ID_MESSAGE);
  await db.delete(beverageCatalog).where(and(eq(beverageCatalog.id, recordId), eq(beverageCatalog.userId, USER_ID)));
  refreshAll();
  return { ok: true };
}

// Imports new drinks from a validated JSON bundle without mutating existing drinks or past beverage log snapshots.
export async function importDrinksJson(rawJson: unknown): Promise<ActionResult<{ added: number; skipped: number }>> {
  if (MOCK_MODE) return failure(MOCK_READ_ONLY_MESSAGE);
  const parsed = parseCatalogBundle(rawJson, drinksCatalogBundleSchema);
  if (!parsed.ok) return failure(parsed.message);

  const existingRows = await db
    .select({ name: beverageCatalog.nameAr })
    .from(beverageCatalog)
    .where(eq(beverageCatalog.userId, USER_ID));
  const seen = new Set(existingRows.map((r) => r.name.trim()));

  const toInsert: (typeof beverageCatalog.$inferInsert)[] = [];
  let skipped = 0;

  for (const item of parsed.data.items) {
    const key = item.nameAr.trim();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    toInsert.push({
      userId: USER_ID,
      nameAr: key,
      byCoffeeWeight: item.byCoffeeWeight,
      caffeineMgPer100ml: item.caffeineMgPer100ml.toFixed(1),
      kcalPer100ml: item.kcalPer100ml.toFixed(1),
      proteinGPer100ml: item.proteinGPer100ml.toFixed(1),
      defaultVolumeMl: item.defaultVolumeMl.toFixed(1),
      defaultCoffeeG: item.byCoffeeWeight ? toNumStr(item.defaultCoffeeG, 1) : null,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(beverageCatalog).values(toInsert).onConflictDoNothing();
    refreshAll();
  }

  return { ok: true, added: toInsert.length, skipped };
}
