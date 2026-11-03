import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActionButton, AppScreen, Card, Chip, Eyebrow, SectionTitle, uiStyles } from '@/components/ui';
import { colors, radii } from '@/theme/colors';
import { useAppStore, type StudySong, type TopicProgressStatus } from '@/state/app-store';
import { useAuth } from '@/state/auth';
import {
  activeDurationMs,
  buildStudyBuckets,
  calculateStreaks,
  completionBuckets,
  dailyStudyMap,
  formatStudyDuration,
  localDateKey,
  localDayStart,
  splitIntoMonthWeeks,
  startOfLocalWeek,
  studyTimeBetween,
  studyTimeBySubjectBetween,
  type StudyRange,
} from '@/features/progress/metrics';

const statusOptions: { value: TopicProgressStatus; label: string; icon: string; color: string; bg: string }[] = [
  { value: 'notStarted', label: 'Not started', icon: 'ellipse-outline', color: colors.muted, bg: colors.canvas },
  { value: 'inProgress', label: 'In progress', icon: 'time-outline', color: colors.purpleDark, bg: colors.softPurple },
  { value: 'completed', label: 'Completed', icon: 'checkmark-circle-outline', color: colors.success, bg: colors.softMint },
  { value: 'needsRevision', label: 'Needs revision', icon: 'refresh-outline', color: '#9A6208', bg: colors.softYellow },
];

