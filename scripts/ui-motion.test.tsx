import React from 'react';
import * as Native from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

type MotionModule = typeof import('../src/ui/motion');
type Completion = (result: { finished: boolean }) => void;
type ControlledAnimation = {
  value: Native.Animated.Value;
  config: Native.Animated.TimingAnimationConfig;
  start: jest.Mock;
  stop: jest.Mock;
  complete: (finished?: boolean) => void;
};

// Load the real animation branch with the already-loaded React instance. React Native
// and the renderer remain in test mode; only this module evaluates its runtime gate.
let motion!: MotionModule;
const originalEnvironment = process.env.NODE_ENV;
jest.isolateModules(() => {
  jest.doMock('react', () => React);
  jest.doMock('react-native', () => Native);
  process.env.NODE_ENV = 'development';
  try { motion = jest.requireActual<MotionModule>('../src/ui/motion'); }
  finally { process.env.NODE_ENV = originalEnvironment; }
});
jest.dontMock('react');
jest.dontMock('react-native');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('native motion interaction safeguards', () => {
  let animations: ControlledAnimation[];
  let preference: ReturnType<typeof deferred<boolean>>;
  let nativePreferenceChanged: (value: boolean) => void;
  let removePreferenceListener: jest.Mock;
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  beforeEach(() => {
    expect(motion.motionEnabled).toBe(true);
    animations = [];
    preference = deferred<boolean>();
    removePreferenceListener = jest.fn();
    jest.spyOn(Native.AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(preference.promise);
    jest.spyOn(Native.AccessibilityInfo, 'addEventListener').mockImplementation((_event, listener) => {
      nativePreferenceChanged = listener;
      return { remove: removePreferenceListener };
    });
    jest.spyOn(Native.Animated, 'timing').mockImplementation((value, config) => {
      let completion: Completion | undefined;
      const controlled: ControlledAnimation = {
        value: value as Native.Animated.Value,
        config,
        start: jest.fn(callback => { completion = callback; }),
        stop: jest.fn(() => completion?.({ finished: false })),
        complete: (finished = true) => {
          if (finished && typeof config.toValue === 'number') controlled.value.setValue(config.toValue);
          completion?.({ finished });
        },
      };
      animations.push(controlled);
      return { start: controlled.start, stop: controlled.stop, reset: jest.fn() } as Native.Animated.CompositeAnimation;
    });
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
    renderer = undefined;
    jest.restoreAllMocks();
  });

  const settlePreference = async (reduce: boolean) => {
    await act(async () => { preference.resolve(reduce); await Promise.resolve(); });
  };

  it('uses a live OS preference event instead of a stale initial query and removes its listener', async () => {
    let reduce = false;
    function Probe() { reduce = motion.useReduceMotion(); return null; }
    act(() => { renderer = TestRenderer.create(<motion.MotionProvider><Probe /></motion.MotionProvider>); });
    expect(reduce).toBe(true);
    act(() => nativePreferenceChanged(false));
    expect(reduce).toBe(false);
    await settlePreference(true);
    expect(reduce).toBe(false);
    act(() => renderer?.unmount()); renderer = undefined;
    expect(removePreferenceListener).toHaveBeenCalledTimes(1);
  });

  it('shows the first page immediately and only animates a subsequent page change', async () => {
    function Probe({ page, direction = 1 }: { page: string; direction?: number }) {
      return <Native.Animated.View testID="page" style={motion.usePageEnter(page, direction)} />;
    }
    const tree = (page: string, direction = 1) => <motion.MotionProvider><Probe page={page} direction={direction} /></motion.MotionProvider>;
    act(() => { renderer = TestRenderer.create(tree('home')); });
    await settlePreference(false);
    expect(animations).toHaveLength(0);
    act(() => renderer?.update(tree('home', -1)));
    expect(animations).toHaveLength(0);
    act(() => renderer?.update(tree('skills')));
    expect(animations).toHaveLength(1);
    expect(animations[0].start).toHaveBeenCalledTimes(1);
    expect(animations[0].config).toMatchObject({ toValue: 1, duration: motion.pageDuration, useNativeDriver: true });
    act(() => renderer?.update(tree('home', -1)));
    expect(animations[0].stop).toHaveBeenCalled();
    expect(animations).toHaveLength(2);
  });

  it('uses a short vertical fade for peer tab changes instead of horizontal navigation', async () => {
    function Probe({ page, direction }: { page: string; direction: number }) {
      return <Native.Animated.View testID="tab" style={motion.usePageEnter(page, direction, 'tab')} />;
    }
    const tree = (page: string, direction: number) => <motion.MotionProvider><Probe page={page} direction={direction} /></motion.MotionProvider>;
    act(() => { renderer = TestRenderer.create(tree('host', 1)); });
    await settlePreference(false);
    act(() => renderer?.update(tree('seats', -1)));

    expect(animations).toHaveLength(1);
    expect(animations[0].config).toMatchObject({ toValue: 1, duration: motion.motionTiming.tab, useNativeDriver: true });
    const style = renderer!.root.findByProps({ testID: 'tab' }).props.style;
    expect(style.transform.some((item: Record<string, unknown>) => 'translateX' in item)).toBe(false);
    expect(style.transform.some((item: Record<string, unknown>) => 'translateY' in item)).toBe(true);
  });

  it('bridges host stage changes with a restrained vertical fade', async () => {
    function Probe({ stage }: { stage: string }) {
      return <Native.Animated.View testID="stage" style={motion.useStageReveal(stage)} />;
    }
    const tree = (stage: string) => <motion.MotionProvider><Probe stage={stage} /></motion.MotionProvider>;
    act(() => { renderer = TestRenderer.create(tree('wolves')); });
    await settlePreference(false);
    act(() => renderer?.update(tree('seer')));

    expect(animations).toHaveLength(1);
    expect(animations[0].config).toMatchObject({ toValue: 1, duration: motion.motionTiming.stage, useNativeDriver: true });
    const style = renderer!.root.findByProps({ testID: 'stage' }).props.style;
    expect(style.opacity).toBeDefined();
    expect(style.transform[0].translateY).toBeDefined();
  });

  it('keeps page changes, sheet closure and presses immediate with reduced motion', async () => {
    let sheetPresent = false;
    const onPress = jest.fn();
    function Probe({ page, visible }: { page: string; visible: boolean }) {
      motion.usePageEnter(page, 1);
      sheetPresent = motion.useSheetMotion(visible).present;
      return <motion.MotionPressable accessibilityLabel="继续主持" onPress={onPress}><Native.Text>继续主持</Native.Text></motion.MotionPressable>;
    }
    const tree = (page: string, visible: boolean) => <motion.MotionProvider><Probe page={page} visible={visible} /></motion.MotionProvider>;
    act(() => { renderer = TestRenderer.create(tree('home', true)); });
    await settlePreference(true);
    expect(sheetPresent).toBe(true);
    act(() => renderer?.update(tree('skills', false)));
    expect(sheetPresent).toBe(false);
    const button = renderer!.root.findByType(motion.MotionPressable).findAll(node => node.type !== motion.MotionPressable && typeof node.props.onPressIn === 'function')[0];
    act(() => { button.props.onPressIn({}); button.props.onPress({}); button.props.onPressOut({}); });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(animations).toHaveLength(0);
  });

  it('dispatches a press while its feedback is still running and cancels that feedback on release', async () => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    act(() => { renderer = TestRenderer.create(<motion.MotionProvider><motion.MotionPressable accessibilityLabel="下一步" onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}><Native.Text>下一步</Native.Text></motion.MotionPressable></motion.MotionProvider>); });
    await settlePreference(false);
    const button = renderer!.root.findByType(motion.MotionPressable).findAll(node => node.type !== motion.MotionPressable && typeof node.props.onPressIn === 'function')[0];
    act(() => button.props.onPressIn({}));
    expect(animations).toHaveLength(1);
    expect(animations[0].config).toMatchObject({ toValue: 0.985, useNativeDriver: true });
    act(() => button.props.onPress({}));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPressIn).toHaveBeenCalledTimes(1);
    act(() => button.props.onPressOut({}));
    expect(animations[0].stop).toHaveBeenCalledTimes(1);
    expect(animations[1].config).toMatchObject({ toValue: 1, duration: motion.motionTiming.release });
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it('ignores a late completed exit after a sheet reopens so its next exit remains mounted', async () => {
    let present = false;
    function Probe({ visible }: { visible: boolean }) { present = motion.useSheetMotion(visible).present; return null; }
    const tree = (visible: boolean) => <motion.MotionProvider><Probe visible={visible} /></motion.MotionProvider>;
    act(() => { renderer = TestRenderer.create(tree(false)); });
    await settlePreference(false);
    animations.length = 0;
    act(() => renderer?.update(tree(true)));
    act(() => animations[0].complete());
    act(() => renderer?.update(tree(false)));
    const oldExit = animations[1];
    expect(present).toBe(true);
    act(() => renderer?.update(tree(true)));
    expect(oldExit.stop).toHaveBeenCalled();
    expect(present).toBe(true);
    act(() => renderer?.update(tree(false)));
    expect(present).toBe(true);
    // A native completion already queued before cancellation may arrive afterward.
    act(() => oldExit.complete(true));
    expect(present).toBe(true);
    act(() => animations[3].complete());
    expect(present).toBe(false);
  });

  it('does not resurrect a closed sheet when the OS toggles reduced motion during its exit', async () => {
    let present = false;
    function Probe({ visible }: { visible: boolean }) { present = motion.useSheetMotion(visible).present; return null; }
    const tree = (visible: boolean) => <motion.MotionProvider><Probe visible={visible} /></motion.MotionProvider>;
    act(() => { renderer = TestRenderer.create(tree(true)); });
    await settlePreference(false);
    animations.length = 0;
    act(() => renderer?.update(tree(false)));
    expect(present).toBe(true);
    act(() => nativePreferenceChanged(true));
    expect(present).toBe(false);
    act(() => nativePreferenceChanged(false));
    expect(present).toBe(false);
  });
});
