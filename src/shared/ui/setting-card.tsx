import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { colors, fonts, gradients, radii, shadows } from "@/shared/theme/tokens";
import { clayIcons, type ClayIconName, type DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";

type CardIconName = ClayIconName | DesignIconName;

const badges = {
  blue: { gradient: ["#7BA7FF", "#3C7BE8"], glow: "60,123,232" },
  mint: { gradient: ["#5EE0B0", "#2DBE7A"], glow: "45,190,122" },
  butter: { gradient: ["#FFD66B", "#F5A623"], glow: "245,166,35" },
  lilac: { gradient: ["#A58BFF", "#6B4EE6"], glow: "107,78,230" },
  peach: { gradient: ["#FFA48C", "#FF6F59"], glow: "255,111,89" },
  slate: { gradient: ["#A7B2CC", "#5D6B8A"], glow: "93,107,138" },
} as const;
type CardTone = keyof typeof badges;
const clayInset = "inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -4px 10px rgba(51,64,115,0.06)";

export const claySubtitle = { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, color: "#6A7891" } as const;

/** A Wolfari glyph in the colour its clay slot calls for (white on gradient badges). */
export function ClayIcon({ name, size }: { name: ClayIconName; size: number }) {
  const { glyph, tint } = clayIcons[name];
  return <DesignIcon name={glyph} size={size} tintColor={tint} />;
}

/** Heading plus individually floating cards (Figma D · M19/M20). */
export function CardSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>;
}

export function CardIcon({ icon, tone, size = 44 }: { icon: CardIconName; tone: CardTone; size?: number }) {
  const { gradient, glow } = badges[tone];
  return <LinearGradient colors={gradient} locations={[0, 0.714]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    style={[styles.badge, { width: size, height: size, borderRadius: size * 0.341, boxShadow: `0 6px 12px rgba(${glow},0.32), inset 0 2px 3px rgba(255,255,255,0.55)` }]}>
    {/* On a gradient badge every glyph is white; the gold star keeps its colour. */}
    <DesignIcon name={icon in clayIcons ? clayIcons[icon as ClayIconName].glyph : icon as DesignIconName} size={size / 2} tintColor={colors.surface} />
  </LinearGradient>;
}

/** One card that navigates/acts, or toggles when `value` is given. */
export function SettingCard({ icon, tone, title, subtitle, disabled = false, busy = false, value, onPress, right, destructive = false }: {
  icon: CardIconName; tone: CardTone; title: string; subtitle?: string; disabled?: boolean; busy?: boolean;
  value?: boolean; onPress?: () => void; right?: ReactNode; destructive?: boolean;
}) {
  const toggle = value !== undefined;
  const content = <>
    <CardIcon icon={icon} tone={tone} />
    <View style={styles.copy}>
      <Text style={[styles.title, destructive && { color: "#FF6F59" }]} numberOfLines={2}>{title}</Text>
      {subtitle && <Text style={claySubtitle} numberOfLines={3}>{subtitle}</Text>}
    </View>
    {right ?? (toggle ? <ToggleTrack on={value} /> : onPress && <ClayIcon name="chevron" size={18} />)}
  </>;
  if (!onPress) return <View style={styles.card}>{content}</View>;
  const inactive = disabled || busy;
  return <Pressable cssInterop={false} accessibilityRole={toggle ? "switch" : "button"} accessibilityLabel={title} accessibilityHint={subtitle}
    accessibilityState={toggle ? { checked: value, disabled: inactive } : { disabled: inactive, busy }} aria-checked={toggle ? value : undefined}
    disabled={inactive} onPress={onPress}
    style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }, inactive && { opacity: 0.55 }]}>
    {content}
  </Pressable>;
}

function ToggleTrack({ on }: { on: boolean }) {
  return <View style={[styles.track, on && styles.trackOn]}>
    {on && <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
    <View style={styles.knob} />
  </View>;
}

/** Full-width gradient action with white label; `compact` is the pill inside a field. */
export function ClayButton({ label, accessibilityLabel, icon, compact = false, tone = "primary", loading = false, disabled = false, onPress }: {
  label: string; accessibilityLabel?: string; icon?: ClayIconName; tone?: "primary" | "soft" | "secondary"; compact?: boolean; loading?: boolean; disabled?: boolean; onPress: () => void;
}) {
  const inactive = disabled || loading;
  const motion = usePressMotion(inactive);
  return <Animated.View style={motion.animatedStyle}>
    <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: inactive, busy: loading }}
      aria-disabled={inactive} aria-busy={loading} disabled={inactive} hitSlop={compact ? 6 : 0} onPress={onPress} onPressIn={motion.onPressIn} onPressOut={motion.onPressOut}
      style={[styles.button, compact && styles.compact, tone === "soft" && styles.soft, tone === "secondary" && styles.secondary, inactive && { opacity: 0.5 }]}>
      {tone === "primary" && <LinearGradient pointerEvents="none" colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: radii.pill }]} />}
      {!compact && tone !== "soft" && <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.buttonInset]} />}
      {loading && <ActivityIndicator size="small" color={tone === "primary" ? colors.surface : colors.blue} />}
      {compact && icon && !loading && <ClayIcon name={icon} size={14} />}
      <Text style={[styles.buttonLabel, compact && styles.compactLabel, tone !== "primary" && { color: tone === "soft" ? colors.blue : colors.ink }]}>{label}</Text>
      {!compact && icon && !loading && <ClayIcon name={icon} size={18} />}
    </Pressable>
  </Animated.View>;
}

/** Round white header action (Figma D/Icon button). */
export function ClayIconButton({ icon, label, onPress }: { icon: ClayIconName; label: string; onPress: () => void }) {
  return <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
    <ClayIcon name={icon} size={20} />
  </Pressable>;
}

const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadows.floating },
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: colors.ink },
  card: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingVertical: 12, paddingLeft: 12, paddingRight: 14, borderRadius: 22, backgroundColor: colors.surface, ...shadows.glass },
  badge: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 22, color: colors.ink },
  track: { width: 50, height: 30, borderRadius: 15, padding: 3, overflow: "hidden", backgroundColor: colors.line, alignItems: "flex-start" },
  trackOn: { alignItems: "flex-end" },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, boxShadow: "0 2px 4px rgba(51,64,115,0.2)" },
  button: { minHeight: 56, paddingHorizontal: 24, borderRadius: radii.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 12px 28px -4px rgba(92,122,199,0.18)" },
  soft: { backgroundColor: colors.tealSoft, boxShadow: "none" },
  secondary: { backgroundColor: colors.surface, paddingHorizontal: 12, boxShadow: "0 8px 20px -4px rgba(92,122,199,0.12)" },
  buttonInset: { borderRadius: radii.pill, boxShadow: clayInset },
  buttonLabel: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: colors.surface },
  compact: { minHeight: 34, paddingLeft: 12, paddingRight: 14, gap: 4, boxShadow: "none" },
  compactLabel: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
});
