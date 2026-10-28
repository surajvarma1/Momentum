/**
 * Integration tests for Phase 2 SQLite Repositories & Notification Cleanup.
 */

import { SQLiteReminderRepository } from '../../src/data/repositories/SQLiteReminderRepository';
import { SQLiteFocusSessionRepository } from '../../src/data/repositories/SQLiteFocusSessionRepository';
import { SQLiteMissedTaskRepository } from '../../src/data/repositories/SQLiteMissedTaskRepository';
import { CompleteTask } from '../../src/domain/use-cases/CompleteTask';
import { CancelTask } from '../../src/domain/use-cases/CancelTask';
import { DeleteTask } from '../../src/domain/use-cases/DeleteTask';
import { Reminder, ReminderStatus, ReminderType } from '../../src/domain/reminders/Reminder';
import { FocusSession } from '../../src/domain/focus/FocusSession';
import { Task } from '../../src/domain/entities/Task';

class MockNotificationService {
  cancelledIds: string[] = [];
  cancelledTaskIds: string[] = [];

  async cancelNotification(id: string): Promise<void> {
    this.cancelledIds.push(id);
  }

  async cancelAllForTask(taskId: string): Promise<void> {
    this.cancelledTaskIds.push(taskId);
  }

  async scheduleNotification(): Promise<string | null> {
    return 'mock-native-id';
  }
}

class MockSQLiteDb {
  remindersTable = new Map<string, any>();
  focusSessionsTable = new Map<string, any>();
  missedTaskTable = new Map<string, any>();

  async runAsync(sql: string, params: any[] = []): Promise<any> {
    const trimmed = sql.trim();

    if (trimmed.startsWith('INSERT INTO reminders')) {
      const [
        id, task_id, type, trigger_time, offset_minutes, recurrence_rule,
        repeat_count, max_repeats, is_nag_enabled, snooze_until, status,
        native_notification_id, created_at, updated_at
      ] = params;

      this.remindersTable.set(id, {
        id, task_id, type, trigger_time, offset_minutes, recurrence_rule,
        repeat_count, max_repeats, is_nag_enabled, snooze_until, status,
        native_notification_id, created_at, updated_at
      });
      return { changes: 1 };
    }

    if (trimmed.startsWith('INSERT INTO focus_sessions')) {
      const [
        id, task_id, state, target_duration_ms, break_duration_ms,
        start_time, pause_time, accumulated_paused_ms, completed_at, cancelled_at,
        actual_focus_duration_ms, notes, interruption_logged, interruption_reason,
        created_at, updated_at
      ] = params;

      this.focusSessionsTable.set(id, {
        id, task_id, state, target_duration_ms, break_duration_ms,
        start_time, pause_time, accumulated_paused_ms, completed_at, cancelled_at,
        actual_focus_duration_ms, notes, interruption_logged, interruption_reason,
        created_at, updated_at
      });
      return { changes: 1 };
    }

    if (trimmed.startsWith('INSERT INTO missed_task_records')) {
      const [id, task_id, detected_at, suggested_deadline, created_at] = params;
      this.missedTaskTable.set(id, {
        id, task_id, detected_at, suggested_deadline, action_taken: null,
        resolved_at: null, deferral_reason: null, created_at
      });
      return { changes: 1 };
    }

    if (trimmed.startsWith('UPDATE reminders SET')) {
      const id = params[params.length - 1];
      const row = this.remindersTable.get(id);
      if (row) {
        const setPart = trimmed.substring('UPDATE reminders SET'.length, trimmed.indexOf('WHERE')).trim();
        const assignments = setPart.split(',').map((s) => s.trim().split('=')[0].trim());
        assignments.forEach((col, idx) => {
          row[col] = params[idx];
        });
        this.remindersTable.set(id, row);
      }
      return { changes: 1 };
    }

    if (trimmed.startsWith('UPDATE focus_sessions SET')) {
      const id = params[params.length - 1];
      const row = this.focusSessionsTable.get(id);
      if (row) {
        const setPart = trimmed.substring('UPDATE focus_sessions SET'.length, trimmed.indexOf('WHERE')).trim();
        const assignments = setPart.split(',').map((s) => s.trim().split('=')[0].trim());
        assignments.forEach((col, idx) => {
          row[col] = params[idx];
        });
        this.focusSessionsTable.set(id, row);
      }
      return { changes: 1 };
    }

    if (trimmed.startsWith('UPDATE missed_task_records SET')) {
      const id = params[3];
      const row = this.missedTaskTable.get(id);
      if (row) {
        row.action_taken = params[0];
        row.resolved_at = params[1];
        row.deferral_reason = params[2];
        this.missedTaskTable.set(id, row);
      }
      return { changes: 1 };
    }

    if (trimmed.startsWith('DELETE FROM reminders WHERE id = ?')) {
      this.remindersTable.delete(params[0]);
      return { changes: 1 };
    }

    if (trimmed.startsWith('DELETE FROM reminders WHERE task_id = ?')) {
      for (const [key, val] of this.remindersTable.entries()) {
        if (val.task_id === params[0]) this.remindersTable.delete(key);
      }
      return { changes: 1 };
    }

    return { changes: 0 };
  }

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    const trimmed = sql.trim();
    if (trimmed.startsWith('SELECT * FROM reminders WHERE id = ?')) {
      return (this.remindersTable.get(params[0]) as T) || null;
    }
    if (trimmed.startsWith('SELECT * FROM focus_sessions WHERE id = ?')) {
      return (this.focusSessionsTable.get(params[0]) as T) || null;
    }
    if (trimmed.startsWith('SELECT * FROM focus_sessions WHERE state IN')) {
      for (const session of this.focusSessionsTable.values()) {
        if (session.state === 'FOCUSING' || session.state === 'PAUSED' || session.state === 'BREAK') {
          return session as T;
        }
      }
      return null;
    }
    if (trimmed.startsWith('SELECT * FROM missed_task_records WHERE id = ?')) {
      return (this.missedTaskTable.get(params[0]) as T) || null;
    }
    return null;
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    const trimmed = sql.trim();
    if (trimmed.startsWith('SELECT * FROM reminders WHERE task_id = ?')) {
      const results: any[] = [];
      for (const r of this.remindersTable.values()) {
        if (r.task_id === params[0]) results.push(r);
      }
      return results as T[];
    }
    if (trimmed.startsWith("SELECT * FROM reminders WHERE status IN ('SCHEDULED', 'SNOOZED')")) {
      const results: any[] = [];
      for (const r of this.remindersTable.values()) {
        if (r.status === 'SCHEDULED' || r.status === 'SNOOZED') results.push(r);
      }
      return results as T[];
    }
    if (trimmed.startsWith('SELECT * FROM focus_sessions')) {
      return Array.from(this.focusSessionsTable.values()) as T[];
    }
    if (trimmed.startsWith('SELECT * FROM missed_task_records WHERE task_id = ?')) {
      const results: any[] = [];
      for (const m of this.missedTaskTable.values()) {
        if (m.task_id === params[0]) results.push(m);
      }
      return results as T[];
    }
    return [];
  }
}

