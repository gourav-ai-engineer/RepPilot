import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable } from 'react-native';
import { api } from '../../api/client';
import { useApi } from '../../api/useApi';
import { timeAgo } from '../../features/community/PostCard';
import { S } from '../../i18n';
import { colors } from '../../theme';
import { Body, Card, Muted, Row, Screen } from '../../ui/kit';

export default function Conversations() {
  const convs = useApi((t) => api.conversations(t));
  useFocusEffect(
    useCallback(() => {
      void convs.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  return (
    <Screen>
      {convs.data && convs.data.length === 0 ? <Body>{S.messages.none}</Body> : null}
      {(convs.data ?? []).map((c) => (
        <Pressable key={c.user_id} accessibilityRole="button" onPress={() => router.push(`/messages/${c.user_id}?name=${encodeURIComponent(c.display_name)}`)}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '700' }}>
                {c.display_name}
                {c.unread ? ` (${c.unread})` : ''}
              </Body>
              {c.last_at ? <Muted>{timeAgo(c.last_at)}</Muted> : null}
            </Row>
            <Muted style={c.unread ? { color: colors.text, fontWeight: '600' } : undefined}>{c.last_message ?? '—'}</Muted>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
