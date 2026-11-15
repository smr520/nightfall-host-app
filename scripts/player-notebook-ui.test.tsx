import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { boardRoles, boardById } from '../src/game/boards';
import type { Role } from '../src/game/roles';
import { PlayerScreen } from '../src/ui/player/PlayerScreen';
import { MotionProvider } from '../src/ui/motion';
import { createPlayerNotebookStorage, PLAYER_NOTEBOOK_KEY, type PlayerNotebookStorage } from '../src/player/storage';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { data.set(key, value); },
    async removeItem(key: string) { data.delete(key); },
    data,
  };
}

const flattenText = (value: unknown): string => Array.isArray(value) ? value.map(flattenText).join('') : value == null ? '' : String(value);

async function mountWithStorage(storage: PlayerNotebookStorage, onSwitchRole?: () => void, onOpenReference?: (context: { roles: Role[]; initialRole?: Role }) => void) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<MotionProvider><PlayerScreen storage={storage} onSwitchRole={onSwitchRole} onOpenReference={onOpenReference} /></MotionProvider>);
    await Promise.resolve();
  });
  const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const press = (label: string) => {
    const node = button(label);
    if (!node) throw new Error(`Missing button ${label}`);
    act(() => { if (!node.props.disabled) node.props.onPress(); });
  };
  const field = (label: string) => renderer.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onChangeText === 'function')[0];
  const type = (label: string, value: string) => {
    const node = field(label);
    if (!node) throw new Error(`Missing field ${label}`);
    act(() => node.props.onChangeText(value));
  };
  const text = () => renderer.root.findAllByType(Text).map(node => flattenText(node.props.children)).join('\n');
  const unmount = () => act(() => renderer.unmount());
  return { renderer, storage, button, press, field, type, text, unmount };
}

async function mountPlayer(onSwitchRole?: () => void) {
  const kv = memoryStore();
  const storage = createPlayerNotebookStorage(kv);
  const app = await mountWithStorage(storage, onSwitchRole);
  return { ...app, kv };
}

