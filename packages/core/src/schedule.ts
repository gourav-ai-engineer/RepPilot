import { requireExercise } from './exercises';
import { WEEKDAY_LABELS, listMuscles } from './labels';
import type { Muscle, PlannedExercise, Session, Weekday, WeeklyPlan } from './types';

export type MissedChoice = 'reschedule' | 'skip';

export interface ScheduleProposal {
  /** The revised plan. Nothing is saved until the user approves it. */
  plan: WeeklyPlan;
  /** Plain-language explanation of what changed and why. */
  summary: string[];
  movedTo?: Weekday;
}

export function sessionPrimaryMuscles(session: Session): Set<Muscle> {
  const set = new Set<Muscle>();
  for (const p of session.exercises) for (const m of requireExercise(p.exerciseId).primary) set.add(m);
  return set;
}

function sharedRatio(a: Set<Muscle>, b: Set<Muscle>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const m of a) if (b.has(m)) shared++;
  return shared / Math.min(a.size, b.size);
}

/** Two sessions this similar should not be on back-to-back days. */
const RECOVERY_OVERLAP_LIMIT = 0.5;
/**
 * Never build a run of training days longer than this, or longer than the
 * user's own plan already has (someone training 6 days chose that).
 */
const MAX_CONSECUTIVE_DAYS = 3;

function activeSessions(plan: WeeklyPlan, excludeId?: string): Session[] {
  return plan.sessions.filter((s) => s.status !== 'skipped' && s.id !== excludeId);
}

function longestRun(days: Set<number>): number {
  let best = 0;
  let run = 0;
  for (let d = 0; d < 7; d++) {
    run = days.has(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Days from `today` to Sunday where the session could safely move. */
export function safeDaysFor(plan: WeeklyPlan, session: Session, today: Weekday): Weekday[] {
  const others = activeSessions(plan, session.id);
  const taken = new Map(others.map((s) => [s.day, s]));
  const muscles = sessionPrimaryMuscles(session);
  const allowedRun = Math.max(MAX_CONSECUTIVE_DAYS, longestRun(new Set(taken.keys())));
  const result: Weekday[] = [];
  for (let d = today; d <= 6; d++) {
    const day = d as Weekday;
    if (day === session.day || taken.has(day)) continue;
    const neighbours = [taken.get((day - 1) as Weekday), taken.get((day + 1) as Weekday)];
    const tooSimilar = neighbours.some(
      (n) => n && sharedRatio(muscles, sessionPrimaryMuscles(n)) > RECOVERY_OVERLAP_LIMIT,
    );
    if (tooSimilar) continue;
    const days = new Set<number>([...taken.keys(), day]);
    if (longestRun(days) > allowedRun) continue;
    result.push(day);
  }
  return result;
}

function musclesTrainedElsewhere(plan: WeeklyPlan, missed: Session, today: Weekday): Set<Muscle> {
  const set = new Set<Muscle>();
  for (const s of activeSessions(plan, missed.id)) {
    if (s.status === 'completed' || s.day >= today) for (const m of sessionPrimaryMuscles(s)) set.add(m);
  }
  return set;
}

/**
 * Builds a revised plan after a missed session. Never stacks two sessions on
 * one day, never doubles volume, and keeps rest days between similar
 * sessions. The result is a proposal the user must approve or edit.
 */
export function proposeMissedSession(
  plan: WeeklyPlan,
  sessionId: string,
  today: Weekday,
  choice: MissedChoice,
  at: string,
  /** A day the user picked; used only if it is one of the safe days. */
  preferredDay?: Weekday,
): ScheduleProposal {
  const missed = plan.sessions.find((s) => s.id === sessionId);
  if (!missed) throw new Error(`Unknown session: ${sessionId}`);

  if (choice === 'reschedule') {
    const options = safeDaysFor(plan, missed, today);
    const to = preferredDay !== undefined && options.includes(preferredDay) ? preferredDay : options[0];
    if (to !== undefined) {
      const dayName = WEEKDAY_LABELS[to];
      return {
        movedTo: to,
        plan: {
          ...plan,
          sessions: plan.sessions
            .map((s) => (s.id === sessionId ? { ...s, day: to, status: 'planned' as const } : s))
            .sort((a, b) => a.day - b.day),
          changeLog: [
            ...plan.changeLog,
            { at, description: `Moved "${missed.title}" from ${WEEKDAY_LABELS[missed.day]} to ${dayName}.` },
          ],
        },
        summary: [
          `"${missed.title}" moves to ${dayName}.`,
          'Your other workouts stay the same.',
          'We picked a day that still gives your muscles time to rest.',
        ],
      };
    }
  }

  // Skip (by choice, or because no safe day is left this week).
  const elsewhere = musclesTrainedElsewhere(plan, missed, today);
  const uncovered = [...sessionPrimaryMuscles(missed)].filter((m) => !elsewhere.has(m));
  const summary: string[] =
    choice === 'reschedule'
      ? ['There is no safe free day left this week, so this workout is skipped.']
      : ['Workout skipped. That is okay — rest is part of training.'];
  summary.push('We did not add extra sets to make up for it.');

  let sessions = plan.sessions.map((s) => (s.id === sessionId ? { ...s, status: 'skipped' as const } : s));
  const changeLog = [...plan.changeLog, { at, description: `Skipped "${missed.title}" (${WEEKDAY_LABELS[missed.day]}).` }];

  if (uncovered.length > 0) {
    // Fold in at most ONE short exercise for muscles that would otherwise go
    // untrained this week, at reduced sets, into the next planned session.
    const next = plan.sessions
      .filter((s) => s.status === 'planned' && s.id !== sessionId && s.day >= today)
      .sort((a, b) => a.day - b.day)[0];
    const candidate = pickMostUncovered(missed.exercises, uncovered, next);
    if (next && candidate) {
      const added: PlannedExercise = {
        ...candidate,
        sets: Math.min(2, candidate.sets),
        note: 'Added from your missed workout (short version).',
      };
      sessions = sessions.map((s) => (s.id === next.id ? { ...s, exercises: [...s.exercises, added] } : s));
      const name = requireExercise(candidate.exerciseId).name;
      summary.push(`We added 2 sets of ${name} to ${WEEKDAY_LABELS[next.day]} so ${listMuscles(uncovered)} still get some work.`);
      changeLog.push({ at, description: `Added a short ${name} to "${next.title}".` });
    } else {
      summary.push(`${capitalise(listMuscles(uncovered))} will not be trained this week. Next week's plan covers them.`);
    }
  } else {
    summary.push('Your other workouts this week already train these muscles.');
  }

  return { plan: { ...plan, sessions, changeLog }, summary };
}

function pickMostUncovered(
  exercises: PlannedExercise[],
  uncovered: Muscle[],
  target: Session | undefined,
): PlannedExercise | undefined {
  let best: PlannedExercise | undefined;
  let bestCount = 0;
  for (const p of exercises) {
    if (target?.exercises.some((t) => t.exerciseId === p.exerciseId)) continue;
    const count = requireExercise(p.exerciseId).primary.filter((m) => uncovered.includes(m)).length;
    if (count > bestCount) {
      best = p;
      bestCount = count;
    }
  }
  return best;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
