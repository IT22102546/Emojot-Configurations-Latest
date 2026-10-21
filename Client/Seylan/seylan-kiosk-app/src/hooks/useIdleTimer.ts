import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'active' | 'warning';

type Options = {
  enabled: boolean;
  idleMs: number;
  warningMs: number;
  onTimeout: () => void;
};

/**
 * Idle → warning → timeout. Call `reset()` on every sign of activity.
 * While disabled, no timers run and the phase is "active".
 * With warningMs 0 there is no warning stage: idle leads straight to timeout.
 */
export function useIdleTimer({ enabled, idleMs, warningMs, onTimeout }: Options) {
  const [phase, setPhase] = useState<Phase>('active');
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(warningMs / 1000));

  // Each time the timer is switched on, start from a clean "active" phase.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    setPhase('active');
  }

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  });

  const clearTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (countdown.current) clearInterval(countdown.current);
    idleTimer.current = null;
    countdown.current = null;
  }, []);

  const startWarning = useCallback(() => {
    // No warning stage configured: time out straight away.
    if (warningMs <= 0) {
      clearTimers();
      onTimeoutRef.current();
      return;
    }

    const deadline = Date.now() + warningMs;
    setPhase('warning');
    setSecondsLeft(Math.ceil(warningMs / 1000));

    countdown.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearTimers();
        setPhase('active');
        onTimeoutRef.current();
      }
    }, 250);
  }, [warningMs, clearTimers]);

  const schedule = useCallback(() => {
    clearTimers();
    idleTimer.current = setTimeout(startWarning, idleMs);
  }, [idleMs, startWarning, clearTimers]);

  /** Activity: hide any warning and restart the idle countdown. */
  const reset = useCallback(() => {
    setPhase('active');
    if (enabled) schedule();
    else clearTimers();
  }, [enabled, schedule, clearTimers]);

  useEffect(() => {
    if (!enabled) return;
    schedule();
    return clearTimers;
  }, [enabled, schedule, clearTimers]);

  return { phase: enabled ? phase : ('active' as Phase), secondsLeft, reset };
}
