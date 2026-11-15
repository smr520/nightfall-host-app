import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import type { Game } from '../src/game/types';

describe('death resolution order', () => {
  it('rejects incomplete or repeated death resolution orders', () => {
    const players = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'].map((role, index) => ({
      name: `P${index + 1}`,
      role: role as Game['players'][number]['role'],
    }));

    expect(() => createGame('Invalid order duplicate', 'Test board', players, {
      ...DEFAULT_RULES,
      flow: { deathResolutionOrder: ['badge', 'badge', 'last-words'] },
    })).toThrow('自定义流程无效');

    expect(() => createGame('Invalid order missing step', 'Test board', players, {
      ...DEFAULT_RULES,
      flow: { deathResolutionOrder: ['badge', 'last-words'] },
    })).toThrow('自定义流程无效');
  });

  it('uses the configured order for last words, death skills and badge handling', () => {
    let game: Game = createGame(
      'Death resolution order',
      'Test board',
      ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'hunter', 'idiot'].map((role, index) => ({
        name: `P${index + 1}`,
        role: role as Game['players'][number]['role'],
      })),
      {
        ...DEFAULT_RULES,
        sheriff: true,
        table: { exileRecord: 'quick' },
        flow: {
          lastWords: { exile: true },
          deathResolutionOrder: ['badge', 'death-skill', 'last-words'],
        },
      },
    );
    const hunter = game.players.find(player => player.role === 'hunter')!;
    game.stage = 'exile-vote';
    game.sheriff = hunter.seat;
    game.sheriffDone = true;
    game.vote = {
      kind: 'exile',
      round: 1,
      candidates: game.players.map(player => player.seat),
      voters: [],
      ballots: {},
    };

    game = applyAction(game, { type: 'exile-result', target: hunter.seat });

    expect(game.pending.map(item => item.kind).sort()).toEqual(['badge', 'hunter', 'last-words'].sort());
    expect(game.stage).toBe('badge');
  });
});
