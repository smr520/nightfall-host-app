import { BOARD_LIBRARY, boardById } from '../src/game/boards';
import { rulesForBoard } from '../src/game/board-rules';
import { DEFAULT_RULES } from '../src/game/config';

describe('board night order source', () => {
  it('keeps one authoritative night order source', () => {
    expect('night' in BOARD_LIBRARY[0]).toBe(false);

    const mechWolf = boardById('jingcheng-mech-wolf')!;
    expect(rulesForBoard(DEFAULT_RULES, mechWolf).flow?.nightOrder).toEqual([
      'mech-wolf',
      'guard',
      'wolves',
      'witch',
      'medium',
    ]);
  });
});
