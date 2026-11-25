import { Image } from "expo-image";
import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { springs } from "@/shared/theme/tokens";
import { designIcons, type DesignIconLayers, type DesignIconName } from "./design-assets";

/** Brand washes keep their shape under a tint instead of turning into a solid blob. */
const WASH_OPACITY = 0.24;

export function DesignIcon({
  name,
  size: customSize,
  tintColor,
  spark = true,
  pop = false,
}: {
  name: DesignIconName;
  size?: number;
  tintColor?: string;
  /** Keep the gold compass-star accent while tinted. Pass false for resting states. */
  spark?: boolean;
  /** Stamp the star in (spin + spring) each time `spark` turns on. For selection states. */
  pop?: boolean;
}) {
  // Preserve the exported SVG's intrinsic geometry; field glyphs are 16.5px.
  const defaultSize = name === "mail" || name === "lock" || name === "edit" ? 16.5 : name === "plane" ? 16 : 22;
  const size = customSize ?? defaultSize;
  const icon: DesignIconLayers = designIcons[name];
  const sparkImage = icon.spark !== undefined && <Image source={icon.spark} style={StyleSheet.absoluteFill}
    tintColor={spark ? undefined : tintColor} contentFit="contain" accessible={false} />;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      {icon.fill !== undefined && <Image source={icon.fill} style={[StyleSheet.absoluteFill, tintColor ? styles.wash : null]}
        tintColor={tintColor} contentFit="contain" accessible={false} />}
      <Image source={icon.line} style={StyleSheet.absoluteFill} tintColor={tintColor} contentFit="contain" accessible={false} />
      {/* Stars and status badges sit on top of the strokes. */}
      {sparkImage && (pop ? <SparkPop on={spark} at={icon.sparkAt}>{sparkImage}</SparkPop> : sparkImage)}
    </View>
  );
}

/** The star lands like the splash: a quarter turn and a stamp spring about its own centre. */
function SparkPop({ on, at = [12, 12], children }: { on: boolean; at?: readonly [number, number]; children: ReactNode }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const progress = useSharedValue(1);
  const was = useRef(on);
  useEffect(() => {
    if (on && !was.current && !reduceMotion) {
      progress.set(0);
      progress.set(withSpring(1, springs.stamp));
    }
    was.current = on;
  }, [on, reduceMotion, progress]);
  useEffect(() => () => cancelAnimation(progress), [progress]);
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return { transform: [{ rotate: `${interpolate(p, [0, 1], [-90, 0])}deg` }, { scale: interpolate(p, [0, 1], [0.2, 1]) }] };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `${(at[0] / 24) * 100}% ${(at[1] / 24) * 100}%` }, style]}>
    {children}
  </Animated.View>;
}

const styles = StyleSheet.create({ wash: { opacity: WASH_OPACITY } });
