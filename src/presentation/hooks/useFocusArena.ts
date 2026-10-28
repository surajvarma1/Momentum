/**
 * View Model hook for Focus Arena.
 *
 * Implements the timestamp-based state machine and AppState observation:
 * - Never calculates time using ticks; strictly measures wall-clock differences.
 * - Backgrounding the app is an ordinary lifecycle transition.
 * - Optional supportive interruption check on return to foreground.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useServices } from './useServices';
import { FocusSession, FocusState } from '../../domain/focus/FocusSession';
import { FocusStateMachine } from '../../domain/focus/FocusStateMachine';
import { useSettingsStore } from '../stores/settingsStore';

export interface UseFocusArenaResult {
  session: FocusSession | null;
  state: FocusState;
  remainingMs: number;
  elapsedMs: number;
  formattedRemaining: string;
  formattedElapsed: string;
  progressPercent: number;
  isFocusing: boolean;
  isPaused: boolean;
  isBreak: boolean;
  interruptionPrompt: { visible: boolean; awayDurationSeconds: number } | null;
  startSession: (taskId?: string | null) => Promise<void>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  startBreak: () => Promise<void>;
  completeSession: () => Promise<void>;
  cancelSession: (reason?: string) => Promise<void>;
  confirmInterruption: (affected: boolean, reason?: string) => Promise<void>;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useFocusArena(): UseFocusArenaResult {
  const services = useServices();
  const {
    focusDurationMinutes,
    breakDurationMinutes,
    focusAccountabilityEnabled,
  } = useSettingsStore();

  const [session, setSession] = useState<FocusSession | null>(null);
  const [displayNow, setDisplayNow] = useState(services.clock.now());
  const [interruptionPrompt, setInterruptionPrompt] = useState<{
    visible: boolean;
    awayDurationSeconds: number;
  } | null>(null);

  const backgroundTimeRef = useRef<number | null>(null);

  // Load and reconcile active session on mount
  const loadActiveSession = useCallback(async () => {
    if (!services.manageFocusSession) return;
    try {
      const active = await services.manageFocusSession.getActiveSession();
      setSession(active);
    } catch {
      // Handled
    }
  }, [services]);

  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

  // Visual clock tick (UI animation display only — elapsed calculation is purely timestamp-based)
  useEffect(() => {
    if (!session || (session.state !== FocusState.FOCUSING && session.state !== FocusState.BREAK)) {
      return;
    }

    const interval = setInterval(() => {
      const now = services.clock.now();
      setDisplayNow(now);

      // Check if session completed during active view
      const remaining = FocusStateMachine.getRemainingFocusMs(session, now);
      if (remaining <= 0 && session.state === FocusState.FOCUSING) {
        services.manageFocusSession?.complete(session.id).then((updated) => {
          setSession(updated);
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, services]);

  // AppState observation: observe lifecycle without punitive classification
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const nowMs = Date.now();

      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimeRef.current = nowMs;
      } else if (nextState === 'active') {
        const bgTime = backgroundTimeRef.current;
        backgroundTimeRef.current = null;

        // Reconcile session state upon foregrounding
        if (session && services.manageFocusSession) {
          const active = await services.manageFocusSession.getActiveSession();
          setSession(active);

          // If session was actively focusing and user spent > 60s outside, ask supportively
          if (
            bgTime &&
            active &&
            active.state === FocusState.FOCUSING &&
            focusAccountabilityEnabled
          ) {
            const awaySeconds = Math.round((nowMs - bgTime) / 1000);
            if (awaySeconds >= 60) {
              setInterruptionPrompt({ visible: true, awayDurationSeconds: awaySeconds });
            }
          }
        }
      }
    });

    return () => subscription.remove();
  }, [session, services, focusAccountabilityEnabled]);

  const startSession = async (taskId?: string | null) => {
    if (!services.manageFocusSession) return;
    const targetMs = focusDurationMinutes * 60 * 1000;
    const breakMs = breakDurationMinutes * 60 * 1000;
    const newSession = await services.manageFocusSession.start(taskId, targetMs, breakMs);
    setSession(newSession);
    setDisplayNow(services.clock.now());
  };

  const pauseSession = async () => {
    if (!session || !services.manageFocusSession) return;
    const updated = await services.manageFocusSession.pause(session.id);
    setSession(updated);
  };

  const resumeSession = async () => {
    if (!session || !services.manageFocusSession) return;
    const updated = await services.manageFocusSession.resume(session.id);
    setSession(updated);
    setDisplayNow(services.clock.now());
  };

  const startBreak = async () => {
    if (!session || !services.manageFocusSession) return;
    const updated = await services.manageFocusSession.startBreak(session.id);
    setSession(updated);
    setDisplayNow(services.clock.now());
  };

  const completeSession = async () => {
    if (!session || !services.manageFocusSession) return;
    const updated = await services.manageFocusSession.complete(session.id);
    setSession(updated);
  };

  const cancelSession = async (reason?: string) => {
    if (!session || !services.manageFocusSession) return;
    const updated = await services.manageFocusSession.cancel(session.id, reason);
    setSession(updated);
  };

  const confirmInterruption = async (affected: boolean, reason?: string) => {
    setInterruptionPrompt(null);
    if (!session || !services.manageFocusSession) return;
    if (affected) {
      await services.manageFocusSession.logInterruption(
        session.id,
        reason || 'Interrupted while in background',
      );
    }
  };

  const currentState = session ? session.state : FocusState.IDLE;
  const elapsedMs = session ? FocusStateMachine.getElapsedFocusMs(session, displayNow) : 0;
  const targetMs = session ? session.targetDurationMs : focusDurationMinutes * 60 * 1000;
  const remainingMs = session ? FocusStateMachine.getRemainingFocusMs(session, displayNow) : targetMs;

  const progressPercent = targetMs > 0 ? Math.min(100, Math.round((elapsedMs / targetMs) * 100)) : 0;

  return {
    session,
    state: currentState,
    remainingMs,
    elapsedMs,
    formattedRemaining: formatTime(remainingMs),
    formattedElapsed: formatTime(elapsedMs),
    progressPercent,
    isFocusing: currentState === FocusState.FOCUSING,
    isPaused: currentState === FocusState.PAUSED,
    isBreak: currentState === FocusState.BREAK,
    interruptionPrompt,
    startSession,
    pauseSession,
    resumeSession,
    startBreak,
    completeSession,
    cancelSession,
    confirmInterruption,
  };
}
