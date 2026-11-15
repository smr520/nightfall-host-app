import React from 'react';
import { Alert, BackHandler, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { normalizePreferences, type HostingProfile } from '../src/game/preferences';
import { decodeSession } from '../src/game/save-schema';
import type { Role, Rules } from '../src/game/types';
import { SetupScreen } from '../src/ui/SetupScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

function profile(role: Role, rules: Rules = DEFAULT_RULES): HostingProfile {
  return { id: 'practical', name: '本桌方案', boardName: '本桌阵容', roles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', role], rules };
}

function mount(selected?: HostingProfile, onSaveProfile?: (draft: Omit<HostingProfile, 'id'>) => Promise<void>) {
  const onStart = jest.fn();
  const onBack = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<SetupScreen mode={selected ? 'custom' : 'standard'} initialRules={selected?.rules ?? DEFAULT_RULES} initialProfile={selected} onBack={onBack} onStart={onStart} onSaveProfile={onSaveProfile} />); });
  const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const press = (label: string) => {
    const node = button(label);
    if (!node) throw new Error(`Missing button ${label}`);
    act(() => { if (!node.props.disabled) node.props.onPress(); });
  };
  const toggle = (label: string, value: boolean) => act(() => renderer.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onValueChange === 'function')[0].props.onValueChange(value));
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  return { renderer, button, press, toggle, text, onStart, onBack, unmount: () => act(() => renderer.unmount()) };
}

describe('practical pregame controls', () => {
  it('opens custom roles directly from a normal new game and separates third-party cards', () => {
    const app = mount();
    app.press('自定义人数和角色');
    expect(app.button('增加孤独少女')).toBeDefined();
    const labels = app.renderer.root.findAllByType(Text).map(node => node.props.children);
    expect(labels).toContain('第三方');
    expect(app.text()).toContain('不按普通神职理解');
    app.unmount();
  });

  it('shows concrete dreamer handling before play and defaults to reviewed dawn results', () => {
    const app = mount(profile('dreamer'));
    app.press('下一步'); app.press('下一步');
    expect(app.text()).toContain('本局现场处理清单');
    expect(app.text()).toContain('梦亡');
    expect(app.text()).toContain('已启用天亮手动复核');
    app.press('开始主持');
    expect(app.onStart.mock.calls[0][0].rules.flow?.manualDawn).toBe(true);
    expect(app.onStart.mock.calls[0][0].rules.flow?.manualVictory).not.toBe(true);
    app.unmount();
  });

  it('lets the host override recommended defaults at the last review step', () => {
    const app = mount(profile('red-moon-apostle'));
    app.press('下一步'); app.press('下一步');
    expect(app.text()).toContain('已启用主持人判定结束');
    app.press('调整本局处理方式');
    app.toggle('天亮时手动确认出局名单', false);
    app.toggle('由主持人判定对局结束', false);
    app.press('完成流程设置'); app.press('开始主持');
    expect(app.onStart.mock.calls[0][0].rules.flow).toMatchObject({ manualDawn: false, manualVictory: false });
    app.unmount();
  });

  it('removes inferred review defaults when an untouched special lineup changes to a normal board', () => {
    const app = mount(profile('dreamer'));
    app.press('当前板子 本桌阵容，点击更换');
    app.press(`选择板子：${BOARD_LIBRARY[0].name}`);
    app.press('下一步'); app.press('下一步'); app.press('开始主持');
    expect(app.onStart.mock.calls[0][0].rules.flow).toEqual({
      identityCheck: 'during-night',
      nightOrder: ['wolves', 'seer', 'witch'],
    });
    app.unmount();
  });

  it('keeps third-party seats out of the good-camp summary and persists manual victory in saved profiles', async () => {
    const app = mount(profile('lone-girl'));
    app.press('下一步'); app.press('下一步');
    expect(app.text()).toMatch(/第三方\s*,1/);
    expect(app.text()).toMatch(/好人\s*,4/);
    app.press('开始主持');
    const game = app.onStart.mock.calls[0][0];
    expect(game.rules.flow?.manualVictory).toBe(true);
    expect(decodeSession(JSON.stringify({ current: game, undo: [], redo: [] })).session.current.rules.flow?.manualVictory).toBe(true);
    app.unmount();

    const onSave = jest.fn().mockResolvedValue(undefined);
    const editor = mount(profile('lone-girl'), onSave);
    editor.press('下一步');
    await act(async () => { editor.press('保存方案并设为默认'); await Promise.resolve(); });
    expect(onSave.mock.calls[0][0].rules.flow.manualVictory).toBe(true);
    expect(normalizePreferences({ profiles: [{ ...onSave.mock.calls[0][0], id: 'saved' }] }).profiles[0].rules.flow?.manualVictory).toBe(true);
    editor.unmount();
  });

  it('preserves an explicit saved override for an otherwise recommended special-board review', () => {
    const app = mount(profile('red-moon-apostle', { ...DEFAULT_RULES, flow: { manualDawn: false, manualVictory: false } }));
    app.press('下一步'); app.press('下一步');
    expect(app.text()).toContain('主持人判定结束已关闭');
    app.press('开始主持');
    expect(app.onStart.mock.calls[0][0].rules.flow).toMatchObject({ manualDawn: false, manualVictory: false });
    app.unmount();
  });

  it('uses top and Android back to move through setup before asking to discard it', () => {
    const addHandler = jest.spyOn(BackHandler, 'addEventListener');
    const alert = jest.spyOn(Alert, 'alert');
    const app = mount();
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '对局名称' }).props.onChangeText('周六现场局'));
    app.press('下一步'); app.press('下一步');
    app.press('返回');
    expect(app.button('胜负条件 屠边')).toBeDefined();
    expect(alert).not.toHaveBeenCalled();
    act(() => { addHandler.mock.calls.at(-1)?.[1]({ type: 'hardwareBackPress', timeStamp: 0 }); });
    expect(app.button('自定义人数和角色')).toBeDefined();
    act(() => { addHandler.mock.calls.at(-1)?.[1]({ type: 'hardwareBackPress', timeStamp: 0 }); });
    expect(alert).toHaveBeenCalledWith('放弃本次开局设置？', expect.any(String), expect.any(Array));
    expect(app.onBack).not.toHaveBeenCalled();
    app.unmount(); addHandler.mockRestore(); alert.mockRestore();
  });
});
