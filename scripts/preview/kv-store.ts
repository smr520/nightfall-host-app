import type { KeyValueStorage } from '../../src/storage-store';

// Volatile preview data. This deliberately never reads the user's Android saves.
const values = new Map<string, string>();
const previewStorage: KeyValueStorage = {
  async getItem(key) { return values.get(key) ?? null; },
  async setItem(key, value) { values.set(key, value); },
  async removeItem(key) { values.delete(key); },
  async multiSet(pairs) { pairs.forEach(([key, value]) => values.set(key, value)); },
};
export default previewStorage;
