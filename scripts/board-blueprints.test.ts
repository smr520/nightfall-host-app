import { BOARD_LIBRARY } from '../src/game/boards';
import { JINGCHENG_TREASURE_MASTER, blueprintSeatedCards, validateBlueprintReserve } from '../src/game/board-blueprints';

describe('Jingcheng dynamic identity pool', () => {
  const blueprint = JINGCHENG_TREASURE_MASTER;

  it('keeps a confirmed 15-card pool behind the playable draw board', () => {
    expect(blueprint.identityPool.reduce((sum, card) => sum + card.count, 0)).toBe(15);
    expect(blueprint.identityPoolSize - blueprint.reserve.drawCount).toBe(blueprint.playerCount);
    expect(blueprint.identityPool.find(card => card.id === 'treasure-master')?.count).toBe(1);
    expect(blueprint.lineupStatus).toBe('confirmed-identity-pool');
    expect(blueprint.playability).toBe('draw-board');
    const board = BOARD_LIBRARY.find(item => item.id === blueprint.id)!;
    expect(board.deck).toBe('jingcheng-treasure');
    expect(board.playerCount).toBe(blueprint.playerCount);
    expect(blueprint.identityPool.every(card => board.counts[card.id as keyof typeof board.counts] === card.count)).toBe(true);
  });

  it('derives the 12 seated cards from valid reserve cards, retaining Treasure Master', () => {
    const seats = blueprintSeatedCards(blueprint, ['wolf', 'hunter', 'villager']);
    expect(seats.reduce((sum, card) => sum + card.count, 0)).toBe(12);
    expect(seats.find(card => card.id === 'wolf')?.count).toBe(2);
    expect(seats.some(card => card.id === 'hunter')).toBe(false);
    expect(seats.find(card => card.id === 'treasure-master')?.count).toBe(1);
    expect(validateBlueprintReserve(blueprint, ['hunter', 'dreamer', 'villager'])).toEqual([]);
    expect(validateBlueprintReserve(blueprint, ['villager', 'villager', 'hunter'])).toEqual([]);
  });

  it.each([
    ['wolf', 'wolf', 'villager'],
    ['wolf', 'wolf-king', 'hunter'],
    ['hunter', 'dreamer', 'raven'],
    ['villager', 'villager', 'villager'],
    ['treasure-master', 'hunter', 'villager'],
    ['hunter', 'hunter', 'villager'],
    ['witch', 'hunter', 'villager'],
    ['hunter', 'villager'],
  ])('rejects invalid reserve configuration %j', (...cards) => {
    expect(validateBlueprintReserve(blueprint, cards).length).toBeGreaterThan(0);
    expect(() => blueprintSeatedCards(blueprint, cards)).toThrow();
  });

  it('does not mutate the source identity pool while deriving different lineups', () => {
    const before = JSON.stringify(blueprint.identityPool);
    const seats = blueprintSeatedCards(blueprint, ['wolf', 'hunter', 'villager']);
    seats[0].count = 99;
    expect(JSON.stringify(blueprint.identityPool)).toBe(before);
  });
});
