import type { Weekday } from '@reppilot/core';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { S } from '../i18n';
import type { Reminders } from '../state/store';

export const remindersSupported = Platform.OS !== 'web';

Notifications.setNotificationHandler?.({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Monday=0 … Sunday=6 → expo's 1=Sunday … 7=Saturday */
function expoWeekday(d: Weekday): number {
  return ((d + 1) % 7) + 1;
}

const WATER_HOURS = [10, 13, 16, 19];

/**
 * Replaces all scheduled reminders. Returns false when permission is denied.
 * Reminders are kept few and kind: training days only, a handful of water nudges.
 */
export async function applyReminders(r: Reminders, trainingDays: Weekday[]): Promise<boolean> {
  if (!remindersSupported) return true;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!r.workout && !r.water) return true;
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;
  if (r.workout) {
    for (const d of trainingDays) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'RepPilot', body: S.reminders.workoutBody },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: expoWeekday(d), hour: r.workoutHour, minute: 0 },
      });
    }
  }
  if (r.water) {
    for (const hour of WATER_HOURS) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'RepPilot', body: S.reminders.waterBody },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0 },
      });
    }
  }
  return true;
}
