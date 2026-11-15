import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { applyAction, createGame } from '../src/game/engine';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import type { Game } from '../src/game/types';
import { HistoryScreen } from '../src/ui/HistoryScreen';
import { HomeScreen } from '../src/ui/HomeScreen';
import { MotionProvider } from '../src/ui/motion';

function finishedGame(name: string): Game {
  const board = BOARD_LIBRARY[0];
  const active = createGame(name, board.name, boardSeats(board).map(role => ({ name: '', role })), DEFAULT_RULES);
  return applyAction(active, { type: 'finish', winner: 'good', reason: '测试结束' });
}

describe('history direct-open flow', () => {
  it('passes the selected game id from the home history row', () => {
    const game = finishedGame('目标复盘');
    const onHistory = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <MotionProvider>
          <HomeScreen
            session={null}
            history={[game]}
            hostingMode="standard"
            disabled={false}
            onPersonalize={jest.fn()}
            onNew={jest.fn()}
            onResume={jest.fn()}
            onHistory={onHistory}
            onUndo={jest.fn()}
          />
        </MotionProvider>,
      );
    });

    const row = renderer.root.findAll(node => node.props.accessibilityLabel === `复盘 ${game.name}` && typeof node.props.onPress === 'function')[0];
    act(() => row.props.onPress());

    expect(onHistory).toHaveBeenCalledWith(game.id);
    act(() => renderer.unmount());
  });

  it('opens the requested recap immediately when history mounts', () => {
    const game = finishedGame('直达复盘');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<HistoryScreen games={[game]} initialOpenId={game.id} onBack={jest.fn()} />);
    });

    const sheet = renderer.root.findAll(node => node.props.title === game.name && node.props.visible === true)[0];
    expect(sheet).toBeDefined();
    act(() => renderer.unmount());
  });
});
