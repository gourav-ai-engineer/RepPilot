import type { Diet, Goal } from './types';

export const NUTRITION_DISCLAIMER =
  'These are rough estimates for general guidance. Real values change with portion size, recipe and brand. ' +
  'For medical conditions, pregnancy, allergies or specific deficiencies, please talk to a doctor or registered dietitian.';

export type FoodTag = 'veg' | 'egg' | 'non_veg' | 'vegan';

export interface Food {
  id: string;
  name: string;
  serving: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  tag: FoodTag;
  /** Rough cost band in India: 1 = budget, 3 = expensive. */
  cost: 1 | 2 | 3;
}

/** Approximate values per typical home serving. Sample data for the MVP. */
export const FOODS: Food[] = [
  { id: 'dal', name: 'Dal (cooked lentils)', serving: '1 katori (150 g)', kcal: 180, proteinG: 9, carbsG: 27, fatG: 4, tag: 'vegan', cost: 1 },
  { id: 'rajma', name: 'Rajma (kidney bean curry)', serving: '1 katori (150 g)', kcal: 210, proteinG: 10, carbsG: 30, fatG: 6, tag: 'vegan', cost: 1 },
  { id: 'chana', name: 'Chana / chole', serving: '1 katori (150 g)', kcal: 240, proteinG: 11, carbsG: 34, fatG: 7, tag: 'vegan', cost: 1 },
  { id: 'soya_chunks', name: 'Soya chunks (cooked)', serving: '1 katori (≈30 g dry)', kcal: 105, proteinG: 15, carbsG: 9, fatG: 0.5, tag: 'vegan', cost: 1 },
  { id: 'paneer', name: 'Paneer', serving: '100 g', kcal: 265, proteinG: 18, carbsG: 4, fatG: 20, tag: 'veg', cost: 2 },
  { id: 'tofu', name: 'Tofu', serving: '100 g', kcal: 145, proteinG: 15, carbsG: 3, fatG: 8, tag: 'vegan', cost: 2 },
  { id: 'curd', name: 'Curd (dahi)', serving: '1 katori (150 g)', kcal: 90, proteinG: 5, carbsG: 7, fatG: 4.5, tag: 'veg', cost: 1 },
  { id: 'milk', name: 'Milk (toned)', serving: '1 glass (250 ml)', kcal: 145, proteinG: 8, carbsG: 12, fatG: 7.5, tag: 'veg', cost: 1 },
  { id: 'peanuts', name: 'Roasted peanuts', serving: '1 handful (30 g)', kcal: 170, proteinG: 7.5, carbsG: 5, fatG: 14, tag: 'vegan', cost: 1 },
  { id: 'sprouts', name: 'Moong sprouts', serving: '1 katori (100 g)', kcal: 30, proteinG: 3, carbsG: 6, fatG: 0.2, tag: 'vegan', cost: 1 },
  { id: 'besan_chilla', name: 'Besan chilla', serving: '1 medium', kcal: 150, proteinG: 7, carbsG: 18, fatG: 5, tag: 'vegan', cost: 1 },
  { id: 'egg', name: 'Boiled egg', serving: '1 egg', kcal: 75, proteinG: 6, carbsG: 0.5, fatG: 5, tag: 'egg', cost: 1 },
  { id: 'omelette', name: 'Omelette (2 eggs)', serving: '1 omelette', kcal: 190, proteinG: 13, carbsG: 2, fatG: 14, tag: 'egg', cost: 1 },
  { id: 'chicken_curry', name: 'Chicken curry', serving: '1 katori (150 g)', kcal: 250, proteinG: 22, carbsG: 6, fatG: 15, tag: 'non_veg', cost: 2 },
  { id: 'grilled_chicken', name: 'Grilled chicken breast', serving: '100 g', kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, tag: 'non_veg', cost: 2 },
  { id: 'fish_curry', name: 'Fish curry', serving: '1 katori (150 g)', kcal: 200, proteinG: 20, carbsG: 5, fatG: 11, tag: 'non_veg', cost: 2 },
  { id: 'roti', name: 'Roti / chapati', serving: '1 medium', kcal: 100, proteinG: 3, carbsG: 18, fatG: 2, tag: 'vegan', cost: 1 },
  { id: 'rice', name: 'Cooked rice', serving: '1 katori (150 g)', kcal: 195, proteinG: 4, carbsG: 43, fatG: 0.4, tag: 'vegan', cost: 1 },
  { id: 'poha', name: 'Poha', serving: '1 plate (200 g)', kcal: 250, proteinG: 5, carbsG: 45, fatG: 6, tag: 'vegan', cost: 1 },
  { id: 'idli', name: 'Idli with sambar', serving: '2 idli + 1 katori sambar', kcal: 230, proteinG: 8, carbsG: 42, fatG: 3, tag: 'vegan', cost: 1 },
  { id: 'oats', name: 'Oats (cooked with water)', serving: '1 bowl (40 g dry)', kcal: 150, proteinG: 5, carbsG: 27, fatG: 3, tag: 'vegan', cost: 1 },
  { id: 'banana', name: 'Banana', serving: '1 medium', kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, tag: 'vegan', cost: 1 },
  { id: 'vegetable_sabzi', name: 'Mixed vegetable sabzi', serving: '1 katori (150 g)', kcal: 120, proteinG: 3, carbsG: 14, fatG: 6, tag: 'vegan', cost: 1 },
  { id: 'whey', name: 'Whey protein', serving: '1 scoop (30 g)', kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5, tag: 'veg', cost: 3 },
];

