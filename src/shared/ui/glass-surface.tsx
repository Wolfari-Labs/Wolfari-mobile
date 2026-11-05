import type { RefObject } from "react";
import { StyleSheet, View, type ViewProps, type ViewInstance } from "react-native";

import { colors, radii, shadows } from "@/shared/theme/tokens";

/**
 * Figma D · Soft clay surface.
 *
 * Opaque pastel surfaces with soft depth, without the direction E ink outline.
 * The component keeps its name and props so every floating control (dock,
 * footer, header buttons, badges on photos) switches style in one place.
 * Clay is opaque by design, so it needs no Reduce Transparency fallback.
 */
export type GlassVariant =
  | "regular"
  | "dock"
  | "subtle"
  | "prominent"
  | "card";

export type GlassSurfaceProps = ViewProps & {
  variant?: GlassVariant;
  /** Kept for API compatibility with the previous glass material. */
  intensity?: number;
  /** Interactive surfaces get a slightly deeper clay shadow. */
  interactive?: boolean;
  /** Pastel surface tint, e.g. butter or mint. */
  tintColor?: string;
  disableGlow?: boolean;
  /** Kept for API compatibility; clay does not sample what is behind it. */
  blurTarget?: RefObject<ViewInstance | null>;
};

/** Groups clay surfaces; kept so existing imports keep compiling. */
export function GlassContainer({ children, ...props }: ViewProps) {
  return <View {...props}>{children}</View>;
}

export function GlassSurface({
  children,
  style,
  variant = "regular",
  interactive = false,
  tintColor,
  intensity: _intensity,
  disableGlow: _disableGlow,
  blurTarget: _blurTarget,
  ...props
}: GlassSurfaceProps) {
  return (
    <View
      {...props}
      style={[
        styles.surface,
        styles[variant] ?? styles.regular,
        interactive && styles.interactive,
        tintColor ? { backgroundColor: tintColor } : null,
        style,
      ]}
    >
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
  regular: { ...shadows.glass },
  dock: { ...shadows.dock },
  prominent: { ...shadows.dock },
  subtle: { ...shadows.floating },
  card: { ...shadows.card },
  interactive: { ...shadows.dock },
});
