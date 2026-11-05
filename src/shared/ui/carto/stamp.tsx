import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";

import { colors, springs } from "@/shared/theme/tokens";
import { useEntrance } from "./motion";

const TONES = {
  orange: colors.orange,
  green: colors.pinGreen,
  ink: colors.ink,
  teal: colors.teal,
} as const;

/**
 * A rubber-stamp label ("SẮP ĐI", "CÒN 4 MÓN"). It lands from above, slightly
 * oversized, and settles at its tilt — a small celebration of state.
 */
export function Stamp({
  label,
  tone = "orange",
  rotate = -6,
  delay = 160,
  small = false,
  style,
}: {
  label: string;
  tone?: keyof typeof TONES;
  rotate?: number;
  delay?: number;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useEntrance({ delay, spring: springs.stamp });
  const color = TONES[tone];
  const animated = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.25, 1], [0, 1, 1], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(p, [0, 1], [1.9, 1]) },
        { rotate: `${interpolate(p, [0, 1], [rotate - 14, rotate])}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.stamp, small && styles.small, { borderColor: color }, animated, style]}>
      <Text style={[styles.label, small && styles.smallLabel, { color }]}>{label.toLocaleUpperCase("vi-VN")}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    alignSelf: "flex-start",
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: "rgba(255, 253, 247, 0.9)",
  },
  small: { borderWidth: 1.5, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  label: { fontSize: 11, lineHeight: 16, fontWeight: "800", letterSpacing: 1.4 },
  smallLabel: { fontSize: 9.5, lineHeight: 14, letterSpacing: 1.1 },
});
