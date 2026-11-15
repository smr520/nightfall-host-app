import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { boardSeats, BOARD_LIBRARY } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { createGame } from '../src/game/engine';
import { hostTaskLogText, hostTasks } from '../src/game/host-tasks';
import { ROLE_REFERENCE } from '../src/game/role-reference';
import { ROLE_IDS } from '../src/game/roles';
import type { Role } from '../src/game/types';
import { HostSupportSheet } from '../src/ui/game/HostSupportSheet';
import { GameScreen } from '../src/ui/GameScreen';
import { MotionProvider } from '../src/ui/motion';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

function gameWith(roles: Role[]) {
  return createGame(
    '主持清单测试',
    '自定阵容',
    roles.map((role, index) => ({ seat: index + 1, name: '', role })),
    DEFAULT_RULES,
  );
}

describe('in-game host task workflow', () => {
  it('covers every role that is not fully automatic', () => {
    const expected = ROLE_IDS.filter(role => ROLE_REFERENCE[role].automation !== 'automatic').sort();
    const actual = hostTasks(ROLE_IDS).map(task => task.role).sort();
    expect(actual).toEqual(expect.arrayContaining(expected));
  });

  it('creates tasks from the actual game lineup and labels manual work honestly', () => {
    const tasks = hostTasks(['knight', 'miracle-merchant', 'poisoner', 'wolf', 'villager']);
    expect(tasks.map(task => task.role)).toEqual(['knight', 'miracle-merchant', 'poisoner']);
    expect(tasks[0]).toMatchObject({ level: 'manual', levelLabel: '主持人处理' });
    expect(tasks[1]).toMatchObject({ level: 'partial', levelLabel: '部分自动 · 需核对' });
    expect(tasks[2]).toMatchObject({ level: 'automatic', levelLabel: '自动处理 · 操作提醒' });
    expect(tasks[0].note).toContain('人工裁定');
  });

  it('requires a concrete result and saves it as a private host-log event', () => {
    const game = gameWith(['wolf', 'wolf', 'villager', 'villager', 'knight', 'seer']);
    const dispatch = jest.fn(() => true);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <HostSupportSheet game={game} visible onClose={jest.fn()} dispatch={dispatch} />,
      );
    });
    const input = renderer.root.findByProps({ accessibilityLabel: '骑士本次处理结果' });
    const button = () => renderer.root.findAll(
      node => node.props.accessibilityLabel === '记录 骑士 已处理' && typeof node.props.onPress === 'function',
    )[0];
    expect(button().props.disabled).toBe(true);
    act(() => input.props.onChangeText('3 号决斗 6 号，决斗已用'));
    expect(button().props.disabled).toBe(false);
    act(() => button().props.onPress());
    expect(dispatch).toHaveBeenCalledWith({
      type: 'note',
      text: hostTaskLogText(hostTasks(['knight'])[0], '3 号决斗 6 号，决斗已用'),
    });
    expect(renderer.root.findAllByType(Text).map(item => String(item.props.children)).join('\n')).toContain('骑士本次处理已写入主持记录');
    act(() => renderer.unmount());
  });

  it('contains every playable board without inventing missing task text', () => {
    for (const board of BOARD_LIBRARY) {
      const roles = boardSeats(board);
      for (const task of hostTasks(roles)) {
        expect(task.note.trim().length).toBeGreaterThan(6);
        expect(task.timing.trim().length).toBeGreaterThan(2);
      }
    }
  });

  it('is reachable from the live host page before a special skill is missed', () => {
    const game = { ...gameWith(['wolf', 'wolf', 'villager', 'villager', 'knight', 'seer']), stage: 'discussion' as const, sheriffDone: true };
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
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
            dispatch={jest.fn(() => true)}
          />
        </MotionProvider>,
      );
    });
    const open = renderer.root.findAll(node => (
      node.props.accessibilityLabel === '打开技能清单'
      && typeof node.props.onPress === 'function'
    ))[0];
    expect(open).toBeDefined();
    act(() => open.props.onPress());
    expect(renderer.root.findByProps({ accessibilityLabel: '骑士本次处理结果' })).toBeDefined();
    act(() => renderer.unmount());
  });
});
