export type CountdownStatus = 'running' | 'paused' | 'awaiting';

export function remainingPomodoroMs(status: CountdownStatus, phaseEndsAt: number | null, savedRemainingMs: number, now: number) {
  if (!Number.isFinite(now)) return Math.max(0, Number.isFinite(savedRemainingMs) ? savedRemainingMs : 0);
  if (status !== 'running' || phaseEndsAt === null || !Number.isFinite(phaseEndsAt)) {
    return Math.max(0, Number.isFinite(savedRemainingMs) ? savedRemainingMs : 0);
  }
  return Math.max(0, phaseEndsAt - now);
}

export function isPomodoroExpired(status: CountdownStatus, phaseEndsAt: number | null, now: number) {
  return status === 'running' && phaseEndsAt !== null && Number.isFinite(phaseEndsAt) && Number.isFinite(now) && now >= phaseEndsAt;
}

export function shouldTakeLongBreak(completedFocusCount: number, longBreakInterval: number) {
  return Number.isInteger(completedFocusCount)
    && completedFocusCount > 0
    && Number.isInteger(longBreakInterval)
    && longBreakInterval >= 1
    && completedFocusCount % longBreakInterval === 0;
}

export function pomodoroProgress(durationMs: number, remainingMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(remainingMs)) return 0;
  return Math.min(1, Math.max(0, 1 - Math.max(0, remainingMs) / durationMs));
}

export function formatPomodoroClock(milliseconds: number) {
  const seconds = Math.ceil(Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
