import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, type Post } from '../../api/client';
import { attempt } from '../../api/useApi';
import { S } from '../../i18n';
import { useStore } from '../../state/store';
import { colors, space } from '../../theme';
import { Body, Button, Card, Muted, Row } from '../../ui/kit';
import { AuthMedia } from './AuthMedia';
import { ReportSheet } from './ReportSheet';

const KIND_ICON: Record<Post['kind'], string> = { text: '💬', workout: '🏋️', progress: '📈', meal: '🍲', achievement: '🏅' };

export function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return new Date(iso).toLocaleDateString();
}

export function PostCard({ post, onChange, onRemoved, linkToDetail = true }: {
  post: Post;
  onChange: (p: Post) => void;
  onRemoved: (id: number) => void;
  linkToDetail?: boolean;
}) {
  const { state } = useStore();
  const token = state.account?.token ?? null;
  const mine = state.account?.user.id === post.author.id;
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleLike = async () => {
    const liked = !post.liked_by_me;
    onChange({ ...post, liked_by_me: liked, like_count: post.like_count + (liked ? 1 : -1) });
    const r = await attempt(() => (liked ? api.like(token, post.id) : api.unlike(token, post.id)), setErr);
    if (!r.ok) onChange(post);
  };

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>{post.author.display_name}</Text>
          <Muted>
            {KIND_ICON[post.kind]} {S.community.kinds[post.kind]} · {S.community.visibility[post.visibility]} · {timeAgo(post.created_at)}
            {post.edited ? ` · ${S.community.edited}` : ''}
          </Muted>
        </View>
        <Button compact kind="ghost" label="⋯" onPress={() => setMenu((m) => !m)} />
      </Row>
      {post.status === 'held' ? (
        <Card tone="warn">
          <Muted>⏳ {post.notice ?? S.community.held}</Muted>
        </Card>
      ) : null}
      <Pressable disabled={!linkToDetail} onPress={() => router.push(`/post/${post.id}`)}>
        <Body>{post.body}</Body>
      </Pressable>
      {post.media && token ? (
        post.media.status === 'approved' ? (
          <AuthMedia id={post.media.id} kind={post.media.kind} token={token} />
        ) : (
          <Muted>📷 {S.community.photoPending}</Muted>
        )
      ) : null}
      <Row style={{ alignItems: 'center', gap: space.md }}>
        <Button compact kind={post.liked_by_me ? 'primary' : 'secondary'} label={`💪 ${post.like_count}`} onPress={toggleLike} />
        <Button compact kind="ghost" label={`💬 ${S.community.comments(post.comment_count)}`} onPress={() => router.push(`/post/${post.id}`)} />
      </Row>
      {menu ? (
        <Row>
          {mine ? (
            <Button
              compact
              kind="danger"
              label={S.community.delete}
              onPress={async () => {
                const r = await attempt(() => api.deletePost(token, post.id), setErr);
                if (r.ok) onRemoved(post.id);
              }}
            />
          ) : (
            <>
              <Button compact kind="ghost" label={`🚩 ${S.community.report}`} onPress={() => setReporting(true)} />
              <Button
                compact
                kind="ghost"
                label={`🚫 ${S.community.block}`}
                onPress={async () => {
                  const r = await attempt(() => api.block(token, post.author.id), setErr);
                  if (r.ok) onRemoved(post.id);
                }}
              />
            </>
          )}
        </Row>
      ) : null}
      {reporting ? <ReportSheet targetType="post" targetId={post.id} onClose={() => setReporting(false)} /> : null}
      {err ? <Muted style={{ color: colors.danger }}>{err}</Muted> : null}
    </Card>
  );
}
