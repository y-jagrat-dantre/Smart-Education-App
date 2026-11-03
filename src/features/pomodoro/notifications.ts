import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { ActivePomodoro, PomodoroSettings } from '@/state/app-store';
import { shouldTakeLongBreak } from '@/features/pomodoro/timer';

let currentKey: string | null = null;
let revision = 0;

async function cancelManagedNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const request of scheduled) {
    if (request.content.data?.learnbeatsPomodoro === true) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => undefined);
    }
  }
}

export async function syncPomodoroNotification(active: ActivePomodoro | null, settings: PomodoroSettings, completedCount: number) {
  const canSchedule = settings.notificationsEnabled
    && active?.status === 'running'
    && ['focus', 'shortBreak', 'longBreak'].includes(active.phase)
    && active.phaseEndsAt !== null
    && active.phaseEndsAt > Date.now();
  const timerKey = canSchedule ? `${active.id}:${active.phase}:${active.phaseEndsAt}` : '';
  const nextKey = canSchedule ? `${timerKey}:${settings.soundEnabled}` : '';
  if (nextKey === currentKey) return;
  currentKey = nextKey;
  const thisRevision = ++revision;
  await cancelManagedNotifications();
  if (!canSchedule || !active || !active.phaseEndsAt || thisRevision !== revision) return;

  const permission = await Notifications.getPermissionsAsync().catch(() => null);
  if (!permission?.granted || thisRevision !== revision) return;

  const channelId = `pomodoro-${settings.soundEnabled ? 'sound' : 'silent'}-${settings.vibrationEnabled ? 'vibrate' : 'no-vibrate'}`;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: 'Pomodoro timer',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: settings.vibrationEnabled ? [0, 180, 120, 180] : [],
      sound: settings.soundEnabled ? 'default' : null,
    }).catch(() => undefined);
  }

  const isFocus = active.phase === 'focus';
  const projectedCount = completedCount + (isFocus ? 1 : 0);
  const longBreakDue = shouldTakeLongBreak(projectedCount, settings.longBreakInterval);
  const title = isFocus ? 'Pomodoro session complete!' : active.phase === 'longBreak' ? 'Your long break is over' : 'Your short break is over';
  const body = isFocus
    ? longBreakDue ? `You've completed ${settings.longBreakInterval} focus sessions. Enjoy your long break!` : 'Time for a short break. Rest your eyes and stretch.'
    : 'Your break is over. Ready to focus again?';
  const requestId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: settings.soundEnabled ? 'default' : false,
      ...(settings.vibrationEnabled ? { vibrate: [0, 180, 120, 180] } : {}),
      data: { learnbeatsPomodoro: true, timerKey, soundEnabled: settings.soundEnabled },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(active.phaseEndsAt),
      ...(Platform.OS === 'android' ? { channelId } : {}),
    },
  }).catch(() => null);
  if (thisRevision !== revision && requestId) {
    await Notifications.cancelScheduledNotificationAsync(requestId).catch(() => undefined);
    return;
  }
}

export async function cancelPomodoroNotification() {
  currentKey = '';
  revision += 1;
  await cancelManagedNotifications();
}
