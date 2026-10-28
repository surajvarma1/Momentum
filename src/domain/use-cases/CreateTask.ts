import { Task, CreateTaskInput } from '../entities/Task';
import { TaskFilter } from '../entities/Task';
import { Subtask } from '../entities/Subtask';
import { validateCreateTaskInput } from '../validation/TaskValidator';

export interface ITaskRepository {
  create(
    task: Omit<Task, 'subtasks'>,
    subtasks: {
      id: string;
      taskId: string;
      title: string;
      isCompleted: boolean;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    }[],
  ): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  findAll(): Promise<Task[]>;
  filter(filter: TaskFilter, now: string): Promise<Task[]>;
  update(
    id: string,
    updates: Partial<Omit<Task, 'id' | 'subtasks' | 'createdAt'>>,
  ): Promise<Task>;
  delete(id: string): Promise<void>;
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
  updateSubtask(
    subtaskId: string,
    updates: {
      title?: string;
      isCompleted?: boolean;
      sortOrder?: number;
      updatedAt: string;
    },
  ): Promise<void>;
  deleteSubtask(subtaskId: string): Promise<void>;
}

export interface IIdGenerator {
  generate(): string;
}

export interface IClock {
  now(): string; // ISO 8601 UTC
}

import { ISyncRepository } from '../../data/repositories/ISyncRepository';

export class CreateTask {
  constructor(
    private repository: ITaskRepository,
    private idGenerator: IIdGenerator,
    private clock: IClock,
    private syncRepository?: ISyncRepository,
  ) {}

  async execute(input: CreateTaskInput): Promise<Task> {
    const now = this.clock.now();
    const validation = validateCreateTaskInput(input, now);
    if (!validation.success) {
      throw new TaskValidationError(validation.errors);
    }
    const validInput = validation.data;
    const id = this.idGenerator.generate();
    const task: Omit<Task, 'subtasks'> = {
      id,
      title: validInput.title.trim(),
      description: validInput.description ?? null,
      priority: validInput.priority ?? 'MEDIUM',
      energyLevel: validInput.energyLevel ?? 'MEDIUM',
      status: 'PENDING',
      estimatedDurationMinutes: validInput.estimatedDurationMinutes ?? null,
      deadline: validInput.deadline ?? null,
      deadlineTimezone: validInput.deadlineTimezone ?? null,
      tags: validInput.tags ?? [],
      recurrenceRule: validInput.recurrenceRule ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      cancelledAt: null,
      sortOrder: validInput.sortOrder ?? 0,
    };
    const subtasks = (validInput.subtasks ?? []).map((s, i) => ({
      id: this.idGenerator.generate(),
      taskId: id,
      title: s.title.trim(),
      isCompleted: false,
      sortOrder: s.sortOrder ?? i,
      createdAt: now,
      updatedAt: now,
    }));
    const created = await this.repository.create(task, subtasks);
    if (this.syncRepository) {
      await this.syncRepository.addToOutbox({
        id: `outbox_${created.id}_${Date.now()}`,
        mutationType: 'CREATE',
        entityType: 'task',
        entityId: created.id,
        payload: created,
        createdAt: now,
      });
    }
    return created;
  }
}

export class TaskValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Task validation failed: ${errors.join('; ')}`);
    this.name = 'TaskValidationError';
  }
}

export class TaskNotFoundError extends Error {
  constructor(public readonly taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}
