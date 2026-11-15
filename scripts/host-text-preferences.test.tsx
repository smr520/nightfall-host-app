import React from 'react';
import { StyleSheet, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { createGame } from '../src/game/engine';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { emptyDraft } from '../src/ui/game/draft';
import { HostPage } from '../src/ui/game/HostPage';
import { PersonalizationScreen } from '../src/ui/PersonalizationScreen';
import { MotionProvider } from '../src/ui/motion';
import type { SpeechClock } from '../src/hooks/useSpeechClock';

const clock: SpeechClock = {
  speaker: null,
  remaining: 120,
  running: false,
  direction: 1,
  toggleDirection: jest.fn(),
  select: jest.fn(),
  toggle: jest.fn(),
  reset: jest.fn(),
};

function gameFixture() {
  const board = BOARD_LIBRARY[0];
  return createGame('大字提词', board.name, boardSeats(board).map(role => ({ name: '', role })), DEFAULT_RULES);
}

describe('host reading size', () => {
  it('changes the complete host script size without hiding the operation controls', () => {
    const game = gameFixture();
    const draft = emptyDraft('large-text', game);
    const scroll = React.createRef<any>();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <MotionProvider>
          <HostPage
            game={game}
            stage={game.stage}
            draft={draft}
            patch={jest.fn()}
            doAction={jest.fn()}
            showRoles={false}
            scroll={scroll}
            error=""
            activeVoter={null}
            speechClock={clock}
            hostTextSize="xlarge"
            onOpenTools={jest.fn()}
            onGoSeats={jest.fn()}
            onGoLog={jest.fn()}
            onTemporarySpeech={jest.fn()}
            onNote={jest.fn()}
            footer={null}
          />
        </MotionProvider>,
      );
    });

    const script = renderer.root.findAll(node => node.type === Text && node.props.accessibilityLabel === '完整主持台词')[0];
    expect(StyleSheet.flatten(script.props.style).fontSize).toBeGreaterThanOrEqual(30);
    expect(renderer.root.findAllByProps({ children: '主持人操作' }).length).toBeGreaterThan(0);
    act(() => renderer.unmount());
  });

  it('offers standard, large and extra-large host reading choices in personalization', () => {
    const onTextSizeChange = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PersonalizationScreen
          profiles={[]}
          hostingMode="standard"
          textSize="standard"
          onTextSizeChange={onTextSizeChange}
          onHostingModeChange={jest.fn()}
          onCreate={jest.fn()}
          onEdit={jest.fn()}
          onSelect={jest.fn()}
          onDelete={jest.fn()}
        />,
      );
    });

    const options = renderer.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('主持提词：') && typeof node.props.onPress === 'function');
    expect(Array.from(new Set(options.map(node => node.props.accessibilityLabel)))).toEqual(['主持提词：标准', '主持提词：大字', '主持提词：超大']);
    const large = options.find(node => node.props.accessibilityLabel === '主持提词：大字')!;
    act(() => large.props.onPress());
    expect(onTextSizeChange).toHaveBeenCalledWith('large');
    act(() => renderer.unmount());
  });
});
