/**
 * Database schema migration - Version 2 (Phase 2).
 * Adds reminders, focus_sessions, and missed_task_records tables.
 */

import { Migration } from './001_initial';

export const MIGRATION_002_PHASE2: Migration = {
  version: 2,
  description: 'Phase 2: reminders, focus_sessions, missed_task_records',
  up: [
    // Reminders table
    `CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      type TEXT NOT NULL,
      trigger_time TEXT NOT NULL,
      offset_minutes INTEGER,
      recurrence_rule TEXT,
      repeat_count INTEGER NOT NULL DEFAULT 0,
      max_repeats INTEGER NOT NULL DEFAULT 3,
      is_nag_enabled INTEGER NOT NULL DEFAULT 0,
      snooze_until TEXT,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      native_notification_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (type IN ('ONE_TIME', 'BEFORE_DEADLINE', 'RECURRING')),
      CHECK (status IN ('SCHEDULED', 'TRIGGERED', 'DISMISSED', 'CANCELLED', 'SNOOZED')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )`,

    // Focus sessions table
    `CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT,
      state TEXT NOT NULL DEFAULT 'IDLE',
      target_duration_ms INTEGER NOT NULL DEFAULT 1500000,
      break_duration_ms INTEGER NOT NULL DEFAULT 300000,
      start_time TEXT NOT NULL,
      pause_time TEXT,
      accumulated_paused_ms INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      cancelled_at TEXT,
      actual_focus_duration_ms INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      interruption_logged INTEGER NOT NULL DEFAULT 0,
      interruption_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (state IN ('IDLE', 'FOCUSING', 'PAUSED', 'BREAK', 'COMPLETED', 'CANCELLED')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    )`,

    // Missed task records table
    `CREATE TABLE IF NOT EXISTS missed_task_records (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      suggested_deadline TEXT NOT NULL,
      action_taken TEXT,
      resolved_at TEXT,
      deferral_reason TEXT,
      created_at TEXT NOT NULL,
      CHECK (action_taken IS NULL OR action_taken IN ('ACCEPTED', 'RESCHEDULED', 'DISMISSED')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )`,

    // Indexes for Phase 2 query patterns
    `CREATE INDEX IF NOT EXISTS idx_reminders_task_id ON reminders(task_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reminders_trigger_time ON reminders(trigger_time)`,
    `CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status)`,
    `CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id ON focus_sessions(task_id)`,
    `CREATE INDEX IF NOT EXISTS idx_focus_sessions_state ON focus_sessions(state)`,
    `CREATE INDEX IF NOT EXISTS idx_focus_sessions_start_time ON focus_sessions(start_time)`,
    `CREATE INDEX IF NOT EXISTS idx_missed_task_task_id ON missed_task_records(task_id)`,
  ],
};
