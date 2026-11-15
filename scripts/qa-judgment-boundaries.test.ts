import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame, nightDeaths, tally } from '../src/game/engine';
import { decodeSession, isValidGame } from '../src/game/save-schema';
import { canSelfExplode } from '../src/game/role-behavior';
import type { Action, Cause, Game, Role, Rules } from '../src/game/types';

const baseRoles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'guard', 'hunter'];
const fixture = (rules: Partial<Rules> = {}, roles = baseRoles) => createGame('判断边界回归', '明确结果的测试阵容', roles.map((role, index) => ({ name: `${index + 1}号`, role })), { ...DEFAULT_RULES, sheriff: false, win: 'all', ...rules });

function act(game: Game, action: Action) {
  const original = JSON.stringify(game);
  const payload = JSON.stringify(action);
  const next = applyAction(game, action);
  expect(JSON.stringify(game)).toBe(original);
  expect(JSON.stringify(action)).toBe(payload);
  expect(isValidGame(next)).toBe(true);
  expect(decodeSession(JSON.stringify({ current: next, undo: [], redo: [] })).session.current).toEqual(next);
  return next;
}

const nightCombinations = (['die', 'live'] as const).flatMap(guardSave => [false, true].flatMap(guarded => [false, true].flatMap(save => [null, 3, 4, 6, 7].map(poison => ({ guardSave, guarded, save, poison })))));

describe('self-explosion qualification matches the card restriction', () => {
  it.each(['gargoyle', 'awakened-hidden-wolf', 'evil-knight', 'fragrance-shadow'] as const)('rejects the forbidden %s action without killing or advancing anyone', role => {
    const game = fixture({}, [role, 'wolf', 'villager', 'villager', 'seer', 'witch']);
    game.stage = 'discussion';
    const snapshot = JSON.stringify(game);
    expect(canSelfExplode(role)).toBe(false);
    expect(() => applyAction(game, { type: 'explode', seat: 1 })).toThrow('不能自爆');
    expect(JSON.stringify(game)).toBe(snapshot);
    expect(game.players.every(player => player.alive)).toBe(true);
    expect(game.pending).toEqual([]);
  });

  it.each(['wolf', 'white-wolf-king'] as const)('preserves the explicitly supported %s explosion', role => {
    const game = fixture({}, [role, 'wolf', 'villager', 'villager', 'seer', 'witch']);
    game.stage = 'discussion';
    expect(canSelfExplode(role)).toBe(true);
    const next = act(game, { type: 'explode', seat: 1 });
    expect(next.players[0].death?.cause).toBe('explode');
    expect(next.stage).toBe(role === 'white-wolf-king' ? 'shot' : 'wolves');
  });
});

describe('independent night judgment oracle', () => {
  it.each(nightCombinations)('resolves knife, guard, antidote and poison together: %j', ({ guardSave, guarded, save, poison }) => {
    let game = fixture({ guardSave, doubleMedicine: true });
    game = act(game, { type: 'guard', target: guarded ? 3 : 4 });
    game = act(game, { type: 'wolves', target: 3 });
    game = act(game, { type: 'seer', target: null });
    game = act(game, { type: 'witch', save, poison });
    const expected = new Map<number, Cause>();
    const knifeKills = guarded ? save && guardSave === 'die' : !save;
    if (knifeKills) expected.set(3, 'knife');
    // Poison supersedes knife and is not prevented by the ordinary guard/antidote.
    if (poison !== null) expected.set(poison, 'poison');
    const deaths = [...expected].sort(([a], [b]) => a - b).map(([seat, cause]) => ({ seat, cause }));
    expect(nightDeaths(game)).toEqual(deaths);
    expect(game.medicine).toEqual({ save: !save, poison: poison === null });
    const settled = act(game, { type: 'dawn' });
    expect(settled.players.filter(player => !player.alive).map(player => ({ seat: player.seat, cause: player.death!.cause }))).toEqual(deaths);
    expect(nightDeaths(settled)).toEqual(deaths);
  });

  it.each(['never', 'first', 'always'] as const)('applies the exact self-save day restriction for %s', selfSave => {
    for (const day of [1, 2, 5]) {
      const game = fixture({ selfSave });
      game.stage = 'witch'; game.day = day; game.night.knife = 6;
      const snapshot = JSON.stringify(game);
      const allowed = selfSave === 'always' || selfSave === 'first' && day === 1;
      if (allowed) expect(act(game, { type: 'witch', save: true, poison: null }).medicine.save).toBe(false);
      else expect(() => applyAction(game, { type: 'witch', save: true, poison: null })).toThrow('不允许此时自救');
      expect(JSON.stringify(game)).toBe(snapshot);
    }
  });
});

