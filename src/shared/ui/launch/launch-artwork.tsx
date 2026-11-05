import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/shared/theme/tokens";
import { designAssets } from "../design-assets";
import { webSafeArea } from "../web-safe-area";

export function LaunchArtwork({ started, reduceMotion, reduceTransparency, onImageSettled }: {
  started: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  onImageSettled: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Measure after mount so static web markup and its first client render match.
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const ringSize = Math.max(0, Math.min(width - 40, height * 0.45, 320));
  const copyOffset = Math.min(ringSize / 2 + 20, 172);
  const showFooter = height / 2 - copyOffset - insets.bottom >= 196;
  const reveal = useSharedValue(0);
  const drift = useSharedValue(0);
  const mascotScale = useSharedValue(1);

  useEffect(() => {
    if (!started) return;
    if (reduceMotion) {
      reveal.set(1); drift.set(1); mascotScale.set(1);
    } else {
      reveal.set(withTiming(1, { duration: 420 }));
      drift.set(withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
      mascotScale.set(withSequence(
        withTiming(1.055, { duration: 400, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 500 }),
      ));
    }
    return () => { cancelAnimation(reveal); cancelAnimation(drift); cancelAnimation(mascotScale); };
  }, [started, reduceMotion, reveal, drift, mascotScale]);

  const decorationStyle = useAnimatedStyle(() => ({ opacity: reveal.get() }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-24 + drift.get() * 46}deg` }] }));
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ scale: mascotScale.get() }] }));
  const copyStyle = useAnimatedStyle(() => ({ opacity: reveal.get(), transform: [{ translateY: reduceMotion ? 0 : (1 - reveal.get()) * 8 }] }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden
      onLayout={({ nativeEvent: { layout } }) => setSize(previous => previous.width === layout.width && previous.height === layout.height ? previous : { width: layout.width, height: layout.height })}>
      <Animated.View style={[StyleSheet.absoluteFill, decorationStyle]}>
        {!reduceTransparency && <>
          <LinearGradient colors={[colors.ocean, "#0B5360", "#052F3D"]} locations={[0, 0.64, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.halo, { width: ringSize * 1.7, height: ringSize * 1.7, marginLeft: -ringSize * 0.85, marginTop: -ringSize * 0.85 }]} />
          <View style={[styles.haloInner, { width: ringSize * 1.25, height: ringSize * 1.25, marginLeft: -ringSize * 0.625, marginTop: -ringSize * 0.625 }]} />
        </>}
        <View style={[styles.ringPosition, { width: ringSize, height: ringSize, marginLeft: -ringSize / 2, marginTop: -ringSize / 2 }]}>
          <View style={styles.outerRing} />
          <View style={styles.innerRing} />
          <Animated.View testID="splash-orbit" style={[StyleSheet.absoluteFill, ringStyle]}>
            <View style={styles.orbitStar}><View style={styles.starCore} /></View>
            <View style={styles.secondStar} />
          </Animated.View>
        </View>
      </Animated.View>
      <Animated.View testID="splash-mascot-motion" style={[styles.mascot, mascotStyle]}>
        <Image testID="splash-mascot" source={designAssets.mascot} contentFit="contain" transition={0}
          style={StyleSheet.absoluteFill} onLoad={onImageSettled} onError={onImageSettled} accessible={false} />
      </Animated.View>
      <Animated.View style={[styles.copy, { marginTop: copyOffset }, copyStyle]}>
        <Text allowFontScaling={false} className="text-center text-[44px] font-bold tracking-[-1.8px] text-white">Wolfari<Text style={styles.wordmarkDot}>.</Text></Text>
        <Text allowFontScaling={false} style={styles.tagline}>Cùng nhau, đi xa hơn.</Text>
      </Animated.View>
      <Animated.View style={[styles.top, { top: insets.top + 40 }, webSafeArea.splashTop, copyStyle]}>
        <View style={styles.shortLine} />
        <Text allowFontScaling={false} style={styles.eyebrow}>MỘT HÀNH TRÌNH MỚI</Text>
        <View style={styles.shortLine} />
      </Animated.View>
      {showFooter && <Animated.View style={[styles.bottom, { bottom: insets.bottom + 30 }, webSafeArea.splashBottom, decorationStyle]}>
        <View style={styles.dots}><View style={styles.dot} /><View style={[styles.dot, styles.dotBright]} /><View style={styles.dot} /></View>
        <Text allowFontScaling={false} style={styles.footer}>Những kỷ niệm đẹp đang chờ bạn</Text>
      </Animated.View>}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: "absolute", left: "50%", top: "50%", borderRadius: 999, backgroundColor: "rgba(99,226,207,0.025)" },
  haloInner: { position: "absolute", left: "50%", top: "50%", borderRadius: 999, backgroundColor: "rgba(99,226,207,0.035)" },
  ringPosition: { position: "absolute", left: "50%", top: "50%" },
  outerRing: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 999, borderWidth: 1, borderColor: "rgba(157,232,220,0.20)" },
  innerRing: { position: "absolute", top: 20, left: 20, right: 20, bottom: 20, borderRadius: 999, borderWidth: 1, borderColor: "rgba(157,232,220,0.08)" },
  orbitStar: { position: "absolute", top: -7, left: "50%", width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(157,232,220,0.18)", alignItems: "center", justifyContent: "center" },
  starCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.seafoam },
  secondStar: { position: "absolute", bottom: 0, left: "42%", width: 4, height: 4, borderRadius: 2, backgroundColor: "#E3C48F" },
  // Match the native config's centered 176pt image, without upscaling the source.
  mascot: { position: "absolute", left: "50%", top: "50%", width: 176, height: 176, marginLeft: -88, marginTop: -88 },
  copy: { position: "absolute", top: "50%", left: 24, right: 24, alignItems: "center", gap: 8 },
  wordmarkDot: { color: colors.seafoam },
  tagline: { color: colors.ice, fontSize: 15, lineHeight: 22, textAlign: "center" },
  top: { position: "absolute", left: 24, right: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  shortLine: { width: 20, height: 1, backgroundColor: "rgba(157,232,220,0.45)" },
  eyebrow: { color: colors.seafoam, fontSize: 10, fontWeight: "600", lineHeight: 16, letterSpacing: 2 },
  bottom: { position: "absolute", left: 24, right: 24, alignItems: "center", gap: 14 },
  dots: { flexDirection: "row", gap: 7 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(157,232,220,0.3)" },
  dotBright: { backgroundColor: colors.seafoam },
  footer: { color: "#A8C8CB", fontSize: 12, lineHeight: 18, textAlign: "center" },
});
