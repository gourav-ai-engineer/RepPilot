import { describe, expect, it } from 'vitest';
import { EXERCISES, MUSCLES, isEligible } from '../src';

describe('exercise library', () => {
  it('has unique ids', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('documents muscle mapping and instructions for every exercise', () => {
    for (const ex of EXERCISES) {
      expect(ex.primary.length, ex.id).toBeGreaterThan(0);
      expect(ex.instructions.length, ex.id).toBeGreaterThan(0);
      expect(ex.cues.length, ex.id).toBeGreaterThan(0);
      for (const m of [...ex.primary, ...ex.secondary]) expect(MUSCLES).toContain(m);
      expect(ex.primary.some((m) => ex.secondary.includes(m)), ex.id).toBe(false);
    }
  });

  it('has a no-equipment beginner option for the main movement patterns', () => {
    const ctx = { equipment: [], limitations: [], experience: 'beginner' as const };
    for (const pattern of ['horizontal_push', 'horizontal_pull', 'squat', 'hinge', 'lunge', 'core_stability'] as const) {
      expect(EXERCISES.some((e) => e.pattern === pattern && isEligible(e, ctx)), pattern).toBe(true);
    }
  });
});
