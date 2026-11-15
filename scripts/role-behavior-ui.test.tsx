import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_RULES } from '../src/game/config';
import { createGame } from '../src/game/engine';
import type { Role } from '../src/game/types';
import { GameScreen } from '../src/ui/GameScreen';
import { SeatGrid, Sheet } from '../src/ui/kit';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

describe('host actions follow the specific card', () => {
  it.each([false, true])('excludes a gargoyle from self-explosion while preserving host rulings (onlyGargoyle=%s)', onlyGargoyle => {
    const roles: Role[] = ['gargoyle', 'wolf', 'villager', 'villager', 'seer', 'witch'];
    const game = createGame('自爆资格', '六人', roles.map(role => ({ name: '', role })), { ...DEFAULT_RULES, sheriff: false });
    game.stage = 'discussion';
    if (onlyGargoyle) game.players[1] = { ...game.players[1], alive: false, death: { day: 1, cause: 'exile' } };
    const dispatch = jest.fn(() => true);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<GameScreen game={game} canUndo={false} canRedo={false} error="" selectionRevision={0} onBack={jest.fn()} onUndo={jest.fn()} onRedo={jest.fn()} onReset={jest.fn()} dispatch={dispatch} />); });
    const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
    act(() => button('自爆 / 人工裁定').props.onPress());
    const tools = renderer.root.findAllByType(Sheet).find(node => node.props.title === '自爆与人工裁定')!;
    const grids = tools.findAllByType(SeatGrid);
    const explosionButtons = grids[0].findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
    expect(explosionButtons.some(node => String(node.props.accessibilityLabel).startsWith('1号'))).toBe(false);
    const rulingButtons = grids[1].findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
    expect(rulingButtons.some(node => String(node.props.accessibilityLabel).startsWith('1号'))).toBe(true);
    if (onlyGargoyle) {
      expect(explosionButtons).toHaveLength(0);
      expect(tools.findAllByType(Text).map(node => String(node.props.children)).join('\n')).toContain('当前没有可自爆的狼人');
      expect(button('先选择自爆的狼人').props.disabled).toBe(true);
    } else {
      const ordinaryWolf = explosionButtons.find(node => String(node.props.accessibilityLabel).startsWith('2号'))!;
      act(() => ordinaryWolf.props.onPress());
      act(() => button('确认 2 号自爆').props.onPress());
      expect(dispatch).toHaveBeenCalledWith({ type: 'explode', seat: 2 });
    }
    act(() => renderer.unmount());
  });
});
