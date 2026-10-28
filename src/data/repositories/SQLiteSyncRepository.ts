import type { SQLiteDatabase } from 'expo-sqlite';
import { ISyncRepository } from './ISyncRepository';
import { OutboxItem, SyncTombstone, SyncEntityType, MutationType } from '../../domain/sync/SyncTypes';

interface OutboxRow {
  id: string;
  mutation_type: string;
  entity_type: string;
  entity_id: string;
  payload: string | null;
  created_at: string;
  retry_count: number;
  last_attempt_at: string | null;
  error_message: string | null;
}

interface TombstoneRow {
  id: string;
  entity_type: string;
  entity_id: string;
  deleted_at: string;
}

export class SQLiteSyncRepository implements ISyncRepository {
  constructor(private db: SQLiteDatabase) {}

  async addToOutbox(item: {
    id: string;
    mutationType: MutationType;
    entityType: SyncEntityType;
    entityId: string;
    payload?: any;
    createdAt: string;
  }): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sync_outbox (id, mutation_type, entity_type, entity_id, payload, created_at, retry_count)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [
        item.id,
        item.mutationType,
        item.entityType,
        item.entityId,
        item.payload ? JSON.stringify(item.payload) : null,
        item.createdAt,
      ],
    );
  }

  async getPendingOutboxItems(limit: number = 50): Promise<OutboxItem[]> {
    const rows = await this.db.getAllAsync<OutboxRow>(
      `SELECT * FROM sync_outbox ORDER BY created_at ASC LIMIT ?`,
      [limit],
    );

    return rows.map((r) => ({
      id: r.id,
      mutationType: r.mutation_type as MutationType,
      entityType: r.entity_type as SyncEntityType,
      entityId: r.entity_id,
      payload: r.payload ? JSON.parse(r.payload) : null,
      createdAt: r.created_at,
      retryCount: r.retry_count,
      lastAttemptAt: r.last_attempt_at || undefined,
      errorMessage: r.error_message || undefined,
    }));
  }

  async removeOutboxItem(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM sync_outbox WHERE id = ?`, [id]);
  }

  async updateOutboxItemFailure(id: string, errorMessage: string, retryCount: number): Promise<void> {
    await this.db.runAsync(
      `UPDATE sync_outbox
       SET error_message = ?, retry_count = ?, last_attempt_at = ?
       WHERE id = ?`,
      [errorMessage, retryCount, new Date().toISOString(), id],
    );
  }

  async recordTombstone(entityType: SyncEntityType, entityId: string): Promise<void> {
    const id = `${entityType}_${entityId}_${Date.now()}`;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO sync_tombstones (id, entity_type, entity_id, deleted_at)
       VALUES (?, ?, ?, ?)`,
      [id, entityType, entityId, new Date().toISOString()],
    );
  }

  async isTombstoned(entityType: SyncEntityType, entityId: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_tombstones WHERE entity_type = ? AND entity_id = ?`,
      [entityType, entityId],
    );
    return (row?.count ?? 0) > 0;
  }

  async getTombstones(): Promise<SyncTombstone[]> {
    const rows = await this.db.getAllAsync<TombstoneRow>(
      `SELECT * FROM sync_tombstones ORDER BY deleted_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      entityType: r.entity_type as SyncEntityType,
      entityId: r.entity_id,
      deletedAt: r.deleted_at,
    }));
  }

  async getMetadata(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_metadata WHERE key = ?`,
      [key],
    );
    return row?.value ?? null;
  }

  async setMetadata(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
       VALUES (?, ?, ?)`,
      [key, value, new Date().toISOString()],
    );
  }

  async clearOutbox(): Promise<void> {
    await this.db.runAsync(`DELETE FROM sync_outbox`);
  }
}
