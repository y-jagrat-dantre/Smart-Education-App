import type { ActiveStudySession, StudySegment, StudySession, TopicProgressEvent } from '@/state/app-store';

export const MIN_STREAK_DAY_MS = 5 * 60 * 1000;
const MAX_VALID_SESSION_MS = 24 * 60 * 60 * 1000;
export type StudyRange = 'daily' | 'weekly' | 'monthly';
export type StudyBucket = { key: string; label: string; start: number; end: number };

export function validStudySegments(session: StudySession): StudySegment[] {
  const saved = Array.isArray(session.segments)
    ? session.segments.filter(isValidSegment)
    : [];
  if (saved.length) return saved;
  if (!Number.isFinite(session.durationMs) || session.durationMs <= 0 || session.durationMs > MAX_VALID_SESSION_MS || !Number.isFinite(session.endedAt)) return [];
  return [{ startedAt: session.endedAt - session.durationMs, endedAt: session.endedAt }];
}

export function activeDurationMs(session: ActiveStudySession | null, userId: string, now = Date.now()) {
  if (!session || session.userId !== userId) return 0;
  const current = session.status === 'running' && session.activeSince !== null ? Math.max(0, now - session.activeSince) : 0;
  const total = Math.max(0, session.accumulatedMs) + current;
  return Number.isFinite(total) ? Math.min(total, MAX_VALID_SESSION_MS) : 0;
}

export function studyTimeBetween(
  sessions: StudySession[],
  active: ActiveStudySession | null,
  userId: string,
  start: number,
  end: number,
  now = Date.now(),
) {
  if (end <= start) return 0;
  const segments: StudySegment[] = [];
  const seenSessions = new Set<string>();
  for (const session of sessions) {
    if (session.userId !== userId || seenSessions.has(session.id)) continue;
    seenSessions.add(session.id);
    segments.push(...validStudySegments(session));
  }
  if (active?.userId === userId) {
    if (Array.isArray(active.segments)) segments.push(...active.segments);
    if (active.status === 'running' && active.activeSince !== null) segments.push({ startedAt: active.activeSince, endedAt: now });
  }
  return mergeSegments(segments).reduce((total, segment) => total + overlapMs(segment, start, Math.min(end, now)), 0);
}

export function studyTimeBySubjectBetween(
  sessions: StudySession[],
  active: ActiveStudySession | null,
  userId: string,
  start: number,
  end: number,
  now = Date.now(),
) {
  const result = new Map<string, number>();
  if (end <= start) return result;
  const tagged: { subject: string; segment: StudySegment }[] = [];
  const seenSessions = new Set<string>();
  for (const session of sessions) {
    if (session.userId !== userId || seenSessions.has(session.id)) continue;
    seenSessions.add(session.id);
    for (const segment of validStudySegments(session)) tagged.push({ subject: session.subject, segment });
  }
  if (active?.userId === userId) {
    for (const segment of active.segments ?? []) if (isValidSegment(segment)) tagged.push({ subject: active.subject, segment });
    if (active.status === 'running' && active.activeSince !== null) {
      const segment = { startedAt: active.activeSince, endedAt: now };
      if (isValidSegment(segment)) tagged.push({ subject: active.subject, segment });
    }
  }
  tagged.sort((a, b) => a.segment.startedAt - b.segment.startedAt || a.segment.endedAt - b.segment.endedAt);
  const effectiveEnd = Math.min(end, now);
  let coveredUntil = start;
  for (const item of tagged) {
    if (!item.subject.trim() || item.segment.endedAt <= start || item.segment.startedAt >= effectiveEnd) continue;
    const segmentEnd = Math.min(effectiveEnd, item.segment.endedAt);
    const attributedStart = Math.max(start, coveredUntil, item.segment.startedAt);
    if (segmentEnd > attributedStart) {
      result.set(item.subject, (result.get(item.subject) ?? 0) + segmentEnd - attributedStart);
      coveredUntil = segmentEnd;
    }
  }
  return result;
}

