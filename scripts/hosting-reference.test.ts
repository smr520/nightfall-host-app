import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import { hostingProgress } from '../src/game/hosting-reference';
import type { Game, Role } from '../src/game/types';

function fixture(): Game {
  const board = BOARD_LIBRARY[0];
  return createGame('流程提示测试', board.name, boardSeats(board).map(role => ({ name: role, role })), { ...DEFAULT_RULES });
}

function castTiedBallots(original: Game): Game {
  let game = original;
  for (const [index, voter] of original.vote!.voters.entries()) {
    game = applyAction(game, { type: 'ballot', voter, target: index % 2 === 0 ? 5 : 6 });
  }
  return game;
}

describe('hosting process reference', () => {
  it('follows the active night sequence across first-night-only and eliminated roles', () => {
    const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'miracle-merchant', 'lone-girl'];
    let game = createGame('首夜与后续夜', '测试阵容', roles.map(role => ({ name: role, role })), { ...DEFAULT_RULES, sheriff: false });
    expect(game.stage).toBe('miracle-merchant');
    expect(hostingProgress(game).next).toBe('孤独少女行动');
    game = applyAction(game, { type: 'call', callId: 'miracle-merchant', target: null });
    game = applyAction(game, { type: 'call', callId: 'lone-girl', target: 3 });
    game = applyAction(game, { type: 'wolves', target: null });
    game = applyAction(game, { type: 'seer', target: null });
    expect(hostingProgress(game).next).toBe('天亮核对');
    game = applyAction(game, { type: 'witch', save: false, poison: null });
    game = applyAction(game, { type: 'dawn' });
    game = applyAction(game, { type: 'ruling', seat: 5, alive: false, reason: '流程测试出局' });
    game = applyAction(game, { type: 'next-night' });
    expect(game.day).toBe(2);
    expect(game.stage).toBe('wolves');
    expect(game.nightCalls).toEqual(expect.arrayContaining(['miracle-merchant', 'lone-girl', 'seer']));
    expect(hostingProgress(game).next).toBe('女巫行动');
    game = applyAction(game, { type: 'wolves', target: null });
    expect(game.stage).toBe('witch');
    expect(hostingProgress(game).next).toBe('天亮核对');
  });

  it('describes both first-day sheriff orders in the same order the engine actually executes them', () => {
    const before: Game = { ...fixture(), stage: 'dawn' };
    const hunter = before.players.find(player => player.role === 'hunter')!;
    before.night.knife = hunter.seat;
    before.rules.sheriffTiming = 'before-announcement';
    expect(hostingProgress(before).next).toBe('警长竞选 → 公布昨夜结果');
    let result = applyAction(before, { type: 'dawn' });
    expect(result.stage).toBe('sheriff-signup');
    expect(result.players.find(player => player.seat === hunter.seat)?.alive).toBe(true);
    result = applyAction(result, { type: 'signup', seats: [] });
    expect(result.stage).toBe('dawn-announcement');
    result = applyAction(result, { type: 'announce-dawn' });
    expect(result.stage).toBe('hunter');

    const after: Game = { ...fixture(), stage: 'dawn' };
    const afterHunter = after.players.find(player => player.role === 'hunter')!;
    after.night.knife = afterHunter.seat;
    after.rules.sheriffTiming = 'after-announcement';
    expect(hostingProgress(after).next).toBe('公布结果 → 出局技能与警徽 → 核对胜负 → 竞选');
    result = applyAction(after, { type: 'dawn' });
    expect(result.stage).toBe('hunter');
    expect(result.players.find(player => player.seat === afterHunter.seat)?.alive).toBe(false);
    result = applyAction(result, { type: 'hunter', target: null });
    expect(result.stage).toBe('sheriff-signup');
  });

  it.each(['sheriff', 'exile'] as const)('does not promise another PK after the second %s ballot', kind => {
    let game: Game = { ...fixture(), stage: kind === 'sheriff' ? 'dawn' : 'discussion', sheriffDone: kind === 'exile' };
    if (kind === 'sheriff') {
      game = applyAction(game, { type: 'dawn' });
      game = applyAction(game, { type: 'signup', seats: [5, 6] });
    } else game = applyAction(game, { type: 'start-exile' });
    game = applyAction(castTiedBallots(game), { type: 'count' });
    expect(game.vote?.round).toBe(2);
    game = castTiedBallots(game);
    expect(hostingProgress(game).current).toContain('PK 投票');
    expect(hostingProgress(game).next).not.toContain('PK');
    const result = applyAction(game, { type: 'count' });
    expect(result.stage).toBe(kind === 'sheriff' ? 'dawn-announcement' : 'wolves');
    if (kind === 'exile') expect(result.day).toBe(2);
  });

  it('keeps death skills and badge processing ahead of victory checks and the next night', () => {
    let game: Game = { ...fixture(), stage: 'discussion', sheriffDone: true };
    const hunterSeat = game.players.find(player => player.role === 'hunter')!.seat;
    game.sheriff = hunterSeat;
    game = applyAction(game, { type: 'start-exile' });
    for (const voter of game.vote!.voters) game = applyAction(game, { type: 'ballot', voter, target: hunterSeat });
    game = applyAction(game, { type: 'count' });
    expect(game.pending.map(skill => skill.kind)).toEqual(['hunter', 'badge']);
    const progress = hostingProgress(game);
    expect(progress.current).toBe('出局技能');
    expect(progress.next).toBe('剩余技能与警徽 → 核对胜负 → 下一夜');
    game = applyAction(game, { type: 'hunter', target: null });
    expect(game.stage).toBe('badge');
    expect(game.day).toBe(1);
    expect(hostingProgress(game).current).toBe('警徽处理');
    expect(hostingProgress(game).next).toBe('剩余技能与警徽 → 核对胜负 → 下一夜');
    game = applyAction(game, { type: 'badge', target: null });
    expect(game.stage).toBe('wolves');
    expect(game.day).toBe(2);
  });
});
