import { createBackup, EMPTY_CURRENT_SESSION, parseBackup } from '../src/game/backup';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { createGame, applyAction } from '../src/game/engine';
import { createGameStorage, STORAGE_KEYS } from '../src/storage-store';
import type { Session } from '../src/game/types';
import { normalizePreferences } from '../src/game/preferences';

function fixture(name = '备份测试'): Session {
  const board = BOARD_LIBRARY[0];
  return { current: createGame(name, board.name, boardSeats(board).map(role => ({ name: '', role })), DEFAULT_RULES), undo: [], redo: [] };
}

function memoryStore(withAtomic = true) {
  const values = new Map<string, string>();
  const kv = {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
    ...(withAtomic ? { multiSet: jest.fn(async (pairs: [string, string][]) => { pairs.forEach(([key, value]) => values.set(key, value)); }) } : {}),
  };
  return { values, kv, storage: createGameStorage(kv) };
}

async function ready(storage: ReturnType<typeof createGameStorage>) {
  await Promise.all([storage.readSession(), storage.readHistory(), storage.readPreferences()]);
}

describe('offline backup codec', () => {
  it('round-trips the versioned backup and accepts the old raw export shape', () => {
    const session = fixture();
    const history = [applyAction(session.current, { type: 'finish', winner: 'draw', reason: '测试结束' })];
    const payload = createBackup({ session, history, preferences: { hostingMode: 'standard', profiles: [] } }, 1700000000000);
    const parsed = parseBackup(JSON.stringify(payload));
    expect(parsed.legacy).toBe(false);
    expect(parsed.backup.exportedAt).toBe(1700000000000);
    expect(parsed.backup.session?.current.id).toBe(session.current.id);
    const old = parseBackup(JSON.stringify({ current: JSON.stringify(session), history: JSON.stringify(history), recovery: '[]', preferences: JSON.stringify({ hostingMode: 'standard', profiles: [] }) }));
    expect(old.legacy).toBe(true);
    expect(old.backup.history[0].id).toBe(history[0].id);
  });

  it('rejects missing fields, unsupported versions, duplicate history and invalid preferences', () => {
    expect(() => parseBackup('{}')).toThrow();
    expect(() => parseBackup(JSON.stringify({ format: 'nightfall-host-backup', version: 2, exportedAt: Date.now(), session: null, history: [], preferences: {} }))).toThrow();
    const ended = applyAction(fixture().current, { type: 'finish', winner: 'draw', reason: '重复' });
    const duplicate = createBackup({ session: null, history: [ended, ended], preferences: { hostingMode: 'standard', profiles: [] } });
    expect(() => parseBackup(JSON.stringify(duplicate))).toThrow(/重复/);
    expect(() => parseBackup(JSON.stringify({ ...createBackup({ session: null, history: [], preferences: { hostingMode: 'standard', profiles: [] } }), preferences: { hostingMode: 'standard', profiles: [{ id: 'x' }] } }))).toThrow();
  });
});

