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
};

export const radii = { control: 16, card: 20, cardLarge: 24, pill: 999 };
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
