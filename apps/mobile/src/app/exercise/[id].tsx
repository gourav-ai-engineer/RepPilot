import {
  EQUIPMENT_LABELS,
  eligibilityFromProfile,
  findSubstitutes,
  getExercise,
  ineligibilityReason,
  listMuscles,
} from '@reppilot/core';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable } from 'react-native';
import { S } from '../../i18n';
import { useStore } from '../../state/store';
import { Body, Button, Card, H2, H3, Muted, SafetyNote, Screen } from '../../ui/kit';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  const ex = id ? getExercise(id) : undefined;
  if (!ex) {
    return (
      <Screen>
        <Body>Exercise not found.</Body>
      </Screen>
    );
  }
  const ctx = state.profile ? eligibilityFromProfile(state.profile) : null;
  const why = ctx ? ineligibilityReason(ex, ctx) : null;
  const subs = ctx ? findSubstitutes(ex.id, { ...ctx, limit: 3 }) : [];

  return (
    <Screen>
      <Stack.Screen options={{ title: ex.name }} />
      <H2>{ex.name}</H2>
      {why ? (
        <Card tone="warn">
          <Body>{S.exercises.notSuggested(why)}</Body>
        </Card>
      ) : null}
      <Card>
        <Body>
          <Body style={{ fontWeight: '700' }}>{S.exercises.primary}: </Body>
          {listMuscles(ex.primary)}
        </Body>
        {ex.secondary.length ? (
          <Body>
            <Body style={{ fontWeight: '700' }}>{S.exercises.secondary}: </Body>
            {listMuscles(ex.secondary)}
          </Body>
        ) : null}
        <Body>
          <Body style={{ fontWeight: '700' }}>{S.exercises.equipment}: </Body>
          {ex.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}
        </Body>
        <Body>
          <Body style={{ fontWeight: '700' }}>{S.exercises.level}: </Body>
          {S.exercises.levels[ex.difficulty]}
        </Body>
      </Card>
      <Card>
        <H3>{S.exercises.steps}</H3>
        {ex.instructions.map((step, i) => (
          <Body key={i}>
            {i + 1}. {step}
          </Body>
        ))}
      </Card>
      <Card tone="primary">
        <H3>💡 {S.exercises.tips}</H3>
        {ex.cues.map((c, i) => <Body key={i}>• {c}</Body>)}
      </Card>
      <SafetyNote text={S.safety.stopBanner} />
      {ex.formCheck ? (
        <Button icon="📷" label={S.session.formCheck} onPress={() => router.push(`/form-check/${ex.formCheck}`)} />
      ) : null}
      {subs.length ? <H3>{S.exercises.alternatives}</H3> : null}
      {subs.map((s) => (
        <Pressable key={s.exercise.id} onPress={() => router.push(`/exercise/${s.exercise.id}`)} accessibilityRole="button">
          <Card>
            <H3>{s.exercise.name}</H3>
            <Muted>{s.reasons.join(' ')}</Muted>
            <Muted>{s.differences[0]}</Muted>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
