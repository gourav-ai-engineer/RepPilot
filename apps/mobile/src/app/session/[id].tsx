import {
  eligibilityFromProfile,
  estimateSessionMinutes,
  findSubstitutes,
  progressionTip,
  proposeMissedSession,
  requireExercise,
  safeDaysFor,
  swapExerciseInPlan,
  weekdayOf,
  type LoggedExercise,
  type ScheduleProposal,
  type Weekday,
} from '@reppilot/core';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { S } from '../../i18n';
import { newId, useStore } from '../../state/store';
import { colors, font, radius, space, TOUCH } from '../../theme';
import { Body, Button, Card, Chip, ChipRow, Divider, H2, H3, Muted, Row, SafetyNote, Screen } from '../../ui/kit';

type SetInput = { reps: string; kg: string };

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch, today } = useStore();
  const { plan, profile } = state;
  const session = plan?.sessions.find((s) => s.id === id);
  const todayDay = weekdayOf(today);

  const existing = state.logs.find((l) => l.sessionId === id);
  const [inputs, setInputs] = useState<Record<string, SetInput[]>>(() => {
    const init: Record<string, SetInput[]> = {};
    for (const p of session?.exercises ?? []) {
      const prev = existing?.entries.find((e) => e.exerciseId === p.exerciseId);
      init[p.exerciseId] = Array.from({ length: p.sets }, (_, i) => ({
        reps: prev?.sets[i] ? String(prev.sets[i]!.reps) : '',
        kg: prev?.sets[i]?.weightKg ? String(prev.sets[i]!.weightKg) : '',
      }));
    }
    return init;
  });
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [missed, setMissed] = useState<'ask' | 'pickDay' | null>(null);
  const [proposal, setProposal] = useState<ScheduleProposal | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const safeDays = useMemo(
    () => (plan && session ? safeDaysFor(plan, session, todayDay) : []),
    [plan, session, todayDay],
  );

  if (!plan || !profile || !session) {
    return (
      <Screen>
        <Body>This workout is not in your current plan.</Body>
        <Button label={S.common.back} onPress={() => router.back()} />
      </Screen>
    );
  }

  const updateSet = (exId: string, i: number, field: keyof SetInput, value: string) =>
    setInputs((prev) => {
      const rows = [...(prev[exId] ?? [])];
      rows[i] = { ...(rows[i] ?? { reps: '', kg: '' }), [field]: value.replace(/[^0-9.,]/g, '').replace(',', '.') };
      return { ...prev, [exId]: rows };
    });

  const finish = () => {
    const entries: LoggedExercise[] = session.exercises
      .map((p) => ({
        exerciseId: p.exerciseId,
        sets: (inputs[p.exerciseId] ?? [])
          .slice(0, p.sets)
          .map((r) => ({ reps: Math.round(Number(r.reps)), weightKg: r.kg ? Number(r.kg) : undefined }))
          .filter((s) => Number.isFinite(s.reps) && s.reps > 0 && s.reps < 1000 && (s.weightKg === undefined || (s.weightKg >= 0 && s.weightKg < 1000))),
      }))
      .filter((e) => e.sets.length > 0);
    if (entries.length === 0) {
      setMessage(S.session.nothingLogged);
      return;
    }
    dispatch({ type: 'saveWorkout', log: { id: existing?.id ?? newId(), date: existing?.date ?? today, sessionId: session.id, entries } });
    setMessage(S.session.saved);
  };

  const propose = (choice: 'reschedule' | 'skip', day?: Weekday) => {
    setProposal(proposeMissedSession(plan, session.id, todayDay, choice, today, day));
    setMissed(null);
  };

  const subs =
    swapFor !== null
      ? findSubstitutes(swapFor, {
          ...eligibilityFromProfile(profile),
          unavailable: busy ? requireExercise(swapFor).equipment.filter((e) => e !== 'bodyweight') : [],
          exclude: session.exercises.map((e) => e.exerciseId),
          limit: 4,
        })
      : [];

  return (
    <Screen>
      <Stack.Screen options={{ title: `${S.days[session.day]} · ${S.community.kinds.workout}` }} />
      <H2>{session.title}</H2>
      <Muted>
        {S.session.estimated(estimateSessionMinutes(session))}
        {session.status !== 'planned' ? ` · ${session.status === 'completed' ? S.plan.completed : S.plan.skipped}` : ''}
      </Muted>
      <SafetyNote text={S.safety.stopBanner} />

      <Card>
        <H3>🔥 {S.session.warmup}</H3>
        {session.warmup.map((w, i) => <Body key={i}>• {w}</Body>)}
      </Card>

      {session.exercises.map((p) => {
        const ex = requireExercise(p.exerciseId);
        const weighted = ex.equipment.some((e) => e !== 'bodyweight');
        return (
          <Card key={p.exerciseId}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, minWidth: 180 }}>
                <H3>{ex.name}</H3>
                <Muted>{S.session.target(p.sets, p.repsMin, p.repsMax, p.restSec)}</Muted>
              </View>
              <Row>
                <Button compact kind="ghost" label={S.session.howTo} onPress={() => router.push(`/exercise/${ex.id}`)} />
                <Button compact kind="secondary" label={`⇄ ${S.session.swap}`} onPress={() => setSwapFor(swapFor === ex.id ? null : ex.id)} />
              </Row>
            </Row>
            {p.note ? <Muted>ℹ️ {p.note}</Muted> : null}

            {swapFor === ex.id ? (
              <Card tone="primary">
                <H3>{S.session.swapTitle(ex.name)}</H3>
                <ChipRow>
                  <Chip label={S.session.swapBusy} selected={busy} onPress={() => setBusy((b) => !b)} />
                </ChipRow>
                {subs.length === 0 ? <Body>{S.session.noSubs}</Body> : null}
                {subs.map((s) => (
                  <Card key={s.exercise.id}>
                    <H3>{s.exercise.name}</H3>
                    <Muted>{S.session.whyChosen}:</Muted>
                    {s.reasons.map((r, i) => <Body key={i}>✓ {r}</Body>)}
                    <Muted>{S.session.differs}:</Muted>
                    {s.differences.map((d, i) => <Body key={i}>• {d}</Body>)}
                    <Button
                      compact
                      label={S.session.choose}
                      onPress={() => {
                        dispatch({ type: 'replacePlan', plan: swapExerciseInPlan(plan, session.id, ex.id, s.exercise.id, today, profile) });
                        setInputs((prev) => {
                          const next = { ...prev };
                          delete next[ex.id];
                          return next;
                        });
                        setSwapFor(null);
                      }}
                    />
                  </Card>
                ))}
              </Card>
            ) : null}

            {Array.from({ length: p.sets }, (_, i) => inputs[p.exerciseId]?.[i] ?? { reps: '', kg: '' }).map((row, i) => (
              <Row key={i} style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
                <Text style={{ width: 48, fontSize: font.small, color: colors.muted }}>{S.session.set(i + 1)}</Text>
                <TextInput
                  accessibilityLabel={`${ex.name} ${S.session.set(i + 1)} ${S.session.reps}`}
                  style={inputStyle}
                  keyboardType="number-pad"
                  placeholder={`${p.repsMin}–${p.repsMax} ${p.note?.includes('seconds') || ex.pattern === 'core_stability' ? 's' : S.session.reps.toLowerCase()}`}
                  placeholderTextColor={colors.muted}
                  value={row.reps}
                  onChangeText={(v) => updateSet(p.exerciseId, i, 'reps', v)}
                  maxLength={4}
                />
                {weighted ? (
                  <TextInput
                    accessibilityLabel={`${ex.name} ${S.session.set(i + 1)} ${S.session.kg}`}
                    style={inputStyle}
                    keyboardType="decimal-pad"
                    placeholder={S.session.kg}
                    placeholderTextColor={colors.muted}
                    value={row.kg}
                    onChangeText={(v) => updateSet(p.exerciseId, i, 'kg', v)}
                    maxLength={6}
                  />
                ) : null}
              </Row>
            ))}
            <Muted>📈 {progressionTip(p)}</Muted>
            {ex.formCheck ? (
              <Button compact kind="ghost" icon="📷" label={S.session.formCheck} onPress={() => router.push(`/form-check/${ex.formCheck}`)} />
            ) : null}
          </Card>
        );
      })}

      <Card>
        <H3>🧘 {S.session.cooldown}</H3>
        {session.cooldown.map((w, i) => <Body key={i}>• {w}</Body>)}
      </Card>

      {message ? (
        <Card tone={message === S.session.saved ? 'primary' : 'warn'}>
          <Body>{message}</Body>
        </Card>
      ) : null}
      <Button label={`✓ ${S.session.finish}`} onPress={finish} />

      <Divider />

      {proposal ? (
        <Card tone="primary">
          <H3>{S.session.proposalTitle}</H3>
          {proposal.summary.map((line, i) => <Body key={i}>• {line}</Body>)}
          <Row>
            <Button
              label={S.common.approve}
              onPress={() => {
                dispatch({ type: 'replacePlan', plan: proposal.plan });
                setProposal(null);
                router.back();
              }}
            />
            <Button kind="ghost" label={S.common.cancel} onPress={() => setProposal(null)} />
          </Row>
        </Card>
      ) : session.status === 'planned' ? (
        missed === null ? (
          <Button kind="ghost" label={S.session.missed} onPress={() => setMissed('ask')} />
        ) : (
          <Card>
            <Body>{S.session.missedQuestion}</Body>
            {missed === 'ask' ? (
              <>
                <Button kind="secondary" label={`📅 ${S.session.moveIt}`} onPress={() => setMissed('pickDay')} />
                <Button kind="secondary" label={`⏭️ ${S.session.skipIt}`} onPress={() => propose('skip')} />
              </>
            ) : safeDays.length === 0 ? (
              <>
                <Body>{S.session.noSafeDay}</Body>
                <Button kind="secondary" label={`⏭️ ${S.session.skipIt}`} onPress={() => propose('skip')} />
              </>
            ) : (
              <>
                <Muted>{S.session.pickDay}</Muted>
                <ChipRow>
                  {safeDays.map((d) => (
                    <Chip key={d} label={S.daysShort[d]} onPress={() => propose('reschedule', d)} />
                  ))}
                </ChipRow>
              </>
            )}
            <Button kind="ghost" label={S.common.cancel} onPress={() => setMissed(null)} />
          </Card>
        )
      ) : null}
    </Screen>
  );
}

const inputStyle = {
  minHeight: TOUCH,
  flex: 1,
  minWidth: 0,
  width: 0,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.md,
  paddingHorizontal: space.md,
  fontSize: font.body,
  backgroundColor: colors.card,
  color: colors.text,
} as const;
