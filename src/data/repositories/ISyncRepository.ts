import { OutboxItem, SyncTombstone, SyncEntityType, MutationType } from '../../domain/sync/SyncTypes';

export interface ISyncRepository {
  addToOutbox(item: {
    id: string;
    mutationType: MutationType;
    entityType: SyncEntityType;
    entityId: string;
    payload?: any;
    createdAt: string;
  }): Promise<void>;

  getPendingOutboxItems(limit?: number): Promise<OutboxItem[]>;
  removeOutboxItem(id: string): Promise<void>;
  updateOutboxItemFailure(id: string, errorMessage: string, retryCount: number): Promise<void>;

  recordTombstone(entityType: SyncEntityType, entityId: string): Promise<void>;
  isTombstoned(entityType: SyncEntityType, entityId: string): Promise<boolean>;
  getTombstones(): Promise<SyncTombstone[]>;

  getMetadata(key: string): Promise<string | null>;
  setMetadata(key: string, value: string): Promise<void>;

  clearOutbox(): Promise<void>;
}
