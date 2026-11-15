import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY, boardSeats, type Board } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import type { HostingProfile } from '../src/game/preferences';
import type { Rules } from '../src/game/types';
import { SetupScreen } from '../src/ui/SetupScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

describe('board rules and profile source in setup', () => {
  const source = BOARD_LIBRARY[0];
  const presetBoard: Board = {
    ...source, id: 'test-board-rules-preset', name: '专项规则板',
    rules: { selfSave: 'never', table: { sheriffTie: 'pk', notes: '专项规则宣读' }, flow: { manualDawn: true, scripts: { discussion: '专项板子发言' }, nightOrder: ['seer', 'wolves', 'witch'] } },
  };
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  beforeAll(() => { BOARD_LIBRARY.push(presetBoard); });
  afterAll(() => { BOARD_LIBRARY.splice(BOARD_LIBRARY.indexOf(presetBoard), 1); });
  afterEach(() => { if (renderer) act(() => renderer?.unmount()); renderer = undefined; });

  function mount(initialProfile?: HostingProfile, save?: (draft: Omit<HostingProfile, 'id'>) => Promise<void>, initialRules = initialProfile?.rules ?? DEFAULT_RULES) {
    const onStart = jest.fn();
    act(() => { renderer = TestRenderer.create(<SetupScreen mode={initialProfile || save ? 'custom' : 'standard'} initialProfile={initialProfile} initialRules={initialRules} onBack={jest.fn()} onStart={onStart} onSaveProfile={save} />); });
    const button = (label: string) => renderer!.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
    const press = (label: string) => {
      const node = button(label);
      if (!node) throw new Error(`Missing button: ${label}`);
      act(() => { if (!node.props.disabled) node.props.onPress(); });
    };
    const fill = (label: string, value: string) => act(() => renderer!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onChangeText === 'function')[0].props.onChangeText(value));
    const select = (currentName: string, next: Board) => { press(`当前板子 ${currentName}，点击更换`); press(`选择板子：${next.name}`); };
    const text = () => renderer!.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
    return { onStart, press, fill, select, button, text };
  }

  it('uses merged board rules in review, opening script and the actual game', () => {
    const base: Rules = { ...DEFAULT_RULES, sheriff: false, speechSeconds: 120, table: { guardRepeat: true }, flow: { keepDeadCalls: true, scripts: { 'exile-vote': '本桌投票' } } };
    const app = mount(undefined, undefined, base);
    app.select(source.name, presetBoard);
    app.press('下一步');
    expect(app.button('女巫自救 不可').props.accessibilityState.selected).toBe(true);
    app.press('预览开场宣读');
    expect(app.text()).toContain('专项规则宣读');
    expect(app.text()).toContain('每位玩家发言 120 秒');
    app.press('完成宣读'); app.press('下一步'); app.press('开始主持');
    expect(app.onStart).toHaveBeenCalledTimes(1);
    expect(app.onStart.mock.calls[0][0].rules).toMatchObject({
      sheriff: false, selfSave: 'never', speechSeconds: 120,
      table: { guardRepeat: true, sheriffTie: 'pk', notes: '专项规则宣读' },
      flow: { keepDeadCalls: true, manualDawn: true, scripts: { discussion: '专项板子发言', 'exile-vote': '本桌投票' }, nightOrder: ['seer', 'wolves', 'witch'] },
    });
  });

  it('removes previous board defaults while preserving starting profile rules and explicit host edits', () => {
    const initial: HostingProfile = {
      id: 'starting-profile', name: '原方案', boardName: '原阵容', roles: boardSeats(source),
      rules: { ...DEFAULT_RULES, sheriff: false, speechSeconds: 120, table: { guardRepeat: true, notes: '原方案约定' }, flow: { keepDeadCalls: true, scripts: { discussion: '原方案发言' } } },
    };
    const app = mount(initial);
    app.select(initial.boardName, presetBoard); app.press('下一步');
    app.press('胜负条件 屠城'); app.press('展开更多桌规');
    app.fill('本桌补充约定', '主持人修改的约定');
    app.press('自定义主持流程'); app.press('发言时长 180 秒'); app.press('完成流程设置');
    app.press('上一步'); app.select(presetBoard.name, source);
    app.press('下一步'); app.press('下一步'); app.press('开始主持');
    const actual = app.onStart.mock.calls[0][0].rules;
    expect(actual).toMatchObject({ sheriff: false, selfSave: 'first', win: 'all', speechSeconds: 180, table: { guardRepeat: true, notes: '主持人修改的约定' }, flow: { keepDeadCalls: true, scripts: { discussion: '原方案发言' } } });
    expect(actual.flow.manualDawn).toBeUndefined();
    expect(actual.table.sheriffTie).toBeUndefined();
  });

  it('does not retain inferred special-role review flags after editing an unrelated workflow setting', () => {
    const initial: HostingProfile = { id: 'dreamer-profile', name: '摄梦方案', boardName: '摄梦阵容', roles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'dreamer'], rules: DEFAULT_RULES };
    const app = mount(initial);
    app.press('下一步'); app.press('展开更多桌规'); app.press('自定义主持流程');
    app.press('发言时长 180 秒'); app.press('完成流程设置');
    app.press('上一步'); app.select(initial.boardName, source);
    app.press('下一步'); app.press('下一步'); app.press('开始主持');
    expect(app.onStart.mock.calls[0][0].rules.speechSeconds).toBe(180);
    expect(app.onStart.mock.calls[0][0].rules.flow?.manualDawn).toBeUndefined();
    expect(app.onStart.mock.calls[0][0].rules.flow?.manualVictory).toBeUndefined();
  });

  it('saves the selected board ID and the exact applied rules', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const app = mount(undefined, save);
    app.fill('方案名称', '规则来源方案'); app.select(source.name, presetBoard); app.press('下一步');
    await act(async () => { app.press('保存方案并设为默认'); await Promise.resolve(); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({ sourceBoardId: presetBoard.id, boardName: presetBoard.name, roles: boardSeats(source), rules: { selfSave: 'never', table: { notes: '专项规则宣读' }, flow: { manualDawn: true, nightOrder: ['seer', 'wolves', 'witch'] } } });
  });

  it('drops source metadata after changing the custom lineup', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const initial: HostingProfile = { id: 'source-plan', name: '来源方案', boardName: source.name, roles: boardSeats(source), rules: DEFAULT_RULES, sourceBoardId: source.id };
    const app = mount(initial, save);
    app.press('自定义人数和角色'); app.press('减少狼人'); app.press('增加村民'); app.press('用这套阵容'); app.press('下一步');
    await act(async () => { app.press('保存方案并设为默认'); await Promise.resolve(); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].sourceBoardId).toBeUndefined();
    expect(save.mock.calls[0][0].roles.filter((role: string) => role === 'wolf')).toHaveLength(3);
  });

  it('keeps the explicit source through seat swaps and a board-name edit without changing counts', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const initial: HostingProfile = { id: 'reordered-source', name: '来源互换方案', boardName: source.name, roles: [...boardSeats(source)].reverse(), rules: DEFAULT_RULES, sourceBoardId: source.id };
    const app = mount(initial, save);
    app.press('自定义人数和角色'); app.fill('板子名称', '重新命名的同阵容'); app.press('用这套阵容'); app.press('下一步');
    await act(async () => { app.press('保存方案并设为默认'); await Promise.resolve(); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({ sourceBoardId: source.id, boardName: '重新命名的同阵容' });
    expect(save.mock.calls[0][0].roles.slice().sort()).toEqual(initial.roles.slice().sort());
  });
});
