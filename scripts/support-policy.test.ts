import { DEFAULT_RULES } from '../src/game/config';
import { hostingSupport, withSupportDefaults } from '../src/game/support-policy';

describe('concrete host-handled mechanics', () => {
  it('keeps normal hunter and wolf death-skill boards on their existing defaults', () => {
    const roles = ['wolf', 'villager', 'seer', 'witch', 'guard', 'hunter', 'wolf-king', 'wolf-beauty', 'white-wolf-king'] as const;
    expect(hostingSupport(roles)).toEqual({ checks: [], manualDawn: false, manualVictory: false });
    expect(withSupportDefaults(DEFAULT_RULES, roles)).toBe(DEFAULT_RULES);
  });

  it('adds dawn review for missing night damage effects without disabling ordinary victory checks', () => {
    const support = hostingSupport(['dreamer', 'pure-white', 'nightmare', 'dreamer']);
    expect(support.checks.map(check => check.role)).toEqual(['dreamer', 'pure-white', 'nightmare']);
    expect(support.manualDawn).toBe(true);
    expect(support.manualVictory).toBe(false);
    expect(withSupportDefaults(DEFAULT_RULES, ['dreamer']).flow).toEqual({ manualDawn: true });
  });

  it('holds automatic victory for third-party, delayed-death and unmodeled transferred death skills', () => {
    for (const role of ['lone-girl', 'red-moon-apostle', 'miracle-merchant', 'awakened-wolf-king'] as const) {
      expect(hostingSupport([role]).manualVictory).toBe(true);
      expect(withSupportDefaults(DEFAULT_RULES, [role]).flow?.manualVictory).toBe(true);
    }
    expect(withSupportDefaults(DEFAULT_RULES, ['lone-girl']).flow?.manualDawn).toBeUndefined();
  });

  it('provides an actionable extra wake-up or daytime task without adding unnecessary review modes', () => {
    const support = hostingSupport(['gravekeeper', 'knight']);
    expect(support.checks[0].note).toContain('上一白天');
    expect(support.checks[1].note).toContain('人工裁定');
    expect(support.manualDawn).toBe(false);
    expect(support.manualVictory).toBe(false);
  });

  it('preserves explicit host choices and never changes the caller rules or scripts', () => {
    const rules = { ...DEFAULT_RULES, flow: { manualDawn: false, manualVictory: false, scripts: { discussion: '请依次发言。' } } };
    const snapshot = JSON.stringify(rules);
    expect(withSupportDefaults(rules, ['dreamer', 'lone-girl'])).toBe(rules);
    expect(JSON.stringify(rules)).toBe(snapshot);
    const original = { ...DEFAULT_RULES, flow: { scripts: { discussion: '保留口播。' } } };
    const recommended = withSupportDefaults(original, ['dreamer']);
    expect(recommended.flow).toEqual({ scripts: { discussion: '保留口播。' }, manualDawn: true });
    expect(original.flow).toEqual({ scripts: { discussion: '保留口播。' } });
    expect(withSupportDefaults(original, ['wolf', 'villager'])).toBe(original);
  });
});
