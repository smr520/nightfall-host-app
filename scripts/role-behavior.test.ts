import { applyAction, createGame } from '../src/game/engine';
import { canExplode, canSelfExplode, roleDeathSkill } from '../src/game/role-behavior';
import type { Cause, Game, Role } from '../src/game/types';
import { DEFAULT_RULES } from '../src/game/config';

function fixture(roles: Role[]): Game {
  return createGame('卡牌技能时机', '技能时序测试', roles.map((role, index) => ({ name: `${index + 1}号玩家`, role })), { ...DEFAULT_RULES, sheriff: false, win: 'all' });
}

function exilePlayer(game: Game, seat: number): Game {
  const candidates = [seat];
  const voters = game.players.filter(player => player.alive && player.seat !== seat).map(player => player.seat);
  game.stage = 'exile-vote';
  game.vote = { kind: 'exile', round: 1, candidates, voters, ballots: Object.fromEntries(voters.map(voter => [voter, seat])) };
  return applyAction(game, { type: 'count' });
}

function prepareBeautyExile(targetRole: Role, sheriffTarget = false): { game: Game; target: number; beauty: number } {
  const roles: Role[] = ['wolf', 'wolf-beauty', 'wolf', 'villager', 'villager', 'seer', 'witch', targetRole];
  const game = fixture(roles);
  const beauty = game.players.find(player => player.role === 'wolf-beauty')!.seat;
  const target = game.players.find(player => player.seat !== beauty && player.role === targetRole)!.seat;
  game.night.targets['wolf-beauty'] = target;
  if (sheriffTarget) game.sheriff = target;
  return { game, target, beauty };
}

describe('card death-skill and self-explosion timing', () => {
  it('rejects a bonus ability card as a standalone seat identity', () => {
    expect(() => fixture(['wolf', 'wolf', 'villager', 'villager', 'seer', 'lucky-one'])).toThrow('幸运儿是附加能力状态，不是独立身份');
  });

  it.each([
    ['knife', true], ['exile', true], ['poison', false], ['shot', false], ['link', false], ['explode', false],
  ] as [Cause, boolean][])('keeps the ordinary hunter rule for %s death', (cause, expected) => {
    expect(roleDeathSkill('hunter', cause, { ...DEFAULT_RULES, hunterPoison: false })).toBe(expected ? 'hunter' : null);
  });

  it('permits the configured poisoned-hunter variant while linked players remain skill-suppressed', () => {
    expect(roleDeathSkill('hunter', 'poison', { ...DEFAULT_RULES, hunterPoison: true })).toBe('hunter');
    expect(roleDeathSkill('hunter', 'link', { ...DEFAULT_RULES, hunterPoison: true })).toBeNull();
  });

  it('only triggers wolf-beauty linking on exile, hunter shot, and explicit host ruling', () => {
    for (const cause of ['exile', 'shot', 'ruling'] as const) expect(roleDeathSkill('wolf-beauty', cause, DEFAULT_RULES)).toBe('link');
    for (const cause of ['knife', 'poison', 'explode', 'link'] as const) expect(roleDeathSkill('wolf-beauty', cause, DEFAULT_RULES)).toBeNull();
  });

  it('does not trigger a wolf-beauty link from a night poison action', () => {
    const game = fixture(['wolf', 'wolf-beauty', 'wolf', 'villager', 'villager', 'seer', 'witch', 'hunter']);
    const beauty = game.players.find(player => player.role === 'wolf-beauty')!.seat;
    game.night.targets['wolf-beauty'] = 4;
    game.stage = 'dawn';
    game.night.poison = beauty;
    const dawn = applyAction(game, { type: 'dawn' });
    expect(dawn.players.find(player => player.seat === beauty)?.death?.cause).toBe('poison');
    expect(dawn.pending).toEqual([]);
    expect(dawn.stage).toBe('discussion');
  });

  it.each(['hunter', 'wolf-king'] as const)('suppresses a linked %s ability but still queues its sheriff badge', role => {
    const { game: setup, target } = prepareBeautyExile(role, true);
    const link = exilePlayer(setup, setup.players.find(player => player.role === 'wolf-beauty')!.seat);
    expect(link.stage).toBe('link');

    const settled = applyAction(link, { type: 'link', target });

    expect(settled.players.find(player => player.seat === target)?.death?.cause).toBe('link');
    expect(settled.pending).toEqual([{ kind: 'badge', seat: target }]);
    expect(settled.stage).toBe('badge');
  });

  it('allows self-explosion for registered ordinary wolves but rejects the stone-gargoyle card', () => {
    expect(canSelfExplode('wolf')).toBe(true);
    expect(canSelfExplode('white-wolf-king')).toBe(true);
    expect(canSelfExplode('gargoyle')).toBe(false);
    expect(canSelfExplode('villager')).toBe(false);

    const game = fixture(['gargoyle', 'wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'hunter']);
    const wolf = game.players.find(player => player.role === 'wolf')!;
    expect(canExplode(game, wolf.seat)).toBe(true);
    expect(canExplode(game, 1)).toBe(false);
    const deadWolf = { ...game, players: game.players.map(player => player.seat === wolf.seat ? { ...player, alive: false } : player) };
    expect(canExplode(deadWolf, wolf.seat)).toBe(false);

    game.stage = 'discussion';
    expect(() => applyAction(game, { type: 'explode', seat: 1 })).toThrow('石像鬼不能自爆');
  });
});
