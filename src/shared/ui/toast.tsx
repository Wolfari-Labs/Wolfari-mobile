import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, fonts, radii, springs } from "@/shared/theme/tokens";
import { StarBurst } from "./brand/star-burst";
import { designAssets, type DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { GlassSurface } from "./glass-surface";

/**
 * Floating snackbars. One host sits above every screen (root layout), so a message
 * survives navigation (save → go back) and never pushes the page content around.
 * Newest on top, at most three, each dismissible by tap, swipe up or its timer.
 */
export type ToastTone = "success" | "error" | "warning" | "info" | "notice" | "celebrate";
export type ToastInput = {
  message: string;
  title?: string;
  tone?: ToastTone;
  icon?: DesignIconName;
  action?: { label: string; onPress: () => void };
  /** Milliseconds; errors and actionable toasts stay longer by default. */
  duration?: number;
};
type ToastItem = ToastInput & { id: number };

const listeners = new Set<() => void>();
let items: ToastItem[] = [];
let nextId = 1;
// Where toasts start: just under the focused screen's app bar (Screen sets it on focus).
let toastTop: number | undefined;
const topListeners = new Set<() => void>();
export function setToastTop(value: number) {
  if (toastTop === value) return;
  toastTop = value;
  topListeners.forEach(listener => listener());
}
const subscribeTop = (listener: () => void) => { topListeners.add(listener); return () => { topListeners.delete(listener); }; };
const topSnapshot = () => toastTop;
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => items;

export function showToast(input: ToastInput): number {
  const item = { ...input, id: nextId++ };
  // The same sentence twice in a row replaces itself instead of stacking.
  items = [item, ...items.filter((old) => old.message !== input.message || old.title !== input.title)].slice(0, 3);
  emit();
  return item.id;
}
export function dismissToast(id: number) {
  if (!items.some((item) => item.id === id)) return;
  items = items.filter((item) => item.id !== id);
  emit();
}
/** Test/sign-out helper: drops every pending message. */
export function clearToasts() {
  items = [];
  emit();
}

export const toast = {
  success: (message: string, extra?: Omit<ToastInput, "message" | "tone">) => showToast({ ...extra, message, tone: "success" }),
  error: (message: string, extra?: Omit<ToastInput, "message" | "tone">) => showToast({ ...extra, message, tone: "error" }),
  info: (message: string, extra?: Omit<ToastInput, "message" | "tone">) => showToast({ ...extra, message, tone: "info" }),
  notice: (message: string, extra?: Omit<ToastInput, "message" | "tone">) => showToast({ ...extra, message, tone: "notice" }),
  warning: (message: string, extra?: Omit<ToastInput, "message" | "tone">) => showToast({ ...extra, message, tone: "warning" }),
  /** For milestones (a trip created, a fund settled): Wolfi waves and the compass stars burst. */
  celebrate: (message: string, extra?: Omit<ToastInput, "message" | "tone">) => showToast({ ...extra, message, tone: "celebrate" }),
};

/**
 * Shows `message` as a toast whenever it changes to a new non-empty value.
 * For screens that keep "saved" text in state; renders nothing in place.
 */
export function Snackbar({ message, tone = "success", title }: { message?: string | null; tone?: ToastTone; title?: string }) {
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!message) {
      shown.current = null;
      return;
    }
    if (shown.current === message) return;
    shown.current = message;
    showToast({ message, tone, title });
  }, [message, tone, title]);
  return null;
}

/**
 * Each tone's badge moves once as the card lands, in the brand's motion vocabulary:
 * success stamps like the splash star, errors shake, warnings pulse, info spins the
 * compass in, push notices ring the bell and celebrations make Wolfi hop.
 */
