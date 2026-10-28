/**
 * SQLite implementation of IReminderRepository.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { IReminderRepository } from './IReminderRepository';
import { Reminder } from '../../domain/reminders/Reminder';

interface ReminderRow {
  id: string;
  task_id: string;
  type: string;
  trigger_time: string;
  offset_minutes: number | null;
  recurrence_rule: string | null;
  repeat_count: number;
  max_repeats: number;
  is_nag_enabled: number;
  snooze_until: string | null;
  status: string;
  native_notification_id: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteReminderRepository implements IReminderRepository {
  constructor(private db: SQLiteDatabase) {}

  async create(reminder: Omit<Reminder, 'repeatCount'>): Promise<Reminder> {
    await this.db.runAsync(
      `INSERT INTO reminders (id, task_id, type, trigger_time, offset_minutes, recurrence_rule,
       repeat_count, max_repeats, is_nag_enabled, snooze_until, status, native_notification_id,
       created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reminder.id,
        reminder.taskId,
        reminder.type,
        reminder.triggerTime,
        reminder.offsetMinutes,
        reminder.recurrenceRule ? JSON.stringify(reminder.recurrenceRule) : null,
        0,
        reminder.maxRepeats,
        reminder.isNagEnabled ? 1 : 0,
        reminder.snoozeUntil,
        reminder.status,
        reminder.nativeNotificationId,
        reminder.createdAt,
        reminder.updatedAt,
      ],
    );

    const created = await this.findById(reminder.id);
    if (!created) throw new Error(`Failed to create reminder: ${reminder.id}`);
    return created;
  }

  async findById(id: string): Promise<Reminder | null> {
    const row = await this.db.getFirstAsync<ReminderRow>(
      'SELECT * FROM reminders WHERE id = ?',
      [id],
    );
    if (!row) return null;
    return this.mapRow(row);
  }

  async findByTaskId(taskId: string): Promise<Reminder[]> {
    const rows = await this.db.getAllAsync<ReminderRow>(
      'SELECT * FROM reminders WHERE task_id = ? ORDER BY trigger_time ASC',
      [taskId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findAllActive(): Promise<Reminder[]> {
    const rows = await this.db.getAllAsync<ReminderRow>(
      "SELECT * FROM reminders WHERE status IN ('SCHEDULED', 'SNOOZED') ORDER BY trigger_time ASC",
    );
    return rows.map((r) => this.mapRow(r));
  }

  async update(
    id: string,
    updates: Partial<Omit<Reminder, 'id' | 'taskId' | 'createdAt'>>,
  ): Promise<Reminder> {
    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    if (updates.triggerTime !== undefined) {
      setClauses.push('trigger_time = ?');
      params.push(updates.triggerTime);
    }
    if (updates.offsetMinutes !== undefined) {
      setClauses.push('offset_minutes = ?');
      params.push(updates.offsetMinutes);
    }
    if (updates.recurrenceRule !== undefined) {
      setClauses.push('recurrence_rule = ?');
      params.push(updates.recurrenceRule ? JSON.stringify(updates.recurrenceRule) : null);
    }
    if (updates.repeatCount !== undefined) {
      setClauses.push('repeat_count = ?');
      params.push(updates.repeatCount);
    }
    if (updates.maxRepeats !== undefined) {
      setClauses.push('max_repeats = ?');
      params.push(updates.maxRepeats);
    }
    if (updates.isNagEnabled !== undefined) {
      setClauses.push('is_nag_enabled = ?');
      params.push(updates.isNagEnabled ? 1 : 0);
    }
    if (updates.snoozeUntil !== undefined) {
      setClauses.push('snooze_until = ?');
      params.push(updates.snoozeUntil);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }
    if (updates.nativeNotificationId !== undefined) {
      setClauses.push('native_notification_id = ?');
      params.push(updates.nativeNotificationId);
    }
    if (updates.updatedAt !== undefined) {
      setClauses.push('updated_at = ?');
      params.push(updates.updatedAt);
    }

    if (setClauses.length > 0) {
      params.push(id);
      await this.db.runAsync(
        `UPDATE reminders SET ${setClauses.join(', ')} WHERE id = ?`,
        params,
      );
    }

    const updated = await this.findById(id);
    if (!updated) throw new Error(`Reminder not found: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM reminders WHERE task_id = ?', [taskId]);
  }

  private mapRow(row: ReminderRow): Reminder {
    return {
      id: row.id,
      taskId: row.task_id,
      type: row.type as Reminder['type'],
      triggerTime: row.trigger_time,
      offsetMinutes: row.offset_minutes,
      recurrenceRule: row.recurrence_rule ? JSON.parse(row.recurrence_rule) : null,
      repeatCount: row.repeat_count,
      maxRepeats: row.max_repeats,
      isNagEnabled: row.is_nag_enabled === 1,
      snoozeUntil: row.snooze_until,
      status: row.status as Reminder['status'],
      nativeNotificationId: row.native_notification_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
