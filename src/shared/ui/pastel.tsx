import type { PropsWithChildren } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, pastelTones as tones, radii, shadows, typography } from "@/shared/theme/tokens";
import { DesignIcon } from "./design-icon";
import type { DesignIconName } from "./design-assets";

export type PastelTone = keyof typeof tones;

export function PastelIcon({ icon, tone = "blue", small = false }: { icon: DesignIconName; tone?: PastelTone; small?: boolean }) {
  return <LinearGradient colors={tones[tone].gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.icon, small && styles.smallIcon]}>
    <DesignIcon name={icon} size={small ? 20 : 24} tintColor={colors.surface} />
  </LinearGradient>;
}
export function StatTile({ icon, tone = "blue", value, label, onPress, accessibilityLabel, progress }: {
  icon: DesignIconName; tone?: PastelTone; value: string; label: string; onPress: () => void; accessibilityLabel?: string;
  /** 0–1; renders a slim completion bar under the value. */
  progress?: number;
}) {
  return <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`} onPress={onPress}
    style={({ pressed }) => [styles.tile, { backgroundColor: tones[tone].surface }, pressed && styles.pressed]}>
    <PastelIcon icon={icon} tone={tone} />
    <Text style={styles.value}>{value}</Text>
    {progress !== undefined && <View style={styles.track}><LinearGradient colors={tones[tone].gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }]} /></View>}
    <Text style={typography.footnote}>{label}</Text>
  </Pressable>;
}
export function StatGrid({ children }: PropsWithChildren) { return <View style={styles.grid}>{children}</View>; }
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexGrow: 1, flexBasis: "46%", minWidth: 120, padding: 16, minHeight: 138, borderRadius: radii.card, gap: 8, ...shadows.glass },
  icon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", ...shadows.segmentActive },
  smallIcon: { width: 40, height: 40, borderRadius: 14 },
  value: { ...typography.title, fontSize: 24, lineHeight: 30 },
  pressed: { opacity: 0.72 },
  track: { height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(23, 63, 99, 0.1)" },
  fill: { height: 6, borderRadius: 3 },
});
