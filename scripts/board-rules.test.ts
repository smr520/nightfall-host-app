import { mergeRuleOverrides, mergeRules, ruleChanges, rulesForBoard } from '../src/game/board-rules';
import { DEFAULT_RULES } from '../src/game/config';
import type { Rules } from '../src/game/types';

describe('board rule presets', () => {
  const base: Rules = {
    ...DEFAULT_RULES, sheriff: false, speechSeconds: 120,
    table: { guardRepeat: true, sheriffTie: 'none', notes: '原方案约定' },
    flow: { keepDeadCalls: true, scripts: { discussion: '原方案发言', 'exile-vote': '原方案投票' }, nightOrder: ['wolves', 'seer', 'witch'] },
  };
  const preset: Partial<Rules> = {
    selfSave: 'never', table: { sheriffTie: 'pk' },
    flow: { manualDawn: true, scripts: { discussion: '板子发言' }, nightOrder: ['seer', 'wolves', 'witch'] },
  };

  it('deep-merges table, flow and scripts while replacing the night order', () => {
    const result = rulesForBoard(base, { rules: preset });
    expect(result).toMatchObject({
      sheriff: false, speechSeconds: 120, selfSave: 'never',
      table: { guardRepeat: true, sheriffTie: 'pk', notes: '原方案约定' },
      flow: { keepDeadCalls: true, manualDawn: true, scripts: { discussion: '板子发言', 'exile-vote': '原方案投票' }, nightOrder: ['seer', 'wolves', 'witch'] },
    });
    result.flow!.nightOrder!.reverse();
    result.flow!.scripts!.discussion = '修改副本';
    expect(base.flow!.nightOrder).toEqual(['wolves', 'seer', 'witch']);
    expect(preset.flow!.scripts!.discussion).toBe('板子发言');
  });

  it('returns to the original profile rules when switching to a board without a preset', () => {
    expect(rulesForBoard(base, {})).toEqual(base);
    expect(rulesForBoard(base, {}).flow?.manualDawn).toBeUndefined();
    expect(rulesForBoard(base, {}).selfSave).toBe('first');
  });

  it('retains only explicit edits across switches, including nested host scripts', () => {
    const selected = rulesForBoard(base, { rules: preset });
    const edited = mergeRules(selected, { selfSave: 'always', table: { notes: '主持人新约定' }, flow: { scripts: { 'exile-vote': '主持人投票' } } });
    const overrides = mergeRuleOverrides({}, ruleChanges(selected, edited));
    expect(overrides).toEqual({ selfSave: 'always', table: { notes: '主持人新约定' }, flow: { scripts: { 'exile-vote': '主持人投票' } } });
    expect(rulesForBoard(base, {}, overrides)).toMatchObject({
      sheriff: false, selfSave: 'always',
      table: { guardRepeat: true, sheriffTie: 'none', notes: '主持人新约定' },
      flow: { scripts: { discussion: '原方案发言', 'exile-vote': '主持人投票' }, nightOrder: ['wolves', 'seer', 'witch'] },
    });
    expect(rulesForBoard(base, {}, overrides).flow?.manualDawn).toBeUndefined();
  });

  it('does not capture inferred support defaults when a different workflow setting changes', () => {
    const shown = mergeRules(base, { flow: { manualDawn: true, manualVictory: true } });
    const updated = mergeRules(shown, { speechSeconds: 180 });
    expect(ruleChanges(shown, updated)).toEqual({ speechSeconds: 180 });
    expect(rulesForBoard(base, {}, ruleChanges(shown, updated)).flow?.manualDawn).toBeUndefined();
  });
});
