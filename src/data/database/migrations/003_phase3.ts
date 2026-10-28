/**
 * Database schema migration - Version 3 (Phase 3).
 * Adds sync_outbox, sync_tombstones, sync_metadata tables and server_version columns.
 */

import { Migration } from './001_initial';

export const MIGRATION_003_PHASE3: Migration = {
  version: 3,
  description: 'Phase 3: sync_outbox, sync_tombstones, sync_metadata, and server_version',
  up: [
    // Sync Outbox for local-first mutations awaiting remote synchronization
    `CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      mutation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      error_message TEXT,
      CHECK (mutation_type IN ('CREATE', 'UPDATE', 'DELETE')),
      CHECK (entity_type IN ('task', 'subtask', 'focus_session', 'reminder'))
    )`,

    // Sync Tombstones to prevent deleted tasks from resurrecting upon synchronization
    `CREATE TABLE IF NOT EXISTS sync_tombstones (
      id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      CHECK (entity_type IN ('task', 'subtask', 'focus_session', 'reminder'))
    )`,

    // Sync Metadata (e.g., last_synced_at, cursor, current_sync_account)
    `CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,

    // Alter tasks and subtasks to support server_version for optimistic concurrency
    `ALTER TABLE tasks ADD COLUMN server_version INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE subtasks ADD COLUMN server_version INTEGER NOT NULL DEFAULT 1`,

    // Indexes for sync outbox and tombstones
    `CREATE INDEX IF NOT EXISTS idx_sync_outbox_created_at ON sync_outbox(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity_type, entity_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sync_tombstones_entity ON sync_tombstones(entity_type, entity_id)`,
  ],
};
