import { BlurView } from "expo-blur";
import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, radii, shadows } from "@/shared/theme/tokens";

export { GlassContainer };

export type GlassVariant =
  | "regular"
  | "dock"
  | "subtle"
  | "prominent"
  | "card";

export type GlassSurfaceProps = ViewProps & {
  variant?: GlassVariant;
  intensity?: number;
  interactive?: boolean;
  tintColor?: string;
  disableGlow?: boolean;
};

const VARIANT_INTENSITY: Record<GlassVariant, number> = {
  regular: 80,
  dock: 95,
  prominent: 90,
  subtle: 60,
  card: 75,
};

const VARIANT_GRADIENTS: Record<GlassVariant, readonly [string, string, ...string[]]> = {
  dock: [
    "rgba(255,255,255,0.82)",
    "rgba(240,249,253,0.55)",
    "rgba(224,244,250,0.36)",
  ],
  prominent: [
    "rgba(255,255,255,0.80)",
    "rgba(242,250,253,0.50)",
    "rgba(226,245,251,0.30)",
  ],
  regular: [
    "rgba(255,255,255,0.72)",
    "rgba(242,250,253,0.42)",
    "rgba(228,245,251,0.22)",
  ],
  subtle: [
    "rgba(255,255,255,0.58)",
    "rgba(245,251,253,0.28)",
    "rgba(255,255,255,0.18)",
  ],
  card: [
    "rgba(255,255,255,0.88)",
    "rgba(255,255,255,0.76)",
    "rgba(246,251,253,0.68)",
  ],
};

/** Use glass for floating controls, docks and interactive panels. */
export function GlassSurface({
  children,
  style,
  variant = "regular",
  intensity: customIntensity,
  interactive = false,
  tintColor,
  disableGlow = false,
  ...props
}: GlassSurfaceProps) {
  const { reduceTransparency } = useAccessibilityPreferences();
  const nativeGlass =
    Platform.OS === "ios" &&
    !reduceTransparency &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();
  const blur =
    !reduceTransparency && (Platform.OS === "ios" || Platform.OS === "web");

  const variantStyle = styles[variant] ?? styles.regular;
  const intensity = customIntensity ?? VARIANT_INTENSITY[variant];

  if (nativeGlass) {
    return (
      <GlassView
        {...props}
        colorScheme="light"
        glassEffectStyle={variant === "subtle" ? "clear" : "regular"}
        isInteractive={interactive}
        tintColor={tintColor}
        style={[styles.surface, variantStyle, style]}
      >
        {!disableGlow && (
          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(255,255,255,0.68)",
              "rgba(255,255,255,0.12)",
              "rgba(255,255,255,0.02)",
              "rgba(255,255,255,0.14)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.3, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View pointerEvents="none" style={styles.specularBevel} />
        {children}
      </GlassView>
    );
  }

  return (
    <View
      {...props}
      style={[
        styles.surface,
        variantStyle,
        style,
        !blur && styles.solid,
      ]}
    >
      {blur && (
        <BlurView
          pointerEvents="none"
          tint={
            variant === "dock" || variant === "prominent"
              ? "systemChromeMaterialLight"
              : "systemThinMaterialLight"
          }
          intensity={intensity}
          blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
          style={StyleSheet.absoluteFill}
        />
      )}
      {!reduceTransparency && (
        <>
          {/* Layer 1: Liquid refraction base tint */}
          <LinearGradient
            pointerEvents="none"
            colors={VARIANT_GRADIENTS[variant]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Layer 2: Apple specular highlight on top bevel */}
          {!disableGlow && (
            <LinearGradient
              pointerEvents="none"
              colors={[
                "rgba(255,255,255,0.92)",
                "rgba(255,255,255,0.24)",
                "rgba(255,255,255,0.02)",
                "rgba(255,255,255,0.18)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.25, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {/* Layer 3: Ultra-thin specular reflection line */}
          <View pointerEvents="none" style={styles.specularBevel} />
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: radii.cardLarge,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: "hidden",
  },
  regular: {
    ...shadows.glass,
  },
  dock: {
    borderColor: "rgba(255,255,255,0.85)",
    ...shadows.dock,
  },
  prominent: {
    borderColor: "rgba(255,255,255,0.82)",
    ...shadows.dock,
  },
  subtle: {
    borderColor: colors.glassBorderSubtle,
    ...shadows.floating,
  },
  card: {
    borderColor: colors.glassCardBorder,
    ...shadows.card,
  },
  specularBevel: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
    opacity: 0.75,
  },
  solid: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
  },
});
