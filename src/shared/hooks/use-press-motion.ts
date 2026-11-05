import { useState } from "react";
import { cubicBezier } from "react-native-reanimated";

import { useAccessibilityPreferences } from "./use-accessibility-preferences";

const PRESS_EASING = cubicBezier(0.23, 1, 0.32, 1);

/** Two state changes per touch; Reanimated interpolates on the UI thread. */
export function usePressMotion(disabled = false, pressedScale = 0.97) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [pressed, setPressed] = useState(false);
  // Reconcile during render so re-enabling a mid-press control cannot revive it.
  if (pressed && (disabled || reduceMotion)) setPressed(false);
  return {
    animatedStyle: {
      // Clamp legacy call sites: frequent controls should never squash by 8%.
      transform: [{ scale: pressed && !disabled && !reduceMotion ? Math.max(0.97, pressedScale) : 1 }],
      transitionProperty: "transform" as const,
      transitionDuration: reduceMotion || disabled ? 0 : 120,
      transitionTimingFunction: PRESS_EASING,
    },
    onPressIn: () => { if (!disabled && !reduceMotion) setPressed(true); },
    onPressOut: () => setPressed(false),
  };
}
