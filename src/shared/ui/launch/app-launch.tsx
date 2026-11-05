import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { AppState, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useSession } from "@/features/auth/session/session-provider";
import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors } from "@/shared/theme/tokens";
import { LaunchArtwork } from "./launch-artwork";
import { launchTiming, remainingLaunchTime } from "./launch-policy";
import { releaseNativeSplash } from "./native-splash";
import { markLaunchRevealed } from "./launch-signal";

/** Above the router, never a route: deep links and auth restoration keep running. */
export function AppLaunch({ children, assetsReady = true }: PropsWithChildren<{ assetsReady?: boolean }>) {
  const { status } = useSession();
  const { reduceMotion, reduceTransparency, motionReady } = useAccessibilityPreferences();
  const [phase, setPhase] = useState<"cover" | "exit" | "done">("cover");
  const [laidOut, setLaidOut] = useState(false);
  const [imageSettled, setImageSettled] = useState(false);
  const [preferenceExpired, setPreferenceExpired] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const opacity = useSharedValue(1);
  const settleImage = useCallback(() => setImageSettled(true), []);
  const visible = phase !== "done";

  useEffect(() => {
    if (!visible) return;
    const imageTimer = setTimeout(settleImage, launchTiming.assetGrace);
    const preferenceTimer = setTimeout(() => setPreferenceExpired(true), launchTiming.preferenceGrace);
    const safetyTimer = setTimeout(() => { releaseNativeSplash(); setPhase("done"); }, launchTiming.safety);
    const background = AppState.addEventListener("change", state => {
      if (state === "background") { releaseNativeSplash(); setPhase("done"); }
    });
    return () => {
      clearTimeout(imageTimer); clearTimeout(preferenceTimer); clearTimeout(safetyTimer);
      background.remove(); releaseNativeSplash();
    };
  }, [settleImage, visible]);

  useEffect(() => {
    if (!laidOut || !imageSettled || (!motionReady && !preferenceExpired) || startedAt !== null || phase !== "cover") return;
    const frame = requestAnimationFrame(() => { releaseNativeSplash(); setStartedAt(Date.now()); });
    return () => cancelAnimationFrame(frame);
  }, [laidOut, imageSettled, motionReady, preferenceExpired, startedAt, phase]);

  useEffect(() => {
    if (startedAt === null || phase !== "cover") return;
    const wait = remainingLaunchTime(Date.now() - startedAt, status !== "loading" && assetsReady, reduceMotion);
    const timer = setTimeout(() => setPhase("exit"), wait);
    return () => clearTimeout(timer);
  }, [startedAt, phase, status, reduceMotion, assetsReady]);

  useEffect(() => {
    if (phase !== "exit") return;
    const duration = reduceMotion ? 0 : launchTiming.exit;
    opacity.set(duration ? withTiming(0, { duration }) : 0);
    // A missing worklet completion must never trap touch input.
    const timer = setTimeout(() => setPhase("done"), duration);
    return () => { clearTimeout(timer); cancelAnimation(opacity); };
  }, [phase, reduceMotion, opacity]);
  // Let screen entrance animations start as the cover begins to lift.
  useEffect(() => { if (phase !== "cover") markLaunchRevealed(); }, [phase]);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View style={styles.root}>
      <StatusBar style={visible ? "light" : "dark"} />
      {/* Keep the navigator mounted, but hide content from keyboard/accessibility
          while covered. Never apply opacity=0 to ancestors of native GlassViews. */}
      <View style={[styles.content, phase === "cover" && styles.hidden]} pointerEvents={visible ? "none" : "auto"}
        accessibilityElementsHidden={visible} importantForAccessibility={visible ? "no-hide-descendants" : "auto"} aria-hidden={visible}>
        {children}
      </View>
      {visible && <Animated.View testID="app-splash" style={[styles.cover, overlayStyle]}
        accessibilityRole="progressbar" accessibilityLabel="Wolfari đang mở hành trình" accessibilityState={{ busy: true }} aria-busy
        onLayout={() => setLaidOut(true)}>
        <LaunchArtwork started={startedAt !== null} reduceMotion={reduceMotion} reduceTransparency={reduceTransparency} onImageSettled={settleImage} />
      </Animated.View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ocean },
  content: { flex: 1 },
  hidden: { display: "none" },
  cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, backgroundColor: colors.ocean, overflow: "hidden" },
});
