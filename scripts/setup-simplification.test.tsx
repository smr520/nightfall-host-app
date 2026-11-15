import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { createGame } from '../src/game/engine';
import type { HostingProfile } from '../src/game/preferences';
import { decodeSession } from '../src/game/save-schema';
import type { Role, Rules } from '../src/game/types';
import { SetupScreen } from '../src/ui/SetupScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'guard', 'hunter'];
const profile = (rules: Rules = DEFAULT_RULES): HostingProfile => ({
  id: 'simple-table', name: '固定八人局', boardName: '八人桌规', roles: [...roles], rules,
});

function mount(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(element); });
  const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const press = (label: string) => {
    const node = button(label);
    if (!node) throw new Error(`Missing button: ${label}`);
    act(() => { if (!node.props.disabled) node.props.onPress(); });
  };
  const toggle = (label: string, value: boolean) => act(() => renderer.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onValueChange === 'function')[0].props.onValueChange(value));
  const field = (label: string, value: string) => act(() => renderer.root.findByProps({ accessibilityLabel: label }).props.onChangeText(value));
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  const unmount = () => act(() => renderer.unmount());
  return { renderer, button, press, toggle, field, text, unmount };
}

describe('lighter pregame setup', () => {
  it('keeps common rules visible and advanced controls closed for a new game', () => {
    const app = mount(<SetupScreen mode="standard" initialRules={DEFAULT_RULES} onBack={jest.fn()} onStart={jest.fn()} />);
    app.press('下一步');
    expect(app.button('胜负条件 屠边')).toBeDefined();
    expect(app.button('女巫自救 首夜')).toBeDefined();
    expect(app.button('展开更多桌规')).toBeDefined();
    expect(app.button('首日公布顺序 先公布后竞选')).toBeUndefined();
    expect(app.button('警长票权 1.5 票')).toBeUndefined();
    expect(app.button('放逐平票 本轮无人出局')).toBeUndefined();
    expect(app.button('自定义主持流程')).toBeUndefined();
    expect(app.renderer.root.findAll(node => node.props.accessibilityLabel === '本桌补充约定')).toHaveLength(0);
    expect(app.button('预览开场宣读')).toBeDefined();
    app.unmount();
  });

  it('preserves advanced edits after collapsing them and starts with those exact settings', () => {
    const onStart = jest.fn();
    const selected = profile();
    const app = mount(<SetupScreen mode="custom" initialProfile={selected} initialRules={selected.rules} onBack={jest.fn()} onStart={onStart} />);
    app.press('下一步'); app.press('展开更多桌规');
    app.press('首日公布顺序 先公布后竞选');
    app.press('警长票权 1 票');
    app.press('放逐平票 本轮无人出局');
    app.toggle('允许守卫连续守同一人', true);
    app.field('本桌补充约定', '仅首夜与放逐有遗言。');
    app.press('收起更多桌规');
    expect(app.button('警长票权 1 票')).toBeUndefined();
    app.press('预览开场宣读');
    const spoken = app.renderer.root.findByProps({ accessibilityLabel: '完整开场桌规台词' }).props.children as string;
    expect(spoken).toContain('先公布死亡，再竞选');
    expect(spoken).toContain('守卫可以连续守同人');
    expect(spoken).toContain('不 PK，无人出局');
    expect(spoken).toContain('仅首夜与放逐有遗言');
    app.press('完成宣读'); app.press('下一步'); app.press('开始主持');
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0][0].rules).toMatchObject({
      sheriffTiming: 'after-announcement', sheriffWeight: 1,
      table: { guardRepeat: true, exileTie: 'none', notes: '仅首夜与放逐有遗言。' },
    });
    app.unmount();
  });

  it('uses saved advanced rules and scripts without requiring them to be opened again', () => {
    const rules: Rules = { ...DEFAULT_RULES, sheriffTiming: 'after-announcement', table: { sheriffTie: 'none', exileTie: 'none', guardRepeat: true, notes: '固定桌规则' }, flow: { nightOrder: ['seer', 'wolves', 'witch', 'guard'], keepDeadCalls: true, scripts: { discussion: '请 {发言人} 开始。' } } };
    const selected = profile(rules);
    const onStart = jest.fn();
    const app = mount(<SetupScreen mode="custom" initialProfile={selected} initialRules={rules} onBack={jest.fn()} onStart={onStart} />);
    app.press('下一步');
    expect(app.button('展开更多桌规')).toBeDefined();
    expect(app.button('自定义主持流程')).toBeUndefined();
    app.press('下一步'); app.press('开始主持');
    const game = onStart.mock.calls[0][0];
    expect(game.rules).toEqual(rules);
    expect(game.stage).toBe('seer');
    expect(decodeSession(JSON.stringify({ current: game, undo: [], redo: [] })).session.current.rules).toEqual(rules);
    app.unmount();
  });

  it('opens advanced controls by default when editing a saved hosting profile', () => {
    const selected = profile();
    const app = mount(<SetupScreen mode="custom" initialProfile={selected} initialRules={selected.rules} onBack={jest.fn()} onStart={jest.fn()} onSaveProfile={jest.fn().mockResolvedValue(undefined)} />);
    app.press('下一步');
    expect(app.button('收起更多桌规')).toBeDefined();
    expect(app.button('警长平票 PK 一轮')).toBeDefined();
    expect(app.button('自定义主持流程')).toBeDefined();
    expect(app.renderer.root.findByProps({ accessibilityLabel: '本桌补充约定' })).toBeDefined();
    app.unmount();
  });

  it('keeps the lucky-one status out of new identity lineups and the merchant board', () => {
    const merchant = BOARD_LIBRARY.find(board => board.id === 'miracle-merchant')!;
    expect(merchant.counts['lucky-one']).toBe(0);
    expect(merchant.playerCount).toBe(12);
    const app = mount(<SetupScreen mode="standard" initialRules={DEFAULT_RULES} onBack={jest.fn()} onStart={jest.fn()} />);
    app.press(`当前板子 ${BOARD_LIBRARY[0].name}，点击更换`);
    app.press('选择板子：奇迹商人');
    app.press('自定义人数和角色');
    expect(app.button('增加奇迹商人')).toBeDefined();
    expect(app.button('增加幸运儿')).toBeUndefined();
    expect(app.button('减少幸运儿')).toBeUndefined();
    app.unmount();
  });

  it('requires correcting a legacy lucky-one lineup before saving while retaining its old session', async () => {
    const legacyRoles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'miracle-merchant', 'lucky-one'];
    const legacy = { ...profile(), name: '旧幸运儿方案', roles: legacyRoles };
    const onStart = jest.fn();
    const oldSetup = mount(<SetupScreen mode="custom" initialProfile={legacy} initialRules={legacy.rules} onBack={jest.fn()} onStart={onStart} />);
    expect(oldSetup.button('修正旧阵容')).toBeDefined();
    oldSetup.press('下一步'); oldSetup.press('下一步'); oldSetup.press('开始主持');
    expect(onStart).not.toHaveBeenCalled();
    expect(oldSetup.text()).toContain('旧方案把幸运儿当成了独立身份');
    oldSetup.unmount();

    const onSaveProfile = jest.fn().mockResolvedValue(undefined);
    const app = mount(<SetupScreen mode="custom" initialProfile={legacy} initialRules={legacy.rules} onBack={jest.fn()} onStart={jest.fn()} onSaveProfile={onSaveProfile} />);
    app.press('下一步');
    await act(async () => { app.press('保存方案并设为默认'); await Promise.resolve(); });
    expect(onSaveProfile).not.toHaveBeenCalled();
    expect(app.text()).toContain('幸运儿');
    app.press('上一步'); app.press('自定义人数和角色');
    expect(app.button('增加幸运儿')).toBeUndefined();
    expect(app.button('减少幸运儿')).toBeDefined();
    app.press('减少幸运儿'); app.press('增加村民'); app.press('用这套阵容'); app.press('下一步');
    await act(async () => { app.press('保存方案并设为默认'); await Promise.resolve(); });
    expect(onSaveProfile).toHaveBeenCalledTimes(1);
    expect(onSaveProfile.mock.calls[0][0].roles).not.toContain('lucky-one');
    expect(onSaveProfile.mock.calls[0][0].roles).toHaveLength(8);
    app.unmount();

    const existing = createGame('旧会话', '旧八人局', legacyRoles.map(role => ({ name: '', role: role === 'lucky-one' ? 'villager' : role })), DEFAULT_RULES);
    existing.players[7].role = 'lucky-one';
    const restored = decodeSession(JSON.stringify({ current: existing, undo: [], redo: [] })).session.current;
    expect(restored.players[7].role).toBe('lucky-one');
  });
});
