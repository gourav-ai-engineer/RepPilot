import { getExercise } from '@reppilot/core';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Platform } from 'react-native';
import { api, type PostKind, type Visibility } from '../api/client';
import { attempt } from '../api/useApi';
import { S } from '../i18n';
import { useStore } from '../state/store';
import { colors, radius } from '../theme';
import { Body, Button, Card, Chip, ChipRow, H3, Input, Muted, Row, Screen } from '../ui/kit';

const KINDS: PostKind[] = ['text', 'workout', 'progress', 'meal', 'achievement'];
const VIS: Visibility[] = ['friends', 'public', 'private'];

type Picked = { uri: string; kind: 'image' | 'video'; mime: string; name: string; file?: File };

export default function Compose() {
  const { state } = useStore();
  const token = state.account?.token ?? null;
  const [kind, setKind] = useState<PostKind>('text');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('friends');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lastLog = [...state.logs].sort((a, b) => b.date.localeCompare(a.date))[0];

  const useLastWorkout = () => {
    if (!lastLog) return;
    const lines = lastLog.entries.map((e) => {
      const name = getExercise(e.exerciseId)?.name ?? e.exerciseId;
      const best = Math.max(...e.sets.map((s) => s.weightKg ?? 0));
      return `• ${name}: ${e.sets.length} sets${best > 0 ? ` (up to ${best} kg)` : ''}`;
    });
    setKind('workout');
    setBody(`Workout done ✅ (${lastLog.date})\n${lines.join('\n')}`);
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, allowsMultipleSelection: false });
    const a = res.canceled ? undefined : res.assets[0];
    if (!a) return;
    const isVideo = a.type === 'video';
    const mime = a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');
    setPicked({ uri: a.uri, kind: isVideo ? 'video' : 'image', mime, name: a.fileName ?? (isVideo ? 'video.mp4' : 'photo.jpg'), file: a.file });
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    let mediaId: number | null = null;
    if (picked) {
      const form = new FormData();
      if (Platform.OS === 'web') {
        const blob = picked.file ?? (await (await fetch(picked.uri)).blob());
        form.append('file', blob, picked.name);
      } else {
        // React Native's FormData accepts a { uri, name, type } file descriptor.
        form.append('file', { uri: picked.uri, name: picked.name, type: picked.mime } as unknown as Blob);
      }
      const up = await attempt(() => api.uploadMedia(token, form), setErr);
      if (!up.ok) return setBusy(false);
      mediaId = up.value.id;
    }
    const r = await attempt(() => api.createPost(token, { kind, body: body.trim(), visibility, media_id: mediaId }), setErr);
    setBusy(false);
    if (r.ok) router.back();
  };

  return (
    <Screen>
      <ChipRow>
        {KINDS.map((k) => (
          <Chip key={k} label={S.community.kinds[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </ChipRow>
      {lastLog ? <Button compact kind="secondary" icon="🏋️" label={S.community.shareWorkout} onPress={useLastWorkout} /> : null}
      <Input
        value={body}
        onChangeText={setBody}
        placeholder={S.community.composePlaceholder}
        multiline
        maxLength={2000}
        style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }}
      />
      <Card>
        <H3>📷 {S.community.addPhoto}</H3>
        <Muted>{S.community.photoNote}</Muted>
        {picked ? (
          <>
            {picked.kind === 'image' ? (
              <Image source={{ uri: picked.uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md }} />
            ) : (
              <Body>🎬 {picked.name}</Body>
            )}
            <Button compact kind="ghost" label={S.community.removePhoto} onPress={() => setPicked(null)} />
          </>
        ) : (
          <Button compact kind="secondary" label={S.community.addPhoto} onPress={pick} />
        )}
      </Card>
      <H3>{S.community.whoCanSee}</H3>
      <ChipRow>
        {VIS.map((v) => (
          <Chip key={v} label={S.community.visibility[v]} selected={visibility === v} onPress={() => setVisibility(v)} />
        ))}
      </ChipRow>
      {err ? <Body style={{ color: colors.danger }}>{err}</Body> : null}
      <Row>
        <Button label={S.community.post} disabled={!body.trim() || busy} onPress={submit} />
      </Row>
    </Screen>
  );
}
