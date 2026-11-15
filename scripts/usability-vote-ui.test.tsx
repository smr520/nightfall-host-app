import React, { useState } from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import type { Action, Game } from '../src/game/types';
import { hostNarration } from '../src/game/narration';
import { GameScreen } from '../src/ui/GameScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const seated: Game = (() => {
  const roles = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'] as const;
  const game = createGame('现场投票', '六人局', roles.map((role, index) => ({ role, name: `${index + 1}号玩家` })), { ...DEFAULT_RULES, sheriff: false });
  game.stage = 'discussion';
  return applyAction(game, { type: 'start-exile' });
})();

function mount(initial: Game) {
  let current = initial;
  const actions: Action[] = [];
  function Harness() {
    const [game, setGame] = useState(initial);
    const [revision] = useState(0);
    current = game;
    return <GameScreen game={game} canUndo={false} canRedo={false} error="" selectionRevision={revision} onBack={jest.fn()} onUndo={jest.fn()} onRedo={jest.fn()} onReset={jest.fn()} dispatch={action => { actions.push(action); setGame(applyAction(game, action)); return true; }} />;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<Harness />); });
  const press = (label: string) => {
    const found = renderer.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
    if (!found) throw new Error(`Missing control: ${label}`);
    act(() => { if (!found.props.disabled) found.props.onPress(); });
  };
  const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  return { renderer, press, button, text, actions, current: () => current, unmount: () => act(() => renderer.unmount()) };
}

describe('field voting controls', () => {
  it('hides the current voter from the detailed exile target grid unless self-voting is allowed', () => {
    const app = mount(seated);
    expect(app.button('1号 存活')).toBeUndefined();
    app.unmount();

    const permissive: Game = {
      ...seated,
      rules: {
        ...seated.rules,
        table: { ...seated.rules.table, exileSelfVote: true },
      },
    };
    const permitted = mount(permissive);
    expect(permitted.button('1号 存活')).toBeDefined();
    permitted.unmount();
  });

  it('removes the selected target from the batch voter grid when self-voting is prohibited', () => {
    const app = mount(seated);
    app.press('按得票人录票');
    app.press('3号 存活');
    const grid = app.renderer.root.findByProps({ testID: 'batch-voter-grid' });
    expect(grid.findAll(node => node.props.accessibilityLabel === '3号 存活')).toHaveLength(0);
    expect(grid.findByProps({ accessibilityLabel: '1号 存活' })).toBeDefined();
    app.unmount();
  });

  it('clears a legacy self-vote draft instead of leaving an edit action the engine will reject', () => {
    const legacy: Game = {
      ...seated,
      vote: {
        ...seated.vote!,
        ballots: { 1: 2, 3: 3 },
      },
    };
    const app = mount(legacy);

    app.press('修改 3 号投票');

    expect(app.text()).toContain('原票是 3 号投给自己');
    expect(app.button('选择 3 号的新投票')).toBeDefined();
    expect(app.button('更新 3 号投给 3 号')).toBeUndefined();
    app.unmount();
  });

  it('lets the host correct an already recorded voter without adding a second ballot', () => {
    const game = applyAction(applyAction(seated, { type: 'ballot', voter: 1, target: 2 }), { type: 'ballot', voter: 3, target: 4 });
    const app = mount(game);
    app.press('修改 1 号投票');
    expect(app.button('更新 1 号投给 2 号').props.disabled).toBe(false);
    app.press('4号 存活');
    app.press('更新 1 号投给 4 号');
    expect(app.actions.at(-1)).toEqual({ type: 'ballot', voter: 1, target: 4 });
    expect(app.current().vote?.ballots).toEqual({ 1: 4, 3: 4 });
    app.unmount();
  });

  it('records several real raised hands at once and applies the same vote again as a correction', () => {
    const app = mount(seated);
    app.press('按得票人录票');
    const grid = app.renderer.root.findByProps({ testID: 'batch-voter-grid' });
    const voter = (seat: number) => act(() => { grid.findAll(node => node.props.accessibilityLabel === `${seat}号 存活` && typeof node.props.onPress === 'function')[0].props.onPress(); });
    app.press('4号 存活');
    voter(1); voter(3);
    app.press('记录 2 人投给 4 号');
    expect(app.actions.at(-1)).toEqual({ type: 'ballots', voters: [1, 3], target: 4 });
    expect(app.current().vote?.ballots).toEqual({ 1: 4, 3: 4 });

    const updatedGrid = app.renderer.root.findByProps({ testID: 'batch-voter-grid' });
    act(() => { updatedGrid.findAll(node => node.props.accessibilityLabel === '1号 存活' && typeof node.props.onPress === 'function')[0].props.onPress(); });
    app.press('3号 存活');
    app.press('记录 1 人投给 3 号');
    expect(app.current().vote?.ballots).toEqual({ 1: 3, 3: 4 });
    app.unmount();
  });

  it('places a new PK round into candidate speech and resumes voting only when the host ends it', () => {
    let tied = seated;
    tied = applyAction(tied, { type: 'ballots', voters: [2, 3, 4], target: 1 });
    tied = applyAction(tied, { type: 'ballots', voters: [1, 5, 6], target: 2 });
    const app = mount(tied);
    app.press('完成计票');
    expect(app.current().vote?.round).toBe(2);
    expect(app.renderer.root.findByProps({ accessibilityLabel: '发言人 1 号' })).toBeDefined();
    app.press('发言人 2 号');
    expect(app.renderer.root.findAllByType(Text).some(node => node.props.children === '2 号 · PK 发言')).toBe(true);
    expect(hostNarration(app.current(), '请玩家投票', { speaker: 2, pkSpeaking: true }).spoken).toContain('2 号');
    app.press('发言结束，开始 PK 投票');
    expect(app.current().vote?.round).toBe(2);
    expect(app.renderer.root.findByProps({ accessibilityLabel: '待录 3 号' })).toBeDefined();
    app.unmount();
  });
});
