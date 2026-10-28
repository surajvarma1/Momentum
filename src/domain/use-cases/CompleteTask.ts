import { Task } from '../entities/Task';
import { TaskStatus } from '../value-objects/TaskStatus';
import { validateStatusTransition } from '../validation/TaskValidator';
import {
  ITaskRepository,
  IClock,
  TaskNotFoundError,
  TaskValidationError,
} from './CreateTask';
import { IReminderRepository } from '../../data/repositories/IReminderRepository';
import { INotificationService } from '../../services/NotificationService';
import { ReminderStatus } from '../reminders/Reminder';
import { ISyncRepository } from '../../data/repositories/ISyncRepository';

export class CompleteTask {
  constructor(
    private repository: ITaskRepository,
    private clock: IClock,
    private reminderRepo?: IReminderRepository,
    private notificationService?: INotificationService,
    private syncRepository?: ISyncRepository,
  ) {}

  async execute(id: string): Promise<Task> {
    const existingTask = await this.repository.findById(id);
    if (!existingTask) {
      throw new TaskNotFoundError(id);
    }

    // Idempotent: if already completed, return as-is
    if (existingTask.status === TaskStatus.COMPLETED) {
      return existingTask;
    }

    const transitionResult = validateStatusTransition(
      existingTask.status,
      TaskStatus.COMPLETED,
    );
    if (!transitionResult.success) {
      throw new TaskValidationError([transitionResult.error]);
    }

    const now = this.clock.now();

    // Cleanup active reminders & native notifications for this completed task
    if (this.notificationService) {
      await this.notificationService.cancelAllForTask(id);
    }
    if (this.reminderRepo) {
      const activeReminders = await this.reminderRepo.findByTaskId(id);
      for (const rem of activeReminders) {
        if (rem.status === ReminderStatus.SCHEDULED || rem.status === ReminderStatus.SNOOZED) {
          await this.reminderRepo.update(rem.id, {
            status: ReminderStatus.CANCELLED,
            updatedAt: now,
          });
        }
      }
    }

    const updated = await this.repository.update(id, {
      status: TaskStatus.COMPLETED,
      completedAt: now,
      updatedAt: now,
    });
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
