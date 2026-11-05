import { StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";

import { colors, springs } from "@/shared/theme/tokens";
import { useAmbientLoop, useEntrance } from "./motion";

/**
 * A numbered map waypoint. It drops onto the map with a little wobble and the
 * active stop keeps a slow "you are heading here" pulse ring.
 */
export function MapPin({
  label,
  color = colors.pinBlue,
  textColor = "#FFFFFF",
  size = 30,
  delay = 0,
  pulse = false,
}: {
  label?: string | number;
  color?: string;
  textColor?: string;
  size?: number;
  delay?: number;
  pulse?: boolean;
}) {
  const drop = useEntrance({ delay, spring: springs.pin });
  const ring = useAmbientLoop({ duration: 1600, pingPong: false });
  const dropStyle = useAnimatedStyle(() => {
    const p = drop.get();
    return {
      opacity: interpolate(p, [0, 0.2], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(p, [0, 1], [-26, 0]) }, { scale: interpolate(p, [0, 1], [0.55, 1]) }],
    };
  });
  const ringStyle = useAnimatedStyle(() => ({
    opacity: pulse ? interpolate(ring.get(), [0, 1], [0.5, 0]) : 0,
    transform: [{ scale: interpolate(ring.get(), [0, 1], [1, 2.2]) }],
  }));
  return (
    <Animated.View accessible={false} style={[{ width: size, height: size }, dropStyle]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: size / 2, borderColor: color }, ringStyle]} />
      <View style={[styles.pin, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
        {label !== undefined && (
          <Text style={[styles.label, { color: textColor, fontSize: size * 0.43 }]}>{label}</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 3 },
  pin: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
    boxShadow: "0 0 0 1.5px #173F63, 0 3px 0 0 rgba(23, 63, 99, 0.25)",
  },
  label: { fontWeight: "800", includeFontPadding: false },
});