describe('玩家笔记界面', () => {
  it('建立自己的记录、标记座位并保存票型', async () => {
    const player = await mountPlayer();
    expect(player.text()).toContain('先选本，再记你的身份');
    expect(player.text()).toContain('本局板子');
    expect(player.text()).toContain('你的座位');

    player.press('我的座位 5 号');
    player.press('选择身份');
    player.press('选择身份 预言家');
    player.press('开始记录');

    expect(player.text()).toContain('座位判断');
    expect(player.text()).toContain('我是 5 号');
    expect(player.text()).toContain('预言家');

    player.press('记一次');
    expect(player.button('技能 查验')).toBeDefined();
    expect(player.button('技能 解药')).toBeUndefined();
    player.press('关闭');

    player.press('3号，未知');
    player.press('标记为疑似狼');
    player.press('完成');
    expect(player.button('3号，疑似狼')).toBeDefined();

    player.press('记一票');
    player.press('投票人 4 号');
    player.press('得票人 7 号');
    player.press('保存这一票');
    expect(player.text()).toContain('4 号 → 7 号');

    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    const saved = await player.storage.read();
    expect(saved?.ownSeat).toBe(5);
    expect(saved?.ownRole).toBe('seer');
    expect(saved?.boardId).toBe('standard-12');
    expect(saved?.boardName).toBe('预女猎白');
    expect(saved?.seatNotes[3].mark).toBe('wolf');
    expect(saved?.votes[0]).toMatchObject({ voter: 4, target: 7 });

    player.unmount();
    let restored!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      restored = TestRenderer.create(<MotionProvider><PlayerScreen storage={player.storage} /></MotionProvider>);
      await Promise.resolve();
    });
    const restoredText = restored.root.findAllByType(Text).map(node => flattenText(node.props.children)).join('\n');
    expect(restoredText).toContain('4 号 → 7 号');
    expect(restoredText).toContain('预言家');
    act(() => restored.unmount());
  });

  it('记录具体身份猜测、事件速记和自己的技能使用', async () => {
    const player = await mountPlayer();
    player.press('我的座位 2 号');
    player.press('选择身份');
    player.press('选择身份 女巫');
    player.press('开始记录');

    player.press('5号，未知');
    player.press('编辑这个座位的身份');
    expect(player.button('具体身份 月神预言家')).toBeUndefined();
    player.press('具体身份 预言家');
    expect(player.button('5号，疑似神，猜测预言家')).toBeDefined();
    player.press('完成');

    player.press('记一条');
    player.press('事件类型 白天信息');
    player.type('事件内容', '5 号跳预言家，查杀 7 号');
    player.press('保存事件');
    expect(player.text()).toContain('第 1 天 · 白天信息');
    expect(player.text()).toContain('5 号跳预言家，查杀 7 号');

    player.press('记一次');
    player.press('技能 解药');
    player.press('技能目标 4 号');
    player.type('技能结果', '救回 4 号');
    player.press('保存技能记录');
    expect(player.text()).toContain('第 1 轮 · 解药 → 4 号');
    expect(player.text()).toContain('救回 4 号');

    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    const saved = await player.storage.read();
    expect(saved?.seatNotes[5]).toMatchObject({ mark: 'god', roleGuess: 'seer' });
    expect(saved?.events[0]).toMatchObject({ round: 1, phase: 'day', text: '5 号跳预言家，查杀 7 号' });
    expect(saved?.skillUses[0]).toMatchObject({ round: 1, skill: '解药', target: 4, result: '救回 4 号' });

    player.unmount();
  });

  it('创建后查看规则时仍只带当前板子的角色', async () => {
    const onOpenReference = jest.fn();
    const storage = createPlayerNotebookStorage(memoryStore());
    const player = await mountWithStorage(storage, undefined, onOpenReference);
    player.press('我的座位 4 号');
    player.press('选择身份');
    player.press('选择身份 预言家');
    player.press('开始记录');
    player.press('规则');

    const standard = boardById('standard-12')!;
    expect(onOpenReference).toHaveBeenLastCalledWith(expect.objectContaining({ roles: boardRoles(standard), initialRole: 'seer' }));
    player.unmount();
  });

  it('把座位标记出局，同时保留并编辑该座位的身份判断', async () => {
    const player = await mountPlayer();
    player.press('我的座位 2 号');
    player.press('选择身份');
    player.press('选择身份 预言家');
    player.press('开始记录');

    player.press('4号，未知');
    player.press('编辑这个座位的身份');
    player.press('具体身份 女巫');
    player.press('标记 4 号出局');
    expect(player.button('恢复 4 号为在场')).toBeDefined();
    player.press('完成');

    expect(player.button('4号，疑似神，猜测女巫，已出局')).toBeDefined();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    const saved = await player.storage.read();
    expect(saved?.seatNotes[4]).toMatchObject({ mark: 'god', roleGuess: 'witch', eliminated: true });

    player.press('4号，疑似神，猜测女巫，已出局');
    player.press('恢复 4 号为在场');
    expect(player.button('标记 4 号出局')).toBeDefined();
    player.press('完成');
    expect(player.button('4号，疑似神，猜测女巫')).toBeDefined();
    player.unmount();
  });

  it('切回主持前先保存最后一次座位修改', async () => {
    const onSwitchRole = jest.fn();
    const player = await mountPlayer(onSwitchRole);
    player.press('我的座位 2 号');
    player.press('选择身份');
    player.press('选择身份 女巫');
    player.press('开始记录');

    player.press('4号，未知');
    player.press('标记为疑似狼');
    player.press('主持');
    expect(onSwitchRole).toHaveBeenCalledTimes(1);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const saved = await player.storage.read();
    expect(saved?.seatNotes[4].mark).toBe('wolf');
    player.unmount();
  });

  it('修改自己的身份和座位时保留已有座位记录', async () => {
    const player = await mountPlayer();
    player.press('我的座位 2 号');
    player.press('选择身份');
    player.press('选择身份 女巫');
    player.press('开始记录');
    player.press('4号，未知');
    player.press('标记为疑似狼');
    player.press('完成');

    player.press('编辑');
    expect(player.text()).toContain('编辑基本信息');
    player.type('对局名称', '改过的局');
    player.press('我的座位 7 号');
    player.press('更换身份');
    player.press('选择身份 预言家');
    player.press('保存基本信息');

    expect(player.text()).toContain('改过的局');
    expect(player.text()).toContain('我是 7 号');
    expect(player.text()).toContain('预言家');

    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    const saved = await player.storage.read();
    expect(saved?.gameName).toBe('改过的局');
    expect(saved?.ownSeat).toBe(7);
    expect(saved?.ownRole).toBe('seer');
    expect(saved?.seatNotes[4].mark).toBe('wolf');
    player.unmount();
  });

  it('损坏的玩家笔记不会静默覆盖，清除后回到设置页', async () => {
    const kv = memoryStore({ [PLAYER_NOTEBOOK_KEY]: '{"version":1,"broken":true}' });
    const storage = createPlayerNotebookStorage(kv);
    const player = await mountWithStorage(storage);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

    expect(player.text()).toContain('结构不兼容');
    expect(player.button('重试读取')).toBeDefined();
    const alert = jest.spyOn(Alert, 'alert');
    player.press('清除损坏记录');
    const clearAction = alert.mock.calls.at(-1)?.[2]?.find(item => item.text === '清除');
    expect(clearAction).toBeDefined();
    await act(async () => { clearAction?.onPress?.(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

    expect(player.text()).toContain('先选本，再记你的身份');
    expect(kv.data.has(PLAYER_NOTEBOOK_KEY)).toBe(false);
    alert.mockRestore();
    player.unmount();
  });

  it('清除笔记后，未到自动保存时间的修改不会把旧记录写回来', async () => {
    const kv = memoryStore();
    const base = createPlayerNotebookStorage(kv);
    const delayedClear: PlayerNotebookStorage = {
      read: () => base.read(),
      persist: notebook => base.persist(notebook),
      clear: () => new Promise<void>((resolve, reject) => {
        setTimeout(() => { base.clear().then(resolve, reject); }, 300);
      }),
    };
    const player = await mountWithStorage(delayedClear);
    player.press('我的座位 2 号');
    player.press('选择身份');
    player.press('选择身份 女巫');
    player.press('开始记录');
    player.press('4号，未知');
    player.press('标记为疑似狼');

    const alert = jest.spyOn(Alert, 'alert');
    player.press('清除本局笔记');
    const clearAction = alert.mock.calls.at(-1)?.[2]?.find(item => item.text === '清除');
    expect(clearAction).toBeDefined();
    await act(async () => { clearAction?.onPress?.(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 500)); });

    expect(await base.read()).toBeNull();
    expect(player.text()).toContain('先选本，再记你的身份');
    alert.mockRestore();
    player.unmount();
  });

  it('没有记录时显示设置页，不读取主持人的对局', async () => {
    const player = await mountPlayer();
    expect(player.text()).toContain('只保存在本机');
    expect(player.text()).toContain('不会读取主持人的对局');
    player.unmount();
  });
});
