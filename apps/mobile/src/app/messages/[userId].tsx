import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { api, type ChatMessageDto } from '../../api/client';
import { attempt, useApi } from '../../api/useApi';
import { ReportSheet } from '../../features/community/ReportSheet';
import { S } from '../../i18n';
import { colors, radius, space } from '../../theme';
import { Button, Input, Muted, Row, Screen } from '../../ui/kit';

const POLL_MS = 5000;

export default function Thread() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const uid = Number(userId);
  const thread = useApi((t) => api.messages(t, uid), [uid]);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [reporting, setReporting] = useState<number | null>(null);
  const list = useRef<FlatList<ChatMessageDto>>(null);

  useEffect(() => {
    const t = setInterval(() => void thread.reload(), POLL_MS);
    return () => clearInterval(t);
  }, [thread.reload]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const r = await attempt(() => api.sendMessage(thread.token, uid, body), setErr);
    if (r.ok) {
      setText('');
      setErr(null);
      thread.setData((m) => [...(m ?? []), r.value]);
      setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: name ?? S.messages.title }} />
      <Screen scroll={false}>
        {thread.error ? <Muted style={{ color: colors.danger }}>{thread.error}</Muted> : null}
        <FlatList
          ref={list}
          style={{ flex: 1 }}
          data={thread.data ?? []}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View style={{ alignSelf: item.from_me ? 'flex-end' : 'flex-start', maxWidth: '85%', gap: 4 }}>
              <View
                style={{
                  backgroundColor: item.from_me ? colors.primary : colors.card,
                  borderRadius: radius.md,
                  padding: space.md,
                  borderWidth: item.from_me ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: item.from_me ? '#fff' : colors.text, fontSize: 16 }}>{item.body}</Text>
              </View>
              {item.status === 'held' ? <Muted>⏳ {S.messages.held}</Muted> : null}
              {!item.from_me ? (
                <Button compact kind="ghost" label={`🚩 ${S.community.report}`} onPress={() => setReporting(item.id)} />
              ) : null}
              {reporting === item.id ? <ReportSheet targetType="message" targetId={item.id} onClose={() => setReporting(null)} /> : null}
            </View>
          )}
        />
        {err ? <Muted style={{ color: colors.danger }}>{err}</Muted> : null}
        <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Input value={text} onChangeText={setText} placeholder={S.messages.placeholder} onSubmitEditing={send} maxLength={1000} />
          </View>
          <Button label={S.community.send} onPress={send} disabled={!text.trim()} />
        </Row>
      </Screen>
    </KeyboardAvoidingView>
  );
}
