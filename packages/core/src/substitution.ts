import { EXERCISES, requireExercise } from './exercises';
import { EQUIPMENT_LABELS, PATTERN_LABELS, listMuscles } from './labels';
import { type EligibilityContext, ineligibilityReason } from './planner';
import type { Equipment, Exercise, Muscle } from './types';

export interface SubstituteOptions extends EligibilityContext {
  /** Equipment that is busy or missing right now, on top of what the profile lacks. */
  unavailable?: Equipment[];
  /** Exercise ids to leave out, e.g. ones already in today's session. */
  exclude?: string[];
  limit?: number;
}

export interface Substitute {
  exercise: Exercise;
  score: number;
  /** Plain-language reasons this alternative was chosen. */
  reasons: string[];
  /** Honest notes on how it differs from the original. */
  differences: string[];
}

function overlap(a: Muscle[], b: Muscle[]): Muscle[] {
  return a.filter((m) => b.includes(m));
}

/**
 * Ranks alternatives for an exercise using muscles, movement pattern,
 * equipment, difficulty and the user's limitations. Deterministic.
 */
export function findSubstitutes(exerciseId: string, opts: SubstituteOptions): Substitute[] {
  const original = requireExercise(exerciseId);
  const unavailable = new Set(opts.unavailable ?? []);
  const available = opts.equipment.filter((e) => !unavailable.has(e));
  const ctx: EligibilityContext = { ...opts, equipment: available };
  const exclude = new Set([exerciseId, ...(opts.exclude ?? [])]);

  const results: Substitute[] = [];
  for (const ex of EXERCISES) {
    if (exclude.has(ex.id)) continue;
    if (ineligibilityReason(ex, ctx)) continue;
    if (ex.equipment.some((e) => unavailable.has(e))) continue;

    const primaryShared = overlap(original.primary, ex.primary);
    // Must train at least one of the same main muscles to be a substitute.
    if (primaryShared.length === 0) continue;

    const samePattern = ex.pattern === original.pattern;
    const primaryCoverage = primaryShared.length / original.primary.length;
    const extraPrimary = ex.primary.filter((m) => !original.primary.includes(m));
    const secondaryShared = overlap(original.secondary, [...ex.primary, ...ex.secondary]);
    const secondaryCoverage = original.secondary.length ? secondaryShared.length / original.secondary.length : 1;

    let score = 0;
    score += samePattern ? 40 : 0;
    score += primaryCoverage * 40;
    score += secondaryCoverage * 10;
    score -= extraPrimary.length * 5;
    score -= Math.abs(ex.difficulty - original.difficulty) * 4;
    score += ex.compound === original.compound ? 5 : 0;

    const reasons: string[] = [];
    if (samePattern) reasons.push(`Same type of movement (${PATTERN_LABELS[ex.pattern]}).`);
    reasons.push(`Works the same main muscles: ${listMuscles(primaryShared)}.`);
    const gear = ex.equipment.filter((e) => e !== 'bodyweight');
    reasons.push(
      gear.length
        ? `Uses equipment you have: ${gear.map((e) => EQUIPMENT_LABELS[e].toLowerCase()).join(', ')}.`
        : 'Needs no equipment.',
    );

    const differences: string[] = [];
    const missed = original.primary.filter((m) => !ex.primary.includes(m));
    if (missed.length) differences.push(`Less focus on ${listMuscles(missed)}.`);
    if (extraPrimary.length) differences.push(`Also works ${listMuscles(extraPrimary)} hard.`);
    if (!samePattern) differences.push('Different movement, so the feel and the weight you use will change.');
    if (ex.difficulty < original.difficulty) differences.push('Easier to learn; you may need more reps to feel the same effort.');
    if (ex.difficulty > original.difficulty) differences.push('Harder to learn; start light.');
    if (differences.length === 0) differences.push('Close match, but not identical. Start a little lighter the first time.');

    results.push({ exercise: ex, score: Math.round(score), reasons, differences });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 5);
}
