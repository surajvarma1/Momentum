/**
 * Database migration definitions.
 * Each migration has a version number, description, and SQL statements.
 */

export interface Migration {
  version: number;
  description: string;
  up: string[];
}

/**
 * Initial database schema - Version 1.
 * Creates tasks, subtasks, app_settings, and schema_version tables.
 */
export const MIGRATION_001_INITIAL: Migration = {
  version: 1,
  description: 'Initial schema: tasks, subtasks, app_settings',
  up: [
    // Schema version tracking
    `CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,

    // Tasks table
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      energy_level TEXT NOT NULL DEFAULT 'MEDIUM',
      status TEXT NOT NULL DEFAULT 'PENDING',
      estimated_duration_minutes INTEGER,
      deadline TEXT,
      deadline_timezone TEXT,
      tags TEXT DEFAULT '[]',
      recurrence_rule TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      cancelled_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'IMPORTANT')),
      CHECK (energy_level IN ('LOW', 'MEDIUM', 'HIGH')),
      CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
    )`,

    // Subtasks table
    `CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )`,

    // Application settings key-value store
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,

    // Indexes for common query patterns
    `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)`,
  ],
};

import { MIGRATION_002_PHASE2 } from './002_phase2';
import { MIGRATION_003_PHASE3 } from './003_phase3';

/**
 * All migrations in order. Add new migrations to this array.
 */
export const ALL_MIGRATIONS: Migration[] = [
  MIGRATION_001_INITIAL,
  MIGRATION_002_PHASE2,
  MIGRATION_003_PHASE3,
];
