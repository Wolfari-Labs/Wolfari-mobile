import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { colors, gradients, radii, shadows, typography } from "@/shared/theme/tokens";
import { designAssets } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
import { GlassSurface } from "@/shared/ui/glass-surface";
import type { Trip } from "../types";
import { lifecycleLabels, tripDates } from "../utils";
import { openTrip } from "./trip-navigation";

export function coverFor(trip: Pick<Trip, "name">) {
  const name = trip.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
  return /da lat/.test(name) ? designAssets.dalat : /da nang/.test(name) ? designAssets.pastelDestination : /hoi an/.test(name) ? designAssets.pastelBridge : designAssets.pastelCoast;
}

export function TripCard({ trip, ticket = false, interactive = true, compact = false }: {
  trip: Trip; ticket?: boolean; interactive?: boolean; compact?: boolean;
}) {
  const press = usePressMotion(!interactive);
  const content = compact ? <>
    <Image source={coverFor(trip)} style={styles.thumb} contentFit="cover" accessible={false} />
    <View style={styles.copy}>
      <Text style={typography.headline} numberOfLines={2}>{trip.name}</Text>
      <Text style={typography.footnote}>{tripDates(trip)}</Text>
      <Text style={styles.rowStatus}>{lifecycleLabels[trip.lifecycle]}</Text>
    </View>
    <View style={styles.arrow}><DesignIcon name="chevron" size={18} tintColor={colors.ink} /></View>
  </> : <>
    <LinearGradient pointerEvents="none" colors={gradients.card} style={[StyleSheet.absoluteFill, styles.background]} />
    <View style={[styles.cover, !interactive && styles.overviewCover]}>
      <Image source={coverFor(trip)} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={trip.name} />
      <GlassSurface variant="subtle" style={styles.badge}>
        <View style={[styles.dot, { backgroundColor: trip.lifecycle === "ONGOING" ? colors.pinGreen : colors.blue }]} />
        <Text style={styles.badgeText}>{lifecycleLabels[trip.lifecycle]}</Text>
      </GlassSurface>
    </View>
    {interactive && <View style={styles.details}>
      <Text style={typography.section} numberOfLines={2}>{trip.name}</Text>
      <Text style={typography.footnote}>{tripDates(trip)}</Text>
      {ticket && <View style={styles.continue}>
        <Text style={[typography.footnote, styles.link]}>Tiếp tục lên kế hoạch</Text>
        <DesignIcon name="chevron" size={18} tintColor={colors.teal} />
      </View>}
    </View>}
  </>;
  if (!interactive) return <View style={styles.overview}>{content}</View>;
  return <Animated.View style={press.animatedStyle}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Mở chuyến đi ${trip.name}`}
      onPress={() => openTrip(trip.id)} onPressIn={press.onPressIn} onPressOut={press.onPressOut}
      style={[styles.card, compact && styles.row]}>{content}</Pressable>
  </Animated.View>;
}
const styles = StyleSheet.create({
  card: { padding: 12, paddingBottom: 18, gap: 12, borderRadius: radii.cardLarge, backgroundColor: colors.surface, ...shadows.card },
  background: { borderRadius: radii.cardLarge },
  cover: { height: 176, borderRadius: 26, overflow: "hidden", backgroundColor: colors.tealSoft },
  overview: { borderRadius: 32, padding: 5, backgroundColor: colors.surface, ...shadows.card },
  overviewCover: { height: 196, borderRadius: 28 },
  details: { paddingHorizontal: 6, gap: 6 },
  badge: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill },
  badgeText: { ...typography.footnote, color: colors.ink, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  continue: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  link: { color: colors.teal },
  row: { flexDirection: "row", alignItems: "center", borderRadius: radii.card, padding: 10, paddingRight: 14, minHeight: 88 },
  thumb: { width: 68, height: 68, borderRadius: 22 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  rowStatus: { ...typography.footnote, color: colors.teal, fontSize: 12 },
  arrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
});