export function localDayStart(value: number | Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function localDateKey(value: number | Date) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfLocalWeek(value: number | Date) {
  const date = new Date(localDayStart(value));
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date.getTime();
}

export function formatStudyDuration(milliseconds: number) {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function buildStudyBuckets(range: StudyRange, now = Date.now()): StudyBucket[] {
  if (range === 'daily') {
    const today = localDayStart(now);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - index));
      const start = date.getTime();
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + 1);
      return { key: localDateKey(start), label: date.toLocaleDateString(undefined, { weekday: 'short' }), start, end: endDate.getTime() };
    });
  }
  if (range === 'weekly') {
    const thisWeek = startOfLocalWeek(now);
    return Array.from({ length: 4 }, (_, index) => {
      const date = new Date(thisWeek);
      date.setDate(date.getDate() - (3 - index) * 7);
      const start = date.getTime();
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + 7);
      return { key: localDateKey(start), label: index === 3 ? 'This week' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), start, end: endDate.getTime() };
    });
  }
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth() - (5 - index), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: date.toLocaleDateString(undefined, { month: 'short' }), start: date.getTime(), end: endDate.getTime() };
  });
}

export function calculateStreaks(sessions: StudySession[], userId: string, now = Date.now(), active: ActiveStudySession | null = null) {
  const allSegments = sessions.filter((session) => session.userId === userId).flatMap(validStudySegments);
  if (active?.userId === userId) {
    allSegments.push(...(Array.isArray(active.segments) ? active.segments : []));
    if (active.status === 'running' && active.activeSince !== null) allSegments.push({ startedAt: active.activeSince, endedAt: now });
  }
  const minutesByDay = new Map<string, number>();
  for (const segment of mergeSegments(allSegments)) {
    let cursor = segment.startedAt;
    while (cursor < segment.endedAt) {
      const dayStart = localDayStart(cursor);
      const nextDate = new Date(dayStart);
      nextDate.setDate(nextDate.getDate() + 1);
      const chunkEnd = Math.min(segment.endedAt, nextDate.getTime());
      const key = localDateKey(dayStart);
      minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + chunkEnd - cursor);
      cursor = chunkEnd;
    }
  }
  const activeDays = new Set([...minutesByDay.entries()].filter(([, duration]) => duration >= MIN_STREAK_DAY_MS).map(([day]) => day));
  const today = localDayStart(now);
  let currentStreak = 0;
  let cursor = activeDays.has(localDateKey(today)) ? today : previousLocalDay(today);
  while (activeDays.has(localDateKey(cursor))) {
    currentStreak += 1;
    cursor = previousLocalDay(cursor);
  }
  const sortedDays = [...activeDays].sort();
  let longestStreak = 0;
  let run = 0;
  let previous = '';
  for (const day of sortedDays) {
    const date = new Date(`${day}T00:00:00`);
    const ordinal = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
    const old = previous ? new Date(`${previous}T00:00:00`) : null;
    const oldOrdinal = old ? Date.UTC(old.getFullYear(), old.getMonth(), old.getDate()) / 86_400_000 : -2;
    run = ordinal === oldOrdinal + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }
  return { currentStreak, longestStreak, activeDays, minutesByDay };
}

