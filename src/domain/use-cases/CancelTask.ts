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

export class CancelTask {
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

    const transitionResult = validateStatusTransition(
      existingTask.status,
      TaskStatus.CANCELLED,
    );
    if (!transitionResult.success) {
      throw new TaskValidationError([transitionResult.error]);
    }

    const now = this.clock.now();

    // Cancel reminders & notifications
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
      status: TaskStatus.CANCELLED,
      cancelledAt: now,
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
