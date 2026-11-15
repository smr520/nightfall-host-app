import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame, knifeActors, nightDeaths, victory } from '../src/game/engine';
import { decodeSession } from '../src/game/save-schema';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import type { Game, Role } from '../src/game/types';

const rules = { ...DEFAULT_RULES, sheriff: false };
const make = (roles: Role[], extra: Partial<Game> = {}, options: Parameters<typeof createGame>[4] = {}) => ({
  ...createGame('自动结算测试', '测试阵容', roles.map(role => ({ name: '', role })), rules, options),
  ...extra,
});
const atStage = (game: Game, stage: Game['stage']): Game => ({ ...game, stage, night: { ...game.night, targets: {}, knife: null, poison: null, save: false } });
const seatOf = (game: Game, role: Role) => game.players.find(player => player.role === role)!.seat;

describe('毒师自动结算', () => {
  it('毒死目标、整局只能用一瓶，并且毒不到免疫角色', () => {
    let game = make(['wolf', 'villager', 'villager', 'poisoner', 'medium', 'hunter']);
    game = { ...game, stage: 'poisoner' };
    game = applyAction(game, { type: 'call', callId: 'poisoner', target: 2 });
    expect(game.special?.poisonerUsed).toBe(true);
    expect(nightDeaths(game)).toEqual([{ seat: 2, cause: 'poison' }]);
    expect(() => applyAction({ ...game, stage: 'poisoner' }, { type: 'call', callId: 'poisoner', target: 3 })).toThrow('整局只有一瓶');

    let immune = make(['wolf', 'villager', 'nine-tails', 'poisoner', 'medium', 'hunter']);
    immune = { ...immune, stage: 'poisoner' };
    immune = applyAction(immune, { type: 'call', callId: 'poisoner', target: seatOf(immune, 'nine-tails') });
    expect(nightDeaths(immune).some(death => death.seat === seatOf(immune, 'nine-tails'))).toBe(false);
  });
});

describe('舞池自动结算', () => {
  const board = () => make(['wolf', 'wolf', 'villager', 'villager', 'seer', 'dancer']);

  it('三席舞池不会产生平票标记', () => {
    const base = board();
    const dancer = seatOf(base, 'dancer');
    let game = atStage({ ...base, day: 2 }, 'dancer');
    game = applyAction(game, { type: 'dance', seats: [dancer, 1, 3] });
    expect(game.special?.dance).toEqual({ pool: [dancer, 1, 3].sort((a, b) => a - b) });
  });

  it('人数少的一方出局，并且舞池内玩家免疫狼刀', () => {
    const base = board();
    const dancer = seatOf(base, 'dancer');
    const wolf = seatOf(base, 'wolf');
    let game = atStage({ ...base, day: 2 }, 'dancer');
    game = applyAction(game, { type: 'dance', seats: [dancer, wolf, 3] });
    expect(game.special?.dance?.pool).toEqual([dancer, 3, wolf].sort((a, b) => a - b));
    game = { ...game, night: { ...game.night, knife: dancer } };
    const deaths = nightDeaths(game);
    expect(deaths).toEqual([{ seat: wolf, cause: 'dance' }]);
    const next = applyAction({ ...game, stage: 'discussion' }, { type: 'next-night' });
    expect(next.special?.dance).toBeUndefined();
    expect(next.special?.danceVisited).toEqual(expect.arrayContaining([dancer, wolf, 3]));
  });

  it('必须选三人且同一玩家整局只能进一次舞池', () => {
    const base = board();
    let game = atStage({ ...base, day: 2 }, 'dancer');
    expect(() => applyAction(game, { type: 'dance', seats: [1, 2] })).toThrow('三名玩家');
    game = applyAction(game, { type: 'dance', seats: [1, 2, 3] });
    expect(() => applyAction({ ...game, stage: 'dancer' }, { type: 'dance', seats: [1, 4, 5] })).toThrow('已经进过舞池');
  });
});

