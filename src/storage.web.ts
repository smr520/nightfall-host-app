import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { createGameStorage } from './storage-store';

const DATABASE_NAME = 'ExpoSQLiteStorage';
let databasePromise: Promise<SQLiteDatabase> | null = null;

async function database() {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).then(async db => {
      await db.execAsync('CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT);');
      return db;
    });
  }
  return databasePromise;
}

/**
 * Expo SQLite Web cannot use the built-in KV store's exclusive multiSet
 * transaction. This adapter keeps the same database/table while using a Web
 * compatible transaction for atomic backup import.
 */
export const webKeyValueStore = {
  async getItem(key: string) {
    const db = await database();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM storage WHERE key = ?;', key);
    return row?.value ?? null;
  },
  async setItem(key: string, value: string) {
    const db = await database();
    await db.runAsync(
      'INSERT INTO storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
      key,
      value,
    );
  },
  async removeItem(key: string) {
    const db = await database();
    await db.runAsync('DELETE FROM storage WHERE key = ?;', key);
  },
  async multiSet(pairs: [string, string][]) {
    const db = await database();
    await db.withTransactionAsync(async () => {
      for (const [key, value] of pairs) {
        await db.runAsync(
          'INSERT INTO storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
          key,
          value,
        );
      }
    });
  },
};

const store = createGameStorage(webKeyValueStore);
export const {
  readSession,
  readHistory,
  persistSession,
  retryPersistSession,
  persistHistoryGame,
  removeArchivedGame,
  clearSession,
  clearDamagedSession,
  exportRawData,
  exportBackup,
  restoreBackup,
  readPreferences,
  persistPreferences,
  readAppRole,
  persistAppRole,
  getWarnings,
} = store;
export type { AppRole } from './storage-store';
