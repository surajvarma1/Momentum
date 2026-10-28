/**
 * SQLite implementation of IMissedTaskRepository.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { IMissedTaskRepository } from './IMissedTaskRepository';
import { MissedTaskRecord } from '../../domain/accountability/MissedTaskRecovery';

interface MissedTaskRow {
  id: string;
  task_id: string;
  detected_at: string;
  suggested_deadline: string;
  action_taken: string | null;
  resolved_at: string | null;
  deferral_reason: string | null;
  created_at: string;
}

export class SQLiteMissedTaskRepository implements IMissedTaskRepository {
  constructor(private db: SQLiteDatabase) {}

  async create(
    record: Omit<MissedTaskRecord, 'actionTaken' | 'resolvedAt' | 'deferralReason'>,
  ): Promise<MissedTaskRecord> {
    await this.db.runAsync(
      `INSERT INTO missed_task_records (id, task_id, detected_at, suggested_deadline,
       action_taken, resolved_at, deferral_reason, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?)`,
      [
        record.id,
        record.taskId,
        record.detectedAt,
        record.suggestedDeadline,
        record.createdAt,
      ],
    );

    const created = await this.findById(record.id);
    if (!created) throw new Error(`Failed to create missed task record: ${record.id}`);
    return created;
  }

  async findById(id: string): Promise<MissedTaskRecord | null> {
    const row = await this.db.getFirstAsync<MissedTaskRow>(
      'SELECT * FROM missed_task_records WHERE id = ?',
      [id],
    );
    if (!row) return null;
    return this.mapRow(row);
  }

  async findByTaskId(taskId: string): Promise<MissedTaskRecord[]> {
    const rows = await this.db.getAllAsync<MissedTaskRow>(
      'SELECT * FROM missed_task_records WHERE task_id = ? ORDER BY detected_at DESC',
      [taskId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findPending(): Promise<MissedTaskRecord[]> {
    const rows = await this.db.getAllAsync<MissedTaskRow>(
      'SELECT * FROM missed_task_records WHERE action_taken IS NULL ORDER BY detected_at DESC',
    );
    return rows.map((r) => this.mapRow(r));
  }

  async resolve(
    id: string,
    action: 'ACCEPTED' | 'RESCHEDULED' | 'DISMISSED',
    resolvedAt: string,
    deferralReason?: string | null,
  ): Promise<MissedTaskRecord> {
    await this.db.runAsync(
      `UPDATE missed_task_records SET action_taken = ?, resolved_at = ?, deferral_reason = ? WHERE id = ?`,
      [action, resolvedAt, deferralReason ?? null, id],
    );

    const updated = await this.findById(id);
    if (!updated) throw new Error(`Missed task record not found: ${id}`);
    return updated;
  }

  private mapRow(row: MissedTaskRow): MissedTaskRecord {
    return {
      id: row.id,
      taskId: row.task_id,
      detectedAt: row.detected_at,
      suggestedDeadline: row.suggested_deadline,
      actionTaken: row.action_taken as MissedTaskRecord['actionTaken'],
      resolvedAt: row.resolved_at,
      deferralReason: row.deferral_reason,
      createdAt: row.created_at,
    };
  }
}
