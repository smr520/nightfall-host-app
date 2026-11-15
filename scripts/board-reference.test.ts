import { BOARD_LIBRARY, countsFromRoles, isPlayable, nightCallsFor, type Board } from '../src/game/boards';
import { BOARD_INTRODUCTIONS, boardIntroduction } from '../src/game/board-reference';
import { isRole } from '../src/game/roles';

describe('board introductions', () => {
  it('explains every board with concise gameplay highlights and pregame checks', () => {
    expect(Object.keys(BOARD_INTRODUCTIONS).sort()).toEqual(BOARD_LIBRARY.map(board => board.id).sort());
    for (const board of BOARD_LIBRARY) {
      const intro = boardIntroduction(board);
      expect(intro.overview.trim()).not.toBe('');
      expect(intro.highlights.length).toBeGreaterThanOrEqual(2);
      expect(intro.hostChecks.length).toBeGreaterThanOrEqual(2);
      expect(intro.highlights.every(line => line.trim().length > 0)).toBe(true);
      expect(intro.hostChecks.every(line => line.trim().length > 0)).toBe(true);
      expect(Object.keys(board.roles).every(isRole)).toBe(true);
      expect(intro.overview).not.toMatch(/最热门|最常见|一定获胜|全自动|几把/);
    }
  });

  it('offers a complete 6–16 player lineup for every board, all playable', () => {
    for (const board of BOARD_LIBRARY) {
      expect(board.playerCount).toBeGreaterThanOrEqual(6);
      expect(board.playerCount).toBeLessThanOrEqual(16);
      expect(isPlayable(board)).toBe(true);
      if (board.tag !== 'classic') expect(board.catalog?.sources.length).toBeGreaterThan(0);
    }
    expect(BOARD_INTRODUCTIONS['miracle-merchant'].highlights.join('')).toContain('幸运儿');
    expect(BOARD_INTRODUCTIONS['awakened-wolf-king'].highlights.join('')).toContain('不同牌');
    expect(BOARD_INTRODUCTIONS['white-wolf-king-guard'].highlights.join('')).toContain('自爆');
  });

  it('describes custom profiles from current roles even when their id or name resembles a built-in board', () => {
    const roles = { wolf: 2, villager: 2, seer: 1, witch: 1 } as const;
    const counts = countsFromRoles(roles);
    const custom: Board = { id: 'standard-12', name: '预女猎白', subtitle: '', tag: 'custom', playerCount: 6, roles, counts, night: nightCallsFor(counts) };
    const intro = boardIntroduction(custom);
    expect(intro.overview).toContain('6 人');
    expect(intro.overview).toContain('自定义');
    expect(intro.highlights.join('')).toContain('狼人 ×2');
    expect(intro.highlights.join('')).not.toContain('猎人');
    expect(intro.highlights.join('')).not.toContain('白痴');
    expect(intro).not.toBe(BOARD_INTRODUCTIONS['standard-12']);
  });

  it('provides an actionable fallback for an unknown or empty lineup', () => {
    const counts = countsFromRoles({});
    const intro = boardIntroduction({ id: 'new-user-board', name: '新阵容', subtitle: '', tag: 'custom', playerCount: 0, roles: {}, counts, night: [] });
    expect(intro.highlights.join('')).toContain('请先补齐阵容');
    expect(intro.overview).not.toContain('0 人');
  });
});
