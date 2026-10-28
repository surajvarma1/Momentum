import { Task } from '../entities/Task';
import { TaskStatus } from '../value-objects/TaskStatus';
import { validateStatusTransition } from '../validation/TaskValidator';
import {
  ITaskRepository,
  IClock,
  TaskNotFoundError,
  TaskValidationError,
} from './CreateTask';

export class ReopenTask {
  constructor(
    private repository: ITaskRepository,
    private clock: IClock,
  ) {}

  async execute(id: string): Promise<Task> {
    const existingTask = await this.repository.findById(id);
    if (!existingTask) {
      throw new TaskNotFoundError(id);
    }

    const transitionResult = validateStatusTransition(
      existingTask.status,
      TaskStatus.PENDING,
    );
    if (!transitionResult.success) {
      throw new TaskValidationError([transitionResult.error]);
    }

    const now = this.clock.now();
    return this.repository.update(id, {
      status: TaskStatus.PENDING,
      completedAt: null,
      cancelledAt: null,
      updatedAt: now,
    });
  }
}
