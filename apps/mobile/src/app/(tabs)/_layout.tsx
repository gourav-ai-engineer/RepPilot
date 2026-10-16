import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';
import { S } from '../../i18n';
import { useStore } from '../../state/store';
import { colors } from '../../theme';

const icon = (glyph: string) => () => <Text style={{ fontSize: 22 }}>{glyph}</Text>;

export default function TabsLayout() {
  const { state } = useStore();
  if (!state.profile) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { minHeight: 64, paddingTop: 4 },
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: S.tabs.plan, tabBarIcon: icon('🗓️') }} />
      <Tabs.Screen name="exercises" options={{ title: S.tabs.exercises, tabBarIcon: icon('🏋️') }} />
      <Tabs.Screen name="community" options={{ title: S.tabs.community, tabBarIcon: icon('👥') }} />
      <Tabs.Screen name="progress" options={{ title: S.tabs.progress, tabBarIcon: icon('📈') }} />
      <Tabs.Screen name="food" options={{ title: S.tabs.food, tabBarIcon: icon('🍲') }} />
      <Tabs.Screen name="coach" options={{ title: S.tabs.coach, tabBarIcon: icon('💬') }} />
    </Tabs>
  );
}
