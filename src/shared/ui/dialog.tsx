import { Image } from "expo-image";
import { useEffect, useState, type PropsWithChildren } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, fonts, radii, springs, typography } from "@/shared/theme/tokens";
import { StarBurst } from "./brand/star-burst";
import { designAssets, type DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";

/**
 * Centred pop-up for moments that need an answer or deserve a beat.
 *
 * - `celebrate`: a milestone. Wolfi waves in with a burst of compass stars.
 * - `confirm`: the user is about to do something (often irreversible). A status icon only,
 *   never Wolfi: a smiling mascot next to "Xóa" would soften what is about to happen.
 * - `error`: something failed but can be retried. A status icon by default; pass
 *   `wolfi="map"` for gentle, recoverable problems (offline, upload failed).
 *
 * Pass the actions as children (Buttons), like `Sheet`. Under Reduce Motion it simply appears.
 */
export type DialogKind = "celebrate" | "confirm" | "error";

const TINTS: Record<DialogKind, { halo: string; glyph: string }> = {
  celebrate: { halo: colors.lilac, glyph: colors.violet },
  confirm: { halo: colors.errorSurface, glyph: colors.error },
  error: { halo: colors.errorSurface, glyph: colors.error },
};

export function Dialog({ visible, kind, title, message, icon, wolfi, onClose, dismissible = true, children }: PropsWithChildren<{
  visible: boolean;
  kind: DialogKind;
  title: string;
  message?: string;
  /** Status glyph for confirm/error, e.g. "deleted", "saveFail", "payFail". */
  icon?: DesignIconName;
  /** Wolfi pose. Ignored for `confirm`. Defaults to the wave for `celebrate`. */
  wolfi?: "wave" | "map";
  onClose: () => void;
  dismissible?: boolean;
}>) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [mounted, setMounted] = useState(visible);
  const open = useSharedValue(0);
  const art = useSharedValue(0);
  const pose = kind === "confirm" ? undefined : wolfi ?? (kind === "celebrate" ? "wave" : undefined);

  // Keep the modal mounted through its exit, then unmount.
  if (visible && !mounted) setMounted(true);
  if (!visible && reduceMotion && mounted) setMounted(false);
  useEffect(() => {
    if (visible) {
      if (reduceMotion) { open.set(1); art.set(1); return; }
      open.set(withSpring(1, springs.snappy));
      art.set(0);
      art.set(withDelay(120, kind === "error" && !pose
        ? withSequence(withTiming(1, { duration: 1 }), withTiming(2, { duration: 300 }))
        : withSpring(1, pose ? springs.bouncy : springs.stamp)));
      return;
    }
    if (!mounted || reduceMotion) return;
    open.set(withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) }));
    const timer = setTimeout(() => setMounted(false), 170);
    return () => clearTimeout(timer);
  }, [visible, reduceMotion, kind, pose, open, art, mounted]);
  useEffect(() => () => { cancelAnimation(open); cancelAnimation(art); }, [open, art]);

  const backdrop = useAnimatedStyle(() => ({ opacity: open.get() }));
  const card = useAnimatedStyle(() => ({
    opacity: Math.min(1, open.get() * 1.5),
    transform: [{ translateY: (1 - open.get()) * 18 }, { scale: 0.92 + 0.08 * open.get() }],
  }));
  const artStyle = useAnimatedStyle(() => {
    const a = art.get();
    if (pose) return { transform: [{ translateY: interpolate(Math.min(a, 1), [0, 1], [26, 0]) }, { scale: 0.8 + 0.2 * Math.min(a, 1) }] };
    if (a > 1) return { transform: [{ translateX: Math.sin((a - 1) * Math.PI * 4) * 6 * (2 - a) }] }; // error: one shake
    return { transform: [{ rotate: `${(1 - a) * -30}deg` }, { scale: 0.4 + 0.6 * a }] }; // stamp
  });

  if (!mounted) return null;
  const tint = TINTS[kind];
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => { if (dismissible) onClose(); }}>
      <Animated.View style={[styles.backdrop, backdrop]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng" disabled={!dismissible} onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View accessibilityViewIsModal style={[styles.card, card]}>
          <View style={pose ? styles.poseSlot : styles.iconSlot}>
            {visible && kind === "celebrate" && <StarBurst play={1} count={8} radius={64} size={12} delay={220} />}
            <Animated.View style={artStyle}>
              {pose
                ? <Image source={pose === "wave" ? designAssets.wolfiWave : designAssets.wolfiMap} style={pose === "wave" ? styles.wave : styles.map} contentFit="contain" accessible={false} />
                : <View style={[styles.halo, { backgroundColor: tint.halo }]}>
                  <DesignIcon name={icon ?? (kind === "confirm" ? "deleted" : "saveFail")} size={34} />
                </View>}
            </Animated.View>
          </View>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(23,63,99,0.28)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%", maxWidth: 360, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18, borderRadius: radii.cardLarge,
    backgroundColor: colors.surface, alignItems: "center", gap: 8,
    boxShadow: "0 24px 48px -12px rgba(31,42,68,0.35), 0 2px 8px rgba(31,42,68,0.08)",
  },
  iconSlot: { width: 72, height: 72, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  poseSlot: { width: 140, height: 120, alignItems: "center", justifyContent: "flex-end", marginTop: -54 },
  halo: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  wave: { width: 104, height: 132 },
  map: { width: 150, height: 108 },
  title: { ...typography.section, fontFamily: fonts.heading, textAlign: "center" },
  message: { ...typography.body, color: colors.muted, textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 8, marginTop: 10 },
});
