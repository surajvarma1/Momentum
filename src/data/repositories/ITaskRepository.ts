/**
 * Task repository interface.
 * Independent of storage implementation.
 * SQLite implementation in SQLiteTaskRepository.
 */

import { Task, CreateTaskInput, UpdateTaskInput, TaskFilter } from '../../domain/entities/Task';
import { Subtask, CreateSubtaskInput } from '../../domain/entities/Subtask';

export interface ITaskRepository {
  /**
   * Create a new task with optional subtasks in a single transaction.
   */
  create(
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
  ): Promise<Task>;

  /**
   * Find a task by its UUID, including subtasks.
   * Returns null if not found.
   */
  findById(id: string): Promise<Task | null>;

  /**
   * Return all tasks ordered by sortOrder, then createdAt desc.
   */
  findAll(): Promise<Task[]>;

  /**
   * Return tasks matching the given filter criteria.
   * @param filter - Filter criteria
   * @param now - Current ISO 8601 timestamp for overdue calculation
   */
  filter(filter: TaskFilter, now: string): Promise<Task[]>;

  /**
   * Update task fields. Only provided fields are updated.
   * Returns the updated task with subtasks.
   */
  update(
    id: string,
    updates: Partial<Omit<Task, 'id' | 'subtasks' | 'createdAt'>>,
  ): Promise<Task>;

  /**
   * Permanently delete a task and its subtasks (cascade).
   */
  delete(id: string): Promise<void>;

  /**
   * Add a subtask to an existing task.
   */
  addSubtask(
    taskId: string,
    subtask: {
      id: string;
      title: string;
      isCompleted: boolean;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    },
  ): Promise<Subtask>;

  /**
   * Update a subtask's fields.
   */
  updateSubtask(
    subtaskId: string,
    updates: {
      title?: string;
      isCompleted?: boolean;
      sortOrder?: number;
      updatedAt: string;
    },
  ): Promise<void>;

  /**
   * Delete a subtask by ID.
   */
  deleteSubtask(subtaskId: string): Promise<void>;

  /**
   * Count tasks matching optional status filter.
   */
  count(status?: string | string[]): Promise<number>;
}
