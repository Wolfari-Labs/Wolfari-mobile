import { BlurView } from "expo-blur";
import { useEffect, type RefObject } from "react";
import { Platform, StyleSheet, View, type ViewInstance, type ViewProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, radii } from "@/shared/theme/tokens";

export function BottomBarSurface({ children, style, blurTarget, radius = radii.control, ...props }: ViewProps & {
  blurTarget?: RefObject<ViewInstance | null>;
  radius?: number;
}) {
  const { motionReady, reduceMotion, reduceTransparency } = useAccessibilityPreferences();
  const android = Platform.OS === "android";
  const showBlur = motionReady && !reduceTransparency && (!android || (!!blurTarget && Number(Platform.Version) >= 31));
  // Reveal the blur in place while the surface and its controls keep their positions.
  const cover = useSharedValue(1);
  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.get() }));

  useEffect(() => {
    cover.set(showBlur ? (reduceMotion ? 0 : withTiming(0, { duration: 220 })) : 1);
  }, [cover, reduceMotion, showBlur]);

  const shape = { borderRadius: radius };
  return (
    <View {...props} style={[styles.surface, shape, style]}>
      <View pointerEvents="none" style={[styles.backdrop, shape]}>
        {showBlur ? (
          <>
            <BlurView
              tint="light"
              intensity={48}
              blurTarget={android ? blurTarget : undefined}
              blurMethod={android ? "dimezisBlurViewSdk31Plus" : undefined}
              style={[StyleSheet.absoluteFill, shape]}
            />
            <View style={styles.wash} />
            {!reduceMotion && <Animated.View style={[styles.solid, coverStyle]} />}
          </>
        ) : <View style={styles.solid} />}
      </View>
      {children}
      <View pointerEvents="none" style={[styles.outline, shape]} />
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderCurve: "continuous", boxShadow: "0 6px 22px rgba(43, 72, 123, 0.15)" },
  backdrop: { ...StyleSheet.absoluteFill, borderCurve: "continuous", overflow: "hidden" },
  wash: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(255, 255, 255, 0.66)" },
  solid: { ...StyleSheet.absoluteFill, backgroundColor: colors.surface },
  outline: {
    ...StyleSheet.absoluteFill,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(90, 114, 158, 0.23)",
  },
});
