import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors } from "@/shared/theme/tokens";

/** Use glass for floating controls, leaving content cards opaque and readable. */
export function GlassSurface({ children, style, ...props }: ViewProps) {
  const { reduceTransparency } = useAccessibilityPreferences();
  const nativeGlass =
    Platform.OS === "ios" &&
    !reduceTransparency &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();
  const blur =
    !reduceTransparency && (Platform.OS === "ios" || Platform.OS === "web");
  if (nativeGlass) {
    return (
      <GlassView
        {...props}
        colorScheme="light"
        glassEffectStyle="regular"
        style={[styles.surface, style]}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View {...props} style={[styles.surface, style, !blur && styles.solid]}>
      {blur && (
        <BlurView
          pointerEvents="none"
          tint="systemChromeMaterialLight"
          intensity={70}
          style={StyleSheet.absoluteFill}
        />
      )}
      {!reduceTransparency && (
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(255,255,255,0.55)",
            "rgba(255,255,255,0.08)",
            "rgba(210,237,248,0.15)",
          ]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  surface: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    overflow: "hidden",
  },
  solid: { backgroundColor: colors.surface, borderColor: colors.line },
});