describe('atomic offline backup restore', () => {
  it.each(['export', 'restore'] as const)('finishes an already accepted archive before immediately starting a backup %s', async transfer => {
    const target = memoryStore(); await ready(target.storage);
    const session = fixture('已接受的归档');
    session.current = applyAction(session.current, { type: 'finish', winner: 'good', reason: '完整结束' });
    const saving = target.storage.persistSession(session);
    const empty = JSON.stringify(createBackup({ session: null, history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
    const transferring = transfer === 'export' ? target.storage.exportBackup() : target.storage.restoreBackup(empty);
    await expect(Promise.all([saving, transferring])).resolves.toBeDefined();
    expect((await target.storage.readSession())?.current.id).toBe(session.current.id);
    expect((await target.storage.readHistory()).map(game => game.id)).toEqual([session.current.id]);
    if (transfer === 'export') {
      const result = await transferring as string;
      expect(parseBackup(result).backup.history[0].id).toBe(session.current.id);
    }
  });

  it('preserves previous recovery records without recursively embedding them on repeated imports', async () => {
    const target = memoryStore(); await ready(target.storage);
    await target.storage.persistSession(fixture('原始局'));
    const empty = JSON.stringify(createBackup({ session: null, history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
    for (let index = 0; index < 3; index++) await target.storage.restoreBackup(empty);
    const records = JSON.parse(target.values.get(STORAGE_KEYS.recovery)!) as { raw: string }[];
    expect(records).toHaveLength(3);
    expect(records.every(record => JSON.parse(record.raw).recovery === null)).toBe(true);
    expect((await target.storage.readSession())?.current.name).toBe('原始局');
  });

  it('exports, restores and preserves an existing active local game by default', async () => {
    const source = memoryStore(); await ready(source.storage);
    const imported = fixture('备份中的局');
    await source.storage.persistSession({ current: imported.current, undo: [], redo: [] });
    const finished = applyAction(imported.current, { type: 'finish', winner: 'draw', reason: '来源复盘' });
    await source.storage.persistHistoryGame(finished);
    const raw = await source.storage.exportBackup();
    const target = memoryStore(); await ready(target.storage);
    const local = fixture('本机进行中');
    await target.storage.persistSession(local);
    const result = await target.storage.restoreBackup(raw);
    expect(result.sessionReplaced).toBe(false);
    expect((await target.storage.readSession())?.current.name).toBe('本机进行中');
    expect((await target.storage.readHistory()).map(game => game.id)).toContain(finished.id);
    const replaced = await target.storage.restoreBackup(raw, true);
    expect(replaced.sessionReplaced).toBe(true);
    expect((await target.storage.readSession())?.current.name).toBe('备份中的局');
  });

  it('does not clear the current game for an empty backup and refuses non-atomic storage', async () => {
    const target = memoryStore(); await ready(target.storage);
    const local = fixture('保留本机'); await target.storage.persistSession(local);
    const empty = JSON.stringify(createBackup({ session: null, history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
    await target.storage.restoreBackup(empty);
    expect((await target.storage.readSession())?.current.name).toBe('保留本机');
    const noAtomic = memoryStore(false); await ready(noAtomic.storage);
    await expect(noAtomic.storage.restoreBackup(empty)).rejects.toThrow(/原子/);
  });

  it('leaves all keys untouched when the atomic write fails', async () => {
    const target = memoryStore(); await ready(target.storage);
    const local = fixture('原始本机'); await target.storage.persistSession(local);
    const before = new Map(target.values);
    target.kv.multiSet!.mockRejectedValueOnce(new Error('transaction failed'));
    const incoming = JSON.stringify(createBackup({ session: fixture('导入局'), history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
    await expect(target.storage.restoreBackup(incoming, true)).rejects.toThrow('transaction failed');
    expect([...target.values]).toEqual([...before]);
  });

  it('preserves damaged source bytes and requires explicit confirmation to restore it', async () => {
    const target = memoryStore();
    const damagedRaw = '{ current session cannot be decoded';
    target.values.set(STORAGE_KEYS.current, damagedRaw);
    await Promise.all([target.storage.readHistory(), target.storage.readPreferences()]);
    await expect(target.storage.readSession()).rejects.toThrow();
    const incoming = JSON.stringify(createBackup({ session: fixture('恢复来源'), history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
    await expect(target.storage.restoreBackup(incoming)).rejects.toThrow(/确认/);
    const prior = new Map(target.values);
    await target.storage.restoreBackup(incoming, true);
    expect((await target.storage.readSession())?.current.name).toBe('恢复来源');
    const records = JSON.parse(target.values.get(STORAGE_KEYS.recovery)!) as { raw: string }[];
    expect(records.at(-1)?.raw).toBe(JSON.stringify({ current: damagedRaw, history: null, recovery: null, preferences: null }));
    expect(target.values.get(STORAGE_KEYS.current)).not.toBe(prior.get(STORAGE_KEYS.current));
  });

  it('atomically marks a damaged current as empty when the backup has no current game', async () => {
    const target = memoryStore();
    const damagedRaw = '{ damaged current';
    target.values.set(STORAGE_KEYS.current, damagedRaw);
    await Promise.all([target.storage.readHistory(), target.storage.readPreferences()]);
    const empty = JSON.stringify(createBackup({ session: null, history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
    await target.storage.restoreBackup(empty, true);
    expect(target.values.get(STORAGE_KEYS.current)).toBe(EMPTY_CURRENT_SESSION);
    expect(await target.storage.readSession()).toBeNull();
    expect(parseBackup(await target.storage.exportBackup()).backup.session).toBeNull();
    const next = fixture('清理后新局');
    await target.storage.persistSession(next);
    expect((await target.storage.readSession())?.current.id).toBe(next.current.id);
    await target.storage.restoreBackup(empty, true);
    expect((await target.storage.readSession())?.current.id).toBe(next.current.id);
    await target.storage.clearSession();
    expect(await target.storage.readSession()).toBeNull();
  });

  it('merges profiles and finished matches by id without duplicating either', async () => {
    const target = memoryStore(); await ready(target.storage);
    const source = fixture('用于方案');
    const localEnded = applyAction(source.current, { type: 'finish', winner: 'draw', reason: '本机复盘' });
    await target.storage.persistHistoryGame(localEnded);
    const profile = { id: 'same-profile', name: '本机桌规', boardName: source.current.board, roles: source.current.players.map(player => player.role), rules: source.current.rules };
    await target.storage.persistPreferences(normalizePreferences({ hostingMode: 'custom', profiles: [profile], selectedProfileId: profile.id }));
    const incoming = createBackup({ session: null, history: [{ ...localEnded, name: '导入复盘' }], preferences: normalizePreferences({ hostingMode: 'custom', profiles: [{ ...profile, name: '导入桌规' }], selectedProfileId: profile.id }) });
    await target.storage.restoreBackup(JSON.stringify(incoming));
    expect(await target.storage.readHistory()).toHaveLength(1);
    expect((await target.storage.readHistory())[0].name).toBe('导入复盘');
    const preferences = await target.storage.readPreferences();
    expect(preferences.profiles).toHaveLength(1);
    expect(preferences.profiles?.[0].name).toBe('导入桌规');
  });

  it('blocks new writes throughout an in-flight restore', async () => {
    const target = memoryStore(); await ready(target.storage);
    const incoming = JSON.stringify(createBackup({ session: fixture('恢复中'), history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
    let release!: () => void;
    target.kv.multiSet!.mockImplementationOnce(pairs => new Promise<void>(resolve => {
      release = () => { pairs.forEach(([key, value]) => target.values.set(key, value)); resolve(); };
    }));
    const importing = target.storage.restoreBackup(incoming, true);
    for (let attempt = 0; attempt < 20 && !release; attempt++) await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(release).toBeDefined();
    await expect(target.storage.persistSession(fixture('竞争写入'))).rejects.toThrow(/导入/);
    release();
    await importing;
  });
});
