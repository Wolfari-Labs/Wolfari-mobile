import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "./button";
import { DesignIcon } from "./design-icon";
import type { DesignIconName } from "./design-assets";
import { Feedback } from "./feedback";
import { GlassSurface } from "./glass-surface";

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
  const { reduceMotion } = useAccessibilityPreferences();
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (disabled || reduceMotion) return;
    Animated.spring(scale, {
      toValue: 0.92,
      damping: 16,
      stiffness: 350,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || reduceMotion) return;
    Animated.spring(scale, {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          ui.iconButton,
          variant === "glass" && ui.iconButtonGlass,
          pressed && ui.pressed,
          disabled && { opacity: 0.4 },
        ]}
      >
        <DesignIcon name={icon} tintColor={colors.teal} />
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
  const [slideAnim] = useState(
    () => new Animated.Value(Math.max(0, selectedIndex)),
  );

  useEffect(() => {
    if (reduceMotion) {
      slideAnim.setValue(Math.max(0, selectedIndex));
      return;
    }
    Animated.spring(slideAnim, {
      toValue: Math.max(0, selectedIndex),
      damping: 18,
      stiffness: 240,
      mass: 0.75,
      useNativeDriver: true,
    }).start();
  }, [selectedIndex, reduceMotion, slideAnim]);

  const itemWidth =
    containerWidth > 0 && items.length > 0
      ? (containerWidth - 8) / items.length
      : 0;

  const controls = (
    <GlassSurface
      variant="subtle"
      style={[ui.segments, scroll && { alignSelf: "flex-start" }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Sliding white card indicator for non-scrolling tabs */}
      {!scroll && itemWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            ui.segmentPill,
            {
              width: itemWidth,
              transform: [
                {
                  translateX: slideAnim.interpolate({
                    inputRange: items.map((_, i) => i),
                    outputRange: items.map((_, i) => i * itemWidth),
                  }),
                },
              ],
            },
          ]}
        />
      )}
      {items.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === item.value }}
          onPress={() => onChange(item.value)}
          style={[
            ui.segment,
            scroll ? { flexShrink: 0, paddingHorizontal: 16 } : { flex: 1 },
            scroll && value === item.value && ui.segmentActive,
          ]}
        >
          <Text
            style={[
              ui.segmentLabel,
              {
                color: value === item.value ? colors.ink : colors.muted,
                fontWeight: value === item.value ? "600" : "400",
              },
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </GlassSurface>
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
        <DesignIcon name={icon} size={30} tintColor={colors.teal} />
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
        <View style={ui.loading}>
          <ActivityIndicator color={colors.teal} />
          <Text style={typography.footnote}>Đang mở hành trình…</Text>
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
        <DesignIcon name={icon} tintColor={colors.teal} />
      </View>
      <View style={ui.flex}>
        <Text style={typography.body}>{title}</Text>
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
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: Math.max(total, 1), now: done }}
      style={ui.track}
    >
      <View
        style={[
          ui.progress,
          { width: `${total ? Math.min(100, (done / total) * 100) : 0}%` },
        ]}
      />
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
    backgroundColor: colors.tealSoft,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonGlass: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.88)",
    ...shadows.floating,
  },
  pressed: { opacity: 0.65 },
  segments: {
    flexDirection: "row",
    borderRadius: 22,
    padding: 4,
    minHeight: 48,
    position: "relative",
  },
  segmentPill: {
    position: "absolute",
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 18,
    backgroundColor: colors.surface,
    ...shadows.segmentActive,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.04)",
  },
  segment: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingHorizontal: 5,
    zIndex: 1,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    ...shadows.segmentActive,
  },
  segmentLabel: { fontSize: 13, lineHeight: 18, textAlign: "center" },
  empty: {
    alignItems: "center",
    padding: 24,
    paddingVertical: 32,
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.cardLarge,
    ...shadows.card,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
    borderRadius: radii.card,
  },
  loading: { padding: 32, gap: 12, alignItems: "center" },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 76,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  group: {
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...shadows.card,
  },
  groupedLink: { borderRadius: 0 },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    padding: 16,
    borderRadius: radii.card,
    backgroundColor: colors.peach,
  },
  track: {
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.line,
    overflow: "hidden",
  },
  progress: { height: 6, borderRadius: 99, backgroundColor: colors.teal },
  card: {
    padding: 20,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
    gap: 12,
    ...shadows.card,
  },
});
