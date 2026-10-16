import { describe, expect, it } from 'vitest';
import {
  coverageReport, estimateSessionMinutes, generateWeeklyPlan, hasEquipment, neglectedMuscles, planVolume,
  requireExercise, swapExerciseInPlan,
} from '../src';
import { WEEK, gymProfile, homeBeginner } from './fixtures';

describe('generateWeeklyPlan', () => {
  it('is deterministic', () => {
    expect(generateWeeklyPlan(gymProfile, { weekStart: WEEK })).toEqual(generateWeeklyPlan(gymProfile, { weekStart: WEEK }));
  });

  it('puts sessions on the chosen days only', () => {
    const plan = generateWeeklyPlan(gymProfile, { weekStart: WEEK });
    expect(plan.sessions.map((s) => s.day)).toEqual([0, 2, 4]);
    expect(plan.sessions.every((s) => s.exercises.length >= 2)).toBe(true);
  });

  it('only uses equipment the user has', () => {
    const plan = generateWeeklyPlan(homeBeginner, { weekStart: WEEK });
    for (const s of plan.sessions) for (const p of s.exercises) {
      expect(hasEquipment(requireExercise(p.exerciseId), []), p.exerciseId).toBe(true);
    }
  });

  it('respects experience level and limitations', () => {
    const plan = generateWeeklyPlan({ ...gymProfile, experience: 'beginner', limitations: ['lower_back', 'knee'] }, { weekStart: WEEK });
    for (const s of plan.sessions) for (const p of s.exercises) {
      const ex = requireExercise(p.exerciseId);
      expect(ex.difficulty, ex.id).toBe(1);
      expect(ex.avoidWith.includes('lower_back') || ex.avoidWith.includes('knee'), ex.id).toBe(false);
    }
  });

  it('never repeats an exercise inside one session', () => {
    for (const days of [1, 2, 3, 4, 5, 6] as const) {
      const p = { ...gymProfile, trainingDays: [0, 1, 2, 3, 4, 5].slice(0, days) as typeof gymProfile.trainingDays };
      for (const s of generateWeeklyPlan(p, { weekStart: WEEK }).sessions) {
        const ids = s.exercises.map((e) => e.exerciseId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('keeps a rest day when all seven days are chosen', () => {
    const plan = generateWeeklyPlan({ ...gymProfile, trainingDays: [0, 1, 2, 3, 4, 5, 6] }, { weekStart: WEEK });
    expect(plan.sessions).toHaveLength(6);
    expect(plan.changeLog.some((c) => /rest day/.test(c.description))).toBe(true);
  });

  it('roughly fits the session time', () => {
    for (const profile of [gymProfile, homeBeginner]) {
      for (const s of generateWeeklyPlan(profile, { weekStart: WEEK }).sessions) {
        expect(estimateSessionMinutes(s)).toBeLessThanOrEqual(profile.sessionMinutes + 15);
      }
    }
  });

  const SPLITS = [[0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5]] as const;

  it('leaves no major muscle group neglected with gym equipment', () => {
    for (const days of SPLITS) {
      const plan = generateWeeklyPlan({ ...gymProfile, trainingDays: [...days] }, { weekStart: WEEK });
      expect(neglectedMuscles(coverageReport(planVolume(plan), gymProfile.experience)), `${days.length}d`).toEqual([]);
    }
  });

  it('tells the user when their equipment leaves a gap', () => {
    for (const days of SPLITS) {
      const plan = generateWeeklyPlan({ ...homeBeginner, trainingDays: [...days] }, { weekStart: WEEK });
      const gaps = neglectedMuscles(coverageReport(planVolume(plan), homeBeginner.experience));
      const notice = plan.changeLog.some((c) => /get little work/.test(c.description));
      expect(notice, `${days.length}d`).toBe(gaps.length > 0);
    }
  });

  it('covers every major muscle group across a 3-day gym week', () => {
    const plan = generateWeeklyPlan(gymProfile, { weekStart: WEEK });
    expect(neglectedMuscles(coverageReport(planVolume(plan), gymProfile.experience))).toEqual([]);
  });

  it('swaps an exercise and records the change', () => {
    const plan = generateWeeklyPlan(gymProfile, { weekStart: WEEK });
    const s = plan.sessions[0]!;
    const from = s.exercises[0]!.exerciseId;
    const next = swapExerciseInPlan(plan, s.id, from, 'push_up', '2026-10-12', gymProfile);
    expect(next.sessions[0]!.exercises[0]!.exerciseId).toBe('push_up');
    expect(next.changeLog.at(-1)!.description).toMatch(/Swapped/);
  });
});
