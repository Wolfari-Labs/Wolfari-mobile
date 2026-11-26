import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, fonts } from "@/shared/theme/tokens";
import { designAssets } from "../design-assets";

/** How far the page moves for a full pull, where a release refreshes, and where it rests while syncing. */
const MAX = 150, TRIGGER = 88, HOLD = 92;
/** A sync shorter than this still shows Wolfi long enough to be read as "done". */
const MIN_SYNC_MS = 700;

/**
 * Pull-to-refresh with Wolfi (Claude Design board "Wolfi trong app" · Kéo để làm mới):
 * pulling the page down lowers Wolfi's head into the gap; past the line he is ready, and on
 * release he shakes his head while the screen syncs, then the page slides back.
 * Wraps the screen's ScrollView, which keeps its own native scrolling. Off on the web.
 */
export function WolfiRefresh({ enabled, refreshing, onRefresh, scrollY, children }: {
  enabled: boolean; refreshing: boolean; onRefresh?: () => void;
  /** The ScrollView's vertical offset, updated from its onScroll. */
  scrollY: SharedValue<number>;
  children: ReactNode;
}) {
  const pull = useSharedValue(0);
  const base = useRef(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const started = useRef(0);
  const latest = useRef(onRefresh);
  const begin = useRef(() => {});
  useEffect(() => {
    latest.current = onRefresh;
    begin.current = () => {
      syncingRef.current = true;
      started.current = Date.now();
      setSyncing(true);
      latest.current?.();
    };
  }, [onRefresh]);
  const active = enabled && !!onRefresh && Platform.OS !== "web";

  // Release once the screen reports it is no longer loading (and Wolfi has been seen).
  useEffect(() => {
    if (!syncing || refreshing) return;
    const wait = Math.max(0, MIN_SYNC_MS - (Date.now() - started.current));
    const timer = setTimeout(() => {
      syncingRef.current = false;
      setSyncing(false);
      pull.set(withSpring(0, { damping: 18, stiffness: 180 }));
    }, wait);
    return () => clearTimeout(timer);
  }, [syncing, refreshing, pull]);

  // Callbacks read refs only when a gesture event arrives, never during render.
  /* eslint-disable react-hooks/refs */
  const gesture = useMemo(() => {
    const native = Gesture.Native();
    const pan = Gesture.Pan()
      .enabled(active)
      .runOnJS(true)
      .activeOffsetY(10)
      .failOffsetY(-10)
      .failOffsetX([-24, 24])
      .onStart(() => { base.current = 0; })
      .onUpdate(event => {
        if (syncingRef.current) return;
        // While the list still scrolls back to its top, the finger only scrolls it.
        if (scrollY.get() > 0.5) { base.current = event.translationY; return; }
        const distance = Math.max(0, event.translationY - base.current);
        // Resistance grows with distance, so the page never runs away from the finger.
        pull.set(MAX * (1 - Math.exp(-distance / (MAX * 1.6))));
      })
      .onEnd(() => {
        if (syncingRef.current) return;
        if (pull.get() >= TRIGGER) {
          pull.set(withSpring(HOLD, { damping: 16, stiffness: 220 }));
          begin.current();
        } else pull.set(withSpring(0, { damping: 18, stiffness: 220 }));
      });
    return Gesture.Simultaneous(native, pan);
  }, [active, pull, scrollY]);
  /* eslint-enable react-hooks/refs */

  const page = useAnimatedStyle(() => ({ transform: [{ translateY: pull.get() }] }));
  if (!active) return <>{children}</>;
  return <View style={styles.fill}>
    <PullIndicator pull={pull} syncing={syncing} />
    <Animated.View style={[styles.fill, page]}>
      <GestureDetector gesture={gesture}>{children}</GestureDetector>
    </Animated.View>
  </View>;
}

function PullIndicator({ pull, syncing }: { pull: SharedValue<number>; syncing: boolean }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const shake = useSharedValue(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!syncing || reduceMotion) { shake.set(withTiming(0, { duration: 120 })); return; }
    // A curious head tilt left and right, on repeat while the screen syncs.
    shake.set(withRepeat(withSequence(
      withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) }),
      withTiming(-1, { duration: 420, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 260, easing: Easing.inOut(Easing.quad) }),
    ), -1, false));
    return () => cancelAnimation(shake);
  }, [syncing, reduceMotion, shake]);

  // The "release" hint flips once the pull passes the line; checked on a light timer, not per frame.
  useEffect(() => {
    const timer = setInterval(() => setReady(pull.get() >= TRIGGER), 90);
    return () => clearInterval(timer);
  }, [pull]);

  const head = useAnimatedStyle(() => {
    const p = pull.get();
    return {
      opacity: interpolate(p, [8, 40], [0, 1], "clamp"),
      transform: [
        // He drops in from above the edge as the gap opens.
        { translateY: interpolate(p, [0, HOLD], [-56, 0], "clamp") },
        { scale: interpolate(p, [0, TRIGGER, MAX], [0.6, 1, 1.06], "clamp") },
        { rotate: `${shake.get() * 12 + interpolate(p, [0, TRIGGER], [-8, 0], "clamp")}deg` },
      ],
    };
  });
  const label = useAnimatedStyle(() => ({ opacity: interpolate(pull.get(), [TRIGGER * 0.6, TRIGGER], [0, 1], "clamp") }));
  const text = syncing ? "Wolfi đang đồng bộ…" : ready ? "Thả ra để làm mới" : "Kéo xuống để làm mới";
  return <View pointerEvents="none" style={styles.indicator}
    accessible={syncing} accessibilityRole={syncing ? "progressbar" : undefined} accessibilityLabel={syncing ? text : undefined}
    accessibilityLiveRegion="polite">
    <Animated.View style={[styles.head, head]}>
      <Image source={designAssets.wolfiBust} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
    </Animated.View>
    <Animated.View style={[styles.pill, label]}><Text style={styles.pillText}>{text}</Text></Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  indicator: { position: "absolute", top: 0, left: 0, right: 0, height: HOLD, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6, gap: 2 },
  head: { width: 58, height: 62, transformOrigin: "50% 85%" },
  pill: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.85)" },
  pillText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 15, color: colors.muted },
});
