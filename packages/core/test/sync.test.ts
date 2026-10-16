import { describe, expect, it } from 'vitest';
import { generateWeeklyPlan, mergeSyncData, type SyncData } from '../src';
import { WEEK, gymProfile } from './fixtures';

const base = (over: Partial<SyncData>): SyncData => ({
  updatedAt: '2026-10-12T10:00:00Z', pastPlans: [], logs: [], meals: [], water: [], waterGoalMl: 2500, ...over,
});

describe('mergeSyncData', () => {
  it('keeps workouts, meals and water from both devices', () => {
    const phone = base({
      updatedAt: '2026-10-12T12:00:00Z',
      logs: [{ id: 'a', date: '2026-10-12', entries: [] }],
      meals: [{ id: 'm1', date: '2026-10-12', foodId: 'egg', servings: 2 }],
      water: [{ id: 'w1', date: '2026-10-12', ml: 250 }],
    });
    const web = base({
      logs: [{ id: 'b', date: '2026-10-11', entries: [] }],
      meals: [{ id: 'm2', date: '2026-10-12', foodId: 'dal', servings: 1 }],
      water: [{ id: 'w2', date: '2026-10-12', ml: 250 }],
      waterGoalMl: 3000,
    });
    const m = mergeSyncData(web, phone);
    expect(m.logs.map((l) => l.id)).toEqual(['b', 'a']);
    expect(m.meals).toHaveLength(2);
    expect(m.water).toHaveLength(2);
    expect(m.waterGoalMl).toBe(2500); // settings from the newer copy
    expect(mergeSyncData(phone, web)).toEqual(m); // order does not matter
  });

  it('does not lose a completed session from the older copy', () => {
    const plan = generateWeeklyPlan(gymProfile, { weekStart: WEEK });
    const done = { ...plan, sessions: plan.sessions.map((s, i) => (i === 0 ? { ...s, status: 'completed' as const } : s)) };
    const m = mergeSyncData(base({ updatedAt: '2026-10-13T00:00:00Z', plan }), base({ plan: done }));
    expect(m.plan!.sessions[0]!.status).toBe('completed');
  });

  it('takes the newer week plan', () => {
    const oldPlan = generateWeeklyPlan(gymProfile, { weekStart: '2026-10-05' });
    const newPlan = generateWeeklyPlan(gymProfile, { weekStart: WEEK });
    expect(mergeSyncData(base({ plan: newPlan }), base({ updatedAt: '2026-10-20T00:00:00Z', plan: oldPlan })).plan!.weekStart).toBe(WEEK);
  });
});
