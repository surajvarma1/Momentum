import { Priority } from '../value-objects/Priority';
import { EnergyLevel } from '../value-objects/EnergyLevel';
import { TaskStatus } from '../value-objects/TaskStatus';
import { RecurrenceRule } from '../value-objects/RecurrenceRule';
import { Subtask } from './Subtask';

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly priority: Priority;
  readonly energyLevel: EnergyLevel;
  readonly status: TaskStatus;
  readonly estimatedDurationMinutes: number | null;
  readonly deadline: string | null; // ISO 8601
  readonly deadlineTimezone: string | null; // IANA timezone
  readonly tags: string[];
  readonly subtasks: Subtask[];
  readonly recurrenceRule: RecurrenceRule | null;
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
  readonly completedAt: string | null; // ISO 8601
  readonly cancelledAt: string | null; // ISO 8601
  readonly sortOrder: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: Priority;
  energyLevel?: EnergyLevel;
  estimatedDurationMinutes?: number | null;
  deadline?: string | null;
  deadlineTimezone?: string | null;
  tags?: string[];
  subtasks?: { title: string; sortOrder?: number }[];
  recurrenceRule?: RecurrenceRule | null;
  sortOrder?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: Priority;
  energyLevel?: EnergyLevel;
  estimatedDurationMinutes?: number | null;
  deadline?: string | null;
  deadlineTimezone?: string | null;
  tags?: string[];
  recurrenceRule?: RecurrenceRule | null;
  sortOrder?: number;
}

export interface TaskFilter {
  status?: TaskStatus | TaskStatus[];
  priority?: Priority | Priority[];
  energyLevel?: EnergyLevel | EnergyLevel[];
  tags?: string[];
  dueBefore?: string; // ISO 8601
  dueAfter?: string; // ISO 8601
  searchQuery?: string;
  isOverdue?: boolean; // derived: deadline < now AND status not terminal
}

// Helper to check if a task is overdue
export function isTaskOverdue(task: Task, now: string): boolean {
  if (!task.deadline) return false;
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
  return task.deadline < now;
}
