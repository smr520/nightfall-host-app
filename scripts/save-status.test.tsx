import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { createGame } from '../src/game/engine';
import type { Session } from '../src/game/types';
import { HomeScreen } from '../src/ui/HomeScreen';
import { MotionProvider } from '../src/ui/motion';

function session(): Session {
  const board = BOARD_LIBRARY[0];
  const game = createGame(
    '保存状态测试',
    board.name,
    boardSeats(board).map(role => ({ name: '', role })),
    DEFAULT_RULES,
  );
  return { current: game, undo: [], redo: [] };
}

function mount(props: {
  saving?: boolean;
  saveError?: string;
  lastSavedAt?: number;
}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <MotionProvider>
        <HomeScreen
          session={session()}
          history={[]}
          hostingMode="standard"
          disabled={false}
          {...props}
          onPersonalize={jest.fn()}
          onNew={jest.fn()}
          onResume={jest.fn()}
          onHistory={jest.fn()}
          onUndo={jest.fn()}
        />
      </MotionProvider>,
    );
  });
  return renderer;
}

function text(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
}

describe('home save status', () => {
  it('never claims the latest state is saved while a write is pending', () => {
    const renderer = mount({ saving: true });
    expect(text(renderer)).toContain('正在保存，请保持应用打开');
    expect(text(renderer)).not.toContain('已自动保存到本机');
    act(() => renderer.unmount());
  });

  it('shows a blocking save failure instead of a success label', () => {
    const renderer = mount({ saveError: 'disk full' });
    expect(text(renderer)).toContain('保存失败，请先重试保存');
    expect(text(renderer)).not.toContain('已自动保存到本机');
    act(() => renderer.unmount());
  });

  it('shows the last confirmed save time after a successful write', () => {
    const renderer = mount({ lastSavedAt: new Date('2026-11-15T12:35:00+08:00').getTime() });
    expect(text(renderer)).toContain('已保存');
    act(() => renderer.unmount());
  });
});
