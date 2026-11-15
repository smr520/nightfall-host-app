import { createGameStorage, STORAGE_KEYS } from '../src/storage-store';
import { applyAction, createGame } from '../src/game/engine';
import { boardSeats, BOARD_LIBRARY } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { decodeSession, isValidGame } from '../src/game/save-schema';
import { redoSession, undoSession } from '../src/game/session';
import type { Session } from '../src/game/types';

function fixture(): Session {
  const board = BOARD_LIBRARY[0];
  return { current: createGame('提交时名称', board.name, boardSeats(board).map(role => ({ name: '', role })), DEFAULT_RULES), undo: [], redo: [] };
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

describe('persistence QA edge cases', () => {
  it('writes the session submitted to the queue even if the caller later mutates its objects', async () => {
    const { values, storage } = memoryStore();
    await ready(storage);
    const session = fixture();
    const submitted = JSON.parse(JSON.stringify(session)) as Session;
    const saved = storage.persistSession(session);
    session.current.name = '调用后修改';
    session.current.players[0].name = '调用后改玩家';
    session.undo.push({ ...session.current });
    await saved;
    expect(JSON.parse(values.get(STORAGE_KEYS.current)!)).toEqual(submitted);
  });

  it('archives a fixed finished snapshot instead of a later mutation of the caller game', async () => {
    const { storage } = memoryStore();
    await ready(storage);
    const ended = applyAction(fixture().current, { type: 'finish', winner: 'draw', reason: '归档快照测试' });
    const submitted = JSON.parse(JSON.stringify(ended));
    const archived = storage.persistHistoryGame(ended);
    ended.name = '调用后改归档名';
    ended.players[0].name = '调用后改身份名';
    await archived;
    expect((await storage.readHistory())[0]).toEqual(submitted);
  });

  it('retries the submitted snapshot while storage recovery reads are still pending', async () => {
    const { values, storage } = memoryStore();
    await ready(storage);
    const session = fixture();
    const submitted = JSON.parse(JSON.stringify(session)) as Session;
    const retried = storage.retryPersistSession(session);
    session.current.name = '重试读取期间修改';
    session.current.players[0].name = '重试读取期间改玩家';
    await retried;
    expect(JSON.parse(values.get(STORAGE_KEYS.current)!)).toEqual(submitted);
  });

  it.each(['03', '3.0', '+3', ' 3', '3e0'])('rejects noncanonical ballot key %j without overwriting a corrupt current session', async voterKey => {
    const { values, storage } = memoryStore();
    const session = fixture();
    session.current.stage = 'exile-vote';
    session.current.vote = { kind: 'exile', round: 1, candidates: [4, 5], voters: [3], ballots: { 3: 4, [voterKey]: 5 } };
    const raw = JSON.stringify(session);
    expect(isValidGame(session.current)).toBe(false);
    values.set(STORAGE_KEYS.current, raw);
    await expect(storage.readSession()).rejects.toThrow();
    expect(values.get(STORAGE_KEYS.current)).toBe(raw);
    await storage.readHistory();
    await expect(storage.persistSession(fixture())).rejects.toThrow();
    expect(values.get(STORAGE_KEYS.current)).toBe(raw);
  });

  it('still recovers valid legacy sessions and preserves exact source bytes when isolating a bad undo snapshot', async () => {
    const { values, storage } = memoryStore();
    const session = fixture();
    const corrupted = JSON.parse(JSON.stringify(session.current));
    corrupted.stage = 'exile-vote';
    corrupted.vote = { kind: 'exile', round: 1, candidates: [4], voters: [3], ballots: { '03': 4 } };
    const raw = JSON.stringify({ ...session, undo: [corrupted] });
    values.set(STORAGE_KEYS.current, raw);
    const restored = await storage.readSession();
    expect(restored?.current).toEqual(session.current);
    expect(restored?.undo).toEqual([]);
    expect(JSON.parse(values.get(STORAGE_KEYS.recovery)!)[0].raw).toBe(raw);
    expect(values.get(STORAGE_KEYS.current)).toBe(raw);

    const legacy = JSON.parse(JSON.stringify(session));
    legacy.current.schema = 1;
    delete legacy.current.nightCalls;
    delete legacy.current.night.targets;
    expect(decodeSession(JSON.stringify(legacy)).session.current.schema).toBe(2);
  });

  it('round-trips a finished game through undo, redo and storage without ghost archives', async () => {
    const { storage } = memoryStore();
    await ready(storage);
    const active = fixture();
    const ended = { current: applyAction(active.current, { type: 'finish', winner: 'good', reason: '结束后撤回重做' }), undo: [active.current], redo: [] };
    await storage.persistSession(ended);
    expect((await storage.readHistory()).map(game => game.id)).toEqual([ended.current.id]);
    const undone = undoSession(ended)!;
    await storage.persistSession(undone);
    expect(await storage.readHistory()).toEqual([]);
    const redone = redoSession(undone)!;
    await storage.persistSession(redone);
    expect((await storage.readHistory()).map(game => game.id)).toEqual([ended.current.id]);
    expect((await storage.readSession())?.current.stage).toBe('ended');
  });
});
