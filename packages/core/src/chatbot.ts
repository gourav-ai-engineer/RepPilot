import { EXERCISES, getExercise } from './exercises';
import { WEEKDAY_LABELS, listMuscles } from './labels';
import { proteinRangeG, proteinSuggestions } from './nutrition';
import { eligibilityFromProfile } from './planner';
import { findSubstitutes } from './substitution';
import type { Exercise, Profile, Weekday, WeeklyPlan } from './types';

/**
 * A constrained, rule-based fitness assistant. It only answers from the
 * curated library, the user's own plan and fixed guidance text, and it checks
 * for safety topics before anything else. An LLM can later be added behind
 * the same interface, grounded on the same content.
 */

export type ReplyKind = 'safety' | 'referral' | 'answer' | 'fallback';

export interface ChatReply {
  kind: ReplyKind;
  text: string;
  /** Exercises referenced in the answer, so the UI can link to them. */
  exerciseIds?: string[];
}

export interface ChatContext {
  profile?: Profile;
  plan?: WeeklyPlan;
  today: Weekday;
}

const EMERGENCY =
  /\b(chest pain|chest (is )?tight|can'?t breathe|cannot breathe|short(ness)? of breath|faint(ed|ing)?|pass(ed)? out|black(ed)? out|numb(ness)?|tingling|heart (is )?(racing|pounding)|palpitation)/;
const DIZZY = /\b(dizzy|dizziness|light ?headed|nause(a|ous)|vomit)/;
const PAIN = /\b(pain|painful|hurts?|hurting|injur(y|ed|ies)|sprain(ed)?|strain(ed)?|swollen|swelling|pop(ped)?|tear|torn|click(ing)? (in|on) my)\b/;
const SORE = /\b(sore|soreness|doms|stiff)\b/;
const MEDICAL =
  /\b(steroids?|sarms?|testosterone|trt|peptides?|insulin|dosage|dose|medicine|medication|tablets?|diabet\w*|blood pressure|bp|thyroid|pregnan\w*|asthma|heart (condition|disease)|kidney|liver|deficien\w*|diagnos\w*|supplement dose|fat burner)\b/;
const EXTREME_DIET =
  /\b(starv\w*|crash diet|water fast\w*|dry fast\w*|stop eating|not eat(ing)?|skip all meals|laxatives?|diuretics?|purge|lose \d+ ?kg in (a|one|1|\d+) (week|days?)|\b[1-7]\d{2} ?(k?cal|calories))\b/;
const UNSAFE_LIFT = /\b(without (a )?spotter|no spotter|ego lift|max out alone|1 ?rm alone)\b/;

const GLOSSARY: Record<string, string> = {
  rep: 'A rep (repetition) is doing the movement once. 10 reps = doing it 10 times.',
  set: 'A set is a group of reps done without stopping. "3 sets of 10" means 10 reps, rest, repeat 3 times.',
  rest: 'Rest time is the break between sets. Longer rests for heavy work, shorter for light work.',
  'progressive overload':
    'Progressive overload means slowly making training a little harder over time — a bit more weight, reps or sets — so your body keeps adapting.',
  compound: 'A compound exercise uses several joints and muscles together, like squats, rows or push-ups.',
  isolation: 'An isolation exercise focuses on one main muscle, like a biceps curl.',
  rpe: 'RPE (rate of perceived exertion) is how hard a set feels from 1 to 10. RPE 8 means you could do about 2 more reps.',
  superset: 'A superset is doing two exercises back to back with no rest in between.',
  deload: 'A deload is an easier week with less weight or fewer sets to help your body recover.',
  'warm up': 'A warm-up is 5–10 minutes of light movement before training to get your body ready.',
  failure: 'Training to failure means doing reps until you cannot do another with good form. Beginners do not need to do this.',
  tempo: 'Tempo is how fast you move. For example, lowering for 3 seconds and lifting for 1 second.',
};

const EXERCISE_ALIASES: [string, string][] = [
  ['bench press', 'barbell_bench_press'],
  ['bench', 'barbell_bench_press'],
  ['back squat', 'barbell_back_squat'],
  ['squats?', 'bodyweight_squat'],
  ['deadlifts?', 'barbell_deadlift'],
  ['rdl', 'db_romanian_deadlift'],
  ['romanian deadlift', 'db_romanian_deadlift'],
  ['pull ?ups?', 'pull_up'],
  ['chin ?ups?', 'pull_up'],
  ['push ?ups?', 'push_up'],
  ['press ?ups?', 'push_up'],
  ['ohp', 'barbell_overhead_press'],
  ['overhead press', 'barbell_overhead_press'],
  ['shoulder press', 'db_shoulder_press'],
  ['lat pull ?downs?', 'lat_pulldown'],
  ['pull ?downs?', 'lat_pulldown'],
  ['rows?', 'db_row'],
  ['curls?', 'db_curl'],
  ['bicep curls?', 'db_curl'],
  ['lunges?', 'reverse_lunge'],
  ['hip thrusts?', 'hip_thrust'],
  ['leg press', 'leg_press'],
  ['planks?', 'plank'],
  ['calf raises?', 'calf_raise'],
  ['dips?', 'bench_dip'],
  ['lateral raises?', 'db_lateral_raise'],
  ['side raises?', 'db_lateral_raise'],
  ['face pulls?', 'face_pull'],
  ['swings?', 'kettlebell_swing'],
];

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Finds exercises mentioned in the text, longest names first. */
export function findMentionedExercises(text: string): Exercise[] {
  const t = ` ${normalise(text)} `;
  const found: Exercise[] = [];
  const add = (id: string) => {
    const ex = getExercise(id);
    if (ex && !found.includes(ex)) found.push(ex);
  };
  const byName = [...EXERCISES].sort((a, b) => b.name.length - a.name.length);
  let rest = t;
  for (const ex of byName) {
    const name = normalise(ex.name);
    if (rest.includes(` ${name} `)) {
      add(ex.id);
      rest = rest.replace(` ${name} `, ' ');
    }
  }
  for (const [alias, id] of EXERCISE_ALIASES) {
    const re = new RegExp(` ${alias} `);
    if (re.test(rest)) {
      add(id);
      rest = rest.replace(re, ' ');
    }
  }
  return found;
}

function describeExercise(ex: Exercise): string {
  const steps = ex.instructions.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return [
    `${ex.name} — works ${listMuscles(ex.primary)}${ex.secondary.length ? ` (also ${listMuscles(ex.secondary)})` : ''}.`,
    steps,
    `Tips: ${ex.cues.join(' ')}`,
    'Stop if you feel sharp pain.',
  ].join('\n');
}

function sessionToText(ctx: ChatContext, day: Weekday): string | null {
  const s = ctx.plan?.sessions.find((x) => x.day === day && x.status !== 'skipped');
  if (!s) return null;
  const lines = s.exercises.map((p) => {
    const ex = getExercise(p.exerciseId);
    return `• ${ex?.name ?? p.exerciseId}: ${p.sets} × ${p.repsMin}–${p.repsMax}`;
  });
  return `${WEEKDAY_LABELS[day]}: ${s.title}${s.status === 'completed' ? ' (done ✓)' : ''}\n${lines.join('\n')}`;
}

export const OUT_OF_SCOPE =
  'I can help with exercise instructions, your workout plan, swapping exercises, general food and water tips, training words, and using the app.';

export function reply(message: string, ctx: ChatContext): ChatReply {
  const t = normalise(message);
  if (!t) return { kind: 'fallback', text: OUT_OF_SCOPE };

  // 1. Safety first.
  if (EMERGENCY.test(t)) {
    return {
      kind: 'safety',
      text:
        'Please stop exercising now and sit or lie down. Chest pain, trouble breathing, fainting, numbness or a racing heart can be serious. ' +
        'If it does not settle quickly or feels severe, call emergency services (112 in India) or get medical help right away.',
    };
  }
  if (DIZZY.test(t)) {
    return {
      kind: 'safety',
      text:
        'Stop the workout, sit down, sip some water and rest. Do not continue training today. ' +
        'If dizziness keeps happening or comes with chest pain or fainting, see a doctor.',
    };
  }
  if (PAIN.test(t)) {
    return {
      kind: 'referral',
      text:
        'Stop any exercise that causes pain. I cannot diagnose injuries. ' +
        'For pain that is sharp, gets worse, causes swelling, or lasts more than a few days, please see a doctor or physiotherapist. ' +
        'You can mark the problem area in Profile → Limitations so your plan avoids exercises that may aggravate it.',
    };
  }
  if (MEDICAL.test(t)) {
    return {
      kind: 'referral',
      text:
        'That is a medical question, so I cannot advise on it. Please ask a doctor, pharmacist or registered dietitian. ' +
        'I can still help with general training, food and water habits.',
    };
  }
  if (EXTREME_DIET.test(t)) {
    return {
      kind: 'referral',
      text:
        'I cannot help with extreme dieting — it can harm your health and your training. ' +
        'A safer pace for most adults is about 0.25–1 kg per week: eat regular meals with enough protein, vegetables and water, and keep training. ' +
        'A registered dietitian can help you plan this properly.',
    };
  }
  if (UNSAFE_LIFT.test(t)) {
    return {
      kind: 'safety',
      text:
        'Please do not attempt very heavy lifts alone. Use a spotter or safety bars, choose a weight you can lift with good form, and leave 1–2 reps in reserve.',
    };
  }

  // 2. Soreness (normal) vs. pain (handled above).
  if (SORE.test(t)) {
    return {
      kind: 'answer',
      text:
        'Feeling sore 1–2 days after training is common, especially with new exercises. Gentle movement, sleep, food and water help. ' +
        'Train other muscles or go lighter until it eases. If it is sharp pain rather than soreness, stop and see a professional.',
    };
  }

  const mentioned = findMentionedExercises(message);

  // 3. Substitutions.
  if (/\b(instead|replace|alternative|substitut\w*|swap|not available|unavailable|busy|occupied|taken|don't have|do not have|no machine|broken)\b/.test(t)) {
    const target = mentioned[0];
    if (!target) {
      return {
        kind: 'answer',
        text: 'Tell me which exercise you want to replace, for example "replace bench press". You can also tap "Swap" on any exercise in your plan.',
      };
    }
    if (!ctx.profile) return { kind: 'answer', text: 'Finish setting up your profile first so I know what equipment you have.' };
    const subs = findSubstitutes(target.id, { ...eligibilityFromProfile(ctx.profile), unavailable: target.equipment.filter((e) => e !== 'bodyweight'), limit: 3 });
    if (subs.length === 0) {
      return { kind: 'answer', text: `I could not find a good match for ${target.name} with your equipment. Try adding more equipment in your profile.` };
    }
    return {
      kind: 'answer',
      exerciseIds: subs.map((s) => s.exercise.id),
      text:
        `Instead of ${target.name}, you could try:\n` +
        subs.map((s, i) => `${i + 1}. ${s.exercise.name} — ${s.reasons[1] ?? s.reasons[0]} ${s.differences[0]}`).join('\n'),
    };
  }

  // 4. Plan questions.
  if (/\b(today|todays|tonight|next workout|what (should|do) i (do|train))\b/.test(t)) {
    if (!ctx.plan) return { kind: 'answer', text: 'You do not have a plan yet. Finish onboarding to create one.' };
    const today = sessionToText(ctx, ctx.today);
    if (today) return { kind: 'answer', text: `Today's workout:\n${today}` };
    const next = ctx.plan.sessions.find((s) => s.day > ctx.today && s.status === 'planned');
    return {
      kind: 'answer',
      text: next
        ? `Today is a rest day. Your next workout is on ${WEEKDAY_LABELS[next.day]}: ${next.title}.`
        : 'Today is a rest day, and there are no more workouts planned this week. Enjoy the recovery!',
    };
  }
  if (/\b(my plan|this week|week plan|schedule|routine)\b/.test(t)) {
    if (!ctx.plan) return { kind: 'answer', text: 'You do not have a plan yet. Finish onboarding to create one.' };
    const days = ctx.plan.sessions.map((s) => sessionToText(ctx, s.day)).filter(Boolean);
    return { kind: 'answer', text: `This week:\n\n${days.join('\n\n')}` };
  }
  if (/\b(missed|skipped|skip)\b/.test(t)) {
    return {
      kind: 'answer',
      text:
        'No problem. Open the workout in the Plan tab and tap "I missed this". You can move it to a safe day or skip it. ' +
        'We never double up your workload, and you approve the new plan before it is saved.',
    };
  }

  // 5. Exercise how-to.
  if (mentioned.length > 0) {
    return { kind: 'answer', exerciseIds: mentioned.map((e) => e.id), text: describeExercise(mentioned[0]!) };
  }

  // 6. Terminology.
  for (const [term, def] of Object.entries(GLOSSARY)) {
    const re = new RegExp(`\\b${term}s?\\b`);
    if (re.test(t) && /\b(what|mean|meaning|define|explain)\b/.test(t)) return { kind: 'answer', text: def };
  }

  // 7. Nutrition and hydration.
  if (/\b(water|hydrat\w*|drink)\b/.test(t)) {
    return {
      kind: 'answer',
      text:
        'Sip water through the day and a little more around workouts or in hot weather. Pale yellow urine is a simple sign you are drinking enough. ' +
        'You can track glasses in the Food tab. Drinking very large amounts quickly is not helpful.',
    };
  }
  if (/\b(protein|eat|food|diet|meal|calorie|calories|nutrition|breakfast|lunch|dinner|snack)\b/.test(t)) {
    const p = ctx.profile;
    const range = p ? proteinRangeG(p.bodyWeightKg, p.goal) : null;
    const ideas = p ? proteinSuggestions(p.diet, 5).map((f) => f.name).join(', ') : 'dal, curd, paneer, eggs, chana';
    return {
      kind: 'answer',
      text:
        (range
          ? `A general protein range for your goal is about ${range.min}–${range.max} g a day, spread over your meals. `
          : 'Try to include a protein food in every meal. Add your body weight in Profile for a personal range. ') +
        `Budget-friendly options for you: ${ideas}. Fill the rest of your plate with vegetables and whole grains.`,
    };
  }
  if (/\b(sleep|recover\w*|rest day)\b/.test(t)) {
    return {
      kind: 'answer',
      text: 'Most adults do best with 7–9 hours of sleep. Rest days are when your muscles recover and get stronger — they never hurt your streak in RepPilot.',
    };
  }

  // 8. App help.
  if (/\b(how (do|can) i|where|log|record|change|edit|delete|use the app)\b/.test(t)) {
    return {
      kind: 'answer',
      text:
        'Plan tab: see your week, start a workout, log sets, swap or skip exercises.\n' +
        'Exercises tab: search exercises, see how to do them and find alternatives.\n' +
        'Progress tab: your history, muscle coverage, rank and badges.\n' +
        'Food tab: log meals and water.\n' +
        'Profile (top right of Progress): edit your details or delete your data.',
    };
  }
  if (/^(hi|hello|hey|namaste|hii+)\b/.test(t)) {
    return { kind: 'answer', text: `Hi${ctx.profile?.name ? ` ${ctx.profile.name}` : ''}! ${OUT_OF_SCOPE}` };
  }

  return { kind: 'fallback', text: `I am not sure about that. ${OUT_OF_SCOPE}` };
}
