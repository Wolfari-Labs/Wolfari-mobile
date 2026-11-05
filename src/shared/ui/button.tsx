import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { colors, gradients, radii, shadows, typography } from "@/shared/theme/tokens";
import type { DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";

type Props = {
  label: string; accessibilityLabel?: string; onPress: () => void;
  loading?: boolean; disabled?: boolean;
  variant?: "primary" | "soft" | "destructive" | "glass" | "text";
  compact?: boolean; icon?: DesignIconName; style?: StyleProp<ViewStyle>;
};

export function Button({ label, accessibilityLabel, onPress, loading = false, disabled = false, variant = "primary", compact = false, icon, style }: Props) {
  const inactive = disabled || loading;
  const motion = usePressMotion(inactive);
  // Dark ink keeps small labels readable across the original pastel gradient.
  const tint = variant === "destructive" ? colors.error : variant === "text" ? colors.teal : colors.onAccent;
  return (
    <Animated.View style={[motion.animatedStyle, style]}>
      <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: inactive, busy: loading }} aria-disabled={inactive} aria-busy={loading}
        disabled={inactive} onPress={onPress} onPressIn={motion.onPressIn} onPressOut={motion.onPressOut}
        pressRetentionOffset={16}
        style={({ pressed }) => [styles.button, variant === "primary" && styles.primary,
          variant === "destructive" && styles.destructive, compact && styles.compact,
          variant === "text" && styles.text, pressed && styles.pressed, inactive && styles.disabled]}>
        {variant === "primary" && <LinearGradient pointerEvents="none" colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
        {loading ? <ActivityIndicator size="small" color={tint} /> : icon ? <DesignIcon name={icon} size={compact ? 16 : 20} tintColor={tint} /> : null}
        <Text style={[typography.headline, styles.label, compact && styles.compactLabel, { color: tint }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 56, borderRadius: radii.pill, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden", paddingHorizontal: 20, paddingVertical: 14, ...shadows.glass },
  primary: { backgroundColor: colors.gradientBlue, ...shadows.primaryButton },
  destructive: { backgroundColor: colors.errorSurface },
  compact: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 16 },
  compactLabel: { fontSize: 14, lineHeight: 20 },
  text: { minHeight: 44, paddingHorizontal: 4, paddingVertical: 10, backgroundColor: "transparent", boxShadow: "none" },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  label: { textAlign: "center", flexShrink: 1 },
});
