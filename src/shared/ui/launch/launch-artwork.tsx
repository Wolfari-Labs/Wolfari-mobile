import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts } from "@/shared/theme/tokens";
import { designAssets } from "../design-assets";
import { DesignIcon } from "../design-icon";
import { webSafeArea } from "../web-safe-area";

/** Solid colour of the native splash (app.json); the first JS frame must match it exactly. */
export const SPLASH_BASE = "#E6EEFF";

/**
 * Pastel morning sky: the native splash shows the mascot on SPLASH_BASE, then this cover
 * fades in the sky gradient, raises the sun, drifts two clouds and flies a paper plane
 * around the mascot on a dashed orbit. Under Reduce Motion everything appears at rest.
 */
export function LaunchArtwork({ started, reduceMotion, reduceTransparency, onImageSettled }: {
  started: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  onImageSettled: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Measure after mount so static web markup and its first client render match.
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const ringSize = Math.max(0, Math.min(width - 56, height * 0.4, 300));
  const copyOffset = Math.min(ringSize / 2 + 26, 176);
  const showFooter = height / 2 - copyOffset - insets.bottom >= 196;
  const reveal = useSharedValue(0);
  const drift = useSharedValue(0);
  const orbit = useSharedValue(0);
  const mascotScale = useSharedValue(1);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!started) return;
    if (reduceMotion) {
      reveal.set(1); drift.set(1); orbit.set(0.12); mascotScale.set(1); pulse.set(0);
    } else {
      reveal.set(withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
      drift.set(withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }));
      orbit.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1));
      mascotScale.set(withSequence(
        withTiming(1.06, { duration: 380, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 420, easing: Easing.inOut(Easing.cubic) }),
      ));
      pulse.set(withDelay(300, withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1)));
    }
    return () => { cancelAnimation(reveal); cancelAnimation(drift); cancelAnimation(orbit); cancelAnimation(mascotScale); cancelAnimation(pulse); };
  }, [started, reduceMotion, reveal, drift, orbit, mascotScale, pulse]);

  const skyStyle = useAnimatedStyle(() => ({ opacity: reveal.get() }));
  const sunStyle = useAnimatedStyle(() => ({ opacity: reveal.get(), transform: [{ translateY: (1 - drift.get()) * 36 }, { scale: 0.92 + drift.get() * 0.08 }] }));
  const cloudLeft = useAnimatedStyle(() => ({ opacity: reveal.get() * 0.95, transform: [{ translateX: -18 + drift.get() * 18 }] }));
  const cloudRight = useAnimatedStyle(() => ({ opacity: reveal.get() * 0.9, transform: [{ translateX: 20 - drift.get() * 20 }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: reveal.get(), transform: [{ rotate: `${orbit.get() * 360}deg` }] }));
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ scale: mascotScale.get() }] }));
  const copyStyle = useAnimatedStyle(() => ({ opacity: reveal.get(), transform: [{ translateY: reduceMotion ? 0 : (1 - reveal.get()) * 10 }] }));
  const dot1 = useAnimatedStyle(() => dotStyle(pulse.get(), 0));
  const dot2 = useAnimatedStyle(() => dotStyle(pulse.get(), 0.2));
  const dot3 = useAnimatedStyle(() => dotStyle(pulse.get(), 0.4));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: SPLASH_BASE }]} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden
      onLayout={({ nativeEvent: { layout } }) => setSize(previous => previous.width === layout.width && previous.height === layout.height ? previous : { width: layout.width, height: layout.height })}>
      <Animated.View style={[StyleSheet.absoluteFill, skyStyle]}>
        <LinearGradient colors={["#D6E6FF", "#EEE8FF", "#DCF6EC"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {!reduceTransparency && <>
        <Animated.View style={[styles.sun, { top: insets.top + height * 0.1, right: width * 0.12 }, sunStyle]} />
        <Animated.View style={[styles.cloud, { top: insets.top + height * 0.16, left: width * 0.08, width: 96 }, cloudLeft]} />
        <Animated.View style={[styles.cloud, styles.cloudSmall, { top: insets.top + height * 0.2 + 20, left: width * 0.2, width: 58 }, cloudLeft]} />
        <Animated.View style={[styles.cloud, { bottom: insets.bottom + height * 0.1, right: width * 0.08, width: 84 }, cloudRight]} />
      </>}
      <View style={[styles.ringPosition, { width: ringSize, height: ringSize, marginLeft: -ringSize / 2, marginTop: -ringSize / 2 }]}>
        <View style={[styles.halo, { borderRadius: ringSize / 2 }]} />
        <Animated.View testID="splash-orbit" style={[StyleSheet.absoluteFill, ringStyle]}>
          <View style={[styles.orbit, { borderRadius: ringSize / 2 }]} />
          <View style={styles.plane}><DesignIcon name="plane" size={16} tintColor={colors.surface} /></View>
        </Animated.View>
      </View>
      <Animated.View testID="splash-mascot-motion" style={[styles.mascot, mascotStyle]}>
        <Image testID="splash-mascot" source={designAssets.mascot} contentFit="contain" transition={0}
          style={StyleSheet.absoluteFill} onLoad={onImageSettled} onError={onImageSettled} accessible={false} />
      </Animated.View>
      <Animated.View style={[styles.copy, { marginTop: copyOffset }, copyStyle]}>
        <Text allowFontScaling={false} style={styles.wordmark}>Wolfari<Text style={styles.wordmarkDot}>.</Text></Text>
        <Text allowFontScaling={false} style={styles.tagline}>Cùng nhau, đi xa hơn.</Text>
        <View style={styles.dots}>
          <Animated.View style={[styles.dot, dot1]} />
          <Animated.View style={[styles.dot, styles.dotMint, dot2]} />
          <Animated.View style={[styles.dot, styles.dotSun, dot3]} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.top, { top: insets.top + 36 }, webSafeArea.splashTop, copyStyle]}>
        <View style={styles.shortLine} />
        <Text allowFontScaling={false} style={styles.eyebrow}>MỘT HÀNH TRÌNH MỚI</Text>
        <View style={styles.shortLine} />
      </Animated.View>
      {showFooter && <Animated.View style={[styles.bottom, { bottom: insets.bottom + 28 }, webSafeArea.splashBottom, copyStyle]}>
        <Text allowFontScaling={false} style={styles.footer}>Những kỷ niệm đẹp đang chờ bạn</Text>
      </Animated.View>}
    </View>
  );
}

