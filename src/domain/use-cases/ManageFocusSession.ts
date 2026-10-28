/**
 * Manage Focus Session Use Case.
 * Coordinates FocusStateMachine with SQLite persistence.
 */

import { FocusSession, FocusState } from '../focus/FocusSession';
import { FocusStateMachine } from '../focus/FocusStateMachine';
import { IFocusSessionRepository } from '../../data/repositories/IFocusSessionRepository';
import { IIdGenerator } from '../../services/IdGenerator';
import { IClock } from '../../services/ClockService';

export class ManageFocusSession {
  constructor(
    private sessionRepo: IFocusSessionRepository,
    private idGenerator: IIdGenerator,
    private clock: IClock,
  ) {}

  async getActiveSession(): Promise<FocusSession | null> {
    const session = await this.sessionRepo.findActiveSession();
    if (!session) return null;

    // Reconcile suspended state
    const now = this.clock.now();
    const reconciled = FocusStateMachine.reconcileSuspendedSession(session, now);
    if (reconciled.state !== session.state) {
      await this.sessionRepo.update(session.id, {
        state: reconciled.state,
        completedAt: reconciled.completedAt,
        actualFocusDurationMs: reconciled.actualFocusDurationMs,
        updatedAt: now,
      });
      return reconciled;
    }

    return session;
  }

  async start(
    taskId?: string | null,
    targetDurationMs?: number,
    breakDurationMs?: number,
    notes?: string | null,
  ): Promise<FocusSession> {
    // If an active session exists, cancel it first
    const active = await this.sessionRepo.findActiveSession();
    const now = this.clock.now();
    if (active) {
      await this.cancel(active.id, 'Superceded by new focus session');
    }

    const id = this.idGenerator.generate();
    const newSession = FocusStateMachine.start(
      id,
      now,
      taskId,
      targetDurationMs,
      breakDurationMs,
      notes,
    );

    return this.sessionRepo.create(newSession);
  }

  async pause(sessionId: string): Promise<FocusSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new Error(`Focus session not found: ${sessionId}`);

    const now = this.clock.now();
    const updated = FocusStateMachine.pause(session, now);

    return this.sessionRepo.update(sessionId, {
      state: updated.state,
      pauseTime: updated.pauseTime,
      updatedAt: now,
    });
  }

  async resume(sessionId: string): Promise<FocusSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new Error(`Focus session not found: ${sessionId}`);

    const now = this.clock.now();
    const updated = FocusStateMachine.resume(session, now);

    return this.sessionRepo.update(sessionId, {
      state: updated.state,
      pauseTime: null,
      accumulatedPausedMs: updated.accumulatedPausedMs,
      updatedAt: now,
    });
  }

  async startBreak(sessionId: string): Promise<FocusSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new Error(`Focus session not found: ${sessionId}`);

    const now = this.clock.now();
    const updated = FocusStateMachine.startBreak(session, now);

    return this.sessionRepo.update(sessionId, {
      state: updated.state,
      actualFocusDurationMs: updated.actualFocusDurationMs,
      updatedAt: now,
    });
  }

  async complete(sessionId: string): Promise<FocusSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new Error(`Focus session not found: ${sessionId}`);

    const now = this.clock.now();
    const updated = FocusStateMachine.complete(session, now);

    return this.sessionRepo.update(sessionId, {
      state: updated.state,
      completedAt: updated.completedAt,
      actualFocusDurationMs: updated.actualFocusDurationMs,
      updatedAt: now,
    });
  }

  async cancel(sessionId: string, reason?: string): Promise<FocusSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new Error(`Focus session not found: ${sessionId}`);

    const now = this.clock.now();
    const updated = FocusStateMachine.cancel(session, now, reason);

    return this.sessionRepo.update(sessionId, {
      state: updated.state,
      cancelledAt: updated.cancelledAt,
      actualFocusDurationMs: updated.actualFocusDurationMs,
      interruptionReason: updated.interruptionReason,
      updatedAt: now,
    });
  }

  async logInterruption(sessionId: string, reason: string): Promise<FocusSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new Error(`Focus session not found: ${sessionId}`);

    const now = this.clock.now();
    return this.sessionRepo.update(sessionId, {
      interruptionLogged: true,
      interruptionReason: reason,
      updatedAt: now,
    });
  }
}
