import { useState } from 'react';
import { View } from 'react-native';
import { api, type QueueItem } from '../api/client';
import { attempt, useApi } from '../api/useApi';
import { S } from '../i18n';
import { useStore } from '../state/store';
import { colors } from '../theme';
import { Body, Button, Card, H3, Input, Muted, Row, Screen } from '../ui/kit';

export default function ModerationScreen() {
  const { state } = useStore();
  if (state.account?.user.role !== 'moderator') {
    return (
      <Screen>
        <Body>{S.moderation.modsOnly}</Body>
      </Screen>
    );
  }
  return <ModerationQueue />;
}

function ModerationQueue() {
  const queue = useApi((t) => api.modQueue(t));
  const stats = useApi((t) => api.modStats(t));
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const token = queue.token;

  const decide = async (item: QueueItem, action: string) => {
    const r = await attempt(() => api.modDecide(token, { target_type: item.target_type, target_id: item.target_id, action, reason }), setErr);
    if (r.ok) {
      setReason('');
      void queue.reload();
      void stats.reload();
    }
  };

  const s = stats.data;
  return (
    <Screen>
      {queue.error ? <Body style={{ color: colors.danger }}>{queue.error}</Body> : null}
      {s ? (
        <Card>
          <H3>📊 {S.moderation.stats}</H3>
          <Muted>
            Open reports {s.open_reports} (high priority {s.high_priority_open}) · Held {s.held_items} · Media to review {s.pending_media} · Open
            appeals {s.open_appeals} · Overturned {s.appeals_overturned}/{s.appeals_decided} · Users with strikes {s.users_with_strikes}
          </Muted>
        </Card>
      ) : null}
      <Input label={S.moderation.reason} value={reason} onChangeText={setReason} maxLength={300} />
      {err ? <Muted style={{ color: colors.danger }}>{err}</Muted> : null}

      <H3>{S.moderation.queue}</H3>
      {queue.data && queue.data.items.length === 0 ? <Body>{S.moderation.empty}</Body> : null}
      {(queue.data?.items ?? []).map((i) => (
        <Card key={`${i.target_type}-${i.target_id}`} tone={i.priority === 'high' ? 'danger' : undefined}>
          <Muted>
            {i.priority === 'high' ? '🔴 ' : ''}
            {i.target_type} #{i.target_id} · {i.author_name ?? '?'} · {i.status}
            {i.report_count ? ` · ${S.moderation.reports(i.report_count)} (${i.reasons.join(', ')})` : ''}
          </Muted>
          <Body>{i.preview}</Body>
          <Row>
            {i.target_type === 'user' ? (
              <>
                <Button compact kind="secondary" label={S.moderation.warn} onPress={() => decide(i, 'warn')} />
                <Button compact kind="danger" label={S.moderation.suspend} onPress={() => decide(i, 'suspend')} />
                <Button compact kind="danger" label={S.moderation.ban} onPress={() => decide(i, 'ban')} />
              </>
            ) : (
              <>
                <Button compact label={S.moderation.approve} onPress={() => decide(i, 'approve')} />
                <Button compact kind="danger" label={S.moderation.remove} onPress={() => decide(i, 'remove')} />
              </>
            )}
          </Row>
        </Card>
      ))}

      <H3>{S.moderation.appeals}</H3>
      {(queue.data?.appeals ?? []).length === 0 ? <Muted>—</Muted> : null}
      {(queue.data?.appeals ?? []).map((a) => (
        <Card key={a.id}>
          <Muted>
            {a.action} · {a.target_type} #{a.target_id} · {a.action_reason}
          </Muted>
          <Body>“{a.message}”</Body>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button compact kind="secondary" label={S.moderation.uphold} onPress={async () => { await attempt(() => api.modAppeal(token, a.id, 'uphold', reason), setErr); void queue.reload(); }} />
            <Button compact label={S.moderation.overturn} onPress={async () => { await attempt(() => api.modAppeal(token, a.id, 'overturn', reason), setErr); void queue.reload(); }} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
