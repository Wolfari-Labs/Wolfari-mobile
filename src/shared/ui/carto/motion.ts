import { useEffect, useRef } from "react";
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { useMotionActive } from "@/shared/hooks/use-motion-active";
import { useLaunchRevealed } from "@/shared/ui/launch/launch-signal";

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * One-shot entrance progress (0 → 1) for map decorations.
 * - Plays once, the first time the screen is focused, in the foreground and
 *   no longer covered by the launch artwork.
 * - With Reduce Motion it jumps straight to the final state.
 * - A failsafe reveals the element if focus never arrives (e.g. static web render).
 */
export function useEntrance({
  delay = 0,
  duration = 520,
  spring,
}: { delay?: number; duration?: number; spring?: WithSpringConfig } = {}) {
  const focused = useMotionActive();
  const revealed = useLaunchRevealed();
  const active = focused && revealed;
  const { reduceMotion, motionReady } = useAccessibilityPreferences();
  const progress = useSharedValue(0);
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    if (motionReady && reduceMotion) {
      played.current = true;
      progress.set(1);
      return;
    }
    if (active) {
      played.current = true;
      progress.set(
        withDelay(
          delay,
          spring ? withSpring(1, spring) : withTiming(1, { duration, easing: EASE_OUT }),
        ),
      );
    }
  }, [active, motionReady, reduceMotion, delay, duration, spring, progress]);

  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => {
      if (!played.current) {
        played.current = true;
        progress.set(1);
      }
    }, 1600 + delay);
    return () => clearTimeout(timer);
  }, [revealed, delay, progress]);

  useEffect(() => () => cancelAnimation(progress), [progress]);

  return progress;
}

/**
 * A gentle ambient loop (0 → 1 → 0 …) that only runs on the focused,
 * foreground screen and never under Reduce Motion. Stops and rests at 0.
 */
export function useAmbientLoop({ duration = 1800, delay = 0, pingPong = true } = {}) {
  const active = useMotionActive();
  const value = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(value);
    if (!active) {
      value.set(withTiming(0, { duration: 200 }));
      return;
    }
    const step = withTiming(1, { duration, easing: Easing.inOut(Easing.sin) });
    value.set(
      withDelay(
        delay,
        pingPong
          ? withRepeat(withSequence(step, withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })), -1)
          : withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration, easing: Easing.out(Easing.quad) })), -1),
      ),
    );
    return () => cancelAnimation(value);
  }, [active, duration, delay, pingPong, value]);
  return value;
}