describe('九尾标记与猎杀时刻', () => {
  const board = () => make(['wolf-king', 'wolf', 'nine-tails', 'villager', 'villager', 'seer']);

  it('夜间标记与投票标记自动累计，改票不会叠加', () => {
    let game = board();
    game = atStage(game, 'nine-tails');
    game = applyAction(game, { type: 'call', callId: 'nine-tails', target: 4 });
    expect(game.special?.marks?.[4]).toBe(1);
    expect(() => applyAction({ ...game, stage: 'nine-tails' }, { type: 'call', callId: 'nine-tails', target: null })).toThrow('必须标记');

    let vote = atStage(game, 'exile-vote');
    vote = { ...vote, vote: { kind: 'exile', round: 1, candidates: [4, 5], voters: [3], ballots: {} } };
    vote = applyAction(vote, { type: 'ballot', voter: 3, target: 4 });
    expect(vote.special?.marks?.[4]).toBe(2);
    vote = applyAction(vote, { type: 'ballot', voter: 3, target: 5 });
    expect(vote.special?.marks?.[4]).toBe(1);
    expect(vote.special?.marks?.[5]).toBe(1);
    // 存档校验要求标记层数 > 0；清零的标记必须删除。
    const persisted = decodeSession(JSON.stringify({ current: vote, undo: [], redo: [] })).session.current;
    expect(persisted.special?.marks).toEqual(vote.special?.marks);
  });

  it('A 大于 B 时 B 方全员出局且不能发动技能，随后进入夜晚', () => {
    let game = board();
    game = { ...game, stage: 'discussion', special: { marks: { 4: 1, 5: 1, 6: 1 } } };
    game = applyAction(game, { type: 'hunt' });
    expect(game.players.filter(player => !player.alive).map(player => player.seat).sort()).toEqual([1, 2]);
    expect(game.players.find(player => player.seat === 1)?.death?.cause).toBe('hunt');
    expect(game.pending).toHaveLength(0);
    expect(game.stage).not.toBe('discussion');
  });

  it('其他狼全部出局后九尾自动获得刀权', () => {
    const game = board();
    const withoutWolves = { ...game, players: game.players.map(player => player.role === 'wolf' || player.role === 'wolf-king' ? { ...player, alive: false } : player) };
    expect(knifeActors(withoutWolves).map(player => player.role)).toEqual(['nine-tails']);
    expect(knifeActors(game).map(player => player.role).sort()).toEqual(['wolf', 'wolf-king']);
  });
});

describe('白泽清除与传承', () => {
  const board = () => make(['wolf', 'villager', 'villager', 'baize', 'seer', 'hunter']);

  it('自动清除标记，出局后进入传承并记录继承人类型', () => {
    let game = board();
    game = { ...game, stage: 'baize', special: { marks: { 2: 2, 3: 1 } } };
    game = applyAction(game, { type: 'call', callId: 'baize', target: 2 });
    expect(game.special?.marks?.[2]).toBeUndefined();
    expect(game.special?.marks?.[3]).toBe(1);

    let exile: Game = { ...game, stage: 'exile-vote', vote: { kind: 'exile', round: 1, candidates: [4], voters: [1], ballots: { 1: 4 } } };
    exile = applyAction(exile, { type: 'count' });
    expect(exile.stage).toBe('heir');
    expect(exile.pending[0]).toMatchObject({ kind: 'heir', seat: 4 });
    exile = applyAction(exile, { type: 'heir', target: 2 });
    expect(exile.special?.heir).toEqual({ seat: 2, kind: 'villager' });
  });

  it('神职继承人夜间出局会延迟到投票结束后离场', () => {
    let game = board();
    game = { ...game, stage: 'heir', pending: [{ kind: 'heir', seat: 4 }] };
    game = applyAction(game, { type: 'heir', target: 6 });
    expect(game.special?.heir).toEqual({ seat: 6, kind: 'god' });
    game = { ...game, stage: 'dawn', night: { ...game.night, knife: 6 } };
    game = applyAction(game, { type: 'dawn' });
    expect(game.players.find(player => player.seat === 6)?.alive).toBe(true);
    expect(game.special?.delayedDeaths).toEqual([{ seat: 6, cause: 'knife' }]);
    game = applyAction({ ...game, stage: 'discussion' }, { type: 'next-night' });
    expect(game.players.find(player => player.seat === 6)?.alive).toBe(false);
  });
});

