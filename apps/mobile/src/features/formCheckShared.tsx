import { CAMERA_SETUP_TIPS, type FormCheckExercise, type FormResult } from '@reppilot/core';
import { useState } from 'react';
import { S } from '../i18n';
import { Body, Card, Chip, ChipRow, H3, Muted, SafetyNote } from '../ui/kit';

export const EXERCISE_NAMES: Record<FormCheckExercise, string> = { squat: 'Squat', pushup: 'Push-up' };

export const WHAT_WE_CHECK: Record<FormCheckExercise, string[]> = {
  squat: ['How deep you squat (knee bend).', 'How far your chest leans forward.', 'How fast you lower.'],
  pushup: ['How low your chest goes (elbow bend).', 'Whether your hips sag out of line.', 'How fast you lower.'],
};

const SELF_CHECK: Record<FormCheckExercise, string[]> = {
  squat: [
    'Feet about shoulder-width apart, toes slightly out.',
    'Heels stay on the floor the whole time.',
    'Knees move in the same direction as your toes.',
    'Chest stays up; back does not round.',
    'You go as low as is comfortable and controlled.',
    'You take about 2 seconds to lower.',
  ],
  pushup: [
    'Hands a little wider than your shoulders.',
    'Body makes one straight line from head to heels.',
    'Chest comes close to the floor.',
    'Elbows point back at an angle, not straight out.',
    'Hips do not sag or pike up.',
    'You take about 2 seconds to lower.',
  ],
};

export function isFormExercise(v: unknown): v is FormCheckExercise {
  return v === 'squat' || v === 'pushup';
}

export function SetupTips({ exercise }: { exercise: FormCheckExercise }) {
  return (
    <Card>
      <H3>🎥 {S.formCheck.setup}</H3>
      {CAMERA_SETUP_TIPS.map((t) => <Body key={t}>• {t}</Body>)}
      <Muted>{S.formCheck.whatWeCheck}: {WHAT_WE_CHECK[exercise].join(' ')}</Muted>
    </Card>
  );
}

/** Manual fallback when camera analysis is unavailable or fails. */
export function SelfCheck({ exercise }: { exercise: FormCheckExercise }) {
  const [ticked, setTicked] = useState<number[]>([]);
  return (
    <Card>
      <H3>📝 {S.formCheck.selfCheck}</H3>
      <Muted>Do a few slow reps in front of a mirror, or ask a friend to watch, and tick what you see.</Muted>
      <ChipRow>
        {SELF_CHECK[exercise].map((item, i) => (
          <Chip
            key={item}
            label={item}
            selected={ticked.includes(i)}
            onPress={() => setTicked((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i]))}
          />
        ))}
      </ChipRow>
      {ticked.length === SELF_CHECK[exercise].length ? <Body>👍 Nice — keep moving with control.</Body> : null}
    </Card>
  );
}

export function ResultCard({ result }: { result: FormResult }) {
  return (
    <>
      <Card tone={result.assessable ? 'primary' : 'warn'}>
        <H3>{result.assessable ? '✅' : '⚠️'} {result.summary}</H3>
        {result.assessable ? (
          <Muted>
            {S.formCheck.confidence[result.confidence]} · {S.formCheck.reps(result.reps)}
          </Muted>
        ) : null}
        {result.cues.map((c) => (
          <Card key={c.id} tone={c.severity === 'fix' ? 'warn' : undefined}>
            <Body>{c.severity === 'fix' ? '🔧' : '💡'} {c.message}</Body>
            <Muted>{S.formCheck.onReps(c.reps)}</Muted>
          </Card>
        ))}
        {result.setupIssues.map((s) => <Body key={s}>• {s}</Body>)}
      </Card>
      <SafetyNote text={result.disclaimer} />
    </>
  );
}
