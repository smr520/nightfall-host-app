import Storage from 'expo-sqlite/kv-store';
import { createGameStorage } from './storage-store';

const store = createGameStorage(Storage);
export const { readSession, readHistory, persistSession, retryPersistSession, persistHistoryGame, removeArchivedGame, clearSession, clearDamagedSession, exportRawData, exportBackup, restoreBackup, readPreferences, persistPreferences, readAppRole, persistAppRole, getWarnings } = store;
export type { AppRole } from './storage-store';
