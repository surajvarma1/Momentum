/**
 * Notification Service — Integrates with expo-notifications for local alarms.
 *
 * Invariants:
 * - Transparent explanation before requesting permission.
 * - Stable logical references for scheduling and cancellation.
 * - Deduplication and reconciliation against persistent SQLite reminders.
 * - Automatic cleanup on task completion, cancellation, and deletion.
 * - Inexact alarms by default; no excessive permissions.
 * - Safe fallback in test and non-native environments.
 */

import { Platform } from 'react-native';
import { Reminder } from '../domain/reminders/Reminder';
import { Task } from '../domain/entities/Task';

export interface ScheduleNotificationParams {
  id: string; // Logical reference, e.g. "reminder-<uuid>"
  taskId: string;
  taskTitle: string;
  triggerTime: string; // ISO 8601 UTC
  body?: string;
  isNag?: boolean;
}

export interface INotificationService {
  requestPermissionWithExplanation(): Promise<boolean>;
  getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'>;
  configureChannels(): Promise<void>;
  scheduleNotification(params: ScheduleNotificationParams): Promise<string | null>;
  cancelNotification(nativeIdOrLogicalRef: string): Promise<void>;
  cancelAllForTask(taskId: string): Promise<void>;
  reconcileScheduledNotifications(reminders: Reminder[], tasks: Task[]): Promise<void>;
}

export class NotificationService implements INotificationService {
  private expoNotifications: typeof import('expo-notifications') | null = null;
  private isConfigured = false;

  constructor() {
    this.initModule();
  }

  private async initModule() {
    if (Platform.OS === 'web') return;
    try {
      this.expoNotifications = await import('expo-notifications');
      // Set foreground notification presentation handler
      if (this.expoNotifications && typeof this.expoNotifications.setNotificationHandler === 'function') {
        this.expoNotifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPresentNotification: true,
          } as any),
        });
      }
    } catch {
      // In test or environments where native module isn't loaded
      this.expoNotifications = null;
    }
  }

  async configureChannels(): Promise<void> {
    if (this.isConfigured || !this.expoNotifications || Platform.OS !== 'android') return;

    try {
      await this.expoNotifications.setNotificationChannelAsync('momentum_reminders', {
        name: 'Task Reminders',
        importance: this.expoNotifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await this.expoNotifications.setNotificationChannelAsync('momentum_nag', {
        name: 'Urgent Task Reminders (Nag Mode)',
        importance: this.expoNotifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#EF4444',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      this.isConfigured = true;
    } catch {
      // Handled safely
    }
  }

  async getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    if (!this.expoNotifications) return 'granted';
    try {
      const settings = await this.expoNotifications.getPermissionsAsync();
      if (settings.granted || settings.status === 'granted') {
        return 'granted';
      }
      if (settings.status === 'denied') {
        return 'denied';
      }
      return 'undetermined';
    } catch {
      return 'undetermined';
    }
  }

  async requestPermissionWithExplanation(): Promise<boolean> {
    if (!this.expoNotifications) return true;
    try {
      await this.configureChannels();
      const result = await this.expoNotifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      return result.granted || result.status === 'granted';
    } catch {
      return false;
    }
  }

  async scheduleNotification(params: ScheduleNotificationParams): Promise<string | null> {
    if (!this.expoNotifications) return `notif-${params.id}`;

    try {
      await this.configureChannels();

      const triggerDate = new Date(params.triggerTime);
      const now = new Date();

      // Inexact scheduling safeguard: must be in future
      if (triggerDate.getTime() <= now.getTime()) {
        return null;
      }

      const channelId = params.isNag ? 'momentum_nag' : 'momentum_reminders';

      const notificationId = await this.expoNotifications.scheduleNotificationAsync({
        identifier: params.id,
        content: {
          title: params.isNag ? `⚡ Reminder: ${params.taskTitle}` : params.taskTitle,
          body: params.body || 'Task commitment is due.',
          data: { taskId: params.taskId, reminderId: params.id },
          sound: 'default',
          color: '#6366F1',
          priority: this.expoNotifications.AndroidNotificationPriority.HIGH,
          ...(Platform.OS === 'android' ? { channelId } : {}),
        },
        trigger: {
          date: triggerDate,
          type: this.expoNotifications.SchedulableTriggerInputTypes.DATE,
        },
      });

      return notificationId;
    } catch {
      return null;
    }
  }

  async cancelNotification(nativeIdOrLogicalRef: string): Promise<void> {
    if (!this.expoNotifications) return;
    try {
      await this.expoNotifications.cancelScheduledNotificationAsync(nativeIdOrLogicalRef);
    } catch {
      // Ignored
    }
  }

  async cancelAllForTask(taskId: string): Promise<void> {
    if (!this.expoNotifications) return;
    try {
      const scheduled = await this.expoNotifications.getAllScheduledNotificationsAsync();
      for (const item of scheduled) {
        if (item.content.data && item.content.data.taskId === taskId) {
          await this.expoNotifications.cancelScheduledNotificationAsync(item.identifier);
        }
      }
    } catch {
      // Ignored
    }
  }

  async reconcileScheduledNotifications(reminders: Reminder[], tasks: Task[]): Promise<void> {
    if (!this.expoNotifications) return;

    try {
      const scheduled = await this.expoNotifications.getAllScheduledNotificationsAsync();
      const scheduledMap = new Map<string, (typeof scheduled)[0]>();
      scheduled.forEach((s) => scheduledMap.set(s.identifier, s));

      const activeTaskMap = new Map<string, Task>();
      tasks.forEach((t) => {
        if (t.status === 'PENDING' || t.status === 'IN_PROGRESS') {
          activeTaskMap.set(t.id, t);
        }
      });

      // 1. Cancel orphan notifications or completed/cancelled tasks
      for (const notif of scheduled) {
        const taskId = (notif.content.data as any)?.taskId as string | undefined;
        const matchingReminder = reminders.find(
          (r) => r.nativeNotificationId === notif.identifier || r.id === notif.identifier,
        );

        const shouldKeep =
          Boolean(taskId &&
          activeTaskMap.has(taskId) &&
          matchingReminder &&
          matchingReminder.status === 'SCHEDULED');

        if (!shouldKeep) {
          await this.expoNotifications.cancelScheduledNotificationAsync(notif.identifier);
        }
      }

      // 2. Schedule any missing scheduled reminders
      for (const reminder of reminders) {
        if (reminder.status !== 'SCHEDULED') continue;
        const task = activeTaskMap.get(reminder.taskId);
        if (!task) continue;

        const isAlreadyScheduled =
          scheduledMap.has(reminder.id) ||
          (reminder.nativeNotificationId && scheduledMap.has(reminder.nativeNotificationId));

        if (!isAlreadyScheduled) {
          await this.scheduleNotification({
            id: reminder.id,
            taskId: task.id,
            taskTitle: task.title,
            triggerTime: reminder.triggerTime,
            isNag: reminder.isNagEnabled,
          });
        }
      }
    } catch {
      // Reconciliation is best-effort and never crashes the app
    }
  }
}
