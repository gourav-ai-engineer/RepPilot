import { describe, expect, it } from 'vitest';
import { computeAchievements, computeProgress, consistentWeekThreshold, findPersonalRecords, type WorkoutLog } from '../src';

const log = (date: string, exerciseId = 'goblet_squat', weightKg = 10, reps = 10): WorkoutLog => ({
  id: date + exerciseId,
  date,
  entries: [{ exerciseId, sets: [{ reps, weightKg }, { reps, weightKg }] }],
});

describe('progress', () => {
  it('needs about two-thirds of planned days for a consistent week', () => {
    expect(consistentWeekThreshold(3)).toBe(2);
    expect(consistentWeekThreshold(4)).toBe(3);
    expect(consistentWeekThreshold(1)).toBe(1);
  });

  it('counts week streaks and does not break on an unfinished current week', () => {
    const logs = [log('2026-09-28'), log('2026-09-30'), log('2026-10-05'), log('2026-10-07'), log('2026-10-12')];
    const stats = computeProgress(logs, 3, '2026-10-13');
    expect(stats.weekStreak).toBe(2);
    expect(stats.totalWorkouts).toBe(5);
  });

  it('does not count duplicate logs on the same day twice', () => {
    const stats = computeProgress([log('2026-10-12'), log('2026-10-12', 'push_up', 0)], 3, '2026-10-12');
    expect(stats.totalWorkouts).toBe(1);
  });

  it('detects personal records after a baseline', () => {
    const prs = findPersonalRecords([log('2026-10-01', 'goblet_squat', 10), log('2026-10-03', 'goblet_squat', 12), log('2026-10-05', 'goblet_squat', 12)]);
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ value: 12, unit: 'kg' });
  });

  it('starts as Recruit and awards first-workout achievement', () => {
    const stats = computeProgress([log('2026-10-12')], 3, '2026-10-12');
    expect(stats.rank).toBe('Recruit');
    const ach = computeAchievements([log('2026-10-12')], stats, 'beginner');
    expect(ach.find((a) => a.id === 'first_workout')!.earned).toBe(true);
    expect(ach.find((a) => a.id === 'workouts_5')!.earned).toBe(false);
  });
});
