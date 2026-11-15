import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY, CLASSIC_BOARDS, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import type { HostingProfile } from '../src/game/preferences';
import type { Role, Rules } from '../src/game/types';
import { SetupScreen } from '../src/ui/SetupScreen';
import { Sheet } from '../src/ui/kit';
import { BoardIntroduction } from '../src/ui/setup/BoardIntroduction';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

function mount(profile?: HostingProfile, rules: Rules = profile?.rules ?? DEFAULT_RULES) {
  const onStart = jest.fn();
  const onBack = jest.fn();
  const onOpenReference = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<SetupScreen mode={profile ? 'custom' : 'standard'} initialProfile={profile} initialRules={rules} onStart={onStart} onBack={onBack} onOpenReference={onOpenReference} />); });
  const buttons = (scope = renderer.root) => scope.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
  const button = (label: string, scope = renderer.root) => buttons(scope).find(node => node.props.accessibilityLabel === label);
  const press = (label: string, scope = renderer.root) => {
    const found = button(label, scope);
    if (!found) throw new Error(`Missing button: ${label}`);
    act(() => { if (!found.props.disabled) found.props.onPress(); });
  };
  const library = () => renderer.root.findAllByType(Sheet).find(node => node.props.visible && (node.props.title === '板子库' || node.props.title === '板子介绍'))!;
  const introduction = () => library().findByType(BoardIntroduction);
  const text = (scope: TestRenderer.ReactTestInstance) => scope.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  const openLibrary = (name = BOARD_LIBRARY[0].name) => press(`当前板子 ${name}，点击更换`);
  const unmount = () => act(() => renderer.unmount());
  return { renderer, buttons, button, press, library, introduction, text, openLibrary, onStart, onBack, onOpenReference, unmount };
}

describe('board-library introductions', () => {
  it('offers an independent introduction for every library board without nesting it inside selection', () => {
    const app = mount();
    app.openLibrary();
    const library = app.library();
    const introLabels = Array.from(new Set(app.buttons(library).map(node => node.props.accessibilityLabel).filter((label: unknown) => typeof label === 'string' && label.startsWith('查看介绍：'))));
    expect(introLabels).toEqual(BOARD_LIBRARY.map(board => `查看介绍：${board.name}`));
    for (const board of BOARD_LIBRARY) {
      const select = app.button(`选择板子：${board.name}`, library)!;
      expect(select.findAll(node => node.props.accessibilityLabel === `查看介绍：${board.name}`)).toHaveLength(0);
    }
    app.unmount();
  });

  it('previews without changing the draft or dirty state and returns to the same filter', () => {
    const alert = jest.spyOn(Alert, 'alert');
    const app = mount();
    app.openLibrary();
    app.press('常规', app.library());
    app.press('查看介绍：九人标准', app.library());
    expect(app.introduction().props.board.id).toBe('9-classic');
    expect(app.renderer.root.findByProps({ accessibilityLabel: '对局名称' }).props.value).toBe('周末局');
    app.press('返回板子库', app.library());
    expect(app.button('常规', app.library())?.props.accessibilityState.selected).toBe(true);
    expect(Array.from(new Set(app.buttons(app.library()).map(node => node.props.accessibilityLabel).filter((label: unknown) => typeof label === 'string' && label.startsWith('选择板子：'))))).toEqual(CLASSIC_BOARDS.map(board => `选择板子：${board.name}`));
    act(() => app.library().props.onClose());
    expect(app.button(`当前板子 ${BOARD_LIBRARY[0].name}，点击更换`)).toBeDefined();
    app.press('返回');
    expect(app.onBack).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
    app.unmount();
  });

  it('looks up the preview board roles instead of the current selected lineup', () => {
    const app = mount();
    app.openLibrary();
    app.press('查看介绍：狼美人骑士', app.library());
    const preview = BOARD_LIBRARY.find(board => board.id === 'wolf-beauty-knight')!;
    app.press('查看本板角色技能', app.introduction());
    expect(app.onOpenReference).toHaveBeenCalledWith({ roles: boardSeats(preview), rules: DEFAULT_RULES });
    expect(app.onOpenReference.mock.calls[0][0].roles).toContain('knight');
    expect(app.onOpenReference.mock.calls[0][0].roles).not.toContain('hunter');
    app.press('用这个板子', app.library());
    expect(app.button('当前板子 狼美人骑士，点击更换')).toBeDefined();
    expect(app.onStart).not.toHaveBeenCalled();
    app.unmount();
  });

  it('applies the full miracle merchant lineup directly instead of opening a lineup builder', () => {
    const app = mount();
    app.openLibrary();
    app.press('选择板子：奇迹商人');
    expect(app.button('当前板子 奇迹商人，点击更换')).toBeDefined();
    expect(app.renderer.root.findAllByType(Sheet).some(node => node.props.title === '自定义板子' && node.props.visible)).toBe(false);
    app.press('下一步');
    app.press('下一步');
    app.press('开始主持');
    expect(app.onStart).toHaveBeenCalledTimes(1);
    const game = app.onStart.mock.calls[0][0];
    expect(game.players).toHaveLength(12);
    expect(game.players.filter((player: { role: string }) => player.role === 'miracle-merchant')).toHaveLength(1);
    expect(game.players.filter((player: { role: string }) => player.role === 'lucky-one')).toHaveLength(0);
    app.unmount();
  });

  it('describes a same-named custom profile from its actual roles rather than the standard board', () => {
    const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'];
    const profile: HostingProfile = { id: 'same-name', name: '六人自定', boardName: '预女猎白', roles, rules: { ...DEFAULT_RULES, sheriff: false } };
    const app = mount(profile);
    app.press('查看当前板子介绍');
    const detail = app.introduction();
    expect(detail.props.board.tag).toBe('custom');
    expect(detail.props.board.playerCount).toBe(6);
    const detailText = app.text(detail);
    expect(detailText).toContain('6 人角色配置');
    expect(detailText).toContain('自定义阵容');
    expect(detailText).not.toMatch(/猎人|白痴|12 人/);
    app.press('查看本板角色技能', detail);
    expect(app.onOpenReference.mock.calls[0][0].roles).toEqual(roles);
    app.unmount();
  });

  it('returns Android back through introduction and library, and keeps current seat swaps when reused', () => {
    const app = mount();
    app.press('下一步'); app.press('下一步');
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '1号玩家姓名' }).props.onChangeText('一号主持友'));
    app.press('1号身份 狼人，点击更改');
    app.press('与9号互换身份（预言家）');
    app.press('上一步'); app.press('上一步');
    app.press('查看当前板子介绍');
    act(() => app.library().props.onRequestClose());
    expect(app.library().props.title).toBe('板子库');
    act(() => app.library().props.onRequestClose());
    expect(app.library()).toBeUndefined();
    app.press('查看当前板子介绍');
    app.press('继续使用当前板子', app.library());
    app.press('下一步'); app.press('下一步');
    expect(app.renderer.root.findByProps({ accessibilityLabel: '1号玩家姓名' }).props.value).toBe('一号主持友');
    expect(app.button('1号身份 预言家，点击更改')).toBeDefined();
    app.press('开始主持');
    expect(app.onStart.mock.calls[0][0].players[0]).toMatchObject({ name: '一号主持友', role: 'seer' });
    expect(app.onStart.mock.calls[0][0].players[8].role).toBe('wolf');
    app.unmount();
  });
});