export function dailyStudyMap(sessions: StudySession[], active: ActiveStudySession | null, userId: string, days = 365, now = Date.now()) {
  const from = localDayStart(now);
  const first = new Date(from);
  first.setDate(first.getDate() - Math.max(0, days - 1));
  const start = first.getTime();
  const endDate = new Date(from);
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate.getTime();
  const result = new Map<string, number>();
  for (let cursor = start; cursor < end;) {
    const next = new Date(cursor);
    next.setDate(next.getDate() + 1);
    result.set(localDateKey(cursor), 0);
    cursor = next.getTime();
  }
  const segments: StudySegment[] = [];
  const seenSessions = new Set<string>();
  for (const session of sessions) {
    if (session.userId !== userId || seenSessions.has(session.id)) continue;
    seenSessions.add(session.id);
    segments.push(...validStudySegments(session));
  }
  if (active?.userId === userId) {
    if (Array.isArray(active.segments)) segments.push(...active.segments);
    if (active.status === 'running' && active.activeSince !== null) segments.push({ startedAt: active.activeSince, endedAt: now });
  }
  for (const segment of mergeSegments(segments)) {
    let cursor = Math.max(start, segment.startedAt);
    const segmentEnd = Math.min(end, now, segment.endedAt);
    while (cursor < segmentEnd) {
      const next = new Date(localDayStart(cursor));
      next.setDate(next.getDate() + 1);
      const chunkEnd = Math.min(segmentEnd, next.getTime());
      const key = localDateKey(cursor);
      result.set(key, (result.get(key) ?? 0) + chunkEnd - cursor);
      cursor = chunkEnd;
    }
  }
  return result;
}

export type TopicSnapshot = { id: string; createdAt: number };

export function completedTopicsAt(events: TopicProgressEvent[], topics: TopicSnapshot[], userId: string, at: number) {
  const ids = new Set(topics.filter((topic) => topic.createdAt <= at).map((topic) => topic.id));
  const latest = new Map<string, TopicProgressEvent>();
  for (const event of events) {
    if (event.userId !== userId || !ids.has(event.songId) || event.at > at) continue;
    const prior = latest.get(event.songId);
    if (!prior || event.at >= prior.at) latest.set(event.songId, event);
  }
  return [...latest.values()].filter((event) => event.status === 'completed').length;
}

export function completionBuckets(events: TopicProgressEvent[], topics: TopicSnapshot[], userId: string, now = Date.now()) {
  const firstWeek = startOfLocalWeek(now);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(firstWeek);
    date.setDate(date.getDate() - (5 - index) * 7);
    const start = date.getTime();
    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + 7);
    const end = Math.min(endDate.getTime() - 1, now);
    const available = topics.filter((topic) => topic.createdAt <= end).length;
    return { label: new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), completed: completedTopicsAt(events, topics, userId, end), total: available, end };
  });
}

export function splitIntoMonthWeeks(now = Date.now(), days = 365) {
  const today = localDayStart(now);
  const first = new Date(today);
  first.setDate(first.getDate() - (days - 1));
  const mondayOffset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - mondayOffset);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);
  const weeks: number[][] = [];
  let cursor = first.getTime();
  while (cursor < end.getTime()) {
    const week: number[] = [];
    for (let day = 0; day < 7; day += 1) {
      week.push(cursor);
      const next = new Date(cursor);
      next.setDate(next.getDate() + 1);
      cursor = next.getTime();
    }
    weeks.push(week);
  }
  return weeks;
}

function previousLocalDay(value: number) {
  const date = new Date(value);
  date.setDate(date.getDate() - 1);
  return date.getTime();
}

function mergeSegments(input: StudySegment[]) {
  const sorted = input
    .filter(isValidSegment)
    .map((segment) => ({ startedAt: segment.startedAt, endedAt: segment.endedAt }))
    .sort((a, b) => a.startedAt - b.startedAt);
  const merged: StudySegment[] = [];
  for (const segment of sorted) {
    const last = merged[merged.length - 1];
    if (last && segment.startedAt <= last.endedAt) last.endedAt = Math.max(last.endedAt, segment.endedAt);
    else merged.push({ ...segment });
  }
  return merged;
}

function isValidSegment(segment: StudySegment) {
  return Number.isFinite(segment.startedAt) && Number.isFinite(segment.endedAt) && segment.endedAt > segment.startedAt && segment.endedAt - segment.startedAt <= MAX_VALID_SESSION_MS;
}

function overlapMs(segment: StudySegment, start: number, end: number) {
  if (!Number.isFinite(segment.startedAt) || !Number.isFinite(segment.endedAt) || segment.endedAt <= segment.startedAt) return 0;
  return Math.max(0, Math.min(segment.endedAt, end) - Math.max(segment.startedAt, start));
}
