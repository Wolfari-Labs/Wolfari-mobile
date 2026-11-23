import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import type { RefObject } from "react";
import { Platform, StyleSheet, View, type ViewInstance, type ViewProps, type ViewStyle } from "react-native";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, radii, shadows } from "@/shared/theme/tokens";

/**
 * Floating chrome (dock, sticky footers, buttons over photos) is real glass: what scrolls
 * underneath stays faintly visible through a light blur. Reading surfaces (cards, forms)
 * stay opaque clay so text never sits on moving content.
 *
 * - iOS 26+: the system Liquid Glass material.
 * - Older iOS and the web: a material blur plus a soft white veil and a specular rim.
 * - Android: Dimezis blur when the screen passes its BlurTargetView, otherwise a nearly
 *   opaque veil (no blur source means no glass worth faking).
 * - Reduce Transparency: always the opaque clay surface.
 */
export type GlassVariant =
  | "regular"
  | "dock"
  | "subtle"
  | "prominent"
  | "card";

export type GlassSurfaceProps = ViewProps & {
  variant?: GlassVariant;
  /** Blur strength 1–100 for the blur fallback. */
  intensity?: number;
  /** Interactive surfaces get a slightly deeper shadow (and native interactive glass). */
  interactive?: boolean;
  /** Pastel surface tint, e.g. butter or mint. Forces the opaque clay surface. */
  tintColor?: string;
  disableGlow?: boolean;
  /** Android blurs this view's content; iOS and the web sample the screen directly. */
  blurTarget?: RefObject<ViewInstance | null>;
};

/** Groups surfaces; kept so existing imports keep compiling. */
export function GlassContainer({ children, ...props }: ViewProps) {
  return <View {...props}>{children}</View>;
}

/** Only floating chrome is glass; cards and plain panels are clay. */
const GLASS: Record<GlassVariant, boolean> = { dock: true, prominent: true, subtle: true, regular: false, card: false };
const INTENSITY: Record<GlassVariant, number> = { dock: 42, prominent: 38, subtle: 30, regular: 30, card: 30 };
// The veil keeps labels readable over busy photos while the blur still shows motion behind.
// The material tint already whitens the blur; the veil only evens out busy backgrounds.
const VEIL: Record<"ios" | "web" | "androidBlur" | "androidSolid", string> = {
  ios: "rgba(255,255,255,0.16)",
  web: "rgba(255,255,255,0.24)",
  androidBlur: "rgba(255,255,255,0.38)",
  androidSolid: "rgba(255,255,255,0.94)",
};

let nativeGlassCache: boolean | undefined;
function nativeGlass() {
  if (nativeGlassCache === undefined) {
    try {
      nativeGlassCache = Platform.OS === "ios" && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
    } catch {
      nativeGlassCache = false;
    }
  }
  return nativeGlassCache;
}

export function GlassSurface({
  children,
  style,
  variant = "regular",
  interactive = false,
  tintColor,
  intensity,
  disableGlow = false,
  blurTarget,
  ...props
}: GlassSurfaceProps) {
  const { reduceTransparency } = useAccessibilityPreferences();
  const variantStyle = styles[variant] ?? styles.regular;
  const glass = GLASS[variant] && !reduceTransparency && !tintColor;

  if (!glass) {
    return (
      <View
        {...props}
        style={[styles.surface, variantStyle, interactive && styles.interactive, tintColor ? { backgroundColor: tintColor } : null, style]}
      >
        {children}
      </View>
    );
  }

  if (nativeGlass()) {
    return (
      <GlassView
        {...props}
        colorScheme="light"
        glassEffectStyle={variant === "subtle" ? "clear" : "regular"}
        isInteractive={interactive}
        style={[styles.surface, styles.glass, variantStyle, style]}
      >
        {children}
      </GlassView>
    );
  }

  const radius = (StyleSheet.flatten([variantStyle, style]) as ViewStyle | undefined)?.borderRadius ?? radii.cardLarge;
  const androidBlur = Platform.OS === "android" && !!blurTarget;
  const blurs = Platform.OS === "ios" || Platform.OS === "web" || androidBlur;
  const veil = Platform.OS === "ios" ? VEIL.ios : Platform.OS === "web" ? VEIL.web : androidBlur ? VEIL.androidBlur : VEIL.androidSolid;
  return (
    <View {...props} style={[styles.surface, styles.glass, variantStyle, interactive && styles.interactive, style]}>
      {blurs && (
        <BlurView
          pointerEvents="none"
          tint={variant === "subtle" ? "systemThinMaterialLight" : "systemChromeMaterialLight"}
          intensity={intensity ?? INTENSITY[variant]}
          blurMethod={androidBlur ? "dimezisBlurViewSdk31Plus" : undefined}
          blurTarget={androidBlur ? blurTarget : undefined}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: veil }]} />
      {!disableGlow && <View pointerEvents="none" style={[styles.rim, { borderRadius: radius }]} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: radii.cardLarge,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  glass: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.85)",
  },
  // A thin bright edge along the top reads as the lit bevel of a glass pane.
  rim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.cardLarge,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
  },
  regular: { ...shadows.glass },
  dock: { ...shadows.dock },
  prominent: { ...shadows.dock },
  subtle: { ...shadows.floating },
  card: { ...shadows.card },
  interactive: { ...shadows.dock },
});
