import { reply, weekdayOf } from '@reppilot/core';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { S } from '../../i18n';
import { newId, useStore, type ChatMessage } from '../../state/store';
import { colors, radius, space } from '../../theme';
import { Button, Card, Chip, ChipRow, H3, Input, Muted, Row, Screen } from '../../ui/kit';

export default function CoachScreen() {
  const { state, dispatch, today } = useStore();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const r = reply(q, { profile: state.profile, plan: state.plan, today: weekdayOf(today) });
    dispatch({
      type: 'addChat',
      messages: [
        { id: newId(), from: 'user', text: q },
        { id: newId(), from: 'coach', text: r.text, kind: r.kind },
      ],
    });
    setText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const header = (
    <View style={{ gap: space.md, marginBottom: space.md }}>
      <Card tone="primary">
        <H3>📷 {S.coach.formCheckTitle}</H3>
        <Muted>{S.coach.formCheckBody}</Muted>
        <Row>
          <Button compact label="Squat" onPress={() => router.push('/form-check/squat')} />
          <Button compact label="Push-up" onPress={() => router.push('/form-check/pushup')} />
        </Row>
      </Card>
      <Muted>{S.coach.intro}</Muted>
      <ChipRow>
        {S.coach.quick.map((q) => (
          <Chip key={q} label={q} onPress={() => ask(q)} />
        ))}
      </ChipRow>
      {state.chat.length > 0 ? <Button compact kind="ghost" label={S.coach.clear} onPress={() => dispatch({ type: 'clearChat' })} /> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen scroll={false}>
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={state.chat}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}
          renderItem={({ item }) => (
            <View
              style={{
                alignSelf: item.from === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                backgroundColor:
                  item.from === 'user' ? colors.primary : item.kind === 'safety' ? colors.dangerSoft : item.kind === 'referral' ? colors.warnSoft : colors.card,
                borderRadius: radius.md,
                padding: space.md,
                borderWidth: item.from === 'user' ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: item.from === 'user' ? '#fff' : colors.text, fontSize: 16, lineHeight: 23 }}>{item.text}</Text>
            </View>
          )}
        />
        <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder={S.coach.placeholder}
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => ask(text)}
              returnKeyType="send"
              accessibilityLabel={S.coach.placeholder}
              maxLength={500}
            />
          </View>
          <Button label={S.coach.send} onPress={() => ask(text)} disabled={!text.trim()} />
        </Row>
      </Screen>
    </KeyboardAvoidingView>
  );
}
