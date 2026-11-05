import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { colors, fonts, gradients, radii, shadows, springs, typography } from "@/shared/theme/tokens";
import { Button } from "./button";
import { DesignIcon } from "./design-icon";
import type { DesignIconName } from "./design-assets";
import { Feedback } from "./feedback";
import { Wolfi } from "./carto/wolfi";
import { useMotionActive } from "@/shared/hooks/use-motion-active";

export function Heading({
  title,
  subtitle,
  aside,
  large = false,
}: {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  large?: boolean;
}) {
  return (
    <View style={ui.headingRow}>
      <View style={ui.flex}>
        <Text
          accessibilityRole="header"
          style={large ? typography.largeTitle : typography.title}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={[typography.body, ui.subtitle]}>{subtitle}</Text>
        )}
      </View>
      {aside}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  variant = "soft",
}: {
  icon: DesignIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "soft" | "glass";
}) {
  const motion = usePressMotion(disabled, 0.92);

  return (
    <Animated.View style={motion.animatedStyle}>
      <Pressable
        cssInterop={false}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        accessibilityState={{ disabled }}
        aria-disabled={disabled}
        onPress={onPress}
        onPressIn={motion.onPressIn}
        onPressOut={motion.onPressOut}
        hitSlop={4}
        pressRetentionOffset={16}
        style={({ pressed }) => [
          ui.iconButton,
          variant === "glass" && ui.iconButtonGlass,
          pressed && ui.pressed,
          disabled && { opacity: 0.4 },
        ]}
      >
        <DesignIcon name={icon} tintColor={colors.ink} />
      </Pressable>
    </Animated.View>
  );
}

