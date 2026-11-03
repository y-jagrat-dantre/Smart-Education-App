import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPomodoroClock,
  isPomodoroExpired,
  pomodoroProgress,
  remainingPomodoroMs,
  shouldTakeLongBreak,
} from '../src/features/pomodoro/timer.ts';

test('remaining time is derived from an end timestamp and stays at zero after the deadline', () => {
  assert.equal(remainingPomodoroMs('running', 90_000, 0, 30_000), 60_000);
  assert.equal(remainingPomodoroMs('running', 90_000, 0, 120_000), 0);
  assert.equal(isPomodoroExpired('running', 90_000, 90_000), true);
});

test('a paused countdown keeps its saved remainder regardless of wall time', () => {
  assert.equal(remainingPomodoroMs('paused', null, 42_000, 10_000), 42_000);
  assert.equal(isPomodoroExpired('paused', null, 999_999), false);
});

test('invalid or negative remaining time never produces a negative countdown', () => {
  assert.equal(remainingPomodoroMs('running', -50, 20_000, 0), 0);
  assert.equal(remainingPomodoroMs('paused', null, Number.NaN, 0), 0);
  assert.equal(formatPomodoroClock(-1), '00:00');
});

test('countdown rounds up a partial second for a readable display', () => {
  assert.equal(formatPomodoroClock(1), '00:01');
  assert.equal(formatPomodoroClock(61_001), '01:02');
});

test('long breaks occur only at each configured completed-session interval', () => {
  assert.equal(shouldTakeLongBreak(0, 4), false);
  assert.equal(shouldTakeLongBreak(3, 4), false);
  assert.equal(shouldTakeLongBreak(4, 4), true);
  assert.equal(shouldTakeLongBreak(8, 4), true);
  assert.equal(shouldTakeLongBreak(6, 3), true);
});

test('progress is bounded for expired, paused, and invalid durations', () => {
  assert.equal(pomodoroProgress(60_000, 30_000), 0.5);
  assert.equal(pomodoroProgress(60_000, 0), 1);
  assert.equal(pomodoroProgress(60_000, -10), 1);
  assert.equal(pomodoroProgress(0, 0), 0);
});
