import { Image } from "expo-image";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";

import { springs } from "@/shared/theme/tokens";
import { useAmbientLoop, useEntrance } from "./motion";

export const wolfiPoses = {
  map: require("@/assets/carto/wolfi-map.png"),
  scooter: require("@/assets/carto/wolfi-scooter.png"),
  wink: require("@/assets/carto/wolfi-wink.png"),
  starry: require("@/assets/carto/wolfi-starry.png"),
  walk: require("@/assets/carto/wolfi-walk.png"),
  front: require("@/assets/carto/wolfi-front.png"),
  happy: require("@/assets/carto/wolfi-happy.png"),
  sunset: require("@/assets/carto/wolfi-sunset.png"),
};

export type WolfiPose = keyof typeof wolfiPoses;

/**
 * Wolfi, the mascot, hops in once and then floats gently while the screen is
 * focused. `drive` swaps the float for a small side-to-side scooter wobble.
 */
export function Wolfi({
  pose,
  size = 96,
  delay = 220,
  motion = "float",
  label,
  style,
}: {
  pose: WolfiPose;
  size?: number;
  delay?: number;
  motion?: "float" | "drive" | "none";
  /** Pass a label only when Wolfi conveys meaning; otherwise it is decorative. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const enter = useEntrance({ delay, spring: springs.bouncy });
  const loop = useAmbientLoop({ duration: motion === "drive" ? 900 : 1700, delay: delay + 500 });
  const animated = useAnimatedStyle(() => {
    const e = enter.get();
    const l = motion === "none" ? 0 : loop.get();
    return {
      opacity: interpolate(e, [0, 0.3], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(e, [0, 1], [18, 0]) + (motion === "float" ? -5 * l : 0) },
        { translateX: motion === "drive" ? -3 + 6 * l : 0 },
        { rotate: `${motion === "drive" ? -2 + 4 * l : 0}deg` },
        { scale: interpolate(e, [0, 1], [0.82, 1]) },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      accessible={!!label}
      accessibilityLabel={label}
      accessibilityRole={label ? "image" : undefined}
      style={[{ width: size, height: size }, animated, style]}
    >
      <Image source={wolfiPoses[pose]} style={{ width: size, height: size }} contentFit="contain" accessible={false} />
    </Animated.View>
  );
}
