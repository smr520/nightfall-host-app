import { BOARD_LIBRARY, boardById, boardSeats } from '../src/game/boards';
import { boardSupport, compareBoardSupport } from '../src/game/board-support';
import { profileBoard } from '../src/game/preferences';
import { DEFAULT_RULES } from '../src/game/config';

describe('board support levels', () => {
  it('classifies every board without hiding any existing lineup', () => {
    const classified = BOARD_LIBRARY.map(board => boardSupport(board));

    expect(classified).toHaveLength(BOARD_LIBRARY.length);
    expect(classified.every(item => ['verified', 'guided', 'experimental'].includes(item.level))).toBe(true);
    expect(classified.every(item => item.label.trim().length > 0 && item.summary.trim().length > 0)).toBe(true);
  });

  it('marks only fully verified core boards as verified', () => {
    expect(boardSupport(boardById('standard-12')!).level).toBe('verified');
    expect(boardSupport(boardById('12-guard')!).level).toBe('verified');
    expect(boardSupport(boardById('9-classic')!).level).toBe('verified');
    expect(boardSupport(boardById('15-standard')!).level).toBe('verified');

    expect(boardSupport(boardById('wolf-beauty-knight')!).level).not.toBe('verified');
    expect(boardSupport(boardById('jingcheng-qingqiu')!).level).not.toBe('verified');
  });

  it('separates guided reference boards from boards with many host-handled skills', () => {
    expect(boardSupport(boardById('standard-12')!).manualRoles).toEqual([]);

    const qingqiu = boardSupport(boardById('jingcheng-qingqiu')!);
    expect(qingqiu.level).toBe('guided');
    expect(qingqiu.unresolvedCount).toBeGreaterThan(0);

    const wolfPlan = boardSupport(boardById('wolf-plan')!);
    expect(wolfPlan.level).toBe('experimental');
    expect(wolfPlan.manualRoles.length).toBeGreaterThanOrEqual(2);
    expect(wolfPlan.summary).toContain('主持人');
  });

  it('reports the exact host-handled roles and keeps verification reasons actionable', () => {
    const support = boardSupport(boardById('wolf-plan')!);
    const roles = boardSeats(boardById('wolf-plan')!);

    expect(support.manualRoles.every(role => roles.includes(role))).toBe(true);
    expect(support.reasons.length).toBeGreaterThan(0);
    expect(support.reasons.join(' ')).toMatch(/人工|规则|来源/);
  });

  it('sorts recommended verified boards ahead while preserving all entries', () => {
    const sorted = [...BOARD_LIBRARY].sort(compareBoardSupport);

    expect(sorted).toHaveLength(BOARD_LIBRARY.length);
    expect(new Set(sorted.map(board => board.id))).toEqual(new Set(BOARD_LIBRARY.map(board => board.id)));
    expect(boardSupport(sorted[0]).level).toBe('verified');
  });

  it('keeps a saved copy of a verified board recognizable through sourceBoardId', () => {
    const source = boardById('standard-12')!;
    const copy = profileBoard({
      id: 'my-standard',
      name: '我的标准局',
      boardName: source.name,
      sourceBoardId: source.id,
      roles: boardSeats(source),
      rules: { ...DEFAULT_RULES, sheriff: true },
    });
    expect(copy.sourceBoardId).toBe('standard-12');
    expect(boardSupport(copy).level).toBe('verified');
  });
});
