import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_RULES } from '../src/game/config';
import { createGame } from '../src/game/engine';
import type { Role } from '../src/game/types';
import { useSpeechClock, type SpeechClock } from '../src/hooks/useSpeechClock';
import { SpeechTimer } from '../src/ui/game/SpeechTimer';

const roles: Role[] = ['wolf', 'wolf', 'villager', 'seer', 'witch', 'hunter'];
const fixture = () => {
  const game = createGame('分阶段发言', '六人', roles.map(role => ({ name: '', role })), DEFAULT_RULES);
  game.players[4] = { ...game.players[4], alive: false, death: { day: 1, cause: 'knife' } };
  return game;
};

function mount(eligibleSeats?: readonly number[], label?: string) {
  const game = fixture(); let clock!: SpeechClock; let renderer!: TestRenderer.ReactTestRenderer;
  function Harness(props: { eligibleSeats?: readonly number[]; label?: string }) {
    clock = useSpeechClock('speech-tool', 90);
    return <SpeechTimer game={game} clock={clock} eligibleSeats={props.eligibleSeats} label={props.label} />;
  }
  act(() => { renderer = TestRenderer.create(<Harness eligibleSeats={eligibleSeats} label={label} />); });
  const button = (title: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === title && typeof node.props.onPress === 'function')[0];
  return {
    button,
    press: (title: string) => act(() => { const found = button(title); if (!found) throw new Error(`Missing ${title}`); if (!found.props.disabled) found.props.onPress(); }),
    clock: () => clock,
    text: () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n'),
    update: (next?: readonly number[], nextLabel?: string) => act(() => renderer.update(<Harness eligibleSeats={next} label={nextLabel} />)),
    unmount: () => act(() => renderer.unmount()),
  };
}

describe('candidate and last-words speech controls', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(10000); });
  afterEach(() => jest.useRealTimers());

  it('retains the default alive-only day speech behavior', () => {
    const app = mount();
    expect(app.button('发言人 5 号')).toBeUndefined();
    app.press('发言人 3 号');
    expect(app.text()).toContain('3 号发言');
    app.press('下一位发言');
    expect(app.clock().speaker).toBe(4);
    app.press('下一位发言');
    expect(app.clock().speaker).toBe(6);
    app.unmount();
  });

  it('limits candidate speech and next-speaker order to the supplied seats', () => {
    const app = mount([2, 4], '警上发言');
    expect(app.button('发言人 1 号')).toBeUndefined();
    expect(app.button('发言人 3 号')).toBeUndefined();
    expect(app.text()).toContain('警上发言');
    app.press('发言人 2 号');
    expect(app.text()).toContain('2 号 · 警上发言');
    app.press('下一位发言');
    expect(app.clock().speaker).toBe(4);
    app.press('下一位发言');
    expect(app.clock().speaker).toBe(2);
    app.unmount();
  });

  it('includes explicitly eligible eliminated seats for last words, ignoring nonexistent seats', () => {
    const app = mount([5, 99], '遗言计时');
    expect(app.button('发言人 5 号')).toBeDefined();
    expect(app.button('发言人 99 号')).toBeUndefined();
    app.press('发言人 5 号');
    expect(app.text()).toContain('5 号 · 遗言计时');
    expect(app.button('下一位发言').props.disabled).toBe(true);
    app.press('开始计时');
    act(() => jest.advanceTimersByTime(1000));
    expect(app.clock().remaining).toBe(89);
    app.unmount();
  });

  it('clears and stops a speaker removed from eligibility, including an empty candidate list', () => {
    const app = mount([2, 4], 'PK 发言');
    app.press('发言人 2 号'); app.press('开始计时');
    act(() => jest.advanceTimersByTime(3000));
    expect(app.clock().remaining).toBe(87);
    app.update([4], 'PK 发言');
    expect(app.clock().speaker).toBeNull();
    expect(app.clock().running).toBe(false);
    expect(app.clock().remaining).toBe(90);
    expect(app.text()).not.toContain('2 号 · PK 发言');
    app.press('发言人 4 号');
    app.update([], 'PK 发言');
    expect(app.clock().speaker).toBeNull();
    expect(app.button('开始计时').props.disabled).toBe(true);
    app.unmount();
  });
});
