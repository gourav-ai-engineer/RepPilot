import type { WaterEntry } from './hydration';
import type { MealEntry } from './nutrition';
import type { Profile, WeeklyPlan, WorkoutLog } from './types';

/** The part of the app state that is backed up and synced between devices. */
export interface SyncData {
  updatedAt: string;
  profile?: Profile;
  plan?: WeeklyPlan;
  pastPlans: WeeklyPlan[];
  logs: WorkoutLog[];
  meals: MealEntry[];
  water: WaterEntry[];
  waterGoalMl: number;
}

function unionById<T>(newer: T[], older: T[], key: (x: T) => string): T[] {
  const map = new Map<string, T>();
  for (const x of older) map.set(key(x), x);
  for (const x of newer) map.set(key(x), x); // newer side wins on the same id
  return [...map.values()];
}

const waterKey = (w: WaterEntry) => w.id ?? `${w.date}:${w.ml}:legacy`;

function mergePlans(newer: WeeklyPlan | undefined, older: WeeklyPlan | undefined): WeeklyPlan | undefined {
  if (!newer || !older) return newer ?? older;
  if (newer.weekStart !== older.weekStart) return newer.weekStart > older.weekStart ? newer : older;
  // Same week: keep the newer plan, but never lose a workout marked done on the other device.
  const olderById = new Map(older.sessions.map((s) => [s.id, s]));
  return {
    ...newer,
    sessions: newer.sessions.map((s) =>
      s.status === 'planned' && olderById.get(s.id)?.status === 'completed' ? { ...s, status: 'completed' } : s,
    ),
    changeLog: unionById(newer.changeLog, older.changeLog, (c) => `${c.at}|${c.description}`),
  };
}

/**
 * Merges two copies of the user's data (e.g. phone and web) without losing
 * logged workouts, meals or water. Settings come from the most recently
 * changed copy.
 */
export function mergeSyncData(a: SyncData, b: SyncData): SyncData {
  const [newer, older] = a.updatedAt >= b.updatedAt ? [a, b] : [b, a];
  return {
    updatedAt: newer.updatedAt,
    profile: newer.profile ?? older.profile,
    plan: mergePlans(newer.plan, older.plan),
    pastPlans: unionById(newer.pastPlans, older.pastPlans, (p) => p.weekStart)
      .sort((x, y) => y.weekStart.localeCompare(x.weekStart))
      .slice(0, 12),
    logs: unionById(newer.logs, older.logs, (l) => l.id).sort((x, y) => x.date.localeCompare(y.date)),
    meals: unionById(newer.meals, older.meals, (m) => m.id),
    water: unionById(newer.water, older.water, waterKey),
    waterGoalMl: newer.waterGoalMl,
  };
}
