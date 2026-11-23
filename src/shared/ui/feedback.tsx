import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, typography } from "@/shared/theme/tokens";

/**
 * Inline status that belongs to a form or section (an error to fix, a state that stays
 * true). Short-lived confirmations ("Đã lưu…") use `toast`/`Snackbar` instead.
 */
export function Feedback({ message, success = false }: { message: string; success?: boolean }) {
  return (
    <View style={[styles.container, success ? styles.success : styles.error]}>
      <View style={[styles.badge, success ? styles.successBadge : styles.errorBadge]}>
        <Text style={[styles.glyph, { color: success ? colors.pinGreen : colors.error }]}>{success ? "✓" : "!"}</Text>
      </View>
      <Text
        accessibilityRole={success ? undefined : "alert"}
        accessibilityLiveRegion={success ? "polite" : "assertive"}
        style={[typography.body, styles.text, { color: success ? colors.pinGreen : colors.error }]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: radii.control, paddingVertical: 12, paddingHorizontal: 14 },
  error: { backgroundColor: colors.errorSurface, borderLeftWidth: 4, borderLeftColor: colors.error },
  success: { backgroundColor: colors.mint, borderLeftWidth: 4, borderLeftColor: colors.pinGreen },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  errorBadge: { backgroundColor: colors.surface },
  successBadge: { backgroundColor: colors.surface },
  glyph: { fontFamily: fonts.heading, fontSize: 13, lineHeight: 16 },
  text: { flex: 1, minWidth: 0, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
});
