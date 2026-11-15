import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import { normalizePreferences, type HostingProfile } from '../src/game/preferences';
import { decodeSession, isValidGame } from '../src/game/save-schema';
import { tableRules, validateTableRules } from '../src/game/table-rules';
import type { Game, Role, Rules } from '../src/game/types';

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'guard', 'hunter'];
const players = roles.map((role, index) => ({ name: `${index + 1}号`, role }));

function fixture(overrides: Partial<Rules> = {}): Game {
  return createGame('桌规测试', '八人测试', players, { ...DEFAULT_RULES, sheriff: false, ...overrides });
}

function profile(rules: Rules = DEFAULT_RULES): HostingProfile {
  return { id: 'table-rules', name: '固定面杀桌', boardName: '八人测试', roles, rules };
}

function completeNight(game: Game, knife: number | null = null, guardTarget: number | null = null): Game {
  let current = game;
  for (const call of game.nightCalls) {
    if (current.stage !== call) continue;
    if (call === 'guard') current = applyAction(current, { type: 'guard', target: guardTarget });
    else if (call === 'wolves') current = applyAction(current, { type: 'wolves', target: knife });
    else if (call === 'seer') current = applyAction(current, { type: 'seer', target: null });
    else if (call === 'witch') current = applyAction(current, { type: 'witch', save: false, poison: null });
    else current = applyAction(current, { type: 'call', callId: call, target: null });
  }
  return current;
}

