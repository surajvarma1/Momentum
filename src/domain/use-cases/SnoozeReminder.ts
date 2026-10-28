/**
 * Snooze Reminder Use Case.
 * Bumps reminder trigger by N minutes, checks quiet hours, and updates native schedule.
 */

import { IReminderRepository } from '../../data/repositories/IReminderRepository';
import { ITaskRepository } from '../../data/repositories/ITaskRepository';
import { INotificationService } from '../../services/NotificationService';
import { IClock } from '../../services/ClockService';
import { Reminder, ReminderStatus, SnoozeReminderInput } from '../reminders/Reminder';
import { RecurrenceScheduler, QuietHours } from '../reminders/RecurrenceScheduler';

export class SnoozeReminder {
  constructor(
    private reminderRepo: IReminderRepository,
    private taskRepo: ITaskRepository,
    private notificationService: INotificationService,
    private clock: IClock,
  ) {}

  async execute(
    input: SnoozeReminderInput,
    quietHours?: QuietHours,
    timezone?: string,
  ): Promise<Reminder> {
    const existing = await this.reminderRepo.findById(input.reminderId);
    if (!existing) {
      throw new Error(`Reminder not found: ${input.reminderId}`);
    }

    const task = await this.taskRepo.findById(existing.taskId);
    if (!task) {
      throw new Error(`Task not found: ${existing.taskId}`);
    }

    const now = this.clock.now();
    const snoozeDate = new Date(new Date(now).getTime() + input.snoozeMinutes * 60 * 1000);
    let snoozeUntil = snoozeDate.toISOString();

    if (quietHours && quietHours.enabled) {
      snoozeUntil = RecurrenceScheduler.adjustForQuietHours(snoozeUntil, quietHours, timezone);
    }

    // Cancel old notification
    if (existing.nativeNotificationId) {
      await this.notificationService.cancelNotification(existing.nativeNotificationId);
    }
    await this.notificationService.cancelNotification(`reminder-${existing.id}`);

    // Schedule snoozed notification
    const newNativeId = await this.notificationService.scheduleNotification({
      id: `reminder-${existing.id}`,
      taskId: task.id,
      taskTitle: task.title,
      triggerTime: snoozeUntil,
      body: `Snoozed reminder: ${task.title}`,
      isNag: existing.isNagEnabled,
    });

    return this.reminderRepo.update(existing.id, {
      status: ReminderStatus.SNOOZED,
      snoozeUntil,
      nativeNotificationId: newNativeId,
      repeatCount: existing.repeatCount + 1,
      updatedAt: now,
    });
  }
}
