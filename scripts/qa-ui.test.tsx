import React, { useState } from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import type { Action, Game } from '../src/game/types';
import { GameScreen } from '../src/ui/GameScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

function manualDawn(knife = 5): Game {
  const game = createGame('现场名单复核', '预女猎白', boardSeats(BOARD_LIBRARY[0]).map(role => ({ name: '', role })), { ...DEFAULT_RULES, sheriff: false, flow: { manualDawn: true } });
  game.stage = 'dawn';
  game.night.knife = knife;
  return game;
}

function mount(initial: Game) {
  let current = initial;
  let restore!: (game: Game) => void;
  const actions: Action[] = [];
  function Harness() {
    const [game, setGame] = useState(initial);
    const [revision, setRevision] = useState(0);
    current = game;
    restore = next => { setGame(next); setRevision(value => value + 1); };
    return <GameScreen game={game} canUndo={false} canRedo={false} error="" selectionRevision={revision} onBack={jest.fn()} onUndo={jest.fn()} onRedo={jest.fn()} onReset={jest.fn()} dispatch={action => { actions.push(action); setGame(applyAction(game, action)); return true; }} />;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<Harness />); });
  const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const press = (label: string) => {
    const found = button(label);
    if (!found) throw new Error(`Missing button: ${label}`);
    act(() => { if (!found.props.disabled) found.props.onPress(); });
  };
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  const checkbox = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'checkbox' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const check = (label: string) => act(() => { const found = checkbox(label); if (!found) throw new Error(`Missing checkbox ${label}`); if (!found.props.disabled) found.props.onPress(); });
  const tab = (label: string) => act(() => renderer.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0].props.onPress());
  const unmount = () => act(() => renderer.unmount());
  return { renderer, button, press, checkbox, check, tab, text, actions, current: () => current, restore: (game: Game) => act(() => restore(game)), unmount };
}

describe('manual-dawn review cannot publish a stale confirmed list', () => {
  it('requires the host to update confirmation after editing selected death seats', () => {
    const app = mount(manualDawn());
    app.press('确认昨夜出局名单');
    expect(app.current().night.manualDeaths).toEqual([{ seat: 5, cause: 'knife' }]);
    app.press('6号 存活');
    expect(app.button('确认夜间结算').props.disabled).toBe(true);
    app.press('确认夜间结算');
    expect(app.current().stage).toBe('dawn');
    app.press('更新昨夜出局名单');
    expect(app.current().night.manualDeaths).toEqual([{ seat: 5, cause: 'knife' }, { seat: 6, cause: 'ruling' }]);
    expect(app.button('确认夜间结算').props.disabled).toBe(false);
    app.press('确认夜间结算');
    expect(app.current().players[4].alive).toBe(false);
    expect(app.current().players[5].alive).toBe(false);
    app.unmount();
  });

  it('requires updated causes before settling hunter ability eligibility', () => {
    const app = mount(manualDawn(11));
    app.press('确认昨夜出局名单');
    expect(app.current().night.manualDeaths).toEqual([{ seat: 11, cause: 'knife' }]);
    app.press('11号出局原因 中毒');
    expect(app.button('确认夜间结算').props.disabled).toBe(true);
    app.press('更新昨夜出局名单');
    app.press('确认夜间结算');
    expect(app.current().players[10].death?.cause).toBe('poison');
    expect(app.current().pending.some(item => item.kind === 'hunter')).toBe(false);
    expect(app.current().stage).toBe('discussion');
    app.unmount();
  });

  it('keeps unsaved manual-review changes across game tabs, and allows reverting to the confirmed list', () => {
    const app = mount(manualDawn());
    app.press('确认昨夜出局名单');
    app.press('6号 存活');
    app.tab('座位'); app.tab('主持');
    expect(app.button('6号 存活').props.accessibilityState.selected).toBe(true);
    expect(app.button('确认夜间结算').props.disabled).toBe(true);
    const spoken = app.renderer.root.findAll(node => node.props.accessibilityLabel === '完整主持台词')[0].props.children as string;
    expect(spoken).not.toMatch(/昨夜\s*5\s*号\s*出局/);
    app.press('6号 存活');
    expect(app.button('确认夜间结算').props.disabled).toBe(false);
    app.unmount();
  });

  it('resets manual-review drafts when undo/redo restores another confirmed snapshot in the same stage', () => {
    const app = mount(manualDawn());
    app.press('确认昨夜出局名单');
    const confirmed = app.current();
    app.press('6号 存活');
    expect(app.button('确认夜间结算').props.disabled).toBe(true);
    app.restore(confirmed);
    expect(app.button('6号 存活').props.accessibilityState.selected).toBe(false);
    expect(app.button('确认夜间结算').props.disabled).toBe(false);
    app.unmount();
  });

  it('requires an updated confirmation for changed review notes and blocks an incomplete one-character note', () => {
    const app = mount(manualDawn());
    app.press('确认昨夜出局名单');
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '天亮复核原因' }).props.onChangeText('一'));
    expect(app.button('更新昨夜出局名单').props.disabled).toBe(true);
    expect(app.button('确认夜间结算').props.disabled).toBe(true);
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '天亮复核原因' }).props.onChangeText('再次核对'));
    app.press('更新昨夜出局名单');
    expect(app.current().night.manualReason).toBe('再次核对');
    expect(app.button('确认夜间结算').props.disabled).toBe(false);
    app.unmount();
  });
});