describe('Phase 2 SQLite Repositories & Cleanup', () => {
  let mockDb: MockSQLiteDb;
  let reminderRepo: SQLiteReminderRepository;
  let focusRepo: SQLiteFocusSessionRepository;
  let missedRepo: SQLiteMissedTaskRepository;
  let notifService: MockNotificationService;

  beforeEach(() => {
    mockDb = new MockSQLiteDb();
    reminderRepo = new SQLiteReminderRepository(mockDb as any);
    focusRepo = new SQLiteFocusSessionRepository(mockDb as any);
    missedRepo = new SQLiteMissedTaskRepository(mockDb as any);
    notifService = new MockNotificationService();
  });

  describe('SQLiteReminderRepository', () => {
    it('creates, retrieves, and updates reminders', async () => {
      const reminder: Omit<Reminder, 'repeatCount'> = {
        id: 'rem-1',
        taskId: 'task-1',
        type: ReminderType.ONE_TIME,
        triggerTime: '2026-04-01T10:00:00.000Z',
        offsetMinutes: null,
        recurrenceRule: null,
        maxRepeats: 3,
        isNagEnabled: false,
        snoozeUntil: null,
        status: ReminderStatus.SCHEDULED,
        nativeNotificationId: 'native-1',
        createdAt: '2026-04-01T08:00:00.000Z',
        updatedAt: '2026-04-01T08:00:00.000Z',
      };

      const created = await reminderRepo.create(reminder);
      expect(created.id).toBe('rem-1');
      expect(created.status).toBe('SCHEDULED');

      const found = await reminderRepo.findById('rem-1');
      expect(found).not.toBeNull();
      expect(found?.taskId).toBe('task-1');

      // Update status to SNOOZED
      const updated = await reminderRepo.update('rem-1', {
        status: ReminderStatus.SNOOZED,
        snoozeUntil: '2026-04-01T10:15:00.000Z',
        repeatCount: 1,
      });

      expect(updated.status).toBe('SNOOZED');
      expect(updated.repeatCount).toBe(1);
    });
  });

  describe('SQLiteFocusSessionRepository', () => {
    it('creates and retrieves active focus sessions', async () => {
      const session: FocusSession = {
        id: 'f-1',
        taskId: 'task-1',
        state: 'FOCUSING',
        targetDurationMs: 25 * 60 * 1000,
        breakDurationMs: 5 * 60 * 1000,
        startTime: '2026-04-01T09:00:00.000Z',
        pauseTime: null,
        accumulatedPausedMs: 0,
        completedAt: null,
        cancelledAt: null,
        actualFocusDurationMs: 0,
        notes: null,
        interruptionLogged: false,
        interruptionReason: null,
        createdAt: '2026-04-01T09:00:00.000Z',
        updatedAt: '2026-04-01T09:00:00.000Z',
      };

      await focusRepo.create(session);
      const active = await focusRepo.findActiveSession();
      expect(active).not.toBeNull();
      expect(active?.state).toBe('FOCUSING');

      // Pause session
      await focusRepo.update('f-1', {
        state: 'PAUSED',
        pauseTime: '2026-04-01T09:10:00.000Z',
      });

      const paused = await focusRepo.findById('f-1');
      expect(paused?.state).toBe('PAUSED');
      expect(paused?.pauseTime).toBe('2026-04-01T09:10:00.000Z');
    });
  });

  describe('SQLiteMissedTaskRepository', () => {
    it('creates and resolves missed task recovery records', async () => {
      await missedRepo.create({
        id: 'missed-1',
        taskId: 'task-1',
        detectedAt: '2026-04-01T11:00:00.000Z',
        suggestedDeadline: '2026-04-01T18:00:00.000Z',
        createdAt: '2026-04-01T11:00:00.000Z',
      });

      const pending = await missedRepo.findByTaskId('task-1');
      expect(pending).toHaveLength(1);
      expect(pending[0].actionTaken).toBeNull();

      // Resolve with deferral reason
      const resolved = await missedRepo.resolve(
        'missed-1',
        'RESCHEDULED',
        '2026-04-01T11:05:00.000Z',
        'Delayed by emergency server incident',
      );

      expect(resolved.actionTaken).toBe('RESCHEDULED');
      expect(resolved.deferralReason).toBe('Delayed by emergency server incident');
    });
  });

  describe('Task Completion and Cleanup Invariants', () => {
    it('cleans up active reminders and native notifications on CompleteTask', async () => {
      // Mock task repository
      const mockTask: Task = {
        id: 'task-clean-1',
        title: 'Task to Complete',
        description: null,
        priority: 'MEDIUM',
        energyLevel: 'MEDIUM',
        status: 'PENDING',
        estimatedDurationMinutes: 30,
        deadline: '2026-04-01T10:00:00.000Z',
        deadlineTimezone: 'UTC',
        tags: [],
        subtasks: [],
        recurrenceRule: null,
        createdAt: '2026-04-01T08:00:00.000Z',
        updatedAt: '2026-04-01T08:00:00.000Z',
        completedAt: null,
        cancelledAt: null,
        sortOrder: 0,
      };

      const mockTaskRepo = {
        findById: async (id: string) => (id === 'task-clean-1' ? mockTask : null),
        update: async (id: string, updates: any) => ({ ...mockTask, ...updates }),
      } as any;

      // Create an active reminder for this task
      await reminderRepo.create({
        id: 'rem-clean-1',
        taskId: 'task-clean-1',
        type: ReminderType.ONE_TIME,
        triggerTime: '2026-04-01T10:00:00.000Z',
        offsetMinutes: null,
        recurrenceRule: null,
        maxRepeats: 3,
        isNagEnabled: false,
        snoozeUntil: null,
        status: ReminderStatus.SCHEDULED,
        nativeNotificationId: 'native-clean-1',
        createdAt: '2026-04-01T08:00:00.000Z',
        updatedAt: '2026-04-01T08:00:00.000Z',
      });

      const clock = { now: () => '2026-04-01T09:30:00.000Z' };
      const completeUseCase = new CompleteTask(
        mockTaskRepo,
        clock,
        reminderRepo,
        notifService as any,
      );

      await completeUseCase.execute('task-clean-1');

      // Invariant: Native notifications cancelled for task
      expect(notifService.cancelledTaskIds).toContain('task-clean-1');

      // Invariant: Reminder status updated to CANCELLED in SQLite
      const updatedReminder = await reminderRepo.findById('rem-clean-1');
      expect(updatedReminder?.status).toBe('CANCELLED');
    });
  });
});
