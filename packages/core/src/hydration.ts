export const GLASS_ML = 250;
export const DEFAULT_WATER_GOAL_ML = 2500;
export const MIN_WATER_GOAL_ML = 1500;
/** Upper bound for a user-set goal. The app never encourages drinking more. */
export const MAX_WATER_GOAL_ML = 4000;

/**
 * A general starting point (about 35 ml per kg), kept within sensible
 * bounds. Needs vary with climate, sweat and health; users can adjust it.
 */
export function suggestedWaterGoalMl(weightKg?: number): number {
  if (!weightKg || weightKg < 30 || weightKg > 250) return DEFAULT_WATER_GOAL_ML;
  const raw = Math.round((weightKg * 35) / GLASS_ML) * GLASS_ML;
  return Math.min(3500, Math.max(2000, raw));
}

export function clampWaterGoalMl(ml: number): number {
  if (!Number.isFinite(ml)) return DEFAULT_WATER_GOAL_ML;
  return Math.min(MAX_WATER_GOAL_ML, Math.max(MIN_WATER_GOAL_ML, Math.round(ml / GLASS_ML) * GLASS_ML));
}

export const HYDRATION_NOTE =
  'Drink regularly through the day, and a bit more when it is hot or you sweat a lot. ' +
  'More is not always better — drinking very large amounts quickly can be harmful. ' +
  'If you have kidney or heart conditions, follow your doctor’s advice.';

export interface WaterEntry {
  /** Set on new entries so entries from two devices can be merged. */
  id?: string;
  date: string;
  ml: number;
}

export function waterForDate(entries: WaterEntry[], date: string): number {
  return entries.filter((e) => e.date === date).reduce((t, e) => t + e.ml, 0);
}
