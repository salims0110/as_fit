import { describe, expect, it } from 'vitest';
import { mealTemplateSchema } from '@/lib/validation/meal-templates';

describe('mealTemplateSchema validation', () => {
  it('accepts valid template with trimmed Arabic name and positive item quantities', () => {
    const res = mealTemplateSchema.safeParse({
      nameAr: '  فطور البيض والشوفان  ',
      defaultMealType: 'breakfast',
      items: [
        { foodId: 1, quantity: 2 },
        { foodId: 8, quantity: 60 },
      ],
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.nameAr).toBe('فطور البيض والشوفان');
      expect(res.data.items).toHaveLength(2);
    }
  });

  it('rejects blank names, empty item lists, non-positive quantities, and invalid meal types', () => {
    expect(mealTemplateSchema.safeParse({ nameAr: '   ', items: [{ foodId: 1, quantity: 100 }] }).success).toBe(false);
    expect(mealTemplateSchema.safeParse({ nameAr: 'قالب فارغ', items: [] }).success).toBe(false);
    expect(mealTemplateSchema.safeParse({ nameAr: 'كمية صفر', items: [{ foodId: 1, quantity: 0 }] }).success).toBe(false);
    expect(
      mealTemplateSchema.safeParse({
        nameAr: 'نوع خاطئ',
        defaultMealType: 'midnight',
        items: [{ foodId: 1, quantity: 100 }],
      }).success,
    ).toBe(false);
  });
});
