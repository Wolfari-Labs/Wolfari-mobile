import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { colors, gradients, radii, typography } from "@/shared/theme/tokens";
import { Wolfi, type WolfiPose } from "@/shared/ui/carto/wolfi";
import type { DesignIconName } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
import { avatarLetter } from "./avatar-letter";

/** Decorative pictures for the money screens. They carry no data, so they are hidden from screen readers. */
const decorative = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const;

/** Photo header with a short caption and the mascot, to open a screen with a picture instead of text. */
export function PhotoBanner({ source, eyebrow, title, pose = "scooter" }: { source: ImageSource | number; eyebrow: string; title: string; pose?: WolfiPose }) {
  return (
    <View style={styles.banner}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" {...decorative} />
      <LinearGradient pointerEvents="none" colors={["rgba(12,32,56,0.05)", "rgba(12,32,56,0.72)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.bannerText}>
        <Text style={[typography.footnote, styles.onPhoto, styles.eyebrow]}>{eyebrow}</Text>
        <Text style={[typography.section, styles.onPhoto]}>{title}</Text>
      </View>
      <View style={styles.bannerMascot} {...decorative}>
        <Wolfi pose={pose} size={92} motion={pose === "scooter" ? "drive" : "float"} />
      </View>
    </View>
  );
}

/** Round icon badge used to give a record a recognisable picture. */
export function IconTile({ icon, tone = colors.mint }: { icon: DesignIconName; tone?: string }) {
  return (
    <View style={[styles.tile, { backgroundColor: tone }]} {...decorative}>
      <DesignIcon name={icon} size={22} tintColor={colors.ink} />
    </View>
  );
}

/** Coloured circle with the first letter of a name, so people in a list are told apart at a glance. */
export function Avatar({ name }: { name: string }) {
  const tones = [colors.mint, colors.fill, colors.tealSoft, colors.lavender];
  const letter = avatarLetter(name);
  const tone = tones[[...name].reduce((sum, char) => sum + char.codePointAt(0)!, 0) % tones.length];
  return (
    <View style={[styles.avatar, { backgroundColor: tone }]} {...decorative}>
      <Text style={typography.headline}>{letter}</Text>
    </View>
  );
}

/** Soft pastel blue-to-mint from the app palette behind a headline number; ink text stays easy to read. */
export const heroGradient = gradients.mascot;

/** Overlapping avatars with a caption, e.g. the people who share a fund. */
export function AvatarStack({ names, caption }: { names: string[]; caption: string }) {
  return (
    <View style={styles.stack}>
      <View style={styles.stackRow}>
        {names.slice(0, 5).map((name, index) => <View key={`${name}:${index}`} style={[styles.stackItem, index > 0 && styles.stackOverlap]}><Avatar name={name} /></View>)}
      </View>
      <Text style={[typography.footnote, { color: colors.ink }]}>{caption}</Text>
    </View>
  );
}

/** Short highlighted tag such as a deal or a mood. */
export function Sticker({ label, tone = colors.butter }: { label: string; tone?: string }) {
  return (
    <View style={[styles.sticker, { backgroundColor: tone }]}>
      <Text style={typography.headline}>{label}</Text>
    </View>
  );
}

/** Flight path drawing: origin pin, dotted line, plane, dotted line, destination pin. */
export function RouteStrip() {
  const dots = (key: string) => (
    <View key={key} style={styles.dots}>
      {[0, 1, 2, 3, 4, 5].map(index => <View key={index} style={styles.dot} />)}
    </View>
  );
  return (
    <View style={styles.route} {...decorative}>
      <IconTile icon="pin" tone={colors.fill} />
      {dots("out")}
      <IconTile icon="plane" tone={colors.mint} />
      {dots("in")}
      <IconTile icon="pin" tone={colors.fill} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { height: 148, borderRadius: radii.card, overflow: "hidden", justifyContent: "flex-end" },
  bannerText: { padding: 16, paddingRight: 110, gap: 2 },
  bannerMascot: { position: "absolute", right: 8, bottom: 4 },
  onPhoto: { color: "#FFFFFF" },
  eyebrow: { letterSpacing: 0.8, textTransform: "uppercase" },
  tile: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  stack: { flexDirection: "row", alignItems: "center", gap: 10 },
  stackRow: { flexDirection: "row" },
  stackItem: { borderRadius: 19, borderWidth: 2, borderColor: "#FFFFFF" },
  stackOverlap: { marginLeft: -10 },
  sticker: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, transform: [{ rotate: "-2deg" }] },
  route: { flexDirection: "row", alignItems: "center", gap: 8 },
  dots: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.tealPressed, opacity: 0.45 },
});
