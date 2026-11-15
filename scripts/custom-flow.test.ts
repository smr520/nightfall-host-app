import { DEFAULT_RULES } from '../src/game/config';
import { emptyCounts } from '../src/game/boards';
import { applyAction, createGame, nightDeaths } from '../src/game/engine';
import { validateFlow } from '../src/game/flow';
import { decodeSession, isValidGame } from '../src/game/save-schema';
import type { Action, Game, HostingFlow, NightCall, Role, Rules } from '../src/game/types';
import { normalizePreferences, type HostingProfile } from '../src/ui/preferences';

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'hunter', 'guard'];
// A legal non-default order: the seer may act before the wolf kill, while
// the witch remains after wolves so that her save decision has a knife to inspect.
const reversedOrder: NightCall[] = ['seer', 'wolves', 'witch', 'guard'];

function fixture(overrides: Partial<Rules> = {}): Game {
  return createGame('自定义流程回归', '八人测试', roles.map(role => ({ name: role, role })), {
    ...DEFAULT_RULES, sheriff: false, win: 'all', flow: { nightOrder: [...reversedOrder] }, ...overrides,
  });
}

function finishNight(game: Game, knife: number | null = null): Game {
  let current = game;
  for (const call of game.nightCalls) {
    if (current.stage !== call) continue;
    if (call === 'guard') current = applyAction(current, { type: 'guard', target: null });
    else if (call === 'wolves') current = applyAction(current, { type: 'wolves', target: knife });
    else if (call === 'seer') current = applyAction(current, { type: 'seer', target: null });
    else if (call === 'witch') current = applyAction(current, { type: 'witch', save: false, poison: null });
    else current = applyAction(current, { type: 'call', callId: call, target: null });
  }
  expect(current.stage).toBe('dawn');
  return current;
}

const manualFixture = (overrides: Partial<Rules> = {}) => fixture({
  flow: { nightOrder: [...reversedOrder], manualDawn: true }, ...overrides,
});

function profile(flow: HostingFlow): HostingProfile {
  return { id: 'custom-flow', name: '自定义桌规', boardName: '八人测试', roles: [...roles], rules: { ...DEFAULT_RULES, flow } };
}

describe('custom night order', () => {
  it('executes the reversed order and restarts it the following night', () => {
    let game = fixture();
    expect(game.nightCalls).toEqual(reversedOrder);
    expect(game.stage).toBe('seer');
    game = applyAction(game, { type: 'seer', target: 1 });
    expect(game.stage).toBe('wolves');
    game = applyAction(game, { type: 'wolves', target: null });
    expect(game.stage).toBe('witch');
    game = applyAction(game, { type: 'witch', save: false, poison: null });
    expect(game.stage).toBe('guard');
    game = applyAction(game, { type: 'guard', target: 3 });
    expect(game.stage).toBe('dawn');
    game = applyAction(game, { type: 'dawn' });
    expect(game.stage).toBe('discussion');
    game = applyAction(game, { type: 'next-night' });
    expect(game.day).toBe(2);
    expect(game.stage).toBe('seer');
    expect(game.nightCalls).toEqual(reversedOrder);
    expect(game.lastGuard).toBe(3);
    expect(game.night).toMatchObject({ knife: null, guard: null, inspect: null, save: false, poison: null });
    expect(isValidGame(game)).toBe(true);
  });

  it('skips a dead actor without losing later calls in the custom sequence', () => {
    let game = applyAction(finishNight(fixture({ flow: { nightOrder: [...reversedOrder], keepDeadCalls: false } }), 5), { type: 'dawn' });
    expect(game.players[4].alive).toBe(false);
    game = applyAction(game, { type: 'next-night' });
    // The host explicitly disabled retained dead-role calls.
    expect(game.stage).toBe('wolves');
    game = applyAction(game, { type: 'wolves', target: null });
    expect(game.stage).toBe('witch');
  });

  it('retains a dead actor as the default empty wake-up without losing later calls', () => {
    let game = applyAction(finishNight(fixture(), 5), { type: 'dawn' });
    expect(game.players[4].alive).toBe(false);
    game = applyAction(game, { type: 'next-night' });
    expect(game.stage).toBe('seer');
    game = applyAction(game, { type: 'skip-night', reason: '行动角色已出局' });
    expect(game.stage).toBe('wolves');
    game = applyAction(game, { type: 'wolves', target: null });
    expect(game.stage).toBe('witch');
  });

  it('rejects a custom order that puts witch before wolves', () => {
    expect(() => fixture({ flow: { nightOrder: ['witch', 'seer', 'wolves', 'guard'] } })).toThrow();
    const counts = emptyCounts();
    roles.forEach(role => { counts[role] += 1; });
    expect(validateFlow({ nightOrder: ['witch', 'seer', 'wolves', 'guard'] }, counts)).toBe(false);
  });

  it('round-trips custom order, scripts and manual-dawn configuration in a session', () => {
    const game = manualFixture({ flow: { nightOrder: [...reversedOrder], manualDawn: true, scripts: { wolves: '请记录今晚刀口。' } } });
    const restored = decodeSession(JSON.stringify({ current: game, undo: [], redo: [] })).session.current;
    expect(restored.rules.flow).toEqual(game.rules.flow);
    expect(restored.nightCalls).toEqual(reversedOrder);
    expect(restored.stage).toBe('seer');
  });

  it.each([
    ['missing call', ['witch', 'seer', 'wolves']],
    ['duplicate call', ['witch', 'seer', 'wolves', 'wolves']],
    ['unknown call', ['witch', 'seer', 'wolves', 'not-a-role']],
    ['order violates witch knife dependency', ['witch', 'seer', 'wolves', 'guard']],
    ['non-array sequence', null],
  ])('rejects stored nightCalls with %s', (_label, nightCalls) => {
    const malformed = { ...fixture(), nightCalls };
    expect(isValidGame(malformed)).toBe(false);
    expect(() => decodeSession(JSON.stringify({ current: malformed, undo: [], redo: [] }))).toThrow();
  });

  it.each([
    { nightOrder: ['not-a-role'] },
    { nightOrder: ['wolves', 'wolves'] },
    { nightOrder: ['wolves', 3] },
  ])('rejects invalid action identifiers and duplicates before lineup validation: %j', flow => {
    expect(validateFlow(flow)).toBe(false);
  });
});