function witchGame(selfSave: 'never' | 'first' | 'always', day = 1, selfKnife = false, doubleMedicine = false): Game {
  const game = createGame('女巫录入规则', '预女猎白', boardSeats(BOARD_LIBRARY[0]).map(role => ({ name: '', role })), { ...DEFAULT_RULES, sheriff: false, selfSave, doubleMedicine });
  game.stage = 'witch'; game.day = day;
  game.night.knife = selfKnife ? game.players.find(player => player.role === 'witch')!.seat : 5;
  return game;
}

describe('witch controls respect the agreed medicine rules before confirmation', () => {
  it.each([
    ['never', 1, true],
    ['first', 2, true],
    ['first', 1, false],
    ['always', 3, false],
  ] as const)('disables forbidden self-save for %s on night %s', (selfSave, day, disabled) => {
    const app = mount(witchGame(selfSave, day, true));
    expect(app.checkbox('使用解药').props.disabled).toBe(disabled);
    if (disabled) expect(app.text()).toContain('自救');
    app.unmount();
  });

  it('switches between save and poison instead of preparing an invalid double-medicine action', () => {
    const app = mount(witchGame('first'));
    app.check('使用解药');
    expect(app.checkbox('使用解药').props.accessibilityState.checked).toBe(true);
    app.press('6号 存活');
    expect(app.checkbox('使用解药').props.accessibilityState.checked).toBe(false);
    expect(app.checkbox('使用毒药').props.accessibilityState.checked).toBe(true);
    app.check('使用解药');
    expect(app.checkbox('使用解药').props.accessibilityState.checked).toBe(true);
    expect(app.checkbox('使用毒药').props.accessibilityState.checked).toBe(false);
    app.press('确认女巫用药');
    expect(app.actions.at(-1)).toEqual({ type: 'witch', save: true, poison: null });
    expect(app.current().medicine).toEqual({ save: false, poison: true });
    app.unmount();
  });

  it('preserves both choices when the table explicitly permits double medicine', () => {
    const app = mount(witchGame('first', 1, false, true));
    app.check('使用解药'); app.press('6号 存活');
    expect(app.checkbox('使用解药').props.accessibilityState.checked).toBe(true);
    expect(app.checkbox('使用毒药').props.accessibilityState.checked).toBe(true);
    app.press('确认女巫用药');
    expect(app.actions.at(-1)).toEqual({ type: 'witch', save: true, poison: 6 });
    expect(app.current().medicine).toEqual({ save: false, poison: false });
    app.unmount();
  });
});
