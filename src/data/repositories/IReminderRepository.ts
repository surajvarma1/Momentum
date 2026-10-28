/**
 * Interface for Reminder persistence.
 */

import { Reminder, CreateReminderInput } from '../../domain/reminders/Reminder';

export interface IReminderRepository {
  create(reminder: Omit<Reminder, 'repeatCount'>): Promise<Reminder>;
  findById(id: string): Promise<Reminder | null>;
  findByTaskId(taskId: string): Promise<Reminder[]>;
  findAllActive(): Promise<Reminder[]>;
  update(id: string, updates: Partial<Omit<Reminder, 'id' | 'taskId' | 'createdAt'>>): Promise<Reminder>;
  delete(id: string): Promise<void>;
  deleteByTaskId(taskId: string): Promise<void>;
}