describe('manual dawn confirmation', () => {
  it('requires an explicit list and reason, including an intentional peaceful night', () => {
    const game = finishNight(manualFixture(), 3);
    expect(nightDeaths(game)).toEqual([{ seat: 3, cause: 'knife' }]);
    expect(() => applyAction(game, { type: 'dawn' })).toThrow('请先确认昨夜出局名单');
    for (const reason of ['', ' ', '一']) {
      expect(() => applyAction(game, { type: 'set-dawn-deaths', deaths: [], reason })).toThrow('至少两个字');
    }
    const reviewed = applyAction(game, { type: 'set-dawn-deaths', deaths: [], reason: '  已核对特殊技能  ' });
    expect(reviewed.stage).toBe('dawn');
    expect(reviewed.night.manualDeaths).toEqual([]);
    expect(reviewed.night.manualReason).toBe('已核对特殊技能');
    expect(reviewed.pending).toEqual([]);
    expect(game.night.manualDeaths).toBeUndefined();
    const published = applyAction(reviewed, { type: 'dawn' });
    expect(published.stage).toBe('discussion');
    expect(published.players.every(player => player.alive)).toBe(true);
    expect(published.nightAnnouncement).toBe('昨夜平安夜');
    expect(isValidGame(published)).toBe(true);
  });

  it('queues a manually confirmed hunter only after the normal dawn confirmation', () => {
    const reviewed = applyAction(finishNight(manualFixture()), {
      type: 'set-dawn-deaths', deaths: [{ seat: 7, cause: 'ruling' }], reason: '已核对特殊技能',
    });
    expect(reviewed.players[6].alive).toBe(true);
    expect(reviewed.pending).toEqual([]);
    expect(reviewed.stage).toBe('dawn');
    const published = applyAction(reviewed, { type: 'dawn' });
    expect(published.players[6].death).toEqual({ day: 1, cause: 'ruling' });
    expect(published.stage).toBe('hunter');
    expect(published.pending).toEqual([{ kind: 'hunter', seat: 7 }]);
    expect(isValidGame(published)).toBe(true);
    expect(applyAction(published, { type: 'hunter', target: null }).stage).toBe('discussion');
  });

  it('defers manual deaths and the elected hunter sheriff skills until announcement', () => {
    let game = applyAction(finishNight(manualFixture({ sheriff: true, sheriffTiming: 'before-announcement' })), {
      type: 'set-dawn-deaths', deaths: [{ seat: 7, cause: 'knife' }], reason: '确认昨夜名单',
    });
    game = applyAction(game, { type: 'dawn' });
    expect(game.stage).toBe('sheriff-signup');
    expect(game.players[6].alive).toBe(true);
    expect(game.pending).toEqual([]);
    game = applyAction(game, { type: 'signup', seats: [7] });
    expect(game.stage).toBe('dawn-announcement');
    expect(game.sheriff).toBe(7);
    expect(game.pending).toEqual([]);
    expect(isValidGame(game)).toBe(true);
    game = applyAction(game, { type: 'announce-dawn' });
    expect(game.stage).toBe('hunter');
    expect(game.pending).toEqual([{ kind: 'hunter', seat: 7 }, { kind: 'badge', seat: 7 }]);
    game = applyAction(game, { type: 'hunter', target: null });
    expect(game.stage).toBe('badge');
    game = applyAction(game, { type: 'badge', target: 3 });
    expect(game.stage).toBe('discussion');
    expect(game.sheriff).toBe(3);
  });

  it.each([false, true])('honors hunterPoison=%s for a manually confirmed poison death', hunterPoison => {
    const reviewed = applyAction(finishNight(manualFixture({ hunterPoison })), {
      type: 'set-dawn-deaths', deaths: [{ seat: 7, cause: 'poison' }], reason: '确认中毒名单',
    });
    const published = applyAction(reviewed, { type: 'dawn' });
    expect(published.stage).toBe(hunterPoison ? 'hunter' : 'discussion');
    expect(published.pending).toEqual(hunterPoison ? [{ kind: 'hunter', seat: 7 }] : []);
  });

  it.each([
    ['missing seat', [{ seat: 99, cause: 'knife' }]],
    ['fractional seat', [{ seat: 3.5, cause: 'knife' }]],
    ['duplicate seat', [{ seat: 3, cause: 'knife' }, { seat: 3, cause: 'poison' }]],
    ['unknown cause', [{ seat: 3, cause: 'fire' }]],
  ])('rejects a manual list containing %s', (_label, deaths) => {
    const game = finishNight(manualFixture());
    const action = { type: 'set-dawn-deaths', deaths, reason: '确认昨夜名单' } as Action;
    expect(() => applyAction(game, action)).toThrow();
    expect(game.night.manualDeaths).toBeUndefined();
  });

  it('rejects a player who was already dead before this night', () => {
    let game = applyAction(finishNight(manualFixture()), {
      type: 'set-dawn-deaths', deaths: [{ seat: 3, cause: 'knife' }], reason: '确认首夜名单',
    });
    game = applyAction(game, { type: 'dawn' });
    game = applyAction(game, { type: 'next-night' });
    game = finishNight(game);
    expect(() => applyAction(game, {
      type: 'set-dawn-deaths', deaths: [{ seat: 3, cause: 'ruling' }], reason: '确认次夜名单',
    })).toThrow();
  });

  it('blocks manual overrides when the mode is not enabled', () => {
    const game = finishNight(fixture());
    expect(() => applyAction(game, { type: 'set-dawn-deaths', deaths: [], reason: '确认昨夜名单' })).toThrow('未开启');
  });

  it.each(['', ' ', '一'])('rejects a stored confirmation without a meaningful reason: %j', manualReason => {
    const game = finishNight(manualFixture());
    const malformed = { ...game, night: { ...game.night, manualDeaths: [], manualReason } };
    expect(isValidGame(malformed)).toBe(false);
    expect(() => decodeSession(JSON.stringify({ current: malformed, undo: [], redo: [] }))).toThrow();
  });
});

