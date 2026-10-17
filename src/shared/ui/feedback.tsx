import { StyleSheet, Text, View } from "react-native";

import { colors, radii, typography } from "@/shared/theme/tokens";

export function Feedback({ message, success = false }: { message: string; success?: boolean }) {
  return (
    <View style={[styles.container, success && styles.success]}>
      <Text accessibilityRole="alert" style={[typography.body, styles.text, success && styles.successText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radii.control, padding: 14, backgroundColor: colors.errorSurface },
  success: { backgroundColor: "#E6F1F0" },
  text: { color: colors.error },
  successText: { color: colors.teal },
});
