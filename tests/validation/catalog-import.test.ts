import { describe, expect, it } from 'vitest';
import {
  drinksCatalogBundleSchema,
  foodsCatalogBundleSchema,
  MAX_CATALOG_ITEMS,
  MAX_CATALOG_JSON_BYTES,
  parseCatalogBundle,
} from '@/lib/validation/catalog-import';

describe('catalog JSON export/import Zod 4 validation', () => {
  it('accepts valid foods and drinks bundles and normalizes nullable fields', () => {
    const foodsJson = JSON.stringify({
      kind: 'asfit-foods',
      version: 1,
      items: [
        { itemNameAr: '  شوفان  ', itemNameEn: null, nutritionBasis: 'per_100g', calories: 389, proteinG: 16.9, carbsG: 66, fatG: 6.9 },
        { itemNameAr: 'بيضة', nutritionBasis: 'per_unit', gramsPerUnit: 50, calories: 72, proteinG: 6.3 },
      ],
    });
    const foodsRes = parseCatalogBundle(foodsJson, foodsCatalogBundleSchema);
    expect(foodsRes.ok).toBe(true);
    if (foodsRes.ok) {
      expect(foodsRes.data.items[0]!.itemNameAr).toBe('شوفان');
      expect(foodsRes.data.items[0]!.itemNameEn).toBeUndefined();
    }

    const drinksJson = JSON.stringify({
      kind: 'asfit-drinks',
      version: 1,
      items: [{ nameAr: 'قهوة مقطرة', byCoffeeWeight: true, caffeineMgPer100ml: 40, kcalPer100ml: 2, proteinGPer100ml: 0.1, defaultVolumeMl: 250, defaultCoffeeG: 15 }],
    });
    const drinksRes = parseCatalogBundle(drinksJson, drinksCatalogBundleSchema);
    expect(drinksRes.ok).toBe(true);
  });

  it('rejects malformed JSON, empty input, and oversized payloads', () => {
    expect(parseCatalogBundle('', foodsCatalogBundleSchema)).toEqual({ ok: false, message: 'الملف فارغ أو غير صالح' });
    expect(parseCatalogBundle('{broken', foodsCatalogBundleSchema)).toEqual({ ok: false, message: 'صيغة JSON غير صالحة' });

    const huge = 'x'.repeat(MAX_CATALOG_JSON_BYTES + 10);
    expect(parseCatalogBundle(huge, foodsCatalogBundleSchema).ok).toBe(false);
  });

  it('rejects wrong bundle kind/version, negative macros, invalid basis, and item count > 500', () => {
    const wrongKind = JSON.stringify({ kind: 'asfit-drinks', version: 1, items: [] });
    expect(parseCatalogBundle(wrongKind, foodsCatalogBundleSchema).ok).toBe(false);

    const negativeCal = JSON.stringify({
      kind: 'asfit-foods',
      version: 1,
      items: [{ itemNameAr: 'صنف خاطئ', nutritionBasis: 'per_100g', calories: -10, proteinG: 5 }],
    });
    expect(parseCatalogBundle(negativeCal, foodsCatalogBundleSchema).ok).toBe(false);

    const tooMany = JSON.stringify({
      kind: 'asfit-drinks',
      version: 1,
      items: Array.from({ length: MAX_CATALOG_ITEMS + 1 }, (_, i) => ({
        nameAr: `مشروب ${i}`,
        byCoffeeWeight: false,
        caffeineMgPer100ml: 10,
        kcalPer100ml: 0,
        proteinGPer100ml: 0,
        defaultVolumeMl: 200,
      })),
    });
    expect(parseCatalogBundle(tooMany, drinksCatalogBundleSchema).ok).toBe(false);
  });
});