describe('death work precedes the victory oracle', () => {
  it.each([false, true].flatMap(badge => [null, 1].map(target => ({ badge, target }))))('settles the last god hunter before choosing a winner: %j', ({ badge, target }) => {
    const roles: Role[] = ['wolf', 'villager', 'villager', 'villager', 'seer', 'hunter'];
    let game = fixture({ win: 'edge', sheriff: badge }, roles);
    game.sheriffDone = true; game.sheriff = badge ? 6 : null;
    game.players[4].alive = false; game.players[4].death = { day: 1, cause: 'knife' };
    game.stage = 'dawn'; game.night.knife = 6;
    game = act(game, { type: 'dawn' });
    expect(game.stage).toBe('hunter');
    expect(game.winner).toBeUndefined();
    game = act(game, { type: 'hunter', target });
    if (badge) {
      expect(game.stage).toBe('badge');
      expect(game.winner).toBeUndefined();
      game = act(game, { type: 'badge', target: 2 });
    }
    expect(game.stage).toBe('ended');
    expect(game.winner).toBe(target === null ? 'wolf' : 'good');
  });

  it('resolves the last white wolf king shot before the badge and automatic win, without granting a shot-killed hunter another gun', () => {
    const roles: Role[] = ['white-wolf-king', 'villager', 'villager', 'villager', 'seer', 'hunter'];
    let game = fixture({ sheriff: true }, roles);
    game.stage = 'discussion'; game.sheriffDone = true; game.sheriff = 1;
    game = act(game, { type: 'explode', seat: 1 });
    expect(game.stage).toBe('shot');
    expect(game.pending.map(item => item.kind)).toEqual(['shot', 'badge']);
    expect(game.winner).toBeUndefined();
    game = act(game, { type: 'shot', target: 6 });
    expect(game.players[5].death?.cause).toBe('shot');
    expect(game.stage).toBe('badge');
    expect(game.pending.map(item => item.kind)).toEqual(['badge']);
    game = act(game, { type: 'badge', target: 2 });
    expect(game).toMatchObject({ stage: 'ended', winner: 'good', sheriff: 2 });
  });

  it('keeps host-confirmed victory in control after a last-wolf death and its linked sheriff', () => {
    const roles: Role[] = ['wolf-beauty', 'villager', 'villager', 'seer', 'witch', 'hunter'];
    let game = fixture({ sheriff: true, flow: { manualVictory: true } }, roles);
    game.stage = 'discussion'; game.sheriffDone = true; game.sheriff = 6;
    game.night.targets['wolf-beauty'] = 6;
    game = act(game, { type: 'ruling', seat: 1, alive: false, reason: '本桌决斗结果' });
    expect(game.stage).toBe('link');
    expect(() => applyAction(game, { type: 'link', target: 4 })).toThrow('已记录的魅惑目标');
    game = act(game, { type: 'link', target: 6 });
    expect(game.players[5].death?.cause).toBe('link');
    expect(game.stage).toBe('badge');
    expect(game.pending).toEqual([{ kind: 'badge', seat: 6 }]);
    game = act(game, { type: 'badge', target: null });
    expect(game.stage).toBe('discussion');
    expect(game.winner).toBeUndefined();
    game = act(game, { type: 'finish', winner: 'good', reason: '已完整核对技能和胜负' });
    expect(game).toMatchObject({ stage: 'ended', winner: 'good' });
  });
});

