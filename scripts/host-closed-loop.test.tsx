import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import type { Game, Role, Rules } from '../src/game/types';
import { GameScreen } from '../src/ui/GameScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

function makeGame(roles: Role[], rules: Partial<Rules> = {}): Game {
  return createGame(
    'Host closed loop',
    'Test board',
    roles.map((role, index) => ({ name: `P${index + 1}`, role })),
    { ...DEFAULT_RULES, sheriff: false, win: 'all', ...rules },
  );
}

function mount(game: Game, options: { canUndo?: boolean; onUndo?: () => void } = {}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <GameScreen
        game={game}
        canUndo={options.canUndo ?? false}
        canRedo={false}
        error=""
        selectionRevision={0}
        onBack={jest.fn()}
        onUndo={options.onUndo ?? jest.fn()}
        onRedo={jest.fn()}
        onReset={jest.fn()}
        dispatch={jest.fn(() => true)}
      />,
    );
  });
  const button = (label: string) => renderer.root.findAll(node =>
    node.props.accessibilityRole === 'button'
    && node.props.accessibilityLabel === label
    && typeof node.props.onPress === 'function')[0];
  const press = (label: string) => {
    const control = button(label);
    if (!control) throw new Error(`Missing control: ${label}`);
    act(() => control.props.onPress());
  };
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  return { renderer, button, press, text };
}

describe('host console closure', () => {
  it('shows the current requirement and role rule help on the host screen', () => {
    const game = makeGame(['wolf', 'wolf', 'villager', 'villager', 'seer', 'dreamer']);
    game.stage = 'dreamer';

    const app = mount(game);

    expect(app.text()).toContain('本步必须完成');
    expect(app.text()).toContain('规则提醒');
    expect(app.text()).toContain('梦游者免疫夜间伤害');
  });

  it('shows the active exile self-vote rule in the host reminder', () => {
    const game = makeGame(['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch']);
    game.stage = 'exile-vote';
    game.vote = {
      kind: 'exile',
      round: 1,
      candidates: [2, 3],
      voters: [2, 3],
      ballots: {},
    };

    const app = mount(game);

    expect(app.text()).toContain('本桌不允许投给自己');
  });

  it('does not offer an empty action for a role that must act', () => {
    const game = makeGame(['wolf', 'wolf', 'villager', 'villager', 'seer', 'dreamer']);
    game.stage = 'dreamer';

    const app = mount(game);

    expect(app.button('跳过本夜行动，继续')).toBeUndefined();
    expect(app.button('选择梦游目标，或空过')).toBeUndefined();
    expect(app.button('选择梦游目标')).toBeDefined();
    expect(app.text()).not.toContain('不发动可使用下方按钮继续');
  });

  it.each([
    ['nightmare', ['wolf', 'nightmare', 'villager', 'villager', 'seer', 'witch'], '选择恐惧目标'],
    ['hunter-demon', ['wolf', 'hunter-demon', 'villager', 'villager', 'seer', 'witch'], '选择狩猎目标'],
    ['light-earl', ['wolf', 'light-earl', 'villager', 'villager', 'seer', 'witch'], '选择庇护目标'],
  ] as [Role, Role[], string][])('keeps %s mandatory without an empty-action control', (stage, roles, targetLabel) => {
    const game = makeGame(roles);
    game.day = 2;
    game.stage = stage;

    const app = mount(game);

    expect(app.button('跳过本夜行动，继续')).toBeUndefined();
    expect(app.button(targetLabel)).toBeDefined();
    expect(app.button(`${targetLabel}，或空过`)).toBeUndefined();
  });

  it('keeps the engine rejection for an attempted mandatory-role skip', () => {
    const game = makeGame(['wolf', 'wolf', 'villager', 'villager', 'seer', 'dreamer']);
    game.stage = 'dreamer';

    expect(() => applyAction(game, { type: 'skip-night', reason: '误操作' })).toThrow('摄梦人本夜必须行动');
  });

  it('keeps the automatic empty wake-up for a dead mandatory role', () => {
    const game = makeGame(['wolf', 'wolf', 'villager', 'villager', 'seer', 'dreamer']);
    game.stage = 'dreamer';
    const dreamer = game.players.find(player => player.role === 'dreamer')!;
    game.players = game.players.map(player =>
      player.seat === dreamer.seat
        ? { ...player, alive: false, death: { day: 1, cause: 'knife' } }
        : player,
    );
    const dispatch = jest.fn(() => true);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
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
    });
    const control = renderer.root.findAll(node =>
      node.props.accessibilityRole === 'button'
      && node.props.accessibilityLabel === '摄梦人已出局，跳过并继续'
      && typeof node.props.onPress === 'function')[0];
    const pageText = renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');

    expect(control).toBeDefined();
    expect(pageText).toContain('角色已经出局，确认空唤醒后继续');
    expect(pageText).not.toContain('本步必须选择目标并完成行动');
    act(() => control.props.onPress());
    expect(dispatch).toHaveBeenCalledWith({ type: 'skip-night', reason: '行动角色已出局' });
  });

  it('describes a feared mandatory role as unable to act, not as still required to choose', () => {
    const game = makeGame(['wolf', 'wolf', 'villager', 'villager', 'seer', 'dreamer']);
    game.stage = 'dreamer';
    const dreamer = game.players.find(player => player.role === 'dreamer')!;
    game.night.targets.nightmare = dreamer.seat;

    const app = mount(game);

    expect(app.text()).toContain('角色仍存活，但本夜被恐惧，确认不能行动后继续空唤醒');
    expect(app.text()).not.toContain('本步必须选择目标并完成行动');
  });

  it('offers an in-place return to the previous committed step', () => {
    const game = makeGame(['wolf', 'wolf', 'villager', 'villager', 'seer', 'guard']);
    const onUndo = jest.fn();
    const app = mount(game, { canUndo: true, onUndo });

    app.press('撤回上一步');

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

});
