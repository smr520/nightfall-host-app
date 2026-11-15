import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, callActorAlive, createGame, knifeActors, nightDeaths, victory } from '../src/game/engine';
import { decodeSession } from '../src/game/save-schema';
import type { Game, Role } from '../src/game/types';

const make = (roles: Role[], extra: Partial<Game> = {}): Game => ({
  ...createGame('技能自动结算', '测试阵容', roles.map((role, index) => ({ name: `${index + 1}号`, role })), { ...DEFAULT_RULES, sheriff: false, win: 'all' }),
  ...extra,
});

const seatOf = (game: Game, role: Role) => game.players.find(player => player.role === role)!.seat;

const atStage = (game: Game, stage: Game['stage'], day = game.day): Game => ({
  ...game,
  day,
  stage,
  night: { ...game.night, targets: {}, knife: null, guard: null, inspect: null, save: false, poison: null, checkDeaths: [] },
});

describe('咒狐', () => {
  const board = () => make(['wolf', 'villager', 'villager', 'seer', 'witch', 'fox']);

  it('免疫狼刀，被预言家查验后在天亮时出局', () => {
    const base = board();
    const fox = seatOf(base, 'fox');
    expect(nightDeaths({ ...base, night: { ...base.night, knife: fox } })).toEqual([]);

    let game = atStage(base, 'seer');
    game = applyAction(game, { type: 'seer', target: fox });
    expect(nightDeaths(game)).toContainEqual({ seat: fox, cause: 'check' });
  });

  it('好人或狼人任一方清空且咒狐仍在场时，咒狐获胜', () => {
    const base = board();
    const noWolves = { ...base, players: base.players.map(player => player.role === 'wolf' ? { ...player, alive: false } : player) };
    expect(victory(noWolves)).toEqual({ winner: 'third', reason: expect.stringContaining('咒狐') });
  });
});

describe('纯白之女', () => {
  const board = () => make(['wolf', 'villager', 'villager', 'pure-white', 'witch', 'hunter']);

  it('首夜查验狼人不造成出局，第二夜起查验狼人天亮出局', () => {
    const base = board();
    const wolf = seatOf(base, 'wolf');

    let first = atStage(base, 'pure-white', 1);
    first = applyAction(first, { type: 'call', callId: 'pure-white', target: wolf });
    expect(nightDeaths(first)).not.toContainEqual({ seat: wolf, cause: 'check' });

    let second = atStage(base, 'pure-white', 2);
    second = applyAction(second, { type: 'call', callId: 'pure-white', target: wolf });
    expect(nightDeaths(second)).toContainEqual({ seat: wolf, cause: 'check' });

    const restored = decodeSession(JSON.stringify({ current: second, undo: [], redo: [] })).session.current;
    expect(restored.night.checkDeaths).toEqual([wolf]);
  });
});

describe('狼巫', () => {
  const board = () => make(['wolf', 'villager', 'villager', 'wolf-shaman', 'pure-white', 'hunter']);

  it('只能查验非狼人，第二夜起查验纯白之女使其出局', () => {
    const base = board();
    const wolf = seatOf(base, 'wolf');
    const pure = seatOf(base, 'pure-white');
    const first = atStage(base, 'wolf-shaman', 1);
    expect(() => applyAction(first, { type: 'call', callId: 'wolf-shaman', target: wolf })).toThrow('非狼人');

    let nightOne = applyAction(first, { type: 'call', callId: 'wolf-shaman', target: pure });
    expect(nightDeaths(nightOne)).not.toContainEqual({ seat: pure, cause: 'check' });

    let nightTwo = atStage(base, 'wolf-shaman', 2);
    nightTwo = applyAction(nightTwo, { type: 'call', callId: 'wolf-shaman', target: pure });
    expect(nightDeaths(nightTwo)).toContainEqual({ seat: pure, cause: 'check' });
  });
});

describe('摄梦人', () => {
  const board = () => make(['wolf', 'villager', 'villager', 'dreamer', 'seer', 'hunter']);

  it('梦游者免疫狼刀与毒药，连续两夜同一目标会梦亡', () => {
    const base = board();
    const target = seatOf(base, 'villager');
    let game = atStage(base, 'dreamer', 1);
    game = applyAction(game, { type: 'call', callId: 'dreamer', target });

    expect(nightDeaths({ ...game, night: { ...game.night, knife: target } })).toEqual([]);
    expect(nightDeaths({ ...game, night: { ...game.night, poison: target } })).toEqual([]);

    const repeated = { ...game, special: { ...(game.special ?? {}), dreamerLast: target } };
    expect(nightDeaths(repeated)).toContainEqual({ seat: target, cause: 'dream' });
  });

  it('摄梦人夜间出局时梦游者随之梦亡', () => {
    const base = board();
    const dreamer = seatOf(base, 'dreamer');
    const target = seatOf(base, 'villager');
    let game = atStage(base, 'dreamer', 1);
    game = applyAction(game, { type: 'call', callId: 'dreamer', target });
    expect(nightDeaths({ ...game, night: { ...game.night, knife: dreamer } })).toContainEqual({ seat: target, cause: 'dream' });
  });
});

