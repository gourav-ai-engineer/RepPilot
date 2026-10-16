import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable } from 'react-native';
import { api } from '../../api/client';
import { useApi } from '../../api/useApi';
import { S } from '../../i18n';
import { colors } from '../../theme';
import { Body, Card, H3, Muted, Row, Screen } from '../../ui/kit';

export default function ChallengesScreen() {
  const list = useApi((t) => api.challenges(t));
  useFocusEffect(
    useCallback(() => {
      void list.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  return (
    <Screen>
      <Muted>{S.challenges.fairness}</Muted>
      {list.error ? <Muted style={{ color: colors.danger }}>{list.error}</Muted> : null}
      {(list.data ?? []).map((c) => (
        <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/challenges/${c.id}`)}>
          <Card tone={c.joined ? 'primary' : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H3>🏆 {c.title}</H3>
              <Muted>{c.joined ? `✓ ${S.challenges.joined}` : ''}</Muted>
            </Row>
            <Body>{c.description}</Body>
            <Muted>
              {S.challenges.participants(c.participants)}
              {c.my_best !== null ? ` · ${S.challenges.myBest(`${c.my_best} ${c.unit}`)}` : ''}
            </Muted>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
