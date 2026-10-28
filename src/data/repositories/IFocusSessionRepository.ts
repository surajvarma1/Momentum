/**
 * Interface for Focus Session persistence.
 */

import { FocusSession } from '../../domain/focus/FocusSession';

export interface IFocusSessionRepository {
  create(session: FocusSession): Promise<FocusSession>;
  findById(id: string): Promise<FocusSession | null>;
  findActiveSession(): Promise<FocusSession | null>;
  findAll(): Promise<FocusSession[]>;
  findByTaskId(taskId: string): Promise<FocusSession[]>;
  update(id: string, updates: Partial<Omit<FocusSession, 'id' | 'createdAt'>>): Promise<FocusSession>;
  delete(id: string): Promise<void>;
}