describe('噩梦之影', () => {
  const board = () => make(['wolf', 'villager', 'villager', 'nightmare', 'seer', 'hunter']);

  it('恐惧狼人时狼队无法袭击，恐惧神职时该角色不能行动', () => {
    const base = board();
    const wolf = seatOf(base, 'wolf');
    const seer = seatOf(base, 'seer');
    let game = atStage(base, 'nightmare', 1);
    game = applyAction(game, { type: 'call', callId: 'nightmare', target: wolf });
    expect(knifeActors(game)).toEqual([]);

    let seerGame = atStage(base, 'nightmare', 1);
    seerGame = applyAction(seerGame, { type: 'call', callId: 'nightmare', target: seer });
    expect(callActorAlive(seerGame, 'seer')).toBe(false);
    expect(() => applyAction({ ...seerGame, stage: 'seer' }, { type: 'seer', target: null })).toThrow('被恐惧');
  });

  it('不能连续两夜恐惧同一目标', () => {
    const base = board();
    const wolf = seatOf(base, 'wolf');
    const game = { ...atStage(base, 'nightmare', 2), special: { nightmareLast: wolf } };
    expect(() => applyAction(game, { type: 'call', callId: 'nightmare', target: wolf })).toThrow('连续两夜');
  });
});

describe('猎魔人', () => {
  const board = () => make(['wolf', 'villager', 'villager', 'hunter-demon', 'seer', 'hunter']);

  it('第二夜起狩猎：猎中狼人目标出局，猎中好人自己出局', () => {
    const base = board();
    const wolf = seatOf(base, 'wolf');
    const good = seatOf(base, 'villager');
    expect(() => applyAction(atStage(base, 'hunter-demon', 1), { type: 'call', callId: 'hunter-demon', target: wolf })).toThrow('第 2 夜');

    let hitWolf = atStage(base, 'hunter-demon', 2);
    hitWolf = applyAction(hitWolf, { type: 'call', callId: 'hunter-demon', target: wolf });
    expect(nightDeaths(hitWolf)).toContainEqual({ seat: wolf, cause: 'demon-hunt' });

    let hitGood = atStage(base, 'hunter-demon', 2);
    hitGood = applyAction(hitGood, { type: 'call', callId: 'hunter-demon', target: good });
    expect(nightDeaths(hitGood)).toContainEqual({ seat: seatOf(base, 'hunter-demon'), cause: 'demon-hunt' });
  });

  it('免疫女巫毒药', () => {
    const base = board();
    const demon = seatOf(base, 'hunter-demon');
    expect(nightDeaths({ ...base, night: { ...base.night, poison: demon } })).not.toContainEqual({ seat: demon, cause: 'poison' });
  });
});

describe('流光伯爵', () => {
  const board = () => make(['wolf', 'villager', 'villager', 'light-earl', 'seer', 'hunter']);

  it('第二夜起庇护其他玩家，挡住狼刀与毒药，不能自保或连续同一人', () => {
    const base = board();
    const light = seatOf(base, 'light-earl');
    const target = seatOf(base, 'villager');
    expect(() => applyAction(atStage(base, 'light-earl', 1), { type: 'call', callId: 'light-earl', target })).toThrow('第 2 夜');

    let game = atStage(base, 'light-earl', 2);
    game = applyAction(game, { type: 'call', callId: 'light-earl', target });
    expect(nightDeaths({ ...game, night: { ...game.night, knife: target } })).toEqual([]);
    expect(nightDeaths({ ...game, night: { ...game.night, poison: target } })).toEqual([]);
    expect(() => applyAction({ ...game, stage: 'light-earl' }, { type: 'call', callId: 'light-earl', target: light })).toThrow('不能庇护自己');

    const repeated = { ...atStage(base, 'light-earl', 2), special: { lightEarlLast: target } };
    expect(() => applyAction(repeated, { type: 'call', callId: 'light-earl', target })).toThrow('连续两夜');
  });
});

describe('石像鬼', () => {
  const board = () => make(['wolf', 'villager', 'villager', 'gargoyle', 'seer', 'witch']);

  it('不能自验或重复查验，其他狼人出局后继承刀权', () => {
    const base = board();
    const gargoyle = seatOf(base, 'gargoyle');
    const wolf = seatOf(base, 'wolf');

    const stageOne = atStage(base, 'gargoyle', 1);
    expect(() => applyAction(stageOne, { type: 'call', callId: 'gargoyle', target: gargoyle })).toThrow('不能查验自己');

    let checked = applyAction(stageOne, { type: 'call', callId: 'gargoyle', target: wolf });
    expect(nightDeaths(checked)).toEqual([]);
    expect(() => applyAction({ ...checked, stage: 'gargoyle' }, { type: 'call', callId: 'gargoyle', target: wolf })).toThrow('已经查验过');

    const noWolves = { ...checked, players: checked.players.map(player => player.role === 'wolf' ? { ...player, alive: false } : player) };
    expect(knifeActors(noWolves).map(player => player.role)).toEqual(['gargoyle']);
  });
});
