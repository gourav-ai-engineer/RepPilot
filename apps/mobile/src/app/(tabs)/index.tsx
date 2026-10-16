import {
  estimateSessionMinutes,
  weekdayOf,
  type Session,
  type Weekday,
} from '@reppilot/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { S } from '../../i18n';
import { useStore } from '../../state/store';
import { colors, radius, space } from '../../theme';
import { Body, Button, Card, H1, H2, H3, Muted, Row, Screen } from '../../ui/kit';

function statusLabel(s: Session): string {
  return s.status === 'completed' ? `✅ ${S.plan.completed}` : s.status === 'skipped' ? `⏭️ ${S.plan.skipped}` : S.plan.planned;
}

export default function PlanScreen() {
  const { state } = useStore();
  const { profile, plan } = state;
  const { today } = useStore();
  const todayDay = weekdayOf(today);
  const [showLog, setShowLog] = useState(false);

  if (!profile || !plan) return <Screen><Body>{S.plan.noPlan}</Body></Screen>;

  const todays = plan.sessions.find((s) => s.day === todayDay && s.status !== 'skipped');
  const next = plan.sessions.find((s) => s.day > todayDay && s.status === 'planned');
  const byDay = new Map(plan.sessions.map((s) => [s.day, s]));

  return (
    <Screen>
      <H1>{S.plan.hello(profile.name)}</H1>

      <Card tone="primary">
        <Muted>{S.plan.today} · {S.days[todayDay]}</Muted>
        {todays ? (
          <>
            <H2>{todays.title}</H2>
            <Body>
              {S.plan.exercisesCount(todays.exercises.length)} · {S.session.estimated(estimateSessionMinutes(todays))}
            </Body>
            <Button
              label={todays.status === 'completed' ? `${S.plan.completed} ✓ — ${S.plan.open}` : S.plan.start}
              onPress={() => router.push(`/session/${todays.id}`)}
              kind={todays.status === 'completed' ? 'secondary' : 'primary'}
            />
          </>
        ) : (
          <>
            <H2>😌 {S.plan.restDay}</H2>
            <Body>{S.plan.restDayBody}</Body>
            {next ? <Muted>{S.plan.nextUp(S.days[next.day], next.title)}</Muted> : null}
          </>
        )}
      </Card>

      <H2>{S.plan.title}</H2>
      <Row style={{ flexWrap: 'nowrap', justifyContent: 'space-between' }}>
        {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => {
          const s = byDay.get(d);
          const mark = !s ? '·' : s.status === 'completed' ? '✓' : s.status === 'skipped' ? '–' : '●';
          const isToday = d === todayDay;
          return (
            <View
              key={d}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: space.sm,
                borderRadius: radius.sm,
                backgroundColor: isToday ? colors.primary : 'transparent',
              }}
            >
              <Text style={{ color: isToday ? '#fff' : colors.muted, fontSize: 13 }}>{S.daysShort[d]}</Text>
              <Text style={{ color: isToday ? '#fff' : s ? colors.primaryDark : colors.muted, fontSize: 18, fontWeight: '700' }}>{mark}</Text>
            </View>
          );
        })}
      </Row>

      {plan.sessions.map((s) => (
        <Pressable key={s.id} onPress={() => router.push(`/session/${s.id}`)} accessibilityRole="button">
          <Card style={s.status === 'skipped' ? { opacity: 0.6 } : undefined}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <H3>{S.days[s.day]}</H3>
              <Muted>{statusLabel(s)}</Muted>
            </Row>
            <Body>{s.title}</Body>
            <Muted>
              {S.plan.exercisesCount(s.exercises.length)} · {S.session.estimated(estimateSessionMinutes(s))}
            </Muted>
          </Card>
        </Pressable>
      ))}

      <Card>
        <Pressable onPress={() => setShowLog((v) => !v)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <H3>{showLog ? '▾' : '▸'} {S.plan.changes}</H3>
        </Pressable>
        {showLog
          ? [...plan.changeLog].reverse().map((c, i) => (
              <Muted key={i}>
                {c.at}: {c.description}
              </Muted>
            ))
          : null}
      </Card>

      <Muted>{S.safety.notMedical}</Muted>
    </Screen>
  );
}
