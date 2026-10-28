/**
 * Reminder entity and value objects.
 */

import { RecurrenceRule } from '../value-objects/RecurrenceRule';

export const ReminderType = {
  ONE_TIME: 'ONE_TIME',
  BEFORE_DEADLINE: 'BEFORE_DEADLINE',
  RECURRING: 'RECURRING',
} as const;
export type ReminderType = (typeof ReminderType)[keyof typeof ReminderType];

export const ReminderStatus = {
  SCHEDULED: 'SCHEDULED',
  TRIGGERED: 'TRIGGERED',
  DISMISSED: 'DISMISSED',
  CANCELLED: 'CANCELLED',
  SNOOZED: 'SNOOZED',
} as const;
export type ReminderStatus = (typeof ReminderStatus)[keyof typeof ReminderStatus];

export interface Reminder {
  readonly id: string;
  readonly taskId: string;
  readonly type: ReminderType;
  readonly triggerTime: string; // ISO 8601 UTC
  readonly offsetMinutes: number | null; // e.g. 15 for 15m before deadline
  readonly recurrenceRule: RecurrenceRule | null;
  readonly repeatCount: number;
  readonly maxRepeats: number;
  readonly isNagEnabled: boolean;
  readonly snoozeUntil: string | null; // ISO 8601 UTC
  readonly status: ReminderStatus;
  readonly nativeNotificationId: string | null;
  readonly createdAt: string; // ISO 8601 UTC
  readonly updatedAt: string; // ISO 8601 UTC
}

export interface CreateReminderInput {
  taskId: string;
  type: ReminderType;
  triggerTime: string;
  offsetMinutes?: number | null;
  recurrenceRule?: RecurrenceRule | null;
  isNagEnabled?: boolean;
  maxRepeats?: number;
}

export interface SnoozeReminderInput {
  reminderId: string;
  snoozeMinutes: number;
}
