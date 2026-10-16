import { describe, expect, it } from 'vitest';
import { clampWaterGoalMl, dailyTotals, foodsForDiet, proteinRangeG, suggestedWaterGoalMl, MAX_WATER_GOAL_ML } from '../src';

describe('nutrition and hydration', () => {
  it('filters foods by diet', () => {
    expect(foodsForDiet('vegan').every((f) => f.tag === 'vegan')).toBe(true);
    expect(foodsForDiet('vegetarian').some((f) => f.tag === 'egg' || f.tag === 'non_veg')).toBe(false);
  });

  it('gives a protein range only with a plausible weight', () => {
    expect(proteinRangeG(70, 'muscle_growth')).toEqual({ min: 98, max: 140 });
    expect(proteinRangeG(undefined, 'strength')).toBeNull();
  });

  it('totals meals for one day', () => {
    const t = dailyTotals([
      { id: '1', date: '2026-10-12', foodId: 'egg', servings: 2 },
      { id: '2', date: '2026-10-11', foodId: 'egg', servings: 5 },
    ], '2026-10-12');
    expect(t.proteinG).toBe(12);
  });

  it('never suggests or allows excessive water goals', () => {
    expect(suggestedWaterGoalMl(150)).toBeLessThanOrEqual(3500);
    expect(clampWaterGoalMl(10000)).toBe(MAX_WATER_GOAL_ML);
    expect(clampWaterGoalMl(Number.NaN)).toBe(2500);
  });
});