type BadgeMotion = "stamp" | "shake" | "pulse" | "spin" | "ring" | "hop";
const TONES: Record<ToastTone, { badge: string; glyph: string; text?: string; icon?: DesignIconName; label: string; motion: BadgeMotion; burst?: boolean }> = {
  success: { badge: colors.mint, glyph: colors.pinGreen, icon: "check", label: "Thành công", motion: "stamp", burst: true },
  error: { badge: colors.errorSurface, glyph: colors.error, text: "!", label: "Lỗi", motion: "shake" },
  warning: { badge: colors.butter, glyph: colors.amber, text: "!", label: "Cần chú ý", motion: "pulse" },
  info: { badge: colors.tealSoft, glyph: colors.teal, icon: "compass", label: "Thông tin", motion: "spin" },
  notice: { badge: colors.butter, glyph: colors.amber, icon: "bell", label: "Thông báo", motion: "ring" },
  celebrate: { badge: colors.lilac, glyph: colors.violet, label: "Tuyệt vời", motion: "hop", burst: true },
};
const BADGE_START: Record<BadgeMotion, number> = { stamp: 0, shake: 0, pulse: 1, spin: 0, ring: 0, hop: 0 };
const BADGE_REST: Record<BadgeMotion, number> = { stamp: 1, shake: 0, pulse: 1, spin: 1, ring: 0, hop: 0 };

export function ToastHost() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  const insets = useSafeAreaInsets();
  const top = useSyncExternalStore(subscribeTop, topSnapshot, topSnapshot);
  if (!list.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: top ?? Math.max(insets.top, Platform.OS === "web" ? 12 : 0) + 8 }]}>
      {list.map((item, index) => <ToastCard key={item.id} item={item} depth={index} />)}
    </View>
  );
}

function ToastCard({ item, depth }: { item: ToastItem; depth: number }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const tone = TONES[item.tone ?? "success"];
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const drag = useSharedValue(0);
  const badge = useSharedValue(reduceMotion ? BADGE_REST[tone.motion] : BADGE_START[tone.motion]);
  const timeLeft = useSharedValue(1);
  const [paused, setPaused] = useState(false);
  const closing = useRef(false);
  const total = item.duration ?? (item.tone === "error" ? 6500 : item.action ? 6000 : item.tone === "celebrate" ? 5200 : 4200);
  const remaining = useRef(total);

  const close = useRef(() => {});
  useEffect(() => {
    close.current = () => {
      if (closing.current) return;
      closing.current = true;
      if (reduceMotion) {
        dismissToast(item.id);
        return;
      }
      enter.set(withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }));
      // A JS timer (not a worklet callback) so a dropped animation frame never strands the card.
      setTimeout(() => dismissToast(item.id), 190);
    };
  });

  useEffect(() => {
    if (!reduceMotion) {
      enter.set(withSpring(1, { damping: 18, stiffness: 260, mass: 0.8 }));
      badge.set(withDelay(140, badgeMotion(tone.motion)));
    }
    return () => {
      cancelAnimation(enter);
      cancelAnimation(drag);
      cancelAnimation(badge);
    };
  }, [enter, drag, badge, reduceMotion, tone.motion]);

  // The countdown pauses while the card is held and resumes with the time that was left.
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    if (!reduceMotion) timeLeft.set(withTiming(0, { duration: remaining.current, easing: Easing.linear }));
    const timer = setTimeout(() => close.current(), remaining.current);
    return () => {
      clearTimeout(timer);
      cancelAnimation(timeLeft);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [paused, reduceMotion, timeLeft]);

  // The responder only reads refs when a gesture event arrives, never during render.
  /* eslint-disable react-hooks/refs */
  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => setPaused(true),
    onPanResponderMove: (_, gesture) => {
      // Upward follows the finger; downward resists so the card feels anchored.
      drag.set(gesture.dy < 0 ? gesture.dy : gesture.dy * 0.25);
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy < -28 || gesture.vy < -0.45) close.current();
      else {
        drag.set(withSpring(0, { damping: 18, stiffness: 300 }));
        setPaused(false);
      }
    },
    onPanResponderTerminate: () => {
      drag.set(withSpring(0, { damping: 18, stiffness: 300 }));
      setPaused(false);
    },
  }));
  /* eslint-enable react-hooks/refs */

  const style = useAnimatedStyle(() => {
    const p = enter.get();
    return {
      opacity: Math.min(1, p * 1.4),
      transform: [
        { translateY: (1 - p) * -36 + drag.get() },
        { scale: 0.94 + 0.06 * p - depth * 0.03 },
      ],
    };
  });
  const motion = tone.motion;
  const iconName = item.icon ?? tone.icon;
  const badgeStyle = useAnimatedStyle(() => {
    const m = badge.get();
    switch (motion) {
      case "stamp": return { transform: [{ rotate: `${(1 - m) * -30}deg` }, { scale: 0.3 + 0.7 * m }] };
      case "shake": return { transform: [{ translateX: m }] };
      case "pulse": return { transform: [{ scale: m }] };
      case "spin": return { transform: [{ rotate: `${(1 - m) * -180}deg` }, { scale: 0.6 + 0.4 * m }] };
      case "ring": return { transform: [{ rotate: `${m}deg` }] };
      default: return { transform: [{ translateY: m }] };
    }
  });
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: timeLeft.get() }] }));

  return (
    <Animated.View style={[styles.wrap, { zIndex: 10 - depth }, style]} {...pan.panHandlers}>
      <GlassSurface variant="prominent" style={styles.card}>
        <Pressable
          cssInterop={false}
          accessibilityRole={item.tone === "error" ? "alert" : "text"}
          accessibilityLiveRegion={item.tone === "error" ? "assertive" : "polite"}
          accessibilityLabel={`${item.title ?? tone.label}: ${item.message}`}
          accessibilityHint="Chạm để đóng"
          onPress={() => close.current()}
          onPressIn={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          style={styles.row}
        >
          <View style={styles.badgeSlot}>
            {tone.burst && <StarBurst play={item.id} />}
            <Animated.View style={[styles.badge, { backgroundColor: tone.badge, transformOrigin: motion === "ring" ? "50% 15%" : "50% 50%" }, badgeStyle]}>
              {item.tone === "celebrate" && !item.icon
                ? <Image source={designAssets.wolfiWave} style={styles.wolfi} contentFit="contain" accessible={false} />
                : iconName
                  ? <DesignIcon name={iconName} size={18} tintColor={tone.glyph} />
                  : <Text style={[styles.glyph, { color: tone.glyph }]}>{tone.text}</Text>}
            </Animated.View>
          </View>
          <View style={styles.copy}>
            {item.title && <Text style={styles.title} numberOfLines={1}>{item.title}</Text>}
            <Text style={styles.message} numberOfLines={3}>{item.message}</Text>
          </View>
          {item.action && (
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel={item.action.label}
              hitSlop={8}
              onPress={() => {
                item.action?.onPress();
                close.current();
              }}
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.actionText}>{item.action.label}</Text>
            </Pressable>
          )}
        </Pressable>
        {!reduceMotion && <Animated.View pointerEvents="none" style={[styles.timer, { backgroundColor: tone.glyph }, barStyle]} />}
      </GlassSurface>
    </Animated.View>
  );
}

