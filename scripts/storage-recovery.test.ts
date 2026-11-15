import { createGameStorage, STORAGE_KEYS } from '../src/storage-store';
import { createGame, applyAction } from '../src/game/engine';
import { BOARDS, DEFAULT_RULES, ROLE_IDS } from '../src/game/config';
import type { Game, Session } from '../src/game/types';

function fixture(): Session {
  const board = BOARDS[0];
  const players = ROLE_IDS.flatMap(role => Array.from({ length: board.counts[role] }, () => ({ name: role, role })));
  return { current: createGame('Recovery fixture', board.name, players, DEFAULT_RULES), undo: [], redo: [] };
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
async function ready(storage: ReturnType<typeof createGameStorage>) {
  await Promise.all([storage.readSession(), storage.readHistory()]);
}

describe('storage data-loss regression', () => {
  it('isolates a bad history entry, preserves the raw backup, and keeps a valid session readable', async () => {
    const { values, storage } = memoryStore();
    const session = fixture();
    const good = applyAction(session.current, { type: 'finish', winner: 'draw', reason: '测试结束' });
    const broken = { ...good, id: 'broken', stage: 'foo' };
    const raw = JSON.stringify([good, broken]);
    values.set(STORAGE_KEYS.current, JSON.stringify(session));
    values.set(STORAGE_KEYS.history, raw);
    const [saved, history] = await Promise.all([storage.readSession(), storage.readHistory()]);
    expect(saved?.current.id).toBe(session.current.id);
    expect(history.map(game => game.id)).toEqual([good.id]);
    expect((await storage.exportRawData())).toContain(raw.replace(/"/g, '\\"'));
    await storage.persistSession(session);
    await storage.persistHistoryGame({ ...good, id: 'new-finished' });
    expect((await storage.readHistory()).some(game => game.id === 'new-finished')).toBe(true);
  });

  it('blocks saving a new game after an unreadable session and preserves the old bytes', async () => {
    const { values, storage } = memoryStore();
    const raw = '{"current":{"stage":"broken"}}';
    values.set(STORAGE_KEYS.current, raw);
    await expect(storage.readSession()).rejects.toThrow();
    await storage.readHistory();
    await expect(storage.persistSession(fixture())).rejects.toThrow();
    expect(values.get(STORAGE_KEYS.current)).toBe(raw);
  });

  it('does not overwrite a valid session when a history I/O read fails', async () => {
    const { kv, values, storage } = memoryStore();
    const original = JSON.stringify(fixture());
    values.set(STORAGE_KEYS.current, original);
    kv.getItem.mockImplementation(async key => { if (key === STORAGE_KEYS.history) throw new Error('disk read failed'); return values.get(key) ?? null; });
    const results = await Promise.allSettled([storage.readSession(), storage.readHistory()]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    await expect(storage.persistSession(fixture())).rejects.toThrow();
    expect(values.get(STORAGE_KEYS.current)).toBe(original);
  });

  it('archives a just-ended game even if clear supersedes its pending session write', async () => {
    const { storage } = memoryStore();
    await ready(storage);
    const session = fixture();
    const ended = applyAction(session.current, { type: 'finish', winner: 'good', reason: '测试结束' });
    const pending = storage.persistSession({ ...session, current: ended });
    const archive = storage.persistHistoryGame(ended);
    const clear = storage.clearSession();
    await Promise.all([pending, archive, clear]);
    expect(await storage.readSession()).toBeNull();
    expect((await storage.readHistory()).map(game => game.id)).toContain(ended.id);
  });

  it('orders archive -> undo removal -> redo archive without ghost history', async () => {
    const { storage } = memoryStore();
    await ready(storage);
    const session = fixture();
    const ended = applyAction(session.current, { type: 'finish', winner: 'draw', reason: '测试结束' });
    const add = storage.persistHistoryGame(ended);
    const remove = storage.removeArchivedGame(ended.id);
    await Promise.all([add, remove]);
    expect(await storage.readHistory()).toEqual([]);
    await storage.persistHistoryGame(ended);
    expect((await storage.readHistory())[0].winner).toBe('draw');
  });

  it('does not retain an archive when undo immediately follows ending a previously saved active game', async () => {
    const { storage } = memoryStore();
    await ready(storage);
    const session = fixture();
    await storage.persistSession(session);
    const ended = applyAction(session.current, { type: 'finish', winner: 'draw', reason: '测试结束' });
    const finish = storage.persistSession({ ...session, current: ended });
    const undo = storage.persistSession(session);
    await Promise.all([finish, undo]);
    expect(await storage.readHistory()).toEqual([]);
    expect((await storage.readSession())?.current.stage).toBe(session.current.stage);
  });

  it('refuses destructive repair if raw backup fails', async () => {
    const { kv, values, storage } = memoryStore();
    const raw = 'not json';
    values.set(STORAGE_KEYS.current, raw);
    kv.setItem.mockRejectedValue(new Error('disk full'));
    await expect(storage.clearDamagedSession()).rejects.toThrow();
    expect(values.get(STORAGE_KEYS.current)).toBe(raw);
  });

  it('backs up and migrates legacy pre-announcement deaths, including hunter skill timing', async () => {
    const { storage, values } = memoryStore();
    const session = fixture();
    session.current = { ...session.current, stage: 'dawn-announcement', sheriffDone: true, announcementReady: true,
      night: { ...session.current.night, knife: 11 },
      players: session.current.players.map(p => p.seat === 11 ? { ...p, alive: false, death: { day: 1, cause: 'knife' } } : p),
      pending: [{ kind: 'hunter', seat: 11 }],
    };
    const raw = JSON.stringify(session);
    values.set(STORAGE_KEYS.current, raw);
    const saved = await storage.readSession();
    expect(saved?.current.nightAnnouncement).toBe('昨夜 11 号 出局');
    expect(saved?.current.players.find(p => p.seat === 11)?.alive).toBe(true);
    expect(saved?.current.pending).toEqual([]);
    const published = applyAction(saved!.current, { type: 'announce-dawn' });
    expect(published.stage).toBe('hunter');
    expect(published.pending).toEqual([{ kind: 'hunter', seat: 11 }]);
    expect(values.get(STORAGE_KEYS.current)).toBe(raw);
    expect(await storage.exportRawData()).toContain('旧版迁移');
  });

  it('recovers the current game if only undo snapshots are damaged', async () => {
    const { storage, values } = memoryStore();
    const session = fixture();
    const raw = JSON.stringify({ ...session, undo: [{ ...session.current, stage: 'foo' }] });
    values.set(STORAGE_KEYS.current, raw);
    const saved = await storage.readSession();
    expect(saved?.current.id).toBe(session.current.id);
    expect(saved?.undo).toEqual([]);
    expect(await storage.exportRawData()).toContain('旧版迁移');
  });

  it('calculates an absent legacy announcement rather than claiming a peaceful night', () => {
    const session = fixture();
    const legacy: Game = { ...session.current, stage: 'dawn-announcement', sheriffDone: true, announcementReady: true, night: { ...session.current.night, knife: 5 } };
    const published = applyAction(legacy, { type: 'announce-dawn' });
    expect(published.players.find(p => p.seat === 5)?.alive).toBe(false);
    expect(published.events.at(-1)?.publicText).toBe('昨夜 5 号 出局');
  });

  it('retains archives for two different games even when a new session supersedes the old snapshot', async () => {
    const { storage } = memoryStore();
    await ready(storage);
    const first = fixture();
    const second = fixture();
    second.current.id = 'second-game';
    const a = applyAction(first.current, { type: 'finish', winner: 'draw', reason: '第一局结束' });
    const b = applyAction(second.current, { type: 'finish', winner: 'good', reason: '第二局结束' });
    await Promise.all([
      storage.persistSession({ ...first, current: a }),
      storage.persistSession({ ...second, current: b }),
      storage.clearSession(),
    ]);
    const history = await storage.readHistory();
    expect(history.map(game => game.id)).toEqual(expect.arrayContaining([a.id, b.id]));
  });

  it('lets safe clearing keep an exact backup even for valid current games', async () => {
    const { storage, values } = memoryStore();
    const session = fixture();
    const raw = JSON.stringify(session);
    values.set(STORAGE_KEYS.current, raw);
    await ready(storage);
    await storage.clearSession();
    expect(values.has(STORAGE_KEYS.current)).toBe(false);
    expect(JSON.parse(values.get(STORAGE_KEYS.recovery)!)[0].raw).toBe(raw);
  });

  it('repairs a missing completed archive before a new game can replace CURRENT', async () => {
    const { storage, values } = memoryStore();
    const old = fixture();
    old.current = applyAction(old.current, { type: 'finish', winner: 'draw', reason: '已完成但未归档' });
    values.set(STORAGE_KEYS.current, JSON.stringify(old));
    await ready(storage);
    const next = fixture();
    next.current.id = 'replacement-game';
    await storage.persistSession(next);
    expect((await storage.readHistory()).some(game => game.id === old.current.id)).toBe(true);
    expect((await storage.readSession())?.current.id).toBe(next.current.id);
  });

  it('retries a transient history failure while retaining the unsaved in-memory session', async () => {
    const { storage, kv, values } = memoryStore();
    await ready(storage);
    const session = fixture();
    await storage.persistSession(session);
    const ended = { ...session, current: applyAction(session.current, { type: 'finish', winner: 'draw', reason: '未保存结束' }) };
    kv.getItem.mockImplementation(async key => { if (key === STORAGE_KEYS.history) throw new Error('temporary read failure'); return values.get(key) ?? null; });
    await expect(storage.persistSession(ended)).rejects.toThrow();
    kv.getItem.mockImplementation(async key => values.get(key) ?? null);
    await storage.retryPersistSession(ended);
    expect((await storage.readSession())?.current.stage).toBe('ended');
    expect((await storage.readHistory())[0].id).toBe(ended.current.id);
  });

  it.each([
    (g: Game) => ({ ...g, stage: 'unknown' }),
    (g: Game) => ({ ...g, nightAnnouncement: { hidden: true } }),
    (g: Game) => ({ ...g, players: g.players.map((p, i) => i === 0 ? { ...p, role: 'fake' } : p) }),
    (g: Game) => ({ ...g, players: g.players.map(p => ({ ...p, seat: 1 })) }),
    (g: Game) => ({ ...g, stage: 'hunter', pending: [] }),
    (g: Game) => ({ ...g, rules: true }),
    (g: Game) => ({ ...g, stage: 'exile-vote', vote: null }),
  ])('rejects structurally unsafe game data without deleting it', async corrupt => {
    const { values, storage } = memoryStore();
    const session = fixture();
    const raw = JSON.stringify({ ...session, current: corrupt(session.current) });
    values.set(STORAGE_KEYS.current, raw);
    await expect(storage.readSession()).rejects.toThrow();
    expect(values.get(STORAGE_KEYS.current)).toBe(raw);
  });
});
