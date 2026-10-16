import { describe, expect, it } from 'vitest';
import { generateWeeklyPlan, proposeMissedSession, safeDaysFor, sessionPrimaryMuscles, type WeeklyPlan } from '../src';
import { WEEK, gymProfile } from './fixtures';

const totalSets = (p: WeeklyPlan) =>
  p.sessions.filter((s) => s.status !== 'skipped').reduce((t, s) => t + s.exercises.reduce((u, e) => u + e.sets, 0), 0);

describe('proposeMissedSession', () => {
  const plan = generateWeeklyPlan(gymProfile, { weekStart: WEEK }); // Mon, Wed, Fri full body

  it('moves a missed Monday session to a safe day without stacking', () => {
    const res = proposeMissedSession(plan, plan.sessions[0]!.id, 1, 'reschedule', WEEK);
    expect(res.movedTo).toBeDefined();
    const days = res.plan.sessions.map((s) => s.day);
    expect(new Set(days).size).toBe(days.length);
    // Full-body sessions must not sit next to each other.
    const sorted = [...res.plan.sessions].sort((a, b) => a.day - b.day);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.day - sorted[i - 1]!.day).toBeGreaterThan(1);
    expect(totalSets(res.plan)).toBe(totalSets(plan));
    expect(res.summary.length).toBeGreaterThan(0);
  });

  it('can use Sunday when it keeps rest between similar sessions', () => {
    expect(proposeMissedSession(plan, plan.sessions[1]!.id, 6, 'reschedule', WEEK).movedTo).toBe(6);
  });

  it('uses the day the user picked only if it is safe', () => {
    const safe = safeDaysFor(plan, plan.sessions[0]!, 1);
    const last = safe.at(-1)!;
    expect(proposeMissedSession(plan, plan.sessions[0]!.id, 1, 'reschedule', WEEK, last).movedTo).toBe(last);
    // Thursday sits next to Wednesday and Friday full-body sessions.
    expect(proposeMissedSession(plan, plan.sessions[0]!.id, 1, 'reschedule', WEEK, 3).movedTo).toBe(safe[0]);
  });

  it('only proposes days from today onwards', () => {
    for (const d of safeDaysFor(plan, plan.sessions[0]!, 3)) expect(d).toBeGreaterThanOrEqual(3);
  });

  it('skips without doubling volume', () => {
    const res = proposeMissedSession(plan, plan.sessions[0]!.id, 1, 'skip', WEEK);
    expect(res.plan.sessions[0]!.status).toBe('skipped');
    expect(totalSets(res.plan)).toBeLessThan(totalSets(plan));
    expect(res.plan.sessions.every((s) => s.exercises.length <= plan.sessions.find((o) => o.id === s.id)!.exercises.length + 1)).toBe(true);
  });

  it('falls back to skipping when no safe day remains', () => {
    // Six-day plan (Mon–Sat): moving Monday to Sunday would make 6 days in a row.
    const sixDay = generateWeeklyPlan({ ...gymProfile, trainingDays: [0, 1, 2, 3, 4, 5] }, { weekStart: WEEK });
    const res = proposeMissedSession(sixDay, sixDay.sessions[0]!.id, 6, 'reschedule', WEEK);
    expect(res.movedTo).toBeUndefined();
    expect(res.plan.sessions[0]!.status).toBe('skipped');
    expect(res.summary[0]).toMatch(/no safe free day/i);
  });

  it('adds at most one short exercise for muscles that would go untrained', () => {
    const upperLower = generateWeeklyPlan({ ...gymProfile, trainingDays: [0, 1, 3, 4] }, { weekStart: WEEK });
    const lowerB = upperLower.sessions[3]!; // Friday lower body
    const res = proposeMissedSession(upperLower, lowerB.id, 4, 'skip', WEEK);
    // Nothing planned after Friday, so nothing can be folded in.
    expect(res.plan.sessions.reduce((t, s) => t + s.exercises.length, 0)).toBe(
      upperLower.sessions.reduce((t, s) => t + s.exercises.length, 0),
    );
    const lowerA = upperLower.sessions[1]!;
    const res2 = proposeMissedSession(upperLower, lowerA.id, 1, 'skip', WEEK);
    const added = res2.plan.sessions.flatMap((s) => s.exercises.filter((e) => e.note?.startsWith('Added from')));
    expect(added.length).toBeLessThanOrEqual(1);
    for (const a of added) expect(a.sets).toBeLessThanOrEqual(2);
    expect(sessionPrimaryMuscles(lowerA).size).toBeGreaterThan(0);
  });
});
