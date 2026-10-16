import {
  MUSCLE_LABELS,
  RANK_DISCLAIMER,
  addDays,
  computeAchievements,
  computeProgress,
  coverageReport,
  getExercise,
  logVolume,
  mondayOf,
} from '@reppilot/core';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { S } from '../../i18n';
import { useStore } from '../../state/store';
import { colors, space } from '../../theme';
import { Bar, Body, Button, Card, H2, H3, Muted, Row, Screen } from '../../ui/kit';

const STATUS_COLOR = { good: colors.good, low: colors.low, neglected: colors.neglected } as const;

export default function ProgressScreen() {
  const { state, today } = useStore();
  const { profile, logs } = state;
  if (!profile) return null;

  const stats = computeProgress(logs, profile.trainingDays.length, today);
  const achievements = computeAchievements(logs, stats, profile.experience);
  const weekStart = mondayOf(today);
  const coverage = coverageReport(logVolume(logs, weekStart, addDays(weekStart, 6)), profile.experience);
  const statusText = { good: S.progress.good, low: S.progress.low, neglected: S.progress.neglected };

  return (
    <Screen>
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button compact kind="ghost" icon="👤" label={S.progress.profile} onPress={() => router.push('/profile')} />
      </Row>

      <Card tone="primary">
        <Muted>{S.progress.rank}</Muted>
        <H2>🎖️ {stats.rank}</H2>
        <Body>{S.progress.points(stats.points)}</Body>
        <Muted>{stats.nextRank ? S.progress.toNext(stats.nextRank.pointsNeeded, stats.nextRank.name) : S.progress.topRank}</Muted>
        <Muted>{RANK_DISCLAIMER}</Muted>
      </Card>

      <Row style={{ flexWrap: 'nowrap' }}>
        {[
          [S.progress.workouts, stats.totalWorkouts],
          [S.progress.streak, stats.weekStreak],
          [S.progress.prs, stats.personalRecords.length],
        ].map(([label, value]) => (
          <Card key={String(label)} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: colors.primaryDark }}>{value}</Text>
            <Muted style={{ textAlign: 'center' }}>{label}</Muted>
          </Card>
        ))}
      </Row>

      <Card>
        <H3>{S.progress.coverage}</H3>
        <Muted>{S.progress.coverageHint}</Muted>
        {coverage.map((r) => (
          <View key={r.muscle} style={{ gap: 2, marginTop: space.xs }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body>{MUSCLE_LABELS[r.muscle]}</Body>
              <Muted style={{ color: STATUS_COLOR[r.status] }}>
                {statusText[r.status]} · {r.sets}/{r.target}
              </Muted>
            </Row>
            <Bar value={r.sets} max={r.target} color={STATUS_COLOR[r.status]} />
          </View>
        ))}
      </Card>

      <Card>
        <H3>{S.progress.achievements}</H3>
        {achievements.map((a) => (
          <Row key={a.id} style={{ alignItems: 'center', opacity: a.earned ? 1 : 0.45 }}>
            <Text style={{ fontSize: 22 }}>{a.earned ? '🏅' : '🔒'}</Text>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '600' }}>{a.title}</Body>
              <Muted>{a.description}</Muted>
            </View>
          </Row>
        ))}
      </Card>

      <Card>
        <H3>{S.progress.history}</H3>
        {logs.length === 0 ? <Body>{S.progress.noHistory}</Body> : null}
        {[...logs]
          .reverse()
          .slice(0, 30)
          .map((l) => (
            <View key={l.id} style={{ gap: 2, paddingVertical: space.xs }}>
              <Body style={{ fontWeight: '600' }}>{l.date}</Body>
              {l.entries.map((e) => (
                <Muted key={e.exerciseId}>
                  {getExercise(e.exerciseId)?.name ?? e.exerciseId}:{' '}
                  {e.sets.map((s) => (s.weightKg ? `${s.reps}×${s.weightKg}kg` : `${s.reps}`)).join(', ')}
                </Muted>
              ))}
            </View>
          ))}
      </Card>
    </Screen>
  );
}
