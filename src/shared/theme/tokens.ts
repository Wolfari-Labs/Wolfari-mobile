import { StyleSheet } from "react-native";
import foundation from "./foundation.json";

// Figma D · Pastel mềm 3D. Existing semantic keys remain compatible with all flows.
// NativeWind and StyleSheet share one palette, not two independently maintained themes.
export const colors = foundation.colors;
export const radii = foundation.radii;

const clayInset = "inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -4px 10px rgba(51,64,115,0.06)";
export const gradients = {
  canvas: [colors.canvas, colors.lavender, colors.mintCanvas],
  primary: [colors.gradientBlue, colors.gradientMint],
  card: [colors.surface, colors.fill],
  mascot: [colors.tealSoft, colors.mint],
} as const;
export const fonts = { body: "Nunito-SemiBold", bold: "Nunito-Bold", heading: "Nunito-ExtraBold" };

export const pastelTones = {
  blue: { surface: colors.tealSoft, gradient: ["#7BA7FF", colors.blue] },
  mint: { surface: colors.mint, gradient: ["#5EE0B0", "#2DBE7A"] },
  butter: { surface: colors.butter, gradient: ["#FFD66B", "#F5A623"] },
  lilac: { surface: colors.lilac, gradient: ["#A58BFF", colors.violet] },
  peach: { surface: colors.peach, gradient: ["#FFA48C", "#FF6F59"] },
} as const;

// The same clay elevation is shared by forms, cards, buttons and floating chrome.
export const shadows = {
  card: {
    boxShadow: `0 12px 28px -4px rgba(92,122,199,0.18), ${clayInset}`,
  },
  glass: {
    boxShadow: `0 8px 20px -4px rgba(92,122,199,0.12), ${clayInset}`,
  },
  dock: {
    boxShadow: `0 12px 28px -4px rgba(92,122,199,0.18), ${clayInset}`,
  },
  segmentActive: {
    boxShadow: `0 4px 10px rgba(92,122,199,0.12), ${clayInset}`,
  },
  primaryButton: {
    boxShadow: `0 10px 24px -4px rgba(92,122,199,0.22), ${clayInset}`,
  },
  floating: {
    boxShadow: `0 8px 20px -4px rgba(92,122,199,0.12), ${clayInset}`,
  },
};

export const springs = {
  snappy: { damping: 15, stiffness: 320, mass: 0.7 },
  bouncy: { damping: 14, stiffness: 240, mass: 0.8 },
  gentle: { damping: 20, stiffness: 180, mass: 1 },
  // A stamp lands hard and settles; a map pin drops then wobbles once.
  stamp: { damping: 11, stiffness: 260, mass: 0.7 },
  pin: { damping: 9, stiffness: 210, mass: 0.6 },
};

/** Ink outline shared by paper cards, chips and map labels. */
export const ink = {
  border: { borderWidth: 1.5, borderColor: colors.ink },
  hairline: { borderWidth: 1, borderColor: "rgba(23, 63, 99, 0.35)" },
};

export const typography = StyleSheet.create({
  largeTitle: {
    fontFamily: fonts.heading,
    color: colors.ink,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
  },
  title: {
    fontFamily: fonts.heading,
    color: colors.ink,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  section: {
    fontFamily: fonts.heading,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  headline: {
    fontFamily: fonts.bold,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
  },
  body: { fontFamily: fonts.body, color: colors.ink, fontSize: 15, lineHeight: 22 },
  // Map-legend caps: small, wide-tracked labels in muted ink.
  eyebrow: { fontFamily: fonts.bold, color: colors.muted, fontSize: 12, lineHeight: 18, letterSpacing: 0.8 },
  footnote: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  // Italic place-name lettering used on the illustrated map.
  mapLabel: { color: colors.lagoon, fontSize: 12, lineHeight: 16, fontStyle: "italic", fontWeight: "500" },
});
