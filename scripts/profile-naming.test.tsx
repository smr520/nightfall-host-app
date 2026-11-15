import React from 'react';
import { ScrollView, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import type { HostingProfile } from '../src/game/preferences';
import { SetupScreen } from '../src/ui/SetupScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

type ProfileDraft = Omit<HostingProfile, 'id'>;
const selected: HostingProfile = {
  id: 'named-table', name: '周末固定局', boardName: '六人阵容',
  roles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'], rules: DEFAULT_RULES,
};

function pendingSave() {
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((_resolve, fail) => { reject = fail; });
  return { promise, reject };
}

describe('hosting profile name entry', () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  beforeEach(() => jest.clearAllMocks());

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
    renderer = undefined;
  });

  function mount(initialProfile?: HostingProfile, save = jest.fn<Promise<void>, [ProfileDraft]>().mockResolvedValue(undefined)) {
    const nodeFocus = jest.fn();
    const nodeScrollTo = jest.fn();
    act(() => {
      renderer = TestRenderer.create(<SetupScreen mode="custom" initialProfile={initialProfile} initialRules={initialProfile?.rules ?? DEFAULT_RULES} onBack={jest.fn()} onStart={jest.fn()} onSaveProfile={save} />, {
        createNodeMock: () => ({ focus: nodeFocus, scrollTo: nodeScrollTo }),
      });
    });
    const field = () => renderer!.root.findAll(node => node.props.accessibilityLabel === '方案名称' && typeof node.props.onChangeText === 'function')[0];
    const button = (label: string) => renderer!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
    const press = (label: string) => {
      const control = button(label);
      if (!control) throw new Error(`Missing button: ${label}`);
      act(() => { if (!control.props.disabled) control.props.onPress(); });
    };
    const fill = (value: string) => act(() => field().props.onChangeText(value));
    const text = () => renderer!.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
    // RN's preset supplies class-instance refs; createNodeMock covers host refs.
    const focus = (field().instance?.focus ?? nodeFocus) as jest.Mock;
    const scrollTo = (renderer!.root.findAllByType(ScrollView)[0].instance?.scrollTo ?? nodeScrollTo) as jest.Mock;
    scrollTo.mockClear();
    return { field, button, press, fill, text, save, focus, scrollTo };
  }

  it('places the required name before board selection without opening the keyboard on entry', () => {
    const app = mount();
    const entries = renderer!.root.findAll(node => typeof node.props.onChangeText === 'function' || typeof node.props.onPress === 'function');
    const namePosition = entries.findIndex(node => node.props.accessibilityLabel === '方案名称');
    const boardPosition = entries.findIndex(node => node.props.accessibilityLabel === `当前板子 ${BOARD_LIBRARY[0].name}，点击更换`);
    expect(namePosition).toBeGreaterThanOrEqual(0);
    expect(boardPosition).toBeGreaterThan(namePosition);
    expect(app.text()).toContain('必填');
    expect(app.field().props.maxLength).toBe(24);
    expect(app.field().props.autoFocus).not.toBe(true);
    expect(app.focus).not.toHaveBeenCalled();
  });

  it.each(['', '   '])('keeps an invalid name %j on the first step and brings its input into focus', value => {
    const app = mount();
    app.fill(value);
    app.press('下一步');
    expect(app.button('保存方案并设为默认')).toBeUndefined();
    expect(app.button('自定义人数和角色')).toBeDefined();
    expect(app.text()).toContain('请填写方案名称');
    expect(app.focus).toHaveBeenCalled();
    expect(app.scrollTo).toHaveBeenCalled();
    expect(app.save).not.toHaveBeenCalled();
    app.fill('周六朋友局');
    expect(app.text()).not.toContain('请填写方案名称');
    app.press('下一步');
    expect(app.button('保存方案并设为默认')).toBeDefined();
    expect(app.field().props.value).toBe('周六朋友局');
  });

  it('keeps the name editable on the rules step and saves a trimmed name', async () => {
    const app = mount(selected);
    expect(app.field().props.value).toBe(selected.name);
    app.press('下一步');
    expect(app.field().props.value).toBe(selected.name);
    app.fill('  今晚无警长局  ');
    await act(async () => { app.press('保存方案并设为默认'); await Promise.resolve(); });
    expect(app.save).toHaveBeenCalledTimes(1);
    expect(app.save.mock.calls[0][0]).toMatchObject({ name: '今晚无警长局', boardName: selected.boardName, roles: selected.roles });
  });

  it('repairs a cleared name on the rules step without losing the selected rules', async () => {
    const app = mount(selected);
    app.press('下一步');
    app.press('胜负条件 屠城');
    app.fill(' ');
    app.press('保存方案并设为默认');
    expect(app.save).not.toHaveBeenCalled();
    expect(app.text()).toContain('请填写方案名称');
    expect(app.button('胜负条件 屠城').props.accessibilityState.selected).toBe(true);
    expect(app.field()).toBeDefined();
    expect(app.focus).toHaveBeenCalled();
    app.fill('修正后的方案');
    expect(app.text()).not.toContain('请填写方案名称');
    await act(async () => { app.press('保存方案并设为默认'); await Promise.resolve(); });
    expect(app.save.mock.calls[0][0]).toMatchObject({ name: '修正后的方案', rules: { win: 'all' } });
  });

  it('prevents same-tick duplicate saves and permits retry after a failed write', async () => {
    const pending = pendingSave();
    const save = jest.fn<Promise<void>, [ProfileDraft]>().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
    const app = mount(selected, save);
    app.press('下一步');
    app.press('胜负条件 屠城');
    app.fill('失败后保留的方案');
    const submit = app.button('保存方案并设为默认').props.onPress;
    act(() => { submit(); submit(); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(app.button('正在保存方案…').props.disabled).toBe(true);
    await act(async () => { pending.reject(new Error('disk full')); await Promise.resolve(); });
    expect(app.text()).toContain('你的修改仍保留在这里');
    expect(app.field().props.value).toBe('失败后保留的方案');
    expect(app.button('保存方案并设为默认').props.disabled).toBe(false);
    await act(async () => { app.press('保存方案并设为默认'); await Promise.resolve(); });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ name: '失败后保留的方案', roles: selected.roles, rules: { win: 'all' } });
  });
});
