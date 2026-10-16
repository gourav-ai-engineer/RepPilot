import { getExercise } from './exercises';
import { MUSCLES, type Experience, type Muscle, type WeeklyPlan, type WorkoutLog } from './types';

export type MuscleVolume = Record<Muscle, number>;

/** Secondary muscles count as half a set. */
const SECONDARY_WEIGHT = 0.5;

/** Muscles that get plenty of indirect work and need lower direct targets. */
export const MINOR_MUSCLES: Muscle[] = ['forearms', 'lower_back', 'calves'];
export const MAJOR_MUSCLES: Muscle[] = MUSCLES.filter((m) => !MINOR_MUSCLES.includes(m));

const MAJOR_TARGET: Record<Experience, number> = { beginner: 6, intermediate: 10, advanced: 12 };

export function emptyVolume(): MuscleVolume {
  return Object.fromEntries(MUSCLES.map((m) => [m, 0])) as MuscleVolume;
}

export function addVolume(vol: MuscleVolume, exerciseId: string, sets: number): void {
  const ex = getExercise(exerciseId);
  if (!ex || sets <= 0) return;
  for (const m of ex.primary) vol[m] += sets;
  for (const m of ex.secondary) vol[m] += sets * SECONDARY_WEIGHT;
}

export function planVolume(plan: WeeklyPlan): MuscleVolume {
  const vol = emptyVolume();
  for (const s of plan.sessions) {
    if (s.status === 'skipped') continue;
    for (const p of s.exercises) addVolume(vol, p.exerciseId, p.sets);
  }
  return vol;
}

/** Weighted sets per muscle from logs whose date is in [from, to] (inclusive, ISO dates). */
export function logVolume(logs: WorkoutLog[], from: string, to: string): MuscleVolume {
  const vol = emptyVolume();
  for (const log of logs) {
    if (log.date < from || log.date > to) continue;
    for (const e of log.entries) addVolume(vol, e.exerciseId, e.sets.length);
  }
  return vol;
}

/** Suggested weekly weighted sets. A guide for spotting gaps, not a rule. */
export function weeklyTarget(muscle: Muscle, experience: Experience): number {
  const t = MAJOR_TARGET[experience];
  return MINOR_MUSCLES.includes(muscle) ? Math.round(t / 2) : t;
}

export type CoverageStatus = 'neglected' | 'low' | 'good';

export interface CoverageRow {
  muscle: Muscle;
  sets: number;
  target: number;
  status: CoverageStatus;
}

/**
 * Coverage is judged across the whole training cycle (a week here), not per
 * session — every muscle does not need to be trained every day.
 */
export function coverageReport(vol: MuscleVolume, experience: Experience): CoverageRow[] {
  return MUSCLES.map((muscle) => {
    const target = weeklyTarget(muscle, experience);
    const sets = Math.round(vol[muscle] * 10) / 10;
    const ratio = sets / target;
    const status: CoverageStatus = ratio < 0.34 ? 'neglected' : ratio < 0.75 ? 'low' : 'good';
    return { muscle, sets, target, status };
  });
}

/** Major muscle groups that are clearly under-trained. */
export function neglectedMuscles(rows: CoverageRow[]): Muscle[] {
  return rows.filter((r) => r.status === 'neglected' && MAJOR_MUSCLES.includes(r.muscle)).map((r) => r.muscle);
}
