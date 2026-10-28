/**
 * Focus Session State Machine & Timestamp Reconciliation Engine.
 *
 * Invariant:
 * Elapsed focus time is strictly computed from wall-clock timestamps:
 * Elapsed = (Current Time - Start Time) - Accumulated Paused Duration.
 * Never relies on background JS timer callbacks.
 */

import { FocusSession, FocusState } from './FocusSession';

const VALID_FOCUS_TRANSITIONS: Record<FocusState, FocusState[]> = {
  IDLE: ['FOCUSING'],
  FOCUSING: ['PAUSED', 'BREAK', 'COMPLETED', 'CANCELLED'],
  PAUSED: ['FOCUSING', 'CANCELLED'],
  BREAK: ['FOCUSING', 'COMPLETED', 'CANCELLED', 'IDLE'],
  COMPLETED: ['IDLE'],
  CANCELLED: ['IDLE'],
};

export class FocusStateMachine {
  static canTransition(from: FocusState, to: FocusState): boolean {
    return VALID_FOCUS_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * Calculates the exact elapsed active focus time in milliseconds using wall-clock timestamps.
   */
  static getElapsedFocusMs(session: FocusSession, nowIso: string): number {
    if (session.state === FocusState.IDLE) return 0;

    const startMs = new Date(session.startTime).getTime();
    const nowMs = new Date(nowIso).getTime();

    if (session.state === FocusState.PAUSED && session.pauseTime) {
      const pauseMs = new Date(session.pauseTime).getTime();
      return Math.max(0, pauseMs - startMs - session.accumulatedPausedMs);
    }

    if (session.state === FocusState.COMPLETED || session.state === FocusState.CANCELLED) {
      return session.actualFocusDurationMs;
    }

    // FOCUSING or BREAK
    const totalElapsed = nowMs - startMs;
    return Math.max(0, totalElapsed - session.accumulatedPausedMs);
  }

  /**
   * Calculates remaining focus time in milliseconds.
   */
  static getRemainingFocusMs(session: FocusSession, nowIso: string): number {
    const elapsed = this.getElapsedFocusMs(session, nowIso);
    return Math.max(0, session.targetDurationMs - elapsed);
  }

  /**
   * Initializes a new session in FOCUSING state.
   */
  static start(
    id: string,
    nowIso: string,
    taskId?: string | null,
    targetDurationMs: number = 25 * 60 * 1000,
    breakDurationMs: number = 5 * 60 * 1000,
    notes?: string | null,
  ): FocusSession {
    return {
      id,
      taskId: taskId ?? null,
      state: FocusState.FOCUSING,
      targetDurationMs,
      breakDurationMs,
      startTime: nowIso,
      pauseTime: null,
      accumulatedPausedMs: 0,
      completedAt: null,
      cancelledAt: null,
      actualFocusDurationMs: 0,
      notes: notes ?? null,
      interruptionLogged: false,
      interruptionReason: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  /**
   * Transitions from FOCUSING to PAUSED.
   */
  static pause(session: FocusSession, nowIso: string): FocusSession {
    if (!this.canTransition(session.state, FocusState.PAUSED)) {
      throw new Error(`Cannot transition focus session from ${session.state} to PAUSED`);
    }

    return {
      ...session,
      state: FocusState.PAUSED,
      pauseTime: nowIso,
      updatedAt: nowIso,
    };
  }

  /**
   * Transitions from PAUSED back to FOCUSING.
   * Calculates the delta paused time and accumulates it.
   */
  static resume(session: FocusSession, nowIso: string): FocusSession {
    if (!this.canTransition(session.state, FocusState.FOCUSING)) {
      throw new Error(`Cannot transition focus session from ${session.state} to FOCUSING`);
    }

    let additionalPausedMs = 0;
    if (session.pauseTime) {
      const pauseMs = new Date(session.pauseTime).getTime();
      const resumeMs = new Date(nowIso).getTime();
      additionalPausedMs = Math.max(0, resumeMs - pauseMs);
    }

    return {
      ...session,
      state: FocusState.FOCUSING,
      pauseTime: null,
      accumulatedPausedMs: session.accumulatedPausedMs + additionalPausedMs,
      updatedAt: nowIso,
    };
  }

  /**
   * Transitions session to BREAK.
   */
  static startBreak(session: FocusSession, nowIso: string): FocusSession {
    if (!this.canTransition(session.state, FocusState.BREAK)) {
      throw new Error(`Cannot transition focus session from ${session.state} to BREAK`);
    }

    const elapsed = this.getElapsedFocusMs(session, nowIso);

    return {
      ...session,
      state: FocusState.BREAK,
      pauseTime: null,
      actualFocusDurationMs: elapsed,
      updatedAt: nowIso,
    };
  }

  /**
   * Transitions session to COMPLETED.
   */
  static complete(session: FocusSession, nowIso: string): FocusSession {
    if (!this.canTransition(session.state, FocusState.COMPLETED)) {
      throw new Error(`Cannot transition focus session from ${session.state} to COMPLETED`);
    }

    const elapsed = this.getElapsedFocusMs(session, nowIso);

    return {
      ...session,
      state: FocusState.COMPLETED,
      pauseTime: null,
      completedAt: nowIso,
      actualFocusDurationMs: elapsed,
      updatedAt: nowIso,
    };
  }

  /**
   * Transitions session to CANCELLED.
   */
  static cancel(session: FocusSession, nowIso: string, reason?: string): FocusSession {
    if (!this.canTransition(session.state, FocusState.CANCELLED)) {
      throw new Error(`Cannot transition focus session from ${session.state} to CANCELLED`);
    }

    const elapsed = this.getElapsedFocusMs(session, nowIso);

    return {
      ...session,
      state: FocusState.CANCELLED,
      cancelledAt: nowIso,
      actualFocusDurationMs: elapsed,
      interruptionReason: reason ?? session.interruptionReason,
      updatedAt: nowIso,
    };
  }

  /**
   * Reconciles a session after application suspension / process restart.
   * If the app was suspended during FOCUSING and the target duration elapsed,
   * automatically marks it completed or prepares the break.
   */
  static reconcileSuspendedSession(session: FocusSession, nowIso: string): FocusSession {
    if (session.state !== FocusState.FOCUSING) {
      return session;
    }

    const elapsedMs = this.getElapsedFocusMs(session, nowIso);
    if (elapsedMs >= session.targetDurationMs) {
      // The session goal was met while suspended
      const completionTimeMs =
        new Date(session.startTime).getTime() +
        session.accumulatedPausedMs +
        session.targetDurationMs;
      const completedAt = new Date(completionTimeMs).toISOString();

      return {
        ...session,
        state: FocusState.COMPLETED,
        completedAt,
        actualFocusDurationMs: session.targetDurationMs,
        updatedAt: nowIso,
      };
    }

    return session;
  }
}