export function Segments<T extends string>({
  items,
  value,
  onChange,
  scroll = false,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [containerWidth, setContainerWidth] = useState(0);

  const selectedIndex = items.findIndex((it) => it.value === value);
  const slideAnim = useSharedValue(Math.max(0, selectedIndex));

  useEffect(() => {
    slideAnim.set(reduceMotion ? Math.max(0, selectedIndex) : withSpring(Math.max(0, selectedIndex), springs.gentle));
    return () => cancelAnimation(slideAnim);
  }, [selectedIndex, reduceMotion, slideAnim]);

  // The rail has four-point padding on each side.
  const itemWidth =
    containerWidth > 0 && items.length > 0
      ? (containerWidth - 8) / items.length
      : 0;
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slideAnim.get() * itemWidth }] }));

  const controls = (
    <View
      style={[ui.segments, scroll && { alignSelf: "flex-start" }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {!scroll && itemWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            ui.segmentPill,
            { width: itemWidth },
            indicatorStyle,
          ]}
        ><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>
      )}
      {items.map((item) => (
        <Pressable
          cssInterop={false}
          key={item.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === item.value }}
          aria-selected={value === item.value}
          onPress={() => onChange(item.value)}
          style={({ pressed }) => [
            ui.segment,
            scroll ? { flexShrink: 0, paddingHorizontal: 16 } : { flex: 1 },
            scroll && value === item.value && ui.segmentActive,
            pressed && ui.pressed,
          ]}
        >
          {scroll && value === item.value && <LinearGradient pointerEvents="none" colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
          <Text
            style={[
              ui.segmentLabel,
              {
                color: value === item.value ? colors.onAccent : colors.muted,
                fontFamily: value === item.value ? fonts.heading : fonts.body,
              },
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  return scroll ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
    >
      {controls}
    </ScrollView>
  ) : (
    controls
  );
}
export function EmptyState({
  title,
  message,
  action,
  icon = "bag",
}: {
  title: string;
  message: string;
  action?: ReactNode;
  icon?: DesignIconName;
}) {
  return (
    <View style={ui.empty}>
      <View style={ui.emptyIcon}>
        <Wolfi pose={icon === "bag" ? "walk" : "map"} size={96} />
      </View>
      <Text style={[typography.headline, ui.center]}>{title}</Text>
      <Text style={[typography.body, ui.center, { color: colors.muted }]}>
        {message}
      </Text>
      {action}
    </View>
  );
}
export function ResourceFeedback({
  loading,
  error,
  hasData,
  onRetry,
}: {
  loading: boolean;
  error?: string;
  hasData: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {loading && !hasData && (
        <View style={ui.loading} accessibilityRole="progressbar" accessibilityLabel="Đang mở hành trình">
          <SpinningCompass />
          <Text style={typography.footnote}>Đang mở bản đồ hành trình…</Text>
        </View>
      )}
      {error && (
        <View style={ui.stack}>
          <Feedback message={error} />
          <Button label="Tải lại" variant="soft" compact onPress={onRetry} />
        </View>
      )}
    </>
  );
}
/** Loading state: a compass needle hunting for north. Falls back to a spinner under Reduce Motion. */
function SpinningCompass() {
  const active = useMotionActive();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (active) turn.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }), -1));
    else { cancelAnimation(turn); turn.set(0); }
    return () => cancelAnimation(turn);
  }, [active, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 360}deg` }] }));
  if (!active) return <ActivityIndicator color={colors.ink} />;
  return (
    <View style={ui.compass}>
      <Animated.View style={style}>
        <DesignIcon name="compass" size={26} tintColor={colors.ink} />
      </Animated.View>
    </View>
  );
}

export function SectionLink({
  title,
  subtitle,
  icon,
  onPress,
  right,
  grouped = false,
  last = false,
}: {
  title: string;
  subtitle?: string;
  icon: DesignIconName;
  onPress?: () => void;
  right?: ReactNode;
  grouped?: boolean;
  last?: boolean;
}) {
  const content = (
    <>
      <View style={ui.rowIcon}>
        <View style={ui.rowBadge}>
          <DesignIcon name={icon} size={19} tintColor={colors.ink} />
        </View>
      </View>
      <View style={ui.flex}>
        <Text style={[typography.body, ui.linkTitle]}>{title}</Text>
        {subtitle && (
          <Text style={[typography.footnote, { marginTop: 4 }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {right ?? (onPress && <DesignIcon name="chevron" size={18} />)}
    </>
  );
  return onPress ? (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={onPress}
      style={({ pressed }) => [
        ui.link,
        grouped && ui.groupedLink,
        grouped && !last && ui.separator,
        pressed && ui.pressed,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View
      style={[
        ui.link,
        grouped && ui.groupedLink,
        grouped && !last && ui.separator,
      ]}
    >
      {content}
    </View>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={ui.notice}>
      <Text style={[typography.footnote, { color: colors.muted }]}>
        {children}
      </Text>
    </View>
  );
}
export function Progress({ done, total }: { done: number; total: number }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const percent = total > 0 ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;
  const progress = useSharedValue(percent);
  useEffect(() => {
    progress.set(reduceMotion ? percent : withSpring(percent, springs.gentle));
    return () => cancelAnimation(progress);
  }, [percent, progress, reduceMotion]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.get()}%` as `${number}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: Math.max(total, 1), now: done }}
      aria-valuemin={0}
      aria-valuemax={Math.max(total, 1)}
      aria-valuenow={done}
      style={ui.track}
    >
      <Animated.View
        style={[
          ui.progress,
          progressStyle,
        ]}
      ><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>
    </View>
  );
}

export const ui = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  stack: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  subtitle: { color: colors.muted, marginTop: 6 },
  center: { textAlign: "center" },
  iconButton: {
    width: 44,
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.floating,
  },
  iconButtonGlass: {
    backgroundColor: colors.surface,
    ...shadows.glass,
  },
  pressed: { opacity: 0.65 },
  segments: {
    flexDirection: "row",
    minHeight: 52,
    position: "relative",
    padding: 4,
    gap: 0,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  segmentPill: {
    position: "absolute",
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.gradientBlue,
    overflow: "hidden",
  },
  segment: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    paddingHorizontal: 5,
    zIndex: 1,
    overflow: "hidden",
  },
  segmentActive: {
    backgroundColor: colors.gradientBlue,
    overflow: "hidden",
  },
  segmentLabel: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, textAlign: "center" },
  compass: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  linkTitle: { fontFamily: fonts.bold },
  rowBadge: { width: 36, height: 36, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  empty: {
    alignItems: "center",
    padding: 24,
    paddingVertical: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  loading: { padding: 32, gap: 12, alignItems: "center" },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 0,
    minHeight: 76,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  group: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  groupedLink: { borderBottomWidth: 0 },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.fill,
    borderRadius: radii.control,
  },
  track: {
    height: 10,
    borderRadius: 99,
    backgroundColor: colors.line,
    overflow: "hidden",
  },
  progress: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 99, backgroundColor: colors.gradientMint, overflow: "hidden" },
  // Reading content stays on the page; reserve cards for bounded form/selection surfaces.
  section: { gap: 12, paddingVertical: 4 },
  record: {
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  card: {
    padding: 20,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
    gap: 12,
    ...shadows.card,
  },
});
