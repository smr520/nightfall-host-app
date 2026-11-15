import React from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import type { Game, Role, Session } from '../src/game/types';
import { clearSession, persistSession, readHistory, readPreferences, readSession } from '../src/storage';
import { GameScreen } from '../src/ui/GameScreen';
import { HomeScreen } from '../src/ui/HomeScreen';
import { SetupScreen } from '../src/ui/SetupScreen';
import { TemporarySpeech } from '../src/ui/game/TemporarySpeech';
import { SpeechTimer } from '../src/ui/game/SpeechTimer';
import { useSpeechClock, type SpeechClock } from '../src/hooks/useSpeechClock';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, SafeAreaView: View };
});

describe('speech timing through lifecycle and modal changes', () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(100000); });
  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
    renderer = undefined;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('expires immediately on foregrounding after background time without interval callbacks', () => {
    let clock!: SpeechClock;
    let change!: (state: AppStateStatus) => void;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      change = listener;
      return { remove };
    });
    function Probe() { clock = useSpeechClock('foreground-recovery', 90); return null; }
    act(() => { renderer = TestRenderer.create(<Probe />); });
    act(() => { clock.select(4); clock.toggle(); });
    act(() => { change('background'); jest.setSystemTime(280000); change('active'); });
    expect(clock.remaining).toBe(0);
    expect(clock.running).toBe(false);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('keeps a paused speech paused through background and foreground changes', () => {
    let clock!: SpeechClock;
    function Probe() { clock = useSpeechClock('paused-foreground', 90); return null; }
    const subscribe = jest.spyOn(AppState, 'addEventListener');
    act(() => { renderer = TestRenderer.create(<Probe />); });
    act(() => { clock.select(2); clock.toggle(); });
    act(() => jest.advanceTimersByTime(6000));
    act(() => clock.toggle());
    const changes = subscribe.mock.calls.map(call => call[1]);
    act(() => { jest.setSystemTime(580000); changes.forEach(listener => listener('active')); });
    expect(clock.speaker).toBe(2);
    expect(clock.remaining).toBe(84);
    expect(clock.running).toBe(false);
  });

  it('stops temporary speech when the parent closes it and reopens with no stale speaker', () => {
    const game = base();
    const tree = (visible: boolean) => <TemporarySpeech game={game} visible={visible} onClose={jest.fn()} />;
    act(() => { renderer = TestRenderer.create(tree(true)); });
    const clock = () => renderer!.root.findByType(SpeechTimer).props.clock as SpeechClock;
    act(() => { clock().select(3); clock().toggle(); });
    act(() => jest.advanceTimersByTime(5000));
    expect(clock().remaining).toBe(85);
    act(() => renderer?.update(tree(false)));
    act(() => jest.advanceTimersByTime(200000));
    act(() => renderer?.update(tree(true)));
    expect(clock().speaker).toBeNull();
    expect(clock().remaining).toBe(90);
    expect(clock().running).toBe(false);
  });
});
jest.mock('../src/storage', () => ({
  clearSession: jest.fn().mockResolvedValue(undefined), clearDamagedSession: jest.fn().mockResolvedValue(undefined),
  persistSession: jest.fn().mockResolvedValue(undefined), retryPersistSession: jest.fn().mockResolvedValue(undefined),
  readHistory: jest.fn(), readSession: jest.fn(), readPreferences: jest.fn(), persistPreferences: jest.fn().mockResolvedValue(undefined),
  readAppRole: jest.fn().mockResolvedValue('host'), persistAppRole: jest.fn().mockResolvedValue(undefined),
  getWarnings: jest.fn(() => []), exportRawData: jest.fn().mockResolvedValue('{}'),
}));

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'];
const base = (): Game => ({ ...createGame('连续现场操作', '六人局', roles.map(role => ({ name: '', role })), DEFAULT_RULES), stage: 'discussion', sheriffDone: true });

