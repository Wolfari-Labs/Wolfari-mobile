import { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import type { DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "soft" | "destructive" | "glass";
  compact?: boolean;
  icon?: DesignIconName;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  compact = false,
  icon,
  style,
}: Props) {
  const { reduceMotion } = useAccessibilityPreferences();
  const inactive = disabled || loading;
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (inactive || reduceMotion) return;
    Animated.spring(scale, {
      toValue: 0.965,
      damping: 16,
      stiffness: 350,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (inactive || reduceMotion) return;
    Animated.spring(scale, {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.button,
          variant === "primary" && styles.primary,
          variant === "soft" && styles.soft,
          variant === "destructive" && styles.destructive,
          variant === "glass" && styles.glass,
          compact && styles.compact,
          pressed && variant === "primary" && styles.pressed,
          pressed && variant !== "primary" && styles.secondaryPressed,
          inactive && styles.disabled,
        ]}
      >
        {variant === "primary" && !inactive && (
          <View pointerEvents="none" style={styles.topBevel} />
        )}
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === "soft" || variant === "glass"
                ? colors.teal
                : variant === "destructive"
                  ? colors.error
                  : colors.surface
            }
          />
        ) : icon ? (
          <DesignIcon
            name={icon}
            size={compact ? 16 : 20}
            tintColor={
              variant === "soft" || variant === "glass"
                ? colors.teal
                : variant === "destructive"
                  ? colors.error
                  : colors.surface
            }
          />
        ) : null}
        <Text
          style={[
            typography.headline,
            styles.label,
            compact && styles.compactLabel,
            variant === "soft" && styles.softLabel,
            variant === "destructive" && styles.destructiveLabel,
            variant === "glass" && styles.glassLabel,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radii.control,
    paddingHorizontal: 20,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    overflow: "hidden",
    position: "relative",
  },
  primary: {
    backgroundColor: colors.teal,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    ...shadows.primaryButton,
  },
  soft: {
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: "rgba(0, 140, 172, 0.12)",
  },
  glass: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.88)",
    ...shadows.glass,
  },
  destructive: {
    backgroundColor: colors.errorSurface,
    borderWidth: 1,
    borderColor: "rgba(201, 52, 43, 0.15)",
  },
  compact: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  compactLabel: { fontSize: 15, lineHeight: 20 },
  topBevel: {
    position: "absolute",
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.38)",
  },
  destructiveLabel: { color: colors.error },
  secondaryPressed: { opacity: 0.72 },
  pressed: { backgroundColor: colors.tealPressed },
  disabled: { opacity: 0.55 },
  label: { color: colors.surface, textAlign: "center", flexShrink: 1 },
  softLabel: { color: colors.coral },
  glassLabel: { color: colors.teal, fontWeight: "600" },
});
