import { EXERCISES, MUSCLES, MUSCLE_LABELS, eligibilityFromProfile, isEligible, listMuscles, type Muscle } from '@reppilot/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { S } from '../../i18n';
import { useStore } from '../../state/store';
import { Body, Card, Chip, ChipRow, H3, Input, Muted, Row, Screen } from '../../ui/kit';

export default function ExercisesScreen() {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [onlyMine, setOnlyMine] = useState(true);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ctx = state.profile ? eligibilityFromProfile(state.profile) : null;
    return EXERCISES.filter(
      (e) =>
        (!q || e.name.toLowerCase().includes(q)) &&
        (!muscle || e.primary.includes(muscle) || e.secondary.includes(muscle)) &&
        (!onlyMine || !ctx || isEligible(e, ctx)),
    ).sort((a, b) => Number(!!muscle && !a.primary.includes(muscle)) - Number(!!muscle && !b.primary.includes(muscle)));
  }, [query, muscle, onlyMine, state.profile]);

  return (
    <Screen>
      <Input placeholder={`🔍 ${S.exercises.search}`} value={query} onChangeText={setQuery} accessibilityLabel={S.exercises.search} />
      <ChipRow>
        <Chip label={S.exercises.onlyMine} selected={onlyMine} onPress={() => setOnlyMine((v) => !v)} />
      </ChipRow>
      <ChipRow>
        <Chip label={S.exercises.all} selected={muscle === null} onPress={() => setMuscle(null)} />
        {MUSCLES.map((m) => (
          <Chip key={m} label={MUSCLE_LABELS[m].replace(/ \(.*\)$/, '')} selected={muscle === m} onPress={() => setMuscle(m)} />
        ))}
      </ChipRow>
      <Muted>{list.length} exercises</Muted>
      {list.map((e) => (
        <Pressable key={e.id} onPress={() => router.push(`/exercise/${e.id}`)} accessibilityRole="button">
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <H3>{e.name}</H3>
              <Muted>{S.exercises.levels[e.difficulty]}</Muted>
            </Row>
            <Body>{listMuscles(e.primary)}</Body>
            {e.formCheck ? <Muted>📷 {S.exercises.formCheckAvailable}</Muted> : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