const FOOD_BY_ID = new Map(FOODS.map((f) => [f.id, f]));
export function getFood(id: string): Food | undefined {
  return FOOD_BY_ID.get(id);
}

const ALLOWED: Record<Diet, FoodTag[]> = {
  vegan: ['vegan'],
  vegetarian: ['vegan', 'veg'],
  eggetarian: ['vegan', 'veg', 'egg'],
  non_vegetarian: ['vegan', 'veg', 'egg', 'non_veg'],
};

export function foodsForDiet(diet: Diet): Food[] {
  return FOODS.filter((f) => ALLOWED[diet].includes(f.tag));
}

/** Protein-rich, budget-friendly suggestions that fit the user's diet. */
export function proteinSuggestions(diet: Diet, limit = 6): Food[] {
  return foodsForDiet(diet)
    .filter((f) => f.proteinG >= 5)
    .sort((a, b) => a.cost - b.cost || b.proteinG / b.kcal - a.proteinG / a.kcal)
    .slice(0, limit);
}

/**
 * General protein range in grams per day from common sports-nutrition
 * guidance for healthy adults. Returned as a range, not a prescription.
 */
export function proteinRangeG(weightKg: number | undefined, goal: Goal): { min: number; max: number } | null {
  if (!weightKg || weightKg < 30 || weightKg > 250) return null;
  const [lo, hi] = goal === 'strength' || goal === 'muscle_growth' ? [1.4, 2.0] : [1.0, 1.6];
  return { min: Math.round(weightKg * lo), max: Math.round(weightKg * hi) };
}

export interface MealEntry {
  id: string;
  date: string;
  foodId: string;
  servings: number;
}

export interface NutritionTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function dailyTotals(entries: MealEntry[], date: string): NutritionTotals {
  const t: NutritionTotals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const e of entries) {
    if (e.date !== date) continue;
    const f = getFood(e.foodId);
    if (!f) continue;
    t.kcal += f.kcal * e.servings;
    t.proteinG += f.proteinG * e.servings;
    t.carbsG += f.carbsG * e.servings;
    t.fatG += f.fatG * e.servings;
  }
  return {
    kcal: Math.round(t.kcal),
    proteinG: Math.round(t.proteinG),
    carbsG: Math.round(t.carbsG),
    fatG: Math.round(t.fatG),
  };
}

/** General education about vitamins and minerals. Not a diagnosis tool. */
export const MICRONUTRIENT_TIPS: { name: string; why: string; foods: string }[] = [
  { name: 'Iron', why: 'Helps carry oxygen in your blood.', foods: 'Dal, chana, rajma, spinach, jaggery. Eat with lemon or amla to absorb more.' },
  { name: 'Calcium', why: 'Keeps bones strong.', foods: 'Milk, curd, paneer, ragi, sesame seeds.' },
  { name: 'Vitamin D', why: 'Helps your body use calcium.', foods: 'Safe sunlight, eggs, fortified milk. Ask a doctor before taking supplements.' },
  { name: 'Vitamin B12', why: 'Needed for nerves and blood. Low in vegan diets.', foods: 'Milk, curd, eggs, fish, fortified foods.' },
  { name: 'Potassium', why: 'Helps muscles and fluid balance.', foods: 'Banana, coconut water, potatoes, dal, vegetables.' },
  { name: 'Magnesium', why: 'Helps muscle and nerve function.', foods: 'Nuts, seeds, whole grains, leafy greens.' },
];
