import {
  addEvent,
  addSkillUse,
  addVote,
  createPlayerNotebook,
  isValidPlayerNotebook,
  migratePlayerNotebook,
  notebookMarkCounts,
  removeEvent,
  removeSkillUse,
  removeVote,
  setSeatMark,
  setSeatEliminated,
  setSeatNote,
  setSeatRoleGuess,
  setSummary,
  updatePlayerBasics,
} from '../src/player/notes';
import { createPlayerNotebookStorage, PLAYER_NOTEBOOK_KEY } from '../src/player/storage';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { data.set(key, value); },
    async removeItem(key: string) { data.delete(key); },
    data,
  };
}

function versionOne(notebook: ReturnType<typeof createPlayerNotebook>) {
  const { events: _events, skillUses: _skillUses, boardId: _boardId, boardName: _boardName, ...rest } = notebook;
  return {
    ...rest,
    version: 1 as const,
    seatNotes: Object.fromEntries(Object.entries(notebook.seatNotes).map(([seat, note]) => [seat, { mark: note.mark, note: note.note }])),
  };
}

function seatNotesWithoutEliminated(notebook: ReturnType<typeof createPlayerNotebook>) {
  return Object.fromEntries(Object.entries(notebook.seatNotes).map(([seat, note]) => [seat, {
    mark: note.mark,
    roleGuess: note.roleGuess,
    note: note.note,
  }]));
}

