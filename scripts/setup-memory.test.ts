import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { createGame } from '../src/game/engine';
import { normalizePreferences } from '../src/game/preferences';
import { boardForSetup, isSetupMemory, setupMemoryFromGame, setupSummary, type SetupMemory } from '../src/game/setup-memory';
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

  it('prefills board metadata without treating the old seat identities as a new game', () => {
    const setup = memory();
    const board = boardForSetup(setup);
    expect(board.name).toBe(setup.boardName);
    expect(board.playerCount).toBe(setup.roles.length);
    expect(setup.playerNames[0]).toBe('阿明');
    expect(setup.rules.speechSeconds).toBe(150);
    expect(setup.rules.sheriff).toBe(false);
    expect(setup.rules.table?.notes).toBe('上次约定');
  });

  it('reconstructs a custom lineup that is not in the board library', () => {
    const roles: Role[] = ['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'guard', 'idiot'];
    const setup = memory({ boardId: undefined, boardName: '我的桌', roles, playerNames: roles.map(() => '') });
    const board = boardForSetup(setup);
    expect(board.tag).toBe('custom');
    expect(board.name).toBe('我的桌');
    expect(board.playerCount).toBe(roles.length);
  });

  it('keeps a draw-pool board as a deck so setup performs a fresh deal', () => {
    const deck = BOARD_LIBRARY.find(board => board.deck)!;
    const setup = memory({ boardId: deck.id, boardName: deck.name, roles: boardSeats(deck), playerNames: boardSeats(deck).map(() => ''), rules: { ...DEFAULT_RULES } });
    expect(isSetupMemory(setup)).toBe(true);
    const board = boardForSetup(setup);
    expect(board.name).toBe(deck.name);
    expect(board.deck).toBe(deck.deck);
    expect(board.playerCount).toBe(12);
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
