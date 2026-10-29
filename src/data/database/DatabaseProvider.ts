/**
 * Database provider - initializes and provides the SQLite database instance.
 * Handles database opening, WAL mode, foreign keys, and migrations.
 */

import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { MigrationRunner } from './MigrationRunner';

const DB_NAME = 'momentum.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Clean up database connection on web before page unloads to release OPFS SyncAccessHandles
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (dbInstance) {
      try {
        dbInstance.closeSync?.();
      } catch {
        // Ignored during page unload
      }
      dbInstance = null;
      dbInitPromise = null;
    }
  });
}

/**
 * Initialize and return the database instance.
 * Uses an initialization mutex promise to guarantee that multiple concurrent callers
 * never attempt to open simultaneous OPFS sync access handles.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = (async () => {
    try {
      let db: SQLite.SQLiteDatabase;

      console.log(`[Database] Opening database "${DB_NAME}" on platform: ${Platform.OS}`);
      if (Platform.OS === 'web') {
        try {
          db = await SQLite.openDatabaseAsync(DB_NAME);
          console.log('[Database] openDatabaseAsync resolved on web');
        } catch (err: any) {
          console.warn('[Database] Falling back to in-memory SQLite on web:', err);
          db = await SQLite.openDatabaseAsync(':memory:');
          console.log('[Database] openDatabaseAsync in-memory resolved on web');
        }
      } else {
        db = await SQLite.openDatabaseAsync(DB_NAME);
      }
      console.log('[Database] Running migrations...');

      // Enable WAL mode on native Android/iOS for better concurrent read performance
      if (Platform.OS !== 'web') {
        try {
          await db.execAsync('PRAGMA journal_mode = WAL');
        } catch {
          // Graceful fallback
        }
      }

      // Enable foreign key constraints
      try {
        await db.execAsync('PRAGMA foreign_keys = ON');
      } catch {
        // Graceful fallback
      }

      // Run pending migrations
      const migrationRunner = new MigrationRunner(db);
      const result = await migrationRunner.runAll();

      if (result.applied > 0) {
        console.log(
          `[Database] Applied ${result.applied} migration(s). Schema at version ${result.total}.`,
        );
      }

      dbInstance = db;
      return db;
    } finally {
      dbInitPromise = null;
    }
  })();

  return dbInitPromise;
}

/**
 * Close the database connection and clear the cached instance.
 * Used during testing or app shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
  dbInitPromise = null;
}

/**
 * Reset the cached instance without closing.
 * Used primarily in testing when the database is managed externally.
 */
export function resetDatabaseInstance(): void {
  dbInstance = null;
  dbInitPromise = null;
}
