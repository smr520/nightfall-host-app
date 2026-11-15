import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import type { SetupMemory } from '../src/game/setup-memory';
import { createGameStorage, STORAGE_KEYS } from '../src/storage-store';
import { normalizePreferences, profileBoard, type HostingProfile } from '../src/ui/preferences';

function profile(id = 'fixed-table'): HostingProfile {
  return { id, name: '周五固定桌', boardName: '预女猎白', roles: boardSeats(BOARD_LIBRARY[0]), rules: { ...DEFAULT_RULES, sheriff: false, guardSave: 'live' } };
}

function setup(): SetupMemory {
  const roles = boardSeats(BOARD_LIBRARY[0]);
  return {
    version: 1, mode: 'standard', boardId: BOARD_LIBRARY[0].id, boardName: BOARD_LIBRARY[0].name, roles,
    rules: { ...DEFAULT_RULES, sheriff: false, win: 'all', speechSeconds: 150 },
    playerNames: roles.map((_, index) => index === 0 ? '阿明' : ''), gameName: '周五局', savedAt: 1,
  };
}

function memoryStore() {
  const values = new Map<string, string>();
  const kv = {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
  };
  return { values, kv, storage: createGameStorage(kv) };
}

describe('personal hosting preferences', () => {
  it('migrates the previous mode-only settings without inventing a saved plan', () => {
    expect(normalizePreferences({ hostingMode: 'quick' })).toEqual({ hostingMode: 'quick', profiles: [] });
    expect(normalizePreferences({ hostingMode: 'custom' })).toEqual({ hostingMode: 'custom', profiles: [] });
    expect(normalizePreferences(null)).toEqual({ hostingMode: 'standard', profiles: [] });
  });

  it('round-trips a named lineup and every table rule across a storage restart', async () => {
    const { storage, kv } = memoryStore();
    await storage.readPreferences();
    const preferences = { hostingMode: 'custom' as const, profiles: [profile()], selectedProfileId: 'fixed-table' };
    await storage.persistPreferences(preferences);
    const reloaded = createGameStorage(kv);
    expect(await reloaded.readPreferences()).toEqual(preferences);
    expect(profileBoard(preferences.profiles[0]).counts).toEqual(BOARD_LIBRARY[0].counts);
  });

  it('round-trips the last setup with the saved plan', async () => {
    const { storage, kv } = memoryStore();
    await storage.readPreferences();
    const preferences = { hostingMode: 'standard' as const, profiles: [profile()], lastSetup: setup() };
    await storage.persistPreferences(preferences);
    expect(await createGameStorage(kv).readPreferences()).toEqual(preferences);
  });

  it('round-trips the host reading size independently of table plans', async () => {
    const { storage, kv } = memoryStore();
    await storage.readPreferences();
    const preferences = { hostingMode: 'standard' as const, profiles: [profile()], textSize: 'xlarge' as const };
    await storage.persistPreferences(preferences);
    expect(await createGameStorage(kv).readPreferences()).toEqual(preferences);
  });

  it('isolates an invalid host reading size without dropping valid profiles', async () => {
    const { values, storage } = memoryStore();
    const raw = JSON.stringify({ hostingMode: 'standard', profiles: [profile()], textSize: 'huge' });
    values.set(STORAGE_KEYS.preferences, raw);
    const read = await storage.readPreferences();
    expect(read.profiles).toEqual([profile()]);
    expect(read.textSize).toBeUndefined();
    expect(JSON.parse(values.get(STORAGE_KEYS.recovery)!)[0]).toMatchObject({ source: STORAGE_KEYS.preferences, raw });
  });

  it('backs up a corrupted last setup while keeping usable plans', async () => {
    const { values, storage } = memoryStore();
    const raw = JSON.stringify({ hostingMode: 'standard', profiles: [profile()], lastSetup: { ...setup(), playerNames: [] } });
    values.set(STORAGE_KEYS.preferences, raw);
    const read = await storage.readPreferences();
    expect(read.profiles).toEqual([profile()]);
    expect(read.lastSetup).toBeUndefined();
    const recovery = JSON.parse(values.get(STORAGE_KEYS.recovery)!);
    expect(recovery[0]).toMatchObject({ source: STORAGE_KEYS.preferences, raw });
  });

  it('recovers valid entries independently and drops dangling selections', () => {
    const valid = profile();
    const invalidRole = { ...profile('unknown-role'), roles: ['wolf', 'not-a-role', ...valid.roles.slice(2)] };
    const invalidRules = { ...profile('bad-rules'), rules: { ...DEFAULT_RULES, sheriff: 'yes' } };
    const tooFew = { ...profile('too-few'), roles: ['wolf', 'villager', 'seer'] };
    const noGod = { ...profile('no-god'), roles: ['wolf', 'wolf', 'villager', 'villager', 'villager', 'villager'] };
    const result = normalizePreferences({ hostingMode: 'custom', profiles: [valid, invalidRole, invalidRules, tooFew, noGod, valid], selectedProfileId: 'unknown-role' });
    expect(result.profiles).toEqual([valid]);
    expect(result.selectedProfileId).toBeUndefined();
  });

  it('backs up malformed preferences before allowing repaired settings to be saved', async () => {
    const { values, storage } = memoryStore();
    const raw = JSON.stringify({ hostingMode: 'custom', profiles: [profile(), { broken: true }], selectedProfileId: 'fixed-table' });
    values.set(STORAGE_KEYS.preferences, raw);
    const read = await storage.readPreferences();
    expect(read.profiles).toEqual([profile()]);
    const recovery = JSON.parse(values.get(STORAGE_KEYS.recovery)!);
    expect(recovery[0]).toMatchObject({ source: STORAGE_KEYS.preferences, raw });
    await storage.persistPreferences(read);
    const exported = JSON.parse(await storage.exportRawData());
    expect(exported.preferences).toBe(values.get(STORAGE_KEYS.preferences));
  });

  it('preserves unread data when a read or damaged-data backup fails', async () => {
    const { values, storage, kv } = memoryStore();
    const raw = '{broken';
    values.set(STORAGE_KEYS.preferences, raw);
    kv.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(storage.readPreferences()).rejects.toThrow('disk full');
    await expect(storage.persistPreferences({ hostingMode: 'standard', profiles: [] })).rejects.toThrow('尚未安全读取');
    expect(values.get(STORAGE_KEYS.preferences)).toBe(raw);
  });

  it('serializes quick changes so the last selected plan wins', async () => {
    const { values, storage, kv } = memoryStore();
    await storage.readPreferences();
    let releaseFirst!: () => void;
    const gate = new Promise<void>(resolve => { releaseFirst = resolve; });
    kv.setItem.mockImplementationOnce(async (key, value) => { await gate; values.set(key, value); });
    const first = storage.persistPreferences({ hostingMode: 'standard', profiles: [profile()] });
    const last = storage.persistPreferences({ hostingMode: 'custom', profiles: [profile()], selectedProfileId: 'fixed-table' });
    await Promise.resolve();
    expect(kv.setItem).toHaveBeenCalledTimes(1);
    releaseFirst();
    await Promise.all([first, last]);
    expect(JSON.parse(values.get(STORAGE_KEYS.preferences)!)).toMatchObject({ hostingMode: 'custom', selectedProfileId: 'fixed-table' });
  });

  it('does not let an invalid save replace valid saved profiles', async () => {
    const { values, storage } = memoryStore();
    await storage.readPreferences();
    await storage.persistPreferences({ hostingMode: 'custom', profiles: [profile()] });
    const original = values.get(STORAGE_KEYS.preferences);
    await expect(storage.persistPreferences({ profiles: [{ ...profile(), roles: [] }] })).rejects.toThrow('方案无效');
    expect(values.get(STORAGE_KEYS.preferences)).toBe(original);
  });
});
