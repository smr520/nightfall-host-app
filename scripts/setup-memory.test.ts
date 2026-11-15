import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { createGame } from '../src/game/engine';
import { drawJingchengTreasure } from '../src/game/jingcheng-draw';
import { normalizePreferences } from '../src/game/preferences';
import { boardForSetup, gameFromSetup, isSetupMemory, setupMemoryFromGame, setupSummary, type SetupMemory } from '../src/game/setup-memory';
import type { Role } from '../src/game/types';

const base = BOARD_LIBRARY[0];

function memory(overrides: Partial<SetupMemory> = {}): SetupMemory {
  const roles = boardSeats(base);
  return {
    version: 1,
    mode: 'standard',
    boardId: base.id,
    boardName: base.name,
    roles,
    rules: { ...DEFAULT_RULES, sheriff: false, speechSeconds: 150, table: { notes: '上次约定' } },
    playerNames: roles.map((_, index) => index === 0 ? '阿明' : ''),
    gameName: '上周五',
    savedAt: 1,
    ...overrides,
  };
}

describe('remembered pregame setup', () => {
  it('validates and normalizes a complete setup', () => {
    expect(isSetupMemory(memory())).toBe(true);
    expect(isSetupMemory({ ...memory(), version: 2 })).toBe(false);
    expect(isSetupMemory({ ...memory(), playerNames: [] })).toBe(false);
    expect(isSetupMemory({ ...memory(), roles: ['wolf'] })).toBe(false);
    expect(isSetupMemory({ ...memory(), rules: { ...DEFAULT_RULES, win: 'bad' } })).toBe(false);

    const preferences = normalizePreferences({ lastSetup: memory() });
    expect(preferences.lastSetup).toEqual(memory());
    expect(normalizePreferences({ lastSetup: { ...memory(), playerNames: [] } }).lastSetup).toBeUndefined();
  });

  it('starts with the same board, seats, rules and names without visiting setup', () => {
    const setup = memory();
    const game = gameFromSetup(setup);
    expect(game.board).toBe(setup.boardName);
    expect(game.players.map(player => player.role)).toEqual(setup.roles);
    expect(game.players[0].name).toBe('阿明');
    expect(game.players[1].name).toBe('2号玩家');
    expect(game.rules.speechSeconds).toBe(150);
    expect(game.rules.sheriff).toBe(false);
    expect(game.rules.table?.notes).toBe('上次约定');
  });

  it('reconstructs a custom lineup that is not in the board library', () => {
    const roles: Role[] = ['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'guard', 'idiot'];
    const setup = memory({ boardId: undefined, boardName: '我的桌', roles, playerNames: roles.map(() => '') });
    expect(boardForSetup(setup).tag).toBe('custom');
    const game = gameFromSetup(setup);
    expect(game.board).toBe('我的桌');
    expect(game.players.map(player => player.role)).toEqual(roles);
  });

  it('re-deals a draw-pool board instead of replaying old hidden cards', () => {
    const deck = BOARD_LIBRARY.find(board => board.deck)!;
    const draw = drawJingchengTreasure();
    const setup = memory({ boardId: deck.id, boardName: deck.name, roles: draw.roles, playerNames: draw.roles.map(() => ''), rules: { ...DEFAULT_RULES } });
    expect(isSetupMemory(setup)).toBe(true);
    const game = gameFromSetup(setup);
    expect(game.board).toBe(deck.name);
    expect(game.players).toHaveLength(12);
    expect(game.special?.treasure).toBeDefined();
  });

  it('derives a setup from an ended game and cleans generated player names', () => {
    const game = createGame(
      '周五局',
      base.name,
      boardSeats(base).map((role, index) => ({ name: index === 0 ? '阿明' : `${index + 1}号玩家`, role })),
      DEFAULT_RULES,
    );
    const setup = setupMemoryFromGame(game, 'quick');
    expect(setup.boardId).toBe(base.id);
    expect(setup.mode).toBe('quick');
    expect(setup.playerNames[0]).toBe('阿明');
    expect(setup.playerNames[1]).toBe('');
    expect(setup.gameName).toBe('周五局');
    expect(setupSummary(setup)).toContain('发言 90 秒');
  });
});
