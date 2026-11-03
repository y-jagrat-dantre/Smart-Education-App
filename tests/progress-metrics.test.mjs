import test from 'node:test';
import assert from 'node:assert/strict';
import { decodedBase64ByteLength, MAX_PDF_BYTES, pdfByteLength } from '../src/features/learning/base64.ts';
import {
  buildStudyBuckets,
  calculateStreaks,
  completedTopicsAt,
  dailyStudyMap,
  localDayStart,
  localDateKey,
  studyTimeBetween,
  studyTimeBySubjectBetween,
} from '../src/features/progress/metrics.ts';

const session = (id, userId, startedAt, endedAt) => ({
  id,
  userId,
  subject: 'Math',
  topic: 'Algebra',
  startedAt,
  endedAt,
  durationMs: endedAt - startedAt,
  wasRevision: false,
  segments: [{ startedAt, endedAt }],
});

test('study totals ignore other users and merge overlapping session segments', () => {
  const sessions = [
    session('a', 'student-a', 1_000, 4_000),
    session('b', 'student-a', 3_000, 5_000),
    session('private', 'student-b', 1_000, 9_000),
  ];
  const active = {
    id: 'active', userId: 'student-a', subject: 'Math', topic: 'Algebra', startedAt: 4_500,
    activeSince: null, lastCheckpointAt: 6_500, accumulatedMs: 2_000,
    segments: [{ startedAt: 4_500, endedAt: 6_500 }], status: 'paused', wasRevision: false,
  };
  assert.equal(studyTimeBetween(sessions, active, 'student-a', 0, 10_000, 10_000), 5_500);
  assert.equal(studyTimeBetween(sessions, active, 'student-b', 0, 10_000, 10_000), 8_000);
});

test('subject breakdown attributes overlapping minutes once so shares sum to tracked time', () => {
  const sessions = [
    session('math', 'student-a', 1_000, 4_000),
    { ...session('science', 'student-a', 3_000, 6_000), subject: 'Science' },
  ];
  const bySubject = studyTimeBySubjectBetween(sessions, null, 'student-a', 0, 10_000, 10_000);
  assert.equal(bySubject.get('Math'), 3_000);
  assert.equal(bySubject.get('Science'), 2_000);
  assert.equal([...bySubject.values()].reduce((sum, value) => sum + value, 0), studyTimeBetween(sessions, null, 'student-a', 0, 10_000, 10_000));
});

test('paused time is excluded while live time is included only after resume', () => {
  const active = {
    id: 'active', userId: 'student-a', subject: 'Math', topic: 'Algebra', startedAt: 1_000,
    activeSince: null, lastCheckpointAt: 5_000, accumulatedMs: 2_000,
    segments: [{ startedAt: 1_000, endedAt: 3_000 }], status: 'paused', wasRevision: false,
  };
  assert.equal(studyTimeBetween([], active, 'student-a', 0, 8_000, 8_000), 2_000);
  assert.equal(studyTimeBetween([], { ...active, activeSince: 5_000, status: 'running' }, 'student-a', 0, 8_000, 8_000), 5_000);
});

test('calendar day totals split a session at the local midnight boundary', () => {
  const firstDay = localDayStart(new Date(2025, 2, 1, 12));
  const secondDayDate = new Date(firstDay);
  secondDayDate.setDate(secondDayDate.getDate() + 1);
  const secondDay = secondDayDate.getTime();
  const thirdDayDate = new Date(secondDay);
  thirdDayDate.setDate(thirdDayDate.getDate() + 1);
  const thirdDay = thirdDayDate.getTime();
  const start = firstDay + 23 * 60 * 60_000 + 55 * 60_000;
  const sessions = [session('overnight', 'student-a', start, start + 10 * 60_000)];
  assert.equal(studyTimeBetween(sessions, null, 'student-a', firstDay, secondDay, start + 10 * 60_000), 5 * 60_000);
  assert.equal(studyTimeBetween(sessions, null, 'student-a', secondDay, thirdDay, start + 10 * 60_000), 5 * 60_000);
});

