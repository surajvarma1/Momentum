/**
 * Interface for Missed Task Record persistence.
 */

import { MissedTaskRecord } from '../../domain/accountability/MissedTaskRecovery';

export interface IMissedTaskRepository {
  create(record: Omit<MissedTaskRecord, 'actionTaken' | 'resolvedAt' | 'deferralReason'>): Promise<MissedTaskRecord>;
  findById(id: string): Promise<MissedTaskRecord | null>;
  findByTaskId(taskId: string): Promise<MissedTaskRecord[]>;
  findPending(): Promise<MissedTaskRecord[]>;
  resolve(id: string, action: 'ACCEPTED' | 'RESCHEDULED' | 'DISMISSED', resolvedAt: string, deferralReason?: string | null): Promise<MissedTaskRecord>;
}
