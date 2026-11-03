import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { shouldTakeLongBreak } from '@/features/pomodoro/timer';

export type StudyLanguage = 'en' | 'hi';

export type StudyArtifactKind = 'slides' | 'mindmap' | 'audio' | 'video';

export type StudyArtifactNode = {
  heading: string;
  body: string;
  sourcePoints: number[];
  children?: StudyArtifactNode[];
};

export type StudyArtifactSection = StudyArtifactNode;

export type StudyArtifactContent = {
  summary: string;
  sections: StudyArtifactNode[];
};

export type StudyVideoStatus = 'pending' | 'running' | 'done' | 'error' | 'timeout';
export type StudyScene = {
  id: string;
  number: number;
  title: string;
  concept: string;
  description: string;
  caption: string;
  visualPrompt: string;
  sourcePoints: number[];
  status: 'planned' | 'generating' | 'ready' | 'error';
  imageUri?: string;
  imageMimeType?: string;
  error?: string;
  updatedAt?: string;
};

export type NcertBookLink = {
  id: string;
  title: string;
  className: string;
  subject: string;
  language: 'English' | 'Hindi' | 'Other';
  chapter: string;
  url: string;
  lastReadPage: number;
  bookmarkedPages: number[];
  verifiedAt?: string;
  addedAt: string;
};
export type TopicProgressStatus = 'notStarted' | 'inProgress' | 'completed' | 'needsRevision';

export type TopicProgressRecord = {
  songId: string;
  userId: string;
  status: TopicProgressStatus;
  updatedAt: number;
};

export type TopicProgressEvent = {
  songId: string;
  userId: string;
  status: TopicProgressStatus;
  at: number;
};

export type StudySegment = { startedAt: number; endedAt: number };

export type StudySession = {
  id: string;
  userId: string;
  subject: string;
  topic: string;
  songId?: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  wasRevision: boolean;
  segments: StudySegment[];
};

export type ActiveStudySession = {
  id: string;
  userId: string;
  subject: string;
  topic: string;
  songId?: string;
  startedAt: number;
  activeSince: number | null;
  lastCheckpointAt: number;
  accumulatedMs: number;
  segments: StudySegment[];
  status: 'running' | 'paused';
  wasRevision: boolean;
};

export type QuizAttempt = {
  id: string;
  userId: string;
  songId: string;
  subject: string;
  topic: string;
  score: number;
  questionCount: number;
  incorrectPoints: string[];
  createdAt: number;
};

export type StudyGoals = { dailyGoalMinutes: number; weeklyGoalMinutes: number };

export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak' | 'focusComplete' | 'breakComplete';
export type PomodoroStatus = 'running' | 'paused' | 'awaiting';

export type PomodoroSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  notificationsEnabled: boolean;
  returnNotificationsEnabled: boolean;
  dailyGoalMinutes: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  reducedMotion: boolean;
};

export const defaultPomodoroSettings: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  notificationsEnabled: false,
  returnNotificationsEnabled: true,
  dailyGoalMinutes: 100,
  soundEnabled: false,
  vibrationEnabled: false,
  reducedMotion: false,
};

export type ActivePomodoro = {
  id: string;
  userId: string;
  subject: string;
  topic: string;
  songId?: string;
  phase: PomodoroPhase;
  status: PomodoroStatus;
  phaseStartedAt: number | null;
  phaseEndsAt: number | null;
  durationMs: number;
  remainingMs: number;
  studySessionId?: string;
  awayStartedAt?: number;
  returnNoticeMs?: number;
};

export type PomodoroFocusRecord = {
  id: string;
  userId: string;
  subject: string;
  topic: string;
  songId?: string;
  studySessionId?: string;
  startedAt: number;
  endedAt: number;
  plannedDurationMs: number;
  activeDurationMs: number;
  status: 'completed' | 'partial' | 'abandoned';
};

export type PomodoroBreakRecord = {
  id: string;
  userId: string;
  phase: 'shortBreak' | 'longBreak';
  startedAt: number;
  endedAt: number;
  plannedDurationMs: number;
  status: 'completed' | 'skipped';
};

