import { useState } from "react";
import { cubicBezier } from "react-native-reanimated";

import { useAccessibilityPreferences } from "./use-accessibility-preferences";

const PRESS_EASING = cubicBezier(0.23, 1, 0.32, 1);

/**
 * Paper buttons sit on a solid "shadow plate". Pressing pushes the face down
 * onto the plate (like pressing a rubber stamp) instead of shrinking it.
 * Two state changes per touch; Reanimated interpolates on the UI thread.
 */
export function usePaperPress(disabled = false, depth = 3) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [pressed, setPressed] = useState(false);
  if (pressed && disabled) setPressed(false);
  const down = pressed && !disabled;
  return {
    pressed: down,
    faceStyle: {
      transform: [{ translateY: down ? depth : 0 }],
      transitionProperty: "transform" as const,
      transitionDuration: reduceMotion || disabled ? 0 : down ? 70 : 160,
      transitionTimingFunction: PRESS_EASING,
    },
    onPressIn: () => { if (!disabled) setPressed(true); },
    onPressOut: () => setPressed(false),
  };
}
