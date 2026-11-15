import { DEFAULT_RULES } from '../src/game/config';
import { createGame } from '../src/game/engine';
import { gameInvariantIssues, hasValidGameInvariants } from '../src/game/save-invariants';
import type { Game, Role } from '../src/game/types';

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'guard', 'hunter'];

function fixture(): Game {
  return createGame(
    '存档一致性',
    '八人测试',
    roles.map((role, index) => ({ name: `${index + 1}号`, role })),
    { ...DEFAULT_RULES, sheriff: true },
  );
}

describe('semantic game invariants', () => {
  it('accepts a normal newly created game', () => {
    const game = fixture();
    expect(gameInvariantIssues(game)).toEqual([]);
    expect(hasValidGameInvariants(game)).toBe(true);
  });

  it('rejects alive and death-record contradictions in both directions', () => {
    const game = fixture();
    const aliveWithDeath: Game = {
      ...game,
      players: game.players.map((player, index) => index === 0 ? {
        ...player,
        death: { day: 1, cause: 'knife' },
      } : player),
    };
    expect(gameInvariantIssues(aliveWithDeath).map(issue => issue.code)).toContain('alive-with-death');

    const deadWithoutDeath: Game = {
      ...game,
      players: game.players.map((player, index) => index === 0 ? { ...player, alive: false } : player),
    };
    expect(gameInvariantIssues(deadWithoutDeath).map(issue => issue.code)).toContain('dead-without-death');
  });

  it('requires a dead sheriff to be in badge handling rather than silently remaining sheriff', () => {
    const game = fixture();
    const deadSheriff: Game = {
      ...game,
      sheriff: 1,
      players: game.players.map(player => player.seat === 1 ? {
        ...player,
        alive: false,
        death: { day: 1, cause: 'exile' },
      } : player),
    };
    expect(gameInvariantIssues(deadSheriff).map(issue => issue.code)).toContain('dead-sheriff-without-badge');
    expect(hasValidGameInvariants({ ...deadSheriff, stage: 'badge', pending: [{ kind: 'badge', seat: 1 }] })).toBe(true);
  });

  it('rejects impossible vote rosters and partial ended results', () => {
    const game = fixture();
    const player = game.players[0];
    const impossible: Game = {
      ...game,
      stage: 'exile-vote',
      endedAt: 1,
      vote: {
        kind: 'exile',
        round: 1,
        candidates: [player.seat],
        voters: [player.seat],
        ballots: {},
      },
      players: game.players.map(item => item.seat === player.seat ? {
        ...item,
        alive: false,
        death: { day: 1, cause: 'exile' },
      } : item),
    };
    const codes = gameInvariantIssues(impossible).map(issue => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['ineligible-voter', 'ineligible-candidate', 'result-without-ended']));
  });

  it('keeps a pending queue head aligned with the active stage', () => {
    const game = fixture();
    const misaligned: Game = {
      ...game,
      stage: 'discussion',
      pending: [{ kind: 'hunter', seat: game.players[7].seat }],
      players: game.players.map(player => player.seat === game.players[7].seat ? {
        ...player,
        alive: false,
        death: { day: 1, cause: 'knife' },
      } : player),
    };
    expect(gameInvariantIssues(misaligned).map(issue => issue.code)).toContain('pending-stage-mismatch');
  });
});
