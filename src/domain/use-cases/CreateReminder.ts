/**
 * Create Reminder Use Case.
 * Validates, adjusts for quiet hours, persists in SQLite, and registers native notification.
 */

import { Reminder, CreateReminderInput, ReminderStatus } from '../reminders/Reminder';
import { RecurrenceScheduler, QuietHours } from '../reminders/RecurrenceScheduler';
import { IReminderRepository } from '../../data/repositories/IReminderRepository';
import { ITaskRepository } from '../../data/repositories/ITaskRepository';
import { INotificationService } from '../../services/NotificationService';
import { IIdGenerator } from '../../services/IdGenerator';
import { IClock } from '../../services/ClockService';

export class CreateReminder {
  constructor(
    private reminderRepo: IReminderRepository,
    private taskRepo: ITaskRepository,
    private notificationService: INotificationService,
    private idGenerator: IIdGenerator,
    private clock: IClock,
  ) {}

  async execute(
    input: CreateReminderInput,
    quietHours?: QuietHours,
    timezone?: string,
  ): Promise<Reminder> {
    const task = await this.taskRepo.findById(input.taskId);
    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      throw new Error(`Cannot schedule reminders for ${task.status.toLowerCase()} tasks`);
    }

    let calculatedTrigger = input.triggerTime;

    if (input.type === 'BEFORE_DEADLINE') {
      if (!task.deadline) {
        throw new Error('Task has no deadline to schedule a before-deadline reminder');
      }
      calculatedTrigger = RecurrenceScheduler.calculateBeforeDeadline(
        task.deadline,
        input.offsetMinutes || 15,
      );
    }

    // Adjust for quiet hours if enabled
    if (quietHours && quietHours.enabled) {
      calculatedTrigger = RecurrenceScheduler.adjustForQuietHours(
        calculatedTrigger,
        quietHours,
        timezone,
      );
    }

    const now = this.clock.now();
    const id = this.idGenerator.generate();

    // Schedule native notification
    const nativeId = await this.notificationService.scheduleNotification({
      id: `reminder-${id}`,
      taskId: task.id,
      taskTitle: task.title,
      triggerTime: calculatedTrigger,
      isNag: input.isNagEnabled,
    });

    const reminder: Omit<Reminder, 'repeatCount'> = {
      id,
      taskId: input.taskId,
      type: input.type,
      triggerTime: calculatedTrigger,
      offsetMinutes: input.offsetMinutes ?? null,
      recurrenceRule: input.recurrenceRule ?? null,
      maxRepeats: input.maxRepeats ?? 3,
      isNagEnabled: input.isNagEnabled ?? false,
      snoozeUntil: null,
      status: ReminderStatus.SCHEDULED,
      nativeNotificationId: nativeId,
      createdAt: now,
      updatedAt: now,
    };

    return this.reminderRepo.create(reminder);
  }
}
