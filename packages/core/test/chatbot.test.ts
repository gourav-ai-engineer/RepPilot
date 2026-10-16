import { describe, expect, it } from 'vitest';
import { findMentionedExercises, generateWeeklyPlan, reply } from '../src';
import { WEEK, gymProfile } from './fixtures';

const ctx = { profile: gymProfile, plan: generateWeeklyPlan(gymProfile, { weekStart: WEEK }), today: 0 as const };

describe('chatbot', () => {
  it('puts emergency safety first', () => {
    expect(reply('I have chest pain during bench press', ctx).kind).toBe('safety');
    expect(reply('feeling dizzy after squats', ctx).kind).toBe('safety');
  });

  it('refers pain, medical and extreme diet questions', () => {
    expect(reply('my knee hurts when I squat', ctx).kind).toBe('referral');
    expect(reply('what steroid dose should I take', ctx).kind).toBe('referral');
    expect(reply('can I eat 500 calories a day to lose fat', ctx).kind).toBe('referral');
    expect(reply('how to lose 10 kg in a week', ctx).kind).toBe('referral');
  });

  it('answers exercise how-to from the library', () => {
    const r = reply('how do I do a goblet squat?', ctx);
    expect(r.kind).toBe('answer');
    expect(r.exerciseIds?.[0]).toBe('goblet_squat');
    expect(r.text).toMatch(/Hold one dumbbell/);
  });

  it('suggests substitutes from the library', () => {
    const r = reply('the bench press is busy, what can I do instead?', ctx);
    expect(r.kind).toBe('answer');
    expect(r.exerciseIds?.length).toBeGreaterThan(0);
    expect(r.exerciseIds).not.toContain('barbell_bench_press');
  });

  it("answers today's plan", () => {
    expect(reply("what's my workout today", ctx).text).toMatch(/Full body A/);
    expect(reply('what should I do today', { ...ctx, today: 1 }).text).toMatch(/rest day/);
  });

  it('explains terms and handles unknown questions', () => {
    expect(reply('what does progressive overload mean', ctx).text).toMatch(/harder over time/);
    expect(reply('who won the cricket match', ctx).kind).toBe('fallback');
  });

  it('matches longer exercise names before short aliases', () => {
    expect(findMentionedExercises('dumbbell bench press').map((e) => e.id)).toEqual(['db_bench_press']);
  });
});
