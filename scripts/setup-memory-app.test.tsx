import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { clearSession, persistPreferences, persistSession, readHistory, readPreferences, readSession } from '../src/storage';
import type { Session } from '../src/game/types';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, SafeAreaView: View };
});
jest.mock('../src/storage', () => ({
  clearSession: jest.fn().mockResolvedValue(undefined), clearDamagedSession: jest.fn().mockResolvedValue(undefined), persistSession: jest.fn().mockResolvedValue(undefined), retryPersistSession: jest.fn().mockResolvedValue(undefined),
  readHistory: jest.fn(), readSession: jest.fn(), readPreferences: jest.fn().mockResolvedValue({ hostingMode: 'standard' }), persistPreferences: jest.fn().mockResolvedValue(undefined), readAppRole: jest.fn().mockResolvedValue('host'), persistAppRole: jest.fn().mockResolvedValue(undefined), getWarnings: jest.fn(() => []), exportRawData: jest.fn().mockResolvedValue('{}'),
}));

describe('remembered setup through the app', () => {
  jest.setTimeout(30000);
  const flush = async () => {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(readSession).mockResolvedValue(null);
    jest.mocked(readHistory).mockResolvedValue([]);
    jest.mocked(readPreferences).mockResolvedValue({ hostingMode: 'standard' });
    jest.mocked(persistPreferences).mockResolvedValue(undefined);
    jest.mocked(persistSession).mockResolvedValue(undefined);
  });
  afterEach(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  });

  async function mountApp() {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<App />); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const buttons = () => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
    const button = (label: string) => {
      const match = buttons().find(node => node.props.accessibilityLabel === label);
      if (!match) throw new Error(`Missing button ${label}`);
      return match;
    };
    const press = (label: string) => act(() => { const match = button(label); if (!match.props.disabled) match.props.onPress(); });
    const field = (label: string) => {
      const match = renderer.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onChangeText === 'function')[0];
      if (!match) throw new Error(`Missing field ${label}`);
      return match;
    };
    const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
    return { renderer, button, press, field, text };
  }

  it('saves the first completed setup and starts the next game from it in one step', async () => {
    const first = await mountApp();
    first.press('新建一场对局');
    act(() => first.field('对局名称').props.onChangeText('复用测试局'));
    first.press('下一步');
    first.press('胜负条件 屠城');
    first.press('下一步');
    act(() => first.field('1号玩家姓名').props.onChangeText('阿明'));
    first.press('开始主持');
    await flush();

    const remembered = jest.mocked(persistPreferences).mock.calls.at(-1)?.[0];
    expect(remembered?.lastSetup).toMatchObject({
      boardName: BOARD_LIBRARY[0].name,
      gameName: '复用测试局',
      rules: { win: 'all' },
    });
    expect(remembered?.lastSetup?.playerNames[0]).toBe('阿明');
    act(() => first.renderer.unmount());

    jest.mocked(readPreferences).mockResolvedValue(remembered!);
    const second = await mountApp();
    expect(second.text()).toContain('上次开局已记住');
    expect(second.text()).toContain(BOARD_LIBRARY[0].name);
    second.press('按上次设置直接开局');
    await flush();

    const session = jest.mocked(persistSession).mock.calls.at(-1)?.[0] as Session;
    expect(session.current.name).toBe('复用测试局');
    expect(session.current.players[0].name).toBe('阿明');
    expect(session.current.players.map(player => player.role)).toEqual(remembered!.lastSetup!.roles);
    expect(session.current.rules.win).toBe('all');
    act(() => second.renderer.unmount());
  });

  it('confirms before replacing an active game and then reuses the remembered setup', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const first = await mountApp();
    first.press('新建一场对局');
    first.press('下一步'); first.press('下一步'); first.press('开始主持');
    await flush();
    const firstId = (jest.mocked(persistSession).mock.calls.at(-1)?.[0] as Session).current.id;
    first.press('返回');
    await flush();
    expect(first.text()).toContain('上次开局已记住');
    first.press('按上次设置直接开局');
    const confirm = alert.mock.calls.at(-1)?.[2]?.find(item => item.text === '放弃并新开');
    expect(confirm).toBeDefined();
    await act(async () => { confirm?.onPress?.(); });
    await flush();

    expect(clearSession).toHaveBeenCalled();
    const session = jest.mocked(persistSession).mock.calls.at(-1)?.[0] as Session;
    expect(session.current.id).not.toBe(firstId);
    expect(session.current.name).toBe('周末局');
    expect(session.current.players.map(player => player.role)).toEqual(boardSeats(BOARD_LIBRARY[0]));
    alert.mockRestore();
    act(() => first.renderer.unmount());
  });
});
