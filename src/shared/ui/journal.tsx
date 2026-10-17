import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radii, typography } from "@/shared/theme/tokens";
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
}: {
  icon: DesignIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.iconButton,
        pressed && ui.pressed,
        disabled && { opacity: 0.4 },
      ]}
    >
      <DesignIcon name={icon} tintColor={colors.teal} />
    </Pressable>
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
  const controls = (
    <GlassSurface style={[ui.segments, scroll && { alignSelf: "flex-start" }]}>
      {items.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === item.value }}
          onPress={() => onChange(item.value)}
          style={[
            ui.segment,
            scroll ? { flexShrink: 0, paddingHorizontal: 16 } : { flex: 1 },
            value === item.value && ui.segmentActive,
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
  pressed: { opacity: 0.65 },
  segments: {
    flexDirection: "row",
    borderRadius: 22,
    padding: 4,
    minHeight: 48,
  },
  segment: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingHorizontal: 5,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
  },
  segmentLabel: { fontSize: 13, lineHeight: 18, textAlign: "center" },
  empty: {
    alignItems: "center",
    padding: 24,
    paddingVertical: 32,
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.cardLarge,
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
  },
});