function badgeMotion(motion: BadgeMotion) {
  const t = (to: number, duration: number) => withTiming(to, { duration, easing: Easing.inOut(Easing.quad) });
  switch (motion) {
    case "stamp": return withSpring(1, springs.stamp);
    case "shake": return withSequence(t(-6, 50), t(6, 70), t(-4, 60), t(4, 60), t(0, 50));
    case "pulse": return withSequence(t(1.16, 140), t(1, 140), t(1.1, 120), t(1, 140));
    case "spin": return withSpring(1, springs.gentle);
    case "ring": return withSequence(t(18, 90), t(-15, 110), t(11, 100), t(-7, 90), t(3, 80), t(0, 70));
    default: return withSequence(t(-7, 160), withSpring(0, springs.pin));
  }
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 8, zIndex: 1000, paddingHorizontal: 14 },
  wrap: { width: "100%", maxWidth: 452 },
  card: { borderRadius: radii.control, boxShadow: "0 14px 36px -8px rgba(31,42,68,0.32), 0 2px 6px rgba(31,42,68,0.08)" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 12, paddingRight: 14, minHeight: 60 },
  badgeSlot: { width: 36, height: 36 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  wolfi: { width: 34, height: 40, marginTop: 8 },
  timer: { position: "absolute", left: 18, right: 18, bottom: 0, height: 3, borderRadius: 2, opacity: 0.45, transformOrigin: "0% 50%" },
  glyph: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 22 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  message: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, color: colors.ink },
  action: { paddingHorizontal: 12, minHeight: 36, justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.tealSoft },
  actionText: { fontFamily: fonts.heading, fontSize: 13, color: colors.teal },
});
