import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import type { SetupMemory } from '../src/game/setup-memory';
import type { Rules } from '../src/game/types';
import { HomeScreen } from '../src/ui/HomeScreen';
import { MotionProvider } from '../src/ui/motion';
import { SetupScreen } from '../src/ui/SetupScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const source = BOARD_LIBRARY.find(board => board.id === '9-classic')!;
const roles = boardSeats(source);
const rules: Rules = { ...DEFAULT_RULES, sheriff: false, win: 'all', speechSeconds: 150, table: { notes: '上次约定' } };
const setup: SetupMemory = {
  version: 1,
  mode: 'standard',
  boardId: source.id,
  boardName: source.name,
  roles,
  rules,
  playerNames: roles.map((_, index) => index < 2 ? `玩家${index + 1}` : ''),
  gameName: '上次周五局',
  savedAt: 1,
};

function mountSetup(onStart: jest.Mock, onBack = jest.fn()) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<SetupScreen mode="standard" initialRules={DEFAULT_RULES} initialSetup={setup} onBack={onBack} onStart={onStart} />);
  });
  const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const press = (label: string) => {
    const node = button(label);
    if (!node) throw new Error(`Missing button ${label}`);
    act(() => { if (!node.props.disabled) node.props.onPress(); });
  };
  const field = (label: string) => renderer.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onChangeText === 'function')[0];
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  return { renderer, button, press, field, text, unmount: () => act(() => renderer.unmount()) };
}

function mountHome(lastSetup: SetupMemory | undefined) {
  const onRepeat = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <MotionProvider>
        <HomeScreen session={null} history={[]} hostingMode="standard" lastSetup={lastSetup} disabled={false} onPersonalize={jest.fn()} onNew={jest.fn()} onRepeat={onRepeat} onResume={jest.fn()} onHistory={jest.fn()} onUndo={jest.fn()} />
      </MotionProvider>,
    );
  });
  const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  return { renderer, button, text, onRepeat, unmount: () => act(() => renderer.unmount()) };
}

describe('remembered setup in the interface', () => {
  it('prefills the board, rules and player names from the last game', () => {
    const onStart = jest.fn();
    const app = mountSetup(onStart);
    expect(app.text()).toContain('已带入上次开局设置');
    expect(app.button(`当前板子 ${source.name}，点击更换`)).toBeDefined();
    expect(app.field('对局名称').props.value).toBe('上次周五局');
    app.press('下一步'); app.press('下一步');
    expect(app.field('1号玩家姓名').props.value).toBe('玩家1');
    expect(app.field('2号玩家姓名').props.value).toBe('玩家2');

    expect(app.button('直接开始')).toBeUndefined();
    app.press('开始主持');
    const game = onStart.mock.calls[0][0];
    const remembered = onStart.mock.calls[0][1] as SetupMemory;
    expect(game.name).toBe('上次周五局');
    expect(game.players.map((player: { role: string }) => player.role).sort()).toEqual([...roles].sort());
    expect(game.players[0].name).toBe('玩家1');
    expect(game.players[2].name).toBe('3号玩家');
    expect(game.rules.speechSeconds).toBe(150);
    expect(game.rules.win).toBe('all');
    expect(remembered.boardId).toBe(source.id);
    expect(remembered.playerNames.slice(0, 2)).toEqual(['玩家1', '玩家2']);
    app.unmount();
  });

  it('can clear the memory and start from a blank standard setup', () => {
    const onStart = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find(button => button.text === '从头设置')?.onPress?.();
    });
    const app = mountSetup(onStart);
    app.press('从头设置');
    expect(app.text()).not.toContain('已带入上次开局设置');
    expect(app.button(`当前板子 ${BOARD_LIBRARY[0].name}，点击更换`)).toBeDefined();
    app.press('下一步'); app.press('下一步');
    expect(app.field('1号玩家姓名').props.value).toBe('');
    app.press('开始主持');
    expect(onStart.mock.calls[0][0].players.map((player: { role: string }) => player.role).sort()).toEqual([...boardSeats(BOARD_LIBRARY[0])].sort());
    alert.mockRestore();
    app.unmount();
  });

  it('shows the last setup on the home screen and opens setup for reconfirmation', () => {
    const app = mountHome(setup);
    expect(app.text()).toContain('上次开局已记住');
    expect(app.text()).toContain(source.name);
    expect(app.text()).toContain('发言 150 秒');
    const repeat = app.button('沿用上次设置，重新确认');
    expect(repeat).toBeDefined();
    act(() => repeat.props.onPress());
    expect(app.onRepeat).toHaveBeenCalledTimes(1);
    app.unmount();
  });

  it('keeps the normal new-game path before any setup has been remembered', () => {
    const app = mountHome(undefined);
    expect(app.text()).not.toContain('上次开局已记住');
    expect(app.button('新建一场对局')).toBeDefined();
    expect(app.button('沿用上次设置，重新确认')).toBeUndefined();
    app.unmount();
  });
});
