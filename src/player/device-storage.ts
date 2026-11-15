import type { PlayerNotebook } from './notes';
import { createPlayerNotebookStorage, type PlayerNotebookStorage } from './storage';

let storagePromise: Promise<PlayerNotebookStorage> | null = null;

function loadStorage() {
  if (!storagePromise) {
    storagePromise = import('expo-sqlite/kv-store').then(module => createPlayerNotebookStorage(module.default));
  }
  return storagePromise;
}

/** 延迟加载本机 SQLite，避免测试或未进入玩家页时初始化原生存储。 */
export const playerNotebookStorage: PlayerNotebookStorage = {
  async read() { return (await loadStorage()).read(); },
  async persist(notebook: PlayerNotebook) { return (await loadStorage()).persist(notebook); },
  async clear() { return (await loadStorage()).clear(); },
};
