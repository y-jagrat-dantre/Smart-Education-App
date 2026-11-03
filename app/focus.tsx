import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePreventRemove } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle } from 'react-native-svg';
import { colors, radii } from '@/theme/colors';
import { ActionButton, Card, Eyebrow } from '@/components/ui';
import { defaultPomodoroSettings, useAppStore } from '@/state/app-store';
import { useAuth } from '@/state/auth';
import { localDayStart, studyTimeBetween } from '@/features/progress/metrics';
import { formatPomodoroClock, isPomodoroExpired, pomodoroProgress, remainingPomodoroMs, shouldTakeLongBreak } from '@/features/pomodoro/timer';

const motivation = ['Stay focused. One step at a time.', "You're making progress!", 'Keep going. Your goal is within reach.'];

function formatAway(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes} minute${minutes === 1 ? '' : 's'} and ${rest} second${rest === 1 ? '' : 's'}` : `${rest} second${rest === 1 ? '' : 's'}`;
}

export default function FocusScreen() {
  const { user, ready: authReady } = useAuth();
  const userId = user?.id ?? '';
  const { width } = useWindowDimensions();
  const size = Math.min(Math.max(230, width - 84), 324);
  const allSongs = useAppStore((state) => state.songs);
  const studySessions = useAppStore((state) => state.studySessions);
  const activePomodoroState = useAppStore((state) => state.activePomodoro);
  const activeStudyState = useAppStore((state) => state.activeStudySession);
  const focusRecords = useAppStore((state) => state.pomodoroFocusRecords);
  const settingsByUser = useAppStore((state) => state.pomodoroSettings);
  const pomodoroSettings = settingsByUser?.[userId] ?? defaultPomodoroSettings;
  const settings = useAppStore((state) => state.getPomodoroSettings);
  const startFocus = useAppStore((state) => state.startPomodoroFocus);
  const pausePomodoro = useAppStore((state) => state.pausePomodoro);
  const resumePomodoro = useAppStore((state) => state.resumePomodoro);
  const startBreak = useAppStore((state) => state.startPomodoroBreak);
  const skipBreak = useAppStore((state) => state.skipPomodoroBreak);
  const endPomodoro = useAppStore((state) => state.endPomodoro);
  const updateSettings = useAppStore((state) => state.updatePomodoroSettings);
  const dismissReturnNotice = useAppStore((state) => state.dismissPomodoroReturnNotice);
  const allPomodoroBreakRecords = useAppStore((state) => state.pomodoroBreakRecords);

  const songs = useMemo(() => allSongs.filter((song) => song.ownerId === userId), [allSongs, userId]);
  const active = activePomodoroState?.userId === userId ? activePomodoroState : null;
  const userRecords = useMemo(() => focusRecords.filter((record) => record.userId === userId), [focusRecords, userId]);
  const completedCount = userRecords.filter((record) => record.status === 'completed').length;
  const longBreakDue = shouldTakeLongBreak(completedCount, pomodoroSettings.longBreakInterval);

  const [now, setNow] = useState(Date.now());
  const [selectedSongId, setSelectedSongId] = useState(songs[0]?.id ?? '');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveWarning, setLeaveWarning] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [endInPlace, setEndInPlace] = useState(false);
  const [notificationInfo, setNotificationInfo] = useState('');
  const [repeatNavigation, setRepeatNavigation] = useState<(() => void) | null>(null);
  const todayStart = localDayStart(now);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const completedToday = userRecords.filter((record) => record.status === 'completed' && record.endedAt >= todayStart).length;
  const userSessions = useMemo(() => studySessions.filter((session) => session.userId === userId), [studySessions, userId]);
  const pomodoroSessionIds = new Set(userRecords.map((record) => record.studySessionId).filter((id): id is string => !!id));
  const pomodoroSessions = userSessions.filter((session) => pomodoroSessionIds.has(session.id));
  const activeStudy = activeStudyState?.userId === userId ? activeStudyState : null;

  useEffect(() => {
    if (!selectedSongId && songs[0]) setSelectedSongId(songs[0].id);
  }, [selectedSongId, songs]);
  useEffect(() => {
    if (authReady && !user) router.replace('/login');
  }, [authReady, user]);

  useEffect(() => {
    const tick = () => {
      const timestamp = Date.now();
      setNow(timestamp);
      const current = useAppStore.getState().activePomodoro;
      if (current?.phase === 'focus' || current?.phase === 'shortBreak' || current?.phase === 'longBreak') {
        if (isPomodoroExpired(current.status, current.phaseEndsAt, timestamp)) {
          useAppStore.getState().completePomodoroPhase(timestamp);
        }
      }
    };
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, []);

  const remaining = !active ? 0 : remainingPomodoroMs(active.status, active.phaseEndsAt, active.remainingMs, now);
  const isFocus = active?.phase === 'focus';
  const isBreak = active?.phase === 'shortBreak' || active?.phase === 'longBreak';
  const isRunningFocus = isFocus && active.status === 'running';
  const preventRemove = !!isRunningFocus;

  usePreventRemove(preventRemove, ({ repeat }) => {
    setEndInPlace(false);
    setRepeatNavigation(() => repeat);
    setLeaveWarning(true);
  });

  useEffect(() => {
    if (!active || active.status !== 'awaiting') return;
    if (active.phase === 'focusComplete' && pomodoroSettings.autoStartBreaks) {
      startBreak(userId, longBreakDue ? 'longBreak' : 'shortBreak');
    } else if (active.phase === 'breakComplete' && pomodoroSettings.autoStartFocus) {
      startFocus(userId, active.subject, active.topic, active.songId);
    }
  }, [active, pomodoroSettings.autoStartBreaks, pomodoroSettings.autoStartFocus, longBreakDue, startBreak, startFocus, userId]);

  const selectedSong = songs.find((song) => song.id === selectedSongId);
  const subject = active?.subject ?? selectedSong?.subject ?? 'General study';
  const topic = active?.topic ?? selectedSong?.title ?? 'Independent study';
  const phaseLabel = active?.phase === 'shortBreak' ? 'Short break' : active?.phase === 'longBreak' ? 'Long break' : isFocus ? 'Focus session' : active?.phase === 'focusComplete' ? 'Focus complete' : active?.phase === 'breakComplete' ? 'Break complete' : 'Ready to focus';
  const durationMs = active?.durationMs ?? pomodoroSettings.focusMinutes * 60_000;
  const progress = active ? pomodoroProgress(durationMs, remaining) : 0;
  const ringColor = isBreak ? colors.mint : colors.purple;
  const radius = size / 2 - 11;
  const circumference = 2 * Math.PI * radius;
  const todayFocusMs = studyTimeBetween(pomodoroSessions, isFocus ? activeStudy : null, userId, todayStart, tomorrow.getTime(), now);
  const goalMs = pomodoroSettings.dailyGoalMinutes * 60_000;
  const goalProgress = Math.min(1, todayFocusMs / Math.max(1, goalMs));

  const moveAway = useCallback(() => {
    const repeat = repeatNavigation;
    setRepeatNavigation(null);
    setLeaveWarning(false);
    setConfirmEnd(false);
    if (repeat) repeat();
    else router.back();
  }, [repeatNavigation]);

  const startSelectedFocus = () => {
    const ok = startFocus(userId, selectedSong?.subject ?? 'General study', selectedSong?.title ?? 'Independent study', selectedSong?.id);
    if (!ok) setNotificationInfo('Finish or pause your current study session before starting Focus Mode.');
    else setNotificationInfo('');
  };

  const endFocusNow = () => {
    endPomodoro(userId);
    setEndInPlace(false);
    setConfirmEnd(false);
    setNotificationInfo('Session saved. You can start another focus block whenever you are ready.');
  };

  const restartFocusNow = () => {
    const previous = active;
    if (!previous || previous.phase !== 'focus') return;
    endPomodoro(userId);
    startFocus(userId, previous.subject, previous.topic, previous.songId);
    setRestartConfirm(false);
    setNotificationInfo('Timer restarted. The previous focus time was saved as a partial session.');
  };

  const adjustMinutes = (key: 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakInterval' | 'dailyGoalMinutes', delta: number) => {
    updateSettings(userId, { [key]: settings(userId)[key] + delta });
  };

  const setBooleanSetting = (key: 'autoStartBreaks' | 'autoStartFocus' | 'returnNotificationsEnabled' | 'soundEnabled' | 'vibrationEnabled' | 'reducedMotion', value: boolean) => {
    updateSettings(userId, { [key]: value });
  };

  const toggleTimerNotifications = async () => {
    if (pomodoroSettings.notificationsEnabled) {
      updateSettings(userId, { notificationsEnabled: false });
      setNotificationInfo('Timer notifications are off.');
      return;
    }
    try {
      const Notifications = await import('expo-notifications');
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setNotificationInfo('Notification permission was not granted. Your timer will still run in the app.');
        return;
      }
      updateSettings(userId, { notificationsEnabled: true });
      setNotificationInfo('Timer notifications are on.');
    } catch {
      setNotificationInfo('Local notifications are unavailable in this app install. The timer will still run in the app.');
    }
  };

  const goBack = () => router.back();

  const dailyRingText = `${Math.min(pomodoroSettings.dailyGoalMinutes, Math.floor(todayFocusMs / 60_000))} / ${pomodoroSettings.dailyGoalMinutes} min`;
  const completedBreaksToday = allPomodoroBreakRecords.filter((record) => record.userId === userId && record.status === 'completed' && record.startedAt >= todayStart).length;
  const lineOfEncouragement = motivation[Math.floor(now / (5 * 60_000)) % motivation.length];

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.headerButton}><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable>
        <View style={styles.headerTitle}><Text style={styles.headerHeading}>Focus Mode</Text><Text style={styles.headerSub}>One clear step at a time</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Pomodoro settings" onPress={() => setSettingsOpen(true)} style={styles.headerButton}><Ionicons name="options-outline" size={20} color={colors.ink} /></Pressable>
      </View>

      {active?.returnNoticeMs !== undefined && <View style={styles.returnNotice}>
        <View style={styles.returnIcon}><Ionicons name="return-up-forward-outline" size={18} color={colors.purpleDark} /></View>
        <View style={styles.returnCopy}><Text style={styles.returnTitle}>Welcome back</Text><Text style={styles.returnText}>You were away for {formatAway(active.returnNoticeMs)}. Your focus timer kept running.</Text><View style={styles.returnActions}>
          <Pressable accessibilityRole="button" onPress={dismissReturnNotice} style={styles.returnAction}><Text style={styles.returnActionPrimary}>Resume Focus</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { pausePomodoro(); dismissReturnNotice(); }} style={styles.returnAction}><Text style={styles.returnActionText}>Pause Session</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { dismissReturnNotice(); setEndInPlace(true); setConfirmEnd(true); }} style={styles.returnAction}><Text style={styles.returnActionDanger}>End Session</Text></Pressable>
        </View></View>
      </View>}

      {active?.status === 'running' && <View style={styles.livePill}><View style={[styles.liveDot, { backgroundColor: isBreak ? colors.amber : colors.success }]} /><Text style={styles.liveText}>{isBreak ? 'BREAK TIMER RUNNING' : 'FOCUS SESSION RUNNING'}</Text></View>}
      {active?.status === 'paused' && <View style={[styles.livePill, styles.pausedPill]}><Ionicons name="pause-circle-outline" size={16} color={colors.amber} /><Text style={[styles.liveText, { color: colors.amber }]}>SESSION PAUSED</Text></View>}

      <View style={styles.subjectBlock}>
        <Eyebrow>{isBreak ? 'TAKE A MOMENT' : 'CURRENT STUDY'}</Eyebrow>
        <Text style={styles.subjectTitle} numberOfLines={1}>{subject}</Text>
        <Text style={styles.topicTitle} numberOfLines={1}>{topic}</Text>
      </View>

      <View style={[styles.timerWrap, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border} strokeWidth={9} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={ringColor} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - progress)} fill="none" rotation={-90} origin={`${size / 2}, ${size / 2}`} />
        </Svg>
        <View style={styles.timerCenter}>
          <Text style={styles.phaseText}>{phaseLabel.toUpperCase()}</Text>
          <Text accessibilityLabel={`Time remaining ${formatPomodoroClock(remaining)}`} style={[styles.clock, { fontSize: size < 270 ? 53 : 65 }]}>{formatPomodoroClock(remaining)}</Text>
          <Text style={styles.timerCaption}>{active?.status === 'paused' ? 'Paused · ready when you are' : isBreak ? 'Rest your eyes and stretch' : active?.status === 'awaiting' ? 'Nice work' : active?.status === 'running' ? 'Stay with this moment' : `${pomodoroSettings.focusMinutes} minute focus block`}</Text>
        </View>
      </View>

      {isBreak && <View style={styles.breakHint}><Ionicons name="sunny-outline" size={17} color={colors.amber} /><Text style={styles.breakHintText}>Look away from the screen, stretch, and take a drink of water.</Text></View>}
      {isRunningFocus && <Text style={styles.motivation}>{lineOfEncouragement}</Text>}

      <View style={styles.controls}>
        {!active && <ActionButton title="Start focus session" onPress={startSelectedFocus} icon={<Ionicons name="play" size={18} color="#fff" />} style={styles.primaryAction} />}
        {isFocus && active?.status === 'running' && <ActionButton title="Pause timer" onPress={() => pausePomodoro()} icon={<Ionicons name="pause" size={18} color="#fff" />} style={styles.primaryAction} />}
        {isFocus && active?.status === 'paused' && <ActionButton title="Resume focus" onPress={() => resumePomodoro(userId)} icon={<Ionicons name="play" size={18} color="#fff" />} style={styles.primaryAction} />}
        {isBreak && active?.status === 'running' && <ActionButton title="Skip break" onPress={() => skipBreak()} icon={<Ionicons name="play-skip-forward" size={18} color="#fff" />} style={styles.primaryAction} />}
        {isBreak && active?.status === 'paused' && <ActionButton title="Resume break" onPress={() => resumePomodoro(userId)} icon={<Ionicons name="play" size={18} color="#fff" />} style={styles.primaryAction} />}
        {isBreak && <Pressable accessibilityRole="button" onPress={() => { setEndInPlace(true); setConfirmEnd(true); }} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>Finish for now</Text></Pressable>}
        {isFocus && <Pressable accessibilityRole="button" onPress={() => { setEndInPlace(true); setConfirmEnd(true); }} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>End session</Text></Pressable>}
        {isFocus && <Pressable accessibilityRole="button" onPress={() => setRestartConfirm(true)} style={styles.restartAction}><Ionicons name="refresh-outline" size={15} color={colors.muted} /><Text style={styles.restartActionText}>Restart timer</Text></Pressable>}
      </View>

      {active?.phase === 'focusComplete' && <Card style={styles.completionCard}>
        <View style={styles.completionIcon}><Ionicons name="checkmark" size={21} color={colors.success} /></View>
        <Text style={styles.completionTitle}>Focus session complete!</Text>
        <Text style={styles.completionBody}>You studied {subject} for {Math.round((active.durationMs - remaining) / 60_000)} minutes. {completedToday} Pomodoro{completedToday === 1 ? '' : 's'} completed today.</Text>
        {!pomodoroSettings.autoStartBreaks && <View style={styles.completionButtons}>
          <ActionButton title={longBreakDue ? 'Start long break' : 'Start short break'} onPress={() => startBreak(userId, longBreakDue ? 'longBreak' : 'shortBreak')} icon={<Ionicons name="cafe-outline" size={17} color="#fff" />} style={styles.breakAction} />
          {!longBreakDue && <Pressable accessibilityRole="button" onPress={() => startBreak(userId, 'longBreak')} style={styles.inlineDisabled} accessibilityState={{ disabled: true }}><Text style={styles.inlineDisabledText}>Long break after {pomodoroSettings.longBreakInterval} focus sessions</Text></Pressable>}
        </View>}
        <Pressable accessibilityRole="button" onPress={() => startFocus(userId, active.subject, active.topic, active.songId)} style={styles.continueFocus}><Ionicons name="refresh-outline" size={16} color={colors.purpleDark} /><Text style={styles.continueFocusText}>Continue studying</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => endPomodoro(userId)} style={styles.finishLink}><Text style={styles.finishLinkText}>Finish for now</Text></Pressable>
      </Card>}

      {active?.phase === 'breakComplete' && <Card style={styles.completionCard}>
        <View style={styles.completionIcon}><Ionicons name="cafe-outline" size={19} color={colors.amber} /></View>
        <Text style={styles.completionTitle}>Break complete</Text>
        <Text style={styles.completionBody}>That was a good reset. Ready for another focus session?</Text>
        {!pomodoroSettings.autoStartFocus && <ActionButton title="Start another focus session" onPress={() => startFocus(userId, active.subject, active.topic, active.songId)} icon={<Ionicons name="play" size={17} color="#fff" />} style={styles.primaryAction} />}
        <Pressable accessibilityRole="button" onPress={() => endPomodoro(userId)} style={styles.finishLink}><Text style={styles.finishLinkText}>Finish for now</Text></Pressable>
      </Card>}

      {!active && <Card style={styles.chooseCard}>
        <View style={styles.chooseHead}><View style={styles.chooseIcon}><Ionicons name="book-outline" size={18} color={colors.purpleDark} /></View><View style={styles.chooseCopy}><Text style={styles.chooseTitle}>Choose what you’ll work on</Text><Text style={styles.chooseMeta}>Your focus time will be added to study progress.</Text></View></View>
        {songs.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.songChoices}>{songs.slice(0, 8).map((song) => <Pressable key={song.id} accessibilityRole="button" accessibilityState={{ selected: selectedSongId === song.id }} onPress={() => setSelectedSongId(song.id)} style={[styles.songChoice, selectedSongId === song.id && styles.songChoiceSelected]}><Text numberOfLines={1} style={[styles.songChoiceTitle, selectedSongId === song.id && styles.songChoiceTitleSelected]}>{song.title}</Text><Text numberOfLines={1} style={styles.songChoiceSubject}>{song.subject}</Text></Pressable>)}</ScrollView> : <Text style={styles.generalStudy}>No notebook needed. You can use a general study session.</Text>}
      </Card>}

      {(active?.phase === 'focus' || !active) && <Card style={styles.goalCard}>
        <View style={styles.goalHeader}><View><Eyebrow>DAILY FOCUS GOAL</Eyebrow><Text style={styles.goalValue}>{dailyRingText}</Text></View><View style={styles.goalBadge}><Ionicons name="checkmark-circle-outline" size={18} color={colors.success} /><Text style={styles.goalBadgeText}>{Math.round(goalProgress * 100)}%</Text></View></View>
        <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${goalProgress * 100}%` }]} /></View>
        <View style={styles.goalFooter}><Text style={styles.goalMeta}>{completedToday} focus blocks completed</Text><Text style={styles.goalMeta}>{completedBreaksToday} breaks taken</Text></View>
      </Card>}

      {notificationInfo ? <Text accessibilityLiveRegion="polite" style={styles.infoText}>{notificationInfo}</Text> : null}
    </ScrollView>

    <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
      <View style={styles.modalShade}><View style={styles.settingsSheet}>
        <View style={styles.sheetHeader}><View><Eyebrow>POMODORO</Eyebrow><Text style={styles.sheetTitle}>Focus settings</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={() => setSettingsOpen(false)} style={styles.closeButton}><Ionicons name="close" size={19} color={colors.ink} /></Pressable></View>
        <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsRows}>
          <SettingStepper title="Focus duration" value={pomodoroSettings.focusMinutes} unit="min" onMinus={() => adjustMinutes('focusMinutes', -1)} onPlus={() => adjustMinutes('focusMinutes', 1)} />
          <SettingStepper title="Short break" value={pomodoroSettings.shortBreakMinutes} unit="min" onMinus={() => adjustMinutes('shortBreakMinutes', -1)} onPlus={() => adjustMinutes('shortBreakMinutes', 1)} />
          <SettingStepper title="Long break" value={pomodoroSettings.longBreakMinutes} unit="min" onMinus={() => adjustMinutes('longBreakMinutes', -1)} onPlus={() => adjustMinutes('longBreakMinutes', 1)} />
          <SettingStepper title="Long break after" value={pomodoroSettings.longBreakInterval} unit="sessions" onMinus={() => adjustMinutes('longBreakInterval', -1)} onPlus={() => adjustMinutes('longBreakInterval', 1)} />
          <SettingStepper title="Daily focus goal" value={pomodoroSettings.dailyGoalMinutes} unit="min" step={10} onMinus={() => adjustMinutes('dailyGoalMinutes', -10)} onPlus={() => adjustMinutes('dailyGoalMinutes', 10)} />
          <SettingToggle title="Auto-start breaks" value={pomodoroSettings.autoStartBreaks} onChange={(value) => setBooleanSetting('autoStartBreaks', value)} />
          <SettingToggle title="Auto-start focus after break" value={pomodoroSettings.autoStartFocus} onChange={(value) => setBooleanSetting('autoStartFocus', value)} />
          <SettingToggle title="Notify me when a timer ends" value={pomodoroSettings.notificationsEnabled} onChange={() => { void toggleTimerNotifications(); }} />
          <SettingToggle title="Show return-from-app notice" value={pomodoroSettings.returnNotificationsEnabled} onChange={(value) => setBooleanSetting('returnNotificationsEnabled', value)} />
          <SettingToggle title="Sound on timer completion" value={pomodoroSettings.soundEnabled} onChange={(value) => setBooleanSetting('soundEnabled', value)} />
          <SettingToggle title="Vibrate on timer completion" value={pomodoroSettings.vibrationEnabled} onChange={(value) => setBooleanSetting('vibrationEnabled', value)} />
          <SettingToggle title="Reduce motion" value={pomodoroSettings.reducedMotion} onChange={(value) => setBooleanSetting('reducedMotion', value)} />
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={() => setSettingsOpen(false)} style={styles.doneButton}><Text style={styles.doneText}>Done</Text></Pressable>
      </View></View>
    </Modal>

    <Modal visible={leaveWarning} transparent animationType="fade" onRequestClose={() => setLeaveWarning(false)}>
      <View style={styles.modalShade}><View style={styles.dialog}>
        <View style={styles.dialogIcon}><Ionicons name="hourglass-outline" size={22} color={colors.purpleDark} /></View>
        <Text style={styles.dialogTitle}>Focus Session in Progress</Text>
        <Text style={styles.dialogBody}>Your study session is still running. Leaving now may interrupt your focus. What would you like to do?</Text>
        <Pressable accessibilityRole="button" onPress={() => { setLeaveWarning(false); setRepeatNavigation(null); }} style={styles.dialogPrimary}><Text style={styles.dialogPrimaryText}>Continue Studying</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { pausePomodoro(); moveAway(); }} style={styles.dialogSecondary}><Text style={styles.dialogSecondaryText}>Pause & Leave</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setLeaveWarning(false); setConfirmEnd(true); }} style={styles.dialogDestructive}><Text style={styles.dialogDestructiveText}>End Session & Leave</Text></Pressable>
      </View></View>
    </Modal>

    <Modal visible={confirmEnd} transparent animationType="fade" onRequestClose={() => setConfirmEnd(false)}>
      <View style={styles.modalShade}><View style={styles.dialog}>
        <View style={[styles.dialogIcon, { backgroundColor: colors.softPeach }]}><Ionicons name="stop-outline" size={22} color={colors.danger} /></View>
        <Text style={styles.dialogTitle}>End this session?</Text>
        <Text style={styles.dialogBody}>Your active study time will be saved. Paused time and breaks will not be counted.</Text>
        <Pressable accessibilityRole="button" onPress={() => { if (endInPlace) endFocusNow(); else { endPomodoro(userId); moveAway(); } }} style={styles.dialogDestructive}><Text style={styles.dialogDestructiveText}>{endInPlace ? 'End session' : 'End session & leave'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setConfirmEnd(false)} style={styles.dialogSecondary}><Text style={styles.dialogSecondaryText}>Keep studying</Text></Pressable>
      </View></View>
    </Modal>

    <Modal visible={restartConfirm} transparent animationType="fade" onRequestClose={() => setRestartConfirm(false)}>
      <View style={styles.modalShade}><View style={styles.dialog}>
        <View style={styles.dialogIcon}><Ionicons name="refresh-outline" size={21} color={colors.purpleDark} /></View>
        <Text style={styles.dialogTitle}>Restart the focus timer?</Text>
        <Text style={styles.dialogBody}>This block will be saved as a partial session, then a fresh focus timer will start with your current settings.</Text>
        <Pressable accessibilityRole="button" onPress={restartFocusNow} style={styles.dialogPrimary}><Text style={styles.dialogPrimaryText}>Restart timer</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setRestartConfirm(false)} style={styles.dialogSecondary}><Text style={styles.dialogSecondaryText}>Keep current timer</Text></Pressable>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

