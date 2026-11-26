import { z } from 'zod';
import { int, num } from './common';
import { MEAL_TYPES } from './schemas';

export const mealTemplateSchema = z.object({
  nameAr: z.string().trim().min(1, 'أدخل اسماً للقالب').max(120, 'الاسم طويل جداً'),
  defaultMealType: z.enum(MEAL_TYPES).optional(),
  items: z
    .array(z.object({ foodId: int(1, 1e9), quantity: num(0.1, 5000) }))
    .min(1, 'أضف صنفاً واحداً على الأقل')
    .max(50, 'الحد الأقصى 50 صنفاً في القالب'),
});

export type MealTemplateInput = z.input<typeof mealTemplateSchema>;
