import { StyleSheet } from "react-native";

// iOS-inspired grouped surfaces and typography, using the platform system font.
export const colors = {
  canvas: "#F2F2F7",
  surface: "#FFFFFF",
  ink: "#1C1C1E",
  muted: "#6C6C70",
  teal: "#008CAC",
  tealPressed: "#00758F",
  tealSoft: "#EAF5F7",
  mint: "#EAF5F1",
  peach: "#FFF6E6",
  fill: "#E5E5EA",
  coral: "#008CAC",
  orange: "#D86D4A",
  amber: "#B58B45",
  line: "#DCDCE0",
  error: "#C9342B",
  errorSurface: "#FFF0EF",
  // iOS Liquid Glass tokens
  glassBorder: "rgba(255, 255, 255, 0.72)",
  glassBorderSubtle: "rgba(255, 255, 255, 0.42)",
  glassSpecular: "rgba(255, 255, 255, 0.95)",
  glassRefraction: "rgba(220, 245, 252, 0.35)",
  glassSurface: "rgba(255, 255, 255, 0.75)",
  glassSurfaceSubtle: "rgba(255, 255, 255, 0.55)",
  glassSurfaceProminent: "rgba(255, 255, 255, 0.88)",
  glassCard: "rgba(255, 255, 255, 0.82)",
  glassCardBorder: "rgba(255, 255, 255, 0.65)",
};

export const radii = { control: 16, card: 20, cardLarge: 24, pill: 999 };

// Authentic iOS layered shadows with web boxShadow support
export const shadows = {
  card: {
    shadowColor: "#0F283C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    boxShadow:
      "0 4px 18px -2px rgba(15, 40, 60, 0.08), 0 1px 2px rgba(0, 0, 0, 0.02)",
  },
  glass: {
    shadowColor: "#0A243A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    boxShadow:
      "0 10px 30px -4px rgba(10, 36, 58, 0.14), 0 2px 6px rgba(0, 0, 0, 0.03), inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 1px 0 rgba(255, 255, 255, 0.25)",
  },
  dock: {
    shadowColor: "#082136",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    boxShadow:
      "0 16px 44px -6px rgba(8, 33, 54, 0.22), 0 4px 12px rgba(0, 0, 0, 0.04), inset 0 1.2px 1.5px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px 0 rgba(255, 255, 255, 0.3)",
  },
  segmentActive: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    boxShadow:
      "0 3px 10px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06), inset 0 0.5px 0.5px rgba(255, 255, 255, 0.9)",
  },
  primaryButton: {
    shadowColor: "#008CAC",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    boxShadow:
      "0 6px 18px -2px rgba(0, 140, 172, 0.35), 0 2px 4px rgba(0, 0, 0, 0.04)",
  },
  floating: {
    shadowColor: "#0A243A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    boxShadow:
      "0 8px 24px -2px rgba(10, 36, 58, 0.12), 0 2px 4px rgba(0, 0, 0, 0.03), inset 0 1px 1px rgba(255, 255, 255, 0.8)",
  },
};

export const springs = {
  snappy: { damping: 15, stiffness: 320, mass: 0.7 },
  bouncy: { damping: 14, stiffness: 240, mass: 0.8 },
  gentle: { damping: 20, stiffness: 180, mass: 1 },
};
export const typography = StyleSheet.create({
  largeTitle: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  section: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
  },
  headline: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
  },
  body: { color: colors.ink, fontSize: 17, lineHeight: 24, fontWeight: "400" },
  footnote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
  },
});
