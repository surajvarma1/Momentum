import { Task, UpdateTaskInput } from '../entities/Task';
import { validateUpdateTaskInput } from '../validation/TaskValidator';
import {
  ITaskRepository,
  IClock,
  TaskValidationError,
  TaskNotFoundError,
} from './CreateTask';

import { ISyncRepository } from '../../data/repositories/ISyncRepository';

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export class UpdateTask {
  constructor(
    private repository: ITaskRepository,
    private clock: IClock,
    private syncRepository?: ISyncRepository,
  ) {}

  async execute(id: string, input: UpdateTaskInput): Promise<Task> {
    const now = this.clock.now();

    const existingTask = await this.repository.findById(id);
    if (!existingTask) {
      throw new TaskNotFoundError(id);
    }

    const validation = validateUpdateTaskInput(input, existingTask, now);
    if (!validation.success) {
      throw new TaskValidationError(validation.errors);
    }

    const validInput = validation.data;

    const updates: Partial<Mutable<Omit<Task, 'id' | 'subtasks' | 'createdAt'>>> = {
      updatedAt: now,
    };

    if (validInput.title !== undefined) {
      updates.title = validInput.title.trim();
    }
    if (validInput.description !== undefined) {
      updates.description = validInput.description;
    }
    if (validInput.priority !== undefined) {
      updates.priority = validInput.priority;
    }
    if (validInput.energyLevel !== undefined) {
      updates.energyLevel = validInput.energyLevel;
    }
    if (validInput.estimatedDurationMinutes !== undefined) {
      updates.estimatedDurationMinutes = validInput.estimatedDurationMinutes;
    }
    if (validInput.deadline !== undefined) {
      updates.deadline = validInput.deadline;
    }
    if (validInput.deadlineTimezone !== undefined) {
      updates.deadlineTimezone = validInput.deadlineTimezone;
    }
    if (validInput.tags !== undefined) {
      updates.tags = validInput.tags;
    }
    if (validInput.recurrenceRule !== undefined) {
      updates.recurrenceRule = validInput.recurrenceRule;
    }
    if (validInput.sortOrder !== undefined) {
      updates.sortOrder = validInput.sortOrder;
    }

    const updated = await this.repository.update(id, updates);
    if (this.syncRepository) {
      await this.syncRepository.addToOutbox({
        id: `outbox_${id}_${Date.now()}`,
        mutationType: 'UPDATE',
        entityType: 'task',
        entityId: id,
        payload: updated,
        createdAt: now,
      });
    }
    return updated;
  }
}
