import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import type { Game } from '../src/game/types';

function fixture(): Game {
  return createGame(
    'Exile self vote',
    'Test board',
    ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'].map((role, index) => ({
      name: `P${index + 1}`,
      role: role as Game['players'][number]['role'],
    })),
    { ...DEFAULT_RULES, sheriff: false, win: 'all' },
  );
}

describe('exile self-vote table rule', () => {
  it('rejects self-voting by default and allows it only when the table opts in', () => {
    const game = fixture();
    game.stage = 'exile-vote';
    game.vote = {
      kind: 'exile',
      round: 1,
      candidates: [2, 3],
      voters: [2, 3],
      ballots: {},
    };

    expect(() => applyAction(game, { type: 'ballot', voter: 2, target: 2 })).toThrow('不能投给自己');
    expect(() => applyAction(game, { type: 'ballots', voters: [2, 3], target: 2 })).toThrow('不能投给自己');
    expect(game.vote.ballots).toEqual({});

    const permissive: Game = {
      ...game,
      rules: {
        ...game.rules,
        table: { ...game.rules.table, exileSelfVote: true },
      },
    };
    expect(() => applyAction(permissive, { type: 'ballot', voter: 2, target: 2 })).not.toThrow();
  });
});
