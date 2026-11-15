import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { motionTokens } from '../theme';

export const motionEnabled = process.env.NODE_ENV !== 'test';
export const enterCurve = Easing.bezier(0.22, 1, 0.36, 1);
export const moveCurve = Easing.bezier(0.25, 1, 0.5, 1);
export const pageDuration = 180;
export const motionTiming = {
  press: motionTokens.press,
  release: motionTokens.release,
  page: pageDuration,
  tab: motionTokens.fast,
  stage: motionTokens.base,
  sheetIn: motionTokens.slow,
  sheetOut: motionTokens.exit,
} as const;
export type PageMotion = 'slide' | 'fade' | 'tab' | 'stage';
const ReduceMotion = createContext(true);

/** Default to stillness until the OS preference is known; only one native subscription. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    if (!motionEnabled) return;
    let active = true;
    let eventReceived = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      eventReceived = true;
      if (active) setReduce(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active && !eventReceived) setReduce(value);
    }).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, []);
  return <ReduceMotion.Provider value={reduce}>{children}</ReduceMotion.Provider>;
}

export function useReduceMotion() { return useContext(ReduceMotion); }

export function useAnimatedScalar(target: number, duration = 180) {
  const [value] = useState(() => new Animated.Value(target));
  const reduce = useReduceMotion();
  useEffect(() => {
    value.stopAnimation();
    if (!motionEnabled || reduce) { value.setValue(target); return; }
    const animation = Animated.timing(value, { toValue: target, duration, easing: enterCurve, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [target, duration, reduce, value]);
  return value;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Interruptible native press feedback without a wrapper changing the layout or hit area. */
export function MotionPressable({ style, onPressIn, onPressOut, disabled, ...props }: PressableProps) {
  const [pressed, setPressed] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
  const reduce = useReduceMotion();
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => () => animation.current?.stop(), []);
  useEffect(() => {
    if (disabled || reduce) { animation.current?.stop(); scale.setValue(1); }
  }, [disabled, reduce, scale]);
  const move = (down: boolean) => {
    setPressed(down);
    animation.current?.stop();
    if (!motionEnabled || reduce || disabled) { scale.setValue(1); return; }
    animation.current = Animated.timing(scale, {
      toValue: down ? 0.985 : 1,
      duration: down ? motionTiming.press : motionTiming.release,
      easing: enterCurve,
      useNativeDriver: true,
    });
    animation.current.start();
  };
  const resolvedStyle = typeof style === 'function' ? style({ pressed }) : style;
  const transform = StyleSheet.flatten(resolvedStyle)?.transform;
  return <AnimatedPressable {...props} disabled={disabled}
    onPressIn={event => { move(true); onPressIn?.(event); }}
    onPressOut={event => { move(false); onPressOut?.(event); }}
    style={[resolvedStyle, { transform: [...(Array.isArray(transform) ? transform : []), { scale }] }]} />;
}

/** First paint is immediate. Peer tabs fade; wizard steps may keep a small directional hint. */
export function usePageEnter(pageKey: string, direction: number, motion: PageMotion = 'slide') {
  const [progress] = useState(() => new Animated.Value(1));
  const previousKey = useRef(pageKey);
  const reduce = useReduceMotion();
  useLayoutEffect(() => {
    const changed = previousKey.current !== pageKey;
    previousKey.current = pageKey;
    progress.stopAnimation();
    if (!motionEnabled || reduce || !changed) { progress.setValue(1); return; }
    progress.setValue(0);
    const duration = motion === 'tab' ? motionTiming.tab : motion === 'stage' ? motionTiming.stage : motion === 'fade' ? 160 : pageDuration;
    const animation = Animated.timing(progress, { toValue: 1, duration, easing: motion === 'tab' ? enterCurve : moveCurve, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [pageKey, direction, motion, progress, reduce]);
  if (motion === 'tab' || motion === 'fade' || motion === 'stage') {
    return {
      opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [motion === 'tab' ? 0.72 : motion === 'stage' ? 0.62 : 0.55, 1] }),
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [motion === 'tab' ? 4 : motion === 'stage' ? 7 : 6, 0] }) }],
    };
  }
  return { opacity: progress, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [direction * 10, 0] }) }] };
}

/** Bridge a host stage change without turning it into a full page transition. */
export function useStageReveal(stageKey: string) {
  return usePageEnter(stageKey, 1, 'stage');
}

/** The scrim and sheet share a clock. Retoggling cancels the old exit callback. */
export function useSheetMotion(visible: boolean) {
  const [lastVisible, setLastVisible] = useState(visible);
  const [exiting, setExiting] = useState(false);
  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));
  const reduce = useReduceMotion();
  if (lastVisible !== visible) {
    setLastVisible(visible);
    setExiting(!visible && motionEnabled && !reduce);
  } else if (reduce && exiting) setExiting(false);
  useLayoutEffect(() => {
    progress.stopAnimation();
    if (!motionEnabled || reduce) { progress.setValue(visible ? 1 : 0); return; }
    let active = true;
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: visible ? motionTiming.sheetIn : motionTiming.sheetOut, easing: enterCurve, useNativeDriver: true });
    animation.start(({ finished }) => { if (active && finished && !visible) setExiting(false); });
    return () => { active = false; animation.stop(); };
  }, [visible, reduce, progress]);
  return {
    present: visible || (motionEnabled && !reduce && exiting),
    backdropStyle: { opacity: progress },
    panelStyle: {
      opacity: progress,
      transform: [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
      ],
    },
  };
}