export default function ProgressScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const allSongs = useAppStore((state) => state.songs);
  const progress = useAppStore((state) => state.topicProgress);
  const progressEvents = useAppStore((state) => state.topicProgressEvents);
  const sessions = useAppStore((state) => state.studySessions);
  const activeSession = useAppStore((state) => state.activeStudySession);
  const activePomodoroState = useAppStore((state) => state.activePomodoro);
  const pomodoroRecords = useAppStore((state) => state.pomodoroFocusRecords);
  const pomodoroBreakRecords = useAppStore((state) => state.pomodoroBreakRecords);
  const attempts = useAppStore((state) => state.quizAttempts);
  const studyGoals = useAppStore((state) => state.studyGoals);
  const dailyGoalMinutes = studyGoals?.[userId]?.dailyGoalMinutes ?? 30;
  const weeklyGoalMinutes = studyGoals?.[userId]?.weeklyGoalMinutes ?? 180;
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const setDailyGoalMinutes = useAppStore((state) => state.setDailyGoalMinutes);
  const setWeeklyGoalMinutes = useAppStore((state) => state.setWeeklyGoalMinutes);
  const startStudySession = useAppStore((state) => state.startStudySession);
  const pauseStudySession = useAppStore((state) => state.pauseStudySession);
  const resumeStudySession = useAppStore((state) => state.resumeStudySession);
  const completeStudySession = useAppStore((state) => state.completeStudySession);
  const setTopicStatus = useAppStore((state) => state.setTopicStatus);

  const [now, setNow] = useState(Date.now());
  const [range, setRange] = useState<StudyRange>('daily');
  const [selectedBucketKey, setSelectedBucketKey] = useState('');
  const [selectedHeatmapKey, setSelectedHeatmapKey] = useState(localDateKey(Date.now()));
  const [expandedSubject, setExpandedSubject] = useState('');
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [statusSong, setStatusSong] = useState<StudySong | null>(null);
  const [selectedSongId, setSelectedSongId] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [revisionSession, setRevisionSession] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => { setNow(Date.now()); }, [activeSession]);

  const songs = useMemo(() => allSongs.filter((song) => song.ownerId === userId), [allSongs, userId]);
  const userSessions = useMemo(() => sessions.filter((session) => session.userId === userId), [sessions, userId]);
  const userAttempts = useMemo(() => attempts.filter((attempt) => attempt.userId === userId), [attempts, userId]);
  const ownedActiveSession = activeSession?.userId === userId ? activeSession : null;
  const ownedPomodoro = activePomodoroState?.userId === userId ? activePomodoroState : null;
  const userPomodoroRecords = useMemo(() => pomodoroRecords.filter((record) => record.userId === userId), [pomodoroRecords, userId]);
  const completedPomodoros = userPomodoroRecords.filter((record) => record.status === 'completed');
  const partialPomodoros = userPomodoroRecords.filter((record) => record.status === 'partial');
  const averagePomodoroMs = completedPomodoros.length ? completedPomodoros.reduce((sum, record) => sum + record.activeDurationMs, 0) / completedPomodoros.length : 0;
  const topicStatus = (song: StudySong) => progress[song.id]?.userId === userId ? progress[song.id].status : 'notStarted';
  const completedTopics = songs.filter((song) => topicStatus(song) === 'completed').length;
  const remainingTopics = Math.max(0, songs.length - completedTopics);
  const progressPercent = songs.length ? Math.round((completedTopics / songs.length) * 100) : 0;
  const topicsAt = songs.map((song) => ({ id: song.id, createdAt: Date.parse(song.createdAt) || 0 }));
  const todayStart = localDayStart(now);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = startOfLocalWeek(now);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const totalStudyMs = studyTimeBetween(userSessions, ownedActiveSession, userId, 0, now, now);
  const todayStudyMs = studyTimeBetween(userSessions, ownedActiveSession, userId, todayStart, tomorrow.getTime(), now);
  const weekStudyMs = studyTimeBetween(userSessions, ownedActiveSession, userId, weekStart, nextWeek.getTime(), now);
  const previousWeekMs = studyTimeBetween(userSessions, null, userId, lastWeekStart.getTime(), weekStart, now);
  const streaks = calculateStreaks(userSessions, userId, now, ownedActiveSession);
  const completedSessionCount = new Set(userSessions.map((session) => session.id)).size;
  const subjectsStudied = new Set(userSessions.filter((session) => session.durationMs > 0).map((session) => session.subject)).size + (ownedActiveSession && activeDurationMs(ownedActiveSession, userId, now) > 0 && !userSessions.some((session) => session.subject === ownedActiveSession.subject) ? 1 : 0);
  const dailyGoalMs = dailyGoalMinutes * 60_000;
  const weeklyGoalMs = weeklyGoalMinutes * 60_000;
  const dailyGoalProgress = Math.min(1, todayStudyMs / Math.max(1, dailyGoalMs));
  const weeklyGoalProgress = Math.min(1, weekStudyMs / Math.max(1, weeklyGoalMs));
  const pomodoroSessionIds = new Set(userPomodoroRecords.map((record) => record.studySessionId).filter((id): id is string => !!id));
  const pomodoroSessions = userSessions.filter((session) => pomodoroSessionIds.has(session.id));
  const activePomodoroStudy = ownedPomodoro?.phase === 'focus' ? ownedActiveSession : null;
  const pomodoroTodayMs = studyTimeBetween(pomodoroSessions, activePomodoroStudy, userId, todayStart, tomorrow.getTime(), now);
  const pomodoroWeekMs = studyTimeBetween(pomodoroSessions, activePomodoroStudy, userId, weekStart, nextWeek.getTime(), now);
  const pomodoroTotalMs = studyTimeBetween(pomodoroSessions, activePomodoroStudy, userId, 0, now, now);
  const abandonedPomodoros = userPomodoroRecords.filter((record) => record.status === 'abandoned').length;
  const endedPomodoros = completedPomodoros.length + userPomodoroRecords.filter((record) => record.status !== 'completed').length;
  const pomodoroCompletionRate = endedPomodoros ? Math.round(completedPomodoros.length / endedPomodoros * 100) : 0;
  const pomodoroStartedCount = userPomodoroRecords.length + (ownedPomodoro?.phase === 'focus' && (ownedPomodoro.status === 'running' || ownedPomodoro.status === 'paused') ? 1 : 0);
  const completedShortBreaks = pomodoroBreakRecords.filter((record) => record.userId === userId && record.phase === 'shortBreak' && record.status === 'completed').length;
  const completedLongBreaks = pomodoroBreakRecords.filter((record) => record.userId === userId && record.phase === 'longBreak' && record.status === 'completed').length;

  const chartBuckets = buildStudyBuckets(range, now).map((bucket) => ({
    ...bucket,
    durationMs: studyTimeBetween(userSessions, ownedActiveSession, userId, bucket.start, bucket.end, now),
  }));
  const selectedBucket = chartBuckets.find((bucket) => bucket.key === selectedBucketKey) ?? chartBuckets[chartBuckets.length - 1];
  const dayMap = useMemo(() => dailyStudyMap(userSessions, ownedActiveSession, userId, 365, now), [userSessions, ownedActiveSession, userId, now]);
  const heatmapWeeks = useMemo(() => splitIntoMonthWeeks(now, 365), [now]);
  const selectedHeatmapMs = dayMap.get(selectedHeatmapKey) ?? 0;
  const progressBuckets = completionBuckets(progressEvents, topicsAt, userId, now);
  const rangeLabel = range === 'daily' ? 'Last 7 days' : range === 'weekly' ? 'Last 4 weeks' : 'Last 6 months';

  const subjectNames = [...new Set([...songs.map((song) => song.subject.trim()).filter(Boolean), ...userSessions.map((session) => session.subject.trim()).filter(Boolean)])];
  const subjectTimeMap = studyTimeBySubjectBetween(userSessions, ownedActiveSession, userId, 0, now, now);
  const weekSubjectTimeMap = studyTimeBySubjectBetween(userSessions, ownedActiveSession, userId, weekStart, now, now);
  const pomodoroSubjectTimeMap = studyTimeBySubjectBetween(pomodoroSessions, activePomodoroStudy, userId, 0, now, now);
  const pomodoroSubjectRows = [...pomodoroSubjectTimeMap.entries()].filter(([, duration]) => duration > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const subjectRows = subjectNames.map((subject) => {
    const subjectSongs = songs.filter((song) => song.subject.trim() === subject);
    const subjectSessions = userSessions.filter((session) => session.subject === subject);
    const currentMatches = ownedActiveSession?.subject === subject ? ownedActiveSession : null;
    const completed = subjectSongs.filter((song) => topicStatus(song) === 'completed').length;
    const lastStudied = currentMatches ? now : [...subjectSessions].sort((a, b) => b.endedAt - a.endedAt)[0]?.endedAt ?? 0;
    const totalMs = subjectTimeMap.get(subject) ?? 0;
    return { subject, songs: subjectSongs, completed, totalMs, lastStudied };
  }).sort((a, b) => b.totalMs - a.totalMs || a.subject.localeCompare(b.subject));
  const subjectStudyTotals = subjectNames.map((subject) => ({ subject, duration: subjectTimeMap.get(subject) ?? 0 })).sort((a, b) => b.duration - a.duration);
  const allSubjectTime = subjectStudyTotals.reduce((sum, item) => sum + item.duration, 0);
  const weekSubjectTotals = subjectNames.map((subject) => ({ subject, duration: weekSubjectTimeMap.get(subject) ?? 0 })).filter((item) => item.duration > 0).sort((a, b) => b.duration - a.duration);

  const revisionSongs = songs.filter((song) => topicStatus(song) === 'needsRevision');
  const revisionSessionCount = userSessions.filter((session) => session.wasRevision).length;
  const quizMisses = userAttempts.filter((attempt) => attempt.incorrectPoints.length > 0 && songs.some((song) => song.id === attempt.songId));
  const reviewSongIds = new Set([...revisionSongs.map((song) => song.id), ...quizMisses.map((attempt) => attempt.songId)]);
  const completedSubjects = subjectRows.filter((row) => row.songs.length > 0 && row.completed === row.songs.length).length;
  const latestAttemptsBySong = new Map<string, typeof userAttempts>();
  for (const attempt of userAttempts) {
    const list = latestAttemptsBySong.get(attempt.songId) ?? [];
    list.push(attempt);
    latestAttemptsBySong.set(attempt.songId, list);
  }
  const quizImprovements = [...latestAttemptsBySong.entries()].map(([songId, list]) => {
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
    const previous = sorted[sorted.length - 2];
    const latest = sorted[sorted.length - 1];
    return previous && latest ? { songId, previous, latest, delta: Math.round((latest.score / Math.max(1, latest.questionCount) - previous.score / Math.max(1, previous.questionCount)) * 100) } : null;
  }).filter((item): item is NonNullable<typeof item> => !!item).sort((a, b) => b.latest.createdAt - a.latest.createdAt);
  const recentQuizAttempts = [...userAttempts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  const milestones = [
    { title: 'First study session', detail: 'Complete one timer session', done: completedSessionCount >= 1 },
    { title: 'Five hours studied', detail: 'Build a steady study habit', done: totalStudyMs >= 5 * 60 * 60_000 },
    { title: 'Ten hours studied', detail: 'Keep a balanced, steady rhythm', done: totalStudyMs >= 10 * 60 * 60_000 },
    { title: 'Seven day streak', detail: 'Study at least 5 minutes each day', done: streaks.longestStreak >= 7 },
    { title: 'Thirty day streak', detail: 'Build a month of consistent practice', done: streaks.longestStreak >= 30 },
    { title: 'First subject completed', detail: 'Finish every notebook in one subject', done: completedSubjects >= 1 },
    { title: 'One hundred topics', detail: 'Mark 100 notebooks completed', done: completedTopics >= 100 },
  ];

  const openStartModal = (song?: StudySong) => {
    const initial = song ?? songs[0];
    setSelectedSongId(initial?.id ?? '');
    setSubjectInput(initial?.subject ?? '');
    setTopicInput(initial?.title ?? '');
    setRevisionSession(song ? topicStatus(song) === 'needsRevision' : false);
    setStartModalVisible(true);
  };
  const selectSessionSong = (songId: string) => {
    setSelectedSongId(songId);
    const song = songs.find((item) => item.id === songId);
    if (song) {
      setSubjectInput(song.subject);
      setTopicInput(song.title);
    }
  };
  const startSession = () => {
    if (!userId) return;
    const chosenSong = songs.find((song) => song.id === selectedSongId);
    const started = startStudySession({ userId, subject: subjectInput, topic: topicInput, ...(chosenSong ? { songId: chosenSong.id } : {}), wasRevision: revisionSession });
    if (!started) {
      Alert.alert('Study session not started', 'Enter a subject and topic, or finish your current session first.');
      return;
    }
    setStartModalVisible(false);
  };
  const endSession = () => {
    if (!ownedActiveSession) return;
    const saved = completeStudySession(userId);
    if (!saved) Alert.alert('No study time saved', 'The session ended before any active time was recorded.');
  };
  const changeStatus = (status: TopicProgressStatus) => {
    if (statusSong && userId) setTopicStatus(statusSong.id, userId, status);
    setStatusSong(null);
  };
  const setRangeWithLatestBucket = (next: StudyRange) => {
    setRange(next);
    setSelectedBucketKey('');
  };

  if (!hasHydrated) return <AppScreen><Card style={styles.loadingCard}><View style={styles.loadingMark}><Ionicons name="stats-chart-outline" size={20} color={colors.purpleDark} /></View><Text style={styles.emptyTitle}>Loading your saved progress</Text><View style={styles.loadingLine} /><View style={[styles.loadingLine, styles.loadingLineShort]} /></Card></AppScreen>;

  return <AppScreen>
    <View style={styles.header}>
      <View style={styles.headerIcon}><Ionicons name="stats-chart" size={18} color={colors.lime} /></View>
      <View style={styles.headerCopy}><Eyebrow>YOUR LEARNING HABITS</Eyebrow><Text style={uiStyles.heading}>Your progress</Text><Text style={uiStyles.body}>A clear view of the time and topics you have tracked.</Text></View>
    </View>

    <View style={styles.summaryGrid}>
      <SummaryCard icon="time-outline" tone="purple" label="STUDIED TODAY" value={formatStudyDuration(todayStudyMs)} caption={`${formatStudyDuration(weekStudyMs)} this week`} />
      <SummaryCard icon="checkmark-done-outline" tone="mint" label="TOPICS DONE" value={`${completedTopics} / ${songs.length}`} caption={`${remainingTopics} remaining · ${progressPercent}%`} />
      <SummaryCard icon="flame-outline" tone="peach" label="CURRENT STREAK" value={`${streaks.currentStreak} ${streaks.currentStreak === 1 ? 'day' : 'days'}`} caption={`Best: ${streaks.longestStreak} days`} />
      <Card style={styles.summaryCard}>
        <View style={styles.summaryHead}><View style={[styles.summaryIcon, { backgroundColor: colors.softYellow }]}><Ionicons name="flag-outline" size={17} color={colors.amber} /></View><Text style={styles.summaryLabel}>DAILY GOAL</Text></View>
        <Text style={styles.summaryValue}>{formatStudyDuration(todayStudyMs)} <Text style={styles.goalSlash}>/ {dailyGoalMinutes}m</Text></Text>
        <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${dailyGoalProgress * 100}%` }]} /></View>
        <Text style={styles.summaryCaption}>{dailyGoalProgress >= 1 ? 'Goal reached for today' : `${Math.max(0, dailyGoalMinutes - Math.floor(todayStudyMs / 60_000))}m to your goal`}</Text>
      </Card>
    </View>

    <Card style={styles.totalStrip}>
      <TotalMetric label="ALL TIME" value={formatStudyDuration(totalStudyMs)} />
      <View style={styles.totalDivider} />
      <TotalMetric label="SESSIONS" value={`${completedSessionCount}`} />
      <View style={styles.totalDivider} />
      <TotalMetric label="SUBJECTS" value={`${subjectsStudied}`} />
    </Card>

    <Card style={styles.pomodoroSummary}>
      <View style={styles.pomodoroSummaryHeader}><View style={styles.pomodoroSummaryIcon}><Ionicons name="timer-outline" size={19} color={colors.purpleDark} /></View><View style={styles.pomodoroSummaryCopy}><Text style={styles.pomodoroSummaryTitle}>Pomodoro focus</Text><Text style={styles.pomodoroSummarySubtitle}>{pomodoroStartedCount} started · {formatStudyDuration(pomodoroTotalMs)} focus time · {pomodoroCompletionRate}% natural completion</Text></View></View>
      <View style={styles.pomodoroMetrics}><View style={styles.pomodoroMetric}><Text style={styles.pomodoroMetricValue}>{completedPomodoros.length}</Text><Text style={styles.pomodoroMetricLabel}>COMPLETED</Text></View><View style={styles.pomodoroMetric}><Text style={styles.pomodoroMetricValue}>{partialPomodoros.length}</Text><Text style={styles.pomodoroMetricLabel}>PARTIAL</Text></View><View style={styles.pomodoroMetric}><Text style={styles.pomodoroMetricValue}>{abandonedPomodoros}</Text><Text style={styles.pomodoroMetricLabel}>ABANDONED</Text></View><View style={styles.pomodoroMetric}><Text style={styles.pomodoroMetricValue}>{averagePomodoroMs ? formatStudyDuration(averagePomodoroMs) : '—'}</Text><Text style={styles.pomodoroMetricLabel}>AVG. FOCUS</Text></View></View>
      <View style={styles.pomodoroPeriodRow}><Text style={styles.pomodoroPeriodLabel}>FOCUS TIME</Text><Text style={styles.pomodoroPeriodValue}>Today {formatStudyDuration(pomodoroTodayMs)} · This week {formatStudyDuration(pomodoroWeekMs)}</Text></View>
      <Text style={styles.pomodoroBreakCaption}>Completed breaks · Short {completedShortBreaks} · Long {completedLongBreaks}</Text>
      {pomodoroSubjectRows.length > 0 && <View style={styles.pomodoroSubjectBlock}><Text style={styles.pomodoroPeriodLabel}>SUBJECT FOCUS</Text>{pomodoroSubjectRows.map(([subject, duration]) => <View key={subject} style={styles.pomodoroSubjectRow}><Text numberOfLines={1} style={styles.pomodoroSubjectName}>{subject}</Text><Text style={styles.pomodoroSubjectDuration}>{formatStudyDuration(duration)}</Text></View>)}</View>}
      {ownedPomodoro ? <Pressable accessibilityRole="button" onPress={() => router.push('/focus')} style={styles.pomodoroAction}><Text style={styles.pomodoroActionText}>{ownedPomodoro.status === 'paused' ? 'Resume focus session' : 'Return to focus session'}</Text><Ionicons name="arrow-forward" size={16} color={colors.purpleDark} /></Pressable> : <Pressable accessibilityRole="button" onPress={() => router.push('/focus')} style={styles.pomodoroAction}><Text style={styles.pomodoroActionText}>Open Focus Mode</Text><Ionicons name="arrow-forward" size={16} color={colors.purpleDark} /></Pressable>}
    </Card>

    {ownedPomodoro ? null : ownedActiveSession ? <ActiveTimerCard session={ownedActiveSession} userId={userId} onPause={pauseStudySession} onResume={() => resumeStudySession(userId)} onEnd={endSession} /> : <Pressable accessibilityRole="button" onPress={() => openStartModal()} style={({ pressed }) => [styles.startBanner, pressed && styles.pressed]}>
      <View style={styles.startIcon}><Ionicons name="play" size={17} color={colors.midnight} /></View><View style={{ flex: 1 }}><Text style={styles.startTitle}>Start a study session</Text><Text style={styles.startCaption}>Track focused time for a subject and topic.</Text></View><Ionicons name="arrow-forward" size={18} color={colors.purpleDark} />
    </Pressable>}

    <SectionTitle accessory={<Text style={styles.rangeCaption}>{rangeLabel}</Text>}>Study time</SectionTitle>
    <Card style={styles.chartCard}>
      <View style={styles.rangeTabs}>{(['daily', 'weekly', 'monthly'] as StudyRange[]).map((item) => <Chip key={item} selected={range === item} onPress={() => setRangeWithLatestBucket(item)}>{item === 'daily' ? 'Daily' : item === 'weekly' ? 'Weekly' : 'Monthly'}</Chip>)}</View>
      {userSessions.length || ownedActiveSession ? <>
        <View style={styles.chartMeta}><Text style={styles.chartTitle}>{selectedBucket?.label ?? 'Study activity'}</Text><Text style={styles.chartValue}>{formatStudyDuration(selectedBucket?.durationMs ?? 0)}</Text></View>
        <View style={styles.barChart}>
          {chartBuckets.map((bucket) => {
            const maximum = Math.max(...chartBuckets.map((item) => item.durationMs), 60_000);
            const height = bucket.durationMs > 0 ? Math.max(7, 92 * bucket.durationMs / maximum) : 3;
            const selected = selectedBucket?.key === bucket.key;
            return <Pressable key={bucket.key} accessibilityRole="button" accessibilityLabel={`${bucket.label}: ${formatStudyDuration(bucket.durationMs)}`} accessibilityState={{ selected }} onPress={() => setSelectedBucketKey(bucket.key)} style={styles.barColumn}>
              <View style={styles.barTrack}><View style={[styles.bar, { height, backgroundColor: selected ? colors.purpleDark : colors.mint }]} /></View>
              <Text numberOfLines={1} style={[styles.barLabel, selected && styles.barLabelSelected]}>{bucket.label}</Text>
            </Pressable>;
          })}
        </View>
        <Text style={styles.chartFootnote}>Tracked with completed or active study timer sessions.</Text>
      </> : <EmptyInline icon="timer-outline" title="No tracked study time yet" body="Start a timer session to build your real study history." onPress={() => openStartModal()} action="Start a session" />}
    </Card>

    <SectionTitle>Learning progress</SectionTitle>
    <Card style={styles.chartCard}>
      <Text style={styles.chartDescription}>Completed notebooks over the last six weeks. Remaining topics reflect notebooks available by each date.</Text>
      {songs.length ? <>
        <View style={styles.legend}><LegendDot color={colors.purple} label="Completed" /><LegendDot color="#E3EBE5" label="Remaining" /></View>
        <View style={styles.progressChart}>
          {progressBuckets.map((bucket, index) => {
            const total = Math.max(0, bucket.total);
            const completedHeight = total ? 76 * Math.min(1, bucket.completed / total) : 0;
            return <View key={`${bucket.label}-${index}`} style={styles.progressColumn}>
              <Text style={styles.progressCount}>{bucket.completed}/{total}</Text>
              <View style={styles.progressTrack}><View style={[styles.progressRemaining, { height: total ? `${Math.max(0, 100 - bucket.completed / total * 100)}%` : '100%' }]} /><View style={[styles.progressCompleted, { height: `${total ? completedHeight / 76 * 100 : 0}%` }]} /></View>
              <Text style={styles.progressLabel} numberOfLines={1}>{bucket.label}</Text>
            </View>;
          })}
        </View>
        <View style={styles.currentProgressLine}><Text style={styles.currentProgressLabel}>Current syllabus progress</Text><Text style={styles.currentProgressValue}>{completedTopics} completed · {remainingTopics} remaining</Text></View>
        <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${progressPercent}%` }]} /></View>
      </> : <EmptyInline icon="book-outline" title="Add a notebook to begin" body="Each notebook becomes one topic you can track through its study lifecycle." onPress={() => {}} />}
    </Card>

    <SectionTitle>Subject time</SectionTitle>
    <Card style={styles.chartCard}>
      {subjectStudyTotals.some((item) => item.duration > 0) ? <>
        {subjectStudyTotals.filter((item) => item.duration > 0).slice(0, 6).map((item) => {
          const share = allSubjectTime ? item.duration / allSubjectTime : 0;
          return <View key={item.subject} style={styles.subjectTimeRow}>
            <View style={{ flex: 1, gap: 7 }}><View style={styles.subjectTimeHeader}><Text style={styles.subjectName}>{item.subject}</Text><Text style={styles.subjectDuration}>{formatStudyDuration(item.duration)} · {Math.round(share * 100)}%</Text></View><View style={styles.goalTrack}><View style={[styles.subjectFill, { width: `${share * 100}%` }]} /></View></View>
          </View>;
        })}
        {subjectStudyTotals.length > 1 ? <Text style={styles.chartFootnote}>{subjectStudyTotals[0].subject} has the most and {subjectStudyTotals[subjectStudyTotals.length - 1].subject} the least tracked time.</Text> : null}
      </> : <EmptyInline icon="library-outline" title="Subject time appears here" body="Choose a subject when you start your first timer session." />}
    </Card>

    <SectionTitle>Study activity · 12 months</SectionTitle>
    <Card style={styles.heatmapCard}>
      <Text style={styles.chartDescription}>Each square shows active study time on that day. Tap a day for its total.</Text>
      <View style={styles.heatmapLegend}><Text style={styles.heatmapLegendText}>Less</Text>{[0, 1, 2, 3, 4].map((level) => <View key={level} style={[styles.heatTile, { backgroundColor: heatColor(level) }]} />)}<Text style={styles.heatmapLegendText}>More</Text></View>
      <View style={styles.heatmapRow}>
        <View style={styles.weekdayLabels}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={`${day}${index}`} style={styles.weekday}>{day}</Text>)}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heatmapScroll}>
          {heatmapWeeks.map((week, weekIndex) => <View key={weekIndex} style={styles.heatWeek}>
            <Text style={styles.monthTick}>{monthTick(week)}</Text>
            {week.map((dayStart) => {
              const key = localDateKey(dayStart);
              const time = dayMap.get(key) ?? 0;
              const future = dayStart > localDayStart(now);
              const level = time >= 180 * 60_000 ? 4 : time >= 120 * 60_000 ? 3 : time >= 60 * 60_000 ? 2 : time >= 5 * 60_000 ? 1 : 0;
              const selected = key === selectedHeatmapKey;
              return <Pressable key={key} disabled={future} onPress={() => setSelectedHeatmapKey(key)} accessibilityRole="button" accessibilityLabel={`${new Date(dayStart).toLocaleDateString()}: ${formatStudyDuration(time)} study time`} accessibilityState={{ selected }} style={[styles.heatTile, { backgroundColor: future ? 'transparent' : heatColor(level) }, selected && !future && styles.heatTileSelected]} />;
            })}
          </View>)}
        </ScrollView>
      </View>
      <View style={styles.selectedDay}><View style={styles.selectedDayIcon}><Ionicons name="calendar-outline" size={16} color={colors.purpleDark} /></View><Text style={styles.selectedDayText}>{formatDayKey(selectedHeatmapKey)}</Text><Text style={styles.selectedDayDuration}>{formatStudyDuration(selectedHeatmapMs)}</Text></View>
    </Card>

    <SectionTitle>Subject progress</SectionTitle>
    {subjectRows.length ? subjectRows.map((row) => {
      const expanded = expandedSubject === row.subject;
      const percent = row.songs.length ? Math.round(row.completed / row.songs.length * 100) : 0;
      return <Card key={row.subject} style={styles.subjectCard}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpandedSubject(expanded ? '' : row.subject)} style={styles.subjectSummary}>
          <View style={styles.subjectIcon}><Ionicons name={subjectIcon(row.subject) as keyof typeof Ionicons.glyphMap} size={18} color={colors.purpleDark} /></View>
          <View style={styles.subjectMain}><View style={styles.subjectTitleRow}><Text style={styles.subjectCardTitle} numberOfLines={1}>{row.subject}</Text><Text style={styles.subjectPercent}>{percent}%</Text></View><Text style={styles.subjectDetail}>{row.completed} of {row.songs.length} topics complete · {formatStudyDuration(row.totalMs)} tracked</Text><View style={styles.subjectProgressTrack}><View style={[styles.goalFill, { width: `${percent}%` }]} /></View></View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>
        <View style={styles.subjectMeta}><Text style={styles.subjectMetaText}>{row.lastStudied ? `Last studied ${new Date(row.lastStudied).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'No timer sessions yet'}</Text><Text style={styles.subjectMetaText}>{row.songs.length - row.completed} remaining</Text></View>
        {expanded ? <View style={styles.topicList}>
          {row.songs.map((song) => {
            const status = topicStatus(song);
            const option = statusOptions.find((item) => item.value === status) ?? statusOptions[0];
            return <View key={song.id} style={styles.topicRow}>
              <View style={styles.topicCopy}><Text style={styles.topicTitle} numberOfLines={1}>{song.title}</Text><Text style={styles.topicSub}>{song.saved ? 'Saved notebook' : 'Notebook'}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Change ${song.title} status. Current status: ${option.label}`} onPress={() => setStatusSong(song)} style={[styles.statusButton, { backgroundColor: option.bg }]}><Ionicons name={option.icon as keyof typeof Ionicons.glyphMap} size={14} color={option.color} /><Text style={[styles.statusText, { color: option.color }]} numberOfLines={1}>{option.label}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Start studying ${song.title}`} disabled={!!ownedActiveSession} onPress={() => openStartModal(song)} style={[styles.topicPlay, !!ownedActiveSession && styles.topicPlayDisabled]}><Ionicons name="play" size={13} color={colors.purpleDark} /></Pressable>
            </View>;
          })}
          {!row.songs.length ? <Text style={styles.chartFootnote}>Study a session under this subject to track its time.</Text> : null}
        </View> : null}
      </Card>;
    }) : <Card style={styles.emptyCard}><View style={styles.emptyIcon}><Ionicons name="book-outline" size={19} color={colors.purpleDark} /></View><View style={{ flex: 1, gap: 3 }}><Text style={styles.emptyTitle}>No subjects yet</Text><Text style={styles.emptyText}>Create a notebook from your notes. It will appear here as a topic.</Text></View></Card>}

    <SectionTitle>Daily and weekly goals</SectionTitle>
    <Card style={styles.goalsCard}>
      <GoalRow title="Today" current={todayStudyMs} goalMinutes={dailyGoalMinutes} progress={dailyGoalProgress} onDecrease={() => setDailyGoalMinutes(userId, dailyGoalMinutes - 5)} onIncrease={() => setDailyGoalMinutes(userId, dailyGoalMinutes + 5)} stepLabel="5 min" />
      <View style={styles.divider} />
      <GoalRow title="This week" current={weekStudyMs} goalMinutes={weeklyGoalMinutes} progress={weeklyGoalProgress} onDecrease={() => setWeeklyGoalMinutes(userId, weeklyGoalMinutes - 30)} onIncrease={() => setWeeklyGoalMinutes(userId, weeklyGoalMinutes + 30)} stepLabel="30 min" />
      <Text style={styles.goalHint}>Goals are adjustable and capped at 4 hours a day and 28 hours a week. Streak days require 5 active minutes; rest days do not erase your records.</Text>
    </Card>

    <SectionTitle>Learning insights</SectionTitle>
    <Card style={styles.insightsCard}>
      {weekStudyMs > 0 ? <Insight icon="time-outline" text={`You have tracked ${formatStudyDuration(weekStudyMs)} of study time this week.`} /> : null}
      {previousWeekMs > 0 && weekStudyMs > 0 ? <Insight icon="trending-up-outline" text={`${formatStudyDuration(Math.abs(weekStudyMs - previousWeekMs))} ${weekStudyMs >= previousWeekMs ? 'more' : 'less'} tracked than last week.`} /> : null}
      {weekSubjectTotals[0] && weekStudyMs > 0 ? <Insight icon="library-outline" text={`${weekSubjectTotals[0].subject} accounts for ${Math.round(weekSubjectTotals[0].duration / weekStudyMs * 100)}% of your tracked time this week.`} /> : null}
      {songs.length > 0 ? <Insight icon="checkmark-circle-outline" text={`${completedTopics} of ${songs.length} notebooks marked complete (${progressPercent}%). Time spent alone does not mark a topic complete.`} /> : null}
      {userAttempts.length ? <Insight icon="help-circle-outline" text={`${userAttempts.length} source-based quiz${userAttempts.length === 1 ? '' : 'zes'} recorded. Latest recall score: ${recentQuizAttempts[0].score} of ${recentQuizAttempts[0].questionCount}.`} /> : null}
      {revisionSessionCount > 0 ? <Insight icon="refresh-outline" text={`${revisionSessionCount} revision timer session${revisionSessionCount === 1 ? '' : 's'} recorded.`} /> : null}
      {todayStudyMs > 0 && todayStudyMs < dailyGoalMs ? <Insight icon="flag-outline" text={`${formatStudyDuration(dailyGoalMs - todayStudyMs)} to reach today's ${dailyGoalMinutes} minute goal.`} /> : null}
      {todayStudyMs >= dailyGoalMs ? <Insight icon="checkmark-done-outline" text={`Today's ${dailyGoalMinutes} minute study goal is reached.`} /> : null}
      {!weekStudyMs && !songs.length ? <EmptyInline icon="sparkles-outline" title="Insights need activity to learn from" body="Add a notebook or track a study session to see personal patterns here." /> : null}
      {!weekStudyMs && songs.length > 0 ? <Insight icon="information-circle-outline" text="No study timer activity has been recorded this week yet. Your notebook progress stays available below." /> : null}
    </Card>

    <SectionTitle accessory={<Text style={styles.rangeCaption}>{reviewSongIds.size} topics</Text>}>Needs attention</SectionTitle>
    <Card style={styles.insightsCard}>
      {reviewSongIds.size ? [...reviewSongIds].slice(0, 5).map((songId) => {
        const song = songs.find((item) => item.id === songId);
        if (!song) return null;
        const topicAttempts = userAttempts.filter((attempt) => attempt.songId === songId);
        const missCount = topicAttempts.reduce((sum, attempt) => sum + attempt.incorrectPoints.length, 0);
        const missesByPoint = new Map<string, number>();
        topicAttempts.forEach((attempt) => attempt.incorrectPoints.forEach((point) => missesByPoint.set(point, (missesByPoint.get(point) ?? 0) + 1)));
        const repeatedMisses = [...missesByPoint.values()].filter((count) => count > 1).length;
        const lastQuiz = Math.max(...topicAttempts.map((attempt) => attempt.createdAt), 0);
        const lastRevisionSession = Math.max(...userSessions.filter((session) => session.songId === songId && session.wasRevision).map((session) => session.endedAt), 0);
        const lastReviewedAt = Math.max(lastQuiz, lastRevisionSession);
        const reviewAge = lastReviewedAt ? Math.max(0, Math.floor((now - lastReviewedAt) / 86_400_000)) : null;
        const detail = [
          missCount ? `${missCount} incorrect answer${missCount === 1 ? '' : 's'}` : 'Marked for revision',
          repeatedMisses ? `${repeatedMisses} point${repeatedMisses === 1 ? '' : 's'} missed more than once` : '',
          reviewAge !== null ? `last reviewed ${reviewAge}d ago` : 'no review recorded yet',
        ].filter(Boolean).join(' · ');
        return <Pressable key={songId} accessibilityRole="button" onPress={() => song && setStatusSong(song)} style={styles.attentionRow}>
          <View style={styles.attentionIcon}><Ionicons name={topicStatus(song) === 'needsRevision' ? 'refresh-outline' : 'help-circle-outline'} size={17} color={colors.amber} /></View>
          <View style={styles.attentionCopy}><Text style={styles.attentionTitle} numberOfLines={1}>{song.title}</Text><Text style={styles.attentionMeta}>{detail}</Text></View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
        </Pressable>;
      }) : <EmptyInline icon="checkmark-circle-outline" title="Nothing flagged for review" body="Mark a topic “Needs revision” or complete a quiz with missed answers to see it here." />}
      {quizImprovements.slice(0, 2).map((item) => <View key={`quiz-${item.songId}`} style={styles.quizInsight}><Ionicons name={item.delta >= 0 ? 'trending-up-outline' : 'trending-down-outline'} size={17} color={item.delta >= 0 ? colors.success : colors.amber} /><Text style={styles.quizInsightText}>{songs.find((song) => song.id === item.songId)?.title ?? 'Quiz'}: {item.previous.score}/{item.previous.questionCount} to {item.latest.score}/{item.latest.questionCount} ({item.delta >= 0 ? '+' : ''}{item.delta} percentage points).</Text></View>)}
      {recentQuizAttempts.length ? <View style={styles.recentQuizList}><Text style={styles.recentQuizLabel}>RECENT SOURCE QUIZZES</Text>{recentQuizAttempts.map((attempt) => <View key={attempt.id} style={styles.recentQuizRow}><View style={{ flex: 1, gap: 3 }}><Text style={styles.recentQuizTitle} numberOfLines={1}>{attempt.topic}</Text><Text style={styles.recentQuizMeta}>{attempt.subject} · {new Date(attempt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {attempt.incorrectPoints.length} missed</Text></View><Text style={styles.recentQuizScore}>{attempt.score}/{attempt.questionCount}</Text></View>)}</View> : null}
    </Card>

    <SectionTitle>Milestones</SectionTitle>
    <Card style={styles.milestoneCard}>
      {milestones.map((item) => <View key={item.title} style={styles.milestoneRow}><View style={[styles.milestoneMark, item.done && styles.milestoneMarkDone]}><Ionicons name={item.done ? 'checkmark' : 'ellipse-outline'} size={15} color={item.done ? colors.success : colors.muted} /></View><View style={{ flex: 1 }}><Text style={styles.milestoneTitle}>{item.title}</Text><Text style={styles.milestoneDetail}>{item.detail}</Text></View><Text style={[styles.milestoneState, item.done && styles.milestoneStateDone]}>{item.done ? 'REACHED' : 'IN PROGRESS'}</Text></View>)}
      <Text style={styles.goalHint}>Milestones celebrate consistency and progress. They are based on your saved activity.</Text>
    </Card>

    <SectionTitle accessory={<Text style={styles.rangeCaption}>{completedSessionCount} completed</Text>}>Recent sessions</SectionTitle>
    <Card style={styles.historyCard}>
      {userSessions.length ? [...userSessions].sort((a, b) => b.endedAt - a.endedAt).slice(0, 6).map((session) => <View key={session.id} style={styles.historyRow}><View style={styles.historyIcon}><Ionicons name={session.wasRevision ? 'refresh-outline' : 'book-outline'} size={16} color={colors.purpleDark} /></View><View style={styles.historyCopy}><Text style={styles.historyTitle} numberOfLines={1}>{session.topic}</Text><Text style={styles.historyMeta}>{session.subject} · {new Date(session.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{session.wasRevision ? ' · revision' : ''}</Text></View><Text style={styles.historyDuration}>{formatStudyDuration(session.durationMs)}</Text></View>) : <EmptyInline icon="time-outline" title="Your session history will appear here" body="Start a timer and finish your first focused study session." onPress={() => openStartModal()} action="Start session" />}
      <View style={styles.historyTotals}><Text style={styles.historyTotalLabel}>All tracked time</Text><Text style={styles.historyTotalValue}>{formatStudyDuration(totalStudyMs)} · {subjectsStudied} {subjectsStudied === 1 ? 'subject' : 'subjects'}</Text></View>
    </Card>

    <View style={styles.localNote}><Ionicons name="phone-portrait-outline" size={13} color={colors.muted} /><Text style={styles.localNoteText}>Progress and session history are saved on this device.</Text></View>

    <Modal visible={startModalVisible} transparent animationType="slide" onRequestClose={() => setStartModalVisible(false)}>
      <View style={styles.modalBackdrop}><View style={styles.modalSheet}>
        <View style={styles.modalHeader}><View><Eyebrow>FOCUSED STUDY</Eyebrow><Text style={styles.modalTitle}>Start a session</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setStartModalVisible(false)} style={styles.modalClose}><Ionicons name="close" size={20} color={colors.ink} /></Pressable></View>
        {songs.length ? <><Text style={styles.inputLabel}>Choose a notebook</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.songChips}>
          {songs.map((song) => <Chip key={song.id} selected={selectedSongId === song.id} onPress={() => selectSessionSong(song.id)}>{song.title}</Chip>)}
          <Chip selected={!selectedSongId} onPress={() => { setSelectedSongId(''); setSubjectInput(''); setTopicInput(''); }}>Custom topic</Chip>
        </ScrollView></> : null}
        <Text style={styles.inputLabel}>Subject</Text><TextInput value={subjectInput} onChangeText={setSubjectInput} placeholder="e.g. Biology" placeholderTextColor="#91A29A" style={styles.modalInput} maxLength={80} accessibilityLabel="Study subject" />
        <Text style={styles.inputLabel}>Topic</Text><TextInput value={topicInput} onChangeText={setTopicInput} placeholder="e.g. Cell structure" placeholderTextColor="#91A29A" style={styles.modalInput} maxLength={120} accessibilityLabel="Study topic" />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: revisionSession }} onPress={() => setRevisionSession((value) => !value)} style={styles.revisionToggle}><View style={[styles.checkbox, revisionSession && styles.checkboxChecked]}>{revisionSession ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}</View><View><Text style={styles.revisionTitle}>This is a revision session</Text><Text style={styles.revisionCaption}>Recorded separately in your session history.</Text></View></Pressable>
        <ActionButton title="Start focused timer" onPress={startSession} disabled={!subjectInput.trim() || !topicInput.trim()} icon={<Ionicons name="play" size={16} color="#FFFFFF" />} />
      </View></View>
    </Modal>

    <Modal visible={!!statusSong} transparent animationType="fade" onRequestClose={() => setStatusSong(null)}>
      <Pressable style={styles.statusBackdrop} onPress={() => setStatusSong(null)}><View style={styles.statusSheet}><Eyebrow>TOPIC STATUS</Eyebrow><Text style={styles.modalTitle} numberOfLines={2}>{statusSong?.title}</Text>{statusOptions.map((option) => <Pressable key={option.value} accessibilityRole="button" onPress={() => changeStatus(option.value)} style={[styles.statusOption, { backgroundColor: option.bg }]}><Ionicons name={option.icon as keyof typeof Ionicons.glyphMap} size={18} color={option.color} /><Text style={[styles.statusOptionText, { color: option.color }]}>{option.label}</Text>{statusSong && topicStatus(statusSong) === option.value ? <Ionicons name="checkmark" size={17} color={option.color} style={{ marginLeft: 'auto' }} /> : null}</Pressable>)}</View></Pressable>
    </Modal>
  </AppScreen>;
}

function SummaryCard({ icon, tone, label, value, caption }: { icon: string; tone: 'purple' | 'mint' | 'peach'; label: string; value: string; caption: string }) {
  const background = tone === 'purple' ? colors.softPurple : tone === 'mint' ? colors.softMint : colors.softPeach;
  const iconColor = tone === 'purple' ? colors.purpleDark : tone === 'mint' ? colors.success : '#A85A32';
  return <Card style={styles.summaryCard}><View style={styles.summaryHead}><View style={[styles.summaryIcon, { backgroundColor: background }]}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={17} color={iconColor} /></View><Text style={styles.summaryLabel}>{label}</Text></View><Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={styles.summaryCaption} numberOfLines={1}>{caption}</Text></Card>;
}

function ActiveTimerCard({ session, userId, onPause, onResume, onEnd }: { session: NonNullable<ReturnType<typeof useAppStore.getState>['activeStudySession']>; userId: string; onPause: () => void; onResume: () => void; onEnd: () => void }) {
  const [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => {
    setClockNow(Date.now());
    if (session.status !== 'running') return;
    const interval = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [session.status, session.id, session.activeSince, session.accumulatedMs]);
  return <Card style={styles.activeCard}>
    <View style={styles.activeHeader}><View style={styles.liveDot} /><Eyebrow color={colors.success}>{session.status === 'running' ? 'SESSION IN PROGRESS' : 'SESSION PAUSED'}</Eyebrow><Text style={styles.activeTopic} numberOfLines={1}>{session.topic}</Text><Text style={styles.activeSubject}>{session.subject}{session.wasRevision ? ' · revision' : ''}</Text></View>
    <Text accessibilityLiveRegion="polite" style={styles.timer}>{formatClock(activeDurationMs(session, userId, clockNow))}</Text>
    <View style={styles.timerActions}>
      {session.status === 'running' ? <ActionButton title="Pause" secondary onPress={onPause} icon={<Ionicons name="pause" size={16} color={colors.ink} />} style={styles.timerButton} /> : <ActionButton title="Resume" onPress={onResume} icon={<Ionicons name="play" size={16} color="#FFFFFF" />} style={styles.timerButton} />}
      <Pressable accessibilityRole="button" onPress={onEnd} style={styles.endSession}><Ionicons name="stop" size={16} color={colors.danger} /><Text style={styles.endSessionText}>End session</Text></Pressable>
    </View>
    <Text style={styles.activeFootnote}>Only active timer segments count. Leaving the app pauses the session.</Text>
  </Card>;
}

function TotalMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.totalMetric}><Text style={styles.totalLabel}>{label}</Text><Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text></View>;
}