function pkGame() {
  const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'guard', 'idiot'];
  let game = fixture({ sheriff: true }, roles);
  game.stage = 'discussion'; game.sheriffDone = true; game.sheriff = 1;
  game.players[5].alive = false; game.players[5].death = { day: 1, cause: 'poison' };
  game.players[7].exposed = true;
  game = act(game, { type: 'start-exile' });
  expect(game.vote?.voters).toEqual([1, 2, 3, 4, 5, 7]);
  expect(game.vote?.candidates).toEqual([1, 2, 3, 4, 5, 7]);
  game = act(game, { type: 'ballots', voters: [1, 7], target: null });
  game = act(game, { type: 'ballots', voters: [2, 5], target: 3 });
  game = act(game, { type: 'ballots', voters: [3, 4], target: 4 });
  expect(tally(game).filter(row => row.votes > 0)).toEqual([{ seat: 3, votes: 2 }, { seat: 4, votes: 2 }]);
  return act(game, { type: 'count' });
}

describe('PK voter eligibility and exact sheriff weighting', () => {
  it('excludes dead, exposed and PK candidate seats, while retaining sheriff weighting', () => {
    let game = pkGame();
    expect(game.vote).toMatchObject({ round: 2, candidates: [3, 4], voters: [1, 2, 5, 7], ballots: {} });
    game = act(game, { type: 'ballot', voter: 1, target: 3 });
    game = act(game, { type: 'ballot', voter: 2, target: 4 });
    game = act(game, { type: 'ballots', voters: [5, 7], target: null });
    expect(tally(game)).toEqual([{ seat: 3, votes: 1.5 }, { seat: 4, votes: 1 }]);
    game = act(game, { type: 'count' });
    expect(game.players[2].death?.cause).toBe('exile');
    expect(game.players[3].alive).toBe(true);
    expect(game.day).toBe(2);
  });

  it.each([3, 6, 8])('rejects ineligible PK voter %s atomically', voter => {
    const game = pkGame();
    const snapshot = JSON.stringify(game);
    expect(() => applyAction(game, { type: 'ballots', voters: [1, voter], target: 3 })).toThrow('没有本轮投票权');
    expect(JSON.stringify(game)).toBe(snapshot);
    expect(game.vote?.ballots).toEqual({});
  });
});

const nightLabels: [Cause, string][] = [['knife', '刀伤'], ['poison', '中毒'], ['shot', '技能带走'], ['ruling', '主持裁定'], ['link', '跟随出局']];

describe('manual dawn causes remain accurate and private', () => {
  it.each([false, true].flatMap(beforeElection => nightLabels.map(([cause, label]) => ({ beforeElection, cause, label }))))('records the actual reviewed cause through both announcement orders: %j', ({ beforeElection, cause, label }) => {
    let game = fixture({ sheriff: beforeElection, sheriffTiming: 'before-announcement', flow: { manualDawn: true } });
    game.stage = 'dawn';
    game = act(game, { type: 'set-dawn-deaths', deaths: [{ seat: 3, cause }], reason: '确认实际出局原因' });
    game = act(game, { type: 'dawn' });
    if (beforeElection) {
      expect(game.stage).toBe('sheriff-signup');
      expect(game.players[2].alive).toBe(true);
      game = act(game, { type: 'signup', seats: [] });
      expect(game.stage).toBe('dawn-announcement');
      game = act(game, { type: 'announce-dawn' });
    }
    expect(game.players[2].death?.cause).toBe(cause);
    const resultLog = game.events.find(event => event.text.includes('出局（'));
    expect(resultLog?.text).toContain(`3号${label}`);
    expect(resultLog?.publicText).toBe('昨夜 3 号 出局');
    expect(game.events.map(event => event.publicText ?? '').join('\n')).not.toMatch(/刀伤|中毒|技能带走|主持裁定|跟随出局/);
  });
});
