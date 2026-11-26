import { z } from 'zod';
import { bool, num, optionalNum } from './common';
import { BASES } from './schemas';

export const MAX_CATALOG_JSON_BYTES = 512 * 1024; // 512 KB safety cap
export const MAX_CATALOG_ITEMS = 500;

export const foodCatalogItemSchema = z.object({
  itemNameAr: z.string().trim().min(1, 'مطلوب').max(120),
  itemNameEn: z.preprocess((v) => (v === null ? undefined : v), z.string().trim().max(120).optional()),
  nutritionBasis: z.enum(BASES),
  gramsPerUnit: optionalNum(0.1, 5000),
  calories: num(0, 5000),
  proteinG: num(0, 500),
  carbsG: optionalNum(0, 1000),
  fatG: optionalNum(0, 500),
});

export const foodsCatalogBundleSchema = z.object({
  kind: z.literal('asfit-foods'),
  version: z.literal(1),
  exportedAt: z.string().optional(),
  items: z
    .array(foodCatalogItemSchema)
    .min(1, 'الملف لا يحتوي على أي أصناف')
    .max(MAX_CATALOG_ITEMS, `الحد الأقصى ${MAX_CATALOG_ITEMS} صنف في الملف الواحد`),
});
export type FoodsCatalogBundle = z.output<typeof foodsCatalogBundleSchema>;

export const drinkCatalogItemSchema = z.object({
  nameAr: z.string().trim().min(1, 'مطلوب').max(120),
  byCoffeeWeight: bool,
  caffeineMgPer100ml: num(0, 1000),
  kcalPer100ml: num(0, 1000),
  proteinGPer100ml: num(0, 100),
  defaultVolumeMl: num(1, 3000),
  defaultCoffeeG: optionalNum(0, 100),
});

export const drinksCatalogBundleSchema = z.object({
  kind: z.literal('asfit-drinks'),
  version: z.literal(1),
  exportedAt: z.string().optional(),
  items: z
    .array(drinkCatalogItemSchema)
    .min(1, 'الملف لا يحتوي على أي مشروبات')
    .max(MAX_CATALOG_ITEMS, `الحد الأقصى ${MAX_CATALOG_ITEMS} مشروب في الملف الواحد`),
});
export type DrinksCatalogBundle = z.output<typeof drinksCatalogBundleSchema>;

export type CatalogParseResult<T> = { ok: true; data: T } | { ok: false; message: string };

export function parseCatalogBundle<T>(rawJson: unknown, schema: z.ZodType<T>): CatalogParseResult<T> {
  if (typeof rawJson !== 'string' || rawJson.trim().length === 0) {
    return { ok: false, message: 'الملف فارغ أو غير صالح' };
  }
  if (Buffer.byteLength(rawJson, 'utf8') > MAX_CATALOG_JSON_BYTES) {
    return { ok: false, message: 'حجم الملف يتجاوز الحد المسموح (512 كيلوبايت)' };
  }

  let rawObj: unknown;
  try {
    rawObj = JSON.parse(rawJson);
  } catch {
    return { ok: false, message: 'صيغة JSON غير صالحة' };
  }

  const parsed = schema.safeParse(rawObj);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const loc = firstIssue && firstIssue.path.length > 0 ? ` (${firstIssue.path.join('.')})` : '';
    return { ok: false, message: `بيانات القاموس غير مطابقة للمخطط${loc}: ${firstIssue?.message ?? 'خطأ في التحقق'}` };
  }

  return { ok: true, data: parsed.data };
}
