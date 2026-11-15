import type { KeyValueStorage } from '../storage-store';
import { migratePlayerNotebook, type PlayerNotebook } from './notes';

export const PLAYER_NOTEBOOK_KEY = 'nightfall.playerNotebook.v1';

export function createPlayerNotebookStorage(kv: KeyValueStorage) {
  return {
    async read(): Promise<PlayerNotebook | null> {
      const raw = await kv.getItem(PLAYER_NOTEBOOK_KEY);
      if (raw === null) return null;
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { throw new Error('玩家笔记损坏，原始记录未被覆盖'); }
      const notebook = migratePlayerNotebook(parsed);
      if (!notebook) throw new Error('玩家笔记结构不兼容，原始记录未被覆盖');
      return notebook;
    },
    async persist(notebook: PlayerNotebook): Promise<void> {
      await kv.setItem(PLAYER_NOTEBOOK_KEY, JSON.stringify(notebook));
    },
    async clear(): Promise<void> {
      await kv.removeItem(PLAYER_NOTEBOOK_KEY);
    },
  };
}

export type PlayerNotebookStorage = ReturnType<typeof createPlayerNotebookStorage>;

