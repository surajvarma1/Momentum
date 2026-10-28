/**
 * Migration runner for SQLite database.
 * Tracks applied migrations and runs pending ones in order.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { ALL_MIGRATIONS, Migration } from './migrations/001_initial';

export class MigrationRunner {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Run all pending migrations in order.
   * Each migration runs in a transaction.
   */
  async runAll(): Promise<{ applied: number; total: number }> {
    // Ensure schema_version table exists (bootstrap)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    const currentVersion = await this.getCurrentVersion();
    const pendingMigrations = ALL_MIGRATIONS.filter(
      (m) => m.version > currentVersion,
    );

    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }

    return {
      applied: pendingMigrations.length,
      total: ALL_MIGRATIONS.length,
    };
  }

  /**
   * Get the current schema version.
   * Returns 0 if no migrations have been applied.
   */
  async getCurrentVersion(): Promise<number> {
    try {
      const result = await this.db.getFirstAsync<{ version: number }>(
        'SELECT MAX(version) as version FROM schema_version',
      );
      return result?.version ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Run a single migration within a transaction.
   */
  private async runMigration(migration: Migration): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      // Execute each SQL statement in the migration
      for (const sql of migration.up) {
        await this.db.execAsync(sql);
      }

      // Record the migration
      await this.db.runAsync(
        'INSERT INTO schema_version (version, description, applied_at) VALUES (?, ?, ?)',
        [migration.version, migration.description, new Date().toISOString()],
      );
    });
  }
}
