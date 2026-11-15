import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import type { Game, Role, Rules } from '../src/game/types';
import { GameScreen } from '../src/ui/GameScreen';
import { SetupScreen } from '../src/ui/SetupScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'];

function gameWith(rules: Partial<Rules> = {}): Game {
  return createGame(
    '渐进身份测试',
    '六人测试局',
    roles.map((role, index) => ({ name: `${index + 1}号玩家`, role })),
    {
      ...DEFAULT_RULES,
      sheriff: false,
      flow: { identityCheck: 'during-night' },
      ...rules,
    },
  );
}

function mount(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  const button = (label: string) => renderer.root.findAll(node =>
    node.props.accessibilityRole === 'button'
    && node.props.accessibilityLabel === label
    && typeof node.props.onPress === 'function')[0];
  const press = (label: string) => {
    const control = button(label);
    if (!control) throw new Error(`Missing control: ${label}`);
    act(() => {
      if (!control.props.disabled) control.props.onPress();
    });
  };
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  return { renderer, button, press, text };
}

describe('progressive identity confirmation', () => {
  it('does not assign seat identities in the pregame roster step', () => {
    const app = mount(
      <SetupScreen
        mode="standard"
        initialRules={DEFAULT_RULES}
        onBack={jest.fn()}
        onStart={jest.fn()}
      />,
    );

    app.press('下一步');
    expect(app.button('夜间行动流程 确认即行动')?.props.accessibilityState.selected).toBe(true);
    app.press('下一步');

    expect(app.text()).toContain('身份将在夜间逐项确认');
    expect(app.text()).not.toContain('开始主持后直接进入第一夜。按夜间行动流程');
    expect(app.button('随机分配身份')).toBeUndefined();
    expect(app.button('1号身份 狼人，点击更改')).toBeUndefined();
  });

  it('asks the host to select the actual seats before the wolves can act', () => {
    const game = gameWith();
    const dispatch = jest.fn(() => true);
    const app = mount(
      <GameScreen
        game={game}
        canUndo={false}
        canRedo={false}
        error=""
        selectionRevision={0}
        onBack={jest.fn()}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onReset={jest.fn()}
        dispatch={dispatch}
      />,
    );

    expect(app.renderer.root.findByProps({ accessibilityLabel: '本步身份选择说明' })).toBeDefined();
    expect(app.text()).not.toContain('记录狼队刀口');

    app.press('1号 存活');
    app.press('4号 存活');
    expect(app.button('确认本步身份（已选 2 / 2）')).toBeDefined();
    app.press('确认本步身份（已选 2 / 2）');

    expect(dispatch).toHaveBeenCalledWith({
      type: 'assign-night-identity',
      callId: 'wolves',
      seats: [1, 4],
    });
  });

  it('moves the role group to the seats confirmed by the host before allowing the action', () => {
    let game = gameWith();

    expect(() => applyAction(game, { type: 'wolves', target: 3 })).toThrow('请先确认本步身份');
    game = applyAction(game, {
      type: 'assign-night-identity',
      callId: 'wolves',
      seats: [1, 4],
    });

    expect(game.stage).toBe('wolves');
    expect(game.identityConfirmed).toEqual([1, 4]);
    expect(game.players.filter(player => player.role === 'wolf').map(player => player.seat)).toEqual([1, 4]);

    game = applyAction(game, { type: 'wolves', target: 3 });
    expect(game.night.knife).toBe(3);
    expect(game.stage).toBe('seer');
  });

  it('rejects an incomplete identity roster and keeps the state unchanged', () => {
    const game = gameWith();

    expect(() => applyAction(game, {
      type: 'assign-night-identity',
      callId: 'wolves',
      seats: [1],
    })).toThrow('请选择 2 个座位');
    expect(game.identityConfirmed).toEqual([]);
    expect(game.players.filter(player => player.role === 'wolf').map(player => player.seat)).toEqual([1, 2]);
  });
});