/** A loading dot that lifts and brightens once per cycle, staggered by `offset`. */
function dotStyle(progress: number, offset: number) {
  "worklet";
  const phase = (progress + offset) % 1;
  const lift = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  return { opacity: 0.35 + lift * 0.65, transform: [{ translateY: -lift * 4 }] };
}

const styles = StyleSheet.create({
  sun: { position: "absolute", width: 92, height: 92, borderRadius: 46, backgroundColor: "#FFE29A", boxShadow: "0 0 0 14px rgba(255,226,154,0.35), 0 0 0 30px rgba(255,226,154,0.16)" },
  cloud: { position: "absolute", height: 30, borderRadius: 15, backgroundColor: "#FFFFFF", boxShadow: "0 6px 14px rgba(92,122,199,0.12)" },
  cloudSmall: { height: 20, borderRadius: 10 },
  ringPosition: { position: "absolute", left: "50%", top: "50%" },
  halo: { position: "absolute", top: "12%", left: "12%", right: "12%", bottom: "12%", backgroundColor: "rgba(255,255,255,0.72)", boxShadow: "0 18px 44px -10px rgba(92,122,199,0.35)" },
  orbit: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(91,140,255,0.45)" },
  plane: { position: "absolute", top: -14, left: "50%", marginLeft: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.plane, alignItems: "center", justifyContent: "center", transform: [{ rotate: "90deg" }], boxShadow: "0 4px 10px rgba(242,163,58,0.45)" },
  // Match the native config's centered 176pt image, without upscaling the source.
  mascot: { position: "absolute", left: "50%", top: "50%", width: 176, height: 176, marginLeft: -88, marginTop: -88 },
  copy: { position: "absolute", top: "50%", left: 24, right: 24, alignItems: "center", gap: 6 },
  wordmark: { fontFamily: fonts.heading, fontSize: 44, lineHeight: 52, letterSpacing: -1.6, color: colors.ink, textAlign: "center" },
  wordmarkDot: { color: colors.gradientMint },
  tagline: { fontFamily: fonts.bold, color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  dots: { flexDirection: "row", gap: 8, marginTop: 14, height: 14, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gradientBlue },
  dotMint: { backgroundColor: colors.gradientMint },
  dotSun: { backgroundColor: colors.plane },
  top: { position: "absolute", left: 24, right: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  shortLine: { width: 20, height: 1.5, borderRadius: 1, backgroundColor: "rgba(36,92,184,0.35)" },
  eyebrow: { fontFamily: fonts.bold, color: colors.teal, fontSize: 10, lineHeight: 16, letterSpacing: 2 },
  bottom: { position: "absolute", left: 24, right: 24, alignItems: "center" },
  footer: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
