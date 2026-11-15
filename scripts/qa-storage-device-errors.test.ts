import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { createBackup, parseBackup } from '../src/game/backup';
import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import { createGameStorage, STORAGE_KEYS } from '../src/storage-store';
import { decodeSession } from '../src/game/save-schema';
import type { Game, Session } from '../src/game/types';

function fixture(): Session {
  const board = BOARD_LIBRARY[0];
  return { current: createGame('设备错误回归', board.name, boardSeats(board).map(role => ({ name: '', role })), DEFAULT_RULES), undo: [], redo: [] };
}

function memoryStore() {
  const values = new Map<string, string>();
  const kv = {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
    multiSet: jest.fn(async (pairs: [string, string][]) => { pairs.forEach(([key, value]) => values.set(key, value)); }),
  };
  return { values, kv, storage: createGameStorage(kv) };
}

const corruptions: [string, (game: Game) => void][] = [
  ['nonexistent-numbered seat', game => { game.players[game.players.length - 1].seat = 100; }],
  ['third PK round', game => { game.stage = 'exile-vote'; game.vote = { kind: 'exile', round: 3, candidates: [3, 4], voters: [1, 2], ballots: {} }; }],
  ['duplicate event ids', game => { game.events.push({ ...game.events[0] }); }],
  ['zero event id', game => { game.events[0].id = 0; }],
  ['future death day', game => { game.players[4] = { ...game.players[4], alive: false, death: { day: game.day + 1, cause: 'knife' } }; }],
  ['duplicate death skill', game => {
    const hunter = game.players.find(player => player.role === 'hunter')!;
    hunter.alive = false; hunter.death = { day: game.day, cause: 'knife' };
    game.stage = 'hunter'; game.pending = [{ kind: 'hunter', seat: hunter.seat }, { kind: 'hunter', seat: hunter.seat }];
  }],
];

