import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import { isValidGame } from '../src/game/save-schema';
import { gameInvariantIssues } from '../src/game/save-invariants';
import type { Game, Role } from '../src/game/types';

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'hunter'];

function pendingHunter(): Game {
  const game = createGame(
    '待办结束测试',
    '六人局',
    roles.map(role => ({ name: '', role })),
    { ...DEFAULT_RULES, sheriff: false },
  );
  return {
    ...game,
    stage: 'hunter',
    pending: [{ kind: 'hunter', seat: 6 }],
    players: game.players.map(player => player.seat === 6 ? {
      ...player,
      alive: false,
      death: { day: 1, cause: 'knife' },
    } : player),
  };
}

describe('host finish cannot silently discard pending skills', () => {
  it('rejects ending while a pending skill still exists', () => {
    const game = pendingHunter();
    const before = JSON.stringify(game);
    expect(() => applyAction(game, {
      type: 'finish',
      winner: 'draw',
      reason: '现场提前结束',
    })).toThrow('仍有 1 项待办');
    expect(JSON.stringify(game)).toBe(before);
  });

  it('ends only after an explicit discard confirmation and stores a valid result', () => {
    const ended = applyAction(pendingHunter(), {
      type: 'finish',
      winner: 'draw',
      reason: '全体同意放弃遗留技能',
      discardPending: true,
    });
    expect(ended).toMatchObject({ stage: 'ended', winner: 'draw', pending: [] });
    expect(isValidGame(ended)).toBe(true);
    expect(gameInvariantIssues(ended)).toEqual([]);
  });

  it('marks a corrupt persisted ended game with pending work as invalid', () => {
    const game = pendingHunter();
    const corrupt = {
      ...game,
      stage: 'ended' as const,
      winner: 'draw' as const,
      endedAt: Date.now(),
    };
    expect(gameInvariantIssues(corrupt).map(issue => issue.code)).toContain('ended-with-pending');
    expect(isValidGame(corrupt)).toBe(false);
  });
});
