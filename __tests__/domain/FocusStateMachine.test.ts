/**
 * Tests for Focus Session State Machine and Timestamp Invariants.
 */

import { FocusStateMachine } from '../../src/domain/focus/FocusStateMachine';
import { FocusState } from '../../src/domain/focus/FocusSession';

describe('FocusStateMachine', () => {
  const T0 = '2026-02-01T10:00:00.000Z'; // 10:00:00
  const T_PLUS_10M = '2026-02-01T10:10:00.000Z'; // 10:10:00 (+10m)
  const T_PLUS_15M = '2026-02-01T10:15:00.000Z'; // 10:15:00 (+15m)
  const T_PLUS_25M = '2026-02-01T10:25:00.000Z'; // 10:25:00 (+25m)
  const T_PLUS_30M = '2026-02-01T10:30:00.000Z'; // 10:30:00 (+30m)

  describe('State Transitions Invariants', () => {
    it('allows valid lifecycle transitions', () => {
      expect(FocusStateMachine.canTransition(FocusState.IDLE, FocusState.FOCUSING)).toBe(true);
      expect(FocusStateMachine.canTransition(FocusState.FOCUSING, FocusState.PAUSED)).toBe(true);
      expect(FocusStateMachine.canTransition(FocusState.PAUSED, FocusState.FOCUSING)).toBe(true);
      expect(FocusStateMachine.canTransition(FocusState.FOCUSING, FocusState.BREAK)).toBe(true);
      expect(FocusStateMachine.canTransition(FocusState.FOCUSING, FocusState.COMPLETED)).toBe(true);
      expect(FocusStateMachine.canTransition(FocusState.BREAK, FocusState.COMPLETED)).toBe(true);
      expect(FocusStateMachine.canTransition(FocusState.COMPLETED, FocusState.IDLE)).toBe(true);
      expect(FocusStateMachine.canTransition(FocusState.FOCUSING, FocusState.CANCELLED)).toBe(true);
      expect(FocusStateMachine.canTransition(FocusState.PAUSED, FocusState.CANCELLED)).toBe(true);
    });

    it('rejects invalid or corrupted state transitions', () => {
      expect(FocusStateMachine.canTransition(FocusState.IDLE, FocusState.PAUSED)).toBe(false);
      expect(FocusStateMachine.canTransition(FocusState.IDLE, FocusState.BREAK)).toBe(false);
      expect(FocusStateMachine.canTransition(FocusState.COMPLETED, FocusState.BREAK)).toBe(false);
      expect(FocusStateMachine.canTransition(FocusState.CANCELLED, FocusState.FOCUSING)).toBe(false);
      expect(FocusStateMachine.canTransition(FocusState.PAUSED, FocusState.BREAK)).toBe(false);
    });
  });

  describe('Timestamp-Derived Elapsed Calculation', () => {
    it('calculates elapsed time accurately while actively focusing', () => {
      const session = FocusStateMachine.start('s-1', T0, 'task-1', 25 * 60 * 1000);

      // 10 minutes later
      const elapsed = FocusStateMachine.getElapsedFocusMs(session, T_PLUS_10M);
      expect(elapsed).toBe(10 * 60 * 1000);

      const remaining = FocusStateMachine.getRemainingFocusMs(session, T_PLUS_10M);
      expect(remaining).toBe(15 * 60 * 1000);
    });

    it('freezes elapsed focus time while paused', () => {
      let session = FocusStateMachine.start('s-1', T0, 'task-1', 25 * 60 * 1000);

      // Pause at +10m
      session = FocusStateMachine.pause(session, T_PLUS_10M);

      // Check at +15m (5 minutes later while still paused)
      const elapsedDuringPause = FocusStateMachine.getElapsedFocusMs(session, T_PLUS_15M);
      expect(elapsedDuringPause).toBe(10 * 60 * 1000); // Strictly frozen at 10m
    });

    it('accumulates paused duration and resumes without timer drift', () => {
      let session = FocusStateMachine.start('s-1', T0, 'task-1', 25 * 60 * 1000);

      // Focus for 10m (10:00 to 10:10)
      session = FocusStateMachine.pause(session, T_PLUS_10M);

      // Pause for 5m (10:10 to 10:15)
      session = FocusStateMachine.resume(session, T_PLUS_15M);
      expect(session.accumulatedPausedMs).toBe(5 * 60 * 1000);

      // Focus for another 10m (10:15 to 10:25) -> Total real clock elapsed is 25m, but focus elapsed is 20m!
      const elapsedAfterResume = FocusStateMachine.getElapsedFocusMs(session, T_PLUS_25M);
      expect(elapsedAfterResume).toBe(20 * 60 * 1000);

      const remaining = FocusStateMachine.getRemainingFocusMs(session, T_PLUS_25M);
      expect(remaining).toBe(5 * 60 * 1000);
    });
  });

  describe('Suspension & Process Restart Reconciliation', () => {
    it('reconciles completed session if target duration passed during app suspension', () => {
      // 25-minute session started at 10:00:00
      const session = FocusStateMachine.start('s-1', T0, 'task-1', 25 * 60 * 1000);

      // App was suspended and wakes up at 10:30:00 (+30m, 5 minutes past deadline)
      const reconciled = FocusStateMachine.reconcileSuspendedSession(session, T_PLUS_30M);

      expect(reconciled.state).toBe(FocusState.COMPLETED);
      expect(reconciled.actualFocusDurationMs).toBe(25 * 60 * 1000);
      expect(reconciled.completedAt).toBe(T_PLUS_25M); // Exactly when the 25m target completed
    });

    it('keeps session FOCUSING if suspended time has not reached target duration', () => {
      const session = FocusStateMachine.start('s-1', T0, 'task-1', 25 * 60 * 1000);

      // App wakes up at +15m
      const reconciled = FocusStateMachine.reconcileSuspendedSession(session, T_PLUS_15M);

      expect(reconciled.state).toBe(FocusState.FOCUSING);
      expect(reconciled.completedAt).toBeNull();
    });

    it('preserves cancelled state with reason', () => {
      let session = FocusStateMachine.start('s-1', T0, 'task-1');
      session = FocusStateMachine.cancel(session, T_PLUS_10M, 'Urgent meeting call');

      expect(session.state).toBe(FocusState.CANCELLED);
      expect(session.interruptionReason).toBe('Urgent meeting call');
      expect(session.cancelledAt).toBe(T_PLUS_10M);
      expect(session.actualFocusDurationMs).toBe(10 * 60 * 1000);
    });
  });
});
