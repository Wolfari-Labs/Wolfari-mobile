import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, fonts, radii } from "@/shared/theme/tokens";
import type { DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { GlassSurface } from "./glass-surface";

/**
 * Floating snackbars. One host sits above every screen (root layout), so a message
 * survives navigation (save → go back) and never pushes the page content around.
 * Newest on top, at most three, each dismissible by tap, swipe up or its timer.
 */
export type ToastTone = "success" | "error" | "info" | "notice";
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

const TONES: Record<ToastTone, { badge: string; glyph: string; text: string; label: string }> = {
  success: { badge: colors.mint, glyph: colors.pinGreen, text: "✓", label: "Thành công" },
  error: { badge: colors.errorSurface, glyph: colors.error, text: "!", label: "Lỗi" },
  info: { badge: colors.tealSoft, glyph: colors.teal, text: "i", label: "Thông tin" },
  notice: { badge: colors.butter, glyph: colors.amber, text: "★", label: "Thông báo" },
};

export function ToastHost() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  const insets = useSafeAreaInsets();
  if (!list.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: Math.max(insets.top, Platform.OS === "web" ? 12 : 0) + 8 }]}>
      {list.map((item, index) => <ToastCard key={item.id} item={item} depth={index} />)}
    </View>
  );
}

function ToastCard({ item, depth }: { item: ToastItem; depth: number }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const tone = TONES[item.tone ?? "success"];
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const drag = useSharedValue(0);
  const [paused, setPaused] = useState(false);
  const closing = useRef(false);

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
    if (!reduceMotion) enter.set(withSpring(1, { damping: 18, stiffness: 260, mass: 0.8 }));
    return () => {
      cancelAnimation(enter);
      cancelAnimation(drag);
    };
  }, [enter, drag, reduceMotion]);

  useEffect(() => {
    if (paused) return;
    const duration = item.duration ?? (item.tone === "error" ? 6500 : item.action ? 6000 : 4200);
    const timer = setTimeout(() => close.current(), duration);
    return () => clearTimeout(timer);
  }, [paused, item.duration, item.tone, item.action]);

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
          <View style={[styles.badge, { backgroundColor: tone.badge }]}>
            {item.icon ? <DesignIcon name={item.icon} size={18} tintColor={tone.glyph} /> : <Text style={[styles.glyph, { color: tone.glyph }]}>{tone.text}</Text>}
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
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 8, zIndex: 1000, paddingHorizontal: 14 },
  wrap: { width: "100%", maxWidth: 452 },
  card: { borderRadius: radii.control, boxShadow: "0 14px 36px -8px rgba(31,42,68,0.32), 0 2px 6px rgba(31,42,68,0.08)" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 12, paddingRight: 14, minHeight: 60 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  glyph: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 22 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  message: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, color: colors.ink },
  action: { paddingHorizontal: 12, minHeight: 36, justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.tealSoft },
  actionText: { fontFamily: fonts.heading, fontSize: 13, color: colors.teal },
});
