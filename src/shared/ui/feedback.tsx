import { StyleSheet, Text, View } from "react-native";

import { colors, radii, typography } from "@/shared/theme/tokens";

export function Feedback({ message, success = false }: { message: string; success?: boolean }) {
  return (
    <View style={[styles.container, success && styles.success]}>
      <Text accessibilityRole={success ? undefined : "alert"} accessibilityLiveRegion={success ? "polite" : "assertive"} style={[success ? typography.footnote : typography.body, styles.text, success && styles.successText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radii.control, padding: 14, backgroundColor: colors.errorSurface, borderWidth: 1.5, borderColor: colors.error },
  success: { backgroundColor: "transparent", borderWidth: 0, paddingHorizontal: 0, paddingVertical: 4 },
  text: { color: colors.error },
  successText: { color: colors.pinGreen, fontWeight: "600" },
});
