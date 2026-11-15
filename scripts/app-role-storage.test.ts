import { createGameStorage, STORAGE_KEYS } from '../src/storage-store';

function memoryStore() {
  const values = new Map<string, string>();
  const kv = {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
  };
  return { values, kv, storage: createGameStorage(kv) };
}

describe('app role entry', () => {
  it('asks on first launch, then remembers the chosen role across restarts', async () => {
    const { storage, values, kv } = memoryStore();
    expect(await storage.readAppRole()).toBeNull();

    await storage.persistAppRole('player');
    expect(values.get(STORAGE_KEYS.appRole)).toBe('player');
    expect(await storage.readAppRole()).toBe('player');

    const reloaded = createGameStorage(kv);
    expect(await reloaded.readAppRole()).toBe('player');

    await storage.persistAppRole('host');
    expect(await storage.readAppRole()).toBe('host');
  });

  it('rejects an invalid role and asks again instead of overwriting host data', async () => {
    const { storage, values } = memoryStore();
    values.set(STORAGE_KEYS.current, 'untouched-host-session');
    values.set(STORAGE_KEYS.appRole, 'referee');

    expect(await storage.readAppRole()).toBeNull();
    expect(storage.getWarnings().join('\n')).toContain('身份入口记录无法识别');
    expect(values.get(STORAGE_KEYS.current)).toBe('untouched-host-session');
    await expect(storage.persistAppRole('referee' as never)).rejects.toThrow('身份入口无效');
    expect(values.get(STORAGE_KEYS.appRole)).toBe('referee');
  });
});
