import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";

import { springs } from "@/shared/theme/tokens";
import { useEntrance } from "../carto/motion";
import { designAssets } from "../design-assets";

// Wordmark artwork is 600 × 171; the compass star is the dot of its "i".
const WORD_RATIO = 171 / 600;
const DOT_X = 0.954;
const DOT_Y = 0.211;
const DOT_SPAN = 0.0764;

/**
 * Wolfi + wordmark. Right after the launch cover lifts, the star the splash
 * just landed stamps onto the "i" here too, and Wolfi gives a small nod.
 * Reduce Motion shows the finished lockup.
 */
export function BrandLockup({ markSize = 44, wordWidth = 112 }: { markSize?: number; wordWidth?: number }) {
  const enter = useEntrance({ delay: 140, spring: springs.stamp });
  const wordHeight = wordWidth * WORD_RATIO;
  const star = wordWidth * DOT_SPAN * 1.2;

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(enter.get(), [0, 1], [-8, 0])}deg` }],
  }));
  const starStyle = useAnimatedStyle(() => {
    const e = enter.get();
    return {
      opacity: interpolate(e, [0, 0.15], [0, 1], Extrapolation.CLAMP),
      transform: [{ rotate: `${interpolate(e, [0, 1], [-180, 0])}deg` }, { scale: interpolate(e, [0, 1], [0.1, 1]) }],
    };
  });

  return (
    <View style={styles.row} accessible={false}>
      <Animated.View style={[{ width: markSize, height: markSize, transformOrigin: "50% 90%" }, markStyle]}>
        <Image source={designAssets.brandMark} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
      </Animated.View>
      <View style={{ width: wordWidth, height: wordHeight }}>
        <Image source={designAssets.wordmarkDotless} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
        <Animated.View style={[{
          position: "absolute", width: star, height: star,
          left: wordWidth * DOT_X - star / 2, top: wordHeight * DOT_Y - star / 2,
        }, starStyle]}>
          <Image source={designAssets.compassStar} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 4 } });
