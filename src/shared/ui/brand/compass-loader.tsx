import { Image } from "expo-image";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { useMotionActive } from "@/shared/hooks/use-motion-active";
import { colors } from "@/shared/theme/tokens";
import { designAssets } from "../design-assets";

const swing = (to: number, duration: number) => withTiming(to, { duration, easing: Easing.inOut(Easing.cubic) });

/**
 * Loading state: Wolfi's compass star hunting for north. It swings past, drifts
 * back, overshoots once more and settles, then starts over. Under Reduce Motion
 * or off-screen it falls back to the system spinner.
 */
export function CompassLoader({ size = 48, label = "Đang tải" }: { size?: number; label?: string }) {
  const active = useMotionActive();
  const { reduceMotion } = useAccessibilityPreferences();
  const turn = useSharedValue(0);
  const moving = active && !reduceMotion;

  useEffect(() => {
    if (!moving) { cancelAnimation(turn); turn.set(0); return; }
    turn.set(withRepeat(withSequence(
      withTiming(0, { duration: 0 }),
      swing(230, 620), swing(170, 380), swing(392, 560), swing(360, 420),
    ), -1));
    return () => cancelAnimation(turn);
  }, [moving, turn]);

  const needle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));

  if (!moving) return <ActivityIndicator color={colors.ink} accessibilityLabel={label} />;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
      <Image source={designAssets.compassDial} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
      <Animated.View style={[StyleSheet.absoluteFill, needle]}>
        <Image source={designAssets.compassNeedle} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
      </Animated.View>
    </View>
  );
}
