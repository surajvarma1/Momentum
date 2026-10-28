/**
 * Tests for Missed Task Recovery & Accountability Engine.
 */

import { MissedTaskRecoveryEngine, MissedTaskRecord } from '../../src/domain/accountability/MissedTaskRecovery';
import { Task } from '../../src/domain/entities/Task';

const baseTask: Task = {
  id: 'task-100',
  title: 'Quarterly Infrastructure Review',
  description: null,
  priority: 'HIGH',
  energyLevel: 'HIGH',
  status: 'PENDING',
  estimatedDurationMinutes: 60,
  deadline: '2026-03-01T10:00:00.000Z',
  deadlineTimezone: 'UTC',
  tags: [],
  subtasks: [],
  recurrenceRule: null,
  createdAt: '2026-02-25T10:00:00.000Z',
  updatedAt: '2026-02-25T10:00:00.000Z',
  completedAt: null,
  cancelledAt: null,
  sortOrder: 0,
};

describe('MissedTaskRecoveryEngine', () => {
  const nowOverdue = '2026-03-01T12:00:00.000Z'; // Past deadline of 10:00

  it('identifies overdue pending tasks for recovery', () => {
    const suggestion = MissedTaskRecoveryEngine.evaluateMissedTask(
      baseTask,
      nowOverdue,
      [],
      false,
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.task.id).toBe('task-100');
    expect(suggestion?.suggestedDeadline).toBeDefined();
  });

  it('never flags completed or cancelled tasks for recovery', () => {
    const completedTask = { ...baseTask, status: 'COMPLETED' as const, completedAt: nowOverdue };
    const cancelledTask = { ...baseTask, status: 'CANCELLED' as const, cancelledAt: nowOverdue };

    expect(MissedTaskRecoveryEngine.evaluateMissedTask(completedTask, nowOverdue, [])).toBeNull();
    expect(MissedTaskRecoveryEngine.evaluateMissedTask(cancelledTask, nowOverdue, [])).toBeNull();
  });

  it('ignores tasks with future deadlines', () => {
    const futureTask = { ...baseTask, deadline: '2026-03-02T10:00:00.000Z' };
    expect(MissedTaskRecoveryEngine.evaluateMissedTask(futureTask, nowOverdue, [])).toBeNull();
  });

  it('generates realistic reschedule: today 18:00 before 15:00', () => {
    const morning = '2026-03-01T10:30:00.000Z';
    const suggested = MissedTaskRecoveryEngine.generateSuggestedDeadline(morning);
    const date = new Date(suggested);

    expect(date.getUTCHours()).toBe(18);
    expect(date.getUTCMinutes()).toBe(0);
  });

  it('generates realistic reschedule: tomorrow 09:00 after 15:00', () => {
    const late = '2026-03-01T16:30:00.000Z';
    const suggested = MissedTaskRecoveryEngine.generateSuggestedDeadline(late);
    const date = new Date(suggested);

    expect(date.getUTCHours()).toBe(9);
    expect(date.getUTCMinutes()).toBe(0);
  });

  it('requires deferral reason for HIGH / IMPORTANT tasks only when setting is enabled', () => {
    // When preference is true and priority is HIGH
    const reqHigh = MissedTaskRecoveryEngine.evaluateMissedTask(
      { ...baseTask, priority: 'HIGH' },
      nowOverdue,
      [],
      true,
    );
    expect(reqHigh?.requiresDeferralReason).toBe(true);

    // When preference is true and priority is IMPORTANT
    const reqImportant = MissedTaskRecoveryEngine.evaluateMissedTask(
      { ...baseTask, priority: 'IMPORTANT' },
      nowOverdue,
      [],
      true,
    );
    expect(reqImportant?.requiresDeferralReason).toBe(true);

    // When preference is true but priority is MEDIUM
    const reqMed = MissedTaskRecoveryEngine.evaluateMissedTask(
      { ...baseTask, priority: 'MEDIUM' },
      nowOverdue,
      [],
      true,
    );
    expect(reqMed?.requiresDeferralReason).toBe(false);

    // When preference is false
    const reqDisabled = MissedTaskRecoveryEngine.evaluateMissedTask(
      { ...baseTask, priority: 'HIGH' },
      nowOverdue,
      [],
      false,
    );
    expect(reqDisabled?.requiresDeferralReason).toBe(false);
  });

  it('avoids duplicate recovery prompts on the same calendar day', () => {
    const existingPromptToday: MissedTaskRecord = {
      id: 'rec-1',
      taskId: 'task-100',
      detectedAt: '2026-03-01T11:00:00.000Z',
      suggestedDeadline: '2026-03-01T18:00:00.000Z',
      actionTaken: null,
      resolvedAt: null,
      deferralReason: null,
      createdAt: '2026-03-01T11:00:00.000Z',
    };

    const duplicateCheck = MissedTaskRecoveryEngine.evaluateMissedTask(
      baseTask,
      nowOverdue,
      [existingPromptToday],
      true,
    );

    expect(duplicateCheck).toBeNull(); // Suppressed to prevent annoyance
  });
});
