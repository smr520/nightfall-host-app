import React from 'react';
import { StyleSheet, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { createGame } from '../src/game/engine';
import { boardIntroduction } from '../src/game/board-reference';
import { emptyDraft } from '../src/ui/game/draft';
import { HostFooter } from '../src/ui/game/HostFooter';
import { HomeScreen } from '../src/ui/HomeScreen';
import { MotionProvider } from '../src/ui/motion';
import { SetupScreen } from '../src/ui/SetupScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

function mount(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<MotionProvider>{element}</MotionProvider>);
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

describe('quiet host interface polish', () => {
  it('does not render an empty recent-history block on the home screen', () => {
    const app = mount(
      <HomeScreen
        session={null}
        history={[]}
        hostingMode="standard"
        disabled={false}
        onPersonalize={jest.fn()}
        onNew={jest.fn()}
        onResume={jest.fn()}
        onHistory={jest.fn()}
        onUndo={jest.fn()}
      />,
    );

    expect(app.text()).not.toContain('完成的对局会自动收进复盘');
    expect(app.button('新建一场对局')).toBeDefined();
  });

  it('keeps the board overview in the detail sheet instead of bloating the first setup card', () => {
    const board = BOARD_LIBRARY[0];
    const overview = boardIntroduction(board).overview;
    const app = mount(
      <SetupScreen
        mode="standard"
        initialRules={DEFAULT_RULES}
        onBack={jest.fn()}
        onStart={jest.fn()}
      />,
    );

    expect(app.text()).not.toContain(overview);
    expect(app.button('查看当前板子介绍')).toBeDefined();
  });

  it('keeps the primary and secondary host actions on one compact row', () => {
    const board = BOARD_LIBRARY[0];
    const game = createGame(
      '紧凑主持栏',
      board.name,
      boardSeats(board).map((role, index) => ({ name: `${index + 1}号玩家`, role })),
      { ...DEFAULT_RULES, sheriff: false },
    );
    game.stage = 'wolves';
    const app = mount(
      <HostFooter
        game={game}
        stage="wolves"
        draft={emptyDraft('host-footer-polish', game)}
        activeVoter={null}
        voteRecorded={false}
        canUndo={false}
        doAction={jest.fn()}
        onEndPk={jest.fn()}
        onUndo={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    const row = app.renderer.root.findByProps({ testID: 'host-action-row' });
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
    expect(app.button('选择刀口，或空刀')).toBeDefined();
    expect(app.button('空刀（今晚不杀人）')).toBeDefined();
  });
});
