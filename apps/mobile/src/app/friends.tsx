import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { api, type Person } from '../api/client';
import { attempt, useApi } from '../api/useApi';
import { S } from '../i18n';
import { colors } from '../theme';
import { Body, Button, Card, H3, Input, Muted, Row, Screen } from '../ui/kit';

export default function FriendsScreen() {
  const friends = useApi((t) => api.friends(t));
  const requests = useApi((t) => api.friendRequests(t));
  const blocks = useApi((t) => api.blocks(t));
  const token = friends.token;
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const reloadAll = () => {
    void friends.reload();
    void requests.reload();
    void blocks.reload();
  };

  const search = async () => {
    if (q.trim().length < 2) return;
    const r = await attempt(() => api.search(token, q.trim()), setErr);
    if (r.ok) setResults(r.value);
  };

  const PersonRow = ({ p, children }: { p: Person; children: React.ReactNode }) => (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Body style={{ fontWeight: '700' }}>{p.display_name}</Body>
          {p.bio ? <Muted>{p.bio}</Muted> : null}
        </View>
        <Row>{children}</Row>
      </Row>
    </Card>
  );

  return (
    <Screen>
      <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Input value={q} onChangeText={setQ} placeholder={`🔍 ${S.friends.search}`} onSubmitEditing={search} returnKeyType="search" />
        </View>
        <Button label="🔍" onPress={search} />
      </Row>
      <Muted>{S.friends.searchHint}</Muted>
      {err ? <Muted style={{ color: colors.danger }}>{err}</Muted> : null}
      {results.map((p) => (
        <PersonRow key={p.id} p={p}>
          {p.relationship === 'none' ? (
            <Button
              compact
              label={S.friends.add}
              onPress={async () => {
                const r = await attempt(() => api.sendFriendRequest(token, p.id), setErr);
                if (r.ok) setResults((rs) => rs.map((x) => (x.id === p.id ? { ...x, relationship: r.value.status === 'accepted' ? 'friend' : 'request_sent' } : x)));
                reloadAll();
              }}
            />
          ) : (
            <Muted>{p.relationship === 'friend' ? '✓' : S.friends.requested}</Muted>
          )}
        </PersonRow>
      ))}

      {(requests.data ?? []).length > 0 ? <H3>{S.friends.requests}</H3> : null}
      {(requests.data ?? []).map((r) => (
        <PersonRow key={r.id} p={r.from_user}>
          <Button compact label={S.friends.accept} onPress={async () => { await attempt(() => api.acceptRequest(token, r.id), setErr); reloadAll(); }} />
          <Button compact kind="ghost" label={S.friends.reject} onPress={async () => { await attempt(() => api.rejectRequest(token, r.id), setErr); reloadAll(); }} />
        </PersonRow>
      ))}

      <H3>{S.friends.myFriends}</H3>
      {friends.data && friends.data.length === 0 ? <Muted>{S.friends.none}</Muted> : null}
      {(friends.data ?? []).map((p) => (
        <PersonRow key={p.id} p={p}>
          <Button compact kind="secondary" label={S.friends.message} onPress={() => router.push(`/messages/${p.id}?name=${encodeURIComponent(p.display_name)}`)} />
          <Button compact kind="ghost" label={S.friends.remove} onPress={async () => { await attempt(() => api.removeFriend(token, p.id), setErr); reloadAll(); }} />
          <Button compact kind="ghost" label="🚫" onPress={async () => { await attempt(() => api.block(token, p.id), setErr); reloadAll(); }} />
        </PersonRow>
      ))}

      {(blocks.data ?? []).length > 0 ? <H3>{S.friends.blocked}</H3> : null}
      {(blocks.data ?? []).map((p) => (
        <PersonRow key={p.id} p={p}>
          <Button compact kind="ghost" label={S.friends.unblock} onPress={async () => { await attempt(() => api.unblock(token, p.id), setErr); reloadAll(); }} />
        </PersonRow>
      ))}
    </Screen>
  );
}
