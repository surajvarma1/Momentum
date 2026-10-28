/**
 * Cancel Reminder Use Case.
 * Cancels local notification and marks status as CANCELLED in SQLite.
 */

import { IReminderRepository } from '../../data/repositories/IReminderRepository';
import { INotificationService } from '../../services/NotificationService';
import { IClock } from '../../services/ClockService';
import { Reminder, ReminderStatus } from '../reminders/Reminder';

export class CancelReminder {
  constructor(
    private reminderRepo: IReminderRepository,
    private notificationService: INotificationService,
    private clock: IClock,
  ) {}

  async execute(reminderId: string): Promise<Reminder> {
    const existing = await this.reminderRepo.findById(reminderId);
    if (!existing) {
      throw new Error(`Reminder not found: ${reminderId}`);
    }

    if (existing.nativeNotificationId) {
      await this.notificationService.cancelNotification(existing.nativeNotificationId);
    }
    await this.notificationService.cancelNotification(`reminder-${existing.id}`);

    const now = this.clock.now();
    return this.reminderRepo.update(reminderId, {
      status: ReminderStatus.CANCELLED,
      updatedAt: now,
    });
  }
}
