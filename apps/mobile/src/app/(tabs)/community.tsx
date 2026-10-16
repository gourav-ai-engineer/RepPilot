import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { API_ENABLED, api, type Post } from '../../api/client';
import { useApi } from '../../api/useApi';
import { PostCard } from '../../features/community/PostCard';
import { S } from '../../i18n';
import { useStore } from '../../state/store';
import { colors } from '../../theme';
import { Body, Button, Card, Chip, ChipRow, Muted, Row, Screen } from '../../ui/kit';

type Scope = 'friends' | 'everyone' | 'mine';

export default function CommunityScreen() {
  const { state } = useStore();
  const [scope, setScope] = useState<Scope>('friends');
  const feed = useApi((t) => api.feed(t, scope), [scope]);
  const [more, setMore] = useState<Post[]>([]);
  const [end, setEnd] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setMore([]);
      setEnd(false);
      void feed.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope, feed.token]),
  );

  if (!API_ENABLED) {
    return (
      <Screen>
        <Card tone="primary">
          <Body>{S.community.comingSoon}</Body>
        </Card>
      </Screen>
    );
  }
  if (!state.account) {
    return (
      <Screen>
        <Card tone="primary">
          <Body>{S.community.signedOut}</Body>
          <Button label={S.community.getStarted} onPress={() => router.push('/account')} />
        </Card>
        <Button kind="ghost" label={`📜 ${S.settings.standards}`} onPress={() => router.push('/standards')} />
      </Screen>
    );
  }

  const user = state.account.user;
  const posts = [...(feed.data ?? []), ...more];
  const update = (p: Post) => {
    feed.setData((d) => d?.map((x) => (x.id === p.id ? p : x)));
    setMore((m) => m.map((x) => (x.id === p.id ? p : x)));
  };
  const remove = (id: number) => {
    feed.setData((d) => d?.filter((x) => x.id !== id));
    setMore((m) => m.filter((x) => x.id !== id));
  };

  return (
    <Screen>
      <Row>
        <Button compact icon="✍️" label={S.community.newPost} onPress={() => router.push('/compose')} />
        <Button compact kind="secondary" icon="👥" label={S.community.friends} onPress={() => router.push('/friends')} />
        <Button compact kind="secondary" icon="💬" label={S.community.messages} onPress={() => router.push('/messages')} />
        <Button compact kind="secondary" icon="🏆" label={S.community.challenges} onPress={() => router.push('/challenges')} />
        {user.role === 'moderator' ? (
          <Button compact kind="ghost" icon="🛡️" label={S.community.moderation} onPress={() => router.push('/moderation')} />
        ) : null}
      </Row>
      {user.suspended ? (
        <Card tone="warn">
          <Body>{S.account.suspended}</Body>
        </Card>
      ) : null}
      <ChipRow>
        {(['friends', 'everyone', 'mine'] as Scope[]).map((s) => (
          <Chip
            key={s}
            label={s === 'friends' ? S.community.friendsFeed : s === 'everyone' ? S.community.everyone : S.community.mine}
            selected={scope === s}
            onPress={() => setScope(s)}
          />
        ))}
      </ChipRow>
      {feed.error ? <Muted style={{ color: colors.danger }}>{feed.error}</Muted> : null}
      {feed.data && posts.length === 0 ? <Body>{S.community.empty}</Body> : null}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} onChange={update} onRemoved={remove} />
      ))}
      {posts.length >= 20 && !end ? (
        <Button
          kind="ghost"
          label={S.community.loadMore}
          onPress={async () => {
            const last = posts[posts.length - 1];
            if (!last || !feed.token) return;
            const next = await api.feed(feed.token, scope, last.id).catch(() => []);
            if (next.length === 0) setEnd(true);
            setMore((m) => [...m, ...next]);
          }}
        />
      ) : null}
    </Screen>
  );
}
