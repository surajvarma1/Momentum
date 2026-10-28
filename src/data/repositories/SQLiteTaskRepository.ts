/**
 * SQLite implementation of ITaskRepository.
 * All task CRUD operations with parameterized SQL and transactions.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { ITaskRepository } from './ITaskRepository';
import { Task, TaskFilter } from '../../domain/entities/Task';
import { Subtask } from '../../domain/entities/Subtask';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  energy_level: string;
  status: string;
  estimated_duration_minutes: number | null;
  deadline: string | null;
  deadline_timezone: string | null;
  tags: string;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  sort_order: number;
}

interface SubtaskRow {
  id: string;
  task_id: string;
  title: string;
  is_completed: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteTaskRepository implements ITaskRepository {
  constructor(private db: SQLiteDatabase) {}

  async create(
    task: Omit<Task, 'subtasks'>,
    subtasks: Array<{
      id: string;
      taskId: string;
      title: string;
      isCompleted: boolean;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    }>,
  ): Promise<Task> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO tasks (id, title, description, priority, energy_level, status,
         estimated_duration_minutes, deadline, deadline_timezone, tags, recurrence_rule,
         created_at, updated_at, completed_at, cancelled_at, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.title,
          task.description,
          task.priority,
          task.energyLevel,
          task.status,
          task.estimatedDurationMinutes,
          task.deadline,
          task.deadlineTimezone,
          JSON.stringify(task.tags),
          task.recurrenceRule ? JSON.stringify(task.recurrenceRule) : null,
          task.createdAt,
          task.updatedAt,
          task.completedAt,
          task.cancelledAt,
          task.sortOrder,
        ],
      );

      for (const subtask of subtasks) {
        await this.db.runAsync(
          `INSERT INTO subtasks (id, task_id, title, is_completed, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            subtask.id,
            subtask.taskId,
            subtask.title,
            subtask.isCompleted ? 1 : 0,
            subtask.sortOrder,
            subtask.createdAt,
            subtask.updatedAt,
          ],
        );
      }
    });

    const created = await this.findById(task.id);
    if (!created) {
      throw new Error(`Failed to create task: ${task.id}`);
    }
    return created;
  }

  async findById(id: string): Promise<Task | null> {
    const row = await this.db.getFirstAsync<TaskRow>(
      'SELECT * FROM tasks WHERE id = ?',
      [id],
    );
    if (!row) return null;

    const subtaskRows = await this.db.getAllAsync<SubtaskRow>(
      'SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order ASC',
      [id],
    );

    return this.mapRowToTask(row, subtaskRows);
  }

  async findAll(): Promise<Task[]> {
    const rows = await this.db.getAllAsync<TaskRow>(
      'SELECT * FROM tasks ORDER BY sort_order ASC, created_at DESC',
    );
    return this.mapRowsToTasks(rows);
  }

  async filter(filter: TaskFilter, now: string): Promise<Task[]> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    // Status filter
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const placeholders = statuses.map(() => '?').join(', ');
      conditions.push(`status IN (${placeholders})`);
      params.push(...statuses);
    }

    // Priority filter
    if (filter.priority) {
      const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
      const placeholders = priorities.map(() => '?').join(', ');
      conditions.push(`priority IN (${placeholders})`);
      params.push(...priorities);
    }

    // Energy level filter
    if (filter.energyLevel) {
      const levels = Array.isArray(filter.energyLevel) ? filter.energyLevel : [filter.energyLevel];
      const placeholders = levels.map(() => '?').join(', ');
      conditions.push(`energy_level IN (${placeholders})`);
      params.push(...levels);
    }

    // Due before
    if (filter.dueBefore) {
      conditions.push('deadline IS NOT NULL AND deadline <= ?');
      params.push(filter.dueBefore);
    }

    // Due after
    if (filter.dueAfter) {
      conditions.push('deadline IS NOT NULL AND deadline >= ?');
      params.push(filter.dueAfter);
    }

    // Overdue: deadline < now AND not completed/cancelled
    if (filter.isOverdue === true) {
      conditions.push(
        "deadline IS NOT NULL AND deadline < ? AND status NOT IN ('COMPLETED', 'CANCELLED')",
      );
      params.push(now);
    }

    // Search query (title or description)
    if (filter.searchQuery) {
      const searchTerm = `%${filter.searchQuery}%`;
      conditions.push('(title LIKE ? OR description LIKE ?)');
      params.push(searchTerm, searchTerm);
    }

    // Tags filter (JSON contains check)
    if (filter.tags && filter.tags.length > 0) {
      const tagConditions = filter.tags.map(() => "tags LIKE ?");
      conditions.push(`(${tagConditions.join(' OR ')})`);
      for (const tag of filter.tags) {
        params.push(`%"${tag}"%`);
      }
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const rows = await this.db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks ${whereClause} ORDER BY sort_order ASC, created_at DESC`,
      params,
    );

    return this.mapRowsToTasks(rows);
  }

  async update(
    id: string,
    updates: Partial<Omit<Task, 'id' | 'subtasks' | 'createdAt'>>,
  ): Promise<Task> {
    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    if (updates.title !== undefined) {
      setClauses.push('title = ?');
      params.push(updates.title);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      params.push(updates.description);
    }
    if (updates.priority !== undefined) {
      setClauses.push('priority = ?');
      params.push(updates.priority);
    }
    if (updates.energyLevel !== undefined) {
      setClauses.push('energy_level = ?');
      params.push(updates.energyLevel);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }
    if (updates.estimatedDurationMinutes !== undefined) {
      setClauses.push('estimated_duration_minutes = ?');
      params.push(updates.estimatedDurationMinutes);
    }
    if (updates.deadline !== undefined) {
      setClauses.push('deadline = ?');
      params.push(updates.deadline);
    }
    if (updates.deadlineTimezone !== undefined) {
      setClauses.push('deadline_timezone = ?');
      params.push(updates.deadlineTimezone);
    }
    if (updates.tags !== undefined) {
      setClauses.push('tags = ?');
      params.push(JSON.stringify(updates.tags));
    }
    if (updates.recurrenceRule !== undefined) {
      setClauses.push('recurrence_rule = ?');
      params.push(updates.recurrenceRule ? JSON.stringify(updates.recurrenceRule) : null);
    }
    if (updates.updatedAt !== undefined) {
      setClauses.push('updated_at = ?');
      params.push(updates.updatedAt);
    }
    if (updates.completedAt !== undefined) {
      setClauses.push('completed_at = ?');
      params.push(updates.completedAt);
    }
    if (updates.cancelledAt !== undefined) {
      setClauses.push('cancelled_at = ?');
      params.push(updates.cancelledAt);
    }
    if (updates.sortOrder !== undefined) {
      setClauses.push('sort_order = ?');
      params.push(updates.sortOrder);
    }

    if (setClauses.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Task not found: ${id}`);
      return existing;
    }

    params.push(id);
    await this.db.runAsync(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`,
      params,
    );

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Task not found after update: ${id}`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    // Subtasks are cascade-deleted via FK constraint
    await this.db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
  }

  async addSubtask(
    taskId: string,
    subtask: {
      id: string;
      title: string;
      isCompleted: boolean;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    },
  ): Promise<Subtask> {
    await this.db.runAsync(
      `INSERT INTO subtasks (id, task_id, title, is_completed, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        subtask.id,
        taskId,
        subtask.title,
        subtask.isCompleted ? 1 : 0,
        subtask.sortOrder,
        subtask.createdAt,
        subtask.updatedAt,
      ],
    );

    return {
      id: subtask.id,
      taskId,
      title: subtask.title,
      isCompleted: subtask.isCompleted,
      sortOrder: subtask.sortOrder,
      createdAt: subtask.createdAt,
      updatedAt: subtask.updatedAt,
    };
  }

  async updateSubtask(
    subtaskId: string,
    updates: {
      title?: string;
      isCompleted?: boolean;
      sortOrder?: number;
      updatedAt: string;
    },
  ): Promise<void> {
    const setClauses: string[] = ['updated_at = ?'];
    const params: (string | number)[] = [updates.updatedAt];

    if (updates.title !== undefined) {
      setClauses.push('title = ?');
      params.push(updates.title);
    }
    if (updates.isCompleted !== undefined) {
      setClauses.push('is_completed = ?');
      params.push(updates.isCompleted ? 1 : 0);
    }
    if (updates.sortOrder !== undefined) {
      setClauses.push('sort_order = ?');
      params.push(updates.sortOrder);
    }

    params.push(subtaskId);
    await this.db.runAsync(
      `UPDATE subtasks SET ${setClauses.join(', ')} WHERE id = ?`,
      params,
    );
  }

  async deleteSubtask(subtaskId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM subtasks WHERE id = ?', [subtaskId]);
  }

  async count(status?: string | string[]): Promise<number> {
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      const placeholders = statuses.map(() => '?').join(', ');
      const result = await this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM tasks WHERE status IN (${placeholders})`,
        statuses,
      );
      return result?.count ?? 0;
    }

    const result = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM tasks',
    );
    return result?.count ?? 0;
  }

  // --- Private helpers ---

  private async mapRowsToTasks(rows: TaskRow[]): Promise<Task[]> {
    if (rows.length === 0) return [];

    // Batch-fetch all subtasks for these tasks
    const taskIds = rows.map((r) => r.id);
    const placeholders = taskIds.map(() => '?').join(', ');
    const allSubtaskRows = await this.db.getAllAsync<SubtaskRow>(
      `SELECT * FROM subtasks WHERE task_id IN (${placeholders}) ORDER BY sort_order ASC`,
      taskIds,
    );

    // Group subtasks by task_id
    const subtasksByTaskId = new Map<string, SubtaskRow[]>();
    for (const sr of allSubtaskRows) {
      const existing = subtasksByTaskId.get(sr.task_id) ?? [];
      existing.push(sr);
      subtasksByTaskId.set(sr.task_id, existing);
    }

    return rows.map((row) =>
      this.mapRowToTask(row, subtasksByTaskId.get(row.id) ?? []),
    );
  }

  private mapRowToTask(row: TaskRow, subtaskRows: SubtaskRow[]): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority as Task['priority'],
      energyLevel: row.energy_level as Task['energyLevel'],
      status: row.status as Task['status'],
      estimatedDurationMinutes: row.estimated_duration_minutes,
      deadline: row.deadline,
      deadlineTimezone: row.deadline_timezone,
      tags: this.parseJsonArray(row.tags),
      subtasks: subtaskRows.map((sr) => this.mapSubtaskRow(sr)),
      recurrenceRule: row.recurrence_rule
        ? (this.parseJson(row.recurrence_rule) as Task['recurrenceRule'])
        : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      sortOrder: row.sort_order,
    };
  }

  private mapSubtaskRow(row: SubtaskRow): Subtask {
    return {
      id: row.id,
      taskId: row.task_id,
      title: row.title,
      isCompleted: row.is_completed === 1,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private parseJsonArray(json: string): string[] {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private parseJson(json: string): unknown {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}
