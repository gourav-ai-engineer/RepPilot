import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AutoSync } from '../features/sync';
import { S } from '../i18n';
import { StoreProvider, useStore } from '../state/store';
import { colors } from '../theme';

function Gate() {
  const { ready } = useStore();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primaryDark,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="session/[id]" options={{ title: S.community.kinds.workout }} />
      <Stack.Screen name="exercise/[id]" options={{ title: S.tabs.exercises }} />
      <Stack.Screen name="form-check/[exercise]" options={{ title: S.formCheck.title }} />
      <Stack.Screen name="profile" options={{ title: S.profile.title }} />
      <Stack.Screen name="account" options={{ title: S.account.title }} />
      <Stack.Screen name="compose" options={{ title: S.community.composeTitle }} />
      <Stack.Screen name="post/[id]" options={{ title: S.community.title }} />
      <Stack.Screen name="friends" options={{ title: S.friends.title }} />
      <Stack.Screen name="messages/index" options={{ title: S.messages.title }} />
      <Stack.Screen name="messages/[userId]" options={{ title: S.messages.title }} />
      <Stack.Screen name="challenges/index" options={{ title: S.challenges.title }} />
      <Stack.Screen name="challenges/[id]" options={{ title: S.challenges.title }} />
      <Stack.Screen name="moderation" options={{ title: S.moderation.title }} />
      <Stack.Screen name="reminders" options={{ title: S.reminders.title }} />
      <Stack.Screen name="standards" options={{ title: S.standards.title }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <AutoSync />
        <Gate />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
