import {
  JINGCHENG_TREASURE_DECK,
  drawJingchengTreasure,
  isValidJingchengReserve,
} from '../src/game/jingcheng-draw';

describe('京城大师赛 S15 盗宝大师抽牌板', () => {
  it('contains the confirmed 15-card pool', () => {
    expect(JINGCHENG_TREASURE_DECK).toHaveLength(15);
    expect(JINGCHENG_TREASURE_DECK.filter(role => role === 'wolf')).toHaveLength(3);
    expect(JINGCHENG_TREASURE_DECK.filter(role => role === 'villager')).toHaveLength(5);
    expect(JINGCHENG_TREASURE_DECK).toEqual(expect.arrayContaining([
      'medium', 'poisoner', 'hunter', 'dreamer', 'raven', 'wolf-king', 'treasure-master',
    ]));
  });

  it('deals twelve seats and three reserve cards with the treasure master seated', () => {
    const result = drawJingchengTreasure(() => 0.37);
    expect(result.roles).toHaveLength(12);
    expect(result.reserve).toHaveLength(3);
    expect([...result.roles, ...result.reserve]).toHaveLength(15);
    expect(result.roles.filter(role => role === 'treasure-master')).toHaveLength(1);
    expect(result.reserve).not.toContain('treasure-master');
    expect(isValidJingchengReserve(result.reserve)).toBe(true);
  });

  it('falls back to a valid deal when randomness repeatedly proposes an illegal reserve', () => {
    const result = drawJingchengTreasure(() => 0);
    expect(isValidJingchengReserve(result.reserve)).toBe(true);
    expect(result.roles).toContain('treasure-master');
  });

  it('marks the treasure master wolf aligned only when a wolf is in the reserve', () => {
    // The deterministic fallback contains one wolf in the reserve.
    expect(drawJingchengTreasure(() => 0).treasureCamp).toBe('wolf');
    const good = drawJingchengTreasure(() => 0.075);
    expect(good.treasureCamp).toBe('good');
    expect(good.notes).toContain('好人阵营');
  });

  it('rejects treasure, three wolves, three gods, or three villagers as reserve', () => {
    expect(isValidJingchengReserve(['treasure-master', 'wolf', 'villager'] as any)).toBe(false);
    expect(isValidJingchengReserve(['wolf', 'wolf', 'wolf'] as any)).toBe(false);
    expect(isValidJingchengReserve(['medium', 'poisoner', 'hunter'] as any)).toBe(false);
    expect(isValidJingchengReserve(['villager', 'villager', 'villager'] as any)).toBe(false);
  });
});

