import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, pastelTones, radii, shadows, typography } from "@/shared/theme/tokens";
import type { DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";

export type RowTone = keyof typeof pastelTones | "danger" | "neutral";

/** A titled group of rows on one white card, like iOS Settings. */
export function SettingsGroup({ title, footer, children }: PropsWithChildren<{ title?: string; footer?: string }>) {
  return (
    <View style={styles.group}>
      {title && <Text accessibilityRole="header" style={styles.groupTitle}>{title}</Text>}
      <View style={styles.card}>{children}</View>
      {footer && <Text style={styles.footer}>{footer}</Text>}
    </View>
  );
}

/** Small rounded icon tile in one of the pastel tones. */
export function RowIcon({ icon, tone = "blue", size = 34 }: { icon: DesignIconName; tone?: RowTone; size?: number }) {
  if (tone === "danger" || tone === "neutral")
    return (
      <View style={[styles.icon, { width: size, height: size, borderRadius: size * 0.34, backgroundColor: tone === "danger" ? colors.errorSurface : colors.fill }]}>
        <DesignIcon name={icon} size={size * 0.52} tintColor={tone === "danger" ? colors.error : colors.muted} />
      </View>
    );
  return (
    <LinearGradient colors={pastelTones[tone].gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.icon, { width: size, height: size, borderRadius: size * 0.34 }]}>
      <DesignIcon name={icon} size={size * 0.52} tintColor={colors.surface} />
    </LinearGradient>
  );
}

export function SettingsRow({
  icon,
  tone = "blue",
  title,
  subtitle,
  value,
  badge,
  right,
  onPress,
  last = false,
  destructive = false,
  disabled = false,
  accessibilityLabel,
}: {
  icon?: DesignIconName;
  tone?: RowTone;
  title: string;
  subtitle?: string;
  /** Short trailing value, e.g. "2 thiết bị". */
  value?: string;
  /** Count bubble, hidden when 0/undefined. */
  badge?: number;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      {icon && <RowIcon icon={icon} tone={destructive ? "danger" : tone} />}
      <View style={styles.copy}>
        <Text style={[styles.title, destructive && { color: colors.error }]} numberOfLines={2}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={3}>{subtitle}</Text>}
      </View>
      {!!badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
      {value && <Text style={styles.value} numberOfLines={1}>{value}</Text>}
      {right ?? (onPress && !destructive && <DesignIcon name="chevron" size={16} tintColor={colors.muted} />)}
    </>
  );
  const style = [styles.row, !last && styles.separator];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && styles.pressed, disabled && { opacity: 0.45 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  groupTitle: { ...typography.eyebrow, paddingHorizontal: 6, textTransform: "uppercase" },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, paddingHorizontal: 16, ...shadows.glass },
  footer: { ...typography.footnote, paddingHorizontal: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 12 },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  pressed: { opacity: 0.6 },
  icon: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: colors.ink },
  subtitle: { ...typography.footnote },
  value: { ...typography.footnote, maxWidth: 140, fontFamily: fonts.bold },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
  badgeText: { color: colors.surface, fontFamily: fonts.heading, fontSize: 12, lineHeight: 16 },
});
