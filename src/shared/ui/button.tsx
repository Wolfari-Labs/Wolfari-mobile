import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, radii, typography } from "@/shared/theme/tokens";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "soft" | "destructive";
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  compact = false,
  style,
}: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        variant === "soft" && styles.soft,
        variant === "destructive" && styles.destructive,
        pressed && variant === "primary" && styles.pressed,
        pressed && variant !== "primary" && styles.secondaryPressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={
            variant === "soft"
              ? colors.teal
              : variant === "destructive"
                ? colors.error
                : colors.surface
          }
        />
      )}
      <Text
        style={[
          typography.headline,
          styles.label,
          compact && styles.compactLabel,
          variant === "soft" && styles.softLabel,
          variant === "destructive" && styles.destructiveLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radii.control,
    backgroundColor: colors.teal,
    paddingHorizontal: 20,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  compact: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  compactLabel: { fontSize: 15, lineHeight: 20 },
  soft: { backgroundColor: colors.tealSoft },
  destructive: { backgroundColor: colors.errorSurface },
  destructiveLabel: { color: colors.error },
  secondaryPressed: { opacity: 0.65 },
  pressed: { backgroundColor: colors.tealPressed },
  disabled: { opacity: 0.55 },
  label: { color: colors.surface, textAlign: "center", flexShrink: 1 },
  softLabel: { color: colors.coral },
});
