import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../../api/client';
import { attempt, useApi } from '../../api/useApi';
import { S } from '../../i18n';
import { useStore } from '../../state/store';
import { colors, space } from '../../theme';
import { Body, Button, Card, Chip, ChipRow, H2, H3, Input, Muted, Row, SafetyNote, Screen } from '../../ui/kit';

const DIVISIONS = ['all', 'beginner', 'intermediate', 'advanced'] as const;

export default function ChallengeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cid = Number(id);
  const { state } = useStore();
  const list = useApi((t) => api.challenges(t));
  const [division, setDivision] = useState<(typeof DIVISIONS)[number]>('all');
  const [scope, setScope] = useState<'everyone' | 'friends'>('everyone');
  const [mode, setMode] = useState<'best' | 'improved'>('best');
  const board = useApi((t) => api.leaderboard(t, cid, { division, scope, mode }), [cid, division, scope, mode]);
  const [value, setValue] = useState('');
  const [showMe, setShowMe] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const c = list.data?.find((x) => x.id === cid);
  if (!c) return <Screen><Muted>{list.error ?? '…'}</Muted></Screen>;
  const token = list.token;

  const refresh = () => {
    void list.reload();
    void board.reload();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: c.title }} />
      <H2>🏆 {c.title}</H2>
      <Body>{c.description}</Body>
      <Card>
        <H3>{S.challenges.rules}</H3>
        <Body>{c.rules}</Body>
      </Card>
      <SafetyNote text={S.safety.stopBanner} />

      {!c.joined ? (
        <Card tone="primary">
          <ChipRow>
            <Chip label={S.challenges.showMe} selected={showMe} onPress={() => setShowMe((v) => !v)} />
          </ChipRow>
          <Button label={S.challenges.join} onPress={async () => { await attempt(() => api.joinChallenge(token, cid, showMe), setMsg); refresh(); }} />
        </Card>
      ) : (
        <Card tone="primary">
          {c.my_best !== null ? <Body>{S.challenges.myBest(`${c.my_best} ${c.unit}`)}</Body> : null}
          <Input
            label={S.challenges.yourResult(c.unit)}
            value={value}
            onChangeText={(v) => setValue(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            maxLength={7}
          />
          <Button
            label={S.challenges.submit}
            disabled={!(Number(value) > 0)}
            onPress={async () => {
              const r = await attempt(() => api.submitEntry(token, cid, Number(value)), setMsg);
              if (r.ok) {
                setMsg(r.value.notice ?? '✓');
                setValue('');
                refresh();
              }
            }}
          />
          <Muted>{S.challenges.fairness}</Muted>
          <Button compact kind="ghost" label={S.challenges.leave} onPress={async () => { await attempt(() => api.leaveChallenge(token, cid), setMsg); refresh(); }} />
        </Card>
      )}
      {msg ? <Body>{msg}</Body> : null}

      <H3>📊 {S.challenges.leaderboard}</H3>
      <ChipRow>
        <Chip label={S.challenges.best} selected={mode === 'best'} onPress={() => setMode('best')} />
        <Chip label={S.challenges.improved} selected={mode === 'improved'} onPress={() => setMode('improved')} />
        <Chip label={S.challenges.everyone} selected={scope === 'everyone'} onPress={() => setScope('everyone')} />
        <Chip label={S.challenges.friendsOnly} selected={scope === 'friends'} onPress={() => setScope('friends')} />
      </ChipRow>
      <ChipRow>
        {DIVISIONS.map((d) => (
          <Chip key={d} label={d === 'all' ? S.challenges.all : S.exercises.levels[d === 'beginner' ? 1 : d === 'intermediate' ? 2 : 3] ?? d} selected={division === d} onPress={() => setDivision(d)} />
        ))}
      </ChipRow>
      <Card>
        {board.data && board.data.rows.length === 0 ? <Muted>{S.challenges.noEntries}</Muted> : null}
        {(board.data?.rows ?? []).map((r) => (
          <Row key={r.user_id} style={{ justifyContent: 'space-between', paddingVertical: space.xs, flexWrap: 'nowrap' }}>
            <View style={{ flexDirection: 'row', gap: space.sm, flex: 1 }}>
              <Body style={{ width: 36, fontWeight: '700' }}>{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `#${r.rank}`}</Body>
              <Body style={{ fontWeight: r.is_me ? '700' : '400', color: r.is_me ? colors.primaryDark : colors.text }}>
                {r.display_name}
                {r.is_me ? ` (${S.challenges.you})` : ''}
              </Body>
            </View>
            <Body style={{ fontWeight: '600' }}>
              {mode === 'improved' && r.value > 0 ? '+' : ''}
              {r.value} {board.data?.unit}
            </Body>
          </Row>
        ))}
      </Card>
      {state.account ? null : <Muted>{S.community.signedOut}</Muted>}
    </Screen>
  );
}