function SettingStepper({ title, value, unit, step = 1, onMinus, onPlus }: { title: string; value: number; unit: string; step?: number; onMinus: () => void; onPlus: () => void }) {
  return <View style={styles.settingRow}><View style={styles.settingCopy}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingMeta}>{value} {unit}</Text></View><View style={styles.stepper}><Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${title}`} onPress={onMinus} style={styles.stepperButton}><Ionicons name="remove" size={17} color={colors.ink} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Increase ${title}`} onPress={onPlus} style={styles.stepperButton}><Ionicons name="add" size={17} color={colors.ink} /></Pressable></View></View>;
}

function SettingToggle({ title, value, onChange }: { title: string; value: boolean; onChange: (value: boolean) => void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.settingRow}><Text style={styles.settingTitle}>{title}</Text><View style={[styles.toggle, value && styles.toggleOn]}><View style={[styles.toggleKnob, value && styles.toggleKnobOn]} /></View></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  page: { width: '100%', maxWidth: 650, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 34, gap: 17, alignItems: 'center' },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 1 },
  headerButton: { width: 43, height: 43, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1 },
  headerHeading: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  headerSub: { color: colors.muted, fontSize: 10, marginTop: 2 },
  livePill: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.softMint },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { color: colors.success, fontSize: 9, fontWeight: '900', letterSpacing: 0.85 },
  pausedPill: { backgroundColor: colors.softYellow },
  subjectBlock: { alignItems: 'center', gap: 4, marginTop: 1, maxWidth: '100%' },
  subjectTitle: { maxWidth: '100%', color: colors.ink, fontSize: 23, lineHeight: 28, fontWeight: '800', letterSpacing: -0.45, textAlign: 'center' },
  topicTitle: { maxWidth: '100%', color: colors.muted, fontSize: 12, textAlign: 'center' },
  timerWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 1 },
  timerCenter: { position: 'absolute', top: 10, bottom: 10, left: 10, right: 10, alignItems: 'center', justifyContent: 'center', gap: 5 },
  phaseText: { color: colors.purpleDark, fontSize: 9, fontWeight: '900', letterSpacing: 1.45 },
  clock: { color: colors.ink, fontWeight: '800', letterSpacing: -3, fontVariant: ['tabular-nums'] },
  timerCaption: { maxWidth: 190, color: colors.muted, fontSize: 10, textAlign: 'center', lineHeight: 14 },
  motivation: { color: colors.purpleDark, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: -4 },
  controls: { width: '100%', maxWidth: 370, gap: 8 },
  primaryAction: { width: '100%', minHeight: 52 },
  secondaryAction: { minHeight: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  secondaryActionText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  chooseCard: { width: '100%', padding: 14, gap: 12 },
  chooseHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chooseIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.softPurple, justifyContent: 'center', alignItems: 'center' },
  chooseCopy: { flex: 1, gap: 3 },
  chooseTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  chooseMeta: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  songChoices: { gap: 8, paddingVertical: 1 },
  songChoice: { width: 142, minHeight: 58, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas, justifyContent: 'center', gap: 4 },
  songChoiceSelected: { backgroundColor: colors.softMint, borderColor: colors.purple },
  songChoiceTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  songChoiceTitleSelected: { color: colors.purpleDark },
  songChoiceSubject: { color: colors.muted, fontSize: 9 },
  generalStudy: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  goalCard: { width: '100%', padding: 14, gap: 9 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalValue: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 2 },
  goalBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 30, paddingHorizontal: 9, borderRadius: 11, backgroundColor: colors.softMint },
  goalBadgeText: { color: colors.success, fontSize: 10, fontWeight: '900' },
  goalTrack: { height: 7, overflow: 'hidden', borderRadius: 9, backgroundColor: colors.border },
  goalFill: { height: '100%', borderRadius: 9, backgroundColor: colors.purple },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  goalMeta: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  breakHint: { maxWidth: 350, minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.softYellow },
  breakHintText: { flex: 1, color: '#74511A', fontSize: 10, lineHeight: 14 },
  completionCard: { width: '100%', alignItems: 'center', padding: 18, gap: 10 },
  completionIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softMint },
  completionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  completionBody: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  completionButtons: { width: '100%', gap: 8, marginTop: 4 },
  breakAction: { width: '100%', minHeight: 48, backgroundColor: colors.midnight },
  inlineDisabled: { alignItems: 'center', padding: 6 },
  inlineDisabledText: { color: colors.muted, fontSize: 9 },
  continueFocus: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 13, backgroundColor: colors.softPurple },
  continueFocusText: { color: colors.purpleDark, fontSize: 11, fontWeight: '800' },
  finishLink: { paddingVertical: 6, paddingHorizontal: 12 },
  finishLinkText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  returnNotice: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 15, backgroundColor: colors.softMint },
  returnIcon: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D4E7D3' },
  returnCopy: { flex: 1, gap: 2 },
  returnTitle: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  returnText: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  returnActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  returnAction: { minHeight: 27, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#D8EADC' },
  returnActionPrimary: { color: colors.purpleDark, fontSize: 8, fontWeight: '900' },
  returnActionText: { color: colors.ink, fontSize: 8, fontWeight: '800' },
  returnActionDanger: { color: colors.danger, fontSize: 8, fontWeight: '800' },
  restartAction: { minHeight: 39, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  restartActionText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  infoText: { color: colors.purpleDark, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  modalShade: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 22, backgroundColor: 'rgba(13, 35, 31, 0.42)' },
  dialog: { width: '100%', maxWidth: 400, padding: 21, gap: 11, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'stretch' },
  dialogIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple, alignSelf: 'center', marginBottom: 2 },
  dialogTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  dialogBody: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginBottom: 2 },
  dialogPrimary: { minHeight: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: colors.purple },
  dialogPrimaryText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  dialogSecondary: { minHeight: 43, justifyContent: 'center', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas },
  dialogSecondaryText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  dialogDestructive: { minHeight: 43, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: colors.softPeach },
  dialogDestructiveText: { color: colors.danger, fontSize: 11, fontWeight: '800' },
  settingsSheet: { width: '100%', maxWidth: 480, maxHeight: '92%', padding: 19, gap: 10, borderRadius: 24, backgroundColor: colors.surface },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 3 },
  closeButton: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  settingsScroll: { flexShrink: 1 },
  settingsRows: { paddingVertical: 5 },
  settingRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EDF1ED' },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: '700' },
  settingMeta: { color: colors.muted, fontSize: 9 },
  stepper: { flexDirection: 'row', gap: 7 },
  stepperButton: { width: 34, height: 34, borderRadius: 11, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.softPurple },
  toggle: { width: 42, height: 25, borderRadius: 13, justifyContent: 'center', padding: 3, backgroundColor: '#D9E1DB' },
  toggleOn: { backgroundColor: colors.purple },
  toggleKnob: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.white },
  toggleKnobOn: { alignSelf: 'flex-end' },
  doneButton: { minHeight: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 15, backgroundColor: colors.purple },
  doneText: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
