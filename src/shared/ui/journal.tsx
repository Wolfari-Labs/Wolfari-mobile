import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  type GestureResponderEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
  type ViewInstance,
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

const lastSegmentIndex = new Map<string, number>();

export function Segments<T extends string>({
  items,
  value,
  onChange,
  scroll = false,
  memoryKey,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  scroll?: boolean;
  memoryKey?: string;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [itemLayouts, setItemLayouts] = useState<Record<number, { x: number; width: number }>>({});
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const containerRef = useRef<ViewInstance | null>(null);
  const containerLeftRef = useRef(0);
  const startPageXRef = useRef(0);
  const scrubIndexRef = useRef<number | null>(null);
  const hasScrolledPlayedRef = useRef(false);

  const selectedIndex = Math.max(0, items.findIndex((it) => it.value === value));
  const initialIndex = memoryKey !== undefined ? (lastSegmentIndex.get(memoryKey) ?? selectedIndex) : selectedIndex;
  const slideAnim = useSharedValue(initialIndex);
  const pillScale = useSharedValue(1);
  const scrollPillX = useSharedValue(0);
  const scrollPillW = useSharedValue(0);

  useEffect(() => {
    if (memoryKey !== undefined) {
      lastSegmentIndex.set(memoryKey, selectedIndex);
    }
    if (scrubIndexRef.current !== null) return;
    slideAnim.set(reduceMotion ? selectedIndex : withSpring(selectedIndex, springs.gentle));
    return () => cancelAnimation(slideAnim);
  }, [memoryKey, selectedIndex, reduceMotion, slideAnim]);

  const activeLayout = itemLayouts[selectedIndex];
  useEffect(() => {
    if (!scroll || !activeLayout) return;
    if (!hasScrolledPlayedRef.current || reduceMotion) {
      scrollPillX.set(activeLayout.x);
      scrollPillW.set(activeLayout.width);
      hasScrolledPlayedRef.current = true;
    } else {
      scrollPillX.set(withSpring(activeLayout.x, springs.gentle));
      scrollPillW.set(withSpring(activeLayout.width, springs.gentle));
    }
    if (containerWidth > 0) {
      const targetOffset = Math.max(0, activeLayout.x - containerWidth / 2 + activeLayout.width / 2);
      scrollRef.current?.scrollTo({ x: targetOffset, animated: !reduceMotion });
    }
  }, [activeLayout, containerWidth, reduceMotion, scroll, scrollPillW, scrollPillX]);

  // The rail has four-point padding on each side.
  const itemWidth =
    containerWidth > 0 && items.length > 0
      ? (containerWidth - 8) / items.length
      : 0;
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: slideAnim.get() * itemWidth },
      { scale: pillScale.get() },
    ],
  }));
  const scrollIndicatorStyle = useAnimatedStyle(() => ({
    width: scrollPillW.get(),
    transform: [{ translateX: scrollPillX.get() - 4 }],
  }));

  function updateScrubFromPageX(pageX: number) {
    if (scroll || itemWidth <= 0 || items.length === 0) return;
    const relX = pageX - containerLeftRef.current - 4;
    const rawIdx = relX / itemWidth - 0.5;
    const clampedPos = Math.max(0, Math.min(items.length - 1, rawIdx));
    const snappedIdx = Math.max(0, Math.min(items.length - 1, Math.floor(relX / itemWidth)));
    slideAnim.set(reduceMotion ? snappedIdx : withSpring(clampedPos, springs.snappy));
    if (scrubIndexRef.current !== snappedIdx) {
      scrubIndexRef.current = snappedIdx;
      setScrubIndex(snappedIdx);
    }
  }

  function finishScrub() {
    const targetIdx = scrubIndexRef.current;
    scrubIndexRef.current = null;
    setScrubIndex(null);
    pillScale.set(reduceMotion ? 1 : withSpring(1, springs.snappy));
    if (targetIdx !== null && items[targetIdx]) {
      if (memoryKey !== undefined) {
        lastSegmentIndex.set(memoryKey, targetIdx);
      }
      slideAnim.set(reduceMotion ? targetIdx : withSpring(targetIdx, springs.gentle));
      if (items[targetIdx].value !== value) {
        onChange(items[targetIdx].value);
      }
    } else {
      slideAnim.set(reduceMotion ? selectedIndex : withSpring(selectedIndex, springs.gentle));
    }
  }

  const highlightedIndex = scrubIndex ?? selectedIndex;

  const controls = (
    <View
      ref={containerRef}
      style={[ui.segments, scroll && { alignSelf: "flex-start" }]}
      onLayout={(e) => {
        if (!scroll) setContainerWidth(e.nativeEvent.layout.width);
      }}
      onTouchStart={!scroll ? (e) => {
        startPageXRef.current = e.nativeEvent.pageX;
        containerRef.current?.measureInWindow((x) => {
          if (typeof x === "number") containerLeftRef.current = x;
        });
      } : undefined}
      onMoveShouldSetResponderCapture={!scroll ? (e: GestureResponderEvent) =>
        Math.abs(e.nativeEvent.pageX - startPageXRef.current) > 8
      : undefined}
      onResponderGrant={!scroll ? (e: GestureResponderEvent) => {
        pillScale.set(reduceMotion ? 1 : withSpring(0.96, springs.snappy));
        updateScrubFromPageX(e.nativeEvent.pageX);
      } : undefined}
      onResponderMove={!scroll ? (e: GestureResponderEvent) => {
        updateScrubFromPageX(e.nativeEvent.pageX);
      } : undefined}
      onResponderRelease={!scroll ? finishScrub : undefined}
      onResponderTerminate={!scroll ? finishScrub : undefined}
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
      {scroll && activeLayout && (
        <Animated.View
          pointerEvents="none"
          style={[
            ui.segmentPill,
            scrollIndicatorStyle,
          ]}
        ><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>
      )}
      {items.map((item, idx) => {
        const isHighlighted = highlightedIndex === idx;
        return (
          <Pressable
            cssInterop={false}
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: value === item.value }}
            aria-selected={value === item.value}
            onLayout={scroll ? (e) => {
              const { x, width } = e.nativeEvent.layout;
              setItemLayouts((prev) => {
                const cur = prev[idx];
                if (cur && Math.abs(cur.x - x) < 0.5 && Math.abs(cur.width - width) < 0.5) return prev;
                return { ...prev, [idx]: { x, width } };
              });
            } : undefined}
            onPress={() => onChange(item.value)}
            style={({ pressed }) => [
              ui.segment,
              scroll ? { flexShrink: 0, paddingHorizontal: 16 } : { flex: 1 },
              scroll && !activeLayout && value === item.value && ui.segmentActive,
              pressed && ui.pressed,
            ]}
          >
            {scroll && !activeLayout && value === item.value && <LinearGradient pointerEvents="none" colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
            <Text
              style={[
                ui.segmentLabel,
                {
                  color: isHighlighted ? colors.onAccent : colors.muted,
                  fontFamily: isHighlighted ? fonts.heading : fonts.body,
                },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  return scroll ? (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
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

const statusToneMap: Record<string, { bg: string; fg: string }> = {
  OPEN: { bg: colors.mint, fg: colors.pinGreen },
  CONFIRMED: { bg: colors.mint, fg: colors.pinGreen },
  COMPLETED: { bg: colors.mint, fg: colors.pinGreen },
  ACTIVE: { bg: colors.mint, fg: colors.pinGreen },
  PENDING: { bg: colors.butter, fg: colors.amber },
  TRANSFER_REPORTED: { bg: colors.butter, fg: colors.amber },
  SUBMITTED: { bg: colors.butter, fg: colors.amber },
  HOLDER_REPORTED: { bg: colors.butter, fg: colors.amber },
  CLOSING: { bg: colors.butter, fg: colors.amber },
  PENDING_CONFIRMATIONS: { bg: colors.butter, fg: colors.amber },
  PAUSED: { bg: colors.butter, fg: colors.amber },
  REJECTED: { bg: colors.peach, fg: colors.orange },
  CANCELLED: { bg: colors.peach, fg: colors.orange },
  REVERSED: { bg: colors.peach, fg: colors.orange },
  STOPPED: { bg: colors.peach, fg: colors.orange },
  EXPIRED: { bg: colors.peach, fg: colors.orange },
  DRAFT: { bg: colors.tealSoft, fg: colors.teal },
  WAIVED: { bg: colors.tealSoft, fg: colors.teal },
  CLOSED: { bg: colors.fill, fg: colors.muted },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = statusToneMap[status] ?? { bg: colors.tealSoft, fg: colors.teal };
  return (
    <View style={[ui.statusBadge, { backgroundColor: tone.bg }]}>
      <Text style={[ui.statusBadgeText, { color: tone.fg }]}>{label ?? status}</Text>
    </View>
  );
}

export function FadeInView({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.set(1);
      return;
    }
    progress.set(0);
    const timer = delay > 0
      ? setTimeout(() => { progress.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })); }, delay)
      : undefined;
    if (!delay) progress.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
    return () => {
      if (timer) clearTimeout(timer);
      cancelAnimation(progress);
    };
  }, [delay, progress, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 8 }],
  }));
  return <Animated.View style={[ui.stack, animatedStyle]}>{children}</Animated.View>;
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
    gap: 10,
    padding: 18,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.glass,
  },
  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  card: {
    padding: 20,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
    gap: 12,
    ...shadows.card,
  },
});
