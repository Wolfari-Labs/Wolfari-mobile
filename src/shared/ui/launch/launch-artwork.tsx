import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { colors, gradients, springs } from "@/shared/theme/tokens";
import { designAssets } from "../design-assets";

/** Same colour as the native splash, so the hand-off is invisible. */
export const SPLASH_BASE = colors.canvas;

// Stage geometry in points. Wolfi sits exactly where the native splash drew it
// (152 pt, centred); everything else is placed relative to that bust.
const MARK = 152;
const STAGE_W = 240;
const MARK_LEFT = (STAGE_W - MARK) / 2;
const WORD_W = 200;
const WORD_H = WORD_W * 171 / 600; // the wordmark artwork's own ratio
const WORD_LEFT = (STAGE_W - WORD_W) / 2;
const WORD_TOP = MARK + 46; // clears the halo
const HALO = 224;
const STAR = 18.4; // box size; the four points span 20/24 of it

// "Sao la bàn tìm đường": the gold star leaves Wolfi's scarf, arcs over his ear
// and lands as the dot of the "i" in Wolfari.
const FROM = { x: MARK_LEFT + MARK * 0.557, y: MARK * 0.767 };
const VIA = { x: STAGE_W + 8, y: -26 };
const TO = { x: WORD_LEFT + WORD_W * 0.954, y: WORD_TOP + WORD_H * 0.211 };

const FLIGHT_DELAY = 380;
const FLIGHT = 640;
const LANDED = FLIGHT_DELAY + FLIGHT;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const SPARKS = [0, 90, 180, 270];