function GoalRow({ title, current, goalMinutes, progress, onDecrease, onIncrease, stepLabel }: { title: string; current: number; goalMinutes: number; progress: number; onDecrease: () => void; onIncrease: () => void; stepLabel: string }) {
  return <View style={styles.goalRow}>
    <View style={styles.goalHeader}><View style={{ flex: 1 }}><Text style={styles.goalTitle}>{title}</Text><Text style={styles.goalCurrent}>{formatStudyDuration(current)} of {goalMinutes} minutes</Text></View><View style={styles.goalControls}><Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${title} goal by ${stepLabel}`} onPress={onDecrease} style={styles.stepButton}><Ionicons name="remove" size={17} color={colors.purpleDark} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Increase ${title} goal by ${stepLabel}`} onPress={onIncrease} style={styles.stepButton}><Ionicons name="add" size={17} color={colors.purpleDark} /></Pressable></View></View>
    <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${progress * 100}%` }]} /></View>
  </View>;
}

function Insight({ icon, text }: { icon: string; text: string }) {
  return <View style={styles.insightRow}><View style={styles.insightIcon}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={colors.purpleDark} /></View><Text style={styles.insightText}>{text}</Text></View>;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

function EmptyInline({ icon, title, body, action, onPress }: { icon: string; title: string; body: string; action?: string; onPress?: () => void }) {
  return <View style={styles.emptyInline}><View style={styles.emptyInlineIcon}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={19} color={colors.purpleDark} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{body}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.emptyAction}><Text style={styles.emptyActionText}>{action}</Text><Ionicons name="arrow-forward" size={14} color={colors.purpleDark} /></Pressable> : null}</View>;
}

function formatClock(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatDayKey(key: string) {
  const date = new Date(`${key}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function heatColor(level: number) {
  return ['#E8EEE9', '#CDE4D0', '#9CCCA7', '#5D9E76', '#246747'][level] ?? '#E8EEE9';
}

