import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { AuthProvider } from '@/state/auth';
import { useAppStore } from '@/state/app-store';
import { syncPomodoroNotification } from '@/features/pomodoro/notifications';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 }, mutations: { retry: 0 } } }));
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  useEffect(() => {
    if (!hasHydrated) return;
    let appIsActive = AppState.currentState === 'active';
    const initialStore = useAppStore.getState();
    initialStore.recoverPomodoro();
    if (appIsActive) useAppStore.getState().notePomodoroForeground();
    const subscription = AppState.addEventListener('change', (nextState) => {
      appIsActive = nextState === 'active';
      const store = useAppStore.getState();
      if (!appIsActive) {
        const active = store.activePomodoro;
        if (active?.phase === 'focus' && active.status === 'running') store.notePomodoroBackground();
        else store.pauseStudySession();
      } else {
        store.notePomodoroForeground();
      }
    });
    const checkpoint = setInterval(() => {
      if (appIsActive) useAppStore.getState().checkpointStudySession();
    }, 30_000);
    const timer = setInterval(() => {
      const active = useAppStore.getState().activePomodoro;
      if (active?.status === 'running' && active.phaseEndsAt !== null && Date.now() >= active.phaseEndsAt) {
        useAppStore.getState().completePomodoroPhase(Date.now());
      }
    }, 1000);
    return () => { subscription.remove(); clearInterval(checkpoint); clearInterval(timer); };
  }, [hasHydrated]);
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const timerNotification = notification.request.content.data?.learnbeatsPomodoro === true;
        const requestedSound = notification.request.content.data?.soundEnabled === true;
        return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: timerNotification && requestedSound, shouldSetBadge: false };
      },
    });
    const sync = () => {
      const state = useAppStore.getState();
      const active = state.activePomodoro;
      const settings = active ? state.getPomodoroSettings(active.userId) : state.getPomodoroSettings('');
      const completedCount = active ? state.pomodoroFocusRecords.filter((record) => record.userId === active.userId && record.status === 'completed').length : 0;
      void syncPomodoroNotification(active, settings, completedCount);
    };
    sync();
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (state.activePomodoro !== previous.activePomodoro || state.pomodoroSettings !== previous.pomodoroSettings || state.pomodoroFocusRecords !== previous.pomodoroFocusRecords) sync();
      const before = previous.activePomodoro;
      const after = state.activePomodoro;
      if (before?.phase === 'focus' && before.status === 'running' && after?.id === before.id && after.status === 'awaiting') {
        const settings = state.getPomodoroSettings(before.userId);
        if (settings.vibrationEnabled && (Platform.OS === 'android' || Platform.OS === 'ios')) Vibration.vibrate([0, 180, 120, 180]);
      }
    });
    return () => { unsubscribe(); Notifications.setNotificationHandler(null); };
  }, []);
  return <QueryClientProvider client={queryClient}><AuthProvider>
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="whiteboard" />
        <Stack.Screen name="focus" options={{ animation: 'fade', gestureEnabled: true }} />
        <Stack.Screen name="song/[id]" />
        <Stack.Screen name="quiz/[id]" />
        <Stack.Screen name="artifact/[id]" />
        <Stack.Screen name="community/ask" />
        <Stack.Screen name="community/saved" />
        <Stack.Screen name="community/notifications" />
        <Stack.Screen name="community/profile/[id]" />
        <Stack.Screen name="community/[id]" />
      </Stack>
    </SafeAreaProvider>
  </AuthProvider></QueryClientProvider>;
}
