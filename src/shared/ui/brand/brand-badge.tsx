import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { colors } from "@/shared/theme/tokens";
import { designAssets } from "../design-assets";

/**
 * The Wolfari logo as a round badge for the corner of a screen (Figma D · M04 avatar slot):
 * Wolfi's bust with the wordmark across the bottom, on a white clay disc.
 */
export function BrandBadge({ size = 48 }: { size?: number }) {
  // Children are placed inside the 3pt white rim; the wordmark sits where the circle is wide enough for it.
  const inner = size - 6;
  const bust = inner * 0.68;
  const word = inner * 0.76;
  return <View accessible accessibilityRole="image" accessibilityLabel="Wolfari"
    style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}>
    <Image source={designAssets.wolfiBust} contentFit="contain" accessible={false}
      style={{ position: "absolute", width: bust, height: bust * 1.345, top: inner * 0.02, left: (inner - bust) / 2 }} />
    <Image source={designAssets.wordmark} contentFit="contain" accessible={false}
      style={{ position: "absolute", width: word, height: word * 0.285, bottom: inner * 0.2, left: (inner - word) / 2 }} />
  </View>;
}

const styles = StyleSheet.create({
  disc: {
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.surface,
    boxShadow: "0 8px 20px -4px rgba(92,122,199,0.12), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -4px 10px rgba(51,64,115,0.06)",
  },
});