describe('per-table rules', () => {
  it('resolves legacy defaults and validates only the supported fields', () => {
    const defaults = { lineupMode: 'standard', firstNightKnife: true, guardRepeat: false, sheriffTie: 'pk', exileTie: 'pk', exileRecord: 'detailed', exileSelfVote: false, notes: '' };
    expect(tableRules(undefined)).toEqual(defaults);
    expect(tableRules(DEFAULT_RULES)).toEqual(defaults);
    expect(validateTableRules(undefined)).toBe(true);
    expect(validateTableRules({ guardRepeat: true, sheriffTie: 'none', exileTie: 'pk', notes: '赛前约定' })).toBe(true);
    expect(validateTableRules({ lineupMode: 'free', firstNightKnife: false })).toBe(true);
    expect(validateTableRules({ exileRecord: 'quick' })).toBe(true);
    expect(validateTableRules({ exileSelfVote: true })).toBe(true);
    expect(validateTableRules({ lineupMode: 'mixed' })).toBe(false);
    expect(validateTableRules({ firstNightKnife: 'no' })).toBe(false);
    expect(validateTableRules({ sheriffTie: 'draw' })).toBe(false);
    expect(validateTableRules({ exileRecord: 'skip' })).toBe(false);
    expect(validateTableRules({ exileSelfVote: 'yes' })).toBe(false);
    expect(validateTableRules({ notes: 'x'.repeat(1201) })).toBe(false);
  });

  it('switches consecutive guard protection without changing the legacy default', () => {
    let firstNight = completeNight(fixture(), 3, 3);
    firstNight = applyAction(firstNight, { type: 'dawn' });
    const nextNight = applyAction(firstNight, { type: 'next-night' });
    expect(() => applyAction(nextNight, { type: 'guard', target: 3 })).toThrow('不能连续两夜守同一人');
    let repeat = completeNight(fixture({ table: { guardRepeat: true } }), 3, 3);
    repeat = applyAction(repeat, { type: 'dawn' });
    repeat = applyAction(repeat, { type: 'next-night' });
    expect(() => applyAction(repeat, { type: 'guard', target: 3 })).not.toThrow();
  });

  it('uses per-table tie policy for sheriff and exile votes', () => {
    const sheriff = fixture({ sheriff: true, table: { sheriffTie: 'none' } });
    sheriff.stage = 'sheriff-vote';
    sheriff.vote = { kind: 'sheriff', round: 1, candidates: [1, 2], voters: [3, 4], ballots: { 3: 1, 4: 2 } };
    const afterSheriff = applyAction(sheriff, { type: 'count' });
    expect(afterSheriff.sheriff).toBeNull();
    expect(afterSheriff.sheriffDone).toBe(true);
    expect(afterSheriff.stage).toBe('discussion');

    const exile = fixture({ table: { exileTie: 'none' } });
    exile.stage = 'exile-vote';
    exile.vote = { kind: 'exile', round: 1, candidates: [1, 2], voters: [3, 4], ballots: { 3: 1, 4: 2 } };
    const afterExile = applyAction(exile, { type: 'count' });
    expect(afterExile.players.every(player => player.alive)).toBe(true);
    expect(afterExile.stage).toBe(afterExile.nightCalls[0]);
  });

  it('keeps sheriff and exile tie policies independent, and ends a PK round without another PK', () => {
    const sheriff = fixture({ sheriff: true, table: { sheriffTie: 'pk', exileTie: 'none' } });
    sheriff.stage = 'sheriff-vote';
    sheriff.vote = { kind: 'sheriff', round: 1, candidates: [1, 2], voters: [3, 4], ballots: { 3: 1, 4: 2 } };
    let sheriffPk = applyAction(sheriff, { type: 'count' });
    expect(sheriffPk.stage).toBe('sheriff-vote');
    expect(sheriffPk.vote?.round).toBe(2);
    sheriffPk.vote!.ballots = Object.fromEntries(sheriffPk.vote!.voters.map(voter => [voter, 1]));
    const sheriffDone = applyAction(sheriffPk, { type: 'count' });
    expect(sheriffDone.sheriff).toBe(1);
    expect(sheriffDone.stage).toBe('discussion');

    const exile = fixture({ table: { sheriffTie: 'none', exileTie: 'pk' } });
    exile.stage = 'exile-vote';
    exile.vote = { kind: 'exile', round: 1, candidates: [1, 2], voters: [3, 4], ballots: { 3: 1, 4: 2 } };
    let exilePk = applyAction(exile, { type: 'count' });
    expect(exilePk.stage).toBe('exile-vote');
    expect(exilePk.vote?.round).toBe(2);
    exilePk.vote!.ballots = Object.fromEntries(exilePk.vote!.voters.map((voter, index) => [voter, index % 2 ? 2 : 1]));
    const exileDone = applyAction(exilePk, { type: 'count' });
    expect(exileDone.players.every(player => player.alive)).toBe(true);
    expect(exileDone.stage).toBe(exileDone.nightCalls[0]);
  });

  it('keeps a dead actor as an explicit empty wake-up without spending medicine or publishing private data', () => {
    let game = fixture({ flow: { nightOrder: ['wolves', 'seer', 'witch', 'guard'], keepDeadCalls: true } });
    game = completeNight(game, 5);
    game = applyAction(game, { type: 'dawn' });
    expect(game.players.find(player => player.seat === 5)?.alive).toBe(false);
    game = applyAction(game, { type: 'next-night' });
    game = applyAction(game, { type: 'wolves', target: null });
    expect(game.stage).toBe('seer');
    const savedMedicine = { ...game.medicine };
    const skipped = applyAction(game, { type: 'skip-night', reason: '按赛前桌规空唤醒' });
    expect(skipped.medicine).toEqual(savedMedicine);
    expect(skipped.events.at(-1)?.publicText).toBeUndefined();
    expect(skipped.stage).toBe('witch');
  });

  it('rejects malformed table rules when starting a game', () => {
    expect(() => fixture({ table: { notes: 'x'.repeat(1201) } })).toThrow('本桌规则无效');
  });

  it('rejects malformed table and keep-dead settings in saved profiles and sessions', () => {
    const invalidTable = normalizePreferences({ hostingMode: 'custom', profiles: [profile({ ...DEFAULT_RULES, table: { exileTie: 'draw' as never } })], selectedProfileId: 'table-rules' });
    expect(invalidTable.profiles).toEqual([]);
    const invalidFlow = normalizePreferences({ hostingMode: 'custom', profiles: [profile({ ...DEFAULT_RULES, flow: { keepDeadCalls: 'yes' as never } })], selectedProfileId: 'table-rules' });
    expect(invalidFlow.profiles).toEqual([]);

    const malformedTable = { ...fixture(), rules: { ...fixture().rules, table: { sheriffTie: 'draw' } } };
    expect(isValidGame(malformedTable)).toBe(false);
    expect(() => decodeSession(JSON.stringify({ current: malformedTable, undo: [], redo: [] }))).toThrow();
    const malformedFlow = { ...fixture(), rules: { ...fixture().rules, flow: { keepDeadCalls: 'yes' } } };
    expect(isValidGame(malformedFlow)).toBe(false);
    expect(() => decodeSession(JSON.stringify({ current: malformedFlow, undo: [], redo: [] }))).toThrow();
  });

  it('keeps legacy saves valid and deep-clones nested table and flow preferences', () => {
    const legacy = fixture();
    expect(legacy.rules.table).toBeUndefined();
    expect(isValidGame(legacy)).toBe(true);
    expect(decodeSession(JSON.stringify({ current: legacy, undo: [], redo: [] })).session.current.rules.table).toBeUndefined();

    const table = { guardRepeat: true, notes: '固定桌约定' };
    const flow = { nightOrder: [...legacy.nightCalls], keepDeadCalls: true, scripts: { discussion: '请发言' } };
    const restored = normalizePreferences({ hostingMode: 'custom', profiles: [profile({ ...DEFAULT_RULES, table, flow })] }).profiles[0];
    table.notes = '外部对象已修改';
    flow.keepDeadCalls = false;
    flow.scripts.discussion = '外部脚本已修改';
    expect(restored.rules.table).toEqual({ guardRepeat: true, notes: '固定桌约定' });
    expect(restored.rules.flow).toMatchObject({ keepDeadCalls: true, scripts: { discussion: '请发言' } });
  });

  it('does not repeat a first-night-only role when dead-call retention is enabled', () => {
    const firstNightRoles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'guard', 'miracle-merchant'];
    const game = createGame('首夜角色测试', '八人测试', firstNightRoles.map((role, index) => ({ name: `${index + 1}号`, role })), { ...DEFAULT_RULES, sheriff: false, flow: { keepDeadCalls: true } });
    let current = completeNight(game, null);
    current = applyAction(current, { type: 'dawn' });
    current = applyAction(current, { type: 'next-night' });
    for (let attempts = 0; attempts < 8 && current.stage !== 'dawn' && current.stage !== 'miracle-merchant'; attempts++) {
      if (current.stage === 'guard') current = applyAction(current, { type: 'guard', target: null });
      else if (current.stage === 'wolves') current = applyAction(current, { type: 'wolves', target: null });
      else if (current.stage === 'seer') current = applyAction(current, { type: 'seer', target: null });
      else if (current.stage === 'witch') current = applyAction(current, { type: 'witch', save: false, poison: null });
      else current = applyAction(current, { type: 'call', callId: current.stage, target: null });
    }
    expect(current.stage).not.toBe('miracle-merchant');
  });
});
