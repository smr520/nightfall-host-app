import React, { useState } from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import type { Game, Role, Rules } from '../src/game/types';
import { GameScreen } from '../src/ui/GameScreen';
import { MotionProvider } from '../src/ui/motion';
import { WorkflowSettings } from '../src/ui/setup/WorkflowSettings';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'guard', 'hunter'];

function gameAtLastWords(): Game {
  const game = createGame(
    '遗言界面回归',
    '八人遗言测试',
    roles.map((role, index) => ({ name: `${index + 1}号`, role })),
    { ...DEFAULT_RULES, sheriff: false, win: 'all', flow: { lastWords: { firstNight: true } } },
  );
  game.players[4] = { ...game.players[4], alive: false, death: { day: 1, cause: 'knife' } };
  game.stage = 'last-words';
  game.pending = [{ kind: 'last-words', seat: 5 }];
  return game;
}

describe('last-words workflow settings', () => {
  it('saves death policies and independent phase durations', () => {
    let current = { ...DEFAULT_RULES, sheriff: false };
    let renderer!: TestRenderer.ReactTestRenderer;
    function Harness() {
      const [rules, setRules] = useState<Rules>(current);
      current = rules;
      return <WorkflowSettings roles={roles} rules={rules} onChange={setRules} />;
    }
    act(() => { renderer = TestRenderer.create(<Harness />); });
    const press = (label: string) => {
      const node = renderer.root.findAll(item => item.props.accessibilityLabel === label)[0];
      if (!node) throw new Error(`Missing control: ${label}`);
      if (typeof node.props.onPress === 'function') act(() => node.props.onPress());
      else if (typeof node.props.onValueChange === 'function') act(() => node.props.onValueChange(!node.props.value));
      else throw new Error(`Control has no action: ${label}`);
    };
    press('首夜夜死有遗言');
    press('放逐有遗言');
    press('计时类型：PK 发言');
    press('PK 发言 30 秒');
    expect(current.flow?.lastWords).toMatchObject({ firstNight: true, exile: true });
    expect(current.speechDurations?.pk).toBe(30);
    act(() => renderer.unmount());
  });
});

describe('queued last-words screen', () => {
  it('names the queued seat, auto-selects its timer and records a waiver', () => {
    let current = gameAtLastWords();
    let renderer!: TestRenderer.ReactTestRenderer;
    function Harness() {
      const [game, setGame] = useState(current);
      current = game;
      return (
        <MotionProvider>
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
            dispatch={action => {
              setGame(applyAction(game, action));
              return true;
            }}
          />
        </MotionProvider>
      );
    }
    act(() => { renderer = TestRenderer.create(<Harness />); });
    const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
    expect(text()).toContain('请 5 号玩家发表遗言');
    expect(text()).toContain('5 号 · 遗言');
    const waive = renderer.root.findAll(node => node.props.accessibilityLabel === '放弃遗言' && typeof node.props.onPress === 'function')[0];
    expect(waive).toBeDefined();
    act(() => waive.props.onPress());
    expect(current.stage).toBe('discussion');
    expect(current.events.some(event => event.publicText === '5 号放弃遗言')).toBe(true);
    act(() => renderer.unmount());
  });
});