describe('consecutive host commands use the most recent session', () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(persistSession).mockResolvedValue(undefined);
    jest.mocked(readHistory).mockResolvedValue([]);
    jest.mocked(readPreferences).mockResolvedValue({ hostingMode: 'standard' });
  });
  afterEach(async () => {
    await act(async () => { await Promise.resolve(); });
    if (renderer) act(() => renderer?.unmount());
    renderer = undefined;
    jest.restoreAllMocks();
  });

  async function mount(session: Session) {
    jest.mocked(readSession).mockResolvedValue(session);
    await act(async () => { renderer = TestRenderer.create(<App />); });
    const resume = renderer!.root.findAll(node => node.props.accessibilityLabel === '继续主持' && typeof node.props.onPress === 'function')[0];
    act(() => resume.props.onPress());
    return () => renderer!.root.findByType(GameScreen).props as React.ComponentProps<typeof GameScreen>;
  }

  it('keeps both valid actions received before React commits a new screen', async () => {
    const initial = base();
    const screen = await mount({ current: initial, undo: [], redo: [] });
    const dispatch = screen().dispatch;
    act(() => {
      expect(dispatch({ type: 'note', text: '3 号附加能力尚未使用' })).toBe(true);
      expect(dispatch({ type: 'note', text: '7 号临时发言已结束' })).toBe(true);
    });
    const notes = screen().game.events.filter(event => event.text.startsWith('主持备忘：'));
    expect(notes.map(event => event.text)).toEqual(['主持备忘：3 号附加能力尚未使用', '主持备忘：7 号临时发言已结束']);
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].undo).toHaveLength(2);
    expect(initial.events.some(event => event.text.startsWith('主持备忘：'))).toBe(false);
  });

  it('lets two immediate undo commands actually undo two different actions', async () => {
    const original = base();
    const first = applyAction(original, { type: 'note', text: '第一条现场记录' });
    const second = applyAction(first, { type: 'note', text: '第二条现场记录' });
    const screen = await mount({ current: second, undo: [original, first], redo: [] });
    const undo = screen().onUndo;
    act(() => { undo(); undo(); });
    expect(screen().game).toEqual(original);
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].redo).toHaveLength(2);
  });

  it('uses the new redo stack when undo and redo arrive in the same tick', async () => {
    const original = base();
    const current = applyAction(original, { type: 'note', text: '应该恢复的现场记录' });
    const screen = await mount({ current, undo: [original], redo: [] });
    const { onUndo, onRedo } = screen();
    act(() => { onUndo(); onRedo(); });
    expect(screen().game).toEqual(current);
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0]).toMatchObject({ undo: [original], redo: [] });
  });

  it('starts only the first submitted game when start is tapped twice before re-rendering', async () => {
    jest.mocked(readSession).mockResolvedValue(null);
    await act(async () => { renderer = TestRenderer.create(<App />); });
    const newGame = renderer!.root.findAll(node => node.props.accessibilityLabel === '新建一场对局' && typeof node.props.onPress === 'function')[0];
    act(() => newGame.props.onPress());
    const start = renderer!.root.findByType(SetupScreen).props.onStart;
    const first = base();
    const second = { ...base(), id: `${first.id}-second`, name: '不应替换第一局' };
    act(() => { start(first); start(second); });
    expect(renderer!.root.findByType(GameScreen).props.game.id).toBe(first.id);
    expect(persistSession).toHaveBeenCalledTimes(1);
  });

  it('does not accept new actions or a second removal while the current game is being backed up', async () => {
    const initial = base();
    const screen = await mount({ current: initial, undo: [], redo: [] });
    let completeBackup!: () => void;
    jest.mocked(persistSession).mockImplementationOnce(() => new Promise<void>(resolve => { completeBackup = resolve; }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const dispatch = screen().dispatch;
    act(() => screen().onReset());
    const remove = alert.mock.calls[0][2]?.find(button => button.text === '移除')?.onPress;
    expect(remove).toBeDefined();
    act(() => {
      remove?.(); remove?.();
      expect(dispatch({ type: 'note', text: '备份期间不能写入的新记录' })).toBe(false);
    });
    expect(persistSession).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
    await act(async () => { completeBackup(); await Promise.resolve(); await Promise.resolve(); });
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(renderer!.root.findByType(HomeScreen).props.session).toBeNull();
  });
});