describe('玩家笔记模型', () => {
  it('按人数初始化所有座位，并校验自己的座位和身份', () => {
    const notebook = createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '周五局', playerCount: 12, ownSeat: 3, ownRole: 'seer' });
    expect(notebook.version).toBe(4);
    expect(notebook.boardId).toBe('standard-12');
    expect(notebook.boardName).toBe('预女猎白');
    expect(notebook.playerCount).toBe(12);
    expect(notebook.ownSeat).toBe(3);
    expect(Object.keys(notebook.seatNotes)).toHaveLength(12);
    expect(notebook.seatNotes[3]).toEqual({ mark: 'unknown', roleGuess: null, note: '', eliminated: false });
    expect(notebook.events).toEqual([]);
    expect(notebook.skillUses).toEqual([]);
    expect(() => createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '', playerCount: 12, ownSeat: 1, ownRole: 'nine-tails' })).toThrow('本局板子');
    expect(() => createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '', playerCount: 5, ownSeat: 1, ownRole: 'seer' })).toThrow('人数');
    expect(() => createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '', playerCount: 12, ownSeat: 13, ownRole: 'seer' })).toThrow('座位');
    expect(() => createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '', playerCount: 12, ownSeat: 1, ownRole: 'not-a-role' as never })).toThrow('身份');
  });

  it('标记、具体身份和备注保持不可变，并按状态计数', () => {
    const base = createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '', playerCount: 12, ownSeat: 1, ownRole: 'villager' });
    const marked = setSeatMark(base, 1, 'wolf');
    expect(base.seatNotes[1].mark).toBe('unknown');
    expect(marked.seatNotes[1].mark).toBe('wolf');
    expect(marked).not.toBe(base);

    const guessedWolf = setSeatRoleGuess(base, 1, 'wolf');
    expect(guessedWolf.seatNotes[1]).toMatchObject({ mark: 'wolf', roleGuess: 'wolf' });
    const guessedSeer = setSeatRoleGuess(base, 1, 'seer');
    expect(guessedSeer.seatNotes[1]).toMatchObject({ mark: 'god', roleGuess: 'seer' });
    expect(setSeatMark(guessedSeer, 1, 'wolf').seatNotes[1]).toMatchObject({ mark: 'wolf', roleGuess: null });
    expect(setSeatMark(guessedSeer, 1, 'god').seatNotes[1].roleGuess).toBe('seer');
    expect(setSeatRoleGuess(base, 1, 'villager').seatNotes[1]).toMatchObject({ mark: 'villager', roleGuess: 'villager' });
    expect(setSeatRoleGuess({ ...base, boardId: 'lone-girl', boardName: '孤独少女' }, 1, 'lone-girl').seatNotes[1]).toMatchObject({ mark: 'unknown', roleGuess: 'lone-girl' });
    expect(setSeatRoleGuess(guessedWolf, 1, null).seatNotes[1]).toMatchObject({ mark: 'wolf', roleGuess: null });

    const noted = setSeatNote(marked, 1, '发言在保 4 号');
    expect(noted.seatNotes[1].note).toBe('发言在保 4 号');
    expect(notebookMarkCounts(noted).wolf).toBe(1);
    expect(notebookMarkCounts(noted).unknown).toBe(11);

    const eliminated = setSeatEliminated(guessedSeer, 1, true);
    expect(eliminated.seatNotes[1]).toMatchObject({ mark: 'god', roleGuess: 'seer', eliminated: true });
    expect(setSeatEliminated(eliminated, 1, false).seatNotes[1].eliminated).toBe(false);
  });

  it('修改基本信息时保留座位记录、事件和票型', () => {
    const base = createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '旧名字', playerCount: 12, ownSeat: 2, ownRole: 'witch' });
    const marked = setSeatMark(base, 4, 'wolf');
    const withEvent = addEvent(marked, { round: 1, phase: 'day', text: '4 号被票出局' });
    const updated = updatePlayerBasics(withEvent, { gameName: '  新名字  ', ownSeat: 7, ownRole: 'seer' });
    expect(updated.gameName).toBe('新名字');
    expect(updated.ownSeat).toBe(7);
    expect(updated.ownRole).toBe('seer');
    expect(updated.seatNotes[4].mark).toBe('wolf');
    expect(updated.events).toEqual(withEvent.events);
    expect(updated).not.toBe(withEvent);
    expect(() => updatePlayerBasics(base, { gameName: '', ownSeat: 13, ownRole: 'seer' })).toThrow('座位');
    expect(() => updatePlayerBasics(base, { gameName: '', ownSeat: 1, ownRole: 'not-a-role' as never })).toThrow('身份');
  });

  it('记录、删除票型并校验座位', () => {
    const base = createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '', playerCount: 12, ownSeat: 1, ownRole: 'seer' });
    const voted = addVote(base, { round: 1, voter: 3, target: 7 });
    expect(voted.votes).toHaveLength(1);
    expect(voted.votes[0]).toMatchObject({ round: 1, voter: 3, target: 7 });
    expect(() => addVote(base, { round: 1, voter: 0, target: 7 })).toThrow('投票人');
    expect(() => addVote(base, { round: 1, voter: 1, target: 13 })).toThrow('得票人');
    expect(removeVote(voted, voted.votes[0].id).votes).toHaveLength(0);
    expect(setSummary(base, 'x'.repeat(2100)).summary).toHaveLength(2000);
  });

  it('记录、删除事件速记并校验轮次和内容', () => {
    const base = createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '', playerCount: 12, ownSeat: 1, ownRole: 'seer' });
    const noted = addEvent(base, { round: 1, phase: 'night', text: '  3 号倒牌  ' });
    expect(noted.events).toHaveLength(1);
    expect(noted.events[0]).toMatchObject({ round: 1, phase: 'night', text: '3 号倒牌' });
    expect(() => addEvent(base, { round: 0, phase: 'day', text: 'x' })).toThrow('轮次');
    expect(() => addEvent(base, { round: 1, phase: 'dawn' as never, text: 'x' })).toThrow('类型');
    expect(() => addEvent(base, { round: 1, phase: 'day', text: '   ' })).toThrow('不能为空');
    expect(removeEvent(noted, noted.events[0].id).events).toHaveLength(0);
  });

  it('记录、删除自己的技能使用并校验目标', () => {
    const base = createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '', playerCount: 12, ownSeat: 1, ownRole: 'witch' });
    const used = addSkillUse(base, { round: 1, skill: ' 解药 ', target: 4, result: ' 救回 4 号 ' });
    expect(used.skillUses).toHaveLength(1);
    expect(used.skillUses[0]).toMatchObject({ round: 1, skill: '解药', target: 4, result: '救回 4 号' });
    expect(() => addSkillUse(base, { round: 1, skill: '   ', target: null, result: '' })).toThrow('技能名称');
    expect(() => addSkillUse(base, { round: 1, skill: '解药', target: 13, result: '' })).toThrow('目标');
    expect(removeSkillUse(used, used.skillUses[0].id).skillUses).toHaveLength(0);
  });

  it('拒绝结构损坏的存档，但接受旧版并迁移', () => {
    const notebook = createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '测试', playerCount: 12, ownSeat: 2, ownRole: 'hunter' });
    expect(isValidPlayerNotebook(notebook)).toBe(true);
    expect(isValidPlayerNotebook({ ...notebook, playerCount: 11 })).toBe(false);
    expect(isValidPlayerNotebook({ ...notebook, ownSeat: 13 })).toBe(false);
    expect(isValidPlayerNotebook({ ...notebook, seatNotes: { ...notebook.seatNotes, 1: { mark: 'wolf', roleGuess: null, note: '', eliminated: false } } })).toBe(true);
    expect(isValidPlayerNotebook({ ...notebook, seatNotes: { ...notebook.seatNotes, 1: { mark: 'wolf', roleGuess: 'not-a-role', note: '' } } })).toBe(false);
    expect(isValidPlayerNotebook({ ...notebook, events: [{ id: 'x', round: 1, phase: 'dawn', text: 'x' }] })).toBe(false);

    const old = versionOne(notebook);
    expect(isValidPlayerNotebook(old)).toBe(false);
    const migrated = migratePlayerNotebook(old);
    expect(migrated?.version).toBe(4);
    expect(migrated?.boardId).toBe('legacy-custom-12');
    expect(migrated?.boardName).toBe('旧版自定义（12 人）');
    expect(migrated?.seatNotes[2].roleGuess).toBeNull();
    expect(migrated?.seatNotes[2].eliminated).toBe(false);
    expect(migrated?.events).toEqual([]);
    expect(migrated?.skillUses).toEqual([]);

    const { boardId: _boardId, boardName: _boardName, ...withoutBoard } = notebook;
    const versionTwo = migratePlayerNotebook({ ...withoutBoard, version: 2, seatNotes: seatNotesWithoutEliminated(notebook) });
    expect(versionTwo?.version).toBe(4);
    expect(versionTwo?.boardId).toBe('legacy-custom-12');
    expect(versionTwo?.seatNotes[2].eliminated).toBe(false);

    const versionThree = migratePlayerNotebook({ ...notebook, version: 3, seatNotes: seatNotesWithoutEliminated(notebook) });
    expect(versionThree?.version).toBe(4);
    expect(versionThree?.seatNotes[2].eliminated).toBe(false);

    const fifteen = createPlayerNotebook({ boardId: '15-standard', boardName: '十五人局', gameName: '旧自定义', playerCount: 15, ownSeat: 1, ownRole: 'villager' });
    const { boardId: _customBoardId, boardName: _customBoardName, ...customWithoutBoard } = fifteen;
    const customVersionTwo = migratePlayerNotebook({
      ...customWithoutBoard,
      version: 2,
      playerCount: 16,
      ownSeat: 16,
      seatNotes: { ...seatNotesWithoutEliminated(fifteen), 16: { mark: 'unknown', roleGuess: null, note: '' } },
    });
    expect(customVersionTwo?.boardId).toBe('legacy-custom-16');
    expect(customVersionTwo?.boardName).toBe('旧版自定义（16 人）');
  });

  it('保存的板子与身份冲突时回到旧版自定义，不误套另一套板子', () => {
    const notebook = createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '冲突存档', playerCount: 12, ownSeat: 2, ownRole: 'hunter' });
    const inconsistent = {
      ...notebook,
      seatNotes: {
        ...notebook.seatNotes,
        4: { ...notebook.seatNotes[4], mark: 'god' as const, roleGuess: 'guard' as const },
      },
    };

    expect(isValidPlayerNotebook(inconsistent)).toBe(false);
    expect(migratePlayerNotebook(inconsistent)).toMatchObject({
      boardId: 'legacy-custom-12',
      boardName: '旧版自定义（12 人）',
      seatNotes: { 4: { roleGuess: 'guard' } },
    });
  });

  it('保留当前版本还不认识的板子 ID，不用旧自定义覆盖未来存档', () => {
    const notebook = createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '未来板子', playerCount: 12, ownSeat: 1, ownRole: 'seer' });
    const future = migratePlayerNotebook({
      ...notebook,
      boardId: 'future-board-v9',
      boardName: '未来板子 v9',
    });

    expect(future).toMatchObject({
      boardId: 'future-board-v9',
      boardName: '未来板子 v9',
      ownRole: 'seer',
    });
  });

  it('已知板子以注册名称为准，避免显示名和身份范围不一致', () => {
    const notebook = createPlayerNotebook({ boardId: 'standard-12', boardName: '预女猎白', gameName: '名称核对', playerCount: 12, ownSeat: 1, ownRole: 'seer' });
    const migrated = migratePlayerNotebook({ ...notebook, boardName: '被改过的名称' });

    expect(migrated?.boardId).toBe('standard-12');
    expect(migrated?.boardName).toBe('预女猎白');
  });
});

