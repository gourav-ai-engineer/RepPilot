import { describe, expect, it } from 'vitest';
import { eligibilityFromProfile, findSubstitutes, requireExercise } from '../src';
import { gymProfile, homeBeginner } from './fixtures';

describe('findSubstitutes', () => {
  it('suggests a close chest press when the barbell is busy', () => {
    const subs = findSubstitutes('barbell_bench_press', { ...eligibilityFromProfile(gymProfile), unavailable: ['barbell'] });
    expect(subs.length).toBeGreaterThan(0);
    expect(subs[0]!.exercise.pattern).toBe('horizontal_push');
    expect(subs.every((s) => !s.exercise.equipment.includes('barbell'))).toBe(true);
    expect(subs[0]!.reasons.length).toBeGreaterThan(0);
    expect(subs[0]!.differences.length).toBeGreaterThan(0);
  });

  it('only offers exercises a home beginner can do', () => {
    const subs = findSubstitutes('lat_pulldown', eligibilityFromProfile(homeBeginner));
    for (const s of subs) {
      expect(s.exercise.equipment.every((e) => e === 'bodyweight')).toBe(true);
      expect(s.exercise.difficulty).toBe(1);
    }
  });

  it('respects limitations', () => {
    const subs = findSubstitutes('goblet_squat', { ...eligibilityFromProfile(gymProfile), limitations: ['knee'] });
    for (const s of subs) expect(requireExercise(s.exercise.id).avoidWith).not.toContain('knee');
  });

  it('always shares a primary muscle with the original', () => {
    const original = requireExercise('db_curl');
    for (const s of findSubstitutes('db_curl', eligibilityFromProfile(gymProfile))) {
      expect(s.exercise.primary.some((m) => original.primary.includes(m))).toBe(true);
    }
  });
});