describe('saved custom hosting flow', () => {
  it('preserves a valid custom order, script and explicit manual-dawn setting', () => {
    const saved = profile({ nightOrder: [...reversedOrder], scripts: { dawn: '请主持人核对名单。' }, manualDawn: true });
    const preferences = normalizePreferences({ hostingMode: 'custom', profiles: [saved], selectedProfileId: saved.id });
    expect(preferences.profiles).toEqual([saved]);
    expect(preferences.selectedProfileId).toBe(saved.id);
  });

  it.each([
    { nightOrder: ['wolves'] },
    { nightOrder: ['witch', 'seer', 'wolves', 'not-a-role'] },
    { nightOrder: ['witch', 'seer', 'wolves', 'wolves'] },
    { manualDawn: 'yes' },
    { scripts: { dawn: 5 } },
    { scripts: { dawn: 'x'.repeat(1201) } },
  ])('drops a malformed stored flow without leaving it selected: %j', flow => {
    const saved = { ...profile({}), rules: { ...DEFAULT_RULES, flow } };
    const preferences = normalizePreferences({ hostingMode: 'custom', profiles: [saved], selectedProfileId: saved.id });
    expect(preferences.profiles).toEqual([]);
    expect(preferences.selectedProfileId).toBeUndefined();
  });
});
