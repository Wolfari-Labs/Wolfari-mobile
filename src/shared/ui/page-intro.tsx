import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import type { DesignIconName } from "./design-assets";
import { PastelIcon } from "./pastel";

export type PageIntroProps = {
  eyebrow: string; title: string; subtitle?: string; icon?: DesignIconName;
  tone?: "sage" | "sand"; badge?: string; summary?: ReactNode;
};
export function PageIntro({ eyebrow, title, subtitle, icon, tone = "sage", badge, summary }: PageIntroProps) {
  return <View style={styles.root}>
    <View style={styles.topline}>
      <View style={styles.copy}>
        <Text style={typography.eyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={typography.title}>{title}</Text>
      </View>
      {icon && <PastelIcon icon={icon} tone={tone === "sand" ? "butter" : "blue"} />}
    </View>
    {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    {!!badge && <Text style={styles.badge}>{badge}</Text>}
    {summary != null && <View style={styles.summary}>{summary}</View>}
  </View>;
}
export const layered = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 20, gap: 16, ...shadows.card },
  tint: { backgroundColor: colors.mint, borderRadius: radii.card, padding: 20, gap: 16, ...shadows.card },
  rows: { gap: 0, paddingVertical: 6 },
  metrics: { flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 12 },
  metric: { flexGrow: 1, flexBasis: 120, minWidth: 0, gap: 4 },
  overlap: { marginTop: -36, marginHorizontal: 12, padding: 18, borderRadius: radii.card, gap: 12 },
});
const styles = StyleSheet.create({
  root: { gap: 10 },
  topline: { flexDirection: "row", alignItems: "center", gap: 16 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  subtitle: { ...typography.body, color: colors.muted },
  badge: { ...typography.footnote, color: colors.teal },
  summary: { borderRadius: radii.card, backgroundColor: colors.surface, padding: 20, gap: 12, ...shadows.card },
});
