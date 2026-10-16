import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { api, type Comment } from '../../api/client';
import { attempt, useApi } from '../../api/useApi';
import { PostCard, timeAgo } from '../../features/community/PostCard';
import { ReportSheet } from '../../features/community/ReportSheet';
import { S } from '../../i18n';
import { useStore } from '../../state/store';
import { colors, space } from '../../theme';
import { Body, Button, Card, Input, Muted, Row, Screen } from '../../ui/kit';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);
  const { state } = useStore();
  const me = state.account?.user.id;
  const post = useApi((t) => api.post(t, postId), [postId]);
  const comments = useApi((t) => api.comments(t, postId), [postId]);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [reporting, setReporting] = useState<number | null>(null);
  const [removed, setRemoved] = useState(false);

  if (removed) return <Screen><Body>✓</Body></Screen>;
  if (post.error) return <Screen><Body>{post.error}</Body></Screen>;
  if (!post.data) return <Screen><Muted>…</Muted></Screen>;

  const del = async (c: Comment) => {
    const r = await attempt(() => api.deleteComment(post.token, postId, c.id), setErr);
    if (r.ok) comments.setData((cs) => cs?.filter((x) => x.id !== c.id));
  };

  return (
    <Screen>
      <PostCard post={post.data} onChange={(p) => post.setData(p)} onRemoved={() => setRemoved(true)} linkToDetail={false} />
      {(comments.data ?? []).length === 0 ? <Muted>{S.community.noComments}</Muted> : null}
      {(comments.data ?? []).map((c) => (
        <Card key={c.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ fontWeight: '700' }}>{c.author.display_name}</Body>
            <Muted>{timeAgo(c.created_at)}</Muted>
          </Row>
          <Body>{c.body}</Body>
          {c.status === 'held' ? <Muted>⏳ {S.community.held}</Muted> : null}
          <Row>
            {c.author.id === me || post.data?.author.id === me ? (
              <Button compact kind="ghost" label={S.community.delete} onPress={() => del(c)} />
            ) : null}
            {c.author.id !== me ? <Button compact kind="ghost" label={`🚩 ${S.community.report}`} onPress={() => setReporting(c.id)} /> : null}
          </Row>
          {reporting === c.id ? <ReportSheet targetType="comment" targetId={c.id} onClose={() => setReporting(null)} /> : null}
        </Card>
      ))}
      <View style={{ gap: space.sm }}>
        <Input value={text} onChangeText={setText} placeholder={S.community.addComment} maxLength={500} />
        {err ? <Muted style={{ color: colors.danger }}>{err}</Muted> : null}
        <Button
          label={S.community.send}
          disabled={!text.trim()}
          onPress={async () => {
            const r = await attempt(() => api.addComment(post.token, postId, text.trim()), setErr);
            if (r.ok) {
              setText('');
              setErr(null);
              comments.setData((cs) => [...(cs ?? []), r.value]);
              post.setData((p) => (p ? { ...p, comment_count: p.comment_count + 1 } : p));
            }
          }}
        />
      </View>
    </Screen>
  );
}