export function LaunchArtwork({ started, reduceMotion, reduceTransparency, onImageSettled }: {
  started: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  onImageSettled: () => void;
}) {
  const glow = useSharedValue(0);
  const halo = useSharedValue(0.72);
  const spin = useSharedValue(0);
  const lift = useSharedValue(0);
  const squash = useSharedValue(1);
  const tilt = useSharedValue(0);
  const word = useSharedValue(0);
  const flight = useSharedValue(0);
  const land = useSharedValue(1);
  const burst = useSharedValue(0);
  const shown = useSharedValue(0);

  useEffect(() => {
    if (!started) return;
    shown.set(1);
    if (reduceMotion) {
      glow.set(1); halo.set(1); word.set(1); flight.set(1);
      return;
    }
    glow.set(withTiming(1, { duration: 420, easing: EASE_OUT }));
    halo.set(withSpring(1, springs.gentle));
    spin.set(withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1, false));
    // Wolfi hops: crouch, spring up with a little head tilt, land on a soft bounce.
    lift.set(withSequence(
      withTiming(-14, { duration: 210, easing: Easing.out(Easing.quad) }),
      withSpring(0, springs.pin),
    ));
    squash.set(withSequence(
      withTiming(0.95, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1.05, { duration: 160, easing: Easing.out(Easing.quad) }),
      withSpring(1, springs.bouncy),
    ));
    tilt.set(withSequence(withTiming(-5, { duration: 220 }), withSpring(0, springs.gentle)));
    word.set(withDelay(300, withTiming(1, { duration: 460, easing: EASE_OUT })));
    flight.set(withDelay(FLIGHT_DELAY, withTiming(1, { duration: FLIGHT, easing: Easing.bezier(0.45, 0, 0.2, 1) })));
    land.set(withDelay(LANDED, withSequence(withTiming(1.4, { duration: 80 }), withSpring(1, springs.stamp))));
    burst.set(withDelay(LANDED, withTiming(1, { duration: 440, easing: EASE_OUT })));
    return () => {
      for (const value of [glow, halo, spin, lift, squash, tilt, word, flight, land, burst]) cancelAnimation(value);
    };
  }, [started, reduceMotion, shown, glow, halo, spin, lift, squash, tilt, word, flight, land, burst]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: glow.get(),
    transform: [{ scale: halo.get() }, { rotate: `${spin.get() * 360}deg` }],
  }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.get() },
      { rotate: `${tilt.get()}deg` },
      { scaleX: 2 - squash.get() },
      { scaleY: squash.get() },
    ],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.get(),
    transform: [{ translateY: interpolate(word.get(), [0, 1], [12, 0]) }],
  }));
  const starStyle = useAnimatedStyle(() => {
    const t = flight.get();
    const u = 1 - t;
    const x = u * u * FROM.x + 2 * u * t * VIA.x + t * t * TO.x;
    const y = u * u * FROM.y + 2 * u * t * VIA.y + t * t * TO.y;
    const grow = interpolate(t, [0, 0.5, 1], [1.07, 1.55, 1], Extrapolation.CLAMP);
    return {
      opacity: shown.get(),
      transform: [
        { translateX: x - STAR / 2 },
        { translateY: y - STAR / 2 },
        { rotate: `${t * 450}deg` },
        { scale: grow * land.get() },
      ],
    };
  });

  return (
    <View style={styles.screen} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      {!reduceTransparency && <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <LinearGradient colors={gradients.canvas} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>}
      <View style={styles.stage}>
        <Animated.View style={[styles.halo, haloStyle]}>
          <Image source={designAssets.splashHalo} contentFit="contain" transition={0} style={StyleSheet.absoluteFill} accessible={false} />
        </Animated.View>
        <Animated.View testID="splash-mascot-motion" style={[styles.mark, markStyle]}>
          <Image testID="splash-mascot" source={designAssets.brandMark} contentFit="contain" transition={0}
            style={StyleSheet.absoluteFill} onLoad={onImageSettled} onError={onImageSettled} accessible={false} />
        </Animated.View>
        <Animated.View testID="splash-wordmark" style={[styles.word, wordStyle]}>
          <Image source={designAssets.wordmarkDotless} contentFit="contain" transition={0} style={StyleSheet.absoluteFill} accessible={false} />
        </Animated.View>
        {SPARKS.map(angle => <Spark key={angle} angle={angle} burst={burst} />)}
        <Animated.View style={[styles.star, starStyle]}>
          <Image source={designAssets.compassStar} contentFit="contain" transition={0} style={StyleSheet.absoluteFill} accessible={false} />
        </Animated.View>
      </View>
    </View>
  );
}

/** Four tiny glints that kick out from the "i" as the star lands. */
function Spark({ angle, burst }: { angle: number; burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const b = burst.get();
    const distance = 6 + 12 * b;
    const radians = (angle - 45) * Math.PI / 180;
    return {
      opacity: interpolate(b, [0, 0.12, 1], [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: TO.x - 2.5 + Math.cos(radians) * distance },
        { translateY: TO.y - 2.5 + Math.sin(radians) * distance },
        { scale: interpolate(b, [0, 1], [1, 0.4]) },
      ],
    };
  });
  return <Animated.View style={[styles.spark, style]} />;
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: SPLASH_BASE, overflow: "hidden" },
  // The stage's top-left is placed so Wolfi's centre is the screen centre.
  stage: { position: "absolute", left: "50%", top: "50%", width: STAGE_W, height: WORD_TOP + WORD_H, marginLeft: -STAGE_W / 2, marginTop: -MARK / 2 },
  halo: { position: "absolute", width: HALO, height: HALO, left: STAGE_W / 2 - HALO / 2, top: MARK / 2 - HALO / 2 },
  mark: { position: "absolute", left: MARK_LEFT, top: 0, width: MARK, height: MARK, transformOrigin: "50% 100%" },
  word: { position: "absolute", left: WORD_LEFT, top: WORD_TOP, width: WORD_W, height: WORD_H },
  star: { position: "absolute", left: 0, top: 0, width: STAR, height: STAR },
  spark: { position: "absolute", left: 0, top: 0, width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.sun },
});
