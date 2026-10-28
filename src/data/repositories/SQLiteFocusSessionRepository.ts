/**
 * SQLite implementation of IFocusSessionRepository.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { IFocusSessionRepository } from './IFocusSessionRepository';
import { FocusSession } from '../../domain/focus/FocusSession';

interface FocusSessionRow {
  id: string;
  task_id: string | null;
  state: string;
  target_duration_ms: number;
  break_duration_ms: number;
  start_time: string;
  pause_time: string | null;
  accumulated_paused_ms: number;
  completed_at: string | null;
  cancelled_at: string | null;
  actual_focus_duration_ms: number;
  notes: string | null;
  interruption_logged: number;
  interruption_reason: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteFocusSessionRepository implements IFocusSessionRepository {
  constructor(private db: SQLiteDatabase) {}

  async create(session: FocusSession): Promise<FocusSession> {
    await this.db.runAsync(
      `INSERT INTO focus_sessions (id, task_id, state, target_duration_ms, break_duration_ms,
       start_time, pause_time, accumulated_paused_ms, completed_at, cancelled_at,
       actual_focus_duration_ms, notes, interruption_logged, interruption_reason,
       created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.taskId,
        session.state,
        session.targetDurationMs,
        session.breakDurationMs,
        session.startTime,
        session.pauseTime,
        session.accumulatedPausedMs,
        session.completedAt,
        session.cancelledAt,
        session.actualFocusDurationMs,
        session.notes,
        session.interruptionLogged ? 1 : 0,
        session.interruptionReason,
        session.createdAt,
        session.updatedAt,
      ],
    );

    const created = await this.findById(session.id);
    if (!created) throw new Error(`Failed to create focus session: ${session.id}`);
    return created;
  }

  async findById(id: string): Promise<FocusSession | null> {
    const row = await this.db.getFirstAsync<FocusSessionRow>(
      'SELECT * FROM focus_sessions WHERE id = ?',
      [id],
    );
    if (!row) return null;
    return this.mapRow(row);
  }

  async findActiveSession(): Promise<FocusSession | null> {
    const row = await this.db.getFirstAsync<FocusSessionRow>(
      "SELECT * FROM focus_sessions WHERE state IN ('FOCUSING', 'PAUSED', 'BREAK') ORDER BY start_time DESC LIMIT 1",
    );
    if (!row) return null;
    return this.mapRow(row);
  }

  async findAll(): Promise<FocusSession[]> {
    const rows = await this.db.getAllAsync<FocusSessionRow>(
      'SELECT * FROM focus_sessions ORDER BY start_time DESC',
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByTaskId(taskId: string): Promise<FocusSession[]> {
    const rows = await this.db.getAllAsync<FocusSessionRow>(
      'SELECT * FROM focus_sessions WHERE task_id = ? ORDER BY start_time DESC',
      [taskId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async update(
    id: string,
    updates: Partial<Omit<FocusSession, 'id' | 'createdAt'>>,
  ): Promise<FocusSession> {
    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    if (updates.state !== undefined) {
      setClauses.push('state = ?');
      params.push(updates.state);
    }
    if (updates.pauseTime !== undefined) {
      setClauses.push('pause_time = ?');
      params.push(updates.pauseTime);
    }
    if (updates.accumulatedPausedMs !== undefined) {
      setClauses.push('accumulated_paused_ms = ?');
      params.push(updates.accumulatedPausedMs);
    }
    if (updates.completedAt !== undefined) {
      setClauses.push('completed_at = ?');
      params.push(updates.completedAt);
    }
    if (updates.cancelledAt !== undefined) {
      setClauses.push('cancelled_at = ?');
      params.push(updates.cancelledAt);
    }
    if (updates.actualFocusDurationMs !== undefined) {
      setClauses.push('actual_focus_duration_ms = ?');
      params.push(updates.actualFocusDurationMs);
    }
    if (updates.notes !== undefined) {
      setClauses.push('notes = ?');
      params.push(updates.notes);
    }
    if (updates.interruptionLogged !== undefined) {
      setClauses.push('interruption_logged = ?');
      params.push(updates.interruptionLogged ? 1 : 0);
    }
    if (updates.interruptionReason !== undefined) {
      setClauses.push('interruption_reason = ?');
      params.push(updates.interruptionReason);
    }
    if (updates.updatedAt !== undefined) {
      setClauses.push('updated_at = ?');
      params.push(updates.updatedAt);
    }

    if (setClauses.length > 0) {
      params.push(id);
      await this.db.runAsync(
        `UPDATE focus_sessions SET ${setClauses.join(', ')} WHERE id = ?`,
        params,
      );
    }

    const updated = await this.findById(id);
    if (!updated) throw new Error(`Focus session not found: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM focus_sessions WHERE id = ?', [id]);
  }

  private mapRow(row: FocusSessionRow): FocusSession {
    return {
      id: row.id,
      taskId: row.task_id,
      state: row.state as FocusSession['state'],
      targetDurationMs: row.target_duration_ms,
      breakDurationMs: row.break_duration_ms,
      startTime: row.start_time,
      pauseTime: row.pause_time,
      accumulatedPausedMs: row.accumulated_paused_ms,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      actualFocusDurationMs: row.actual_focus_duration_ms,
      notes: row.notes,
      interruptionLogged: row.interruption_logged === 1,
      interruptionReason: row.interruption_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