describe('corrupt-save judgment boundaries', () => {
  it.each(corruptions)('refuses %s without replacing the source bytes', async (_label, corrupt) => {
    const target = memoryStore();
    const session = fixture(); corrupt(session.current);
    const raw = JSON.stringify(session); target.values.set(STORAGE_KEYS.current, raw);
    await expect(target.storage.readSession()).rejects.toThrow();
    await target.storage.readHistory();
    await expect(target.storage.persistSession(fixture())).rejects.toThrow();
    expect(target.values.get(STORAGE_KEYS.current)).toBe(raw);
    expect(target.kv.setItem).not.toHaveBeenCalled();
    const incoming = JSON.stringify(createBackup({ session, history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
    await expect(target.storage.restoreBackup(incoming, true)).rejects.toThrow();
    expect(target.kv.multiSet).not.toHaveBeenCalled();
  });

  it('isolates a different match from undo/redo and retains its exact raw bytes', async () => {
    const target = memoryStore();
    const session = fixture();
    const foreign = fixture().current; foreign.id = 'different-match';
    session.undo = [foreign]; session.redo = [foreign];
    const raw = JSON.stringify(session); target.values.set(STORAGE_KEYS.current, raw);
    const restored = await target.storage.readSession();
    expect(restored?.current.id).toBe(session.current.id);
    expect(restored?.undo).toEqual([]); expect(restored?.redo).toEqual([]);
    expect(JSON.parse(target.values.get(STORAGE_KEYS.recovery)!)[0].raw).toBe(raw);
    expect(target.values.get(STORAGE_KEYS.current)).toBe(raw);
    const payload = JSON.stringify(createBackup({ session, history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
    expect(() => parseBackup(payload)).toThrow(/对局|撤回/);
    expect(decodeSession(raw).repaired).toBe(true);
  });

  it('does not turn an unfinished match into a completed recap through backup import', async () => {
    const target = memoryStore();
    await Promise.all([target.storage.readSession(), target.storage.readHistory(), target.storage.readPreferences()]);
    const active = fixture().current;
    await expect(target.storage.persistHistoryGame(active)).rejects.toThrow();
    expect(target.values.has(STORAGE_KEYS.history)).toBe(false);
    const raw = JSON.stringify(createBackup({ session: null, history: [active], preferences: { hostingMode: 'standard', profiles: [] } }));
    await expect(target.storage.restoreBackup(raw)).rejects.toThrow();
    expect(target.kv.multiSet).not.toHaveBeenCalled();
  });

  it('preserves disk-failed import state and permits a later valid retry', async () => {
    const target = memoryStore();
    await Promise.all([target.storage.readSession(), target.storage.readHistory(), target.storage.readPreferences()]);
    const local = fixture(); await target.storage.persistSession(local);
    const ended = applyAction(local.current, { type: 'finish', winner: 'draw', reason: '完整结束' });
    const raw = JSON.stringify(createBackup({ session: { current: ended, undo: [local.current], redo: [] }, history: [ended], preferences: { hostingMode: 'quick', profiles: [] } }));
    const before = new Map(target.values);
    target.kv.multiSet.mockRejectedValueOnce(new Error('SQLITE_FULL'));
    await expect(target.storage.restoreBackup(raw, true)).rejects.toThrow('SQLITE_FULL');
    expect([...target.values]).toEqual([...before]);
    await expect(target.storage.restoreBackup(raw, true)).resolves.toMatchObject({ sessionReplaced: true });
    expect((await target.storage.readSession())?.current.stage).toBe('ended');
    expect((await target.storage.readHistory())[0].id).toBe(ended.id);
  });

  it('preserves the import recovery snapshot when an accepted preferences read later discovers corruption', async () => {
    const target = memoryStore();
    await Promise.all([target.storage.readSession(), target.storage.readHistory(), target.storage.readPreferences()]);
    const original = fixture(); await target.storage.persistSession(original);
    target.values.set(STORAGE_KEYS.preferences, 'broken preferences');
    let releaseRead!: () => void; let releaseBackup!: () => void; let commitImport!: () => void;
    let firstPreferencesRead = true;
    target.kv.getItem.mockImplementation(key => {
      if (key === STORAGE_KEYS.preferences && firstPreferencesRead) {
        firstPreferencesRead = false;
        return new Promise(resolve => { releaseRead = () => resolve('broken preferences'); });
      }
      return Promise.resolve(target.values.get(key) ?? null);
    });
    target.kv.setItem.mockImplementation((key, value) => {
      if (key !== STORAGE_KEYS.recovery) { target.values.set(key, value); return Promise.resolve(); }
      return new Promise(resolve => { releaseBackup = () => { target.values.set(key, value); resolve(); }; });
    });
    target.kv.multiSet.mockImplementation(pairs => new Promise(resolve => {
      commitImport = () => { pairs.forEach(([key, value]) => target.values.set(key, value)); resolve(); };
    }));
    const reading = target.storage.readPreferences();
    const incoming = fixture(); incoming.current.id = 'incoming-other-match';
    const raw = JSON.stringify(createBackup({ session: incoming, history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
    const restoring = target.storage.restoreBackup(raw, true);
    for (let tick = 0; tick < 30; tick++) await Promise.resolve();
    const importOvertookRead = !!commitImport;
    releaseRead();
    for (let tick = 0; tick < 30 && !releaseBackup; tick++) await Promise.resolve();
    expect(releaseBackup).toBeDefined();
    if (importOvertookRead) {
      commitImport(); await restoring;
      releaseBackup(); await reading;
    } else {
      releaseBackup(); await reading;
      for (let tick = 0; tick < 30 && !commitImport; tick++) await Promise.resolve();
      expect(commitImport).toBeDefined(); commitImport(); await restoring;
    }
    const records = JSON.parse(target.values.get(STORAGE_KEYS.recovery)!) as { source: string; raw: string }[];
    expect(records.some(record => record.source === STORAGE_KEYS.preferences && record.raw === 'broken preferences')).toBe(true);
    const importSnapshot = records.find(record => record.source === 'nightfall.backup.restore');
    expect(importSnapshot).toBeDefined();
    expect(JSON.parse(importSnapshot!.raw).current).toContain(original.current.id);
  });

  it('waits for a failed current read without inheriting its error when explicitly restoring that damaged record', async () => {
    const target = memoryStore();
    await Promise.all([target.storage.readHistory(), target.storage.readPreferences()]);
    const damaged = '{ damaged current record';
    target.values.set(STORAGE_KEYS.current, damaged);
    let releaseRead!: () => void; let firstCurrentRead = true;
    target.kv.getItem.mockImplementation(key => {
      if (key === STORAGE_KEYS.current && firstCurrentRead) {
        firstCurrentRead = false;
        return new Promise(resolve => { releaseRead = () => resolve(damaged); });
      }
      return Promise.resolve(target.values.get(key) ?? null);
    });
    const reading = target.storage.readSession().catch(error => error as Error);
    const replacement = fixture();
    const raw = JSON.stringify(createBackup({ session: replacement, history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
    const restoring = target.storage.restoreBackup(raw, true);
    expect(target.kv.multiSet).not.toHaveBeenCalled();
    releaseRead();
    expect(await reading).toBeInstanceOf(Error);
    await expect(restoring).resolves.toMatchObject({ sessionReplaced: true });
    expect((await target.storage.readSession())?.current.id).toBe(replacement.current.id);
    const records = JSON.parse(target.values.get(STORAGE_KEYS.recovery)!) as { source: string; raw: string }[];
    expect(JSON.parse(records.find(record => record.source === 'nightfall.backup.restore')!.raw).current).toBe(damaged);
  });
});
