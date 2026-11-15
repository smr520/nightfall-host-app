import React from 'react';
import * as Native from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { createGame } from '../src/game/engine';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { SeatGrid } from '../src/ui/kit';

function fixture() {
  const board = BOARD_LIBRARY[0];
  const game = createGame('设备布局回归', board.name, boardSeats(board).map(role => ({ name: '', role })), DEFAULT_RULES);
  game.players[0] = { ...game.players[0], alive: false, death: { day: 1, cause: 'exile' } };
  return game;
}

describe('seat controls under device layout and eligibility changes', () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  afterEach(() => { if (renderer) act(() => renderer?.unmount()); renderer = undefined; jest.restoreAllMocks(); });

  it('keeps eliminated seats disabled while multiple living seats are selected', () => {
    act(() => { renderer = TestRenderer.create(<SeatGrid game={fixture()} selected={null} multi={[2]} onSelect={jest.fn()} showRoles={false} />); });
    const dead = renderer!.root.findAll(node => node.props.accessibilityLabel === '1号 出局' && typeof node.props.onPress === 'function')[0];
    expect(dead.props.disabled).toBe(true);
    expect(dead.props.accessibilityState.disabled).toBe(true);
  });

  it('allows eliminated seats only when the caller explicitly permits them', () => {
    act(() => { renderer = TestRenderer.create(<SeatGrid game={fixture()} selected={null} multi={[2]} onSelect={jest.fn()} showRoles={false} tapDead />); });
    const dead = renderer!.root.findAll(node => node.props.accessibilityLabel === '1号 出局' && typeof node.props.onPress === 'function')[0];
    expect(dead.props.disabled).toBe(false);
  });

  it('uses one column in a narrow window with large system text instead of squeezing two columns', () => {
    jest.spyOn(Native, 'useWindowDimensions').mockReturnValue({ width: 188, height: 740, scale: 2, fontScale: 1.8 });
    act(() => { renderer = TestRenderer.create(<SeatGrid game={fixture()} selected={null} onSelect={jest.fn()} showRoles={false} />); });
    const container = renderer!.root.findAll(node => typeof node.props.onLayout === 'function')[0];
    act(() => container.props.onLayout({ nativeEvent: { layout: { width: 140, height: 500, x: 0, y: 0 } } }));
    const seat = renderer!.root.findAll(node => node.props.accessibilityLabel === '2号 存活' && typeof node.props.onPress === 'function')[0];
    const styles = typeof seat.props.style === 'function' ? seat.props.style({ pressed: false }) : seat.props.style;
    expect(Native.StyleSheet.flatten(styles).width).toBe(140);
  });
});