test('activity heatmap values are derived from saved timer segments by local date', () => {
  const today = localDayStart(new Date(2025, 6, 10, 12));
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = yesterday.getTime();
  const sessions = [session('yesterday', 'student-a', yesterdayStart + 9 * 60 * 60_000, yesterdayStart + 10 * 60 * 60_000)];
  const map = dailyStudyMap(sessions, null, 'student-a', 3, today + 12 * 60 * 60_000);
  assert.equal(map.get(localDateKey(yesterdayStart)), 60 * 60_000);
  assert.equal(map.get(localDateKey(today)), 0);
});

test('streaks require five active minutes and break on a missed day', () => {
  const today = localDayStart(new Date(2025, 0, 8, 12));
  const atLocalHour = (dayOffset) => {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(10, 0, 0, 0);
    return date.getTime();
  };
  const sessions = [
    session('too-short', 'student-a', atLocalHour(-4), atLocalHour(-4) + 4 * 60_000),
    session('day-6', 'student-a', atLocalHour(-2), atLocalHour(-2) + 5 * 60_000),
    session('day-7', 'student-a', atLocalHour(-1), atLocalHour(-1) + 7 * 60_000),
  ];
  const result = calculateStreaks(sessions, 'student-a', today + 12 * 60 * 60_000);
  assert.equal(result.currentStreak, 2);
  assert.equal(result.longestStreak, 2);
});

test('topic history only counts topics created by the selected date and uses the latest status', () => {
  const topics = [{ id: 'one', createdAt: 100 }, { id: 'two', createdAt: 250 }];
  const events = [
    { songId: 'one', userId: 'student-a', status: 'notStarted', at: 100 },
    { songId: 'one', userId: 'student-a', status: 'completed', at: 200 },
    { songId: 'one', userId: 'student-a', status: 'inProgress', at: 300 },
    { songId: 'two', userId: 'student-b', status: 'completed', at: 260 },
  ];
  assert.equal(completedTopicsAt(events, topics, 'student-a', 250), 1);
  assert.equal(completedTopicsAt(events, topics, 'student-a', 350), 0);
});

test('study range controls return the requested calendar bucket counts', () => {
  const now = new Date(2025, 4, 14, 12).getTime();
  assert.equal(buildStudyBuckets('daily', now).length, 7);
  assert.equal(buildStudyBuckets('weekly', now).length, 4);
  assert.equal(buildStudyBuckets('monthly', now).length, 6);
  assert.ok(buildStudyBuckets('daily', now)[6].start >= localDayStart(now));
});

test('PDF size checks decode base64 bytes and strip browser data URLs', () => {
  assert.equal(decodedBase64ByteLength('AA=='), 1);
  assert.equal(decodedBase64ByteLength('AAA='), 2);
  assert.equal(decodedBase64ByteLength('data:application/pdf;base64,AAAA'), 3);
  assert.equal(decodedBase64ByteLength('AA==\n'), 1);
  assert.equal(decodedBase64ByteLength('not base64!'), null);
  assert.equal(decodedBase64ByteLength('A='), null);
  assert.equal(MAX_PDF_BYTES, 5 * 1024 * 1024);
  assert.equal(decodedBase64ByteLength(`${'A'.repeat(1_733_334)}==`), 1_300_000);
  assert.equal(decodedBase64ByteLength(`${'A'.repeat(6_990_507)}=`), MAX_PDF_BYTES);
  assert.equal(decodedBase64ByteLength('A'.repeat(6_990_508)), MAX_PDF_BYTES + 1);
  assert.equal(pdfByteLength(1_300_000, 'A'.repeat(7_000_000)), 1_300_000);
  assert.equal(pdfByteLength(undefined, 'AAAA'), 3);
});