describe('玩家笔记存储', () => {
  it('保存、读取、清除，并隔离损坏记录', async () => {
    const kv = memoryStore();
    const storage = createPlayerNotebookStorage(kv);
    expect(await storage.read()).toBeNull();

    const notebook = createPlayerNotebook({ boardId: '10-standard', boardName: '十人局', gameName: '周末局', playerCount: 10, ownSeat: 4, ownRole: 'witch' });
    await storage.persist(notebook);
    expect(await storage.read()).toEqual(notebook);
    expect(kv.data.get(PLAYER_NOTEBOOK_KEY)).toContain('周末局');

    await storage.clear();
    expect(await storage.read()).toBeNull();

    kv.data.set(PLAYER_NOTEBOOK_KEY, '{"version":1,"broken":true}');
    await expect(storage.read()).rejects.toThrow('结构不兼容');
  });

  it('读取旧版笔记时迁移，但不覆盖原始记录', async () => {
    const kv = memoryStore();
    const storage = createPlayerNotebookStorage(kv);
    const notebook = createPlayerNotebook({ boardId: '9-classic', boardName: '九人标准', gameName: '旧版局', playerCount: 9, ownSeat: 3, ownRole: 'seer' });
    const raw = JSON.stringify(versionOne(notebook));
    kv.data.set(PLAYER_NOTEBOOK_KEY, raw);

    const migrated = await storage.read();
    expect(migrated?.version).toBe(4);
    expect(migrated?.boardId).toBe('9-classic');
    expect(migrated?.ownRole).toBe('seer');
    expect(migrated?.events).toEqual([]);
    expect(kv.data.get(PLAYER_NOTEBOOK_KEY)).toBe(raw);
  });
});
