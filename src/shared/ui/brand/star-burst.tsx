import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { designAssets } from "../design-assets";

/**
 * A ring of tiny compass stars that kicks out once from the centre of its parent,
 * the same signature as the splash landing. Decorative: hidden from assistive tech,
 * skipped entirely under Reduce Motion. `play` replays the burst each time it changes.
 */
export function StarBurst({ play, count = 6, radius = 26, size = 9, delay = 120 }: {
  play: number | boolean; count?: number; radius?: number; size?: number; delay?: number;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || !play) return;
    progress.set(0);
    progress.set(withDelay(delay, withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) })));
    return () => cancelAnimation(progress);
  }, [play, reduceMotion, delay, progress]);
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={styles.layer} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Spark key={index} progress={progress} angle={(360 / count) * index - 90} radius={radius} size={index % 2 ? size * 0.7 : size} />
      ))}
    </View>
  );
}

function Spark({ progress, angle, radius, size }: { progress: SharedValue<number>; angle: number; radius: number; size: number }) {
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const r = (angle * Math.PI) / 180;
    const d = interpolate(p, [0, 1], [radius * 0.35, radius]);
    return {
      opacity: interpolate(p, [0, 0.15, 0.7, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: Math.cos(r) * d - size / 2 },
        { translateY: Math.sin(r) * d - size / 2 },
        { rotate: `${p * 180}deg` },
        { scale: interpolate(p, [0, 0.4, 1], [0.2, 1.1, 0.6]) },
      ],
    };
  });
  return <Animated.View style={[styles.spark, { width: size, height: size }, style]}>
    <Image source={designAssets.compassStar} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: "50%", top: "50%", width: 0, height: 0, overflow: "visible" },
  spark: { position: "absolute", left: 0, top: 0 },
});
