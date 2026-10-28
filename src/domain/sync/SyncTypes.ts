export type MutationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncEntityType = 'task' | 'subtask' | 'focus_session' | 'reminder';

export interface OutboxItem {
  id: string;
  mutationType: MutationType;
  entityType: SyncEntityType;
  entityId: string;
  payload: any;
  createdAt: string;
  retryCount: number;
  lastAttemptAt?: string;
  errorMessage?: string;
}

export interface SyncTombstone {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  deletedAt: string;
}

export interface SyncConflict {
  entityId: string;
  entityType: SyncEntityType;
  localTimestamp: string;
  remoteTimestamp: string;
  resolution: 'LOCAL_APPLIED' | 'REMOTE_APPLIED' | 'MANUAL_REQUIRED';
}

export interface SyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  conflicts: SyncConflict[];
  errors: string[];
}
