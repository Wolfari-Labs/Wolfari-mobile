import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";

import { springs } from "@/shared/theme/tokens";
import { useEntrance } from "./carto/motion";

/**
 * A one-shot entrance: content rises 14pt onto the paper and fades in, with an
 * optional stagger `delay`. Plays once on first focus; static under Reduce Motion.
 */
export function MotionReveal({ children, delay = 0, style }: PropsWithChildren<{ delay?: number; style?: StyleProp<ViewStyle> }>) {
  const progress = useEntrance({ delay: Math.min(delay, 420), spring: springs.gentle });
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.5], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [14, 0]) }],
  }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