function safePomodoroSettings(settings?: Partial<PomodoroSettings>): PomodoroSettings {
  const source = { ...defaultPomodoroSettings, ...(settings ?? {}) };
  const numberInRange = (value: number, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  return {
    focusMinutes: numberInRange(source.focusMinutes, 1, 120, defaultPomodoroSettings.focusMinutes),
    shortBreakMinutes: numberInRange(source.shortBreakMinutes, 1, 30, defaultPomodoroSettings.shortBreakMinutes),
    longBreakMinutes: numberInRange(source.longBreakMinutes, 1, 60, defaultPomodoroSettings.longBreakMinutes),
    longBreakInterval: numberInRange(source.longBreakInterval, 2, 8, defaultPomodoroSettings.longBreakInterval),
    autoStartBreaks: !!source.autoStartBreaks,
    autoStartFocus: !!source.autoStartFocus,
    notificationsEnabled: !!source.notificationsEnabled,
    returnNotificationsEnabled: !!source.returnNotificationsEnabled,
    dailyGoalMinutes: numberInRange(source.dailyGoalMinutes, 10, 480, defaultPomodoroSettings.dailyGoalMinutes),
    soundEnabled: !!source.soundEnabled,
    vibrationEnabled: !!source.vibrationEnabled,
    reducedMotion: !!source.reducedMotion,
  };
}

function dateStamp(at: number) {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type StudyArtifact = {
  id: string;
  kind: StudyArtifactKind;
  title: string;
  createdAt: string;
  content: StudyArtifactContent;
  generationMode: 'local' | 'ai';
  audioJobId?: string;
  audioUrl?: string;
  audioLocalUri?: string;
  audioMimeType?: string;
  videoProjectId?: string;
  videoStatus?: StudyVideoStatus;
  videoUrl?: string;
  videoThumbnail?: string;
  videoDuration?: number;
  videoError?: string;
  sceneGallery?: StudyScene[];
};

export type StudySong = {
  id: string;
  ownerId?: string;
  title: string;
  subject: string;
  style: string;
  language?: StudyLanguage;
  sourceText: string;
  sourceImageUri?: string;
  lyrics: string;
  createdAt: string;
  saved: boolean;
  generationMode: 'local' | 'ai';
  audioUrl?: string;
  audioJobId?: string;
  audioLocalUri?: string;
  audioMimeType?: string;
  artifacts?: StudyArtifact[];
};

type AppState = {
  songs: StudySong[];
  quizCount: number;
  completedToday: number;
  topicProgress: Record<string, TopicProgressRecord>;
  topicProgressEvents: TopicProgressEvent[];
  studySessions: StudySession[];
  activeStudySession: ActiveStudySession | null;
  pomodoroSettings: Record<string, PomodoroSettings>;
  activePomodoro: ActivePomodoro | null;
  pomodoroFocusRecords: PomodoroFocusRecord[];
  pomodoroBreakRecords: PomodoroBreakRecord[];
  quizAttempts: QuizAttempt[];
  studyGoals: Record<string, StudyGoals>;
  ncertBookLinks: NcertBookLink[];
  hasHydrated: boolean;
  claimUnassignedSongs: (userId: string) => void;
  addSong: (song: StudySong) => void;
  updateSong: (id: string, patch: Partial<StudySong>) => void;
  saveSong: (id: string) => void;
  addArtifact: (songId: string, artifact: StudyArtifact) => void;
  updateArtifact: (songId: string, artifactId: string, patch: Partial<StudyArtifact>) => void;
  deleteArtifact: (songId: string, artifactId: string) => void;
  deleteSong: (id: string) => void;
  addNcertBookLink: (book: NcertBookLink) => void;
  updateNcertBookLink: (id: string, patch: Partial<NcertBookLink>) => void;
  deleteNcertBookLink: (id: string) => void;
  recordQuiz: (attempt: QuizAttempt) => void;
  setTopicStatus: (songId: string, userId: string, status: TopicProgressStatus, at?: number) => void;
  startStudySession: (input: Omit<ActiveStudySession, 'id' | 'startedAt' | 'activeSince' | 'lastCheckpointAt' | 'accumulatedMs' | 'segments' | 'status'>, now?: number) => boolean;
  pauseStudySession: (now?: number) => void;
  resumeStudySession: (userId: string, now?: number) => boolean;
  checkpointStudySession: (now?: number) => void;
  completeStudySession: (userId: string, now?: number) => boolean;
  recoverStudySession: (now?: number) => void;
  recoverPomodoro: (now?: number) => void;
  getPomodoroSettings: (userId: string) => PomodoroSettings;
  updatePomodoroSettings: (userId: string, patch: Partial<PomodoroSettings>) => void;
  startPomodoroFocus: (userId: string, subject: string, topic: string, songId?: string, now?: number) => boolean;
  pausePomodoro: (now?: number) => void;
  resumePomodoro: (userId: string, now?: number) => boolean;
  startPomodoroBreak: (userId: string, phase: 'shortBreak' | 'longBreak', now?: number) => boolean;
  skipPomodoroBreak: (now?: number) => void;
  completePomodoroPhase: (now?: number) => boolean;
  endPomodoro: (userId: string, now?: number) => boolean;
  notePomodoroBackground: (now?: number) => void;
  notePomodoroForeground: (now?: number) => void;
  dismissPomodoroReturnNotice: () => void;
  setDailyGoalMinutes: (userId: string, minutes: number) => void;
  setWeeklyGoalMinutes: (userId: string, minutes: number) => void;
  setHasHydrated: (hydrated: boolean) => void;
  clearLocalData: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      songs: [],
      quizCount: 0,
      completedToday: 0,
      topicProgress: {},
      topicProgressEvents: [],
      studySessions: [],
      activeStudySession: null,
      pomodoroSettings: {},
      activePomodoro: null,
      pomodoroFocusRecords: [],
      pomodoroBreakRecords: [],
      quizAttempts: [],
      studyGoals: {},
      ncertBookLinks: [],
      hasHydrated: false,
      claimUnassignedSongs: (userId) => set((state) => {
        if (!state.hasHydrated || !userId) return state;
        const legacySongs = state.songs.filter((song) => !song.ownerId);
        if (!legacySongs.length) return state;
        const now = Date.now();
        const topicProgressEvents = [...state.topicProgressEvents];
        for (const song of legacySongs) {
          if (!topicProgressEvents.some((event) => event.songId === song.id && event.userId === userId)) {
            topicProgressEvents.push({ songId: song.id, userId, status: 'notStarted', at: Date.parse(song.createdAt) || now });
          }
        }
        return {
          songs: state.songs.map((song) => song.ownerId ? song : { ...song, ownerId: userId }),
          topicProgressEvents: topicProgressEvents.slice(-5000),
        };
      }),
      addSong: (song) => set((state) => {
        const songs = [song, ...state.songs.filter((item) => item.id !== song.id)];
        const progress = { ...(state.topicProgress[song.id] ? { [song.id]: state.topicProgress[song.id] } : {}) };
        const events = [...state.topicProgressEvents];
        if (song.ownerId && !events.some((event) => event.songId === song.id && event.userId === song.ownerId)) {
          events.push({ songId: song.id, userId: song.ownerId, status: 'notStarted', at: Date.parse(song.createdAt) || Date.now() });
        }
        return { songs, topicProgress: { ...state.topicProgress, ...progress }, topicProgressEvents: events.slice(-5000) };
      }),
      updateSong: (id, patch) => set((state) => ({ songs: state.songs.map((song) => song.id === id ? { ...song, ...patch } : song) })),
      saveSong: (id) => set((state) => ({ songs: state.songs.map((song) => song.id === id ? { ...song, saved: true } : song) })),
      addArtifact: (songId, artifact) => set((state) => ({
        songs: state.songs.map((song) => song.id === songId
          ? { ...song, artifacts: [artifact, ...(song.artifacts ?? []).filter((item) => item.id !== artifact.id)] }
          : song),
      })),
      updateArtifact: (songId, artifactId, patch) => set((state) => ({
        songs: state.songs.map((song) => song.id === songId
          ? { ...song, artifacts: (song.artifacts ?? []).map((artifact) => artifact.id === artifactId ? { ...artifact, ...patch } : artifact) }
          : song),
      })),
      deleteArtifact: (songId, artifactId) => set((state) => ({
        songs: state.songs.map((song) => song.id === songId
          ? { ...song, artifacts: (song.artifacts ?? []).filter((artifact) => artifact.id !== artifactId) }
          : song),
      })),
      deleteSong: (id) => set((state) => {
        const topicProgress = { ...state.topicProgress };
        delete topicProgress[id];
        return { songs: state.songs.filter((song) => song.id !== id), topicProgress, topicProgressEvents: state.topicProgressEvents.filter((event) => event.songId !== id) };
      }),
      addNcertBookLink: (book) => set((state) => ({ ncertBookLinks: [book, ...state.ncertBookLinks.filter((item) => item.id !== book.id)] })),
      updateNcertBookLink: (id, patch) => set((state) => ({ ncertBookLinks: state.ncertBookLinks.map((item) => item.id === id ? { ...item, ...patch } : item) })),
      deleteNcertBookLink: (id) => set((state) => ({ ncertBookLinks: state.ncertBookLinks.filter((item) => item.id !== id) })),
      recordQuiz: (attempt) => set((state) => {
        if (!attempt.id || !attempt.userId || !Number.isFinite(attempt.createdAt) || state.quizAttempts.some((item) => item.id === attempt.id)) return state;
        const ownerSong = state.songs.find((song) => song.id === attempt.songId && song.ownerId === attempt.userId);
        if (!ownerSong || !Number.isInteger(attempt.questionCount) || attempt.questionCount < 1 || !Number.isFinite(attempt.score)) return state;
        const questionCount = Math.min(100, attempt.questionCount);
        const cleanAttempt: QuizAttempt = {
          ...attempt,
          subject: ownerSong.subject,
          topic: ownerSong.title,
          questionCount,
          score: Math.min(questionCount, Math.max(0, Math.round(attempt.score))),
          incorrectPoints: Array.isArray(attempt.incorrectPoints) ? attempt.incorrectPoints.filter((point) => typeof point === 'string').slice(0, 100) : [],
        };
        return {
          quizCount: state.quizCount + 1,
          completedToday: state.completedToday + 1,
          quizAttempts: [cleanAttempt, ...state.quizAttempts].slice(0, 2000),
        };
      }),
      setTopicStatus: (songId, userId, status, at = Date.now()) => set((state) => {
        if (!['notStarted', 'inProgress', 'completed', 'needsRevision'].includes(status) || !Number.isFinite(at)) return state;
        const song = state.songs.find((item) => item.id === songId && item.ownerId === userId);
        if (!song) return state;
        const previous = state.topicProgress[songId];
        if (previous?.userId === userId && previous.status === status) return state;
        const record = { songId, userId, status, updatedAt: at };
        return {
          topicProgress: { ...state.topicProgress, [songId]: record },
          topicProgressEvents: [...state.topicProgressEvents, { songId, userId, status, at }].slice(-5000),
        };
      }),
      startStudySession: (input, now = Date.now()) => {
        let started = false;
        set((state) => {
          if (state.activeStudySession || !input.userId || !input.subject.trim() || !input.topic.trim() || !Number.isFinite(now)) return state;
          started = true;
          return { activeStudySession: {
            ...input,
            id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
            subject: input.subject.trim().slice(0, 80),
            topic: input.topic.trim().slice(0, 120),
            startedAt: now,
            activeSince: now,
            lastCheckpointAt: now,
            accumulatedMs: 0,
            segments: [],
            status: 'running',
          } };
        });
        return started;
      },
      pauseStudySession: (now = Date.now()) => set((state) => {
        const active = state.activeStudySession;
        if (!active || active.status !== 'running' || active.activeSince === null || !Number.isFinite(active.activeSince) || !Number.isFinite(now)) return state;
        const elapsed = Math.max(0, now - active.activeSince);
        const segments = Array.isArray(active.segments) ? active.segments : [];
        const accumulatedMs = Math.max(0, Number.isFinite(active.accumulatedMs) ? active.accumulatedMs : 0);
        return { activeStudySession: { ...active, accumulatedMs: accumulatedMs + elapsed, segments: elapsed ? [...segments, { startedAt: active.activeSince, endedAt: now }] : segments, activeSince: null, lastCheckpointAt: now, status: 'paused' } };
      }),
      resumeStudySession: (userId, now = Date.now()) => {
        let resumed = false;
        set((state) => {
          const active = state.activeStudySession;
          if (!active || active.userId !== userId || active.status !== 'paused' || !Number.isFinite(now)) return state;
          resumed = true;
          return { activeStudySession: { ...active, activeSince: now, lastCheckpointAt: now, status: 'running' } };
        });
        return resumed;
      },
      checkpointStudySession: (now = Date.now()) => set((state) => {
        const active = state.activeStudySession;
        const timerEnd = state.activePomodoro?.phase === 'focus' && state.activePomodoro.status === 'running' ? state.activePomodoro.phaseEndsAt : null;
        const checkpointAt = timerEnd !== null ? Math.min(now, timerEnd) : now;
        if (!active || active.status !== 'running' || active.activeSince === null || !Number.isFinite(active.activeSince) || !Number.isFinite(checkpointAt) || checkpointAt - active.lastCheckpointAt < 25_000) return state;
        const elapsed = Math.max(0, checkpointAt - active.activeSince);
        const segments = Array.isArray(active.segments) ? active.segments : [];
        const accumulatedMs = Math.max(0, Number.isFinite(active.accumulatedMs) ? active.accumulatedMs : 0);
        return { activeStudySession: { ...active, accumulatedMs: accumulatedMs + elapsed, segments: elapsed ? [...segments, { startedAt: active.activeSince, endedAt: checkpointAt }] : segments, activeSince: checkpointAt, lastCheckpointAt: checkpointAt } };
      }),
      completeStudySession: (userId, now = Date.now()) => {
        let completed = false;
        set((state) => {
          const active = state.activeStudySession;
          if (!active || active.userId !== userId || !Number.isFinite(now)) return state;
          const accumulatedMs = Math.max(0, Number.isFinite(active.accumulatedMs) ? active.accumulatedMs : 0);
          const activeTail = active.status === 'running' && active.activeSince !== null && Number.isFinite(active.activeSince) ? Math.max(0, now - active.activeSince) : 0;
          const durationMs = accumulatedMs + activeTail;
          if (!Number.isFinite(durationMs) || durationMs <= 0) return { activeStudySession: null };
          completed = true;
          const finalSegment = active.status === 'running' && active.activeSince !== null && now > active.activeSince
            ? [{ startedAt: active.activeSince, endedAt: now }]
            : [];
          const session: StudySession = {
            id: active.id,
            userId: active.userId,
            subject: active.subject,
            topic: active.topic,
            ...(active.songId ? { songId: active.songId } : {}),
            startedAt: active.startedAt,
            endedAt: now,
            durationMs,
            wasRevision: active.wasRevision,
            segments: [...(Array.isArray(active.segments) ? active.segments : []), ...finalSegment],
          };
          return { activeStudySession: null, studySessions: [...state.studySessions.filter((item) => item.id !== session.id), session].slice(-5000) };
        });
        return completed;
      },
      recoverStudySession: (now = Date.now()) => set((state) => {
        const active = state.activeStudySession;
        if (!active || active.status !== 'running' || !Number.isFinite(now)) return state;
        if (state.activePomodoro?.phase === 'focus' && state.activePomodoro.status === 'running') return state;
        const checkpointAt = Number.isFinite(active.lastCheckpointAt) ? active.lastCheckpointAt : (Number.isFinite(active.activeSince) ? active.activeSince as number : now);
        const recoveredTail = Math.min(Math.max(0, now - checkpointAt), 30_000);
        const recoveryEnd = Math.min(now, checkpointAt + recoveredTail);
        const recoveryStart = Number.isFinite(active.activeSince) ? active.activeSince as number : checkpointAt;
        const recoveredSegment = recoveryEnd > recoveryStart ? [{ startedAt: recoveryStart, endedAt: recoveryEnd }] : [];
        const accumulatedMs = Math.max(0, Number.isFinite(active.accumulatedMs) ? active.accumulatedMs : 0);
        return { activeStudySession: { ...active, accumulatedMs: accumulatedMs + recoveredTail, segments: [...(Array.isArray(active.segments) ? active.segments : []), ...recoveredSegment], activeSince: null, lastCheckpointAt: now, status: 'paused' } };
      }),
      recoverPomodoro: (now = Date.now()) => {
        const active = get().activePomodoro;
        if (active?.phase === 'focus' && active.status === 'running' && active.phaseEndsAt !== null && Number.isFinite(now) && now >= active.phaseEndsAt) {
          get().completePomodoroPhase(now);
        }
      },
      getPomodoroSettings: (userId) => safePomodoroSettings(get().pomodoroSettings?.[userId]),
      updatePomodoroSettings: (userId, patch) => set((state) => {
        if (!userId || !patch || typeof patch !== 'object') return state;
        return { pomodoroSettings: { ...(state.pomodoroSettings ?? {}), [userId]: safePomodoroSettings({ ...(state.pomodoroSettings?.[userId] ?? defaultPomodoroSettings), ...patch }) } };
      }),
      startPomodoroFocus: (userId, subject, topic, songId, now = Date.now()) => {
        if (!userId || !subject?.trim() || !topic?.trim() || !Number.isFinite(now)) return false;
        const existingPomodoro = get().activePomodoro;
        if (existingPomodoro && (existingPomodoro.status === 'running' || existingPomodoro.status === 'paused')) return false;
        if (get().activeStudySession) return false;
        const started = get().startStudySession({ userId, subject, topic, ...(songId ? { songId } : {}), wasRevision: false }, now);
        if (!started) return false;
        const studySession = get().activeStudySession;
        if (!studySession) return false;
        const durationMs = get().getPomodoroSettings(userId).focusMinutes * 60_000;
        set({ activePomodoro: {
          id: studySession.id,
          userId,
          subject: studySession.subject,
          topic: studySession.topic,
          ...(songId ? { songId } : {}),
          phase: 'focus',
          status: 'running',
          phaseStartedAt: now,
          phaseEndsAt: now + durationMs,
          durationMs,
          remainingMs: durationMs,
          studySessionId: studySession.id,
        } });
        return true;
      },
      pausePomodoro: (now = Date.now()) => {
        let active = get().activePomodoro;
        if (!active || active.status !== 'running' || !Number.isFinite(now)) return;
        if (active.phaseEndsAt !== null && now >= active.phaseEndsAt) {
          get().completePomodoroPhase(now);
          return;
        }
        if (active.phase === 'focus') get().pauseStudySession(now);
        active = get().activePomodoro;
        if (!active || active.status !== 'running') return;
        set({ activePomodoro: { ...active, status: 'paused', phaseEndsAt: null, remainingMs: active.phaseEndsAt === null ? active.remainingMs : Math.max(0, active.phaseEndsAt - now), returnNoticeMs: undefined } });
      },
      resumePomodoro: (userId, now = Date.now()) => {
        const active = get().activePomodoro;
        if (!active || active.userId !== userId || active.status !== 'paused' || !Number.isFinite(now)) return false;
        if (active.phase === 'focus' && !get().resumeStudySession(userId, now)) return false;
        const remainingMs = Math.max(0, active.remainingMs);
        if (remainingMs === 0) {
          set({ activePomodoro: { ...active, status: 'awaiting', phase: active.phase === 'focus' ? 'focusComplete' : 'breakComplete', phaseEndsAt: null } });
          return true;
        }
        set({ activePomodoro: { ...active, status: 'running', phaseEndsAt: now + remainingMs, remainingMs, returnNoticeMs: undefined } });
        return true;
      },
      startPomodoroBreak: (userId, phase, now = Date.now()) => {
        const active = get().activePomodoro;
        if (!active || active.userId !== userId || active.phase !== 'focusComplete' || active.status !== 'awaiting' || !Number.isFinite(now)) return false;
        const settings = get().getPomodoroSettings(userId);
        const completedCount = (get().pomodoroFocusRecords ?? []).filter((record) => record.userId === userId && record.status === 'completed').length;
        const longBreakDue = shouldTakeLongBreak(completedCount, settings.longBreakInterval);
        if (phase === 'longBreak' && !longBreakDue) return false;
        const durationMs = (phase === 'longBreak' ? settings.longBreakMinutes : settings.shortBreakMinutes) * 60_000;
        set({ activePomodoro: { ...active, phase, status: 'running', phaseStartedAt: now, phaseEndsAt: now + durationMs, durationMs, remainingMs: durationMs, returnNoticeMs: undefined } });
        return true;
      },
      skipPomodoroBreak: (now = Date.now()) => {
        let active = get().activePomodoro;
        if (!active || !['shortBreak', 'longBreak'].includes(active.phase) || !['running', 'paused'].includes(active.status) || !Number.isFinite(now)) return;
        if (active.status === 'running' && active.phaseEndsAt !== null && now >= active.phaseEndsAt) {
          get().completePomodoroPhase(now);
          return;
        }
        const record: PomodoroBreakRecord = {
          id: `${active.id}-${active.phase}`,
          userId: active.userId,
          phase: active.phase as 'shortBreak' | 'longBreak',
          startedAt: active.phaseStartedAt ?? now,
          endedAt: now,
          plannedDurationMs: active.durationMs,
          status: 'skipped',
        };
        set((state) => ({
          activePomodoro: state.activePomodoro?.id === active?.id ? { ...state.activePomodoro, phase: 'breakComplete', status: 'awaiting', phaseEndsAt: null, remainingMs: 0 } : state.activePomodoro,
          pomodoroBreakRecords: state.pomodoroBreakRecords.some((item) => item.id === record.id) ? state.pomodoroBreakRecords : [...state.pomodoroBreakRecords, record].slice(-5000),
        }));
      },
      completePomodoroPhase: (now = Date.now()) => {
        const active = get().activePomodoro;
        if (!active || active.status !== 'running' || active.phaseEndsAt === null || !Number.isFinite(now) || now < active.phaseEndsAt) return false;
        const endedAt = active.phaseEndsAt;
        if (active.phase === 'focus') {
          get().completeStudySession(active.userId, endedAt);
          const session = get().studySessions.find((item) => item.id === active.studySessionId);
          const focusRecord: PomodoroFocusRecord = {
            id: active.id,
            userId: active.userId,
            subject: active.subject,
            topic: active.topic,
            ...(active.songId ? { songId: active.songId } : {}),
            ...(active.studySessionId ? { studySessionId: active.studySessionId } : {}),
            startedAt: active.phaseStartedAt ?? endedAt - active.durationMs,
            endedAt,
            plannedDurationMs: active.durationMs,
            activeDurationMs: session?.durationMs ?? active.durationMs,
            status: 'completed',
          };
          set((state) => ({
            activePomodoro: state.activePomodoro?.id === active.id ? { ...state.activePomodoro, phase: 'focusComplete', status: 'awaiting', phaseEndsAt: null, remainingMs: 0 } : state.activePomodoro,
            pomodoroFocusRecords: state.pomodoroFocusRecords.some((item) => item.id === focusRecord.id) ? state.pomodoroFocusRecords : [...state.pomodoroFocusRecords, focusRecord].slice(-5000),
          }));
          return true;
        }
        if (active.phase === 'shortBreak' || active.phase === 'longBreak') {
          const breakRecord: PomodoroBreakRecord = {
            id: `${active.id}-${active.phase}`,
            userId: active.userId,
            phase: active.phase,
            startedAt: active.phaseStartedAt ?? endedAt - active.durationMs,
            endedAt,
            plannedDurationMs: active.durationMs,
            status: 'completed',
          };
          set((state) => ({
            activePomodoro: state.activePomodoro?.id === active.id ? { ...state.activePomodoro, phase: 'breakComplete', status: 'awaiting', phaseEndsAt: null, remainingMs: 0 } : state.activePomodoro,
            pomodoroBreakRecords: state.pomodoroBreakRecords.some((item) => item.id === breakRecord.id) ? state.pomodoroBreakRecords : [...state.pomodoroBreakRecords, breakRecord].slice(-5000),
          }));
          return true;
        }
        return false;
      },
      endPomodoro: (userId, now = Date.now()) => {
        let active = get().activePomodoro;
        if (!active || active.userId !== userId || !Number.isFinite(now)) return false;
        if (active.status === 'running' && active.phaseEndsAt !== null && now >= active.phaseEndsAt) {
          get().completePomodoroPhase(now);
          set({ activePomodoro: null });
          return true;
        }
        if (active.phase === 'focus') {
          get().completeStudySession(userId, now);
          const session = get().studySessions.find((item) => item.id === active.studySessionId);
          const activeDurationMs = session?.durationMs ?? 0;
          const focusRecord: PomodoroFocusRecord = {
            id: active.id,
            userId,
            subject: active.subject,
            topic: active.topic,
            ...(active.songId ? { songId: active.songId } : {}),
            ...(active.studySessionId ? { studySessionId: active.studySessionId } : {}),
            startedAt: active.phaseStartedAt ?? now - active.durationMs,
            endedAt: now,
            plannedDurationMs: active.durationMs,
            activeDurationMs,
            status: activeDurationMs > 0 ? 'partial' : 'abandoned',
          };
          set((state) => ({
            activePomodoro: null,
            pomodoroFocusRecords: state.pomodoroFocusRecords.some((item) => item.id === focusRecord.id) ? state.pomodoroFocusRecords : [...state.pomodoroFocusRecords, focusRecord].slice(-5000),
          }));
          return true;
        }
        if (active.phase === 'shortBreak' || active.phase === 'longBreak') get().skipPomodoroBreak(now);
        set({ activePomodoro: null });
        return true;
      },
      notePomodoroBackground: (now = Date.now()) => set((state) => {
        const active = state.activePomodoro;
        if (!active || active.status !== 'running' || !Number.isFinite(now) || active.awayStartedAt !== undefined) return state;
        return { activePomodoro: { ...active, awayStartedAt: now, returnNoticeMs: undefined } };
      }),
      notePomodoroForeground: (now = Date.now()) => {
        const current = get().activePomodoro;
        if (current?.status === 'running' && current.phaseEndsAt !== null && now >= current.phaseEndsAt) get().completePomodoroPhase(now);
        set((state) => {
          const active = state.activePomodoro;
          if (!active || active.awayStartedAt === undefined) return state;
          const awayMs = Math.max(0, now - active.awayStartedAt);
          const enabled = get().getPomodoroSettings(active.userId).returnNotificationsEnabled;
          return { activePomodoro: { ...active, awayStartedAt: undefined, returnNoticeMs: enabled && active.phase === 'focus' && active.status === 'running' && awayMs >= 10_000 ? awayMs : undefined } };
        });
      },
      dismissPomodoroReturnNotice: () => set((state) => state.activePomodoro?.returnNoticeMs === undefined ? state : { activePomodoro: { ...state.activePomodoro, returnNoticeMs: undefined } }),
      setDailyGoalMinutes: (userId, minutes) => set((state) => {
        if (!userId || !Number.isFinite(minutes)) return state;
        const studyGoals = state.studyGoals ?? {};
        const current = studyGoals[userId] ?? { dailyGoalMinutes: 30, weeklyGoalMinutes: 180 };
        return { studyGoals: { ...studyGoals, [userId]: { ...current, dailyGoalMinutes: Math.min(240, Math.max(5, Math.round(minutes))) } } };
      }),
      setWeeklyGoalMinutes: (userId, minutes) => set((state) => {
        if (!userId || !Number.isFinite(minutes)) return state;
        const studyGoals = state.studyGoals ?? {};
        const current = studyGoals[userId] ?? { dailyGoalMinutes: 30, weeklyGoalMinutes: 180 };
        return { studyGoals: { ...studyGoals, [userId]: { ...current, weeklyGoalMinutes: Math.min(1680, Math.max(30, Math.round(minutes))) } } };
      }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      clearLocalData: () => set({ songs: [], quizCount: 0, completedToday: 0, topicProgress: {}, topicProgressEvents: [], studySessions: [], activeStudySession: null, pomodoroSettings: {}, activePomodoro: null, pomodoroFocusRecords: [], pomodoroBreakRecords: [], quizAttempts: [], studyGoals: {}, ncertBookLinks: [] }),
    }),
    {
      name: 'learnbeats-local-v1',
      storage: createJSONStorage(() => Storage),
      partialize: (state) => ({
        songs: state.songs,
        quizCount: state.quizCount,
        completedToday: state.completedToday,
        topicProgress: state.topicProgress,
        topicProgressEvents: state.topicProgressEvents,
        studySessions: state.studySessions,
        activeStudySession: state.activeStudySession,
        pomodoroSettings: state.pomodoroSettings,
        activePomodoro: state.activePomodoro,
        pomodoroFocusRecords: state.pomodoroFocusRecords,
        pomodoroBreakRecords: state.pomodoroBreakRecords,
        quizAttempts: state.quizAttempts,
        studyGoals: state.studyGoals,
        ncertBookLinks: state.ncertBookLinks,
      }) as AppState,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.recoverStudySession();
        state.setHasHydrated(true);
      },
    },
  ),
);