function monthTick(week: number[]) {
  const firstOfMonth = week.find((day) => new Date(day).getDate() === 1);
  return firstOfMonth ? new Date(firstOfMonth).toLocaleDateString(undefined, { month: 'short' }).slice(0, 1) : '';
}

function subjectIcon(subject: string) {
  const name = subject.toLowerCase();
  if (name.includes('math')) return 'calculator-outline';
  if (name.includes('physics')) return 'flash-outline';
  if (name.includes('chem')) return 'flask-outline';
  if (name.includes('bio')) return 'leaf-outline';
  if (name.includes('history')) return 'time-outline';
  return 'book-outline';
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  headerIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  headerCopy: { flex: 1, gap: 3 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  loadingCard: { alignItems: 'center', padding: 25, gap: 11, marginTop: 18 },
  loadingMark: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple },
  loadingLine: { width: '75%', height: 8, borderRadius: 4, backgroundColor: '#E6ECE7' },
  loadingLineShort: { width: '52%' },
  totalStrip: { minHeight: 67, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, gap: 9, borderRadius: 18 },
  totalMetric: { flex: 1, alignItems: 'center', gap: 4 },
  totalLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.55 },
  totalValue: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  totalDivider: { width: 1, height: 30, backgroundColor: colors.border },
  pomodoroSummary: { gap: 11, padding: 14 },
  pomodoroSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pomodoroSummaryIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple },
  pomodoroSummaryCopy: { flex: 1, gap: 3 },
  pomodoroSummaryTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  pomodoroSummarySubtitle: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  pomodoroMetrics: { flexDirection: 'row', gap: 9 },
  pomodoroMetric: { flex: 1, minHeight: 51, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas, gap: 3 },
  pomodoroMetricValue: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  pomodoroMetricLabel: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.45 },
  pomodoroPeriodRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 5, paddingTop: 2 },
  pomodoroPeriodLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.55 },
  pomodoroPeriodValue: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  pomodoroBreakCaption: { color: colors.muted, fontSize: 9 },
  pomodoroSubjectBlock: { gap: 5, paddingTop: 3, borderTopWidth: 1, borderTopColor: colors.border },
  pomodoroSubjectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pomodoroSubjectName: { flex: 1, color: colors.ink, fontSize: 9, fontWeight: '700' },
  pomodoroSubjectDuration: { color: colors.purpleDark, fontSize: 9, fontWeight: '800' },
  pomodoroAction: { minHeight: 37, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, borderRadius: 12, backgroundColor: colors.softMint },
  pomodoroActionText: { color: colors.purpleDark, fontSize: 10, fontWeight: '800' },
  summaryCard: { width: '48%', flexGrow: 1, minWidth: 145, minHeight: 130, padding: 13, gap: 4, borderRadius: 20 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  summaryIcon: { width: 31, height: 31, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  summaryLabel: { flex: 1, color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.55 },
  summaryValue: { color: colors.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.6 },
  summaryCaption: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  goalSlash: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0 },
  goalTrack: { height: 8, borderRadius: 5, overflow: 'hidden', backgroundColor: '#E5ECE6' },
  goalFill: { height: '100%', borderRadius: 5, backgroundColor: colors.purple },
  activeCard: { borderColor: '#BBD9C2', backgroundColor: '#F3FAF2', alignItems: 'center', padding: 18, gap: 7 },
  activeHeader: { width: '100%', alignItems: 'center', gap: 5 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
  activeTopic: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 2 },
  activeSubject: { color: colors.muted, fontSize: 11 },
  timer: { color: colors.midnight, fontSize: 40, lineHeight: 48, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 1.4 },
  timerActions: { width: '100%', flexDirection: 'row', gap: 10 },
  timerButton: { flex: 1, minHeight: 47 },
  endSession: { minHeight: 47, paddingHorizontal: 15, borderRadius: 16, borderWidth: 1, borderColor: '#EBD5D0', backgroundColor: '#FFF7F4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  endSessionText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  activeFootnote: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  startBanner: { minHeight: 76, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#C3DCC9', borderRadius: 20, backgroundColor: colors.softMint },
  startIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  startTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  startCaption: { color: colors.muted, fontSize: 11, marginTop: 3 },
  pressed: { opacity: 0.82 },
  rangeCaption: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chartCard: { gap: 14, padding: 16 },
  rangeTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chartMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  chartValue: { color: colors.purpleDark, fontSize: 17, fontWeight: '900' },
  barChart: { minHeight: 128, flexDirection: 'row', alignItems: 'stretch', gap: 5 },
  barColumn: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  barTrack: { width: '70%', height: 98, borderRadius: 8, backgroundColor: '#F0F4EF', justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 7 },
  barLabel: { maxWidth: '100%', color: colors.muted, fontSize: 8, fontWeight: '700', textAlign: 'center' },
  barLabelSelected: { color: colors.purpleDark, fontWeight: '900' },
  chartFootnote: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  chartDescription: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  legend: { flexDirection: 'row', gap: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  progressChart: { flexDirection: 'row', gap: 7, height: 116, alignItems: 'flex-end' },
  progressColumn: { flex: 1, minWidth: 0, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  progressCount: { color: colors.muted, fontSize: 8, fontWeight: '700' },
  progressTrack: { width: '70%', height: 76, backgroundColor: '#E3EBE5', borderRadius: 7, overflow: 'hidden', justifyContent: 'flex-end' },
  progressRemaining: { position: 'absolute', top: 0, width: '100%', backgroundColor: '#E3EBE5' },
  progressCompleted: { width: '100%', backgroundColor: colors.purple, borderRadius: 6 },
  progressLabel: { color: colors.muted, fontSize: 8, textAlign: 'center' },
  currentProgressLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  currentProgressLabel: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  currentProgressValue: { color: colors.purpleDark, fontSize: 10, fontWeight: '800' },
  subjectTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  subjectTimeHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  subjectName: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '800' },
  subjectDuration: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  subjectFill: { height: '100%', borderRadius: 5, backgroundColor: colors.mint },
  heatmapCard: { gap: 12, padding: 15 },
  heatmapLegend: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end' },
  heatmapLegendText: { color: colors.muted, fontSize: 9, marginHorizontal: 3 },
  heatmapRow: { flexDirection: 'row', gap: 5, alignItems: 'flex-start' },
  weekdayLabels: { paddingTop: 14, gap: 3 },
  weekday: { width: 10, height: 10, color: colors.muted, fontSize: 7, textAlign: 'center' },
  heatmapScroll: { gap: 3, paddingRight: 3 },
  heatWeek: { gap: 3 },
  monthTick: { height: 11, width: 10, color: colors.muted, fontSize: 8, textAlign: 'center' },
  heatTile: { width: 10, height: 10, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(24,51,46,0.035)' },
  heatTileSelected: { borderColor: colors.midnight, borderWidth: 1.5 },
  selectedDay: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.canvas },
  selectedDayIcon: { width: 27, height: 27, borderRadius: 9, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' },
  selectedDayText: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: '700' },
  selectedDayDuration: { color: colors.purpleDark, fontSize: 11, fontWeight: '900' },
  subjectCard: { padding: 14, gap: 9 },
  subjectSummary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subjectIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' },
  subjectMain: { flex: 1, gap: 5 },
  subjectTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectCardTitle: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '800' },
  subjectPercent: { color: colors.purpleDark, fontSize: 12, fontWeight: '900' },
  subjectDetail: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  subjectProgressTrack: { height: 6, borderRadius: 4, overflow: 'hidden', backgroundColor: '#E5ECE6' },
  subjectMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingLeft: 50 },
  subjectMetaText: { color: colors.muted, fontSize: 9 },
  topicList: { marginTop: 3, borderTopWidth: 1, borderColor: colors.border, paddingTop: 4 },
  topicRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 7, borderBottomWidth: 1, borderColor: '#EDF1ED' },
  topicCopy: { flex: 1, minWidth: 0, gap: 3 },
  topicTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  topicSub: { color: colors.muted, fontSize: 9 },
  statusButton: { maxWidth: 116, minHeight: 32, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 11 },
  statusText: { fontSize: 8, fontWeight: '800' },
  topicPlay: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softMint },
  topicPlayDisabled: { opacity: 0.42 },
  goalsCard: { padding: 16, gap: 13 },
  goalRow: { gap: 10 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  goalTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  goalCurrent: { color: colors.muted, fontSize: 10, marginTop: 3 },
  goalControls: { flexDirection: 'row', gap: 6 },
  stepButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple },
  divider: { height: 1, backgroundColor: colors.border },
  goalHint: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  insightsCard: { padding: 15, gap: 13 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  insightIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' },
  insightText: { flex: 1, paddingTop: 2, color: colors.ink, fontSize: 11, lineHeight: 17 },
  attentionRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: '#EDF1ED', paddingVertical: 5 },
  attentionIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softYellow },
  attentionCopy: { flex: 1, gap: 4 },
  attentionTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  attentionMeta: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  quizInsight: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingTop: 3 },
  quizInsightText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15 },
  recentQuizList: { gap: 8, borderTopWidth: 1, borderColor: colors.border, paddingTop: 12 },
  recentQuizLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  recentQuizRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recentQuizTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  recentQuizMeta: { color: colors.muted, fontSize: 8 },
  recentQuizScore: { color: colors.purpleDark, fontSize: 12, fontWeight: '900' },
  milestoneCard: { padding: 15, gap: 13 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  milestoneMark: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  milestoneMarkDone: { backgroundColor: colors.softMint },
  milestoneTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  milestoneDetail: { color: colors.muted, fontSize: 9, marginTop: 3 },
  milestoneState: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.4 },
  milestoneStateDone: { color: colors.success },
  historyCard: { padding: 15, gap: 11 },
  historyRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple },
  historyCopy: { flex: 1, gap: 3 },
  historyTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  historyMeta: { color: colors.muted, fontSize: 9 },
  historyDuration: { color: colors.purpleDark, fontSize: 11, fontWeight: '900' },
  historyTotals: { marginTop: 3, paddingTop: 12, borderTopWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  historyTotalLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  historyTotalValue: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' },
  emptyInline: { alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 8 },
  emptyInlineIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple, marginBottom: 2 },
  emptyTitle: { color: colors.ink, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 10, lineHeight: 15 },
  emptyAction: { minHeight: 37, marginTop: 4, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.softMint },
  emptyActionText: { color: colors.purpleDark, fontSize: 10, fontWeight: '800' },
  localNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: -7 },
  localNoteText: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,31,26,0.42)' },
  modalSheet: { maxHeight: '88%', paddingHorizontal: 22, paddingTop: 21, paddingBottom: 30, gap: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.canvas },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  modalTitle: { color: colors.ink, fontSize: 22, lineHeight: 29, fontWeight: '900', letterSpacing: -0.55, marginTop: 4 },
  modalClose: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  inputLabel: { color: colors.ink, fontSize: 11, fontWeight: '800', marginTop: 2 },
  songChips: { gap: 7, paddingRight: 10 },
  modalInput: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, color: colors.ink, fontSize: 13 },
  revisionToggle: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 13, backgroundColor: colors.softYellow },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: '#B98D42', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { borderColor: colors.success, backgroundColor: colors.success },
  revisionTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  revisionCaption: { color: colors.muted, fontSize: 9, marginTop: 3 },
  statusBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(12,31,26,0.42)' },
  statusSheet: { padding: 19, gap: 10, borderRadius: 24, backgroundColor: colors.canvas },
  statusOption: { minHeight: 46, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusOptionText: { fontSize: 12, fontWeight: '800' },
});