describe('机械狼与盗宝大师', () => {
  it('机械狼整局只能学习一次，学到猎人后出局可开枪', () => {
    let game = make(['wolf', 'wolf', 'villager', 'villager', 'medium', 'witch', 'hunter', 'mech-wolf']);
    game = atStage(game, 'mech-wolf');
    game = applyAction(game, { type: 'call', callId: 'mech-wolf', target: seatOf(game, 'hunter') });
    expect(game.special?.mechLearned).toBe('hunter');
    expect(() => applyAction({ ...game, stage: 'mech-wolf' }, { type: 'call', callId: 'mech-wolf', target: 1 })).toThrow('只能学习一次');
    game = { ...game, stage: 'dawn', night: { ...game.night, knife: seatOf(game, 'mech-wolf') } };
    game = applyAction(game, { type: 'dawn' });
    expect(game.pending[0]).toMatchObject({ kind: 'shot', seat: seatOf(game, 'mech-wolf') });
  });

  it('盗宝大师自动记录阵营、禁止连续借同一张，并结算借用毒药', () => {
    const roles: Role[] = ['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'medium', 'raven', 'poisoner', 'dreamer', 'treasure-master'];
    let game = make(roles, {}, { treasure: { reserve: ['wolf', 'villager', 'poisoner'], camp: 'wolf' } });
    expect(game.special?.treasure?.camp).toBe('wolf');
    game = { ...game, stage: 'treasure-master' };
    game = applyAction(game, { type: 'borrow', card: 'poisoner' });
    game = applyAction(game, { type: 'call', callId: 'treasure-master', target: 3 });
    expect(nightDeaths(game)).toEqual([{ seat: 3, cause: 'poison' }]);
    const nextNight: Game = { ...game, day: 2, stage: 'treasure-master', night: { ...game.night, targets: {}, poison: null }, special: { ...game.special!, treasure: { ...game.special!.treasure!, lastBorrowed: 'poisoner' as Role, borrowed: null } } };
    expect(() => applyAction(nextNight, { type: 'borrow', card: 'poisoner' })).toThrow('不能连续两夜');
  });

  it('狼阵营盗宝在狼队友全部出局后获得刀权，好人阵营则不获得', () => {
    const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'villager', 'medium', 'poisoner', 'treasure-master'];
    const wolfSide = make(roles, {}, { treasure: { reserve: ['wolf', 'villager', 'medium'], camp: 'wolf' } });
    const noWolves = { ...wolfSide, players: wolfSide.players.map(player => player.role === 'wolf' ? { ...player, alive: false } : player) };
    expect(knifeActors(noWolves).some(player => player.role === 'treasure-master')).toBe(true);
    const goodSide = make(roles, {}, { treasure: { reserve: ['villager', 'medium', 'poisoner'], camp: 'good' } });
    const goodNoWolves = { ...goodSide, players: goodSide.players.map(player => player.role === 'wolf' ? { ...player, alive: false } : player) };
    expect(knifeActors(goodNoWolves)).toHaveLength(0);
  });
});

describe('沙龙之夜咒狐胜负', () => {
  it('任一方清空时咒狐仍在场则咒狐胜，咒狐出局后恢复正常胜负', () => {
    const salon = BOARD_LIBRARY.find(board => board.id === 'salon-night')!;
    const game = createGame('沙龙', salon.name, boardSeats(salon).map(role => ({ name: '', role })), { ...DEFAULT_RULES, sheriff: false, table: { lineupMode: 'free' } });
    const noWolves = { ...game, players: game.players.map(player => player.role === 'wolf' || ['awakened-wolf-beauty', 'sun-eater', 'time-wolf-consort'].includes(player.role) ? { ...player, alive: false } : player) };
    expect(victory(noWolves)).toEqual({ winner: 'third', reason: expect.stringContaining('咒狐') });
    const foxDead = { ...noWolves, players: noWolves.players.map(player => player.role === 'fox' ? { ...player, alive: false } : player) };
    expect(victory(foxDead)?.winner).toBe('good');
  });
});
