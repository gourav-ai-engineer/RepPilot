import { coverageReport, logVolume, neglectedMuscles } from './coverage';
import { addDays, mondayOf } from './dates';
import type { Experience, WorkoutLog } from './types';

export const RANKS = [
  { name: 'Recruit', minPoints: 0 },
  { name: 'Cadet', minPoints: 100 },
  { name: 'Athlete', minPoints: 300 },
  { name: 'Specialist', minPoints: 700 },
  { name: 'Elite', minPoints: 1500 },
  { name: 'Champion', minPoints: 3000 },
] as const;
export type RankName = (typeof RANKS)[number]['name'];

export const RANK_DISCLAIMER =
  'Your rank shows your consistency and personal progress in RepPilot. It is not a measure of health, fitness or worth.';

const POINTS = { workout: 10, consistentWeek: 25, personalRecord: 5 };

export interface PersonalRecord {
  exerciseId: string;
  date: string;
  /** Best weight in kg, or best reps for bodyweight work. */
  value: number;
  unit: 'kg' | 'reps';
}

export interface ProgressStats {
  totalWorkouts: number;
  consistentWeeks: number;
  weekStreak: number;
  personalRecords: PersonalRecord[];
  points: number;
  rank: RankName;
  nextRank?: { name: RankName; pointsNeeded: number };
}

export function hasLoggedWork(log: WorkoutLog): boolean {
  return log.entries.some((e) => e.sets.some((s) => s.reps > 0));
}

/** A week counts as consistent at about two-thirds of planned days. Rest is never penalised. */
export function consistentWeekThreshold(plannedDays: number): number {
  return Math.max(1, Math.ceil((Math.max(1, plannedDays) * 2) / 3));
}

/**
 * Personal records: the first time an exercise is logged sets a baseline, and
 * each later log that beats the best so far is a PR.
 */
export function findPersonalRecords(logs: WorkoutLog[]): PersonalRecord[] {
  const best = new Map<string, number>();
  const prs: PersonalRecord[] = [];
  const ordered = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  for (const log of ordered) {
    for (const entry of log.entries) {
      const weighted = entry.sets.some((s) => (s.weightKg ?? 0) > 0);
      const value = weighted
        ? Math.max(...entry.sets.filter((s) => s.reps > 0).map((s) => s.weightKg ?? 0), 0)
        : Math.max(...entry.sets.map((s) => s.reps), 0);
      if (value <= 0) continue;
      const key = `${entry.exerciseId}:${weighted ? 'kg' : 'reps'}`;
      const prev = best.get(key);
      if (prev !== undefined && value > prev) {
        prs.push({ exerciseId: entry.exerciseId, date: log.date, value, unit: weighted ? 'kg' : 'reps' });
      }
      if (prev === undefined || value > prev) best.set(key, value);
    }
  }
  return prs;
}

export function computeProgress(logs: WorkoutLog[], plannedDaysPerWeek: number, today: string): ProgressStats {
  const real = logs.filter(hasLoggedWork);
  const perWeek = new Map<string, Set<string>>();
  for (const log of real) {
    const wk = mondayOf(log.date);
    if (!perWeek.has(wk)) perWeek.set(wk, new Set());
    perWeek.get(wk)!.add(log.date);
  }
  const threshold = consistentWeekThreshold(plannedDaysPerWeek);
  const isConsistent = (wk: string) => (perWeek.get(wk)?.size ?? 0) >= threshold;
  const consistentWeeks = [...perWeek.keys()].filter(isConsistent).length;

  // The current week only counts once reached; an unfinished week never breaks the streak.
  let wk = mondayOf(today);
  if (!isConsistent(wk)) wk = addDays(wk, -7);
  let weekStreak = 0;
  while (isConsistent(wk)) {
    weekStreak++;
    wk = addDays(wk, -7);
  }

  const personalRecords = findPersonalRecords(real);
  // Count distinct training days so duplicate logs cannot inflate points.
  const totalWorkouts = new Set(real.map((l) => l.date)).size;
  const points =
    totalWorkouts * POINTS.workout + consistentWeeks * POINTS.consistentWeek + personalRecords.length * POINTS.personalRecord;

  let idx = 0;
  RANKS.forEach((r, i) => {
    if (points >= r.minPoints) idx = i;
  });
  const next = RANKS[idx + 1];
  return {
    totalWorkouts,
    consistentWeeks,
    weekStreak,
    personalRecords,
    points,
    rank: RANKS[idx]!.name,
    nextRank: next ? { name: next.name, pointsNeeded: next.minPoints - points } : undefined,
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
}

export function computeAchievements(
  logs: WorkoutLog[],
  stats: ProgressStats,
  experience: Experience,
): Achievement[] {
  const list: Achievement[] = [];
  const add = (id: string, title: string, description: string, earned: boolean) =>
    list.push({ id, title, description, earned });

  add('first_workout', 'First step', 'Log your first workout.', stats.totalWorkouts >= 1);
  for (const n of [5, 10, 25, 50, 100]) {
    add(`workouts_${n}`, `${n} workouts`, `Log ${n} workouts.`, stats.totalWorkouts >= n);
  }
  for (const n of [2, 4, 8, 12]) {
    add(`streak_${n}`, `${n}-week streak`, `Stay consistent for ${n} weeks in a row. Rest days never break it.`, stats.weekStreak >= n);
  }
  add('first_pr', 'New personal best', 'Beat your previous best on any exercise.', stats.personalRecords.length >= 1);
  add('ten_prs', '10 personal bests', 'Set 10 personal bests.', stats.personalRecords.length >= 10);

  // Balanced week: no neglected major muscle group in any logged week.
  const weeks = new Set(logs.filter(hasLoggedWork).map((l) => mondayOf(l.date)));
  const balanced = [...weeks].some((wk) =>
    neglectedMuscles(coverageReport(logVolume(logs, wk, addDays(wk, 6)), experience)).length === 0,
  );
  add('balanced_week', 'Balanced week', 'Train every major muscle group in one week.', balanced);
  return list;
}
